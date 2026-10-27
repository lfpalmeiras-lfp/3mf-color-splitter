import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Prepara os arrays de exibição: normais com vinco de 30° (arestas vivas ficam
 * nítidas, superfícies curvas ficam suaves). Resultado não indexado.
 */
export function buildDisplayArrays(
  positions: Float32Array,
  indices: Uint32Array,
): { positions: Float32Array; normals: Float32Array } {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  const out = toCreasedNormals(g, Math.PI / 6);
  const result = {
    positions: out.getAttribute('position').array as Float32Array,
    normals: out.getAttribute('normal').array as Float32Array,
  };
  g.dispose();
  return result;
}
