export interface ValidationResult {
  ok: boolean;
  message: string;
}

/**
 * Validação de Etapa 1: extensão .3mf + assinatura ZIP ("PK\x03\x04").
 * Um 3MF é um pacote ZIP (OPC). A validação do conteúdo
 * (3D/3dmodel.model) será feita na Etapa 2, junto com a leitura real.
 */
export async function validate3mfFile(file: File): Promise<ValidationResult> {
  if (!file.name.toLowerCase().endsWith('.3mf')) {
    return { ok: false, message: 'O arquivo precisa ter a extensão .3mf.' };
  }
  if (file.size < 4) {
    return { ok: false, message: 'O arquivo está vazio ou corrompido.' };
  }
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (!isZip) {
    return {
      ok: false,
      message: 'Este arquivo não é um pacote 3MF válido (não é um ZIP).',
    };
  }
  return { ok: true, message: 'Arquivo 3MF reconhecido (pacote ZIP válido).' };
}
