# AP-H18: Mapeamento Jest Restritivo em Monorepo

> **Categoria:** Test / Configuration
> **Tags:** #jest #monorepo #mapping

## O Anti-Padrão
Utilizar regex restritiva (ex: `^@meus-remedios/pacote$`) no `moduleNameMapper` do Jest em ambientes monorepo, impedindo a resolução de importações de subcaminhos.

## Por que é ruim?
Muitos pacotes do monorepo exportam utilitários ou schemas através de caminhos internos (ex: `@meus-remedios/core/utils/dateUtils`). Se o mapeamento termina com `$`, o Jest falhará ao tentar resolver qualquer importação que contenha uma barra após o nome do pacote, resultando em erros de "Module not found".

## Como Corrigir
Utilize o padrão de captura de subcaminhos no regex e no destino:

```javascript
// ❌ INCORRETO
'^@meus-remedios/core$': '<rootDir>/../../packages/core/src/index.js'

// ✅ CORRETO
'^@meus-remedios/core(.*)$': '<rootDir>/../../packages/core/src$1'
```

## Referências
- Regra: R-122 (Estrutura Monorepo)
- Sprint: H5.8 (Configuração de Resiliência Offline)
