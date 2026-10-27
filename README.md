# 3MF Color Splitter

Separa um 3MF colorido em peças STL por cor, com encaixes. Todo o processamento
acontece no navegador; nenhum arquivo é enviado a servidor.

Desenvolvimento 100% online: veja o passo a passo da conversa (StackBlitz para editar
e testar, GitHub para guardar o código, GitHub Pages para publicar).

Scripts (executados pela plataforma online, não no seu computador):
- `npm run dev`: servidor de desenvolvimento
- `npm run build`: build de produção em `dist/`

## Etapa 2: importação de 3MF

Leitura real de 3MF no navegador (Web Worker): unidades → mm, objetos/componentes/transformações,
cores por material, por objeto e por triângulo (padrão 3MF) e, de forma **experimental**, pintura e
extrusoras do Bambu Studio / OrcaSlicer / PrusaSlicer. Texturas UV não são suportadas.

Testes de importação (usam 3MF sintéticos): ver `tests/selftest.ts`.
