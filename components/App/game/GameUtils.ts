import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Gfx3MeshEffect } from '@lib/gfx3/gfx3_drawable';
import { UT } from '@lib/core/utils';

export function createBoxMesh(width: number, height: number, depth: number, color: [number, number, number]): Gfx3Mesh {
  const mesh = new Gfx3Mesh();
  mesh.setTag(0, 0, Gfx3MeshEffect.PIXELATION); 

  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  
  const coords = [
    -w, -h,  d,  w, -h,  d,  w,  h,  d,  -w, -h,  d,  w,  h,  d, -w,  h,  d,
     w, -h, -d, -w, -h, -d, -w,  h, -d,   w, -h, -d, -w,  h, -d,  w,  h, -d,
    -w,  h,  d,  w,  h,  d,  w,  h, -d,  -w,  h,  d,  w,  h, -d, -w,  h, -d,
    -w, -h, -d,  w, -h, -d,  w, -h,  d,  -w, -h, -d,  w, -h,  d, -w, -h,  d,
     w, -h,  d,  w, -h, -d,  w,  h, -d,   w, -h,  d,  w,  h, -d,  w,  h,  d,
    -w, -h, -d, -w, -h,  d, -w,  h,  d,  -w, -h, -d, -w,  h,  d, -w,  h, -d
  ];

  const colors = [];
  const normals = [];
  for (let i = 0; i < coords.length; i += 18) {
    const v0: vec3 = [coords[i], coords[i+1], coords[i+2]];
    const v1: vec3 = [coords[i+3], coords[i+4], coords[i+5]];
    const v2: vec3 = [coords[i+6], coords[i+7], coords[i+8]];
    const e1 = UT.VEC3_SUBSTRACT(v1, v0);
    const e2 = UT.VEC3_SUBSTRACT(v2, v0);
    const normal = UT.VEC3_NORMALIZE(UT.VEC3_CROSS(e1, e2));
    for (let j = 0; j < 6; j++) {
      colors.push(color[0], color[1], color[2]);
      normals.push(normal[0], normal[1], normal[2]);
    }
  }

  mesh.geo = Gfx3Mesh.buildVertices(coords.length / 3, coords, [], colors, normals);
  mesh.beginVertices(coords.length / 3);
  mesh.setVertices(mesh.geo.vertices);
  mesh.endVertices();

  return mesh;
}
