// consentSuppression.test.ts — spec 046 T014 (revisado pós-review do PO).
//
// O que este arquivo protege:
// (1) quem revogou não recebe NADA;
// (2) quem nunca revogou recebe (o default não pode calar lembrete clínico por omissão);
// (3) 🔴 falha ao ler as settings de UM usuário suprime SÓ ELE — nunca vira permissão de envio, e
//     nunca respinga nos outros pacientes (R-292 / família AP-290).

import { describe, it, expect } from 'vitest'
import { isConsentSuppressed } from '../consentSuppression'

describe('isConsentSuppressed', () => {
  it('revogado (flag preenchido) → suprime tudo', () => {
    expect(isConsentSuppressed({ consent_revoked_at: '2026-07-10T10:00:00Z' })).toBe(true)
  })

  it('nunca revogou (flag NULL) → envia', () => {
    expect(isConsentSuppressed({ consent_revoked_at: null })).toBe(false)
  })

  it('flag ausente (linha antiga, pré-migração) → envia', () => {
    // Direção deliberada do default (espelho invertido do AP-277): ausência de dado NUNCA cala um
    // lembrete clínico. Quem protege o revogado é o flag dele sempre existir — escrito na mesma txn
    // da RPC —, não o default.
    expect(isConsentSuppressed({})).toBe(false)
  })

  it('🔴 leitura das settings FALHOU → suprime só este usuário (não sabemos ≠ pode enviar)', () => {
    expect(isConsentSuppressed({ consent_revoked_at: null, _read_failed: true })).toBe(true)
  })

  it('🔴 settings ausentes → suprime (mesma lógica: "não sei" nunca é "pode")', () => {
    expect(isConsentSuppressed(null)).toBe(true)
    expect(isConsentSuppressed(undefined)).toBe(true)
  })

  it('🔴 o fail-closed é POR USUÁRIO — o erro de um não contamina a decisão do outro', () => {
    // Este é o teste que existe por causa do defeito da 1ª versão: lá, um único SELECT global
    // falhando abortava o run e TODOS os pacientes perdiam o lembrete de dose. Aqui a decisão é
    // tomada com a linha de cada um, isoladamente.
    const usuarioComErroDeLeitura = { consent_revoked_at: null, _read_failed: true }
    const outroPacienteSaudavel = { consent_revoked_at: null }

    expect(isConsentSuppressed(usuarioComErroDeLeitura)).toBe(true)
    expect(isConsentSuppressed(outroPacienteSaudavel)).toBe(false)
  })

  describe('046 Slice C — aviso de prune atravessa a supressão (T013d)', () => {
    it('o aviso chega a quem revogou — é a única mensagem que a política promete a ele', () => {
      expect(isConsentSuppressed({ consent_revoked_at: '2026-07-10T10:00:00Z' }, 'consent_prune_notice')).toBe(false)
    })

    it('atravessa até quando as settings não puderam ser lidas', () => {
      // A exceção não depende de saber o estado de consentimento: o aviso é dirigido a quem
      // revogou e não trata dado de saúde. Fail-closed aqui só produziria conta apagada sem aviso.
      expect(isConsentSuppressed({ _read_failed: true }, 'consent_prune_notice')).toBe(false)
      expect(isConsentSuppressed(null, 'consent_prune_notice')).toBe(false)
    })

    it('🔴 a exceção é SÓ desse kind — lembrete de dose segue suprimido para o revogado', () => {
      const revogado = { consent_revoked_at: '2026-07-10T10:00:00Z' }
      expect(isConsentSuppressed(revogado, 'dose_reminder')).toBe(true)
      expect(isConsentSuppressed(revogado, 'stock_alert')).toBe(true)
      expect(isConsentSuppressed(revogado, 'daily_digest')).toBe(true)
      // sem kind = comportamento antigo, intocado
      expect(isConsentSuppressed(revogado)).toBe(true)
    })
  })
})
