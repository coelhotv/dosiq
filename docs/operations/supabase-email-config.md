# Configuração de E-mails Transacionais — Supabase + Dosiq (Revisado para Modo Escuro)

Este guia detalha a configuração operacional dos templates de e-mail transacional do **Dosiq** no painel do Supabase. Todos os templates foram otimizados com técnicas híbridas de CSS inline para garantir **legibilidade absoluta em Modo Escuro** (especialmente no aplicativo **Outlook para iOS/Android** e **Gmail**), utilizando realces em verde esmeralda vibrante de alta legibilidade no fundo preto/escuro.

---

## 1. Localização no Supabase

Acesse o painel do Supabase e navegue até:
**Supabase Dashboard → Authentication → Email Templates**

Há 6 templates operacionais que devem ser mantidos idênticos em estilo e compatibilidade de cores:
1. `Confirm signup` — confirmação de novo cadastro
2. `Reset password` — recuperação de senha de conta
3. `Magic link` — link de acesso sem senha
4. `Password changed` — confirmação de segurança de senha alterada
5. `Email address change` — confirmação de troca de e-mail principal
6. `Invite user` — convite para novos testadores

---

## 🎨 O Segredo do Suporte ao Modo Escuro (Outlook & Gmail)

Clientes de e-mail modernos (especialmente o Outlook no iOS) invertem dinamicamente as cores de fundo. Se textos escuros não forem tratados adequadamente, eles perdem o contraste e ficam invisíveis contra o fundo preto. 

Para resolver isso de forma definitiva nos templates do Dosiq, adotamos duas abordagens:
1. **Esquema de Cores Explícito:** Inserção de tags `<meta name="color-scheme" content="light dark">` no topo do corpo do e-mail.
2. **Estilos de Media Query Híbridos com `!important`:** No bloco `<style>`, mapeamos classes específicas (`.email-title`, `.email-body-text`, `.otp-token`) para forçar cores de alto contraste em fundos escuros. No Light Mode, o CSS inline padrão assume; no Dark Mode, o Outlook lê as media queries e aplica as cores otimizadas.

---

## 2. Template: Confirm Signup

**Subject:**
```
Dosiq — Ativação de conta
```

