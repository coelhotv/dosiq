---
title: "Template de E-mail de Reativação (lançamento 0.34, out/2026)"
description: "2 variantes HTML/CSS inline (A: já usou o app · B: nunca registrou dose) para reengajar contas dormentes ou fora da 0.34, anunciando as novidades de jul–out/2026. Envio manual por contato@dosiq.app."
version: "1.0.0"
status: draft
category: operation
audience:
  - ops
  - product
tags:
  - email
  - reativacao
  - v0.34
created_at: "2026-10-26"
updated_at: "2026-10-26"
---

# Template de E-mail de Reativação — lançamento 0.34

Mesmo fluxo de envio do `email_boas_vindas.md` e do `email_reativacao_outage_julho2026.md`: colar o
fragmento no Gmail (inspect-element) a partir de **contato@dosiq.app** e salvar como template para
reenvio manual. Lista de destinatários e segmentação: `plans/strategy-2026/REATIVACAO_V034_CONTAS.md`
(local-only, não versionado — contém e-mails).

**Contexto:** a 0.34.0 saiu nas duas lojas em 22/10/2026, com tudo o que foi construído desde julho.
A maior parte das contas dormentes parou numa versão de julho–setembro (0.30.x ou anterior). O
objetivo é trazer de volta quem usou e ativar quem só se cadastrou — e, de quebra, reduzir a cauda
antes do kill switch da 0.34 (backlog H2 §2.1).

**Variantes** (fragmentos completos, prontos para colar):
- **A — "já usou"** (registrou ao menos 1 dose): tom de "olha o que mudou desde a última vez".
- **B — "nunca registrou"** (0 doses): tom de ativação, "comece em 2 minutos".

**Abertura (obrigatória, por código):** os dois fragmentos têm o bloco `<!-- ABERTURA -->` logo
depois do "Olá", com o marcador `[ABERTURA]`. Trocar pelo texto do código indicado na tabela
**Aberturas** abaixo — o código de cada conta está em `REATIVACAO_V034_CONTAS.md`. O parágrafo
seguinte é genérico e não repete o que a abertura diz.

**Badges:** PNG em `https://dosiq.app/badges/*.png`, rasterizados dos SVGs oficiais da 111
(`apps/web/public/badges/`). **SVG não serve em e-mail:** Gmail (web e app) e Outlook não exibem
`<img src=".svg">`; só Apple Mail e alguns clientes exibem. PNG em 480 px de largura, exibido a 48 px
de altura (nítido em tela retina). Os PNGs precisam estar no ar (deploy) antes do envio.

**Bloco "novos termos" (contas sem consentimento registrado = onda 2 da 107):** quem nunca aceitou a política em
`consent_log` vai ver o aceite da política/termos v0.4 no próximo login. O bloco
`<!-- NOVOS TERMOS -->` avisa disso com antecedência; apagar para quem já tem `health_data:granted`.

**CTA:** os dois badges vão em todas as variantes, com atribuição própria desta campanha
(`ct=email_reativacao_v034` na App Store · `utm_source=email&utm_campaign=reativacao_v034` na Play).
Para quem tem plataforma conhecida, pode-se apagar o badge da outra loja.

**Enquadramento (ADR-062 / SaMD):** o app registra e lembra o que o médico prescreveu; nunca sugere,
calcula ou recomenda dose. Nada de "revisado clinicamente". As features abaixo foram conferidas no
índice de specs (entregues e embarcadas na 0.34.0).

**Compliance (envio manual):** volume baixo, fora da exigência de `List-Unsubscribe` do Google.
Opt-out por resposta ("sair") — texto no rodapé. Rodapé com a PJ (096 B1).

> [!IMPORTANT]
> **Não duplicar com a onda 2 da `107`.** Contas legadas sem consentimento podem receber também o
> e-mail de reengajamento pela tela de prune do admin. Decidir por conta qual dos dois sai (ou se
> este substitui aquele) antes de enviar — a lista marca essas contas.

