import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { createBoxMesh } from './GameUtils';

export class Explosion {
    particles: { pos: vec3, vel: vec3, life: number, maxLife: number }[] = [];
    static particleMesh: Gfx3Mesh | null = null;
    static qMat = new Quaternion();

    constructor(x: number, y: number, z: number, color: [number, number, number] = [1.0, 0.4, 0.0]) {
        if (!Explosion.particleMesh) {
            Explosion.particleMesh = createBoxMesh(0.5, 0.5, 0.5, [1.0, 1.0, 1.0]); // White box, we will rely on materials if we wanted color, or just keep it orange
            // Actually, we can just make it orange for all
            Explosion.particleMesh = createBoxMesh(0.5, 0.5, 0.5, [1.0, 0.4, 0.0]);
        }

        for (let i = 0; i < 20; i++) {
            const pos: vec3 = [x, y, z];
            
            const speed = 5 + Math.random() * 15;
            const dirX = (Math.random() - 0.5) * 2;
            const dirY = Math.random(); // mostly up
            const dirZ = (Math.random() - 0.5) * 2;
            
            const vel: vec3 = UT.VEC3_SCALE(UT.VEC3_NORMALIZE([dirX, dirY, dirZ]), speed);
            const life = 0.5 + Math.random() * 0.5;
            
            this.particles.push({ pos, vel, life, maxLife: life });
        }
    }

    update(ts: number): boolean {
        // Return false when fully dead
        let aliveCount = 0;
        for (const p of this.particles) {
            p.life -= ts / 1000;
            if (p.life > 0) {
                aliveCount++;
                
                // physics
                p.vel[1] -= 20 * (ts / 1000); // gravity
                
                p.pos[0] += p.vel[0] * (ts / 1000);
                p.pos[1] += p.vel[1] * (ts / 1000);
                p.pos[2] += p.vel[2] * (ts / 1000);
            }
        }
        return aliveCount > 0;
    }

    draw() {
        if (!Explosion.particleMesh) return;
        for (const p of this.particles) {
            if (p.life > 0) {
                const scale = Math.max(0, p.life / p.maxLife);
                const ZERO: vec3 = [0,0,0];
                const mat = UT.MAT4_TRANSFORM(p.pos, ZERO, [scale, scale, scale], Explosion.qMat);
                gfx3MeshRenderer.drawMesh(Explosion.particleMesh, mat);
            }
        }
    }
}
