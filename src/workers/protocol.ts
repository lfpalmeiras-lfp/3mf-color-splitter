import type { ColorSource, ImportInfo } from '../threemf/types';

export interface WorkerPart {
  id: string;
  name: string;
  color: string;
  source: ColorSource;
  sourceLabel: string;
  positions: Float32Array;
  normals: Float32Array;
}

export type WorkerIn = { type: 'import'; buffer: ArrayBuffer };

export type WorkerOut =
  | { type: 'progress'; stage: string; percent: number }
  | { type: 'done'; parts: WorkerPart[]; info: ImportInfo }
  | { type: 'error'; code: string; message: string };
