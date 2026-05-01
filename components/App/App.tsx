/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState, useRef } from 'react';
import { em } from '@lib/engine/engine_manager';
import { screenManager } from '@lib/screen/screen_manager';
import { Screen } from '@lib/screen/screen';
import { gfx3Manager } from '@lib/gfx3/gfx3_manager';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { gfx3PostRenderer, PostParam } from '@lib/gfx3_post/gfx3_post_renderer';
import { gfx3JoltManager, JOLT_LAYER_MOVING, JOLT_RVEC3_TO_VEC3, VEC3_TO_JOLT_RVEC3, Gfx3Jolt } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Camera } from '@lib/gfx3_camera/gfx3_camera';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { eventManager } from '@lib/core/event_manager';
import { Gfx3Drawable, Gfx3MeshEffect } from '@lib/gfx3/gfx3_drawable';
import { inputManager } from '@lib/input/input_manager';
import { motion, AnimatePresence } from 'framer-motion';
import { Tank } from './game/Tank';
import { Player } from './game/Player';
import { Environment } from './game/Environment';
import { Enemy } from './game/Enemy';
import { Explosion } from './game/Explosion';
import { createBoxMesh } from './game/GameUtils';

// --- SCREEN ---

class GameScreen extends Screen {
  camera: Gfx3Camera;
  tank: Tank;
  player: Player;
  level: Environment;
  enemies: Enemy[] = [];
  explosions: Explosion[] = [];
  moveDir = { x: 0, y: 0 };
  virtualFire = false;
  virtualInteract = false;
  
  isPlayerInTank: boolean = true;
  cameraYaw = Math.PI; 
  cameraPitch = 0.2;
  cameraDistance = 8;
  isReady: boolean = false;
  cameraLookTarget: vec3 = [0, 0, 0];
  
  constructor() {
    super();
    this.camera = new Gfx3Camera(0);
    this.tank = new Tank();
    this.player = new Player();
    this.level = new Environment();
    
    // Spawn some enemies
    for (let i = 0; i < 15; i++) {
       const x = (Math.random() - 0.5) * 200;
       const z = (Math.random() - 0.5) * 200;
       if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
       this.enemies.push(new Enemy(x, 5, z));
    }
  }

  async onEnter() {
    gfx3PostRenderer.setParam(PostParam.PIXELATION_ENABLED, 0.0);
    
    // Load Models
    await Promise.all([
      this.tank.load(),
      this.player.load(),
      Enemy.initMeshes()
    ]);
    
    // Desktop Controls
    inputManager.registerAction('keyboard', 'KeyW', 'THR_FWD');
    inputManager.registerAction('keyboard', 'KeyS', 'THR_BWD');
    inputManager.registerAction('keyboard', 'KeyA', 'STR_LFT');
    inputManager.registerAction('keyboard', 'KeyD', 'STR_RGT');
    inputManager.registerAction('keyboard', 'KeyQ', 'CAM_L');
    inputManager.registerAction('keyboard', 'KeyC', 'CAM_R');
    inputManager.registerAction('keyboard', 'KeyE', 'INTERACT');
    inputManager.registerAction('keyboard', 'KeyR', 'CAM_Z_IN');
    inputManager.registerAction('keyboard', 'KeyF', 'CAM_Z_OUT');
    inputManager.registerAction('keyboard', 'Space', 'FIRE');
    inputManager.registerAction('keyboard', 'Space', 'JUMP');
    inputManager.registerAction('keyboard', 'ShiftLeft', 'RUN');

    inputManager.setPointerLockEnabled(true);
    eventManager.subscribe(inputManager, 'E_MOUSE_MOVE', this, this.handleMouseMove);

    this.camera.setPosition(0, 10, -10);
    this.camera.lookAt(0, 0, 0);
    this.camera.getView().setBgColor(0.53, 0.81, 0.92, 1.0); // Sky blue
    
    // Default start inside tank
    if (this.isPlayerInTank) {
      gfx3JoltManager.bodyInterface.SetPosition(this.player.physicsBody.body.GetID(), VEC3_TO_JOLT_RVEC3([0, -100, 0]), Gfx3Jolt.EActivation_DontActivate);
      const tankPos = this.tank.body.getPosition();
      this.cameraLookTarget = [tankPos[0], tankPos[1] + 1.5, tankPos[2]];
    }
    this.isReady = true;
  }

