import * as THREE from 'three';
import type { ModelPart } from '../types/model';
import type { ImportInfo } from '../threemf/types';
import type { WorkerIn, WorkerOut } from '../workers/protocol';

export interface ImportProgress {
  stage: string;
  percent: number;
}

export interface ImportedModel {
  parts: ModelPart[];
  info: ImportInfo;
}

export class ImportFailure extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ImportHandle {
  promise: Promise<ImportedModel>;
  /** Interrompe o processamento (encerra o worker). */
  cancel: () => void;
}

/** Executa a importação em um Web Worker, sem travar a interface. */
export function startImport(file: File, onProgress: (p: ImportProgress) => void): ImportHandle {
  const worker = new Worker(new URL('../workers/import3mf.worker.ts', import.meta.url), { type: 'module' });
  let rejectFn: (e: Error) => void = () => {};

  const promise = new Promise<ImportedModel>((resolve, reject) => {
    rejectFn = reject;
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === 'progress') {
        onProgress({ stage: m.stage, percent: m.percent });
      } else if (m.type === 'done') {
        worker.terminate();
        const parts: ModelPart[] = m.parts.map((p) => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
          geometry.setAttribute('normal', new THREE.BufferAttribute(p.normals, 3));
          return { id: p.id, name: p.name, color: p.color, geometry, source: p.sourceLabel };
        });
        resolve({ parts, info: m.info });
      } else {
        worker.terminate();
        reject(new ImportFailure(m.code, m.message));
      }
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new ImportFailure('worker', `Erro no processamento: ${ev.message || 'falha desconhecida'}`));
    };
    onProgress({ stage: 'Lendo 3MF...', percent: 0 });
    file
      .arrayBuffer()
      .then((buffer) => {
        const msg: WorkerIn = { type: 'import', buffer };
        worker.postMessage(msg, [buffer]);
      })
      .catch(() => {
        worker.terminate();
        reject(new ImportFailure('read', 'Não foi possível ler o arquivo selecionado.'));
      });
  });

  return {
    promise,
    cancel: () => {
      worker.terminate();
      rejectFn(new ImportFailure('cancelled', 'Importação cancelada.'));
    },
  };
}
