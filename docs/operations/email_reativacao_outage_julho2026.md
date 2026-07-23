---
title: "Template de E-mail de Reativação (pós-outage 22/07/2026)"
description: "4 variantes HTML/CSS inline (iOS, Android whitelist, neutro, ativação-primeira-vez) para reengajar usuários dormentes/desatualizados após o outage do 029 F6 (ADR-088/AP-314), com destaque para features recentes."
version: "1.0.0"
status: active
category: operation
audience:
  - ops
  - growth
tags:
  - email
  - reativacao
  - outage
  - ios
  - android
created_at: "2026-07-22"
updated_at: "2026-07-22"
---

# Template de E-mail de Reativação (pós-outage 22/07/2026)

Mesmo fluxo de envio do `email_boas_vindas.md` (colar no Gmail via inspect-element + salvar como
template/canned response pra reenvio manual).

**Contexto (ver ADR-088 / AP-314):** outage em 22/07 afetou instalações com app <0.28 (`42703` em
`titration_status`, dropado no 029 F6). **Já corrigido no servidor** (colunas restauradas inertes) —
quem tem o app desatualizado voltou a funcionar **sem precisar atualizar nada**. Por isso a copy
não promete "atualize e o bug some": ele já sumiu. O gancho de update é preventivo (evitar recorrência)
e ganhar acesso às novidades.

**Segmentação (ver conversa 2026-07-22, scratch/):**
- **iOS**: `platform='ios'` conhecido em `notification_devices` → Variante 1
- **Android whitelist**: email em `beta_signups WHERE feature='android'` → Variante 2
- **Neutro**: tem uso real (`protocols`/`medicine_logs` > 0) mas platform desconhecido — Android é
  **impossível** pra quem não está na whitelist (closed alpha), então na prática é web ou iOS sem
  push; a copy não afirma qual → Variante 3 (CTA iOS única, tom "atualiza que tem coisa nova")
- **Ativação (churn total)**: zero `protocols`/`medicine_logs` — nunca cadastrou nada, nunca teve
  "primeira vez" de fato → Variante 4 (sem menção a outage, CTA web + iOS)

**Compliance (envio manual, sem infra de unsubscribe):** volume baixo, fora da exigência de
`List-Unsubscribe` do Google (só >5000/dia). Opt-out por resposta ao email substitui link técnico —
texto explícito no rodapé de cada variante.

> [!IMPORTANT]
> Antes de enviar a variante Android: confirmar que o destinatário está em `beta_signups`
> (`feature='android'`) — link do closed testing quebra pra quem não está na lista.

---

## Bloco de features (comum às 3 variantes)

Narrativa consolidada (1+4+6+7 do CHANGELOG) + IA + estoque opcional. Enquadramento ADR-062/SaMD
respeitado: médico é sempre a origem da decisão, o app nunca sugere/calcula/recomenda dose.

---

## Variante 1 — iOS

**Subject:**
```
dosiq: o que mudou desde sua última atualização
```

