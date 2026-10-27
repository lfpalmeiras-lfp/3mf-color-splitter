import type { ModelPart } from '../types/model';
import { formatNumber, triangleCount } from '../utils/format';

interface Props {
  parts: ModelPart[];
  hiddenIds: Set<string>;
  onToggle: (id: string) => void;
}

export default function PartsPanel({ parts, hiddenIds, onToggle }: Props) {
  return (
    <aside className="parts-panel">
      <h2>Cores e partes</h2>
      {parts.length === 0 ? (
        <p className="empty">Nenhum modelo carregado. Importe um arquivo 3MF para ver as cores.</p>
      ) : (
        <ul>
          {parts.map((p) => {
            const hidden = hiddenIds.has(p.id);
            return (
              <li key={p.id} className={hidden ? 'hidden-part' : ''}>
                <span className="swatch" style={{ background: p.color }} />
                <div className="part-info">
                  <strong>{p.name}</strong>
                  <span>
                    {p.color} · {formatNumber(triangleCount(p.geometry))} triângulos
                  </span>
                  {p.source && <span className="part-source">{p.source}</span>}
                </div>
                <button
                  className="icon-btn"
                  onClick={() => onToggle(p.id)}
                  aria-pressed={!hidden}
                  title={hidden ? 'Mostrar parte' : 'Ocultar parte'}
                >
                  {hidden ? 'Mostrar' : 'Ocultar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="soon">
        Volume, componentes conectados e agrupamento de cores: em desenvolvimento (Etapa 3).
      </p>
    </aside>
  );
}
