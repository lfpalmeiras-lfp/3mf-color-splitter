import { useCallback, useRef, useState } from 'react';
import TopBar from './components/TopBar';
import DropZone from './components/DropZone';
import PartsPanel from './components/PartsPanel';
import BottomPanel from './components/BottomPanel';
import ViewerToolbar from './components/ViewerToolbar';
import ImportProgress from './components/ImportProgress';
import Viewer from './viewer/Viewer';
import { validate3mfFile } from './utils/fileValidation';
import { createTestModel } from './utils/testModel';
import { formatBytes, formatMm, formatNumber } from './utils/format';
import { startImport, type ImportHandle, type ImportProgress as Progress } from './utils/importClient';
import type { ImportInfo } from './threemf/types';
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
  const [importInfo, setImportInfo] = useState<ImportInfo | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isTestModel, setIsTestModel] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<ImportHandle | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (importRef.current) return; // já existe uma importação em andamento
    const result = await validate3mfFile(file);
    if (!result.ok) {
      setNotice({ kind: 'error', text: `${file.name}: ${result.message}` });
      return;
    }
    setNotice(null);
    setProgress({ stage: 'Lendo 3MF...', percent: 0 });
    const handle = startImport(file, setProgress);
    importRef.current = handle;
    try {
      const imported = await handle.promise;
      setParts(imported.parts);
      setHiddenIds(new Set());
      setImportInfo(imported.info);
      setFileInfo({ name: file.name, sizeBytes: file.size });
      setIsTestModel(false);
      const n = imported.info.warnings.length;
      setNotice({
        kind: 'ok',
        text: `${file.name} (${formatBytes(file.size)}): ${formatNumber(imported.parts.length)} cor(es), ${formatNumber(
          imported.info.triangleCount,
        )} triângulos${n > 0 ? `. ${n} aviso(s) no painel inferior.` : '.'}`,
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'cancelled')
        setNotice({ kind: 'error', text: `${file.name}: ${err.message ?? 'Falha ao importar o arquivo.'}` });
      else setNotice({ kind: 'error', text: 'Importação cancelada.' });
    } finally {
      importRef.current = null;
      setProgress(null);
    }
  }, []);

  const loadTest = useCallback(() => {
    setParts(createTestModel());
    setHiddenIds(new Set());
    setFileInfo(null);
    setImportInfo(null);
    setNotice(null);
    setIsTestModel(true);
  }, []);

  const closeModel = useCallback(() => {
    setParts([]);
    setHiddenIds(new Set());
    setDims(null);
    setImportInfo(null);
    setFileInfo(null);
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
            <div className="dims-title">{isTestModel ? 'Modelo de teste' : fileInfo?.name}</div>
            <div>X {formatMm(dims.x)}</div>
            <div>Y {formatMm(dims.y)}</div>
            <div>Z {formatMm(dims.z)}</div>
            <button className="link" onClick={closeModel}>
              Fechar modelo
            </button>
          </div>
        )}
        {!hasModel && (
          <DropZone
            onFile={(f) => void handleFile(f)}
            onLoadTestModel={loadTest}
            notice={notice}
            inputRef={inputRef}
          />
        )}
        {hasModel && notice && (
          <div className={`toast ${notice.kind}`} role="status">
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        )}
        {progress && (
          <ImportProgress
            stage={progress.stage}
            percent={progress.percent}
            onCancel={() => importRef.current?.cancel()}
          />
        )}
      </main>

      <BottomPanel info={importInfo} fileName={isTestModel ? 'Modelo de teste' : (fileInfo?.name ?? null)} />
    </div>
  );
}
