// readingDuration — duração default do toast proporcional ao tamanho da mensagem.
// Motivo: os 3s fixos anteriores cortavam a leitura das confirmações longas de mudança de
// estado (smoke da 044 F4a: "Controle de estoque reativado · saldo retomado como estava").

import { readingDuration } from '../Toast'

describe('readingDuration', () => {
  it('mensagem curta fica perto do piso (nunca abaixo de 3s)', () => {
    const ms = readingDuration('Preferência salva')
    expect(ms).toBeGreaterThanOrEqual(3000)
    expect(ms).toBeLessThan(4000)
  })

  it('confirmação longa de mudança de estado passa de 6s', () => {
    const msg = 'Controle de estoque reativado · saldo retomado como estava'
    expect(readingDuration(msg)).toBeGreaterThanOrEqual(6000)
  })

  it('mensagem muito longa é limitada ao teto de 9s', () => {
    expect(readingDuration('palavra '.repeat(50))).toBe(9000)
  })

  it('mensagem vazia/inválida cai no piso, nunca em NaN', () => {
    expect(readingDuration('')).toBe(3000)
    expect(readingDuration(undefined as unknown as string)).toBe(3000)
  })
})