```html
<!-- Fragmento HTML Limpo para Gmail - Início (iOS) -->
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; width: 100% !important;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; padding: 0 16px;">

        <!-- Header (Logo) -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <a href="https://dosiq.app" target="_blank" style="text-decoration: none; display: inline-block;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="https://dosiq.app/dosiq-logo-verde.png" alt="Dosiq Logo" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 50%; border: 0;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; color: #006a5e; letter-spacing: -0.5px; line-height: 44px; display: inline-block;">dosiq</span>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>

        <!-- Card de Conteúdo Principal -->
        <tr>
          <td style="background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -2px rgba(0, 0, 0, 0.01);">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Introdução + nota do outage -->
              <tr>
                <td style="color: #334155; font-size: 16px; line-height: 26px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Olá! Tudo bem?</p>
                  <p style="margin: 0 0 16px 0;">No dia 22/07 tivemos uma instabilidade em produção que afetou quem estava com o app numa versão desatualizada: as abas Hoje e Tratamentos podiam travar mostrando "Cache expirado" mesmo com internet normal.</p>
                  <p style="margin: 0 0 16px 0;"><strong>Já identificamos e corrigimos o problema do nosso lado.</strong> Se isso aconteceu com você, já deve estar tudo normal de novo — sem precisar fazer nada. Mesmo assim, manter o app sempre atualizado é a melhor forma de evitar esse tipo de situação no futuro, então aproveito pra te contar o que mudou desde a última vez que você deu uma olhada no dosiq.</p>
                </td>
              </tr>

              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ O que chegou nos últimos meses:
                </td>
              </tr>

              <!-- Grid de Features -->
              <tr>
                <td style="padding-bottom: 28px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">

                    <!-- Feature 1 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💉 Tratamento completo para GLP-1, insulina e injetáveis</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Canetas e injetáveis (Ozempic, Mounjaro, Wegovy, insulina) com dose certa e controle de validade após aberto. A escada de doses que seu médico prescreveu fica registrada no app, que avisa quando chega a hora de avançar — sempre seguindo o que foi prescrito, nunca sugerindo. E a dose crítica agora fica sempre visível: Live Activity e Dynamic Island direto na tela de bloqueio, com quanto falta e registro em 1 toque.</span>
                      </td>
                    </tr>

                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <!-- Feature 2 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💬 Assistente IA no app</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Tire dúvidas sobre suas doses, adesão e estoque direto no app, a qualquer hora — com o contexto do seu tratamento.</span>
                      </td>
                    </tr>

                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <!-- Feature 3 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">⚡ Controle de estoque virou opcional</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Só quer registrar as doses? Pule caixas, quantidades e compras — o cadastro ficou bem mais rápido. Quer acompanhar o estoque? Continua tudo lá, ligue ou desligue quando quiser.</span>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- CTA: App Store Badge Clicável -->
              <tr>
                <td align="center" style="padding-top: 8px; padding-bottom: 20px; border-top: 1px solid #e2e8f0;">
                  <table border="0" cellpadding="0" cellspacing="0" style="padding-top: 24px;">
                    <tr>
                      <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: center;">Atualize o dosiq na App Store:</p>
                        <a href="https://apps.apple.com/br/app/dosiq-inteligencia-em-doses/id6762740948" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/download-ios.png" alt="Disponível na App Store" width="180" style="display: block; width: 180px; height: auto; border: 0;" />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Encerramento -->
              <tr>
                <td style="color: #475569; font-size: 15px; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 12px;">
                  <p style="margin: 0;">Qualquer dúvida, feedback ou ideia, é só responder direto a este e-mail — leio e respondo pessoalmente cada mensagem.</p>
                  <p style="margin: 20px 0 0 0; font-weight: 600; color: #0f172a;">Com carinho,</p>
                  <p style="margin: 4px 0 0 0; font-weight: 700; color: #006a5e; font-size: 16px;">Time Dosiq</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td align="center" style="padding-top: 28px; padding-bottom: 10px; color: #64748b; font-size: 12px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque se cadastrou na lista do Dosiq.</p>
            <p style="margin: 0 0 12px 0;">Se preferir não receber mais novidades, é só responder este e-mail com "sair" que eu removo você da lista manualmente.</p>
            <p style="margin: 0 0 12px 0;">Dosiq — Desenvolvido para o bem comum.</p>
            <p style="margin: 0;">
              <a href="https://dosiq.app" target="_blank" style="color: #006a5e; text-decoration: none; font-weight: 600;">dosiq.app</a>
              <span style="color: #cbd5e1; padding: 0 8px;">•</span>
              <a href="mailto:contato@dosiq.app" style="color: #006a5e; text-decoration: none; font-weight: 600;">contato@dosiq.app</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!-- Fragmento HTML Limpo para Gmail - Fim (iOS) -->
```

---

## Variante 2 — Android (whitelist `beta_signups`)

**Subject:**
```
dosiq: o que mudou desde sua última atualização
```

