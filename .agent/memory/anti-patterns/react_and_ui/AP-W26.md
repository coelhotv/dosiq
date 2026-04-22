# [AP-W26] Flicker ou Animação Dupla no Mount de Telas

## Problema
Ocorre quando uma tela utiliza uma animação de "entrada" (ex: subir o conteúdo) enquanto um componente de `LoadingState` ainda está ativo ou é substituído subitamente.

## Sintoma
O usuário vê um spinner, e quando os dados chegam, o conteúdo aparece fazendo uma segunda animação, gerando um "flicker" ou atraso na percepção de rapidez do app.

## Como Evitar
- Remova animações de montagem em componentes que dependem de carregamento assíncrono.
- Deixe que o `LoadingState` lide com a transição.
- Use `LayoutAnimation` ou transições suaves apenas após dados estarem estáveis.

## Caso Real
`ProfileScreen` apresentava uma animação de subida que conflitava com o `LoadingState`, causando uma experiência visual "quebrada" na primeira carga.
