/**
 * Leitor de XML mínimo e rápido, sem DOM (funciona em Web Worker).
 * Suficiente para os arquivos de um pacote 3MF: tags, atributos e o texto
 * de <metadata>. Não valida o XML.
 */
export type Attrs = Record<string, string>;

export interface XmlHandler {
  /** `name` já vem sem prefixo de namespace (ex.: "m:colorgroup" → "colorgroup"). */
  open(name: string, attrs: Attrs): void;
  close(name: string): void;
  /** Texto de elementos <metadata>...</metadata>. */
  text?(name: string, attrs: Attrs, content: string): void;
}

const TAG_SRC = '<(\\/?)([A-Za-z_][\\w:.-]*)([^>]*?)(\\/?)>';
const ATTR_RE = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function localName(n: string): string {
  const i = n.lastIndexOf(':');
  return i < 0 ? n : n.slice(i + 1);
}

export function decodeEntities(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e] ?? _m;
  });
}

/** Lê um atributo pelo nome local, aceitando qualquer prefixo (ex.: "p:path" → "path"). */
export function getAttr(a: Attrs, local: string): string | undefined {
  if (local in a) return a[local];
  const suffix = ':' + local;
  for (const k in a) if (k.endsWith(suffix)) return a[k];
  return undefined;
}

export function scanXml(xml: string, h: XmlHandler): void {
  const re = new RegExp(TAG_SRC, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const name = localName(m[2]);
    if (m[1]) {
      h.close(name);
      continue;
    }
    const attrs: Attrs = {};
    const raw = m[3];
    if (raw.length > 1) {
      ATTR_RE.lastIndex = 0;
      let a: RegExpExecArray | null;
      while ((a = ATTR_RE.exec(raw)) !== null) attrs[a[1]] = decodeEntities(a[2] ?? a[3] ?? '');
    }
    h.open(name, attrs);
    const selfClosing = m[4] === '/';
    if (selfClosing) {
      h.close(name);
    } else if (name === 'metadata' && h.text) {
      const end = xml.indexOf('<', re.lastIndex);
      if (end > re.lastIndex) {
        const content = decodeEntities(xml.slice(re.lastIndex, end).trim());
        if (content) h.text(name, attrs, content);
      }
    }
  }
}
