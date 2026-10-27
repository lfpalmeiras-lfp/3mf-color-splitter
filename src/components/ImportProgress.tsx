interface Props {
  stage: string;
  percent: number;
  onCancel: () => void;
}

export default function ImportProgress({ stage, percent, onCancel }: Props) {
  return (
    <div className="progress-overlay" role="status" aria-live="polite">
      <div className="progress-card">
        <div className="progress-stage">{stage}</div>
        <div className="bar" aria-hidden="true">
          <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
        <div className="progress-foot">
          <span>{Math.round(percent)}%</span>
          <button onClick={onCancel}>Cancelar processamento</button>
        </div>
      </div>
    </div>
  );
}
