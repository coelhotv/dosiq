// clientUuid.ts — UUID v4 gerado no aparelho para CHAVE DE IDEMPOTÊNCIA (069 A2).
//
// Math.random de propósito: o Hermes não tem crypto.getRandomValues sem polyfill nativo, e a chave
// não é segredo — só precisa ser praticamente única POR USUÁRIO (a RLS isola usuários; colisão no
// mesmo usuário com 122 bits aleatórios é desprezível). NÃO usar para token, sessão ou nada secreto.
export function clientUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
