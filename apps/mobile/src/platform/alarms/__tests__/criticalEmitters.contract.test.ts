// criticalEmitters.contract.test.ts — spec 054 PO-4 / FR-004 (R-297).
//
// Critical Alerts fura o silencioso: só o alarme LOCAL de dose crítica pode emitir (ADR-086 §1 —
// T0 + nag + soneca, todos via `buildNotification`). Este contrato varre, por arquivo, TODO
// escritor de notificação do app (inventário 1g do analysis-F1) e o canal Expo do servidor.
// Lista EXPLÍCITA e não vazia (AP-279): um glob que casasse zero arquivos passaria em silêncio.
// Escritor novo de notificação ⇒ entra aqui, por decisão, não por acidente.

import { readFileSync } from 'fs'
import { join } from 'path'

const MOBILE_SRC = join(__dirname, '..', '..', '..')
const REPO_ROOT = join(MOBILE_SRC, '..', '..', '..')

const EMITTER_ALLOWED = 'platform/alarms/alarmService.ts'

const FORBIDDEN_EMITTERS = [
  'platform/alarms/outOfWindowNotice.ts',
  'platform/alarms/refusalNotice.ts',
  'platform/doseActivity/doseActivityScheduler.ts',
  'platform/doseActivity/doseActivitySurfaceService.ts',
  'features/_dev/devAlarmTriggers.ts',
  'features/_dev/devTitrationTriggers.ts',
  'features/_dev/devNotificationPermissions.ts',
]

// Server: o Expo não suporta Critical Alerts — push remoto fica fora (Slice 2 condicional).
const SERVER_FORBIDDEN = ['server/notifications/channels/expoPushChannel.ts']

// Qualquer forma de pedir o modo crítico ao SO, comentada ou não (grep ingênuo deu falso hit — C-6).
const CRITICAL_PATTERNS = [/critical\s*:\s*true/, /criticalVolume/, /interruptionLevel\s*:\s*['"(]*critical/]

const read = (path: string) => readFileSync(path, 'utf8')
const hits = (src: string) => CRITICAL_PATTERNS.filter((re) => re.test(src)).map(String)

describe('contrato: emissores de Critical Alerts (054 PO-4)', () => {
  it('inventário não vazio', () => {
    expect(FORBIDDEN_EMITTERS.length).toBeGreaterThan(0)
    expect(SERVER_FORBIDDEN.length).toBeGreaterThan(0)
  })

  it.each(FORBIDDEN_EMITTERS)('%s não emite crítico', (rel) => {
    expect(hits(read(join(MOBILE_SRC, rel)))).toEqual([])
  })

  it.each(SERVER_FORBIDDEN)('%s (server) não emite crítico', (rel) => {
    expect(hits(read(join(REPO_ROOT, rel)))).toEqual([])
  })

  it('o único emissor (alarmService) emite — e só via buildNotification condicionado', () => {
    const src = read(join(MOBILE_SRC, EMITTER_ALLOWED))
    expect(src).toMatch(/critical\s*\?\s*\{\s*critical:\s*true,\s*criticalVolume:\s*CRITICAL_VOLUME\s*\}/)
    // Uma ocorrência só: nenhum outro ponto do arquivo monta o bloco crítico.
    expect(src.match(/criticalVolume:/g)).toHaveLength(1)
  })
})
