// consentHealthDeclinedRetired.test.ts — guard da PO-12: consent_health_declined não pode voltar.
import fs from 'fs'
import path from 'path'

describe('consent_health_declined — aposentado (065 PR D / US9 / PO-12)', () => {
  it('não existe como chave do catálogo em analyticsEvents.ts', () => {
    const src = fs.readFileSync(path.join(__dirname, '../analyticsEvents.ts'), 'utf8')
    expect(src).not.toMatch(/CONSENT_HEALTH_DECLINED\s*:/)
  })

  it('não é mais importado/chamado em HealthConsentCheckbox.tsx', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../../features/consent/components/HealthConsentCheckbox.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/EVENTS\.CONSENT_HEALTH_DECLINED|logEvent/)
  })
})
