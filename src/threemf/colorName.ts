/** Nome aproximado de uma cor (português), pelo vizinho mais próximo no espaço CIELAB. */
const NAMED: [string, string][] = [
  ['Preto', '#101010'],
  ['Cinza escuro', '#444444'],
  ['Cinza', '#808080'],
  ['Cinza claro', '#C4C4C4'],
  ['Branco', '#F5F5F5'],
  ['Vermelho', '#D62828'],
  ['Laranja', '#F58220'],
  ['Amarelo', '#F7D117'],
  ['Verde', '#2E9E3E'],
  ['Verde-claro', '#8FD14F'],
  ['Ciano', '#20C4D8'],
  ['Azul', '#2C6BD6'],
  ['Azul-escuro', '#14307A'],
  ['Roxo', '#7B3FB5'],
  ['Magenta', '#D0289A'],
  ['Rosa', '#F5A3C4'],
  ['Marrom', '#7A4A24'],
  ['Bege', '#D9C3A0'],
];

function toLab(hex: string): [number, number, number] {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const x = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047;
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const NAMED_LAB = NAMED.map(([n, h]) => [n, toLab(h)] as const);

export function approxColorName(hex: string): string {
  const lab = toLab(hex);
  let best = NAMED_LAB[0][0];
  let bestD = Infinity;
  for (const [name, l] of NAMED_LAB) {
    const d = (l[0] - lab[0]) ** 2 + (l[1] - lab[1]) ** 2 + (l[2] - lab[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}