```html
<!-- Fragmento HTML Limpo para Gmail - Início (Android) -->
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; width: 100% !important;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; padding: 0 16px;">

        <!-- Header (Logo) -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <a href="https://dosiq.app" target="_blank" style="text-decoration: none; display: inline-block;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="https://dosiq.app/dosiq-logo-verde.png" alt="Dosiq Logo" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 50%; border: 0;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; color: #006a5e; letter-spacing: -0.5px; line-height: 44px; display: inline-block;">dosiq</span>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>

        <!-- Card de Conteúdo Principal -->
        <tr>
          <td style="background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -2px rgba(0, 0, 0, 0.01);">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Introdução + nota do outage -->
              <tr>
                <td style="color: #334155; font-size: 16px; line-height: 26px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Olá! Tudo bem?</p>
                  <p style="margin: 0 0 16px 0;">No dia 22/07 tivemos uma instabilidade em produção que afetou quem estava com o app numa versão desatualizada: as abas Hoje e Tratamentos podiam travar mostrando "Cache expirado" mesmo com internet normal.</p>
                  <p style="margin: 0 0 16px 0;"><strong>Já identificamos e corrigimos o problema do nosso lado.</strong> Se isso aconteceu com você, já deve estar tudo normal de novo — sem precisar fazer nada. Mesmo assim, manter o app sempre atualizado é a melhor forma de evitar esse tipo de situação no futuro, então aproveito pra te contar o que mudou desde a última vez que você deu uma olhada no dosiq.</p>
                </td>
              </tr>

              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ O que chegou nos últimos meses:
                </td>
              </tr>

              <!-- Grid de Features -->
              <tr>
                <td style="padding-bottom: 28px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">

                    <!-- Feature 1 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💉 Tratamento completo para GLP-1, insulina e injetáveis</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Canetas e injetáveis (Ozempic, Mounjaro, Wegovy, insulina) com dose certa e controle de validade após aberto. A escada de doses que seu médico prescreveu fica registrada no app, que avisa quando chega a hora de avançar — sempre seguindo o que foi prescrito, nunca sugerindo. E a dose crítica agora fica sempre visível: notificação contínua na barra do Android, com quanto falta e registro em 1 toque.</span>
                      </td>
                    </tr>

                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <!-- Feature 2 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💬 Assistente IA no app</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Tire dúvidas sobre suas doses, adesão e estoque direto no app, a qualquer hora — com o contexto do seu tratamento.</span>
                      </td>
                    </tr>

                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <!-- Feature 3 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">⚡ Controle de estoque virou opcional</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Só quer registrar as doses? Pule caixas, quantidades e compras — o cadastro ficou bem mais rápido. Quer acompanhar o estoque? Continua tudo lá, ligue ou desligue quando quiser.</span>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- CTA: Google Play Badge Clicável -->
              <tr>
                <td align="center" style="padding-top: 8px; padding-bottom: 20px; border-top: 1px solid #e2e8f0;">
                  <table border="0" cellpadding="0" cellspacing="0" style="padding-top: 24px;">
                    <tr>
                      <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: center;">Atualize o dosiq no seu Android:</p>
                        <a href="https://play.google.com/store/apps/details?id=com.coelhotv.dosiq" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/download-android.png" alt="Disponível no Google Play" width="180" style="display: block; width: 180px; height: auto; border: 0;" />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Lembrete: closed testing exige mesma conta -->
              <tr>
                <td align="center" style="padding-bottom: 12px;">
                  <table border="0" cellpadding="10" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; width: 100%;">
                    <tr>
                      <td align="center" style="color: #166534; font-size: 13px; line-height: 18px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        💡 <strong>Lembrete:</strong> use a mesma conta Google/e-mail em que você foi cadastrado no teste fechado — outra conta não vai enxergar a atualização.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Encerramento -->
              <tr>
                <td style="color: #475569; font-size: 15px; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 12px;">
                  <p style="margin: 0;">Qualquer dúvida, feedback ou ideia, é só responder direto a este e-mail — leio e respondo pessoalmente cada mensagem.</p>
                  <p style="margin: 20px 0 0 0; font-weight: 600; color: #0f172a;">Com carinho,</p>
                  <p style="margin: 4px 0 0 0; font-weight: 700; color: #006a5e; font-size: 16px;">Time Dosiq</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td align="center" style="padding-top: 28px; padding-bottom: 10px; color: #64748b; font-size: 12px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque se cadastrou na lista do Dosiq.</p>
            <p style="margin: 0 0 12px 0;">Se preferir não receber mais novidades, é só responder este e-mail com "sair" que eu removo você da lista manualmente.</p>
            <p style="margin: 0 0 12px 0;">Dosiq — Desenvolvido para o bem comum.</p>
            <p style="margin: 0;">
              <a href="https://dosiq.app" target="_blank" style="color: #006a5e; text-decoration: none; font-weight: 600;">dosiq.app</a>
              <span style="color: #cbd5e1; padding: 0 8px;">•</span>
              <a href="mailto:contato@dosiq.app" style="color: #006a5e; text-decoration: none; font-weight: 600;">contato@dosiq.app</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!-- Fragmento HTML Limpo para Gmail - Fim (Android) -->
```

