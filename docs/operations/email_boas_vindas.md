---
title: "Template de E-mail de Boas-vindas (Android Closed Testing)"
description: "Fragmento HTML/CSS inline pronto para colar no Gmail Webmail, convidando testadores para o closed testing Android do Dosiq."
version: "1.0.0"
status: active
category: operation
audience:
  - ops
  - growth
tags:
  - email
  - onboarding
  - android
  - closed-testing
created_at: "2026-07-22"
updated_at: "2026-07-22"
---

# Template de E-mail de Boas-vindas Dosiq (Android Closed Testing)

Este é o fragmento HTML e CSS inline purificado, projetado especificamente para ser colado e enviado diretamente pelo **Gmail Webmail** sem o risco de ser sanitizado ou enviado em branco.

> [!IMPORTANT]
> **Como enviar usando o Gmail Webmail (Passo a Passo à prova de falhas):**
> 1. Copie todo o código HTML do bloco abaixo.
> 2. No Gmail, clique em **"Escrever"**.
> 3. No corpo da mensagem, digite uma palavra de referência temporária (ex: `INSERIR_AQUI`).
> 4. Clique com o botão direito sobre a palavra `INSERIR_AQUI` e selecione **"Inspecionar"** (ou "Inspecionar Elemento").
> 5. Na aba de ferramentas do desenvolvedor que se abrirá ao lado/abaixo, localize o texto `INSERIR_AQUI` selecionado.
> 6. Clique com o botão direito sobre ele no código do inspetor e selecione **"Edit as HTML"** (ou "Editar como HTML").
> 7. Substitua a palavra `INSERIR_AQUI` colando todo o código HTML copiado deste arquivo.
> 8. Pressione `Esc` ou clique fora da janela do inspetor. O e-mail formatado e com as imagens aparecerá perfeitamente montado no seu editor do Gmail pronto para ser enviado!

```html
<!-- Fragmento HTML Limpo para Gmail - Início -->
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; width: 100% !important;">
  <tr>
    <td align="center">
      
      <!-- Contêiner de E-mail (Max 600px) -->
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
                  <p style="margin: 0 0 16px 0;">Esquecer um horário, ficar na dúvida se já tomou a dose do dia, ou perceber que a cartela acabou na hora errada... Quem toma medicamentos sabe muito bem como essas pequenas preocupações pesam na rotina.</p>
                  <p style="margin: 0 0 16px 0;">Nós criamos o <strong>Dosiq</strong> para que você nunca mais precise carregar esse peso.</p>
                  <p style="margin: 0;">A partir de agora, você tem acesso exclusivo à versão oficial de testes do Dosiq para Android. O app é totalmente gratuito, não tem anúncios e foi desenhado para ser tão simples que qualquer pessoa da família consegue usar sem esforço.</p>
                </td>
              </tr>
              
              <!-- Título Seção Recursos -->
              <tr>
                <td style="color: #006a5e; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-bottom: 16px;">
                  ✨ Recursos criados para facilitar a sua vida:
                </td>
              </tr>
              
              <!-- Grid de Features -->
              <tr>
                <td style="padding-bottom: 28px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    
                    <!-- Feature 1 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">🔔 Lembretes que funcionam</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Notificações nativas discretas no celular e até alertas integrados no Telegram.</span>
                      </td>
                    </tr>
                    
                    <!-- Espaçador -->
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>
                    
                    <!-- Feature 2 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">📦 Previsão de Estoque</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">O app prevê a data exata em que seu remédio vai acabar com base no consumo real e te avisa para repor antes de zerar.</span>
                      </td>
                    </tr>
                    
                    <!-- Espaçador -->
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>
                    
                    <!-- Feature 3 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">📊 Portabilidade Clínica</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Gere um relatório em PDF bonito e profissional do seu histórico de adesão para mostrar ao seu médico na consulta.</span>
                      </td>
                    </tr>
                    
                    <!-- Espaçador -->
                    <tr><td style="font-size: 8px; line-height: 8px; height: 8px;">&nbsp;</td></tr>
                    
                    <!-- Feature 4 -->
                    <tr>
                      <td style="padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border-left: 4px solid #006a5e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <strong style="color: #0f172a; font-size: 15px; display: block; margin-bottom: 4px;">💬 Assistente Clínico IA</strong>
                        <span style="color: #475569; font-size: 14px; line-height: 20px; display: block;">Tire dúvidas cotidianas sobre seus medicamentos a qualquer hora com a nossa inteligência artificial integrada.</span>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
              
              <!-- Explicação do Closed Testing do Google -->
              <tr>
                <td style="color: #475569; font-size: 14px; line-height: 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 20px; border-top: 1px solid #e2e8f0; padding-bottom: 28px;">
                  <p style="margin: 0;"><strong>Como você nos ajuda a lançar:</strong> Para liberar o app publicamente para milhares de brasileiros na Google Play Store, o Google exige que nosso grupo de testadores utilize o Dosiq por <strong>14 dias seguidos</strong>. É um teste rápido, seguro e que ajuda diretamente a validar o produto!</p>
                </td>
              </tr>
              
              <!-- CTA: Google Play Badge Clicável -->
              <tr>
                <td align="center" style="padding-bottom: 20px;">
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: center;">Clique abaixo no celular Android para baixar o app:</p>
                        <a href="https://play.google.com/store/apps/details?id=com.coelhotv.dosiq" target="_blank" style="text-decoration: none; display: inline-block;">
                          <img src="https://dosiq.app/download-android.png" alt="Disponível no Google Play" width="180" style="display: block; width: 180px; height: auto; border: 0;" />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Lembrete de Email Importante -->
              <tr>
                <td align="center" style="padding-bottom: 12px;">
                  <table border="0" cellpadding="10" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; width: 100%;">
                    <tr>
                      <td align="center" style="color: #166534; font-size: 13px; line-height: 18px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        💡 <strong>Lembrete importante:</strong> Certifique-se de estar logado na Google Play Store com a mesma conta de e-mail onde você recebeu este convite para liberar o seu download!
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Encerramento -->
              <tr>
                <td style="color: #475569; font-size: 15px; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding-top: 20px;">
                  <p style="margin: 0;">Espero que o Dosiq traga mais leveza e clareza para o seu cuidado de saúde. Qualquer dúvida, feedback ou ideia, é só responder diretamente a este e-mail. Leio e respondo pessoalmente cada mensagem!</p>
                  <p style="margin: 20px 0 0 0; font-weight: 600; color: #0f172a;">Com carinho,</p>
                  <p style="margin: 4px 0 0 0; font-weight: 700; color: #006a5e; font-size: 16px;">Time Dosiq</p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
        
        <!-- Rodapé (Discreto) -->
        <tr>
          <td align="center" style="padding-top: 28px; padding-bottom: 10px; color: #64748b; font-size: 12px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
            <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque se cadastrou na lista do Dosiq.</p>
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
<!-- Fragmento HTML Limpo para Gmail - Fim -->
