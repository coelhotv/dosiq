import { describe, it, expect } from 'vitest';
import { buildNotificationPayload } from '../buildNotificationPayload';

describe('buildNotificationPayload', () => {

  describe('daily_digest', () => {
    it('should generate rich body for Telegram and plain body for Push', () => {
      const data = {
        firstName: 'Antonio Coelho',
        hour: 16,
        pendingCount: 1,
        medicines: [{ name: 'Ansitec', time: '11:45', dosage: '1 mg' }]
      };

      const payload = buildNotificationPayload({ kind: 'daily_digest', data });

      // Verificação Rich (Telegram)
      expect(payload.body).toContain('*Antonio Coelho*');
      expect(payload.body).toContain('\\!'); // Escapado para MarkdownV2 (JSON string representation)
      // Note: in Vitest, we check the actual string content.
      // Since buildNotificationPayload uses template literals with \\!, the string has literal \!
      expect(payload.body).toMatch(/Antonio Coelho\*/);
      expect(payload.body).toContain('\n\n'); // Newlines reais

      // Verificação Plain (Push)
      expect(payload.pushBody).not.toContain('*');
      expect(payload.pushBody).not.toContain('\\!');
      expect(payload.pushBody).toContain('Antonio Coelho!');
      expect(payload.pushBody).toContain('\n'); // Verificamos que contém ao menos uma quebra de linha
    });

    // 012 Fase D (FR-015b): dose líquida no digest via formatters core (R-272) —
    // unidade de tomada real + case canônico, nunca "1 un." lossy.
    it('should render liquid dose with canonical intake unit (UI), not "1 un."', () => {
      const data = {
        firstName: 'Maria',
        hour: 8,
        pendingCount: 1,
        medicines: [{
          name: 'Lantus', time: '12:00',
          dosagePerIntake: 10, intakeUnit: 'UI',
          dosageUnit: 'ui/ml', dosagePerPill: 100, unitsPerMl: 100
        }]
      };
      const payload = buildNotificationPayload({ kind: 'daily_digest', data });
      expect(payload.pushBody).toContain('10 UI');
      expect(payload.pushBody).not.toContain('1 un.');
      expect(payload.pushBody).not.toContain('10 ui'); // case canônico
    });

    it('should render solid dose via active-ingredient hint, not crashing', () => {
      const data = {
        firstName: 'Ana', hour: 8, pendingCount: 1,
        medicines: [{
          name: 'Dipirona', time: '09:00',
          dosagePerIntake: 2, dosageUnit: 'mg', dosagePerPill: 500
        }]
      };
      const payload = buildNotificationPayload({ kind: 'daily_digest', data });
      expect(payload.pushBody).toContain('Dipirona');
      expect(payload.pushBody).toContain('09:00');
    });

    it('should omit dosage when dosagePerIntake is absent (guard)', () => {
      const data = {
        firstName: 'Caio', hour: 8, pendingCount: 1,
        medicines: [{ name: 'Omega 3', time: '07:00' }]
      };
      const payload = buildNotificationPayload({ kind: 'daily_digest', data });
      expect(payload.pushBody).toContain('Omega 3');
      expect(payload.pushBody).not.toContain('()');
    });

    it('should handle zero pending doses correctly', () => {
      const data = {
        firstName: 'Caio',
        hour: 8,
        pendingCount: 0,
        medicines: []
      };

      const payload = buildNotificationPayload({ kind: 'daily_digest', data });
      expect(payload.pushBody).toContain('Você está em dia');
      expect(payload.pushBody).not.toContain('\\!');
    });
  });

  describe('adherence_report', () => {
    it('should generate dual formats for adherence report', () => {
      const data = {
        firstName: 'Antonio',
        period: 'hoje',
        percentage: 85,
        taken: 6,
        total: 7,
        storytelling: 'Melhor que ontem!'
      };

      const payload = buildNotificationPayload({ kind: 'adherence_report', data });

      expect(payload.body).toContain('*Antonio*');
      expect(payload.body).toContain('*85%*');
      expect(payload.body).toContain('✅ *6* de *7*');
      
      expect(payload.pushBody).toContain('Olá, Antonio!');
      expect(payload.pushBody).toContain('adesão hoje foi de 85%');
      expect(payload.pushBody).toContain('✅ 6 de 7');
      expect(payload.pushBody).not.toContain('*');
    });
  });

  describe('dose_reminder', () => {
    it('should generate clean push body for single dose without dosage', () => {
      const data = {
        medicineName: 'Omega 3',
        time: '12:00'
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      expect(payload.body).toContain('*Omega 3*');
      expect(payload.pushBody).toBe('Está na hora de tomar Omega 3 — 12:00');
    });

    it('should include dosage if provided', () => {
      const data = {
        medicineName: 'Omega 3 1200mg',
        time: '12:00',
        dosage: '3 cp'
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      expect(payload.body).toContain('*Omega 3 1200mg*');
      expect(payload.body).toContain('• **3 cp**');
      expect(payload.pushBody).toBe('Está na hora de tomar Omega 3 1200mg • 3 cp — 12:00');
    });

    it('should derive dosage from dosagePerIntake for normal single dose', () => {
      const data = {
        medicineName: 'Ansitec',
        time: '18:00',
        dosagePerIntake: 1.5,
        critical_alarm: false
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      expect(payload.pushBody).toBe('Está na hora de tomar Ansitec • 1,5 un. — 18:00');
      expect(payload.body).toContain('Está na hora de tomar *Ansitec • 1,5 un\\.* — 18:00');
    });

    it('should generate clinical description name (dosageperpill unit) - qty un. for single dose', () => {
      const data = {
        medicineName: 'Dipirona',
        time: '12:00',
        dosagePerIntake: 2,
        dosagePerPill: 500,
        dosageUnit: 'mg',
        critical_alarm: true
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder', data });
      expect(payload.title).toBe('💊 Remédio essencial');
      expect(payload.pushBody).toBe('Hora de tomar Dipirona (500 mg) • 2 un. — 12:00');
      expect(payload.body).toContain('Hora de tomar *Dipirona \\(500 mg\\) • 2 un\\.* — 12:00');
    });
  });

  describe('dose_reminder_by_plan', () => {
    it('should generate legacy rich body and push body for normal plan', () => {
      const data = {
        planName: 'Protocolo VIP',
        planId: 'plan_123',
        scheduledTime: '09:00',
        hour: 9,
        doses: [
          { medicineName: 'Med A', dosagePerIntake: 1 },
          { medicineName: 'Med B', dosagePerIntake: 2 }
        ],
        critical_alarm: false
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_by_plan', data });
      
      expect(payload.body).toContain('*Protocolo VIP*');
      expect(payload.body).toContain('2 remédios agora');
      expect(payload.body).toContain('Med A • 1 un\\.');
      expect(payload.body).toContain('Med B • 2 un\\.');
      expect(payload.pushBody).toBe('Está na hora do plano Protocolo VIP — 09:00.\n– Med A • 1 un.\n– Med B • 2 un.');
      expect(payload.actions).toHaveLength(1);
      expect(payload.actions[0].id).toBe('take_plan');
    });

    it('should generate clinical body and push body for critical plan', () => {
      const data = {
        planName: 'Protocolo VIP',
        planId: 'plan_123',
        scheduledTime: '09:00',
        hour: 9,
        doses: [
          { medicineName: 'Med A', dosagePerIntake: 1, dosagePerPill: 500, dosageUnit: 'mg' },
          { medicineName: 'Med B', dosagePerIntake: 2, dosagePerPill: 10, dosageUnit: 'ml' }
        ],
        critical_alarm: true
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_by_plan', data });
      
      expect(payload.title).toBe('📂 Plano essencial');
      expect(payload.body).toContain('Hora dos remédios de *Protocolo VIP* — 09:00\\.');
      expect(payload.body).toContain('Med A \\(500 mg\\) • 1 un\\.');
      expect(payload.body).toContain('Med B \\(10 ml\\) • 2 un\\.');
      expect(payload.pushBody).toBe('Hora dos remédios de Protocolo VIP — 09:00.\n– Med A (500 mg) • 1 un.\n– Med B (10 ml) • 2 un.');
    });
  });

  describe('dose_reminder_misc', () => {
    it('should generate legacy body and push body for normal misc doses', () => {
      const data = {
        scheduledTime: '22:00',
        hour: 22,
        doses: [
          { medicineName: 'Med X', dosagePerIntake: 1.5 }
        ],
        critical_alarm: false
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_misc', data });
      
      expect(payload.body).toContain('*Suas doses agora*');
      expect(payload.body).toContain('1 remédio pendente');
      expect(payload.body).toContain('Med X • 1,5 un\\.');
      expect(payload.pushBody).toBe('1 remédio pendente — 22:00:\n– Med X • 1,5 un.');
      expect(payload.actions[0].id).toBe('take_misc');
    });

    it('should generate clinical body and push body for critical misc doses', () => {
      const data = {
        scheduledTime: '22:00',
        hour: 22,
        doses: [
          { medicineName: 'Med X', dosagePerIntake: 1.5, dosagePerPill: 20, dosageUnit: 'mg' }
        ],
        critical_alarm: true
      };

      const payload = buildNotificationPayload({ kind: 'dose_reminder_misc', data });
      
      expect(payload.title).toBe('📋 Doses essenciais');
      expect(payload.body).toContain('Remédios essenciais agora — *22:00*\\.');
      expect(payload.body).toContain('Med X \\(20 mg\\) • 1,5 un\\.');
      expect(payload.pushBody).toBe('Remédios essenciais agora — 22:00:\n– Med X (20 mg) • 1,5 un.');
    });
  });

  // 012 Fase B2 (FR-021): titulação N1 — etapa cross-força vira CTA de troca.
  // 029 F5 (T025 / FR-004): copy da Evolução do tratamento, dirigida por `transition`.
  // Substitui a copy legada do 012/FR-021, que dizia "caneta" (proibido — §0/§8) e chamava a
  // entidade de "Titulação" (o naming é "Evolução do tratamento").
  describe('titration_alert (Evolução do tratamento — copy §8)', () => {
    const base = {
      medicineName: 'Semaglutida 0,5 mg',
      currentStage: 2,
      totalStages: 3,
    };

    it('medicine_switch → "Etapa N começa hoje" + as 2 ações do card do Hoje', () => {
      const payload = buildNotificationPayload({
        kind: 'titration_alert',
        data: { ...base, transition: 'medicine_switch', stepId: 'step-uuid', dose: 0.5, intakeUnit: 'mg' },
      });
      expect(payload.title).toBe('Etapa 2 começa hoje');
      expect(payload.pushBody).toContain('Semaglutida 0,5 mg');
      expect(payload.pushBody).toContain('Como prescrito pelo seu médico.');
      expect(payload.actions).toEqual([
        { id: 'start_step', label: 'Iniciar etapa', params: { stepId: 'step-uuid' } },
        { id: 'not_yet', label: 'Ainda não', params: { stepId: 'step-uuid' } },
      ]);
    });

    it('medicine_switch SEM stepId → sai sem botão (ação sem alvo falharia no toque)', () => {
      const payload = buildNotificationPayload({
        kind: 'titration_alert',
        data: { ...base, transition: 'medicine_switch' },
      });
      expect(payload.actions).toEqual([]);
    });

    it('dose_change → informativo, SEM botões, dose em pt-BR (§3.4)', () => {
      const payload = buildNotificationPayload({
        kind: 'titration_alert',
        data: { ...base, medicineName: 'Metoprolol 50 mg', transition: 'dose_change', dose: 2, intakeUnit: 'cp' },
      });
      expect(payload.title).toBe('Dose ajustada para 2 comprimidos');
      expect(payload.pushBody).toContain('etapa 2 de 3 da evolução do tratamento, como prescrito.');
      expect(payload.pushBody).toContain('Os lembretes já estão na dose nova.');
      expect(payload.actions).toEqual([]);
    });

    it('dose_change de 1 comprimido → singular', () => {
      const payload = buildNotificationPayload({
        kind: 'titration_alert',
        data: { ...base, transition: 'dose_change', dose: 1, intakeUnit: 'cp' },
      });
      expect(payload.title).toBe('Dose ajustada para 1 comprimido');
    });

    it('target_reached → conclusão factual, sem ações', () => {
      const payload = buildNotificationPayload({
        kind: 'titration_alert',
        data: { ...base, transition: 'target_reached' },
      });
      expect(payload.title).toBe('Evolução do tratamento concluída');
      expect(payload.pushBody).toContain('última etapa prescrita');
      expect(payload.actions).toEqual([]);
    });

    it('SaMD/§8: nunca "caneta", "Titulação" nem "recomendada" em nenhuma transição', () => {
      const proibidos = /caneta|Titula[çc]|recomendad/i;
      for (const transition of ['medicine_switch', 'dose_change', 'target_reached'] as const) {
        const payload = buildNotificationPayload({
          kind: 'titration_alert',
          data: { ...base, transition, dose: 2, intakeUnit: 'cp', stepId: 's' },
        });
        expect(payload.title).not.toMatch(proibidos);
        expect(payload.pushBody).not.toMatch(proibidos);
      }
    });

    // R-193: payload já enfileirado no outbox no momento do deploy não tem `transition`.
    it('compat de outbox: par N1 legado ainda produz a copy nova certa', () => {
      const legadoSwitch = buildNotificationPayload({
        kind: 'titration_alert',
        data: { ...base, status: 'titulando', requiresNewMedicine: true },
      });
      expect(legadoSwitch.title).toBe('Etapa 2 começa hoje');

      const legadoAlvo = buildNotificationPayload({
        kind: 'titration_alert',
        data: { ...base, status: 'alvo_atingido' },
      });
      expect(legadoAlvo.title).toBe('Evolução do tratamento concluída');
    });
  });
});

describe('consent_prune_notice — copy neutra (046 T013d / S8)', () => {
  const build = (data: any) => buildNotificationPayload({ kind: 'consent_prune_notice', data })

  it('não vaza saúde por metadado: nem título, nem preview, nem corpo', () => {
    const p = build({ stage: 'd60', daysLeft: 30 })
    const superficiesVisiveis = `${p.title} ${p.pushBody} ${p.body}`.toLowerCase()
    // A tela de bloqueio mostra título + pushBody a quem estiver olhando o celular por cima do
    // ombro. Nenhuma dessas palavras pode aparecer ali — nem "medicamento" sozinha.
    for (const termo of ['medicament', 'dose', 'remédio', 'tratamento', 'adesão', 'mg', 'comprimido']) {
      expect(superficiesVisiveis).not.toContain(termo)
    }
  })

  it('diz o prazo e o que fazer', () => {
    const p = build({ stage: 'd83', daysLeft: 7 })
    expect(p.title).toBe('Sua conta precisa de uma ação')
    expect(p.pushBody).toContain('7 dias')
    expect(p.pushBody).toContain('autorize novamente')
    expect(p.deeplink).toBe('dosiq://settings/privacy')
  })

  it('singulariza o último dia', () => {
    expect(build({ stage: 'd83', daysLeft: 1 }).pushBody).toContain('em 1 dia.')
  })

  it('rejeita payload degenerado em vez de enviar um aviso sem prazo', () => {
    expect(() => build({ stage: 'd60', daysLeft: 0 })).toThrow()
    expect(() => build({ stage: 'd60' })).toThrow()
    expect(() => build({ stage: 'qualquer', daysLeft: 5 })).toThrow()
  })
})

