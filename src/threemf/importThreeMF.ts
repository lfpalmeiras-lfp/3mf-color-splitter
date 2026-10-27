import { unzipSync } from 'fflate';
import { scanXml } from './xml';
import { parseModelFile, type ObjDef, type ParsedModel } from './parseModelFile';
import {
  parseBambuModelSettings,
  parseBambuPalette,
  parsePrusaModelConfig,
  parsePrusaPalette,
  type BambuObject,
  type PrusaObject,
} from './vendor';
import { approxColorName } from './colorName';
import { UNIT_TO_MM } from './units';
import {
  ImportError,
  type ColorSource,
  type ImportInfo,
  type ImportResult,
  type ImportWarning,
  type ImportedPart,
  type Vendor,
} from './types';

type Progress = (stage: string, percent: number) => void;

// ---------- matrizes 4x4 (convenção de linha do 3MF: v' = v · M) ----------

/** 12 números do 3MF -> matriz 4x4 em ordem de linha. */
function toM(t: number[] | null): Float64Array {
  const m = new Float64Array(16);
  if (!t) {
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  }
  m.set([t[0], t[1], t[2], 0, t[3], t[4], t[5], 0, t[6], t[7], t[8], 0, t[9], t[10], t[11], 1]);
  return m;
}

/** Aplica A primeiro e depois B (v · A · B). */
function mul(A: Float64Array, B: Float64Array): Float64Array {
  const r = new Float64Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += A[i * 4 + k] * B[k * 4 + j];
      r[i * 4 + j] = s;
    }
  return r;
}

function det3(M: Float64Array): number {
  return (
    M[0] * (M[5] * M[10] - M[6] * M[9]) -
    M[1] * (M[4] * M[10] - M[6] * M[8]) +
    M[2] * (M[4] * M[9] - M[5] * M[8])
  );
}

// ---------- utilidades ----------

const decode = (b: Uint8Array): string => {
  const s = new TextDecoder('utf-8').decode(b);
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
};

const NON_MODEL_TYPES = new Set(['support', 'solidsupport', 'surface', 'other']);
const NONE_COLOR = '#B5B5B5';

interface Leaf {
  file: string;
  obj: ObjDef;
  matrix: Float64Array;
  topId: string;
  partId: string | null;
}

interface Group {
  color: string;
  name: string;
  firstSource: ColorSource;
  labels: Set<string>;
  positions: number[];
  indices: number[];
}

