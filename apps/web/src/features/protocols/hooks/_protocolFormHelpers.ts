// 029 F3.1 (T017i): `getTitrationEnabledStatus` e o ramo de titulação de
// `buildProtocolFormInitialData` foram removidos com o web write-freeze. Ambos liam as colunas
// N1 (`titration_schedule`/`titration_status`), dropadas no F6 — e o ramo era MORTO: a guarda
// `!protocol && isTitrating` nunca podia ser verdadeira, porque `isTitrating` derivava do
// próprio `protocol`. A escada nasce no app, sobre `titration_steps` (029 F4).
export function buildProtocolFormInitialData(protocol, initialValues) {
  return initialValues || {}
}
