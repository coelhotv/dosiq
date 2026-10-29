---
title: "Template de E-mail de Boas-vindas (conta nova)"
description: "2 variantes HTML/CSS inline para quem acabou de criar conta no dosiq (A: criou pelo app · B: criou pelo site). Envio automático pelo workflow da Brevo (spec 026 2A); runbook em §Operação."
version: "2.1.0"
status: active
category: operation
audience:
  - ops
  - product
tags:
  - email
  - onboarding
  - boas-vindas
created_at: "2026-07-22"
updated_at: "2026-10-29"
---

# Template de E-mail de Boas-vindas — conta nova

Para quem **acabou de criar conta**. Substitui a versão 1.x (convite do teste fechado do Android,
jul/2026), que falava de testadores e só tinha a Play Store. Mesma base visual do
`email_reativacao_v034.md`.

**Variantes** (fragmentos completos, prontos para colar):
- **A — criou pelo app** (já tem o app instalado): CTA = 3 primeiros passos (remédio → horários → notificações). Sem badges.
- **B — criou pelo site** (sem app): CTA = badges das duas lojas.

Como saber: a conta que já aparece em `notification_devices`/`device_activity` criou pelo app (A);
sem rastro, B. Na dúvida, B (os badges não atrapalham quem já instalou).

**Badges:** PNG em `https://dosiq.app/badges/*.png` (SVG não renderiza no Gmail/Outlook; ver a nota no
`email_reativacao_v034.md`). Atribuição própria: `ct=email_boas_vindas` (App Store) ·
`utm_source=email&utm_campaign=boas_vindas` (Play).

**Enquadramento (ADR-062 / SaMD):** o app registra e lembra o que o médico prescreveu; nunca sugere,
calcula ou recomenda dose. O card do assistente descreve só o que as regras do prompt permitem
(`buildStaticSystemRules`, `apps/web/src/features/chatbot/config/chatbotConfig.ts`): responder sobre
os registros do próprio usuário e explicar remédio em nível educativo geral, sem indicar nem ajustar
dose. Ele depende do aceite da transferência internacional — o próprio card diz que é preciso
autorizar nas configurações de privacidade. Se o escopo do assistente mudar, este card muda junto.

**Compliance (envio manual):** opt-out por resposta ("sair"), rodapé com a PJ (096 B1).

> [!IMPORTANT]
> **Como enviar pelo Gmail Webmail:**
> 1. Copie o bloco HTML da variante.
> 2. No Gmail, **Escrever**; preencha o assunto da variante.
> 3. No corpo, digite `INSERIR_AQUI`, clique com o botão direito sobre a palavra → **Inspecionar**.
> 4. No inspetor, botão direito no elemento → **Edit as HTML** e troque `INSERIR_AQUI` pelo fragmento.
> 5. `Esc` para fechar o inspetor. O preheader já vai embutido no topo do fragmento (div oculto).

## Operação — envio automático (spec 026 Slice 2A, ADR-118)

O dosiq **não envia** este e-mail: o job `api/ops.ts?job=brevo_contacts_sync` (ping **a cada 15 min** no
cron-job.org; conta entra na lista entre 1 h e 1 h 15 após confirmar o e-mail) coloca a conta nova na lista **New users** (id 5) da Brevo, e o workflow da Brevo
(cópia destes templates no editor da Brevo — este arquivo é a fonte versionada) dispara a boas-vindas
ao contato entrar na lista, ramificando **A/B por `HAS_APP`**. O envio manual pelo Gmail acima fica só
como contingência.

- **Quem entra:** e-mail confirmado há ≥ 1 h e conta criada a partir de `BREVO_SYNC_START`. A base
  antiga não entra. Fila de exclusão viva (`prune_queue`) fica de fora.
- **O que vai à Brevo:** só e-mail, `ext_id` (= uid) e os atributos `HAS_APP` e `SIGNUP_DATE`. Nada de
  nome nem dado de saúde. Os templates **não** usam `{{ contact.* }}` hoje; se passarem a usar o nome,
  o atributo da conta pt-BR é `NOME` (não `FNAME`) e incluí-lo exige mudar o teste do payload.
- **`HAS_APP` é medido em +1 h:** quem cria pelo site e instala o app depois recebe a variante B — por
  desenho; o atributo não é atualizado depois.
- **Base legal:** e-mail de conta (execução do contrato; política v0.4 §6 já lista a Brevo). Manter o
  texto como "conta", não promoção — virar marketing muda a base para consentimento.
- **Opt-out:** descadastro nativo da Brevo (link do workflow + blocklist). Upsert do job não remove
  contato da blocklist (verificado na API, 2026-10-29).

