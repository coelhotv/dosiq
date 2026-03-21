import React, { useEffect, useMemo, useRef } from 'react'
import AppPreview from '@shared/components/AppPreview'
import { useTheme } from '@shared/hooks/useTheme'
import './Landing.css'
import './LandingPrototype.css'

const DEV_VARIANT_PARAM = 'landingVariant'
const NEW_VARIANT_VALUES = new Set(['new', 'v2', 'b', 'prototype'])

function resolveLandingVariant() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return 'control'
  }

  const variantParam = new URLSearchParams(window.location.search).get(DEV_VARIANT_PARAM)

  if (variantParam && NEW_VARIANT_VALUES.has(variantParam.toLowerCase())) {
    return 'new'
  }

  return 'control'
}

function buildVariantHref(targetVariant) {
  if (typeof window === 'undefined') {
    return ''
  }

  const nextUrl = new URL(window.location.href)

  if (targetVariant === 'new') {
    nextUrl.searchParams.set(DEV_VARIANT_PARAM, 'new')
  } else {
    nextUrl.searchParams.delete(DEV_VARIANT_PARAM)
  }

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
}

function LandingDevSwitcher({ variant }) {
  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <div className="landing-dev-switcher" aria-label="Seletor de variação da landing em desenvolvimento">
      <span className="landing-dev-switcher__label">
        Variante em dev: <strong>{variant === 'new' ? 'nova' : 'controle'}</strong>
      </span>

      <div className="landing-dev-switcher__links">
        <a href={buildVariantHref('control')}>Controle</a>
        <a href={buildVariantHref('new')}>Nova</a>
      </div>
    </div>
  )
}