  handleMouseMove = (data: any) => {
    if (inputManager.isPointerLockCaptured() || inputManager.isMouseDown()) {
       this.cameraYaw -= data.movementX * 0.005;
       this.cameraPitch += data.movementY * 0.005;
       
       // Limit pitch to avoid flipping over and going way below ground
       this.cameraPitch = Math.max(-0.1, Math.min(Math.PI / 2 - 0.1, this.cameraPitch));
    }
  };

  update(ts: number) {
    inputManager.update(ts);
    gfx3JoltManager.update(ts);

    if (inputManager.isActiveAction('CAM_L')) this.cameraYaw -= 0.05;
    if (inputManager.isActiveAction('CAM_R')) this.cameraYaw += 0.05;
    if (inputManager.isActiveAction('CAM_Z_IN')) this.cameraDistance = Math.max(5, this.cameraDistance - 0.5);
    if (inputManager.isActiveAction('CAM_Z_OUT')) this.cameraDistance = Math.min(40, this.cameraDistance + 0.5);

    // Toggle Tank Entry
    if (inputManager.isJustActiveAction('INTERACT') || this.virtualInteract) {
       this.virtualInteract = false;
       const tankPos = JOLT_RVEC3_TO_VEC3(this.tank.physicsBody.body.GetPosition());
       const playerPos = this.player.position;
       const dist = UT.VEC3_DISTANCE(tankPos, playerPos);
       
       // Allow exit if already in tank, or enter if near the tank
       if (this.isPlayerInTank || dist < 6.0) {
          this.isPlayerInTank = !this.isPlayerInTank;
          
          if (this.isPlayerInTank) {
            // Hide player and move physics body away
            gfx3JoltManager.bodyInterface.SetPosition(this.player.physicsBody.body.GetID(), VEC3_TO_JOLT_RVEC3([0, -100, 0]), Gfx3Jolt.EActivation_DontActivate);
          } else {
            // Exit tank: place player next to tank
            const rot = this.tank.rotation;
            const exitX = tankPos[0] + Math.cos(rot + Math.PI/2) * 4;
            const exitZ = tankPos[2] - Math.sin(rot + Math.PI/2) * 4;
            gfx3JoltManager.bodyInterface.SetPosition(this.player.physicsBody.body.GetID(), VEC3_TO_JOLT_RVEC3([exitX, tankPos[1] + 2, exitZ]), Gfx3Jolt.EActivation_Activate);
          }
       }
    }

    let kbX = 0;
    let kbY = 0;
    if (inputManager.isActiveAction('THR_FWD')) kbY += 1;
    if (inputManager.isActiveAction('THR_BWD')) kbY -= 1;
    if (inputManager.isActiveAction('STR_LFT')) kbX -= 1;
    if (inputManager.isActiveAction('STR_RGT')) kbX += 1;
    if (inputManager.isActiveAction('JUMP')) this.player.jump();

    const combinedMoveDir = { 
      x: kbX + (Math.abs(this.moveDir.x) > 0.1 ? this.moveDir.x : 0),
      y: kbY + (Math.abs(this.moveDir.y) > 0.1 ? this.moveDir.y : 0)
    };
    
    combinedMoveDir.x = Math.max(-1, Math.min(1, combinedMoveDir.x));
    combinedMoveDir.y = Math.max(-1, Math.min(1, combinedMoveDir.y));

    const isFiring = inputManager.isJustActiveAction('FIRE') || inputManager.isMouseDown() || this.virtualFire;

    this.level.update(ts);

    const targetPos = this.isPlayerInTank ? this.tank.body.getPosition() : this.player.position;
    for (const enemy of this.enemies) {
       enemy.update(ts, targetPos);
    }
    
    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
        const alive = this.explosions[i].update(ts);
        if (!alive) this.explosions.splice(i, 1);
    }