---

## Variante 3 — Neutra (fora do iOS conhecido e fora da whitelist Android)

**Subject:**
```
Faz tempo que você não dá uma olhada no dosiq
```

```html
<!-- Fragmento HTML Limpo para Gmail - Início (Neutra) -->
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; width: 100% !important;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; padding: 0 16px;">

        <!-- Header (Logo) -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <a href="https://dosiq.app" target="_blank" style="text-decoration: none; display: inline-block;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="https://dosiq.app/dosiq-logo-verde.png" alt="Dosiq Logo" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 50%; border: 0;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; color: #006a5e; letter-spacing: -0.5px; line-height: 44px; display: inline-block;">dosiq</span>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>

        <!-- Card de Conteúdo Principal -->
        <tr>
          <td style="background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -2px rgba(0, 0, 0, 0.01);">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Introdução -->
              <tr>
                <td style="color: #334155; font-size: 16px; line-height: 26px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Olá! Tudo bem?</p>
                  <p style="margin: 0 0 16px 0;">Faz um tempo que você não dá uma olhada no dosiq, e nesses últimos meses o app mudou bastante — vale a pena atualizar pra ver o que chegou de novo.</p>
                  <p style="margin: 0 0 16px 0;">De quebra: no dia 22/07 tivemos uma instabilidade em produção que afetou quem estava numa versão desatualizada do app (não a versão web). <strong>Já identificamos e corrigimos do nosso lado</strong> — se isso te afetou, já deve estar normal de novo, sem precisar fazer nada. Mas manter tudo atualizado é a melhor forma de evitar esse tipo de situação no futuro.</p>
                </td>
              </tr>

              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ Tem coisa nova esperando por você:
                </td>
              </tr>

              <!-- Grid de Features -->
              <tr>
                <td style="padding-bottom: 28px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">

                    <!-- Feature 1 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💉 Tratamento completo para GLP-1, insulina e injetáveis</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Canetas e injetáveis (Ozempic, Mounjaro, Wegovy, insulina) com dose certa e controle de validade após aberto. A escada de doses que seu médico prescreveu fica registrada no app, que avisa quando chega a hora de avançar — sempre seguindo o que foi prescrito, nunca sugerindo. E a dose crítica agora fica sempre visível, direto na tela de bloqueio, com quanto falta e registro em 1 toque.</span>
                      </td>
                    </tr>

                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <!-- Feature 2 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💬 Assistente IA no app</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Tire dúvidas sobre suas doses, adesão e estoque direto no app, a qualquer hora — com o contexto do seu tratamento.</span>
                      </td>
                    </tr>

                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <!-- Feature 3 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">⚡ Controle de estoque virou opcional</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Só quer registrar as doses? Pule caixas, quantidades e compras — o cadastro ficou bem mais rápido. Quer acompanhar o estoque? Continua tudo lá, ligue ou desligue quando quiser.</span>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- CTA: App Store Badge Clicável (único) -->
              <tr>
                <td align="center" style="padding-top: 8px; padding-bottom: 20px; border-top: 1px solid #e2e8f0;">
                  <table border="0" cellpadding="0" cellspacing="0" style="padding-top: 24px;">
                    <tr>
                      <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: center;">Atualize o dosiq na App Store:</p>
                        <a href="https://apps.apple.com/br/app/dosiq-inteligencia-em-doses/id6762740948" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/download-ios.png" alt="Disponível na App Store" width="180" style="display: block; width: 180px; height: auto; border: 0;" />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Encerramento -->
              <tr>
                <td style="color: #475569; font-size: 15px; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 12px;">
                  <p style="margin: 0;">Qualquer dúvida, feedback ou ideia, é só responder direto a este e-mail — leio e respondo pessoalmente cada mensagem.</p>
                  <p style="margin: 20px 0 0 0; font-weight: 600; color: #0f172a;">Com carinho,</p>
                  <p style="margin: 4px 0 0 0; font-weight: 700; color: #006a5e; font-size: 16px;">Time Dosiq</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td align="center" style="padding-top: 28px; padding-bottom: 10px; color: #64748b; font-size: 12px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque se cadastrou na lista do Dosiq.</p>
            <p style="margin: 0 0 12px 0;">Se preferir não receber mais novidades, é só responder este e-mail com "sair" que eu removo você da lista manualmente.</p>
            <p style="margin: 0 0 12px 0;">Dosiq — Desenvolvido para o bem comum.</p>
            <p style="margin: 0;">
              <a href="https://dosiq.app" target="_blank" style="color: #006a5e; text-decoration: none; font-weight: 600;">dosiq.app</a>
              <span style="color: #cbd5e1; padding: 0 8px;">•</span>
              <a href="mailto:contato@dosiq.app" style="color: #006a5e; text-decoration: none; font-weight: 600;">contato@dosiq.app</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!-- Fragmento HTML Limpo para Gmail - Fim (Neutra) -->
```