function LandingControl({ isAuthenticated, onOpenAuth, onContinue }) {
  const heroSectionRef = useRef(null)
  const { isDark, toggleTheme } = useTheme()

  useEffect(() => {
    if (!isDark) {
      toggleTheme()
    }
  }, [isDark, toggleTheme])

  useEffect(() => {
    const handleScroll = () => {
      if (heroSectionRef.current) {
        heroSectionRef.current.style.transform = `translateY(${window.scrollY * 0.5}px)`
      }
    }

    window.addEventListener('scroll', handleScroll)

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="landing-container">
      <section className="hero-section" ref={heroSectionRef}>
        <div className="hero-content">
          <h1 className="hero-title">Seu tratamento, sempre sob controle</h1>

          <p className="hero-subtitle">
            Medicamentos, horários, estoque e adesão - tudo em um app gratuito feito para o Brasil.
          </p>

          <div className="hero-cta">
            {!isAuthenticated ? (
              <>
                <button className="btn-primary" onClick={onOpenAuth}>
                  Criar Conta Grátis
                  <span className="btn-arrow">→</span>
                </button>
                <button className="btn-secondary" onClick={onOpenAuth}>
                  Acessar Minha Conta
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={onContinue}>
                Ir para Dashboard
                <span className="btn-arrow">→</span>
              </button>
            )}
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">10.000+</span>
              <span className="stat-label">medicamentos ANVISA</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">85%+</span>
              <span className="stat-label">adesão média de usuários</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">100%</span>
              <span className="stat-label">gratuito, sempre</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <AppPreview />
        </div>
      </section>

      <section className="how-it-works-section">
        <div className="section-header">
          <h2>Como Funciona</h2>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-icon">💊</div>
            <h3>Cadastre seus medicamentos</h3>
            <p>
              Use o autocompletar com base ANVISA (10.000+ medicamentos) e preencha nome,
              princípio ativo e laboratório em segundos.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon">📅</div>
            <h3>Defina seus tratamentos</h3>
            <p>
              Configure frequência, horários e doses. O app organiza tudo nos momentos Atrasadas /
              Agora / Próximas automaticamente.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-icon">📊</div>
            <h3>Acompanhe sua adesão</h3>
            <p>
              Health Score, streaks, histórico visual e alertas de estoque. Compartilhe com seu
              médico com um clique.
            </p>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="section-header">
          <h2>Tudo que você precisa</h2>
          <p>Features v3.2 alinhadas com sua saúde</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Health Score + Streaks</h3>
            <p>Score de adesão em tempo real, streak de dias consecutivos e tendência semanal</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⏰</div>
            <h3>Doses por Momentos</h3>
            <p>Atrasadas, Agora e Próximas - organizadas automaticamente pelo horário atual</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Estoque Visual</h3>
            <p>
              Barras de volume mostram de relance qual vai acabar. Alertas com 7 dias de
              antecedência
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Base ANVISA</h3>
            <p>
              10.000+ medicamentos brasileiros. Autocompletar preenche nome, princípio ativo e
              laboratório
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🆘</div>
            <h3>Emergency Card</h3>
            <p>Cartão de emergência exportável com todos os seus medicamentos, doses e contatos</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💰</div>
            <h3>Análise de Custo</h3>
            <p>Custo mensal por medicamento e projeção 3 meses. Ajuda a planejar reposições</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>Relatórios PDF</h3>
            <p>Relatório de adesão exportável para compartilhar com seu médico ou guardar</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>Bot Telegram</h3>
            <p>Lembretes de doses, alertas de estoque e digest semanal direto no Telegram</p>
          </div>
        </div>
      </section>

      <section className="multidevice-section">
        <div className="section-header">
          <h2>Acesse de Qualquer Dispositivo</h2>
          <p>Sincronização perfeita para sua rotina, não importa onde você esteja</p>
        </div>

        <div className="devices-showcase">
          <div className="device-card device-phone">
            <div className="device-frame">
              <div className="device-screen">
                <img src="/mobile.jpg" alt="Celular" />
                <span className="device-overlay">📱</span>
              </div>
            </div>
            <p>Gerencie suas doses diárias com lembretes no seu celular.</p>
          </div>

          <div className="device-card device-tablet">
            <div className="device-frame">
              <div className="device-screen">
                <img src="/tablet.jpg" alt="Tablet" />
                <span className="device-overlay">💻</span>
              </div>
            </div>
            <p>Visualize seus tratamentos e histórico de forma ampla no tablet.</p>
          </div>

          <div className="device-card device-desktop">
            <div className="device-frame">
              <div className="device-screen">
                <img src="/desktop.jpg" alt="Desktop" />
                <span className="device-overlay">🖥</span>
              </div>
            </div>
            <p>Controle total: relatórios detalhados e configurações avançadas no desktop.</p>
          </div>
        </div>

        <p className="sync-info">Sincronize uma vez, acesse em qualquer lugar.</p>
      </section>

      <section className="telegram-section">
        <div className="telegram-content">
          <div className="telegram-icon">🤖</div>
          <h2>Telegram Bot Integrado</h2>
          <p className="telegram-subtitle">
            Tenha acesso a tudo no seu Telegram. Sem sair do app de mensagens.
          </p>

          <div className="telegram-features">
            <div className="telegram-feature">
              <span className="feature-tick">✓</span>
              <span>Receba lembretes de doses</span>
            </div>
            <div className="telegram-feature">
              <span className="feature-tick">✓</span>
              <span>Registre medicamentos tomados</span>
            </div>
            <div className="telegram-feature">
              <span className="feature-tick">✓</span>
              <span>Verifique status do estoque</span>
            </div>
            <div className="telegram-feature">
              <span className="feature-tick">✓</span>
              <span>Compartilhe com cuidadores</span>
            </div>
          </div>

          <p className="telegram-note">Configure em 30 segundos na seção de Configurações do app.</p>
        </div>
      </section>

      <section className="final-cta-section">
        <div className="cta-card">
          <h2>Comece hoje. É gratuito, sempre.</h2>
          <p>
            Cadastre seus medicamentos em minutos, configure seus horários e deixe o app cuidar dos
            lembretes. Sem cartão de crédito. Sem planos pagos.
          </p>

          <div className="final-cta-buttons">
            {!isAuthenticated ? (
              <>
                <button className="btn-large btn-primary" onClick={onOpenAuth}>
                  Criar Conta Grátis
                  <span className="btn-arrow">→</span>
                </button>
                <button className="btn-large btn-secondary" onClick={onOpenAuth}>
                  Acessar Minha Conta
                </button>
              </>
            ) : (
              <button className="btn-large btn-primary" onClick={onContinue}>
                Acessar Dashboard
              </button>
            )}
          </div>

          <p className="cta-footer">
            Junte-se a centenas de usuários que já melhoraram sua adesão ao tratamento.
          </p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© 2026 Meus Remédios. Todos os direitos reservados.</p>
        <p className="footer-tagline">
          Saúde em primeiro lugar. Tecnologia a serviço do bem.{' '}
          <a href="https://github.com/coelhotv/meus-remedios/issues" className="footer-link">
            Relatar um problema
          </a>
        </p>
      </footer>
    </div>
  )
}

function PrototypeIcon({ children, className = '', size = 20, viewBox = '0 0 24 24' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function HeartPulseIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
      <path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </PrototypeIcon>
  )
}

function ZapIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </PrototypeIcon>
  )
}

function ArrowRightIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </PrototypeIcon>
  )
}

function DatabaseIcon({ className = '', size = 18 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </PrototypeIcon>
  )
}

function LockIcon({ className = '', size = 18 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </PrototypeIcon>
  )
}

function BellIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </PrototypeIcon>
  )
}

function PackageIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <path d="m7.5 4.27 9 5.15" />
    </PrototypeIcon>
  )
}

function CalendarIcon({ className = '', size = 14 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </PrototypeIcon>
  )
}

function ShieldCheckIcon({ className = '', size = 16 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </PrototypeIcon>
  )
}

function MessageCircleIcon({ className = '', size = 24 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
    </PrototypeIcon>
  )
}

function FileTextIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </PrototypeIcon>
  )
}

function ActivityIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </PrototypeIcon>
  )
}

function SmartphoneIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </PrototypeIcon>
  )
}

function ClockIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="10" />
    </PrototypeIcon>
  )
}

function DownloadIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </PrototypeIcon>
  )
}

function CircleCheckIcon({ className = '', size = 18 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </PrototypeIcon>
  )
}

function LandingVariantNew({ isAuthenticated, onOpenAuth, onContinue }) {
  return (
    <div className="landing-prototype-root">
      <div className="lp-page">
        <header className="lp-header">
          <div className="lp-shell lp-header__inner">
            <div className="lp-brand">
              <div className="lp-brand__mark">
                <HeartPulseIcon size={24} />
              </div>
              <span className="lp-brand__text">Meus Remédios</span>
            </div>

            <nav className="lp-nav">
              <a href="#solucoes">Soluções</a>
              <a href="#funcionalidades">Recursos</a>
              <a href="#privacidade">Privacidade</a>
            </nav>

            <div className="lp-header__actions">
              <span className="lp-header__free">100% Gratuito</span>
              {!isAuthenticated ? (
                <button className="lp-btn lp-btn--header" onClick={onOpenAuth}>
                  Instalar App
                </button>
              ) : (
                <button className="lp-btn lp-btn--header" onClick={onContinue}>
                  Abrir App
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="lp-main">
          <section className="lp-hero">
            <div className="lp-hero__orb lp-hero__orb--blue" />
            <div className="lp-hero__orb lp-hero__orb--green" />

            <div className="lp-shell">
              <div className="lp-hero__grid">
                <div className="lp-hero__copy">
                  <div className="lp-pill lp-pill--emerald">
                    <ZapIcon size={16} />
                    <span>Gratuito para sempre • Sem Paywall</span>
                  </div>

                  <h1>
                    Controle total da sua saúde, <span>no seu bolso.</span>
                  </h1>

                  <p>
                    Organize seus medicamentos com a base oficial da <b>ANVISA</b>, receba alertas
                    via <b>Telegram</b> e gere relatórios profissionais para seu médico. Tudo
                    privado, tudo gratuito.
                  </p>

                  <div className="lp-hero__cta">
                    {!isAuthenticated ? (
                      <>
                        <button className="lp-btn lp-btn--primary lp-btn--large" onClick={onOpenAuth}>
                          Começar Agora
                          <ArrowRightIcon size={20} />
                        </button>
                        <button className="lp-btn lp-btn--secondary lp-btn--large" onClick={onOpenAuth}>
                          Conhecer o Bot Telegram
                        </button>
                      </>
                    ) : (
                      <button className="lp-btn lp-btn--primary lp-btn--large" onClick={onContinue}>
                        Abrir meu painel
                        <ArrowRightIcon size={20} />
                      </button>
                    )}
                  </div>

                  <div className="lp-hero__proofs">
                    <div className="lp-proof">
                      <DatabaseIcon className="lp-proof__icon lp-proof__icon--blue" />
                      <span>10.000+ Meds ANVISA</span>
                    </div>
                    <div className="lp-proof">
                      <LockIcon className="lp-proof__icon lp-proof__icon--green" />
                      <span>Privacy-First (Local Only)</span>
                    </div>
                  </div>
                </div>

                <div className="lp-hero__visual">
                  <div className="lp-phone-card">
                    <div className="lp-phone-card__screen">
                      <div className="lp-app-header">
                        <div className="lp-app-header__identity">
                          <div className="lp-avatar">M</div>
                          <div>
                            <p className="lp-caption">Adesão hoje</p>
                            <p className="lp-app-header__score">92% • Streak: 12d</p>
                          </div>
                        </div>
                        <div className="lp-icon-circle">
                          <BellIcon size={20} />
                        </div>
                      </div>

                      <div className="lp-alert-card">
                        <div className="lp-alert-card__header">
                          <p>Estoque Crítico</p>
                          <PackageIcon className="lp-text-red" size={16} />
                        </div>
                        <div className="lp-alert-card__row">
                          <p>Metformina 850mg</p>
                          <p className="lp-text-red">4 comps restantes</p>
                        </div>
                        <div className="lp-progress">
                          <div className="lp-progress__fill" />
                        </div>
                      </div>

                      <div className="lp-dose-list">
                        <div className="lp-dose-list__header">
                          <p>Próximas Doses</p>
                          <CalendarIcon size={14} />
                        </div>

                        <div className="lp-dose-item">
                          <div className="lp-dose-item__info">
                            <div className="lp-dose-item__time">12:00</div>
                            <div>
                              <div className="lp-dose-item__name">Losartana</div>
                              <div className="lp-dose-item__meta">1 comp</div>
                            </div>
                          </div>
                          <div className="lp-badge lp-badge--blue">Hipertensão</div>
                        </div>

                        <div className="lp-dose-item">
                          <div className="lp-dose-item__info">
                            <div className="lp-dose-item__time">14:00</div>
                            <div>
                              <div className="lp-dose-item__name">Omeprazol</div>
                              <div className="lp-dose-item__meta">20mg</div>
                            </div>
                          </div>
                          <div className="lp-badge lp-badge--purple">Gástrico</div>
                        </div>

                        <div className="lp-dose-item">
                          <div className="lp-dose-item__info">
                            <div className="lp-dose-item__time">20:00</div>
                            <div>
                              <div className="lp-dose-item__name">Sinvastatina</div>
                              <div className="lp-dose-item__meta">40mg</div>
                            </div>
                          </div>
                          <div className="lp-badge lp-badge--orange">Colesterol</div>
                        </div>
                      </div>

                      <div className="lp-emergency-card">
                        <div className="lp-emergency-card__title">
                          <ShieldCheckIcon className="lp-text-green" size={16} />
                          <p>Cartão de Emergência Ativo</p>
                        </div>
                        <p>
                          Disponível offline para socorristas e médicos em caso de urgência.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="lp-floating-bot">
                    <div className="lp-floating-bot__content">
                      <MessageCircleIcon className="lp-text-blue" size={24} />
                      <span>Telegram Bot Ativo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="solucoes" className="lp-section lp-section--muted">
            <div className="lp-shell">
              <div className="lp-section__intro lp-section__intro--center">
                <h2>O fim do esquecimento</h2>
                <p>
                  Uma ferramenta profissional de saúde, simplificada para o uso diário. Sem
                  assinaturas, sem anúncios.
                </p>
              </div>

              <div className="lp-card-grid lp-card-grid--three">
                <div className="lp-card">
                  <div className="lp-card__icon">
                    <ZapIcon className="lp-text-green" size={24} />
                  </div>
                  <div className="lp-card__eyebrow">Sempre Grátis</div>
                  <h3>100% Gratuito</h3>
                  <p>
                    Funcionalidades essenciais ilimitadas. Sem paywalls, sem versões &apos;Pro&apos;.
                    Nosso compromisso é com a sua saúde.
                  </p>
                </div>

                <div className="lp-card">
                  <div className="lp-card__icon">
                    <DatabaseIcon className="lp-text-blue" size={24} />
                  </div>
                  <div className="lp-card__eyebrow">Dados Oficiais</div>
                  <h3>Base ANVISA</h3>
                  <p>
                    Autocomplete com mais de 10.000 medicamentos registrados. Preenchimento
                    automático de dosagens e apresentações.
                  </p>
                </div>

                <div className="lp-card">
                  <div className="lp-card__icon">
                    <MessageCircleIcon className="lp-text-sky" size={24} />
                  </div>
                  <div className="lp-card__eyebrow">Flexível</div>
                  <h3>Alertas Multicanal</h3>
                  <p>
                    Receba notificações via PWA no celular ou através do nosso Bot exclusivo no
                    Telegram. Você escolhe onde ser avisado.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="funcionalidades" className="lp-section">
            <div className="lp-shell">
              <div className="lp-feature-head">
                <div className="lp-section__intro">
                  <h2>Pronto para o uso clínico.</h2>
                  <p>
                    Ferramentas avançadas que ajudam você e seu médico a tomarem melhores decisões
                    baseadas em dados reais.
                  </p>
                </div>

                <div className="lp-info-card">
                  <p className="lp-info-card__title">Inteligência Local</p>
                  <p className="lp-info-card__text">
                    Previsão de estoque e score de risco calculados diretamente no seu aparelho.
                    Privacidade total.
                  </p>
                </div>
              </div>

              <div className="lp-feature-grid">
                <div className="lp-feature">
                  <div className="lp-feature__icon"><PackageIcon size={20} /></div>
                  <h4>Controle de Estoque</h4>
                  <p>Alertas automáticos quando seus comprimidos estão acabando.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon"><FileTextIcon size={20} /></div>
                  <h4>PDF para o Médico</h4>
                  <p>Gere relatórios profissionais com seu histórico de adesão em um clique.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon"><ShieldCheckIcon size={20} /></div>
                  <h4>Cartão de Emergência</h4>
                  <p>Acesso offline aos seus medicamentos ativos para situações de urgência.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon"><ActivityIcon size={20} /></div>
                  <h4>Score de Adesão</h4>
                  <p>Acompanhe sua evolução com gráficos de tendências e streaks.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon"><SmartphoneIcon size={20} /></div>
                  <h4>PWA Instalável</h4>
                  <p>Instale na sua tela inicial sem precisar de lojas de aplicativos.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon"><ClockIcon size={20} /></div>
                  <h4>Protocolos Flexíveis</h4>
                  <p>Diário, semanal, personalizado ou &apos;quando necessário&apos;.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon"><DownloadIcon size={20} /></div>
                  <h4>Portabilidade Total</h4>
                  <p>Exporte seus dados em CSV ou JSON a qualquer momento.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon"><LockIcon size={20} /></div>
                  <h4>Analytics Privado</h4>
                  <p>Sem telemetria externa. Seus dados de uso ficam apenas no seu celular.</p>
                </div>
              </div>
            </div>
          </section>

          <section id="privacidade" className="lp-section lp-section--dark">
            <div className="lp-dark-glow" />
            <div className="lp-shell">
              <div className="lp-dark-grid">
                <div>
                  <div className="lp-pill lp-pill--dark">
                    <LockIcon size={16} />
                    <span>Privacidade em Primeiro Lugar</span>
                  </div>
                  <h2>Seus dados são apenas seus.</h2>
                  <p className="lp-dark-copy">
                    Diferente de outros apps, o <b>Meus Remédios</b> não armazena suas informações
                    em servidores centrais. Tudo é processado e guardado localmente no seu
                    dispositivo (localStorage).
                  </p>

                  <ul className="lp-check-list">
                    <li><CircleCheckIcon className="lp-text-green" size={18} />Sem rastreadores de publicidade</li>
                    <li><CircleCheckIcon className="lp-text-green" size={18} />Sem venda de dados para farmácias</li>
                    <li><CircleCheckIcon className="lp-text-green" size={18} />Sem necessidade de criar conta com senha</li>
                    <li><CircleCheckIcon className="lp-text-green" size={18} />Exportação completa de dados garantida</li>
                  </ul>
                </div>

                <div className="lp-quote-card">
                  <div className="lp-quote-card__head">
                    <div className="lp-quote-card__shield">
                      <ShieldCheckIcon className="lp-text-blue-light" size={24} />
                    </div>
                    <div>
                      <p className="lp-quote-card__title">Segurança Offline</p>
                      <p className="lp-quote-card__subtitle">Arquitetura Privacy-First</p>
                    </div>
                  </div>

                  <p className="lp-quote-card__text">
                    &quot;Acreditamos que dados de saúde são sagrados. Por isso, construímos uma
                    ferramenta onde a inteligência acontece no seu navegador, garantindo que
                    ninguém — nem mesmo nós — tenha acesso ao que você toma.&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="lp-section">
            <div className="lp-shell">
              <div className="lp-final-cta">
                <h2>Comece a cuidar da sua saúde hoje.</h2>
                <p>Gratuito para sempre. Sem pegadinhas. Sem anúncios.</p>
                <div className="lp-final-cta__actions">
                  {!isAuthenticated ? (
                    <button className="lp-btn lp-btn--white lp-btn--xl" onClick={onOpenAuth}>
                      Instalar Agora
                    </button>
                  ) : (
                    <button className="lp-btn lp-btn--white lp-btn--xl" onClick={onContinue}>
                      Abrir Agora
                    </button>
                  )}
                  <div className="lp-final-proof">
                    <div className="lp-final-proof__line">
                      <CircleCheckIcon size={16} />
                      <span>PWA Compatível</span>
                    </div>
                    <p>iOS, Android e Desktop</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="lp-footer">
          <div className="lp-shell lp-footer__inner">
            <div className="lp-brand lp-brand--small">
              <div className="lp-brand__mark lp-brand__mark--small">
                <HeartPulseIcon size={18} />
              </div>
              <span className="lp-brand__text lp-brand__text--small">Meus Remédios</span>
            </div>

            <div className="lp-footer__links">
              <a href="#funcionalidades">Base ANVISA</a>
              <a href="#solucoes">Telegram Bot</a>
              <a href="https://github.com/coelhotv/meus-remedios/issues">Código Aberto</a>
            </div>

            <p className="lp-footer__copy">© 2026 Meus Remédios. Desenvolvido para o bem comum.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function Landing({
  isAuthenticated = false,
  onOpenAuth = () => {},
  onContinue = () => {},
}) {
  const variant = useMemo(() => resolveLandingVariant(), [])

  return (
    <>
      <LandingDevSwitcher variant={variant} />
      {variant === 'new' ? (
        <LandingVariantNew
          isAuthenticated={isAuthenticated}
          onOpenAuth={onOpenAuth}
          onContinue={onContinue}
        />
      ) : (
        <LandingControl
          isAuthenticated={isAuthenticated}
          onOpenAuth={onOpenAuth}
          onContinue={onContinue}
        />
      )}
    </>
  )
}
