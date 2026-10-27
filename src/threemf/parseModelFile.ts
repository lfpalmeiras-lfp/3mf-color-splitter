import { getAttr, scanXml, type Attrs } from './xml';
import { decodePaintColor } from './paint';
import { alphaOf, normalizeHex } from './vendor';

class Grow<A extends Float64Array | Int32Array> {
  a: A;
  n = 0;
  private ctor: new (len: number) => A;
  constructor(ctor: new (len: number) => A) {
    this.ctor = ctor;
    this.a = new ctor(1024);
  }
  push(v: number): void {
    if (this.n === this.a.length) {
      const b = new this.ctor(this.n * 2);
      (b as Float64Array).set(this.a as Float64Array);
      this.a = b;
    }
    this.a[this.n++] = v;
  }
  done(): A {
    return this.a.slice(0, this.n) as A;
  }
}

export interface MeshData {
  /** x,y,z por vértice, na unidade do arquivo. */
  vertices: Float64Array;
  /** v1,v2,v3 por triângulo. */
  tris: Int32Array;
  /** Por triângulo; -1 quando o atributo não existe. */
  pid: Int32Array;
  p1: Int32Array;
  p2: Int32Array;
  p3: Int32Array;
  /** Pintura de fabricante: -1 ausente, -2 não interpretável (subdividida/inválida), ≥0 estado. */
  paint: Int32Array;
}

export interface ComponentRef {
  objectId: string;
  path: string | null;
  transform: number[] | null;
}

export interface ObjDef {
  id: string;
  type: string;
  name: string;
  pid: number;
  pindex: number;
  mesh: MeshData | null;
  components: ComponentRef[];
}

export interface ColorEntry {
  color: string | null;
  name: string;
  alpha: number;
}

export interface BuildItem {
  objectId: string;
  transform: number[] | null;
  printable: boolean;
}

export interface ParsedModel {
  unit: string;
  producer: string | null;
  objects: Map<string, ObjDef>;
  /** basematerials e colorgroup, por id do grupo. */
  colorGroups: Map<number, { kind: 'material' | 'colorgroup'; entries: ColorEntry[] }>;
  textureGroupIds: Set<number>;
  otherGroupIds: Set<number>;
  buildItems: BuildItem[];
}

const int = (s: string | undefined, d = -1): number => {
  if (s === undefined) return d;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? d : n;
};

export function parseTransform(s: string | undefined): number[] | null {
  if (!s) return null;
  const v = s.trim().split(/\s+/).map(Number);
  return v.length === 12 && v.every(Number.isFinite) ? v : null;
}

export function parseModelFile(xml: string): ParsedModel {
  const model: ParsedModel = {
    unit: 'millimeter',
    producer: null,
    objects: new Map(),
    colorGroups: new Map(),
    textureGroupIds: new Set(),
    otherGroupIds: new Set(),
    buildItems: [],
  };

  let obj: ObjDef | null = null;
  let group: { kind: 'material' | 'colorgroup'; entries: ColorEntry[] } | null = null;
  let vx: Grow<Float64Array> | null = null;
  let tv: Grow<Int32Array> | null = null;
  let tpid: Grow<Int32Array> | null = null;
  let tp1: Grow<Int32Array> | null = null;
  let tp2: Grow<Int32Array> | null = null;
  let tp3: Grow<Int32Array> | null = null;
  let tpaint: Grow<Int32Array> | null = null;

  scanXml(xml, {
    open(name: string, a: Attrs) {
      switch (name) {
        case 'model':
          model.unit = (a.unit ?? 'millimeter').toLowerCase();
          break;
        case 'basematerials':
          group = { kind: 'material', entries: [] };
          model.colorGroups.set(int(a.id), group);
          break;
        case 'base':
          group?.entries.push({
            color: normalizeHex(a.displaycolor),
            name: a.name ?? '',
            alpha: alphaOf(a.displaycolor),
          });
          break;
        case 'colorgroup':
          group = { kind: 'colorgroup', entries: [] };
          model.colorGroups.set(int(a.id), group);
          break;
        case 'color':
          if (group && group.kind === 'colorgroup')
            group.entries.push({ color: normalizeHex(a.color), name: '', alpha: alphaOf(a.color) });
          break;
        case 'texture2dgroup':
          model.textureGroupIds.add(int(a.id));
          break;
        case 'compositematerials':
        case 'multiproperties':
          model.otherGroupIds.add(int(a.id));
          break;
        case 'object':
          obj = {
            id: a.id ?? '',
            type: (a.type ?? 'model').toLowerCase(),
            name: a.name ?? '',
            pid: int(a.pid),
            pindex: int(a.pindex, 0),
            mesh: null,
            components: [],
          };
          model.objects.set(obj.id, obj);
          break;
        case 'mesh':
          vx = new Grow(Float64Array);
          tv = new Grow(Int32Array);
          tpid = new Grow(Int32Array);
          tp1 = new Grow(Int32Array);
          tp2 = new Grow(Int32Array);
          tp3 = new Grow(Int32Array);
          tpaint = new Grow(Int32Array);
          break;
        case 'vertex':
          if (vx) {
            vx.push(+a.x);
            vx.push(+a.y);
            vx.push(+a.z);
          }
          break;
        case 'triangle':
          if (tv && tpid && tp1 && tp2 && tp3 && tpaint) {
            tv.push(int(a.v1));
            tv.push(int(a.v2));
            tv.push(int(a.v3));
            tpid.push(int(a.pid));
            tp1.push(int(a.p1));
            tp2.push(int(a.p2));
            tp3.push(int(a.p3));
            const pc = a.paint_color ?? a['slic3rpe:mmu_segmentation'] ?? a.mmu_segmentation;
            let paint = -1;
            if (pc !== undefined) {
              const d = decodePaintColor(pc);
              paint = d.kind === 'state' ? d.state : -2;
            }
            tpaint.push(paint);
          }
          break;
        case 'component':
          obj?.components.push({
            objectId: a.objectid ?? '',
            path: getAttr(a, 'path')?.replace(/^\/+/, '') ?? null,
            transform: parseTransform(a.transform),
          });
          break;
        case 'item':
          model.buildItems.push({
            objectId: a.objectid ?? '',
            transform: parseTransform(a.transform),
            printable: !(a.printable === '0' || a.printable === 'false'),
          });
          break;
      }
    },
    close(name: string) {
      if (name === 'mesh' && obj && vx && tv && tpid && tp1 && tp2 && tp3 && tpaint) {
        obj.mesh = {
          vertices: vx.done(),
          tris: tv.done(),
          pid: tpid.done(),
          p1: tp1.done(),
          p2: tp2.done(),
          p3: tp3.done(),
          paint: tpaint.done(),
        };
        vx = tv = tpid = tp1 = tp2 = tp3 = tpaint = null;
      } else if (name === 'object') {
        obj = null;
      } else if (name === 'basematerials' || name === 'colorgroup') {
        group = null;
      }
    },
    text(_name: string, a: Attrs, content: string) {
      if (a.name === 'Application') model.producer = content;
    },
  });

  return model;
}
