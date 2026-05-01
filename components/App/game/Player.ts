import { gfx3JoltManager, JOLT_LAYER_MOVING, Gfx3Jolt } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Gfx3MeshJSM } from '@lib/gfx3_mesh/gfx3_mesh_jsm';
import { Quaternion } from '@lib/core/quaternion';
import { createBoxMesh } from './GameUtils';

/**
 * The Player class represents the on-foot character.
 * It uses a Capsule physics body and manages an articulated mesh system.
 */
export class Player {
  head: Gfx3Mesh;
  eyeL: Gfx3Mesh;
  eyeR: Gfx3Mesh;
  torso: Gfx3Mesh;
  backpack: Gfx3Mesh;
  armL: Gfx3Mesh;
  armR: Gfx3Mesh;
  legL: Gfx3Mesh;
  legR: Gfx3Mesh;
  
  physicsBody: any;
  position: any = [0, 5, 0];
  rotation: number = 0;

  walkTimer: number = 0;
  jumpCooldown: number = 0;

  constructor() {
    const skinColor: [number, number, number] = [0.9, 0.7, 0.6];
    const shirtColor: [number, number, number] = [0.2, 0.4, 0.8];
    const pantsColor: [number, number, number] = [0.1, 0.2, 0.4];
    const eyeColor: [number, number, number] = [0.1, 0.1, 0.1];
    const packColor: [number, number, number] = [0.4, 0.3, 0.2];

    // Initial placeholders
    this.head = createBoxMesh(0.5, 0.5, 0.5, skinColor);
    this.eyeL = createBoxMesh(0.1, 0.1, 0.1, eyeColor);
    this.eyeR = createBoxMesh(0.1, 0.1, 0.1, eyeColor);
    this.torso = createBoxMesh(0.7, 0.8, 0.4, shirtColor);
    this.backpack = createBoxMesh(0.5, 0.6, 0.3, packColor);
    this.armL = createBoxMesh(0.2, 0.7, 0.2, skinColor);
    this.armR = createBoxMesh(0.2, 0.7, 0.2, skinColor);
    this.legL = createBoxMesh(0.25, 0.8, 0.25, pantsColor);
    this.legR = createBoxMesh(0.25, 0.8, 0.25, pantsColor);

    this.physicsBody = gfx3JoltManager.addCapsule({
      radius: 0.4, height: 1.0,
      x: 0, y: 5, z: 2,
      motionType: Gfx3Jolt.EMotionType_Dynamic,
      layer: JOLT_LAYER_MOVING,
      settings: { mAngularDamping: 1.0, mLinearDamping: 0.9, mFriction: 0.0, mAllowedDOFs: 7 }
    });
  }

  /**
   * Loads high-fidelity JSM models for the character.
   */
  async load() {
    const headJSM = new Gfx3MeshJSM();
    const torsoJSM = new Gfx3MeshJSM();

    try {
      await Promise.all([
        headJSM.loadFromFile('/models/player_head.jsm'),
        torsoJSM.loadFromFile('/models/player_torso.jsm')
      ]);

      this.head = headJSM;
      this.torso = torsoJSM;
    } catch (e) {
      console.warn('Failed to load character JSM models, falling back to boxes.', e);
    }
  }

  jump() {
    if (this.jumpCooldown <= 0) {
      const curVel = this.physicsBody.body.GetLinearVelocity();
      if (curVel.GetY() < 0.2 && curVel.GetY() > -0.2) { 
        gfx3JoltManager.bodyInterface.AddImpulse(this.physicsBody.body.GetID(), new Gfx3Jolt.Vec3(0, 45, 0));
        this.jumpCooldown = 0.5;
      }
    }
  }

  update(ts: number, moveDir: { x: number, y: number }, isRunning: boolean = false) {
    const speed = isRunning ? 14 : 8;
    
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= (ts / 1000);
    }
    
    const isMoving = (moveDir.x !== 0 || moveDir.y !== 0);
    if (isMoving) {
      const targetRotation = Math.atan2(moveDir.x, moveDir.y);
      let diff = targetRotation - this.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.rotation += diff * (ts / 1000) * 10;
      this.walkTimer += ts / 1000 * (isRunning ? 15 : 10);
    } else {
      this.walkTimer = 0;
    }
    
    // Set velocity via Jolt
    const linVel = [moveDir.x * speed, 0, moveDir.y * speed];
    const curVel = this.physicsBody.body.GetLinearVelocity();
    const joltLinVel = new Gfx3Jolt.Vec3(linVel[0], curVel.GetY(), linVel[2]);
    gfx3JoltManager.bodyInterface.SetLinearVelocity(this.physicsBody.body.GetID(), joltLinVel);
    gfx3JoltManager.bodyInterface.ActivateBody(this.physicsBody.body.GetID());

    const quat = Quaternion.createFromEuler(this.rotation, 0, 0, 'YXZ');
    
