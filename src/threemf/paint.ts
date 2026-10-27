/**
 * Decodificação do atributo de pintura por triângulo usado por
 * Bambu Studio / OrcaSlicer (`paint_color`) e PrusaSlicer
 * (`slic3rpe:mmu_segmentation`).
 *
 * O valor é uma sequência de "nibbles" hexadecimais lida DO FIM PARA O INÍCIO.
 * No primeiro nibble:
 *   - bits 0-1: número de lados divididos (0 = triângulo inteiro, sem subdivisão);
 *   - bits 2-3: estado (0 = sem pintura; 1, 2 = filamento 1, 2;
 *               3 = estado estendido: o nibble seguinte soma 3 ao estado).
 * Exemplos: "4" → filamento 1, "8" → filamento 2, "0C" → filamento 3, "1C" → filamento 4.
 *
 * Só o caso de triângulo inteiro (sem subdivisão) é interpretado. Triângulos com
 * pintura subdividida (pincel parcial) retornam kind "split" e NÃO são decodificados.
 *
 * ATENÇÃO: esta regra segue a estrutura conhecida do formato, mas ainda não foi
 * validada contra arquivos reais gerados pelos slicers.
 */
export type PaintDecode =
  | { kind: 'state'; state: number }
  | { kind: 'split' }
  | { kind: 'invalid' };

export function decodePaintColor(value: string): PaintDecode {
  const s = value.trim();
  if (!s) return { kind: 'invalid' };
  const nib = (i: number): number => parseInt(s[s.length - 1 - i] ?? '', 16);
  const n0 = nib(0);
  if (Number.isNaN(n0)) return { kind: 'invalid' };
  if ((n0 & 3) !== 0) return { kind: 'split' };
  let state = n0 >> 2;
  let used = 1;
  if (state === 3) {
    const n1 = nib(1);
    if (Number.isNaN(n1)) return { kind: 'invalid' };
    state = 3 + n1;
    used = 2;
  }
  if (used !== s.length) return { kind: 'split' };
  return { kind: 'state', state };
}
