# Configuração de Emails Transacionais — Supabase + Dosiq

Guia para configurar templates de email branded para confirmação de cadastro e recuperação de senha.

---

## 1. Localização

**Supabase Dashboard → Authentication → Email Templates**

Dois templates obrigatórios:
- `Confirm signup` — enviado após `supabase.auth.signUp()`
- `Reset password` — enviado após `supabase.auth.resetPasswordForEmail()`

---

## 2. Template: Confirm Signup

**Subject:**
```
Dosiq — Ativação de conta
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header com Gradiente Oficial do Santuário Terapêutico -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', cursive, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 style="font-family: 'Public Sans', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Bem-vindo ao Dosiq!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Obrigado por se cadastrar. Escolha uma das opções abaixo para confirmar seu e-mail e ativar sua conta para começarmos:</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Confirmar Conta</a>
      </div>

      <!-- Caixa Híbrida de Código OTP -->
      <div style="background-color: #f2f4f5; padding: 16px; border-radius: 16px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #3e4946;">Se o aplicativo solicitar um código de confirmação, utilize:</p>
        <span style="font-family: 'Public Sans', monospace, sans-serif; font-size: 32px; font-weight: 700; color: #006a5e; letter-spacing: 4px; display: inline-block; padding: 6px 16px; background: #ffffff; border-radius: 10px; border: 1px dashed #bdc9c5; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">{{ .Token }}</span>
      </div>

      <!-- Bloco de Alerta do Design System (card-alert-warning) -->
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #7b5700;">
          <strong style="color: #271900;">Aviso sobre acessos e uso único:</strong> Os acessos acima são seguros, válidos por 1 hora e podem ser clicados ou inseridos **apenas uma única vez**. Caso ocorra erro de "link inválido", basta solicitar um novo envio pelo aplicativo.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
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

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', cursive, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 style="font-family: 'Public Sans', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Recuperação de Senha</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Recebemos uma solicitação para redefinir a senha associada à sua conta no Dosiq. Escolha uma das opções abaixo:</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Criar Nova Senha</a>
      </div>

      <!-- Caixa Híbrida de Código OTP -->
      <div style="background-color: #f2f4f5; padding: 16px; border-radius: 16px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #3e4946;">Se o aplicativo solicitar um código de 6 dígitos, utilize:</p>
        <span style="font-family: 'Public Sans', monospace, sans-serif; font-size: 32px; font-weight: 700; color: #006a5e; letter-spacing: 4px; display: inline-block; padding: 6px 16px; background: #ffffff; border-radius: 10px; border: 1px dashed #bdc9c5; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">{{ .Token }}</span>
      </div>

      <!-- Bloco de Alerta do Design System (card-alert-warning) -->
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #7b5700;">
          <strong style="color: #271900;">Aviso de Segurança e Uso Único:</strong> O link e o código acima expiram em **1 hora** e perdem a validade após o primeiro clique ou preenchimento. Se você não fez essa solicitação, pode ignorar este e-mail; sua conta permanecerá segura.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 4. Template: Magic Link

> **Status:** pré-configurado para uso futuro — ativar quando implementar `supabase.auth.signInWithOtp({ email })` no app.

**Subject:**
```
Dosiq — Link de acesso rápido
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', cursive, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 style="font-family: 'Public Sans', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 12px; letter-spacing: -0.02em;">Seu Acesso Rápido</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Clique no botão ou insira o código abaixo para entrar na sua conta instantaneamente, sem precisar de senha.</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Entrar no Dosiq</a>
      </div>

      <!-- Caixa Híbrida de Código OTP -->
      <div style="background-color: #f2f4f5; padding: 16px; border-radius: 16px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #3e4946;">Se o aplicativo solicitar um código de verificação, utilize:</p>
        <span style="font-family: 'Public Sans', monospace, sans-serif; font-size: 32px; font-weight: 700; color: #006a5e; letter-spacing: 4px; display: inline-block; padding: 6px 16px; background: #ffffff; border-radius: 10px; border: 1px dashed #bdc9c5; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">{{ .Token }}</span>
      </div>

      <!-- Bloco de Alerta do Design System (card-alert-warning) -->
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #7b5700;">
          <strong style="color: #271900;">Aviso de Segurança:</strong> Este acesso é válido por **1 hora** e perde a validade após o primeiro clique ou preenchimento. Se você não solicitou este acesso, pode ignorar este e-mail com segurança.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 5. Template: Password Changed

