/**
 * LandingSections — Seções estáticas da Landing page.
 */
import { useState } from 'react'
import { signupForBeta } from '@shared/services/betaSignupService'
import {
  ZapIcon,
  DatabaseIcon,
  LockIcon,
  MessageCircleIcon,
  PackageIcon,
  FileTextIcon,
  ShieldCheckIcon,
  ActivityIcon,
  SmartphoneIcon,
  ClockIcon,
  DownloadIcon,
  CircleCheckIcon,
} from './LandingIcons'

export function LandingSolucoes() {
  return (
    <section id="solucoes" className="lp-section lp-section--muted">
      <div className="lp-shell">
        <div className="lp-section__intro lp-section__intro--center">
          <h2>Seu tratamento sempre em dia</h2>
          <p>
            Uma ferramenta completa para organizar seus remédios, simplificada para o dia a dia.
            Sem assinaturas e 100% gratuita.
          </p>
        </div>

        <div className="lp-card-grid lp-card-grid--three">
          <div className="lp-card">
            <div className="lp-card__icon"><ZapIcon className="lp-text-green" size={24} /></div>
            <div className="lp-card__eyebrow">Sempre Grátis</div>
            <h3>100% Gratuito</h3>
            <p>Lembretes e medicamentos ilimitados. Sem paywall para cuidar da sua saúde, sem trials ou cobranças escondidas.</p>
          </div>

          <div className="lp-card">
            <div className="lp-card__icon"><DatabaseIcon className="lp-text-blue" size={24} /></div>
            <div className="lp-card__eyebrow">Dados Oficiais</div>
            <h3>Base ANVISA</h3>
            <p>Autocompletar integrado com a base ativa da ANVISA para cadastro rápido. Evite erros de digitação de forma simples.</p>
          </div>

          <div className="lp-card">
            <div className="lp-card__icon"><MessageCircleIcon className="lp-text-sky" size={24} /></div>
            <div className="lp-card__eyebrow">Flexível</div>
            <h3>Alertas Multicanal</h3>
            <p>Receba notificações push no celular ou lembretes no Telegram. E muito em breve com suporte direto ao WhatsApp.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingFuncionalidades() {
  return (
    <section id="funcionalidades" className="lp-section">
      <div className="lp-shell">
        <div className="lp-feature-head">
          <div className="lp-section__intro">
            <h2>Clareza total sobre o seu tratamento.</h2>
            <p>Mais autonomia para cuidar de você no dia a dia, e um histórico completo para levar à sua próxima consulta.</p>
          </div>
          <div className="lp-info-card">
            <p className="lp-info-card__title">Transparência Total</p>
            <p className="lp-info-card__text">Projeto de código aberto focado na segurança e no controle do paciente. Seus dados protegidos, sem letras miúdas.</p>
          </div>
        </div>

        <div className="lp-feature-grid">
          <div className="lp-feature"><div className="lp-feature__icon"><PackageIcon size={20} /></div><h4>Controle de Estoque</h4><p>Alertas automáticos quando seus comprimidos estão acabando.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><FileTextIcon size={20} /></div><h4>PDF para o Médico</h4><p>Gere relatórios profissionais com seu histórico de adesão em um clique.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><ShieldCheckIcon size={20} /></div><h4>Cartão de Emergência</h4><p>Acesso offline aos seus medicamentos ativos para situações de urgência.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><ActivityIcon size={20} /></div><h4>Score de Adesão</h4><p>Acompanhe sua evolução com streaks e metas semanais de tomada.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><SmartphoneIcon size={20} /></div><h4>Use em Qualquer Lugar</h4><p>Baixe o app nativo nas lojas ou acesse direto pelo navegador do seu computador.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><ClockIcon size={20} /></div><h4>Protocolos Flexíveis</h4><p>Diário, semanal, personalizado ou desmame progressivo (titulação).</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><DownloadIcon size={20} /></div><h4>Portabilidade Total</h4><p>Exporte seus dados em CSV ou JSON a qualquer momento (lei LGPD).</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><LockIcon size={20} /></div><h4>Privacidade Total</h4><p>Seus dados são criptografados. Sem anúncios de terceiros ou venda de dados.</p></div>
        </div>
      </div>
    </section>
  )
}

export function LandingPrivacidade() {
  return (
    <section id="privacidade" className="lp-section lp-section--dark">
      <div className="lp-dark-glow" />
      <div className="lp-shell">
        <div className="lp-dark-grid">
          <div>
            <div className="lp-pill lp-pill--dark">
              <LockIcon size={16} />
              <span>Dados Protegidos, Nunca Vendidos</span>
            </div>
            <h2>Seu histórico sob seu controle.</h2>
            <p className="lp-dark-copy">
              Acreditamos que dados de saúde não devem ser mercadoria. Por isso, usamos
              criptografia <b>HTTPS</b> em trânsito e isolamento por <b>Row Level Security (RLS)</b>,
              que restringe o acesso a cada registro ao seu próprio dono. Seu histórico não é
              vendido nem compartilhado com terceiros.
            </p>

            <ul className="lp-check-list">
              <li><CircleCheckIcon className="lp-text-green" size={18} />Sem rastreadores de publicidade</li>
              <li><CircleCheckIcon className="lp-text-green" size={18} />Sem venda de dados para farmácias</li>
              <li><CircleCheckIcon className="lp-text-green" size={18} />Arquitetura técnica segura (HTTPS e RLS)</li>
              <li><CircleCheckIcon className="lp-text-green" size={18} />Exportação completa (CSV/JSON)</li>
            </ul>

            <a
              className="lp-dark-link"
              href="/politica-de-privacidade.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ler a política de privacidade
            </a>
          </div>

          <div className="lp-quote-card">
            <div className="lp-quote-card__head">
              <div className="lp-quote-card__shield">
                <ShieldCheckIcon className="lp-text-blue-light" size={24} />
              </div>
              <div>
                <p className="lp-quote-card__title">Ética por Padrão</p>
                <p className="lp-quote-card__subtitle">Transparência Técnica</p>
              </div>
            </div>
            <p className="lp-quote-card__text">
              &quot;Acreditamos que informações de saúde são sensíveis e sagradas.
              Construímos uma ferramenta auditável e segura, garantindo que a tecnologia
              sirva ao paciente, e não o contrário.&quot;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// Link da App Store (iOS já publicado).
const APP_STORE_URL = 'https://apps.apple.com/br/app/dosiq-intelig%C3%AAncia-em-doses/id6762740948'

/**
 * LandingApp — promove o app nativo.
 * iOS: já na App Store (botão direto). Android: em testes fechados → captura
 * de e-mail para entrar na lista do closed testing (12 testers / 2 semanas).
 */
export function LandingApp() {
  // States
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [error, setError] = useState('')

  // Handlers
  async function handleAndroidSubmit(e) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    setError('')
    const { success, error: err } = await signupForBeta(email, 'android')
    if (success) {
      setStatus('success')
      setEmail('')
    } else {
      setStatus('error')
      setError(err || 'Não foi possível registrar agora.')
    }
  }

  return (
    <section id="app" className="lp-section lp-section--muted">
      <div className="lp-shell">
        <div className="lp-section__intro lp-section__intro--center">
          <div className="lp-pill">
            <SmartphoneIcon size={16} />
            <span>Agora também no celular</span>
          </div>
          <h2>Leve o Dosiq no bolso.</h2>
          <p>O app nativo traz lembretes na hora certa, mesmo offline.</p>
        </div>

        <div className="lp-app-grid">
          {/* iOS — disponível */}
          <div className="lp-app-card">
            <div className="lp-app-card__body">
              <div className="lp-card__eyebrow">iPhone (iOS)</div>
              <h4>Disponível para iPhones</h4>
              <p>Baixe agora e ative os lembretes em segundos.</p>
            </div>
            <div className="lp-app-card__cta">
              <a
                className="lp-app-badge"
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Baixar na App Store"
              >
                <img src="/download-ios.png" alt="Disponível na App Store" />
              </a>
            </div>
          </div>

          {/* Android — closed testing → captura de e-mail */}
          <div className="lp-app-card">
            <div className="lp-app-card__body">
              <div className="lp-card__eyebrow">Android</div>
              <h4>Android em breve...</h4>
              {status === 'success' ? (
                <p className="lp-app-success">
                  <CircleCheckIcon className="lp-text-green" size={18} />
                  Pronto! Você entrou na lista. Avisamos quando liberar o acesso.
                </p>
              ) : (
                <>
                  <p>Deixe seu e-mail para entrar na lista de testadores e receber o convite.</p>
                  <form className="lp-app-form" onSubmit={handleAndroidSubmit} noValidate>
                    <input
                      type="email"
                      className="lp-app-input"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      aria-label="Seu e-mail para o beta Android"
                      maxLength={254}
                      required
                    />
                    <button
                      type="submit"
                      className="lp-btn lp-btn--primary"
                      disabled={status === 'loading'}
                    >
                      {status === 'loading' ? 'Enviando…' : 'Quero testar'}
                    </button>
                  </form>
                  {status === 'error' && <p className="lp-app-error">{error}</p>}
                </>
              )}
            </div>
            <div className="lp-app-card__cta">
              <img
                src="/download-android.png"
                alt="Em breve no Google Play"
                className="lp-app-badge-img lp-app-badge-img--soon"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
