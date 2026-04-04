# Sprint Journal: ANVISA ETL & Stock Evolution (Wave 11/12)

**Date**: 2026-04-04
**Feature**: Integração de Laboratórios e Categorias da ANVISA no Redesign de Estoque.
**PR**: #446 (Merged)

## Objetivo da Sprint
O objetivo principal foi evoluir a arquitetura do banco de dados exposto ao front-end referente a base de medicamentos da ANVISA. Foi necessário tratar a deduplicação de instâncias para suportar métricas de analytics futuras, exigindo que medicamentos de Marca (Similar, Novo, Específico etc) tivessem rastreabilidade do Laboratório atrelada ao nome.

## O Que Foi Feito

**1. Normalização do Parser da ANVISA**
- Desenvolvemos sanitizações (`toTitleCase` excluindo conectivos).
- Adicionadas as classificações `Biológico`, `Fitoterápico`, `Específico` e `Dinamizado`.
- Regra de negócio de deduplicação reescrita:
  - **Genéricos** fundem todos os laboratórios (busca cega e abrangente).
  - **Marcas** geram uma instância JSON única atada ao laboratório nativo.

**2. Schemas & Enums (Zod)**
- Zod enumerations `REGULATORY_CATEGORIES` em `medicineSchema.js` expandidos e padronizados globalmente em todo front e back-end.

**3. Automação nos Mapeadores UX (FirstMedicineStep, TreatmentWizard, MedicineForm)**
- Ao selecionar uma sugestão originada do arquivo estático (Autocomplete), injetamos automaticamente a categoria estrita da droga e o nome laboratório.
- **Bug Fix implementado**: Caso um usuário submeta primeiro uma "Marca" e logo depois altere sua busca por um "Genérico", um patch limpando estritamente `laboratory` previne "vazamento" de laboratório onde ele não deveria existir.

**4. Redesign do App / Estoque**
- Componente `StockForm.jsx` reage a essas importações: exibe a captura de 'Laboratório' **somente** se for Genérico. Tranca a variável de laboratório sem display se o produto vier do database oficial com lab fixo.
- Adicionada a renderização de subtexto para indicar `Laboratório • Farmácia` dentro de `StockCardRedesign.jsx` (Listagem geral) e `EntradaHistorico.jsx` (Tela visual de tracking de logs de compra). 

## Qualidade & Validação
- Total de submissão do agente revisado e ajustado baseando-se em feedbacks de reviews da IA (Code Assist).
- Refatorado Utils (`stringUtils.js`) pra hospedar a regra de TitleCase em central shared ao invés de acoplado no script node. 
- Build 100% verde (543 passing critical tests). Nenhum escape em Suítes, demonstrando estabilidade global após merge com principal. 

## Lições & Base
- Todo design de banco da ANVISA serve agora como Single Source of Truth limpo e categorizado, viabilizando análises de preços com cortes detalhados para relatórios futuros. 
- Adensamento de refatoração para "não propagação" de laboratório ao usar form UX em React garantida no estado de manipulação (`setFormData`), sobrepondo o uso de `prev.laboratory` com `''`.
