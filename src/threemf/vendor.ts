import { scanXml, type Attrs } from './xml';

/** Normaliza "#RRGGBB", "#RRGGBBAA", "RRGGBB" para "#RRGGBB" maiúsculo (ou null). */
export function normalizeHex(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(value.trim());
  return m ? '#' + m[1].toUpperCase() : null;
}

/** Alfa (0-255) de "#RRGGBBAA"; 255 se não houver. */
export function alphaOf(value: string | undefined | null): number {
  const m = value ? /^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/.exec(value.trim()) : null;
  return m ? parseInt(m[1], 16) : 255;
}

// ---------- Bambu Studio / OrcaSlicer: Metadata/model_settings.config ----------

export interface BambuPart {
  extruder?: number;
  subtype?: string;
}
export interface BambuObject {
  extruder?: number;
  parts: Map<string, BambuPart>;
}

export function parseBambuModelSettings(xml: string): Map<string, BambuObject> {
  const objects = new Map<string, BambuObject>();
  let obj: BambuObject | null = null;
  let part: BambuPart | null = null;
  scanXml(xml, {
    open(name: string, a: Attrs) {
      if (name === 'object' && a.id !== undefined) {
        obj = { parts: new Map() };
        objects.set(a.id, obj);
      } else if (name === 'part' && obj && a.id !== undefined) {
        part = { subtype: a.subtype };
        obj.parts.set(a.id, part);
      } else if (name === 'metadata' && a.key === 'extruder' && a.value !== undefined) {
        const n = parseInt(a.value, 10);
        if (!Number.isNaN(n)) {
          if (part) part.extruder = n;
          else if (obj) obj.extruder = n;
        }
      }
    },
    close(name: string) {
      if (name === 'part') part = null;
      else if (name === 'object') {
        obj = null;
        part = null;
      }
    },
  });
  return objects;
}

/** Paleta de filamentos (1-based pelo índice+1) do projeto Bambu/Orca. */
export function parseBambuPalette(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const cfg = JSON.parse(json) as Record<string, unknown>;
    const arr = cfg['filament_colour'];
    if (!Array.isArray(arr)) return null;
    const out = arr.map((c) => normalizeHex(typeof c === 'string' ? c : null) ?? '');
    return out.some(Boolean) ? out : null;
  } catch {
    return null;
  }
}

// ---------- PrusaSlicer: Metadata/Slic3r_PE_model.config ----------

export interface PrusaVolume {
  first: number;
  last: number;
  extruder?: number;
  modifier: boolean;
}
export interface PrusaObject {
  extruder?: number;
  volumes: PrusaVolume[];
}

export function parsePrusaModelConfig(xml: string): Map<string, PrusaObject> {
  const objects = new Map<string, PrusaObject>();
  let obj: PrusaObject | null = null;
  let vol: PrusaVolume | null = null;
  scanXml(xml, {
    open(name: string, a: Attrs) {
      if (name === 'object' && a.id !== undefined) {
        obj = { volumes: [] };
        objects.set(a.id, obj);
      } else if (name === 'volume' && obj) {
        vol = { first: parseInt(a.firstid ?? '0', 10), last: parseInt(a.lastid ?? '-1', 10), modifier: false };
        obj.volumes.push(vol);
      } else if (name === 'metadata' && a.value !== undefined) {
        if (a.key === 'extruder') {
          const n = parseInt(a.value, 10);
          if (!Number.isNaN(n)) {
            if (vol) vol.extruder = n;
            else if (obj) obj.extruder = n;
          }
        } else if (a.key === 'modifier' && vol) {
          vol.modifier = a.value === '1' || a.value === 'true';
        }
      }
    },
    close(name: string) {
      if (name === 'volume') vol = null;
      else if (name === 'object') {
        obj = null;
        vol = null;
      }
    },
  });
  for (const o of objects.values()) o.volumes.sort((x, y) => x.first - y.first);
  return objects;
}

/** Paleta do PrusaSlicer: linhas "; filament_colour = #A;#B" (cai em extruder_colour). */
export function parsePrusaPalette(text: string | null): string[] | null {
  if (!text) return null;
  const read = (key: string): string[] | null => {
    const m = new RegExp('^;\\s*' + key + '\\s*=\\s*(.+)$', 'm').exec(text);
    if (!m) return null;
    return m[1].split(';').map((c) => normalizeHex(c.replace(/["'\s]/g, '')) ?? '');
  };
  const fil = read('filament_colour');
  if (fil && fil.some(Boolean)) return fil;
  const ext = read('extruder_colour');
  return ext && ext.some(Boolean) ? ext : null;
}
