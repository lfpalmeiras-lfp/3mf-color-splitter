/// <reference lib="webworker" />
import { importThreeMF } from '../threemf/importThreeMF';
import { buildDisplayArrays } from '../threemf/displayGeometry';
import { ImportError } from '../threemf/types';
import type { WorkerIn, WorkerOut, WorkerPart } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerOut, transfer: Transferable[] = []) => ctx.postMessage(m, transfer);

ctx.onmessage = (e: MessageEvent<WorkerIn>) => {
  if (e.data.type !== 'import') return;
  try {
    const result = importThreeMF(new Uint8Array(e.data.buffer), (stage, percent) =>
      post({ type: 'progress', stage, percent }),
    );
    const parts: WorkerPart[] = [];
    const transfer: Transferable[] = [];
    result.parts.forEach((p, i) => {
      post({
        type: 'progress',
        stage: 'Calculando normais...',
        percent: 95 + Math.round((i / result.parts.length) * 5),
      });
      const d = buildDisplayArrays(p.positions, p.indices);
      parts.push({
        id: p.id,
        name: p.name,
        color: p.color,
        source: p.source,
        sourceLabel: p.sourceLabel,
        positions: d.positions,
        normals: d.normals,
      });
      transfer.push(d.positions.buffer, d.normals.buffer);
    });
    post({ type: 'done', parts, info: result.info }, transfer);
  } catch (err) {
    if (err instanceof ImportError) post({ type: 'error', code: err.code, message: err.message });
    else
      post({
        type: 'error',
        code: 'unexpected',
        message: `Falha inesperada ao ler o arquivo: ${err instanceof Error ? err.message : String(err)}`,
      });
  }
};
