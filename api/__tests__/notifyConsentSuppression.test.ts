import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))

/**
 * 046 T014 — guarda ESTRUTURAL da supressão por consentimento no cron.
 *
 * Existe por causa de um defeito real que viveu em produção de 15/07 a 21/08/2026: `api/notify.ts`
 * montava o SEU PRÓPRIO repositório de preferências, e o `select` dele não trazia
 * `consent_revoked_at`. Como `isConsentSuppressed` decide por esse campo, ele chegava `undefined` e
 * a supressão ficava inerte exatamente no caminho que dispara lembrete de dose.
 *
 * Nada pegava: `select` é string, então tsc/lint não veem; e os testes do dispatcher recebem as
 * settings JÁ MONTADAS — provam a política, não a query. A defesa possível é estrutural: garantir
 * que existe UM repositório, não dois.
 */
describe('dispatcher do cron — fonte única das settings de notificação', () => {
  // 107: o dispatcher saiu de notify.ts para api/_shared/cronDispatcher.ts (notify + ops o usam).
  const dispatcher = readFileSync(resolve(aqui, '../_shared/cronDispatcher.ts'), 'utf8')
  const notify = readFileSync(resolve(aqui, '../notify.ts'), 'utf8')
  const ops = readFileSync(resolve(aqui, '../ops.ts'), 'utf8')

  it('usa o repositório canônico, não uma implementação local', () => {
    expect(dispatcher).toContain("repositories/notificationPreferenceRepository.js'")
    expect(dispatcher).toContain('const preferencesRepo = notificationPreferenceRepository')
  })

  it('notify e ops montam o dispatcher pela fábrica compartilhada', () => {
    expect(notify).toContain('createCronDispatcher(')
    expect(ops).toContain('createCronDispatcher(')
  })

  it('107 PO-7: o prune NÃO roda mais no notify (sem prune paralelo à fila)', () => {
    expect(notify).not.toContain('consent_prune')
    expect(notify).not.toContain('runConsentPrune')
  })

  it('🔴 nenhum dos três define um getSettingsByUserId próprio (a duplicata É o bug)', () => {
    for (const fonte of [dispatcher, notify, ops]) {
      expect(fonte).not.toMatch(/async\s+getSettingsByUserId\s*\(/)
    }
  })
})

/** Guarda de CONTEÚDO do repositório canônico — complementa o estrutural, não o substitui. */
describe('notificationPreferenceRepository — o select carrega consent_revoked_at', () => {
  const repo = readFileSync(
    resolve(aqui, '../../server/notifications/repositories/notificationPreferenceRepository.ts'),
    'utf8',
  )
  const trecho = repo.slice(repo.indexOf('async getSettingsByUserId'))

  it('consent_revoked_at está no select', () => {
    const ini = trecho.indexOf(".select('")
    expect(trecho.slice(ini, trecho.indexOf("')", ini))).toContain('consent_revoked_at')
  })

  it('erro de leitura marca _read_failed (fail-closed por usuário, AP-290)', () => {
    expect(trecho).toContain('_read_failed: true')
  })
})
