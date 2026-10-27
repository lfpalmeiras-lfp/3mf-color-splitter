import type * as THREE from 'three';

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return nf.format(n);
}

export function formatMm(n: number): string {
  return `${nf.format(n)} mm`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${nf.format(bytes / 1024)} KB`;
  return `${nf.format(bytes / (1024 * 1024))} MB`;
}

export function triangleCount(geometry: THREE.BufferGeometry): number {
  if (geometry.index) return geometry.index.count / 3;
  return (geometry.getAttribute('position')?.count ?? 0) / 3;
}
