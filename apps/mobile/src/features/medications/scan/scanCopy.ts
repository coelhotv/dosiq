// 066 D2: aberto pela compra não há "cadastro" — a saída manual é preencher a compra digitando.
const PURCHASE_WORDING: [RegExp, string][] = [
  [/[Cc]adastrar digitando/g, 'preencher digitando'],
  [/[Cc]adastre digitando/g, 'preencha digitando'],
  [/[Oo] cadastro digitando/g, 'o preenchimento digitando'],
  [/[Oo] cadastro manual/g, 'o preenchimento manual'],
]

/** Rótulo da saída manual: no cadastro, "Digitar manualmente" (D1); na compra, igual ao botão do 4.1 (C-12b). */
export function manualLabel(purchase: boolean): string {
  return purchase ? 'Preencher digitando' : 'Digitar manualmente'
}

/** Texto do cadastro (D1, aprovado no smoke) adaptado à compra; fora da compra volta intacto. */
export function scanCopy(text: string | undefined, purchase: boolean): string | undefined {
  if (!purchase || !text) return text
  const out = PURCHASE_WORDING.reduce((acc, [re, to]) => acc.replace(re, to), text)
  return out.charAt(0).toUpperCase() + out.slice(1)
}
