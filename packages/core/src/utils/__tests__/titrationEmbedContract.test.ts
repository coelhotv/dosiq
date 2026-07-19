// 052 (G1/PO-2) — CONTRATO DE EMBED: todo select que alimenta o gerador com a escada precisa
// trazer `medicine_id` da etapa.
//
// 🔴 Por que este teste existe (AP-300 + AP-301). O `medicine_id` da instância é congelado a
// partir do STEP vigente. Um select do PostgREST é uma STRING: adicionar o campo ao
// `TitrationStepLike` e esquecer de adicioná-lo a um embed não quebra o tsc, não quebra o lint e
// não quebra nenhum teste com client mockado — em runtime o campo chega `undefined`, o gerador
// cai no fallback e a instância congela o medicamento do PROTOCOLO. Ou seja: o bug que a spec
// existe para matar, de volta, em silêncio, só naquele caminho de escrita.
//
// Esta é a mesma classe do AP-301 (writer esquecido) e a razão pela qual o inventário de writers
// é obrigatório: o defeito não mora em nenhum arquivo errado, mora no VÃO entre eles. Então o
// guard tem que ser sobre o CONJUNTO, não sobre um arquivo — daí a varredura de fonte.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '../../../../..')

/**
 * Selects que injetam a escada no gerador de dose_instances (os 5 caminhos de escrita do
 * inventário PO-2 + o resync do cron). Um caminho novo entra aqui NA MESMA PR que o cria.
 */
const EMBEDS_QUE_ALIMENTAM_O_GERADOR = [
  'packages/core/src/repositories/createProtocolRepository.ts',
  'packages/core/src/services/timezoneRegen.ts',
  'server/bot/doseInstanceScheduler.ts',
  'server/bot/_reminderHelpers.ts',
  'apps/mobile/src/features/treatments/services/titrationService.ts',
  'apps/mobile/src/features/dashboard/services/dashboardService.ts',
]

/** Extrai o miolo de cada embed `titration_steps(...)` do arquivo. */
function embedsDe(fonte: string): string[] {
  return [...fonte.matchAll(/titration_steps\(([^)]*)\)/g)].map((m) => m[1])
}

describe('contrato de embed da escada — medicine_id (052 G1)', () => {
  it.each(EMBEDS_QUE_ALIMENTAM_O_GERADOR)('%s traz medicine_id no embed titration_steps', (arquivo) => {
    const fonte = readFileSync(resolve(REPO_ROOT, arquivo), 'utf8')
    const embeds = embedsDe(fonte)

    // Sanidade: se o embed sumiu do arquivo, o teste não pode passar por vacuidade — seria
    // exatamente o falso-verde que o AP-279 descreve.
    expect(embeds.length).toBeGreaterThan(0)

    // Só os embeds que carregam a DOSE alimentam o gerador; os demais (ex.: contagem de etapas
    // para badge) não precisam do medicamento. Onde vai a dose, vai o medicamento — é o par que
    // a spec inteira defende.
    const embedsDoGerador = embeds.filter((e) => /\bdose\b/.test(e))
    expect(embedsDoGerador.length).toBeGreaterThan(0)
    for (const embed of embedsDoGerador) {
      expect(embed).toContain('medicine_id')
    }
  })
})