> **Localização:** Dashboard → Authentication → Email Templates → **Security → Password changed**

**Subject:**
```
Segurança Dosiq — Senha alterada
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', cursive, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 style="font-family: 'Public Sans', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Senha Alterada com Sucesso</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 16px;">Sua credencial de acesso ao Dosiq foi modificada recentemente. Se foi você quem realizou essa alteração, está tudo pronto e nenhuma ação adicional é necessária.</p>

      <!-- Bloco de Alerta Crítico do Design System (card-alert-critical) -->
      <div style="background-color: #ffdad6; border-left: 4px solid #ba1a1a; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #93000a;">
          <strong style="color: #ba1a1a;">Não reconhece essa ação?</strong> Se você não alterou sua senha recentemente, sua conta pode estar sob risco de acesso não autorizado. Por favor, solicite uma nova redefinição imediatamente através da tela de login ou entre em contato com nossa equipe de suporte.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 6. Template: Email Address Change (Troca de E-mail)

> **Localização:** Dashboard → Authentication → Email Templates → **Change email address**

**Subject:**
```
Segurança Dosiq — Confirmação de novo e-mail
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', cursive, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 style="font-family: 'Public Sans', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Alteração de E-mail</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Recebemos uma solicitação para alterar o endereço de e-mail ({{ .Email }}) da sua conta no Dosiq para este novo endereço ({{ .NewEmail }}). Escolha uma das opções abaixo para confirmar:</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Confirmar Novo E-mail</a>
      </div>

      <!-- Caixa Híbrida de Código OTP -->
      <div style="background-color: #f2f4f5; padding: 16px; border-radius: 16px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #3e4946;">Se o aplicativo solicitar um código de confirmação, utilize:</p>
        <span style="font-family: 'Public Sans', monospace, sans-serif; font-size: 32px; font-weight: 700; color: #006a5e; letter-spacing: 4px; display: inline-block; padding: 6px 16px; background: #ffffff; border-radius: 10px; border: 1px dashed #bdc9c5; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">{{ .Token }}</span>
      </div>

      <!-- Bloco de Alerta do Design System (card-alert-warning) -->
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #7b5700;">
          <strong style="color: #271900;">Aviso de Segurança e Uso Único:</strong> O link e o código expiram em **1 hora** e podem ser usados **uma única vez**. Se você não solicitou essa troca, ignore este e-mail; nenhuma alteração será concluída sem a sua validação.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 7. Template: Invite User (Convite de Usuário)

> **Localização:** Dashboard → Authentication → Email Templates → **Invite user**