**Configuração (Vercel, só servidor — nunca `VITE_`):** `BREVO_API_KEY` (chave dedicada, permissão
**só de contatos**, IP allowlist desligada — a Vercel sai de IPs variáveis) · `BREVO_LIST_NEW_USERS=5`
· `BREVO_SYNC_START` em ISO com fuso (ex.: `2026-10-29T00:00:00-03:00`).
**Ordem:** env → deploy → migração em prod → **só então** o ping. Faltou env ⇒ o job responde 500 a
cada rodada (a cada 15 min).

**Exclusão espelhada:** toda rodada apaga na Brevo (por `ext_id`) as contas excluídas nas últimas
48 h (lápide `private.account_tombstone`). Cobre exclusão pelo app, pela fila de prune e pelo
atendimento a privacidade@. **Remoção manual** na Brevo (Contatos → buscar o e-mail → excluir) quando:
- a conta foi apagada direto no painel do Supabase (não passa pela lápide);
- a Brevo ficou fora > 48 h — após o incidente, conferir no Sentry os erros `etapa: delete` do
  período e remover à mão cada contato. Prazo da política §7: 15 dias.

**Rotação da `BREVO_API_KEY`:** criar chave nova (só contatos) → trocar na Vercel → redeploy →
desativar a antiga na Brevo. Vazou? Desativar primeiro (o job falha com 401 até a troca, sem perda:
inclusão retenta, exclusão tem 48 h).

**Erros no Sentry:** `{job: brevo_contacts_sync, etapa, status, code}` — etapas `candidates`,
`include`, `mark`, `deleted_since`, `delete`. 429 ou 45 s encerram a rodada (`stoppedBy`); a próxima
rodada continua.

---

## Variante A — criou pelo app

**Subject:**
```
Boas-vindas ao dosiq: seu primeiro remédio em 2 minutos
```

**Preheader** (embutido): "Seu primeiro remédio cadastrado em 2 minutos, pela caixa."

```html
<!-- Fragmento HTML Limpo para Gmail - Início (Boas-vindas · A) -->
<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; color: #f8fafc; mso-hide: all;">Seu primeiro remédio cadastrado em 2 minutos, pela caixa.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
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
                    <img src="https://dosiq.app/dosiq-logo-verde.png" alt="dosiq" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 50%; border: 0;" />
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
                  <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Olá! Que bom ter você aqui.</p>
                  <p style="margin: 0 0 16px 0;">Esquecer um horário, ficar na dúvida se já tomou a dose do dia, perceber que a cartela acabou na hora errada... Quem toma remédio todo dia sabe como essas pequenas preocupações pesam.</p>
                  <p style="margin: 0 0 16px 0;">O dosiq existe para tirar esse peso de você: ele registra e lembra o que seu médico prescreveu. É gratuito, sem anúncios, para iPhone e Android.</p>
                  <p style="margin: 0;">Você já está com o app. Separei o que ajuda a começar com o pé direito:</p>
                </td>
              </tr>

              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ O que o dosiq faz por você
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
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💬 Assistente em português</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Pergunte do seu jeito: “o que falta tomar hoje?”, “meu estoque dura até quando?”, “para que serve este remédio?”. Ele responde em linguagem simples a partir do que você registrou. Não indica nem ajusta dose e não substitui seu médico. Fica disponível quando você autoriza nas configurações de privacidade do app.</span>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- Privacidade -->
              <tr>
                <td style="padding: 0 0 24px 0;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding: 14px 16px; background-color: #ecfdf5; border-radius: 10px; color: #334155; font-size: 14px; line-height: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a;">Seus dados são seus.</strong> Dado de saúde é tratado conforme a LGPD, nunca é vendido e você pode apagar sua conta quando quiser. Detalhes na nossa <a href="https://dosiq.app/politica-de-privacidade" target="_blank" style="color: #006a5e; font-weight: 600;">Política de Privacidade</a>.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA: primeiros passos -->
              <tr>
                <td style="padding: 24px 0 20px 0; border-top: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Para começar, três passos no app:</p>
                  <p style="margin: 0 0 8px 0; color: #334155; font-size: 15px; line-height: 22px;"><strong style="color: #006a5e;">1.</strong> Cadastre seu primeiro remédio (pela caixa é mais rápido).</p>
                  <p style="margin: 0 0 8px 0; color: #334155; font-size: 15px; line-height: 22px;"><strong style="color: #006a5e;">2.</strong> Escolha os horários como seu médico prescreveu.</p>
                  <p style="margin: 0; color: #334155; font-size: 15px; line-height: 22px;"><strong style="color: #006a5e;">3.</strong> Permita as notificações: é o que faz o alarme tocar na hora certa.</p>
                </td>
              </tr>

              <!-- Encerramento -->
              <tr>
                <td style="color: #475569; font-size: 15px; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 12px;">
                  <p style="margin: 0;">Qualquer dúvida, sugestão ou problema, é só responder este e-mail. Leio e respondo pessoalmente cada mensagem, e é assim que o dosiq melhora.</p>
                  <p style="margin: 20px 0 0 0; font-weight: 600; color: #0f172a;">Com carinho,</p>
                  <p style="margin: 4px 0 0 0; font-weight: 700; color: #006a5e; font-size: 16px;">Time dosiq</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td align="center" style="padding-top: 28px; padding-bottom: 10px; color: #64748b; font-size: 12px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque criou sua conta no dosiq.</p>
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
<!-- Fragmento HTML Limpo para Gmail - Fim (Boas-vindas · A) -->
```