**Body (HTML):**
```html
<!-- Suporte a esquemas de cores nas tags meta e cabeçalhos de clientes modernos -->
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">

<!-- Link de Fontes do Google -->
<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Lexend:wght@400;500;700&family=Public+Sans:wght@600;700&display=swap" rel="stylesheet" type="text/css">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  .otp-token a { color: #006a5e !important; text-decoration: none !important; }
  
  /* Ajustes específicos para Modo Escuro em clientes modernos */
  @media (prefers-color-scheme: dark) {
    .email-container { background-color: #121212 !important; }
    .email-card { background-color: #1a1e1f !important; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4) !important; }
    .email-title { color: #21e2cd !important; } /* Verde esmeralda claro e vibrante para alto contraste */
    .email-body-text { color: #ffffff !important; } /* Branco puro para legibilidade máxima */
    .email-btn { background: #21e2cd !important; color: #121212 !important; box-shadow: 0 4px 16px rgba(33, 226, 205, 0.2) !important; } /* Botão vibrante no dark mode com texto escuro */
    .otp-box { background-color: #24292a !important; }
    .otp-text { color: #c4c7c5 !important; }
    .otp-token { background-color: #1a1e1f !important; border-color: #4a5451 !important; color: #21e2cd !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important; }
    .otp-token a { color: #21e2cd !important; text-decoration: none !important; } /* Anula link azul no dark mode */
    .warning-box { background-color: #2c2512 !important; border-left-color: #e59800 !important; }
    .warning-title { color: #ffebbe !important; }
    .warning-text { color: #f2e2be !important; }
    .alt-link-box { background-color: #24292a !important; }
    .alt-link-text { color: #c4c7c5 !important; }
    .alt-link-url { color: #21e2cd !important; }
    .email-footer { background-color: #24292a !important; border-top-color: #313738 !important; color: #a9b0ae !important; }
    .email-footer strong { color: #e1e3e2 !important; }
    .email-footer a { color: #21e2cd !important; }
  }
  
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', 'Montserrat', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header com Gradiente Oficial -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', 'Quicksand', system-ui, -apple-system, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 class="email-title" style="font-family: 'Public Sans', 'Inter', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Bem-vindo ao Dosiq!</h2>
      <p class="email-body-text" style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Obrigado por se cadastrar. Escolha uma das opções abaixo para confirmar seu e-mail e ativar sua conta:</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a class="email-btn" href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Confirmar Conta</a>
      </div>

      <!-- Caixa Híbrida de Código OTP -->
      <div class="otp-box" style="background-color: #f2f4f5; padding: 16px; border-radius: 16px; text-align: center; margin: 24px 0;">
        <p class="otp-text" style="margin: 0 0 8px; font-size: 13px; color: #3e4946;">Se o aplicativo solicitar um código de confirmação, utilize:</p>
        <span class="otp-token" style="font-family: 'Public Sans', 'Inter', monospace, sans-serif; font-size: 32px; font-weight: 700; color: #006a5e; letter-spacing: 4px; display: inline-block; padding: 6px 16px; background: #ffffff; border-radius: 10px; border: 1px dashed #bdc9c5; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">{{ .Token }}</span>
      </div>

      <!-- Bloco de Alerta do Design System (card-alert-warning) -->
      <div class="warning-box" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p class="warning-text" style="margin: 0; font-size: 12px; line-height: 1.5; color: #7b5700;">
          <strong class="warning-title" style="color: #271900;">Aviso sobre acessos e uso único:</strong> Os acessos acima são seguros, válidos por 1 hora e podem ser usados **apenas uma vez**. Caso ocorra erro de "link inválido", basta solicitar um novo envio pelo aplicativo.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div class="divider" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p class="alt-link-text" style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div class="alt-link-box" style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a class="alt-link-url" href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="email-footer" style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', 'Inter', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 3. Template: Reset Password

**Subject:**
```
Dosiq — Instruções para redefinir sua senha
```

**Body (HTML):**
```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">

