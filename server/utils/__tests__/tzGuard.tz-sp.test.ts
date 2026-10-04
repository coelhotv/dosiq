import { describe, it, expect } from 'vitest';

// Spec 077 FR-008: o passo -03 do validate:agent só prova algo se o processo estiver de fato em
// America/Sao_Paulo. Sem esta guarda o passo pode rodar em UTC e passar em falso (RC3 E-2).
// O marcador vem do MESMO `test.env` que o TZ: config carregado com fuso que não pegou (ex.: pool
// threads) fica vermelho; nos outros configs (critical, dev, ci) o arquivo é pulado.
describe.runIf(process.env.DOSIQ_TZ_SP_STEP === '1')('passo -03 (vitest.tz-sp.config.js)', () => {
  it('processo roda em America/Sao_Paulo, offset -03', () => {
    expect(process.env.TZ).toBe('America/Sao_Paulo');
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Sao_Paulo');
    expect(new Date(Date.UTC(2026, 8, 1, 12)).getTimezoneOffset()).toBe(180);
  });
});