---

## Variante B — criou pelo site

**Subject:**
```
Boas-vindas ao dosiq: falta só instalar o app
```

**Preheader** (embutido): "Baixe o app no iPhone ou Android e entre com o mesmo e-mail."

```html
<!-- Fragmento HTML Limpo para Gmail - Início (Boas-vindas · B) -->
<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; color: #f8fafc; mso-hide: all;">Baixe o app no iPhone ou Android e entre com o mesmo e-mail.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
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
                    <img src="https://dosiq.app/dosiq-logo-verde.png" alt="dosiq" width="44" height="44" style="display: block; width: 44px; height: 44px; border-radius: 50%; border: 0;" />
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
                  <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Olá! Que bom ter você aqui.</p>
                  <p style="margin: 0 0 16px 0;">Esquecer um horário, ficar na dúvida se já tomou a dose do dia, perceber que a cartela acabou na hora errada... Quem toma remédio todo dia sabe como essas pequenas preocupações pesam.</p>
                  <p style="margin: 0 0 16px 0;">O dosiq existe para tirar esse peso de você: ele registra e lembra o que seu médico prescreveu. É gratuito, sem anúncios, para iPhone e Android.</p>
                  <p style="margin: 0;">Sua conta já está criada. Para os lembretes funcionarem, falta só instalar o app no celular e entrar com o mesmo e-mail:</p>
                </td>
              </tr>

              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ O que o dosiq faz por você
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
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>

                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💬 Assistente em português</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Pergunte do seu jeito: “o que falta tomar hoje?”, “meu estoque dura até quando?”, “para que serve este remédio?”. Ele responde em linguagem simples a partir do que você registrou. Não indica nem ajusta dose e não substitui seu médico. Fica disponível quando você autoriza nas configurações de privacidade do app.</span>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- Privacidade -->
              <tr>
                <td style="padding: 0 0 24px 0;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding: 14px 16px; background-color: #ecfdf5; border-radius: 10px; color: #334155; font-size: 14px; line-height: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a;">Seus dados são seus.</strong> Dado de saúde é tratado conforme a LGPD, nunca é vendido e você pode apagar sua conta quando quiser. Detalhes na nossa <a href="https://dosiq.app/politica-de-privacidade" target="_blank" style="color: #006a5e; font-weight: 600;">Política de Privacidade</a>.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA: badges das lojas -->
              <tr>
                <td align="center" style="padding-top: 8px; padding-bottom: 20px; border-top: 1px solid #e2e8f0;">
                  <table border="0" cellpadding="0" cellspacing="0" style="padding-top: 24px;">
                    <tr>
                      <td colspan="2" align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: center;">Baixe o app e entre com o mesmo e-mail:</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 0 6px;">
                        <a href="https://apps.apple.com/br/app/id6762740948?pt=128807500&ct=email_boas_vindas&mt=8" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/badges/app-store-pt.png" alt="Baixar na App Store" width="162" height="48" style="display: block; width: 162px; height: 48px; border: 0;" />
                        </a>
                      </td>
                      <td align="center" style="padding: 0 6px;">
                        <a href="https://play.google.com/store/apps/details?id=com.coelhotv.dosiq&referrer=utm_source%3Demail%26utm_campaign%3Dboas_vindas" target="_blank" style="text-decoration: none; display: inline-block;">
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
                  <p style="margin: 0;">Qualquer dúvida, sugestão ou problema, é só responder este e-mail. Leio e respondo pessoalmente cada mensagem, e é assim que o dosiq melhora.</p>
                  <p style="margin: 20px 0 0 0; font-weight: 600; color: #0f172a;">Com carinho,</p>
                  <p style="margin: 4px 0 0 0; font-weight: 700; color: #006a5e; font-size: 16px;">Time dosiq</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td align="center" style="padding-top: 28px; padding-bottom: 10px; color: #64748b; font-size: 12px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque criou sua conta no dosiq.</p>
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
<!-- Fragmento HTML Limpo para Gmail - Fim (Boas-vindas · B) -->
```
