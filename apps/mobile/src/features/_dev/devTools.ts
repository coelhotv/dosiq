// devTools.ts — gate ÚNICO das ferramentas de desenvolvimento (DevHub + DevBadge).
//
// Ligado em debug (`__DEV__`) OU no build interno `device` (`EXPO_PUBLIC_DEV_TOOLS=1` no env do
// profile em `eas.json`). O profile `production` não define a variável → desligado na loja.
//
// ⚠️ Esta constante serve para gate em RUNTIME (render). Para tirar o DevHub do BUNDLE de produção
// (R-314: código inativo não embarca na loja), o `require` das telas precisa de um condicional
// LITERAL no próprio arquivo — uma constante importada não é dobrada pelo Metro, e o módulo iria junto
// (ver `Navigation.tsx`). Mudou a condição aqui? Mude lá também.

export const DEV_TOOLS_ENABLED: boolean = __DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === '1'
