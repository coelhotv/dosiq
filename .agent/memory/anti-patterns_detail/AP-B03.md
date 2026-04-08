# AP-B03 — Import estático de componente pesado que internamente importa services/vendors grandes

**Category:** Build
**Status:** active
**Related Rule:** R-117
**Applies To:** all

## Problem

Cadeia transitiva puxa chunks inteiros para o main bundle. Ex: `import ReportGenerator` → `pdfGeneratorService` → `stockService` + `vendor-pdf` (589KB) no modulepreload. O `manualChunks` do Vite separa os módulos em chunks, mas `<link rel="modulepreload">` carrega tudo eagerly.

## Prevention

Componentes que usam services pesados (PDF, charts, stock) devem ser `React.lazy()`. Services dentro deles devem usar `import()` dinâmico, não import estático.
