import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.base.config.js'

/**
 * Passo -03 do validate:agent (spec 077, FR-006/FR-008).
 *
 * A suíte inteira roda em UTC (vitest.base.config.js) porque a produção roda em UTC. Isso esconde
 * leitura UTC de uma Date de parede: em UTC getters locais ≡ getters UTC. Este passo reexecuta os
 * testes de dia/hora sob America/Sao_Paulo, onde a diferença aparece (AP-342).
 *
 * `tzGuard.tz-sp.test.ts` asserta o fuso do processo — sem ele o passo pode rodar em UTC e passar
 * em falso; ele só roda com `DOSIQ_TZ_SP_STEP=1` (definido aqui), e é pulado nos outros configs.
 *
 * Herda o base, NÃO o critical: o mergeConfig CONCATENA `exclude`, e o critical exclui
 * os `components/` de `src/features` (o teste do EmergencyQRCode sumiria em silêncio).
 * `pool: 'forks'` é obrigatório: `test.env.TZ` só muda o fuso num processo próprio — em worker
 * thread o processo segue no fuso do shell (medido 2026-10-04: vitest.config.js, pool threads,
 * reporta TZ=UTC e roda com offset 180).
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      env: { TZ: 'America/Sao_Paulo', DOSIQ_TZ_SP_STEP: '1' },
      pool: 'forks',
      fileParallelism: false,
      reporters: ['dot'],
      include: [
        '../../server/utils/__tests__/tzGuard.tz-sp.test.ts',
        '../../server/utils/__tests__/dateUtils.test.ts',
        'src/features/adherence/services/__tests__/adherencePatternService.test.ts',
        'src/features/emergency/components/__tests__/EmergencyQRCode.test.tsx',
      ],
      cache: { dir: '.vitest-cache-tz-sp' },
    },
  }),
)
