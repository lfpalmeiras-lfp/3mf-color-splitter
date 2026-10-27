import type { ImportInfo } from '../threemf/types';
import { UNIT_LABEL_PT } from '../threemf/units';
import { formatNumber } from '../utils/format';

interface Props {
  info: ImportInfo | null;
  fileName: string | null;
}

const VENDOR_LABEL = { bambu: 'Bambu Studio', orca: 'OrcaSlicer', prusa: 'PrusaSlicer', none: 'não identificado' };

export default function BottomPanel({ info, fileName }: Props) {
  return (
    <footer className="bottom-panel">
      <section>
        <h2>Importação</h2>
        {!info ? (
          <p>Nenhum arquivo 3MF importado.</p>
        ) : (
          <>
            <dl className="info-grid">
              <dt>Arquivo</dt>
              <dd>{fileName}</dd>
              <dt>Gerado por</dt>
              <dd>
                {info.producer ?? '—'} ({VENDOR_LABEL[info.vendor]})
              </dd>
              <dt>Unidade original</dt>
              <dd>
                {UNIT_LABEL_PT[info.originalUnit] ?? info.originalUnit}
                {info.scaleToMm === 1 ? ' (sem conversão)' : ` (convertida para mm: ×${formatNumber(info.scaleToMm)})`}
              </dd>
              <dt>Conteúdo</dt>
              <dd>
                {formatNumber(info.objectCount)} malhas, {formatNumber(info.instanceCount)} instâncias,{' '}
                {formatNumber(info.triangleCount)} triângulos, {info.modelFiles} arquivo(s) de modelo
              </dd>
            </dl>
            {info.vendorColorsUsed && (
              <p className="warn-line">
                Cores lidas de metadados do fabricante: interpretação experimental, ainda não validada com
                arquivos reais. Confira as cores no visualizador.
              </p>
            )}
            {info.warnings.length > 0 && (
              <ul className="warn-list">
                {info.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      <section>
        <h2>Encaixes e configurações</h2>
        <p>Geração de encaixes, tolerância e análise de impressão: em desenvolvimento (Etapas 6 a 9).</p>
      </section>
    </footer>
  );
}