---

## Variante 4 — Ativação (churn total, nunca usou o produto)

Público: cadastro existe (`auth.users`), mas zero `protocols`/`medicine_logs` — nunca chegaram a
cadastrar um tratamento. **Diferente das outras 3**: não é "reativação" (não há "de volta" pra
alguém que nunca começou), não menciona o outage (não viveram isso, é ruído), não fala "desde a
última vez que você viu o app". É primeiro contato de verdade — mesmo espírito do
`email_boas_vindas.md`, adaptado pra quem já tem conta mas nunca deu o primeiro passo. CTA dupla:
**web primeiro** (zero fricção, sem loja, sem instalar nada) + iOS como alternativa.

**Subject:**
```
Seu dosiq está esperando seu primeiro tratamento
```

```html
<!-- Fragmento HTML Limpo para Gmail - Início (Ativação) -->
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; width: 100% !important;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; padding: 0 16px;">

        <!-- Header (Logo) -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <a href="https://dosiq.app" target="_blank" style="text-decoration: none; display: inline-block;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="https://dosiq.app/dosiq-logo-verde.png" alt="Dosiq Logo" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 50%; border: 0;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; color: #006a5e; letter-spacing: -0.5px; line-height: 44px; display: inline-block;">dosiq</span>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>

        <!-- Card de Conteúdo Principal -->
        <tr>
          <td style="background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -2px rgba(0, 0, 0, 0.01);">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Introdução -->
              <tr>
                <td style="color: #334155; font-size: 16px; line-height: 26px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Olá! Tudo bem?</p>
                  <p style="margin: 0 0 16px 0;">Você criou sua conta no dosiq, mas eu percebi que ainda não chegou a cadastrar nenhum tratamento — então talvez a gente nem tenha se apresentado direito ainda.</p>
                  <p style="margin: 0 0 16px 0;">Esquecer um horário, ficar na dúvida se já tomou a dose do dia, ou perceber que a cartela acabou na hora errada... Quem toma medicamentos sabe muito bem como essas pequenas preocupações pesam na rotina. O dosiq existe pra tirar esse peso de você — é grátis, sem anúncios, e leva menos de 2 minutos pra cadastrar seu primeiro tratamento.</p>
                </td>
              </tr>

              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ O que você vai encontrar:
                </td>
              </tr>

              <!-- Grid de Features -->
              <tr>
                <td style="padding-bottom: 28px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">

                    <!-- Feature 1 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💉 Tratamento completo, do simples ao complexo</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">De comprimido único a canetas e injetáveis (Ozempic, Mounjaro, Wegovy, insulina), com dose certa e controle de validade após aberto. Se seu médico prescreveu uma escada de doses, o app registra e avisa quando chega a hora de avançar — sempre seguindo o que foi prescrito, nunca sugerindo. E a dose crítica fica sempre visível, com quanto falta e registro em 1 toque.</span>
                      </td>
                    </tr>

                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <!-- Feature 2 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💬 Assistente IA</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Tire dúvidas sobre suas doses, adesão e estoque a qualquer hora — com o contexto do seu próprio tratamento.</span>
                      </td>
                    </tr>

                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <!-- Feature 3 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">⚡ Cadastro rápido, do seu jeito</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Só quer registrar as doses? Pule caixas, quantidades e compras — o cadastro fica bem mais rápido. Quer acompanhar o estoque também? Fica tudo lá, ligue ou desligue quando quiser.</span>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- CTA: Web (principal, zero fricção) -->
              <tr>
                <td align="center" style="padding-top: 8px; padding-bottom: 12px; border-top: 1px solid #e2e8f0;">
                  <table border="0" cellpadding="0" cellspacing="0" style="padding-top: 24px;">
                    <tr>
                      <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: center;">Comece agora, direto no navegador — sem precisar instalar nada:</p>
                        <a href="https://dosiq.app" target="_blank" style="text-decoration: none; display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); border-radius: 10px; padding: 14px 32px;">
                          <span style="color: #ffffff; font-size: 15px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Entrar no dosiq.app</span>
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA: iOS (alternativa) -->
              <tr>
                <td align="center" style="padding-top: 8px; padding-bottom: 20px;">
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; text-align: center;">Ou, se preferir, tem iPhone? Baixe o app:</p>
                        <a href="https://apps.apple.com/br/app/dosiq-inteligencia-em-doses/id6762740948" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/download-ios.png" alt="Disponível na App Store" width="160" style="display: block; width: 160px; height: auto; border: 0;" />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Encerramento -->
              <tr>
                <td style="color: #475569; font-size: 15px; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 12px;">
                  <p style="margin: 0;">Qualquer dúvida, feedback ou ideia, é só responder direto a este e-mail — leio e respondo pessoalmente cada mensagem.</p>
                  <p style="margin: 20px 0 0 0; font-weight: 600; color: #0f172a;">Com carinho,</p>
                  <p style="margin: 4px 0 0 0; font-weight: 700; color: #006a5e; font-size: 16px;">Time Dosiq</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td align="center" style="padding-top: 28px; padding-bottom: 10px; color: #64748b; font-size: 12px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque se cadastrou na lista do Dosiq.</p>
            <p style="margin: 0 0 12px 0;">Se preferir não receber mais novidades, é só responder este e-mail com "sair" que eu removo você da lista manualmente.</p>
            <p style="margin: 0 0 12px 0;">Dosiq — Desenvolvido para o bem comum.</p>
            <p style="margin: 0;">
              <a href="https://dosiq.app" target="_blank" style="color: #006a5e; text-decoration: none; font-weight: 600;">dosiq.app</a>
              <span style="color: #cbd5e1; padding: 0 8px;">•</span>
              <a href="mailto:contato@dosiq.app" style="color: #006a5e; text-decoration: none; font-weight: 600;">contato@dosiq.app</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!-- Fragmento HTML Limpo para Gmail - Fim (Ativação) -->
```

