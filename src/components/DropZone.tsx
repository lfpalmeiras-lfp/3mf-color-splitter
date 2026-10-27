import { useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  onLoadTestModel: () => void;
  notice: { kind: 'ok' | 'error'; text: string } | null;
  /** Input de arquivo compartilhado com o menu superior. */
  inputRef: React.RefObject<HTMLInputElement>;
}

export default function DropZone({ onFile, onLoadTestModel, notice, inputRef }: Props) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  return (
    <div className="dropzone-overlay">
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <h1>Arraste seu arquivo 3MF aqui</h1>
        <p>O arquivo é processado no seu navegador e não é enviado a nenhum servidor.</p>
        <div className="dropzone-actions">
          <button className="primary" onClick={() => inputRef.current?.click()}>
            Selecionar arquivo
          </button>
          <button onClick={onLoadTestModel}>Carregar modelo de teste</button>
        </div>
        {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}
      </div>
    </div>
  );
}
