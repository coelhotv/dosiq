/**
 * E-mails da fila de exclusão (spec 107 FR-015) — envio manual assistido pelo admin, a partir de
 * privacidade@dosiq.app. Fonte única: o admin web copia daqui (HTML + texto) e o runbook cita.
 *
 * 🔴 INV-4 / AS-3.2: nenhum dado de saúde, nome de remédio, dose ou condição — o e-mail pode ser lido
 *    por cima do ombro, na tela de bloqueio ou numa caixa compartilhada.
 * 🔴 Anti-phishing: só links para domínios nossos ou das lojas, com o endereço VISÍVEL; nenhum link de
 *    login/confirmação; a frase "nunca pedimos senha" vai em todas as variantes.
 * Puro (sem I/O, sem Date): quem chama passa as datas já formatadas (dd/mm/aaaa).
 */

export const PRUNE_EMAIL_LINKS = Object.freeze({
  appStore: 'https://apps.apple.com/br/app/dosiq-inteligencia-em-doses/id6762740948',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.coelhotv.dosiq',
  web: 'https://dosiq.app',
  privacy: 'https://dosiq.app/politica-de-privacidade',
  terms: 'https://dosiq.app/termos-de-uso.html',
  contact: 'privacidade@dosiq.app',
} as const)

/** Controlador (LGPD art. 9) — mesmo texto dos Termos de Uso v0.4. */
export const PRUNE_EMAIL_CONTROLLER =
  'DOSIQ DIGITAL HEALTH WEB DESIGN LTDA · CNPJ 68.335.606/0001-11 · Rua Pais Leme, 215, cj 1713, Pinheiros, São Paulo/SP'

/**
 * revoked          retirou a autorização (D+60/D+83 de `revoked_90d`)
 * never_consented  nunca autorizou (onda 2 do legado, D+60/D+83 de legado/onboarding)
 * reaviso          perdeu os avisos: último aviso, prazo de 7 dias (FR-014)
 */
export type PruneEmailVariant = 'revoked' | 'never_consented' | 'reaviso'

/** Variante pela linha da fila e pelo marco. `wave2` não tem linha: é sempre `never_consented`. */
export function pruneEmailVariant(reason: string | null | undefined, milestone: string): PruneEmailVariant {
  if (milestone === 'reaviso') return 'reaviso'
  return reason === 'revoked_90d' ? 'revoked' : 'never_consented'
}

interface Copy {
  subject: string
  title: string
  paragraphs: string[]
  action: string
}

function copyFor(variant: PruneEmailVariant): Copy {
  if (variant === 'revoked') {
    return {
      subject: 'Sua conta no dosiq precisa de uma ação',
      title: 'Sua conta será excluída em {prazo}',
      paragraphs: [
        'Você retirou a autorização de uso de dados no dosiq. Como prevê a nossa Política de Privacidade, sem essa autorização a conta e os dados dela são excluídos.',
        'No seu caso, a exclusão está marcada para {prazo}.',
      ],
      action: 'Quer continuar usando? Abra o app e autorize novamente. Prefere encerrar? Não precisa fazer nada, ou exclua a conta agora pelo próprio app.',
    }
  }
  if (variant === 'reaviso') {
    return {
      subject: 'Último aviso: sua conta no dosiq será excluída em {prazo}',
      title: 'Último aviso: exclusão em {prazo}',
      paragraphs: [
        'Sua conta no dosiq está sem a autorização de uso de dados, e não conseguimos avisar você antes pelo app.',
        'Por isso, damos mais 7 dias: a conta e os dados dela serão excluídos em {prazo}.',
      ],
      action: 'Para manter a conta, abra o app (atualizado pela loja) e autorize o uso de dados. Se preferir encerrar, não precisa fazer nada, ou exclua a conta agora pelo próprio app.',
    }
  }
  return {
    subject: 'Sua conta no dosiq precisa de uma ação',
    title: 'Autorize até {prazo} para manter sua conta',
    paragraphs: [
      'Você tem uma conta no dosiq, mas ainda não autorizou o uso de dados no app. Sem essa autorização, como prevê a nossa Política de Privacidade, a conta e os dados dela são excluídos.',
      'A exclusão está marcada para {prazo}.',
    ],
    action: 'Para manter a conta, atualize o app pela loja, abra e toque em "Autorizar e continuar". Se preferir encerrar, não precisa fazer nada, ou exclua a conta agora pelo próprio app.',
  }
}

const SAFETY = 'O dosiq nunca pede senha, código ou dados de pagamento por e-mail. Na dúvida, não clique: abra o app direto pela loja.'
const WHY = 'Você recebeu este e-mail porque tem uma conta no dosiq. É uma comunicação sobre a sua conta, não publicidade.'