## Notas de fechamento (2026-07-22)

- Cada variante é um fragmento **completo e independente** (copy&paste único no Gmail via
  inspect-element, sem edição pós-cola) — corpo/introdução/features repetidos em cada bloco de
  propósito, só CTA e enquadramento mudam por variante.
- Wordmark do header segue em system-font (não Comfortaa): `<link>`/`<style>` de webfont são
  descartados pelo sanitizador do Gmail nesse fluxo de paste manual (é por isso que os templates
  transacionais, que passam pelo SMTP do Supabase, conseguem Comfortaa e este não).
- Opt-out por resposta ("sair") no rodapé, sem link técnico — justificado pelo volume baixo do
  envio manual (fora da exigência `List-Unsubscribe` do Google, que só entra >5000/dia).
- `contato@dosiq.app` (corrigido de `contact@` no template anterior).
- Badge iOS = `https://dosiq.app/download-ios.png` (já hospedado), mesmo padrão do Android — sem botão CSS de fallback. `dosiq-full-mono.png` **não** usado: é wordmark branco sobre transparente (pra fundo escuro), invisível no card branco do template; exigiria faixa escura dedicada, fora de escopo pra um envio manual único.
- Antes de disparar a variante Android: `SELECT email FROM beta_signups WHERE feature='android'`
  pra confirmar a lista atual (pode ter mudado desde 2026-07-22).