export function importThreeMF(data: Uint8Array, report: Progress = () => {}): ImportResult {
  report('Lendo 3MF...', 2);

  // ---- 1. ZIP ----
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, { filter: (f) => /\.(model|rels|config|xml)$/i.test(f.name) });
  } catch {
    throw new ImportError(
      'not-zip',
      'Não foi possível abrir o arquivo como pacote 3MF (ZIP). Ele pode estar corrompido ou não ser um 3MF.',
    );
  }
  const byLower = new Map<string, string>();
  for (const k of Object.keys(files)) byLower.set(k.toLowerCase(), k);
  const read = (p: string): string | null => {
    const k = byLower.get(p.replace(/^\/+/, '').toLowerCase());
    return k === undefined ? null : decode(files[k]);
  };

  // ---- 2. Arquivo de modelo raiz ----
  let rootPath = '3D/3dmodel.model';
  const rels = read('_rels/.rels');
  if (rels) {
    let found = false;
    scanXml(rels, {
      open(n, a) {
        if (!found && n === 'Relationship' && /3dmodel/i.test(a.Type ?? '') && a.Target) {
          rootPath = a.Target.replace(/^\/+/, '');
          found = true;
        }
      },
      close() {},
    });
  }
  report('Interpretando o modelo...', 8);
  const rootXml = read(rootPath);
  if (!rootXml) {
    throw new ImportError(
      'no-model',
      `O pacote não contém o arquivo de modelo 3D (${rootPath}). Este arquivo não parece ser um 3MF válido.`,
    );
  }

  // ---- 3. Modelos (raiz + sub-modelos referenciados por p:path) ----
  const cache = new Map<string, ParsedModel | null>();
  const getModel = (path: string): ParsedModel | null => {
    if (cache.has(path)) return cache.get(path)!;
    const xml = path === rootPath ? rootXml : read(path);
    const parsed = xml ? parseModelFile(xml) : null;
    cache.set(path, parsed);
    return parsed;
  };
  const root = getModel(rootPath)!;

  const unit = root.unit;
  const scale = UNIT_TO_MM[unit];
  if (scale === undefined) {
    throw new ImportError('bad-unit', `Unidade desconhecida no arquivo: "${unit}". Não é seguro converter a escala.`);
  }
  if (root.buildItems.length === 0) {
    throw new ImportError('no-build', 'O arquivo não possui itens na seção <build>; não há nada para exibir.');
  }

  // ---- 4. Metadados de fabricante ----
  const producer = root.producer;
  const bambuXml = read('Metadata/model_settings.config');
  const prusaXml = read('Metadata/Slic3r_PE_model.config');
  let vendor: Vendor = 'none';
  if (producer && /orca/i.test(producer)) vendor = 'orca';
  else if (producer && /bambu/i.test(producer)) vendor = 'bambu';
  else if (producer && /prusa|slic3r/i.test(producer)) vendor = 'prusa';
  else if (bambuXml) vendor = 'bambu';
  else if (prusaXml) vendor = 'prusa';
  const bambuLike = vendor === 'bambu' || vendor === 'orca';
  const vendorName = { bambu: 'Bambu Studio', orca: 'OrcaSlicer', prusa: 'PrusaSlicer', none: '' }[vendor];

  const bambuObjs: Map<string, BambuObject> | null = bambuLike && bambuXml ? parseBambuModelSettings(bambuXml) : null;
  const prusaObjs: Map<string, PrusaObject> | null = vendor === 'prusa' && prusaXml ? parsePrusaModelConfig(prusaXml) : null;
  const palette: string[] | null = bambuLike
    ? parseBambuPalette(read('Metadata/project_settings.config'))
    : vendor === 'prusa'
      ? parsePrusaPalette(read('Metadata/Slic3r_PE.config'))
      : null;

  // ---- 5. Instâncias (itens de build -> componentes -> malhas) ----
  const c = {
    gradient: 0, split: 0, paintUnresolved: 0, textured: 0, otherGroup: 0, invalidTri: 0,
    missingMaterial: 0, skippedTris: 0, skippedObjects: 0, alpha: 0, noColor: 0, missingRefs: 0,
  };
  const extra: ImportWarning[] = [];
  const leaves: Leaf[] = [];

  const collect = (file: string, id: string, M: Float64Array, topId: string, partId: string | null, stack: string[]): void => {
    const model = getModel(file);
    if (!model) {
      c.missingRefs++;
      return;
    }
    if (model.unit !== unit && !extra.some((w) => w.code === 'unit-mismatch'))
      extra.push({
        code: 'unit-mismatch',
        message: `Um sub-modelo usa a unidade "${model.unit}", diferente do modelo principal ("${unit}"). Foi usada a unidade do modelo principal.`,
      });
    const obj = model.objects.get(id);
    if (!obj) {
      c.missingRefs++;
      return;
    }
    if (NON_MODEL_TYPES.has(obj.type)) {
      c.skippedObjects++;
      return;
    }
    const key = `${file}#${id}`;
    if (stack.includes(key)) throw new ImportError('cycle', 'O arquivo tem componentes que se referenciam em ciclo.');
    if (obj.mesh) leaves.push({ file, obj, matrix: M, topId, partId });
    for (const comp of obj.components) {
      const childM = mul(toM(comp.transform), M);
      collect(comp.path ?? file, comp.objectId, childM, topId, stack.length === 0 ? comp.objectId : partId, [...stack, key]);
    }
  };
  for (const item of root.buildItems) {
    if (!item.printable) continue;
    collect(rootPath, item.objectId, toM(item.transform), item.objectId, null, []);
  }
  if (leaves.length === 0) {
    throw new ImportError('empty', 'Nenhuma geometria encontrada no arquivo (nenhum objeto com malha nos itens de construção).');
  }

  // ---- 6. Geometria por cor ----
  const groups = new Map<string, Group>();
  const getGroup = (color: string, name: string, source: ColorSource, label: string): Group => {
    let g = groups.get(color);
    if (!g) {
      g = { color, name, firstSource: source, labels: new Set(), positions: [], indices: [] };
      groups.set(color, g);
    }
    g.labels.add(label);
    return g;
  };

  const L_TRI = 'Material do 3MF (por triângulo)';
  const L_OBJ = 'Material do 3MF (por objeto)';
  const L_GRP = 'Grupo de cores do 3MF';
  const L_PAINT = `Pintura do ${vendorName} (experimental)`;
  const L_EXT = `Extrusora do ${vendorName} (experimental)`;
  let vendorColorsUsed = false;
  let totalTris = 0;
  const totalAll = leaves.reduce((s, l) => s + l.obj.mesh!.tris.length / 3, 0);
  let done = 0;
  const meshObjs = new Set<string>();
  let instances = 0;

  for (const leaf of leaves) {
    const mesh = leaf.obj.mesh!;
    const model = getModel(leaf.file)!;
    const nv = mesh.vertices.length / 3;
    const nt = mesh.tris.length / 3;

    // vértices -> mm, já no espaço do mundo
    const M = leaf.matrix;
    const world = new Float64Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      const x = mesh.vertices[i * 3], y = mesh.vertices[i * 3 + 1], z = mesh.vertices[i * 3 + 2];
      world[i * 3] = (x * M[0] + y * M[4] + z * M[8] + M[12]) * scale;
      world[i * 3 + 1] = (x * M[1] + y * M[5] + z * M[9] + M[13]) * scale;
      world[i * 3 + 2] = (x * M[2] + y * M[6] + z * M[10] + M[14]) * scale;
    }
    const mirrored = det3(M) < 0; // espelhamento inverte a orientação dos triângulos

    // extrusora padrão do volume/objeto (metadados de fabricante)
    let leafExtruder = 0;
    let prusaVols: PrusaObject['volumes'] = [];
    let prusaObjExtruder = 0;
    if (bambuObjs) {
      const bo = bambuObjs.get(leaf.topId);
      const part = leaf.partId ? bo?.parts.get(leaf.partId) : undefined;
      if (part?.subtype && part.subtype !== 'normal_part') {
        c.skippedTris += nt;
        continue;
      }
      leafExtruder = part?.extruder ?? bo?.extruder ?? 0;
    } else if (prusaObjs) {
      const po = prusaObjs.get(leaf.topId);
      prusaVols = po?.volumes ?? [];
      prusaObjExtruder = po?.extruder ?? 0;
    }
    let vi = 0;
    instances++;
    meshObjs.add(`${leaf.file}#${leaf.obj.id}`);

    const maps = new Map<Group, Int32Array>();
    for (let t = 0; t < nt; t++) {
      const a = mesh.tris[t * 3], b = mesh.tris[t * 3 + 1], cc = mesh.tris[t * 3 + 2];
      if (a < 0 || b < 0 || cc < 0 || a >= nv || b >= nv || cc >= nv) {
        c.invalidTri++;
        continue;
      }

      // extrusora deste triângulo (PrusaSlicer: por faixa de volume)
      let triExtruder = leafExtruder;
      if (prusaObjs) {
        while (vi < prusaVols.length && t > prusaVols[vi].last) vi++;
        const vol = vi < prusaVols.length && t >= prusaVols[vi].first ? prusaVols[vi] : undefined;
        if (vol?.modifier) {
          c.skippedTris++;
          continue;
        }
        triExtruder = vol?.extruder ?? prusaObjExtruder;
      }

      // ---- resolução da cor: pintura > material/cor do 3MF > extrusora > sem cor ----
      let color: string | null = null;
      let name = '';
      let source: ColorSource = 'none';
      let label = 'Sem cor';

      const paint = mesh.paint[t];
      if (paint === -2) c.split++;
      if (paint > 0) {
        const pc = palette?.[paint - 1];
        if (pc) {
          color = pc;
          name = `Filamento ${paint}`;
          source = 'vendor-paint';
          label = L_PAINT;
        } else c.paintUnresolved++;
      }

      if (!color) {
        const triPid = mesh.pid[t];
        const pid = triPid >= 0 ? triPid : leaf.obj.pid;
        if (pid >= 0) {
          const p1 = mesh.p1[t] >= 0 ? mesh.p1[t] : leaf.obj.pindex;
          const grp = model.colorGroups.get(pid);
          if (grp) {
            const e = grp.entries[p1];
            if (e?.color) {
              color = e.color;
              name = e.name;
              source = grp.kind === 'colorgroup' ? 'colorgroup' : triPid >= 0 ? 'material' : 'object-material';
              label = grp.kind === 'colorgroup' ? L_GRP : triPid >= 0 ? L_TRI : L_OBJ;
              if (e.alpha < 255) c.alpha++;
              const p2 = mesh.p2[t], p3 = mesh.p3[t];
              if ((p2 >= 0 && p2 !== p1) || (p3 >= 0 && p3 !== p1)) c.gradient++;
            } else c.missingMaterial++;
          } else if (model.textureGroupIds.has(pid)) c.textured++;
          else if (model.otherGroupIds.has(pid)) c.otherGroup++;
          else c.missingMaterial++;
        }
      }

      if (!color && triExtruder > 0 && palette?.[triExtruder - 1]) {
        color = palette[triExtruder - 1];
        name = `Filamento ${triExtruder}`;
        source = 'vendor-extruder';
        label = L_EXT;
      }

      if (!color) {
        c.noColor++;
        color = NONE_COLOR;
        name = 'Sem cor definida';
      } else if (source === 'vendor-paint' || source === 'vendor-extruder') vendorColorsUsed = true;
      if (!name) name = approxColorName(color);

      const g = getGroup(color, name, source, label);
      let map = maps.get(g);
      if (!map) {
        map = new Int32Array(nv).fill(-1);
        maps.set(g, map);
      }
      const tri = mirrored ? [a, cc, b] : [a, b, cc];
      for (const vIdx of tri) {
        let ni = map[vIdx];
        if (ni < 0) {
          ni = g.positions.length / 3;
          map[vIdx] = ni;
          g.positions.push(world[vIdx * 3], world[vIdx * 3 + 1], world[vIdx * 3 + 2]);
        }
        g.indices.push(ni);
      }
      totalTris++;
      if ((++done & 0xffff) === 0) report('Construindo geometrias...', 15 + Math.round((done / totalAll) * 80));
    }
  }

  if (totalTris === 0) throw new ImportError('empty', 'O arquivo não contém triângulos válidos.');

  // ---- 7. Partes finais ----
  const ordered = [...groups.values()].sort((x, y) => (x.color === NONE_COLOR ? 1 : 0) - (y.color === NONE_COLOR ? 1 : 0));
  const nameCount = new Map<string, number>();
  for (const g of ordered) nameCount.set(g.name, (nameCount.get(g.name) ?? 0) + 1);
  const parts: ImportedPart[] = ordered.map((g, i) => ({
    id: `c${i}`,
    name: (nameCount.get(g.name) ?? 0) > 1 ? `${g.name} (${g.color})` : g.name,
    color: g.color,
    source: g.firstSource,
    sourceLabel: [...g.labels].join(' + '),
    positions: Float32Array.from(g.positions),
    indices: Uint32Array.from(g.indices),
  }));

  // ---- 8. Avisos ----
  const warnings: ImportWarning[] = [...extra];
  const w = (code: string, message: string) => warnings.push({ code, message });
  const onlyNone = parts.length === 1 && parts[0].color === NONE_COLOR;
  if (c.textured > 0) {
    w(
      'textured',
      c.textured === totalTris
        ? 'Este modelo utiliza textura em vez de cores geométricas e ainda não pode ser separado automaticamente por cor.'
        : `${c.textured} triângulos usam textura (não suportada) e foram exibidos sem cor.`,
    );
  }
  if (onlyNone && c.textured === 0)
    w('no-color', 'O arquivo não contém informação de cor reconhecida; todo o modelo foi agrupado em "Sem cor definida".');
  else if (c.noColor > 0 && c.textured !== c.noColor)
    w('no-color-some', `${c.noColor} triângulos sem cor definida foram agrupados em "Sem cor definida".`);
  if (c.otherGroup > 0) w('other-group', `${c.otherGroup} triângulos usam materiais compostos/multipropriedades, ainda não suportados.`);
  if (c.gradient > 0) w('gradient', `${c.gradient} triângulos têm cores diferentes por vértice (gradiente); foi usada só a cor do primeiro vértice.`);
  if (c.split > 0)
    w('split', `${c.split} triângulos têm pintura parcial (subdividida) do ${vendorName || 'slicer'}. Esse formato ainda não é interpretado; eles usam a cor do volume/objeto.`);
  if (c.paintUnresolved > 0)
    w('paint-unresolved', `${c.paintUnresolved} triângulos têm pintura do ${vendorName}, mas a paleta de filamentos não foi encontrada no arquivo (ou o índice está fora dela).`);
  if (c.missingMaterial > 0) w('missing-material', `${c.missingMaterial} triângulos referenciam materiais inexistentes.`);
  if (c.invalidTri > 0) w('invalid-tri', `${c.invalidTri} triângulos com índices de vértice inválidos foram ignorados.`);
  if (c.skippedTris > 0) w('skipped-parts', `${c.skippedTris} triângulos de modificadores, volumes negativos ou suportes foram ignorados.`);
  if (c.skippedObjects > 0) w('skipped-objects', `${c.skippedObjects} objetos que não são do tipo "model" (suportes etc.) foram ignorados.`);
  if (c.missingRefs > 0) w('missing-refs', `${c.missingRefs} referências a objetos ou arquivos inexistentes foram ignoradas.`);
  if (c.alpha > 0) w('alpha', 'A transparência (canal alfa) das cores foi ignorada.');

  const info: ImportInfo = {
    producer,
    vendor,
    vendorColorsUsed,
    originalUnit: unit,
    scaleToMm: scale,
    modelFiles: [...cache.values()].filter(Boolean).length,
    objectCount: meshObjs.size,
    instanceCount: instances,
    triangleCount: totalTris,
    warnings,
  };
  report('Concluído', 100);
  return { parts, info };
}
