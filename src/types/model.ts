import type * as THREE from 'three';

/** Vistas ortogonais e isométrica. Sistema Z para cima, como nos slicers. */
export type ViewName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso';

export type Projection = 'perspective' | 'orthographic';

/** Uma parte renderizável: uma cor/material e sua geometria (em mm). */
export interface ModelPart {
  id: string;
  name: string;
  /** Cor em hexadecimal, formato #rrggbb. */
  color: string;
  geometry: THREE.BufferGeometry;
}

/** Dimensões do modelo em milímetros. */
export interface Dimensions {
  x: number;
  y: number;
  z: number;
}

/** Pedido de mudança de vista; `nonce` permite repetir a mesma vista. */
export interface ViewRequest {
  view: ViewName;
  nonce: number;
}

export interface LoadedFileInfo {
  name: string;
  sizeBytes: number;
}