> [!NOTE]
> **E-mail iCloud "Ocultar meu e-mail"** (`@icloud.com` aleatório): só entrega se o remetente for o
> mesmo endereço usado no cadastro pelo Apple ID. Se o envio por contato@ voltar, descartar.

---

## Bloco de features (comum às variantes)

| # | Feature | Specs |
|---|---|---|
| 1 | Lê o código de barras da caixa e preenche o remédio sozinho | 066 |
| 2 | Alarme que toca no silencioso e no modo Foco (iPhone) e canal de alarme dedicado (Android) | 054 · 062 |
| 3 | Dose na tela de bloqueio com contagem e "Adiar" (Live Activity / notificação contínua) | 101 · 041 |
| 4 | Mapa do corpo (frente e costas) para o rodízio dos locais de aplicação | 071 |
| 5 | Peso anotado na dose semanal e acompanhamento por etapa da escada de doses | 069 · 029 |
| 6 | Relatório em PDF para levar à consulta | 097 |
| 7 | Horários prontos (8 em 8h, 12 em 12h, mensal, a cada X dias) | 086 · 085 |

---

## Aberturas (frase do bloco `[ABERTURA]`)

Uma frase por conta, escolhida pelo código. Todas terminam de modo a encaixar no parágrafo genérico
que vem depois ("Acabamos de lançar a versão 0.34…" na A · "O cadastro era a parte mais
trabalhosa…" na B).

### Variante A — já registrou doses

| Código | Quando usar | Frase |
|---|---|---|
| **A1** | usou de verdade (≥ 5 doses) e parou | Vi que você chegou a registrar suas doses no dosiq por algumas semanas e depois parou. Fiquei curioso para saber o que aconteceu, e também queria te mostrar o que mudou desde então. |
| **A2** | conta de maio/junho com app muito antigo (< 0.28) | Você foi uma das primeiras pessoas a usar o dosiq, lá no começo. O app de hoje é praticamente outro, e grande parte do que mudou nasceu de conversas com quem testou naquela época. |
| **A3** | testou pouco (1–4 doses) | Você chegou a registrar as primeiras doses no dosiq, mas não seguiu. Talvez faltasse alguma coisa, e muito do que faltava acabou de chegar. |
| **A4** | conta recente (set/out) que parou | Você começou a usar o dosiq há poucas semanas, e de lá para cá saiu uma versão nova que deixa o dia a dia bem mais simples. |
| **A5** | ainda abre o app, mas sem tratamento ativo | Vi que você ainda abre o dosiq de vez em quando, mas sem nenhum tratamento ativo. Se quiser retomar, ficou bem mais rápido. |
| **A6** | testou no Android quando era beta fechado (jul) | Obrigado por ter testado o dosiq no Android quando ele ainda era um beta fechado. Agora ele está na Google Play para todo mundo. |

### Variante B — nunca registrou dose

| Código | Quando usar | Frase |
|---|---|---|
| **B1** | instalou e cadastrou tratamento, sem dose | Você chegou a cadastrar seu tratamento no dosiq, mas ainda não registrou nenhuma dose. |
| **B2** | instalou e não cadastrou nada | Você instalou o dosiq, mas não chegou a cadastrar seu tratamento. |
| **B3** | criou a conta pelo site, nunca instalou o app | Você criou sua conta no dosiq pelo site. Desde então ele virou um app de verdade para iPhone e Android, com alarme e tudo. |
| **B4** | conta recente (set/out) | Você criou sua conta no dosiq há poucas semanas e ainda não registrou nenhuma dose. |

---

## Variante A — "já usou"

**Subject:**
```
dosiq 0.34: o app que você testou mudou bastante
```

**Preheader** (já embutido no topo do fragmento, num `<div>` oculto; ver "Como o preheader funciona"): "Alarme no silencioso, leitura da caixa, relatório para a consulta e mais."

```html
<!-- Fragmento HTML Limpo para Gmail - Início (Reativação 0.34 · A) -->
<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; color: #f8fafc; mso-hide: all;">Alarme no silencioso, leitura da caixa, relatório para a consulta e mais.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
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
          <td style="background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Introdução -->
              <tr>
                <td style="color: #334155; font-size: 16px; line-height: 26px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Olá! Tudo bem?</p>
                  <!-- ABERTURA — colar aqui a frase do código da tabela "Aberturas" (A1–A6) -->
                  <p style="margin: 0 0 16px 0;">[ABERTURA]</p>
                  <!-- /ABERTURA -->
                  <p style="margin: 0 0 16px 0;">Acabamos de lançar a <strong>versão 0.34</strong> no iPhone e no Android — a maior atualização do ano, com tudo o que construímos nos últimos meses a partir do que quem usa o app nos contou.</p>
                  <p style="margin: 0;">Separei o que mais faz diferença no dia a dia:</p>
                </td>
              </tr>

              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ Novidades da 0.34
                </td>
              </tr>

              <!-- Grid de Features -->
              <tr>
                <td style="padding-bottom: 28px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">

                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">🔔 Alarme que toca mesmo no silencioso</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">No iPhone, o lembrete da dose pode tocar no modo silencioso e no Foco. No Android, ele usa um canal de alarme próprio. E a dose fica na tela de bloqueio com contagem regressiva e botão de adiar.</span>
                      </td>
                    </tr>
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">📷 Cadastro pela caixa do remédio</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Aponte a câmera para o código de barras e o dosiq preenche nome, apresentação e dosagem a partir da base da ANVISA. Na compra, a mesma leitura atualiza o estoque.</span>
                      </td>
                    </tr>
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💉 Feito para canetas e injetáveis</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Mapa do corpo de frente e de costas para alternar os locais de aplicação. Peso anotado na própria dose semanal, com a evolução por etapa da escada de doses que seu médico prescreveu.</span>
                      </td>
                    </tr>
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">📄 Relatório para levar à consulta</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Um PDF com as doses tomadas, suas medidas (peso, glicemia, pressão) e os locais de aplicação do período que você escolher. É só gerar e mostrar ao seu médico.</span>
                      </td>
                    </tr>
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">⏰ Horários prontos</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">De 8 em 8 horas, de 12 em 12, uma vez por mês ou a cada X dias: escolha o modelo e o dosiq mostra as próximas doses antes de você salvar.</span>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- NOVOS TERMOS — apagar para quem já tem consentimento registrado -->
              <tr>
                <td style="padding: 0 0 24px 0;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding: 14px 16px; background-color: #ecfdf5; border-radius: 10px; color: #334155; font-size: 14px; line-height: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a;">Um aviso rápido:</strong> atualizamos nossa <a href="https://dosiq.app/politica-de-privacidade" target="_blank" style="color: #006a5e; font-weight: 600;">Política de Privacidade</a> e os <a href="https://dosiq.app/termos-de-uso" target="_blank" style="color: #006a5e; font-weight: 600;">Termos de Uso</a>. Na próxima vez que entrar, o app vai pedir que você leia e aceite. Seus dados continuam seus.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- /NOVOS TERMOS -->

              <!-- CTA: badges das lojas -->
              <tr>
                <td align="center" style="padding-top: 8px; padding-bottom: 20px; border-top: 1px solid #e2e8f0;">
                  <table border="0" cellpadding="0" cellspacing="0" style="padding-top: 24px;">
                    <tr>
                      <td colspan="2" align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: center;">Atualize o dosiq e confira:</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 0 6px;">
                        <a href="https://apps.apple.com/br/app/id6762740948?pt=128807500&ct=email_reativacao_v034&mt=8" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/badges/app-store-pt.png" alt="Baixar na App Store" width="162" height="48" style="display: block; width: 162px; height: 48px; border: 0;" />
                        </a>
                      </td>
                      <td align="center" style="padding: 0 6px;">
                        <a href="https://play.google.com/store/apps/details?id=com.coelhotv.dosiq&referrer=utm_source%3Demail%26utm_campaign%3Dreativacao_v034" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/badges/google-play-pt.png" alt="Disponível no Google Play" width="148" height="48" style="display: block; width: 148px; height: 48px; border: 0;" />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Encerramento -->
              <tr>
                <td style="color: #475569; font-size: 15px; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 12px;">
                  <p style="margin: 0;">Se algo não funcionou para você da última vez, me conta? É só responder este e-mail. Leio e respondo pessoalmente cada mensagem, e é assim que o dosiq melhora.</p>
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
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque tem uma conta no dosiq.</p>
            <p style="margin: 0 0 12px 0;">Se preferir não receber mais novidades, é só responder com "sair" que eu removo você da lista manualmente.</p>
            <p style="margin: 0 0 6px 0;">O dosiq registra e lembra o que seu médico prescreveu. Não substitui orientação médica.</p>
            <p style="margin: 0 0 12px 0;">dosiq é operado por DOSIQ DIGITAL HEALTH WEB DESIGN LTDA · CNPJ 68.335.606/0001-11 · Rua Pais Leme, 215, cj 1713, Pinheiros, São Paulo/SP, CEP 05424-150</p>
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
<!-- Fragmento HTML Limpo para Gmail - Fim (Reativação 0.34 · A) -->
```

---

## Variante B — "nunca registrou"

**Subject:**
```
Seu tratamento no dosiq em 2 minutos (agora pela caixa do remédio)
```

**Preheader** (já embutido no fragmento): "Aponte a câmera para a caixa e pronto: o app preenche o resto."

Cards reordenados para abrir pelo que reduz o esforço do 1º cadastro: 📷 caixa → ⏰ horários →
🔔 alarme → 💉 injetáveis → 📄 relatório.

```html
<!-- Fragmento HTML Limpo para Gmail - Início (Reativação 0.34 · B) -->
<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; color: #f8fafc; mso-hide: all;">Aponte a câmera para a caixa e pronto: o app preenche o resto.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
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
          <td style="background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Introdução -->
              <tr>
                <td style="color: #334155; font-size: 16px; line-height: 26px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Olá! Tudo bem?</p>
                  <!-- ABERTURA — colar aqui a frase do código da tabela "Aberturas" (B1–B4) -->
                  <p style="margin: 0 0 16px 0;">[ABERTURA]</p>
                  <!-- /ABERTURA -->
                  <p style="margin: 0 0 16px 0;">O cadastro era a parte mais trabalhosa, e foi o que mais mudou. Na <strong>versão 0.34</strong>, que acabou de sair no iPhone e no Android, dá para começar em uns 2 minutos.</p>
                  <p style="margin: 0;">Veja o que ficou mais fácil:</p>
                </td>
              </tr>

              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ Novidades da 0.34
                </td>
              </tr>

              <!-- Grid de Features -->
              <tr>
                <td style="padding-bottom: 28px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">

                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">📷 Cadastro pela caixa do remédio</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Aponte a câmera para o código de barras e o dosiq preenche nome, apresentação e dosagem a partir da base da ANVISA. Na compra, a mesma leitura atualiza o estoque.</span>
                      </td>
                    </tr>
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">⏰ Horários prontos</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">De 8 em 8 horas, de 12 em 12, uma vez por mês ou a cada X dias: escolha o modelo e o dosiq mostra as próximas doses antes de você salvar.</span>
                      </td>
                    </tr>
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">🔔 Alarme que toca mesmo no silencioso</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">No iPhone, o lembrete da dose pode tocar no modo silencioso e no Foco. No Android, ele usa um canal de alarme próprio. E a dose fica na tela de bloqueio com contagem regressiva e botão de adiar.</span>
                      </td>
                    </tr>
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💉 Feito para canetas e injetáveis</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Mapa do corpo de frente e de costas para alternar os locais de aplicação. Peso anotado na própria dose semanal, com a evolução por etapa da escada de doses que seu médico prescreveu.</span>
                      </td>
                    </tr>
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">📄 Relatório para levar à consulta</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Um PDF com as doses tomadas, suas medidas (peso, glicemia, pressão) e os locais de aplicação do período que você escolher. É só gerar e mostrar ao seu médico.</span>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- NOVOS TERMOS — apagar para quem já tem consentimento registrado -->
              <tr>
                <td style="padding: 0 0 24px 0;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding: 14px 16px; background-color: #ecfdf5; border-radius: 10px; color: #334155; font-size: 14px; line-height: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a;">Um aviso rápido:</strong> atualizamos nossa <a href="https://dosiq.app/politica-de-privacidade" target="_blank" style="color: #006a5e; font-weight: 600;">Política de Privacidade</a> e os <a href="https://dosiq.app/termos-de-uso" target="_blank" style="color: #006a5e; font-weight: 600;">Termos de Uso</a>. Na próxima vez que entrar, o app vai pedir que você leia e aceite. Seus dados continuam seus.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- /NOVOS TERMOS -->

              <!-- CTA: badges das lojas -->
              <tr>
                <td align="center" style="padding-top: 8px; padding-bottom: 20px; border-top: 1px solid #e2e8f0;">
                  <table border="0" cellpadding="0" cellspacing="0" style="padding-top: 24px;">
                    <tr>
                      <td colspan="2" align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: center;">Baixe o dosiq e comece agora:</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 0 6px;">
                        <a href="https://apps.apple.com/br/app/id6762740948?pt=128807500&ct=email_reativacao_v034&mt=8" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/badges/app-store-pt.png" alt="Baixar na App Store" width="162" height="48" style="display: block; width: 162px; height: 48px; border: 0;" />
                        </a>
                      </td>
                      <td align="center" style="padding: 0 6px;">
                        <a href="https://play.google.com/store/apps/details?id=com.coelhotv.dosiq&referrer=utm_source%3Demail%26utm_campaign%3Dreativacao_v034" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/badges/google-play-pt.png" alt="Disponível no Google Play" width="148" height="48" style="display: block; width: 148px; height: 48px; border: 0;" />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Encerramento -->
              <tr>
                <td style="color: #475569; font-size: 15px; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 12px;">
                  <p style="margin: 0;">Ficou alguma dúvida para cadastrar seu tratamento? Responda este e-mail contando qual remédio você usa e eu te ajudo pessoalmente.</p>
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
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque tem uma conta no dosiq.</p>
            <p style="margin: 0 0 12px 0;">Se preferir não receber mais novidades, é só responder com "sair" que eu removo você da lista manualmente.</p>
            <p style="margin: 0 0 6px 0;">O dosiq registra e lembra o que seu médico prescreveu. Não substitui orientação médica.</p>
            <p style="margin: 0 0 12px 0;">dosiq é operado por DOSIQ DIGITAL HEALTH WEB DESIGN LTDA · CNPJ 68.335.606/0001-11 · Rua Pais Leme, 215, cj 1713, Pinheiros, São Paulo/SP, CEP 05424-150</p>
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
<!-- Fragmento HTML Limpo para Gmail - Fim (Reativação 0.34 · B) -->
```

---

## Como o preheader funciona

O Gmail não tem campo de preheader: o resumo cinza que aparece na caixa de entrada, depois do
assunto, é **o primeiro texto do corpo**. Por isso cada fragmento começa com um `<div>` invisível
contendo a frase, seguido de caracteres de espaço que empurram o resto do corpo para fora do resumo.
Nada a fazer além de colar o fragmento inteiro.

**Teste obrigatório na 1ª vez:** enviar para você mesmo e conferir (1) o resumo na lista do Gmail e
(2) que a frase **não** aparece no corpo aberto. Se o editor do Gmail remover o estilo oculto e a
frase aparecer no corpo, apagar o `<div>` — o resumo passa a ser "Olá! Tudo bem? + abertura", que
também funciona.

## Medição

- Cliques/installs: App Store Connect (campanha `email_reativacao_v034`) e Play Console (referrer
  `utm_campaign=reativacao_v034`).
- Reativação real: rodar `scripts/fleet-versions.sh` e a consulta de última dose ~14 dias após o
  envio; anotar em `REATIVACAO_V034_CONTAS.md` quem voltou (coluna "Resultado").
