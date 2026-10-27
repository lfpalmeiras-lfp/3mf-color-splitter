/** Fator de conversão de cada unidade do 3MF para milímetros. */
export const UNIT_TO_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

export const UNIT_LABEL_PT: Record<string, string> = {
  micron: 'mícrons',
  millimeter: 'milímetros',
  centimeter: 'centímetros',
  inch: 'polegadas',
  foot: 'pés',
  meter: 'metros',
};