    // Hit Detection - Tank projectiles vs Enemies
    for (const p of this.tank.projectiles) {
        if (p.life <= 0) continue;
        const pPos = p.body.body.GetPosition();
        
        for (const enemy of this.enemies) {
            if (enemy.hp <= 0) continue;
            const ePos = enemy.physicsBody.body.GetPosition();
            const dx = pPos.GetX() - ePos.GetX();
            const dy = pPos.GetY() - ePos.GetY();
            const dz = pPos.GetZ() - ePos.GetZ();
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < 2.5) {
                enemy.hp -= 34; // 3 hits to kill (100 hp)
                p.life = 0; 
                this.explosions.push(new Explosion(pPos.GetX(), pPos.GetY(), pPos.GetZ()));
                if (enemy.hp <= 0) {
                    this.explosions.push(new Explosion(ePos.GetX(), ePos.GetY(), ePos.GetZ(), [0.8, 0.2, 0.2]));
                    gfx3JoltManager.bodyInterface.SetPosition(enemy.physicsBody.body.GetID(), VEC3_TO_JOLT_RVEC3([0, -100, 0]), Gfx3Jolt.EActivation_DontActivate);
                }
            }
        }
    }
    
    // Enemy projectiles vs Player/Tank
    for (const enemy of this.enemies) {
        for (const p of enemy.projectiles) {
            if (p.life <= 0) continue;
            const pPos = p.body.body.GetPosition();
            
            const pTarget = this.isPlayerInTank ? this.tank.body.getPosition() : this.player.position;
            const dx = pPos.GetX() - pTarget[0];
            const dy = pPos.GetY() - pTarget[1];
            const dz = pPos.GetZ() - pTarget[2];
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < (this.isPlayerInTank ? 2.5 : 1.0)) {
                p.life = 0;
                this.explosions.push(new Explosion(pPos.GetX(), pPos.GetY(), pPos.GetZ()));
                // Add camera shake or player damage logic here
            }
        }
    }

    const camPosForAim = this.camera.getPosition();
    const camLookForAim = this.cameraLookTarget;
    // Calculate a point far away along the camera look ray
    const viewDir = UT.VEC3_NORMALIZE(UT.VEC3_SUBSTRACT(camLookForAim, camPosForAim));
    const aimTarget = UT.VEC3_ADD(camPosForAim, UT.VEC3_SCALE(viewDir, 200));

    // Update based on possessed entity
    if (this.isPlayerInTank) {
      this.tank.update(ts, combinedMoveDir, isFiring, aimTarget);
      
      // Stop player
      this.player.update(ts, { x: 0, y: 0 });
    } else {
      this.tank.update(ts, { x: 0, y: 0 }, false, null);
      
      // Calculate local movement direction relative to camera yaw
      // Forward is aligning with the camera's look direction (ignoring Y).
      const camRad = this.cameraYaw;
      const cosC = Math.cos(camRad);
      const sinC = Math.sin(camRad);
      
      const worldDirX = combinedMoveDir.x * cosC - combinedMoveDir.y * sinC;
      const worldDirZ = -combinedMoveDir.x * sinC - combinedMoveDir.y * cosC;
      
      const isRunning = inputManager.isActiveAction('RUN');
      this.player.update(ts, { x: worldDirX, y: worldDirZ }, isRunning);
    }

    // Camera Follow
    const followPos = this.isPlayerInTank ? this.tank.body.getPosition() : this.player.position;
    
    // Convert spherical to cartesian for camera forward vector
    const cy = this.cameraYaw;
    const cp = this.cameraPitch;
    const forwardVec = [
        -Math.sin(cy) * Math.cos(cp),
        -Math.sin(cp),
        -Math.cos(cy) * Math.cos(cp)
    ] as vec3;

    const targetHeightOffset = this.isPlayerInTank ? 1.5 : 1.0;
    
    // Safety check for followPos to prevent NaN camera
    if (!followPos || isNaN(followPos[0]) || isNaN(followPos[1]) || isNaN(followPos[2])) {
        return;
    }

    const pivotPos = [followPos[0], followPos[1] + targetHeightOffset, followPos[2]] as vec3;
    
    // Base right and up vectors from forward
    const rightVec = UT.VEC3_NORMALIZE(UT.VEC3_CROSS(forwardVec, UT.VEC3_UP));
    const upVec = UT.VEC3_NORMALIZE(UT.VEC3_CROSS(rightVec, forwardVec));
    
    // Slight offset so the crosshair isn't blocked by the tank/player body
    const lookOffset = UT.VEC3_ADD(
        UT.VEC3_SCALE(upVec, this.isPlayerInTank ? 2.5 : 1.2),
        UT.VEC3_SCALE(rightVec, this.isPlayerInTank ? 0 : 1.0)
    );
    
    const actualPivot = UT.VEC3_ADD(pivotPos, lookOffset);

    // Camera sits behind the pivot
    const camTarget = UT.VEC3_SUBSTRACT(actualPivot, UT.VEC3_SCALE(forwardVec, this.cameraDistance));
    
    const camPos = this.camera.getPosition();
    const posLerpRate = 1.0 - Math.exp(-20.0 * (ts / 1000));
    const targetLerpRate = 1.0 - Math.exp(-20.0 * (ts / 1000));

    const lerpedPos = UT.VEC3_LERP(camPos, camTarget, posLerpRate);
    
    const desiredLookTarget = UT.VEC3_ADD(camTarget, UT.VEC3_SCALE(forwardVec, 100));
    this.cameraLookTarget = UT.VEC3_LERP(this.cameraLookTarget, desiredLookTarget, targetLerpRate);
    
    // Final NaN check before setting
    if (!isNaN(lerpedPos[0]) && !isNaN(lerpedPos[1]) && !isNaN(lerpedPos[2])) {
        this.camera.setPosition(lerpedPos[0], lerpedPos[1], lerpedPos[2]);
        this.camera.lookAt(this.cameraLookTarget[0], this.cameraLookTarget[1], this.cameraLookTarget[2]);
    }
  }

  draw() {
    gfx3Manager.beginDrawing();
    gfx3MeshRenderer.drawDirLight([0.6, -1.0, 0.4], [1.0, 0.95, 0.85], [1.0, 1.0, 1.0], 1.2);
    gfx3MeshRenderer.setAmbientColor([0.4, 0.4, 0.45]);

    const camPos = this.camera.getPosition();
    this.level.draw(camPos);
    this.tank.draw();
    for (const enemy of this.enemies) {
       enemy.draw();
    }
    for (const exp of this.explosions) {
       exp.draw();
    }
    if (!this.isPlayerInTank) {
       this.player.draw();
    }
    
    gfx3Manager.endDrawing();
  }

  render(ts: number) {
    if (!this.isReady) return;
    
    gfx3Manager.beginRender();
    
    // 1. Render scene to post-processing source texture
    gfx3Manager.setDestinationTexture(gfx3PostRenderer.getSourceTexture());
    gfx3Manager.beginPassRender(0);
    gfx3MeshRenderer.render(ts);
    gfx3Manager.endPassRender();
    
    // 2. Render post-processing to canvas
    gfx3Manager.setDestinationTexture(null);
    gfx3PostRenderer.render(ts, gfx3Manager.getCurrentRenderingTexture());
    
    gfx3Manager.endRender();
  }
}

