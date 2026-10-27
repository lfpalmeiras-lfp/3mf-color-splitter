import { useEffect, useRef } from 'react';
import { SceneController } from './SceneController';
import type { Dimensions, ModelPart, Projection, ViewRequest } from '../types/model';

interface Props {
  parts: ModelPart[];
  hiddenIds: Set<string>;
  projection: Projection;
  viewRequest: ViewRequest;
  frameNonce: number;
  onDimensions: (d: Dimensions | null) => void;
}

/** Ponte entre o estado React e o SceneController (Three.js). */
export default function Viewer({
  parts,
  hiddenIds,
  projection,
  viewRequest,
  frameNonce,
  onDimensions,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<SceneController | null>(null);
  const dimsCb = useRef(onDimensions);
  dimsCb.current = onDimensions;

  useEffect(() => {
    const ctrl = new SceneController(containerRef.current!);
    ctrl.onDimensions = (d) => dimsCb.current(d);
    ctrlRef.current = ctrl;
    return () => {
      ctrl.dispose();
      ctrlRef.current = null;
    };
  }, []);

  // Troca de modelo. A visibilidade é reaplicada logo em seguida.
  useEffect(() => {
    ctrlRef.current?.setModel(parts);
  }, [parts]);

  useEffect(() => {
    const c = ctrlRef.current;
    if (!c) return;
    for (const p of parts) c.setPartVisible(p.id, !hiddenIds.has(p.id));
  }, [hiddenIds, parts]);

  useEffect(() => {
    ctrlRef.current?.setProjection(projection);
  }, [projection]);

  useEffect(() => {
    ctrlRef.current?.setView(viewRequest.view);
  }, [viewRequest]);

  useEffect(() => {
    if (frameNonce > 0) ctrlRef.current?.frame();
  }, [frameNonce]);

  return <div ref={containerRef} className="viewer-canvas" />;
}
