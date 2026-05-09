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
Confirme seu cadastro no Dosiq
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0fdfb; padding: 24px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

    <div style="background: #006A5E; padding: 32px 24px; text-align: center;">
      <p style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -0.5px;">dosiq</p>
    </div>

    <div style="padding: 32px 24px;">
      <h2 style="font-size: 22px; color: #006A5E; margin: 0 0 16px;">Bem-vindo ao Dosiq!</h2>
      <p style="font-size: 16px; color: #555; margin: 0 0 16px;">Obrigado por se cadastrar. Clique no botão abaixo para confirmar seu email e ativar sua conta.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #006A5E; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Confirmar Email</a>
      </div>

      <p style="font-size: 13px; color: #999; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e5e5; word-break: break-all;">
        Ou copie este link no seu navegador:<br/>
        <span style="color: #006A5E;">{{ .ConfirmationURL }}</span>
      </p>
      <p style="font-size: 13px; color: #999; margin-top: 16px;">Este link expira em 24 horas.</p>
    </div>

    <div style="background: #f5f5f5; padding: 20px 24px; text-align: center; font-size: 13px; color: #999; border-top: 1px solid #e5e5e5;">
      Dosiq — Inteligência em Doses<br/>
      <a href="https://dosiq.vercel.app/politica-de-privacidade" style="color: #006A5E; text-decoration: none;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 3. Template: Reset Password

**Subject:**
```
Recupere sua senha do Dosiq
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0fdfb; padding: 24px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

    <div style="background: #006A5E; padding: 32px 24px; text-align: center;">
      <p style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -0.5px;">dosiq</p>
    </div>

    <div style="padding: 32px 24px;">
      <h2 style="font-size: 22px; color: #006A5E; margin: 0 0 16px;">Recuperação de Senha</h2>
      <p style="font-size: 16px; color: #555; margin: 0 0 16px;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #006A5E; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Criar Nova Senha</a>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #92400e; margin: 16px 0;">
        <strong>Segurança:</strong> Se você não solicitou esta recuperação, ignore este email. Sua conta permanecerá segura.
      </div>

      <p style="font-size: 13px; color: #999; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e5e5; word-break: break-all;">
        Ou copie este link no seu navegador:<br/>
        <span style="color: #006A5E;">{{ .ConfirmationURL }}</span>
      </p>
      <p style="font-size: 13px; color: #999; margin-top: 16px;">Este link expira em 24 horas.</p>
    </div>

    <div style="background: #f5f5f5; padding: 20px 24px; text-align: center; font-size: 13px; color: #999; border-top: 1px solid #e5e5e5;">
      Dosiq — Inteligência em Doses<br/>
      <a href="https://dosiq.vercel.app/politica-de-privacidade" style="color: #006A5E; text-decoration: none;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 4. Template: Magic Link

> **Status:** pré-configurado para uso futuro — ativar quando implementar `supabase.auth.signInWithOtp({ email })` no app.

**Subject:**
```
Seu link de acesso ao Dosiq
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0fdfb; padding: 24px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

    <div style="background: #006A5E; padding: 32px 24px; text-align: center;">
      <p style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -0.5px;">dosiq</p>
    </div>

    <div style="padding: 32px 24px;">
      <h2 style="font-size: 22px; color: #006A5E; margin: 0 0 16px;">Seu link de acesso</h2>
      <p style="font-size: 16px; color: #555; margin: 0 0 8px;">Clique no botão abaixo para entrar no Dosiq sem precisar de senha.</p>
      <p style="font-size: 14px; color: #999; margin: 0 0 24px;">O link é válido por 1 hora e pode ser usado uma única vez.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #006A5E; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Entrar no Dosiq</a>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #92400e; margin: 16px 0;">
        <strong>Segurança:</strong> Se você não solicitou este link, ignore este email. Sua conta permanecerá segura.
      </div>

      <p style="font-size: 13px; color: #999; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e5e5; word-break: break-all;">
        Ou copie este link no seu navegador:<br/>
        <span style="color: #006A5E;">{{ .ConfirmationURL }}</span>
      </p>
    </div>

    <div style="background: #f5f5f5; padding: 20px 24px; text-align: center; font-size: 13px; color: #999; border-top: 1px solid #e5e5e5;">
      Dosiq — Inteligência em Doses<br/>
      <a href="https://dosiq.vercel.app/politica-de-privacidade" style="color: #006A5E; text-decoration: none;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

---

## 5. Template: Password Changed

> **Localização:** Dashboard → Authentication → Email Templates → **Security → Password changed**

**Subject:**
```
Sua senha do Dosiq foi alterada
```

