import type { Projection, ViewName } from '../types/model';

interface Props {
  projection: Projection;
  onProjection: (p: Projection) => void;
  onView: (v: ViewName) => void;
  onFrame: () => void;
}

const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'front', label: 'Frontal' },
  { id: 'back', label: 'Traseira' },
  { id: 'left', label: 'Esquerda' },
  { id: 'right', label: 'Direita' },
  { id: 'top', label: 'Superior' },
  { id: 'bottom', label: 'Inferior' },
  { id: 'iso', label: 'Isométrica' },
];

export default function ViewerToolbar({ projection, onProjection, onView, onFrame }: Props) {
  return (
    <div className="viewer-toolbar" role="toolbar" aria-label="Controles de vista">
      {VIEWS.map((v) => (
        <button key={v.id} onClick={() => onView(v.id)}>
          {v.label}
        </button>
      ))}
      <span className="sep" />
      <button onClick={onFrame}>Centralizar</button>
      <span className="sep" />
      <button
        className={projection === 'perspective' ? 'active' : ''}
        onClick={() => onProjection('perspective')}
      >
        Perspectiva
      </button>
      <button
        className={projection === 'orthographic' ? 'active' : ''}
        onClick={() => onProjection('orthographic')}
      >
        Ortográfica
      </button>
    </div>
  );
}
