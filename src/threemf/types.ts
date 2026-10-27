export type ColorSource =
  | 'material'
  | 'object-material'
  | 'colorgroup'
  | 'vendor-paint'
  | 'vendor-extruder'
  | 'none';

export type Vendor = 'bambu' | 'orca' | 'prusa' | 'none';

export interface ImportWarning {
  code: string;
  message: string;
}

/** Uma cor/material com a geometria (indexada, em mm, coordenadas do mundo). */
export interface ImportedPart {
  id: string;
  name: string;
  /** #RRGGBB */
  color: string;
  source: ColorSource;
  /** Texto legível de onde a cor veio (para a interface). */
  sourceLabel: string;
  positions: Float32Array;
  indices: Uint32Array;
}

export interface ImportInfo {
  producer: string | null;
  vendor: Vendor;
  /** true quando alguma cor veio de metadados de fabricante (leitura experimental). */
  vendorColorsUsed: boolean;
  originalUnit: string;
  scaleToMm: number;
  modelFiles: number;
  objectCount: number;
  instanceCount: number;
  triangleCount: number;
  warnings: ImportWarning[];
}

export interface ImportResult {
  parts: ImportedPart[];
  info: ImportInfo;
}

export class ImportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