**Body (HTML — somente conteúdo do body, sem `<html>`/`<head>`/`<style>`):**
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0fdfb; padding: 24px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

    <div style="background: #006A5E; padding: 32px 24px; text-align: center;">
      <p style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -0.5px;">dosiq</p>
    </div>

    <div style="padding: 32px 24px;">
      <h2 style="font-size: 22px; color: #006A5E; margin: 0 0 16px;">Senha alterada com sucesso</h2>
      <p style="font-size: 16px; color: #555; margin: 0 0 16px;">Sua senha foi alterada. Se você realizou esta alteração, nenhuma ação é necessária.</p>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #92400e; margin: 16px 0;">
        <strong>Não foi você?</strong> Se você não alterou sua senha, sua conta pode estar comprometida. Entre em contato conosco imediatamente ou redefina sua senha.
      </div>
    </div>

    <div style="background: #f5f5f5; padding: 20px 24px; text-align: center; font-size: 13px; color: #999; border-top: 1px solid #e5e5e5;">
      Dosiq — Inteligência em Doses<br/>
      <a href="https://dosiq.vercel.app/politica-de-privacidade" style="color: #006A5E; text-decoration: none;">Política de Privacidade</a>
    </div>

  </div>
</div>
```

> **Outros hooks de segurança disponíveis** (configurar conforme features forem implementadas):
> | Hook | Quando ativar |
> |------|--------------|
> | Email address changed | Ao implementar troca de email em Settings |
> | Phone number changed | Ao implementar autenticação por SMS |
> | Identity linked / unlinked | Ao implementar login social (Google, Apple) |
> | MFA method added / removed | Ao implementar autenticação multifator |

---

## 7. Variáveis de Template Supabase

| Variável | Descrição |
|----------|-----------|
| `{{ .ConfirmationURL }}` | Link completo de confirmação/reset gerado pelo Supabase |
| `{{ .Email }}` | Email do usuário (disponível mas não obrigatório) |

---

## 8. Configuração de URLs

**Dashboard → Authentication → URL Configuration**

| Campo | Valor |
|-------|-------|
| Site URL | `https://dosiq.vercel.app` |
| Additional Redirect URLs | `dosiq://auth/callback` (deep link mobile) |

---

## 9. SMTP (Opcional)

Por padrão, Supabase usa seu email transacional built-in (adequado para desenvolvimento e tráfego baixo).

Para produção com alto volume, configure SMTP via **Dashboard → Authentication → SMTP Settings**:

**Opção recomendada — Resend:**
- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: `re_xxxxxxxxxxxxxxxx` (API key do Resend)
- Sender: domínio verificado no Resend

**Alternativa — SendGrid:**
- Host: `smtp.sendgrid.net`
- Port: `587`
- Username: `apikey`
- Password: chave API do SendGrid

---

## 10. Teste Manual

### Via Dashboard

1. **Supabase Dashboard → Authentication → Email Templates**
2. Selecionar template → clicar **"Send test email"** (disponível no painel de cada template)
3. Verificar: assunto, branding, botão CTA, link alternativo, footer

### Via Dashboard (teste end-to-end)

1. **Authentication → Users → [email do usuário]**
2. Clicar **"Send recovery email"** para testar reset de senha

### Via app

1. Tela de cadastro → cadastrar com email válido → verificar email recebido
2. Tela de recuperação → solicitar reset → verificar email recebido
3. Clicar no link → verificar redirecionamento correto

---

## 11. Checklist Pré-Deploy

- [ ] Template "Confirm signup": subject + HTML corretos
- [ ] Template "Reset password": subject + HTML + warning block corretos
- [ ] Template "Magic link": subject + HTML corretos (ativar quando implementar OTP login)
- [ ] Template "Password changed" (Security): subject + HTML + warning block corretos
- [ ] Todos templates: logo dosiq visível, botão verde (#006A5E) onde aplicável, footer com política
- [ ] Site URL configurada: `https://dosiq.vercel.app`
- [ ] Redirect URLs incluem `dosiq://auth/callback`
- [ ] SMTP configurado (se tráfego > limite Supabase built-in)
- [ ] Teste manual de ambos templates enviado e visualizado
- [ ] Deep link `dosiq://auth/callback` testado em device físico

---

## 12. Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|---------------|------|
| Email não chega | SMTP misconfigured ou rate limit | Verificar logs em Dashboard → Auth → Logs |
| Link 404 após clique | Site URL incorreta | Corrigir URL Configuration |
| `dosiq://` não abre app | Redirect URL não registrada | Adicionar em Additional Redirect URLs |
| Email sem branding | Template padrão ainda ativo | Salvar template customizado no Dashboard |
