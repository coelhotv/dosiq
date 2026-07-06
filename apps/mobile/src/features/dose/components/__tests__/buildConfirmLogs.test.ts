// buildConfirmLogs.test.js — sítio de injeção per-item no registro em batch (031-B)
import { _buildConfirmLogs } from '../BulkDoseRegisterModal'

const TAKEN_AT = '2026-06-21T12:00:00.000Z'

function item(id, presentation) {
  return {
    id,
    scheduledTime: null,
    protocol: {
      id: `proto-${id}`,
      medicine_id: `med-${id}`,
      dosage_per_intake: 1,
      medicine: { id: `med-${id}`, presentation },
    },
  }
}

describe('_buildConfirmLogs — injection_site per-item', () => {
  it('injetável recebe o sítio do mapa; não-injetável fica null', () => {
    const items = [item('a', 'injetavel'), item('b', 'comprimido')]
    const sites = { a: 'coxa_d', b: 'braco_e' } // 'b' tem lixo no mapa de propósito

    const logs = _buildConfirmLogs(['a', 'b'], items, TAKEN_AT, false, null, sites)

    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({ medicine_id: 'med-a', injection_site: 'coxa_d' })
    // não-injetável NUNCA propaga sítio, mesmo com valor no mapa
    expect(logs[1]).toMatchObject({ medicine_id: 'med-b', injection_site: null })
  })

  it('injetável sem seleção → injection_site null', () => {
    const logs = _buildConfirmLogs(['a'], [item('a', 'injetavel')], TAKEN_AT, false, null, {})
    expect(logs[0].injection_site).toBeNull()
  })
})