// --- UI COMPONENTS ---

const Joystick = ({ onChange }: { onChange: (dir: { x: number, y: number }) => void }) => {
    const [dragging, setDragging] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let dx = e.clientX - centerX;
        let dy = e.clientY - centerY;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = rect.width / 2;
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        setPos({ x: dx, y: dy });
        onChange({ x: dx / maxDist, y: dy / maxDist });
    };

    const handlePointerUp = () => {
        setDragging(false);
        setPos({ x: 0, y: 0 });
        onChange({ x: 0, y: 0 });
    };

    return (
        <div 
            ref={containerRef}
            className="w-32 h-32 rounded-full border-4 border-white/20 bg-white/5 flex items-center justify-center relative touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <motion.div 
                className="w-12 h-12 rounded-full bg-white shadow-xl pointer-events-none"
                animate={{ x: pos.x, y: pos.y }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            />
        </div>
    );
};

// --- APP COMPONENT ---

const App = () => {
    const [isReady, setIsReady] = useState(false);
    const gameScreenRef = useRef<GameScreen | null>(null);
    const [nearTank, setNearTank] = useState(false);
    const [inTank, setInTank] = useState(false);

    useEffect(() => {
        const init = async () => {
            // Give a moment for the DOM to settle
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Initialization is handled by singleton imports, 
            // but we need to wait for Jolt and WebGPU.
            // gfx3Manager initializes itself on import, but we need to make sure the loop starts.
            
            const screen = new GameScreen();
            gameScreenRef.current = screen;
            screenManager.requestSetScreen(screen);
            
            await screen.onEnter();
            
            em.startup(false);
            setIsReady(true);
        };

        init();

        const interval = setInterval(() => {
            const screen = gameScreenRef.current;
            if (screen) {
                const tankPos = screen.tank.body.getPosition();
                const playerPos = screen.player.position;
                const dist = UT.VEC3_DISTANCE(tankPos, playerPos);
                setNearTank(!screen.isPlayerInTank && dist < 6.0);
                setInTank(screen.isPlayerInTank);
            }
        }, 100);

        return () => {
            clearInterval(interval);
            em.pause();
        };
    }, []);

    const handleJoystickChange = (dir: { x: number, y: number }) => {
        if (gameScreenRef.current) {
            gameScreenRef.current.moveDir = dir;
        }
    };

    const handleFireDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        if (gameScreenRef.current) gameScreenRef.current.virtualFire = true;
    };

    const handleFireUp = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        if (gameScreenRef.current) gameScreenRef.current.virtualFire = false;
    };

    const handleInteract = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        if (gameScreenRef.current) gameScreenRef.current.virtualInteract = true;
    };

    return (
        <div className="fixed inset-0 w-full h-full pointer-events-none flex flex-col justify-end p-8 overflow-hidden font-sans">
            <AnimatePresence>
                {!isReady && (
                    <motion.div 
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 pointer-events-auto"
                    >
                        <div className="text-white text-2xl font-bebas tracking-widest animate-pulse">
                            INITIALIZING ARCADEGPU...
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute top-8 left-8 pointer-events-auto">
                <h1 className="text-4xl font-bebas text-white drop-shadow-lg tracking-wider">TANK COMMAND</h1>
                <div className="bg-black/20 backdrop-blur-sm p-3 rounded-lg border border-white/5 mt-2">
                    <p className="text-white/80 text-xs font-bold uppercase tracking-tighter mb-1">Controls</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">WASD + SHIFT • WALK / RUN</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">MOUSE • LOOK AROUND</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">SPACE • JUMP / FIRE</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">LEFT CLICK • FIRE</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">E • ENTER / EXIT TANK</p>
                </div>
            </div>
            
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center mix-blend-difference z-10">
               <div className="w-4 h-[2px] bg-white/80 absolute"></div>
               <div className="w-[2px] h-4 bg-white/80 absolute"></div>
               <div className="w-[4px] h-[4px] bg-red-400 absolute rounded-full"></div>
            </div>

            {nearTank && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-16 pointer-events-none">
                    <div className="bg-black/50 text-white font-mono px-4 py-2 rounded-lg border border-white/20 backdrop-blur">
                        Press <span className="text-yellow-400 font-bold">E</span> to enter tank
                    </div>
                </div>
            )}
            
            {inTank && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-16 pointer-events-none">
                    <div className="bg-black/50 text-white font-mono px-4 py-2 rounded-lg border border-white/20 backdrop-blur">
                        Press <span className="text-yellow-400 font-bold">E</span> to exit tank
                    </div>
                </div>
            )}

            <div className="pointer-events-auto flex justify-between items-end w-full pb-8">
                <Joystick onChange={handleJoystickChange} />
                
                <div className="flex flex-col items-end gap-2">
                    {nearTank && !inTank && (
                        <button 
                            onPointerDown={handleInteract}
                            className="w-16 h-16 rounded-full bg-blue-500 shadow-lg border-b-4 border-blue-700 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center text-white font-bold mb-2">
                            ENTER
                        </button>
                    )}
                    {inTank && (
                        <button 
                            onPointerDown={handleInteract}
                            className="w-16 h-16 rounded-full bg-yellow-500 shadow-lg border-b-4 border-yellow-700 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center text-white font-bold mb-2">
                            EXIT
                        </button>
                    )}
                    <button 
                        onPointerDown={handleFireDown}
                        onPointerUp={handleFireUp}
                        onPointerLeave={handleFireUp}
                        onContextMenu={(e) => e.preventDefault()}
                        className="w-20 h-20 rounded-full bg-red-500 shadow-lg border-b-4 border-red-700 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center text-white font-bold text-xl">
                        FIRE
                    </button>
                    <div className="text-white/40 text-xs font-mono uppercase mt-4">Version 0.2.1-Alpha</div>
                </div>
            </div>

            <style>{`
                canvas {
                    image-rendering: auto;
                }
            `}</style>
        </div>
    );
};

export default App;