const fill = (s: string, deadline: string) => s.split('{prazo}').join(deadline)

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const link = (href: string, label: string) =>
  `<a href="${href}" target="_blank" style="color: #006a5e; font-weight: 600; text-decoration: underline;">${escapeHtml(label)}</a>`
// URL visível como texto do link (anti-phishing): o que se lê é para onde vai.
const visible = (href: string) => link(href, href.replace(/^https:\/\//, ''))
// Selo oficial da loja, com o domínio escrito logo abaixo (o destino continua legível).
const badge = (href: string, img: string, alt: string) =>
  `<a href="${href}" target="_blank" style="text-decoration: none; display: inline-block;"><img src="${img}" alt="${escapeHtml(alt)}" width="160" style="display: block; width: 160px; height: auto; border: 0;" /></a>`

function html(c: Copy, deadline: string): string {
  const p = (text: string, extra = '') =>
    `<p style="margin: 0 0 14px 0; ${extra}">${escapeHtml(fill(text, deadline))}</p>`
  const L = PRUNE_EMAIL_LINKS
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 32px 0; font-family: ${FONT};">
  <tr><td align="center">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; padding: 0 16px;">
      <tr><td align="center" style="padding-bottom: 20px;">
        <img src="https://dosiq.app/dosiq-logo-verde.png" alt="dosiq" width="40" height="40" style="display: inline-block; vertical-align: middle; width: 40px; height: 40px; border-radius: 50%; border: 0;" />
        <span style="font-size: 24px; font-weight: 800; color: #006a5e; vertical-align: middle; padding-left: 8px;">dosiq</span>
      </td></tr>
      <tr><td style="background-color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; color: #334155; font-size: 16px; line-height: 25px;">
        <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">${escapeHtml(fill(c.title, deadline))}</p>
        ${c.paragraphs.map((t) => p(t)).join('\n        ')}
        ${p(c.action, 'font-weight: 600; color: #0f172a;')}
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 8px 0 20px 0; background-color: #f8fafc; border-radius: 12px;">
          <tr><td align="center" style="padding: 20px 16px 4px 16px; font-size: 15px; font-weight: 700; color: #0f172a;">Baixar ou atualizar o app</td></tr>
          <tr><td align="center" style="padding: 12px 16px 0 16px;">
            ${badge(L.appStore, 'https://dosiq.app/download-ios.png', 'Baixar na App Store')}
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">iPhone · apps.apple.com</p>
          </td></tr>
          <tr><td align="center" style="padding: 16px 16px 0 16px;">
            ${badge(L.googlePlay, 'https://dosiq.app/download-android.png', 'Disponível no Google Play')}
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">Android · play.google.com</p>
          </td></tr>
          <tr><td align="center" style="padding: 18px 16px 20px 16px; font-size: 14px;">
            Prefere usar no navegador? ${visible(L.web)}
          </td></tr>
        </table>
        <p style="margin: 0 0 14px 0; font-size: 14px;">Regras do dosiq: ${link(L.privacy, 'Política de Privacidade')} · ${link(L.terms, 'Termos de Uso')}</p>
        <p style="margin: 0 0 14px 0; font-size: 14px;">Dúvidas? É só responder este e-mail (${escapeHtml(L.contact)}).</p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">🔒 ${escapeHtml(SAFETY)}</p>
      </td></tr>
      <tr><td align="center" style="padding-top: 20px; color: #64748b; font-size: 12px; line-height: 18px;">
        <p style="margin: 0 0 6px 0;">${escapeHtml(WHY)}</p>
        <p style="margin: 0;">${escapeHtml(PRUNE_EMAIL_CONTROLLER)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`
}

function text(c: Copy, deadline: string): string {
  const L = PRUNE_EMAIL_LINKS
  return [
    fill(c.title, deadline),
    '',
    ...c.paragraphs.map((t) => fill(t, deadline)),
    '',
    fill(c.action, deadline),
    '',
    'Baixar ou atualizar o app:',
    `- App Store (iPhone): ${L.appStore}`,
    `- Google Play (Android): ${L.googlePlay}`,
    `- No navegador: ${L.web}`,
    '',
    `Política de Privacidade: ${L.privacy}`,
    `Termos de Uso: ${L.terms}`,
    `Dúvidas? É só responder este e-mail (${L.contact}).`,
    '',
    SAFETY,
    '',
    '—',
    WHY,
    PRUNE_EMAIL_CONTROLLER,
  ].join('\n')
}

/** Assunto + corpo HTML (para colar no Gmail) + corpo texto (fallback). `deadline` já formatada. */
export function buildPruneEmail(variant: PruneEmailVariant, deadline: string): { subject: string; html: string; text: string } {
  const c = copyFor(variant)
  return { subject: fill(c.subject, deadline), html: html(c, deadline), text: text(c, deadline) }
}
