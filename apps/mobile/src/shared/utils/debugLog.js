/**
 * debugLog — Utilitário de log seguro para ambiente de desenvolvimento.
 * 
 * Evita violações de no-console e garante que logs não vazem em produção.
 */
export const debugLog = (message, ...args) => {
  if (__DEV__) {
    // Usamos um objeto para evitar que o linter detecte o console.log diretamente
    // se a regra for muito estrita, mas geralmente console.log dentro de um 
    // wrapper controlado é aceitável ou ignorado por arquivos de infra.
    // eslint-disable-next-line no-console
    console.log(message, ...args)
  }
}
