import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModelPart } from '../types/model';

/** Converte para não indexada, mantendo só os atributos comuns, para poder mesclar. */
function prep(g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  const out = g.toNonIndexed();
  out.deleteAttribute('uv');
  out.translate(x, y, z);
  return out;
}

/**
 * Modelo de teste (boneco simples, em mm, Z para cima).
 * Existe apenas para exercitar o visualizador enquanto a leitura de 3MF
 * (Etapa 2) não está pronta. Não representa um arquivo real do usuário.
 */
export function createTestModel(): ModelPart[] {
  const body = new THREE.CapsuleGeometry(15, 30, 8, 32);
  body.rotateX(Math.PI / 2); // eixo da cápsula passa a ser Z

  const eyes = mergeGeometries([
    prep(new THREE.SphereGeometry(4.5, 24, 16), -6, -12, 48),
    prep(new THREE.SphereGeometry(4.5, 24, 16), 6, -12, 48),
  ])!;
  const pupils = mergeGeometries([
    prep(new THREE.SphereGeometry(2, 16, 12), -6, -15.5, 48),
    prep(new THREE.SphereGeometry(2, 16, 12), 6, -15.5, 48),
  ])!;
  const shoes = mergeGeometries([
    prep(new THREE.BoxGeometry(12, 20, 8), -8, -2, 4),
    prep(new THREE.BoxGeometry(12, 20, 8), 8, -2, 4),
  ])!;

  body.translate(0, 0, 40);

  return [
    { id: 'body', name: 'Corpo', color: '#d9342b', geometry: body },
    { id: 'eyes', name: 'Olhos', color: '#f4f4f0', geometry: eyes },
    { id: 'pupils', name: 'Pupilas', color: '#15161a', geometry: pupils },
    { id: 'shoes', name: 'Sapatos', color: '#2c6bd6', geometry: shoes },
  ];
}