**Subject:**
```
Seu convite para a plataforma Dosiq chegou!
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<style>
  @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Public+Sans:wght@600;700&family=Lexend:wght@400;500;700&display=swap');
  @media only screen and (max-width: 480px) {
    .email-container { padding: 12px !important; }
    .email-card { padding: 24px 16px !important; border-radius: 16px !important; }
    .email-header { padding: 24px 16px !important; }
  }
</style>

<div class="email-container" style="font-family: 'Lexend', system-ui, -apple-system, sans-serif; background-color: #f8fafb; padding: 24px; margin: 0;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px -4px rgba(25, 28, 29, 0.04);">

    <!-- Header -->
    <div class="email-header" style="background: linear-gradient(135deg, #006a5e, #008577); padding: 36px 24px; text-align: center;">
      <p style="font-family: 'Comfortaa', cursive, sans-serif; font-size: 36px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -1.5px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">dosiq</p>
    </div>

    <!-- Conteúdo -->
    <div style="padding: 32px 24px;">
      <h2 style="font-family: 'Public Sans', system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #006a5e; margin: 0 0 16px; letter-spacing: -0.02em;">Você foi convidado!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #3e4946; margin: 0 0 24px;">Você recebeu um convite especial para fazer parte do Dosiq — a plataforma inteligente que simplifica, acompanha e cuida do seu tratamento de saúde de forma premium e 100% gratuita.</p>

      <!-- CTA Principal (Link Direto) -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #006a5e, #008577); color: #ffffff; padding: 14px 36px; border-radius: 20px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 106, 94, 0.15);">Aceitar Convite e Criar Senha</a>
      </div>

      <!-- Bloco de Alerta do Design System (card-alert-info) -->
      <div style="background-color: #eff6ff; border-left: 4px solid #005db6; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #001b3d;">
          <strong style="color: #005db6;">Onboarding Seguro:</strong> Ao aceitar o convite, você poderá definir sua senha pessoal para o primeiro acesso. O link acima é válido por **1 hora**.
        </p>
      </div>

      <!-- Link Alternativo -->
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #eceeef;">
        <p style="font-size: 12px; color: #3e4946; margin: 0 0 8px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <div style="background-color: #f2f4f5; padding: 12px; border-radius: 12px; font-size: 11px; word-break: break-all;">
          <a href="{{ .ConfirmationURL }}" style="color: #006a5e; text-decoration: none; font-weight: 500;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f2f4f5; padding: 20px 24px; text-align: center; font-size: 12px; color: #6d7a76; border-top: 1px solid #eceeef;">
      <strong style="color: #191c1d; font-family: 'Public Sans', sans-serif;">Dosiq</strong> — Inteligência em Doses<br/>
      <span style="font-size: 11px; display: inline-block; margin-top: 4px;">Este é um e-mail transacional de segurança. Por favor, não o responda.</span><br/>
      <a href="https://dosiq.app/politica-de-privacidade" style="color: #006a5e; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 8px;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

> **Outros hooks de segurança disponíveis** (configurar conforme features forem implementadas):
> | Hook | Quando ativar |
> |------|--------------|
> | Phone number changed | Ao implementar autenticação por SMS |
> | Identity linked / unlinked | Ao implementar login social (Google, Apple) |
> | MFA method added / removed | Ao implementar autenticação multifator |

---

## 8. Variáveis do Supabase e Guia de OTP Numérico

Os templates do Supabase aceitam variáveis dinâmicas que podem ser utilizadas tanto para fluxos de link direto quanto para códigos numéricos de verificação rápida (OTP):

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `{{ .ConfirmationURL }}` | String (URL) | Link completo contendo o token de confirmação/reset gerado pelo GoTrue. |
| `{{ .Token }}` | String (6 dígitos) | O código OTP numérico que o usuário pode digitar diretamente no aplicativo. |
| `{{ .Email }}` | String | O endereço de e-mail do destinatário. |

---

### 💡 Guia Prático: Transição de Links de Confirmação para OTP Numérico

Utilizar o **OTP de 6 dígitos** resolve os problemas de links inválidos causados por antivírus de e-mail (*Link Harvesters*). A implementação é feita em duas partes:

#### A. Mudança no Template de E-mail
Ao adotar o design híbrido (proposto neste guia), o e-mail já exibe a variável `{{ .Token }}` de forma proeminente. O usuário receberá tanto o link clássico quanto o código de 6 dígitos no corpo da mensagem.

#### B. Mudança no Frontend do Dosiq (Validação no App)
1. O fluxo de cadastro (`signUp`) permanece idêntico.
2. Em vez de instruir o usuário a "abrir seu e-mail e clicar", o aplicativo exibe uma tela com um formulário de entrada para o código OTP de 6 dígitos.
3. Para uma experiência mobile premium, configure o input do código no React com o atributo:
   `autocomplete="one-time-code"` (isso faz com que o teclado do iOS/Android sugira o código direto da notificação do e-mail).
4. Submeta o código e o e-mail do usuário usando o método `verifyOtp` do SDK do Supabase:

```javascript
const { data, session, error } = await supabase.auth.verifyOtp({
  email: userEmail,
  token: otpCode,        // Os 6 dígitos fornecidos (ex: "482019")
  type: 'signup'         // Tipos válidos: 'signup', 'recovery', 'magiclink', 'email_change'
});

if (session) {
  // Usuário confirmado e conectado com sucesso!
}
```

---

## 9. Configuração de URLs

**Dashboard → Authentication → URL Configuration**

| Campo | Valor |
|-------|-------|
| Site URL | `https://dosiq.app` |
| Additional Redirect URLs | `dosiq://auth/callback` (deep link mobile) |