    const pos = this.physicsBody.body.GetPosition();
    this.position = [pos.GetX(), pos.GetY(), pos.GetZ()];

    // Mesh animation logic
    const px = this.position[0];
    const py = this.position[1]; 
    const pz = this.position[2];

    let isJumpingState = Math.abs(curVel.GetY()) > 0.5;

    const swingAmp = isRunning ? 1.0 : 0.6;
    const swing = isJumpingState ? 0 : Math.sin(this.walkTimer) * swingAmp;
    const bobbing = isJumpingState ? 0 : Math.abs(Math.sin(this.walkTimer)) * 0.1;

    const torsoOffset = quat.rotateVector([0, 0.3 + bobbing, 0]);
    this.torso.setPosition(px + torsoOffset[0], py + torsoOffset[1], pz + torsoOffset[2]);
    this.torso.setQuaternion(quat);

    const headOffset = quat.rotateVector([0, 0.95 + bobbing, 0]);
    this.head.setPosition(px + headOffset[0], py + headOffset[1], pz + headOffset[2]);
    this.head.setQuaternion(quat);
    
    const eyeOffsetL = quat.rotateVector([-0.15, 1.0 + bobbing, 0.26]);
    this.eyeL.setPosition(px + eyeOffsetL[0], py + eyeOffsetL[1], pz + eyeOffsetL[2]);
    this.eyeL.setQuaternion(quat);

    const eyeOffsetR = quat.rotateVector([0.15, 1.0 + bobbing, 0.26]);
    this.eyeR.setPosition(px + eyeOffsetR[0], py + eyeOffsetR[1], pz + eyeOffsetR[2]);
    this.eyeR.setQuaternion(quat);

    const packOffset = quat.rotateVector([0, 0.3 + bobbing, -0.35]);
    this.backpack.setPosition(px + packOffset[0], py + packOffset[1], pz + packOffset[2]);
    this.backpack.setQuaternion(quat);
    
    const armBaseAngle = isJumpingState ? Math.PI * 0.8 : 0;
    const armSwingL = armBaseAngle + swing;
    const armSwingR = armBaseAngle - swing;
    
    const armLQ = Quaternion.createFromEuler(this.rotation, armSwingL, 0, 'YXZ');
    const armRQ = Quaternion.createFromEuler(this.rotation, armSwingR, 0, 'YXZ');
    const shoulderBaseL = quat.rotateVector([-0.45, 0.4 + bobbing, 0]);
    const shoulderBaseR = quat.rotateVector([0.45, 0.4 + bobbing, 0]);
    const armCenterOffsetL = armLQ.rotateVector([0, -0.35, 0]);
    const armCenterOffsetR = armRQ.rotateVector([0, -0.35, 0]);
    
    this.armL.setPosition(px + shoulderBaseL[0] + armCenterOffsetL[0], py + shoulderBaseL[1] + armCenterOffsetL[1], pz + shoulderBaseL[2] + armCenterOffsetL[2]);
    this.armL.setQuaternion(armLQ);
    this.armR.setPosition(px + shoulderBaseR[0] + armCenterOffsetR[0], py + shoulderBaseR[1] + armCenterOffsetR[1], pz + shoulderBaseR[2] + armCenterOffsetR[2]);
    this.armR.setQuaternion(armRQ);
    
    const legBaseAngle = isJumpingState ? -0.2 : 0;
    const legSwingL = legBaseAngle - swing;
    const legSwingR = legBaseAngle + swing;
    const legLQ = Quaternion.createFromEuler(this.rotation, legSwingL, 0, 'YXZ');
    const legRQ = Quaternion.createFromEuler(this.rotation, legSwingR, 0, 'YXZ');
    const hipBaseL = quat.rotateVector([-0.15, -0.3 + bobbing, 0]);
    const hipBaseR = quat.rotateVector([0.15, -0.3 + bobbing, 0]);
    const legCenterOffsetL = legLQ.rotateVector([0, -0.4, 0]);
    const legCenterOffsetR = legRQ.rotateVector([0, -0.4, 0]);

    this.legL.setPosition(px + hipBaseL[0] + legCenterOffsetL[0], py + hipBaseL[1] + legCenterOffsetL[1], pz + hipBaseL[2] + legCenterOffsetL[2]);
    this.legL.setQuaternion(legLQ);
    this.legR.setPosition(px + hipBaseR[0] + legCenterOffsetR[0], py + hipBaseR[1] + legCenterOffsetR[1], pz + hipBaseR[2] + legCenterOffsetR[2]);
    this.legR.setQuaternion(legRQ);
  }

  draw() {
    this.head.draw();
    this.eyeL.draw();
    this.eyeR.draw();
    this.torso.draw();
    this.backpack.draw();
    this.armL.draw();
    this.armR.draw();
    this.legL.draw();
    this.legR.draw();
  }
}

