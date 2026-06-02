# Release Notes — Mobile v0.8.0

**Data:** 2026-06-02
**Plataforma:** Mobile (iOS / Android — EAS)
**Tipo:** Minor (release de loja)
**versionCode/buildNumber:** 800
**Última versão publicada:** v0.6.2 (esta build acumula 0.6.3 → 0.8.0)
**Status:** Pré-merge (PR #630) — fecha a Fase 4

Esta é a maior atualização do Dosiq desde a v0.6.2. Ela acumula toda a Fase 4:
uma agenda do dia que mostra o que realmente aconteceu com cada dose, lembretes
que não somem na virada do dia, e suporte completo a fuso horário (inclusive para
quem viaja ou se muda). O foco foi **confiança** — você ver, sem dúvida, o que já
tomou, o que ficou para trás e o que ainda vem.

---

## 📱 Texto para as lojas (copiar/colar)

### "Novidades desta versão" — curto (recomendado)

> Esta atualização deixa a sua agenda de doses muito mais confiável:
>
> • **Você enxerga o que importa:** cada dose mostra se foi tomada, perdida ou
>   está pendente — sem confusão na virada da meia-noite.
> • **Nada cai no esquecimento:** doses atrasadas de ontem e as de amanhã que já
>   estão chegando aparecem destacadas, ainda no prazo.
> • **No seu horário:** a agenda passa a seguir o seu fuso horário. Viajou ou
>   mudou de cidade? O app pergunta se quer manter os horários de casa ou usar os
>   horários novos.
> • **Mais rápido:** registre várias doses de uma vez.
> • **Mais tipos de remédio:** melhor suporte medicamentos que não são comprimidos.
> • Cálculo de adesão mais fiel à sua rotina.

### Versão enxuta (limite ~500 caracteres — Play "O que há de novo")

> A sua agenda de doses ficou mais confiável: cada dose mostra se foi tomada,
> perdida ou está pendente, e as doses atrasadas de ontem ou as de amanhã ainda no
> prazo aparecem destacadas. A agenda agora segue o seu fuso horário — e, se você
> viajar ou se mudar, o app pergunta se quer manter os horários de casa ou usar os
> novos. Também ficou mais rápido registrar várias doses de uma vez, com melhor
> suporte a medicamentos que não são comprimidos.

---

## ✨ O que muda para você

### Você confia no que vê
- Cada dose mostra o estado real — **tomada, perdida ou pendente** — em vez de
  adivinhar pelo horário.
- Acabou a "dose fantasma" na virada da meia-noite: uma dose da noite registrada
  depois das 00h fica no dia certo.
- O resumo de adesão e a sequência (streak) ficaram mais fiéis à sua rotina.

### Nada cai no esquecimento na virada do dia
- **Pendências de ontem:** doses atrasadas, mas ainda dentro do prazo, continuam
  visíveis em vez de sumirem à meia-noite.
- **Em breve:** doses de amanhã que já estão chegando aparecem no fim da agenda.

### A agenda no seu horário
- O Dosiq passa a seguir o **seu fuso horário** (detectado ao criar a conta; quem
  já usa pode ajustar nas Configurações).
- **Viagem ou mudança:** ao trocar o fuso com doses agendadas, o app pergunta:
  - *Estou aqui só de viagem* — mantém os horários originais das suas doses, só
    mostrando no horário local.
  - *Me mudei* — passa todas as doses futuras para o horário do novo lugar.

### Registrar ficou mais rápido
- A dose prioritária registra **todas as doses do momento de uma vez**, com uma
  única confirmação.

### Mais tipos de medicamento
- Melhor suporte a remédios que não são comprimidos (inaladores, adesivos,
  pomadas), com a unidade genérica "un.".
- Termos mais claros no cadastro ("Concentração") e um aviso ao configurar
  dosagens que podem confundir.

---

## 🔧 Notas técnicas (interno)

Faixa acumulada **0.6.3 → 0.8.0** (último publicado: 0.6.2):

| Versão | PR | Tema |
|---|---|---|
| 0.6.4 | F3.3 | Adesão ← `dose_instances` + âncora de registro (AP-193) |
| 0.6.5 | F4.3b | Timeline do Hoje ← `dose_instances` (estado real, fim do slot-fantasma) |
| 0.6.6 | F4.3c | Registro individual ancora direto na ocorrência |
| 0.7.0 | F4.3d | Dose prioritária registra todas de uma vez (bulk por `instance_id`) |
| 0.7.1 | F4.3e | Carry-over cross-dia ("Pendências de ontem" / "Em breve") |
| 0.7.2 | F4.3f.0 | Captura de fuso no signup + convite no Perfil |
| 0.7.3 | F4.3f.1 | "Hoje" no fuso do perfil |
| 0.8.0 | F4.3f.2 | Troca de fuso: viagem × mudança + regen das doses |

Itens de suporte a unidade genérica/"Concentração"/aviso (PR #601) também entram
nesta primeira publicação pós-0.6.2.

- Base materializada `dose_instances` (ADR-048/050/053/054); fuso fonte de verdade
  em `user_settings.timezone` (ADR-049).
- Sem dependência nativa nova (fuso via `Intl`/Hermes, não `expo-localization`).
- F4.3f.2: `TzIntentSheet` (R-233) + `regenActiveProtocolsForTz` (re-ancora o
  wall-clock no fuso novo; best-effort R-231/245/246; nunca toca passado, AP-203).

## ✅ Validação
- `npm run validate:agent` verde (1102/1102) na entrega da F4.3f.2.
- Smoke PO em dev: viagem (web+mobile) e "me mudei → Londres" (DB confirmado:
  re-ancoragem BST, passadas intactas).

## 📎 Relacionados
- [`../../CHANGELOG.md`](../../CHANGELOG.md) — seção Mobile [Unreleased]
- PR #630 · #629 (F4.3f.1) · #628 (F4.3f.0)