---

## 10. SMTP (Configurado em Produção)

O Dosiq utiliza o **Brevo** (antigo Sendinblue) como provedor oficial de SMTP transacional. Essa escolha garante excelente entregabilidade para caixas de entrada no Brasil (incluindo provedores legados locais) e viabiliza o envio a partir do domínio proprietário `dosiq.app` de forma gratuita (limite de 300 e-mails/dia sem inserção de marca d'água promocional).

Acesse **Dashboard → Authentication → SMTP Settings** e configure os seguintes parâmetros:

**Provedor Principal — Brevo:**
- **Sender Email:** `noreply@dosiq.app` (ou o remetente oficial verificado em seu painel)
- **Sender Name:** `Dosiq`
- **Host:** `smtp-relay.brevo.com`
- **Port:** `587`
- **Enable SSL:** Sim (TLS)
- **Username:** Seu e-mail de login do Brevo
- **Password:** Chave SMTP gerada no painel do Brevo (`xsmtpsib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx`)

---

### Alternativas de Provedores SMTP (Referência)

**Opção — Resend:**
- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: `re_xxxxxxxxxxxxxxxx` (API key do Resend)
- Sender: domínio verificado no Resend

**Opção — SendGrid:**
- Host: `smtp.sendgrid.net`
- Port: `587`
- Username: `apikey`
- Password: chave API do SendGrid

---

## 11. Teste Manual

### Via Dashboard

1. **Supabase Dashboard → Authentication → Email Templates**
2. Selecionar o template desejado → clicar em **"Send test email"**
3. Verificar: carregamento da fonte Comfortaa/Lexend, visualização do gradiente no header, margens no mobile, visualização do código OTP e rodapé.

### Via Fluxo de Recuperação (End-to-End)

1. **Authentication → Users → [Selecionar Usuário]**
2. Clicar em **"Send recovery email"** para disparar o fluxo de reset de senha e verificar se o e-mail branded chega na caixa de entrada.

---

## 12. Checklist Pré-Deploy

- [ ] Template "Confirm signup": subject + HTML híbrido (Botão + Caixa de OTP `{{ .Token }}`) corretos
- [ ] Template "Reset password": subject + HTML híbrido + aviso de expiração/uso único corretos
- [ ] Template "Magic link": subject + HTML híbrido + aviso de uso único corretos
- [ ] Template "Password changed" (Security): subject + HTML + aviso crítico corretos
- [ ] Template "Email Address Change": subject + HTML híbrido + aviso de segurança corretos
- [ ] Template "Invite user": subject + HTML acolhedor corretos
- [ ] Todos os templates: brandmark `dosiq` em Comfortaa, botões arredondados premium e footers unificados
- [ ] Site URL configurada: `https://dosiq.app`
- [ ] Redirect URLs incluem `dosiq://auth/callback`
- [x] SMTP configurado (Brevo SMTP ativo para `@dosiq.app`)
- [ ] Teste manual de todos os templates enviado e visualizado no e-mail (Desktop e Mobile)
- [ ] Deep link `dosiq://auth/callback` testado em device físico

---

## 13. Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|---------------|------|
| E-mail não chega | Credenciais SMTP incorretas ou limite diário estourado | Verificar logs detalhados em **Dashboard → Auth → Logs** ou logs de envio no painel do Brevo. |
| Link dá "expired" ou "invalid" no primeiro clique | Filtros anti-spam de e-mail corporativo (*Link Harvesters*) escanearam e "clicaram" no link de uso único antes do usuário. | Migrar o fluxo do frontend para validação de **OTP Numérico** (utilizando a caixa com `{{ .Token }}` do e-mail) ou incluir um aviso claro para o usuário. |
| Link dá erro 404 | Site URL ou Redirect URL incorretos no painel | Ajustar a configuração em **Dashboard → Auth → URL Configuration**. |
| E-mail perde formatação no Gmail | CSS ou estilizações externas descartadas | Certificar-se de manter os estilos do HTML de template estritamente inline (como documentado neste guia). |