<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Lexend:wght@400;500;700&family=Public+Sans:wght@600;700&display=swap" rel="stylesheet" type="text/css">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  
  @media (prefers-color-scheme: dark) {
    .email-container { background-color: #121212 !important; }
    .email-card { background-color: #1a1e1f !important; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4) !important; }
    .email-title { color: #21e2cd !important; }
    .email-body-text { color: #c4c7c5 !important; }
    .otp-box { background-color: #24292a !important; }
    .otp-text { color: #c4c7c5 !important; }
    .otp-token { background-color: #1a1e1f !important; border-color: #4a5451 !important; color: #21e2cd !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important; }
    .warning-box { background-color: #2c2512 !important; border-left-color: #e59800 !important; }
    .warning-title { color: #ffebbe !important; }
    .warning-text { color: #f2e2be !important; }
    .alt-link-box { background-color: #24292a !important; }
    .alt-link-text { color: #c4c7c5 !important; }
    .alt-link-url { color: #21e2cd !important; }
    .email-footer { background-color: #24292a !important; border-top-color: #313738 !important; color: #a9b0ae !important; }
    .email-footer strong { color: #e1e3e2 !important; }
    .email-footer a { color: #21e2cd !important; }
  }
  
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', 'Montserrat', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', 'Quicksand', system-ui, -apple-system, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 class="email-title" style="font-family: 'Public Sans', 'Inter', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Recuperação de Senha</h2>
      <p class="email-body-text" style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Recebemos uma solicitação para redefinir a senha associada à sua conta no Dosiq. Escolha uma das opções abaixo:</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a class="email-btn" href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Criar Nova Senha</a>
      </div>

      <!-- Caixa Híbrida de Código OTP -->
      <div class="otp-box" style="background-color: #f2f4f5; padding: 16px; border-radius: 16px; text-align: center; margin: 24px 0;">
        <p class="otp-text" style="margin: 0 0 8px; font-size: 13px; color: #3e4946;">Se o aplicativo solicitar um código de confirmação, utilize:</p>
        <span class="otp-token" style="font-family: 'Public Sans', 'Inter', monospace, sans-serif; font-size: 32px; font-weight: 700; color: #006a5e; letter-spacing: 4px; display: inline-block; padding: 6px 16px; background: #ffffff; border-radius: 10px; border: 1px dashed #bdc9c5; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">{{ .Token }}</span>
      </div>

      <!-- Bloco de Alerta -->
      <div class="warning-box" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p class="warning-text" style="margin: 0; font-size: 12px; line-height: 1.5; color: #7b5700;">
          <strong class="warning-title" style="color: #271900;">Aviso de Segurança e Uso Único:</strong> O link e o código acima expiram em **1 hora** e perdem a validade após o primeiro clique ou preenchimento. Se você não solicitou, sua conta continuará 100% segura.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div class="divider" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p class="alt-link-text" style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div class="alt-link-box" style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a class="alt-link-url" href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="email-footer" style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', 'Inter', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 4. Template: Magic Link

**Subject:**
```
Dosiq — Link de acesso rápido
```

**Body (HTML):**
```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">

<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Lexend:wght@400;500;700&family=Public+Sans:wght@600;700&display=swap" rel="stylesheet" type="text/css">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  
  @media (prefers-color-scheme: dark) {
    .email-container { background-color: #121212 !important; }
    .email-card { background-color: #1a1e1f !important; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4) !important; }
    .email-title { color: #21e2cd !important; }
    .email-body-text { color: #c4c7c5 !important; }
    .otp-box { background-color: #24292a !important; }
    .otp-text { color: #c4c7c5 !important; }
    .otp-token { background-color: #1a1e1f !important; border-color: #4a5451 !important; color: #21e2cd !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important; }
    .warning-box { background-color: #2c2512 !important; border-left-color: #e59800 !important; }
    .warning-title { color: #ffebbe !important; }
    .warning-text { color: #f2e2be !important; }
    .alt-link-box { background-color: #24292a !important; }
    .alt-link-text { color: #c4c7c5 !important; }
    .alt-link-url { color: #21e2cd !important; }
    .email-footer { background-color: #24292a !important; border-top-color: #313738 !important; color: #a9b0ae !important; }
    .email-footer strong { color: #e1e3e2 !important; }
    .email-footer a { color: #21e2cd !important; }
  }
  
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', 'Montserrat', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', 'Quicksand', system-ui, -apple-system, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 class="email-title" style="font-family: 'Public Sans', 'Inter', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 12px; letter-spacing: -0.02em;">Seu Acesso Rápido</h2>
      <p class="email-body-text" style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Clique no botão ou insira o código abaixo para entrar na sua conta instantaneamente, sem precisar de senha.</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a class="email-btn" href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Entrar no Dosiq</a>
      </div>

      <!-- Caixa Híbrida de Código OTP -->
      <div class="otp-box" style="background-color: #f2f4f5; padding: 16px; border-radius: 16px; text-align: center; margin: 24px 0;">
        <p class="otp-text" style="margin: 0 0 8px; font-size: 13px; color: #3e4946;">Se o aplicativo solicitar um código de verificação, utilize:</p>
        <span class="otp-token" style="font-family: 'Public Sans', 'Inter', monospace, sans-serif; font-size: 32px; font-weight: 700; color: #006a5e; letter-spacing: 4px; display: inline-block; padding: 6px 16px; background: #ffffff; border-radius: 10px; border: 1px dashed #bdc9c5; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">{{ .Token }}</span>
      </div>

      <!-- Bloco de Alerta -->
      <div class="warning-box" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p class="warning-text" style="margin: 0; font-size: 12px; line-height: 1.5; color: #7b5700;">
          <strong class="warning-title" style="color: #271900;">Aviso de Segurança:</strong> Este acesso é válido por **1 hora** e perde a validade após o primeiro clique ou preenchimento. Se você não solicitou este acesso, pode ignorar com segurança.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div class="divider" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p class="alt-link-text" style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div class="alt-link-box" style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a class="alt-link-url" href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="email-footer" style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', 'Inter', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 5. Template: Password Changed

**Subject:**
```
Segurança Dosiq — Senha alterada
```

**Body (HTML):**
```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">

<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Lexend:wght@400;500;700&family=Public+Sans:wght@600;700&display=swap" rel="stylesheet" type="text/css">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  
  @media (prefers-color-scheme: dark) {
    .email-container { background-color: #121212 !important; }
    .email-card { background-color: #1a1e1f !important; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4) !important; }
    .email-title { color: #21e2cd !important; }
    .email-body-text { color: #c4c7c5 !important; }
    .critical-box { background-color: #3d1314 !important; border-left-color: #ff3b30 !important; }
    .critical-title { color: #ffdad6 !important; }
    .critical-text { color: #ffb4ab !important; }
    .email-footer { background-color: #24292a !important; border-top-color: #313738 !important; color: #a9b0ae !important; }
    .email-footer strong { color: #e1e3e2 !important; }
    .email-footer a { color: #21e2cd !important; }
  }
  
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', 'Montserrat', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', 'Quicksand', system-ui, -apple-system, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 class="email-title" style="font-family: 'Public Sans', 'Inter', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Senha Alterada com Sucesso</h2>
      <p class="email-body-text" style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 16px;">Sua credencial de acesso ao Dosiq foi modificada recentemente. Se foi você quem realizou essa alteração, está tudo pronto e nenhuma ação adicional é necessária.</p>

      <!-- Bloco de Alerta Crítico do Design System (card-alert-critical) -->
      <div class="critical-box" style="background-color: #ffdad6; border-left: 4px solid #ba1a1a; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p class="critical-text" style="margin: 0; font-size: 13px; line-height: 1.5; color: #93000a;">
          <strong class="critical-title" style="color: #ba1a1a;">Não reconhece essa ação?</strong> Se você não alterou sua senha recentemente, sua conta pode estar sob risco de acesso não autorizado. Por favor, solicite uma nova redefinição imediatamente através da tela de login ou entre em contato com nossa equipe de suporte.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="email-footer" style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', 'Inter', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 6. Template: Email Address Change

**Subject:**
```
Segurança Dosiq — Confirmação de novo e-mail
```

**Body (HTML):**
```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">

<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Lexend:wght@400;500;700&family=Public+Sans:wght@600;700&display=swap" rel="stylesheet" type="text/css">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  
  @media (prefers-color-scheme: dark) {
    .email-container { background-color: #121212 !important; }
    .email-card { background-color: #1a1e1f !important; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4) !important; }
    .email-title { color: #21e2cd !important; }
    .email-body-text { color: #c4c7c5 !important; }
    .otp-box { background-color: #24292a !important; }
    .otp-text { color: #c4c7c5 !important; }
    .otp-token { background-color: #1a1e1f !important; border-color: #4a5451 !important; color: #21e2cd !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important; }
    .warning-box { background-color: #2c2512 !important; border-left-color: #e59800 !important; }
    .warning-title { color: #ffebbe !important; }
    .warning-text { color: #f2e2be !important; }
    .alt-link-box { background-color: #24292a !important; }
    .alt-link-text { color: #c4c7c5 !important; }
    .alt-link-url { color: #21e2cd !important; }
    .email-footer { background-color: #24292a !important; border-top-color: #313738 !important; color: #a9b0ae !important; }
    .email-footer strong { color: #e1e3e2 !important; }
    .email-footer a { color: #21e2cd !important; }
  }
  
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', 'Montserrat', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', 'Quicksand', system-ui, -apple-system, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 class="email-title" style="font-family: 'Public Sans', 'Inter', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Alteração de E-mail</h2>
      <p class="email-body-text" style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Recebemos uma solicitação para alterar o endereço de e-mail ({{ .Email }}) da sua conta no Dosiq para este novo endereço ({{ .NewEmail }}). Escolha uma das opções abaixo para confirmar:</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a class="email-btn" href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Confirmar Novo E-mail</a>
      </div>

      <!-- Caixa Híbrida de Código OTP -->
      <div class="otp-box" style="background-color: #f2f4f5; padding: 16px; border-radius: 16px; text-align: center; margin: 24px 0;">
        <p class="otp-text" style="margin: 0 0 8px; font-size: 13px; color: #3e4946;">Se o aplicativo solicitar um código de confirmação, utilize:</p>
        <span class="otp-token" style="font-family: 'Public Sans', 'Inter', monospace, sans-serif; font-size: 32px; font-weight: 700; color: #006a5e; letter-spacing: 4px; display: inline-block; padding: 6px 16px; background: #ffffff; border-radius: 10px; border: 1px dashed #bdc9c5; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">{{ .Token }}</span>
      </div>

      <!-- Bloco de Alerta -->
      <div class="warning-box" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p class="warning-text" style="margin: 0; font-size: 12px; line-height: 1.5; color: #7b5700;">
          <strong class="warning-title" style="color: #271900;">Aviso de Segurança e Uso Único:</strong> O link e o código expiram em **1 hora** e podem ser usados **uma única vez**. Se você não solicitou essa troca, ignore este e-mail.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div class="divider" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p class="alt-link-text" style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div class="alt-link-box" style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a class="alt-link-url" href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="email-footer" style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', 'Inter', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 7. Template: Invite User

**Subject:**
```
Seu convite para a plataforma Dosiq chegou!
```

**Body (HTML):**
```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">

<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Lexend:wght@400;500;700&family=Public+Sans:wght@600;700&display=swap" rel="stylesheet" type="text/css">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  
  @media (prefers-color-scheme: dark) {
    .email-container { background-color: #121212 !important; }
    .email-card { background-color: #1a1e1f !important; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4) !important; }
    .email-title { color: #21e2cd !important; }
    .email-body-text { color: #c4c7c5 !important; }
    .info-box { background-color: #102130 !important; border-left-color: #1d72d6 !important; }
    .info-text { color: #d0e2ff !important; }
    .alt-link-box { background-color: #24292a !important; }
    .alt-link-text { color: #c4c7c5 !important; }
    .alt-link-url { color: #21e2cd !important; }
    .email-footer { background-color: #24292a !important; border-top-color: #313738 !important; color: #a9b0ae !important; }
    .email-footer strong { color: #e1e3e2 !important; }
    .email-footer a { color: #21e2cd !important; }
  }
  
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', 'Montserrat', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', 'Quicksand', system-ui, -apple-system, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 class="email-title" style="font-family: 'Public Sans', 'Inter', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Você foi convidado!</h2>
      <p class="email-body-text" style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Você recebeu um convite especial para fazer parte do Dosiq — a plataforma inteligente que simplifica, acompanha e cuida do seu tratamento de saúde de forma premium e 100% gratuita.</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a class="email-btn" href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Aceitar Convite e Criar Senha</a>
      </div>

      <!-- Bloco de Alerta -->
      <div class="info-box" style="background-color: #eff6ff; border-left: 4px solid #005db6; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p class="info-text" style="margin: 0; font-size: 12px; line-height: 1.5; color: #001b3d;">
          <strong style="color: #005db6;">Onboarding Seguro:</strong> Ao aceitar o convite, você poderá definir sua senha pessoal para o primeiro acesso. O link acima é válido por **1 hora**.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div class="divider" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p class="alt-link-text" style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div class="alt-link-box" style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a class="alt-link-url" href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="email-footer" style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', 'Inter', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 8. Variáveis do Supabase e Guia de OTP Numérico

Os templates do Supabase aceitam variáveis dinâmicas que podem ser utilizadas tanto para fluxos de link direto quanto para códigos numéricos de verificação rápida (OTP):

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `{{ .ConfirmationURL }}` | String (URL) | Link completo contendo o token de confirmação/reset gerado pelo GoTrue. |
| `{{ .Token }}` | String (8 dígitos) | O código OTP numérico de 8 dígitos que o usuário pode digitar diretamente no aplicativo (gerenciado em 8 dígitos nativamente pelo Supabase GoTrue para fluxos de e-mail). |
| `{{ .Email }}` | String | O endereço de e-mail do destinatário. |

---

### 💡 Guia Prático: Transição de Links de Confirmação para OTP Numérico

Utilizar o **OTP numérico de 8 dígitos** resolve os problemas de links inválidos causados por antivírus de e-mail (*Link Harvesters*). A implementação é feita em duas partes:

#### A. Mudança no Template de E-mail
Ao adotar o design híbrido (proposto neste guia), o e-mail já exibe a variável `{{ .Token }}` de forma proeminente. O usuário receberá tanto o link clássico quanto o código de confirmação no corpo da mensagem.

#### B. Mudança no Frontend do Dosiq (Validação no App)
1. O fluxo de cadastro (`signUp`) permanece idêntico.
2. Em vez de instruir o usuário a "abrir seu e-mail e clicar", o aplicativo exibe uma tela com um formulário de entrada para o código OTP.
3. Para uma experiência mobile premium, configure o input do código no React com o atributo:
   `autocomplete="one-time-code"` (isso faz com que o teclado do iOS/Android sugira o código direto da notificação do e-mail).
4. Submeta o código e o e-mail do usuário usando o método `verifyOtp` do SDK do Supabase:

```javascript
const { data, session, error } = await supabase.auth.verifyOtp({
  email: userEmail,
  token: otpCode,        // Os dígitos fornecidos (ex: "19971511")
  type: 'signup'         // Tipos válidos: 'signup', 'recovery', 'magiclink', 'email_change'
});

if (session) {
  // Usuário confirmado e conectado com sucesso!
}
```

---

## 9. Configuração de URLs no Painel

**Dashboard → Authentication → URL Configuration**

| Campo | Valor |
|-------|-------|
| Site URL | `https://dosiq.app` |
| Additional Redirect URLs | `dosiq://auth/callback` (deep link mobile) |

---

## 10. SMTP (Configurado em Produção — Brevo)

O Dosiq utiliza o **Brevo** como provedor oficial de SMTP transacional. Essa escolha garante excelente entregabilidade para caixas de entrada no Brasil (incluindo provedores legados locais) e viabiliza o envio a partir do domínio proprietário `dosiq.app` de forma gratuita (limite de 300 e-mails/dia).

Acesse **Dashboard → Authentication → SMTP Settings** e configure os seguintes parâmetros:

- **Sender Email:** `noreply@dosiq.app` (remetente verificado)
- **Sender Name:** `Dosiq`
- **Host:** `smtp-relay.brevo.com`
- **Port:** `587`
- **Enable SSL:** Sim (TLS)
- **Username:** Seu e-mail de login do Brevo
- **Password:** Chave SMTP gerada no painel do Brevo (`xsmtpsib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx`)

---

## 11. Teste Manual e Checklist de Homologação

1. **Dashboard:** Authentication → Email Templates → Clique em **"Send test email"** nos templates ajustados.
2. **Caixa de Entrada:** Valide a abertura em clientes móveis (Outlook no iOS em Modo Claro e Escuro).
3. **Ergonomia Visual Dark:** O fundo branco deve ter sido invertido para preto ou cinza escuro, mas todos os títulos (agora classe `.email-title` com `#21e2cd`) e textos (classe `.email-body-text` com `#c4c7c5`) devem permanecer legíveis com excelente contraste luminoso.
