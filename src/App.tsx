import { useCallback, useRef, useState } from 'react';
import TopBar from './components/TopBar';
import DropZone from './components/DropZone';
import PartsPanel from './components/PartsPanel';
import BottomPanel from './components/BottomPanel';
import ViewerToolbar from './components/ViewerToolbar';
import Viewer from './viewer/Viewer';
import { validate3mfFile } from './utils/fileValidation';
import { createTestModel } from './utils/testModel';
import { formatBytes, formatMm } from './utils/format';
import type {
  Dimensions,
  LoadedFileInfo,
  ModelPart,
  Projection,
  ViewName,
  ViewRequest,
} from './types/model';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export default function App() {
  const [parts, setParts] = useState<ModelPart[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [dims, setDims] = useState<Dimensions | null>(null);
  const [projection, setProjection] = useState<Projection>('perspective');
  const [viewRequest, setViewRequest] = useState<ViewRequest>({ view: 'iso', nonce: 0 });
  const [frameNonce, setFrameNonce] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [fileInfo, setFileInfo] = useState<LoadedFileInfo | null>(null);
  const [isTestModel, setIsTestModel] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const result = await validate3mfFile(file);
    if (!result.ok) {
      setNotice({ kind: 'error', text: result.message });
      return;
    }
    setFileInfo({ name: file.name, sizeBytes: file.size });
    setNotice({
      kind: 'ok',
      text: `${result.message} A leitura da geometria e das cores ainda está em desenvolvimento (Etapa 2).`,
    });
  }, []);

  const loadTest = useCallback(() => {
    setParts(createTestModel());
    setHiddenIds(new Set());
    setFileInfo(null);
    setNotice(null);
    setIsTestModel(true);
  }, []);

  const closeModel = useCallback(() => {
    setParts([]);
    setHiddenIds(new Set());
    setDims(null);
    setIsTestModel(false);
  }, []);

  const toggle = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const requestView = useCallback((view: ViewName) => {
    setViewRequest((r) => ({ view, nonce: r.nonce + 1 }));
  }, []);

  const hasModel = parts.length > 0;

  return (
    <div className="app">
      <input
        ref={inputRef}
        type="file"
        accept=".3mf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      <TopBar onOpenFile={() => inputRef.current?.click()} />
      <PartsPanel parts={parts} hiddenIds={hiddenIds} onToggle={toggle} />

      <main className="viewer">
        <Viewer
          parts={parts}
          hiddenIds={hiddenIds}
          projection={projection}
          viewRequest={viewRequest}
          frameNonce={frameNonce}
          onDimensions={setDims}
        />
        <ViewerToolbar
          projection={projection}
          onProjection={setProjection}
          onView={requestView}
          onFrame={() => setFrameNonce((n) => n + 1)}
        />
        {hasModel && dims && (
          <div className="dims">
            <div className="dims-title">
              {isTestModel ? 'Modelo de teste' : fileInfo?.name}
            </div>
            <div>X {formatMm(dims.x)}</div>
            <div>Y {formatMm(dims.y)}</div>
            <div>Z {formatMm(dims.z)}</div>
            {hasModel && (
              <button className="link" onClick={closeModel}>
                Fechar modelo
              </button>
            )}
          </div>
        )}
        {!hasModel && (
          <DropZone
            onFile={(f) => void handleFile(f)}
            onLoadTestModel={loadTest}
            notice={
              notice && fileInfo
                ? { ...notice, text: `${fileInfo.name} (${formatBytes(fileInfo.sizeBytes)}): ${notice.text}` }
                : notice
            }
            inputRef={inputRef}
          />
        )}
      </main>

      <BottomPanel />
    </div>
  );
}
