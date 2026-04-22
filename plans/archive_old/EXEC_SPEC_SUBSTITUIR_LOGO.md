# Execution Spec - Substituir Logo na Landing Page

Substituição do logotipo atual (ícone de coração) pela nova identidade visual (chip/pílula) na landing page.

## Escopo e Entregáveis

- [x] Criar componente `LogoMark` em `src/views/Landing.jsx` com o novo SVG.
- [x] Substituir `HeartPulseIcon` por `LogoMark` no Header da landing page.
- [x] Substituir `HeartPulseIcon` por `LogoMark` no Footer da landing page.
- [x] Ajustar escala do logo para 80% da área do background (`size={32}` no header, `size={25}` no footer).
- [x] Diminuir arredondamento das bordas do background do logo (`8px` e `6px`).
- [x] Remover definição não utilizada de `HeartPulseIcon`.
- [x] Re-messaging de privacidade: remover alegações de "local-only" e migrar para valores de "Transparência" e "Código Aberto".

## Arquivos Alvo

- `src/views/Landing.jsx`

## Critérios de Aceitação

- [ ] O novo logo deve aparecer no cabeçalho.
- [ ] O novo logo deve aparecer no rodapé.
- [ ] O tamanho do logo deve ser consistente com o design atual (aprox. 24px no header, 18px no footer).
- [ ] As cores do SVG devem ser integradas ao sistema de design (idealmente usando `currentColor` ou as variáveis de v0.1.0).

## Comandos de Validação

- `npm run lint`
- `npm run test:components src/views/__tests__/Landing.test.jsx` (se existir)
