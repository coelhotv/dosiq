import React from 'react'
import './LandingPrototype.css'

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

function LogoMark({ className = '', size = 24 }) {
  return (
    <img
      src="/dosiq-logo-verde.png"
      width={size}
      height={size}
      className={className}
      alt="dosiq"
      aria-hidden="true"
      style={{ display: 'block' }}
    />
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
                <LogoMark size={32} />
              </div>
              <span className="lp-brand__text">dosiq</span>
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
                  Começar Agora
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
                        <button
                          className="lp-btn lp-btn--primary lp-btn--large"
                          onClick={onOpenAuth}
                        >
                          Começar Agora
                          <ArrowRightIcon size={20} />
                        </button>
                        <button
                          className="lp-btn lp-btn--secondary lp-btn--large"
                          onClick={onOpenAuth}
                        >
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
                      <span>Código Aberto</span>
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
                        <p>Disponível offline para socorristas e médicos em caso de urgência.</p>
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
                    Funcionalidades essenciais ilimitadas. Sem travas, sem versões
                    &apos;Pro&apos;. Nosso compromisso é com a sua saúde.
                  </p>
                </div>

                <div className="lp-card">
                  <div className="lp-card__icon">
                    <DatabaseIcon className="lp-text-blue" size={24} />
                  </div>
                  <div className="lp-card__eyebrow">Dados Oficiais</div>
                  <h3>Base ANVISA</h3>
                  <p>
                    Autocompletar com mais de 10.000 medicamentos registrados. Preenchimento
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
                  <p className="lp-info-card__title">Transparência Total</p>
                  <p className="lp-info-card__text">
                    Projeto de código aberto focado na segurança e no controle do paciente.
                    Seus dados protegidos, sem letras miúdas.
                  </p>
                </div>
              </div>

              <div className="lp-feature-grid">
                <div className="lp-feature">
                  <div className="lp-feature__icon">
                    <PackageIcon size={20} />
                  </div>
                  <h4>Controle de Estoque</h4>
                  <p>Alertas automáticos quando seus comprimidos estão acabando.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon">
                    <FileTextIcon size={20} />
                  </div>
                  <h4>PDF para o Médico</h4>
                  <p>Gere relatórios profissionais com seu histórico de adesão em um clique.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon">
                    <ShieldCheckIcon size={20} />
                  </div>
                  <h4>Cartão de Emergência</h4>
                  <p>Acesso offline aos seus medicamentos ativos para situações de urgência.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon">
                    <ActivityIcon size={20} />
                  </div>
                  <h4>Escore de Adesão</h4>
                  <p>Acompanhe sua evolução com gráficos de tendências e streaks.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon">
                    <SmartphoneIcon size={20} />
                  </div>
                  <h4>PWA Instalável</h4>
                  <p>Instale na sua tela inicial sem precisar de lojas de aplicativos.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon">
                    <ClockIcon size={20} />
                  </div>
                  <h4>Protocolos Flexíveis</h4>
                  <p>Diário, semanal, personalizado ou &apos;quando necessário&apos;.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon">
                    <DownloadIcon size={20} />
                  </div>
                  <h4>Portabilidade Total</h4>
                  <p>Exporte seus dados em CSV ou JSON a qualquer momento.</p>
                </div>
                <div className="lp-feature">
                  <div className="lp-feature__icon">
                    <LockIcon size={20} />
                  </div>
                  <h4>Sem Rastreadores</h4>
                  <p>Não vendemos seus dados nem exibimos anúncios. Nosso foco é sua saúde.</p>
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
                    <span>Dados Protegidos, Nunca Vendidos</span>
                  </div>
                  <h2>Seu histórico sob seu controle.</h2>
                  <p className="lp-dark-copy">
                    Acreditamos que dados de saúde não devem ser mercadoria. Por isso, usamos 
                    criptografia <b>HTTPS</b> e proteção por <b>Row Level Security (RLS)</b> para 
                    garantir que seu histórico permaneça privado e inacessível a qualquer pessoa, 
                    incluindo nossa equipe.
                  </p>

                  <ul className="lp-check-list">
                    <li>
                      <CircleCheckIcon className="lp-text-green" size={18} />
                      Sem rastreadores de publicidade
                    </li>
                    <li>
                      <CircleCheckIcon className="lp-text-green" size={18} />
                      Sem venda de dados para farmácias
                    </li>
                    <li>
                      <CircleCheckIcon className="lp-text-green" size={18} />
                      Arquitetura técnica segura (HTTPS e RLS)
                    </li>
                    <li>
                      <CircleCheckIcon className="lp-text-green" size={18} />
                      Exportação completa (CSV/JSON)
                    </li>
                  </ul>
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

          <section className="lp-section">
            <div className="lp-shell">
              <div className="lp-final-cta">
                <h2>Comece a cuidar da sua saúde hoje.</h2>
                <p>Gratuito para sempre. Sem pegadinhas. Sem anúncios.</p>
                <div className="lp-final-cta__actions">
                  {!isAuthenticated ? (
                    <button className="lp-btn lp-btn--white lp-btn--xl" onClick={onOpenAuth}>
                      Começar Agora
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
                <LogoMark size={25} />
              </div>
              <span className="lp-brand__text lp-brand__text--small">Dosiq</span>
            </div>

            <div className="lp-footer__links">
              <a href="#funcionalidades">Base ANVISA</a>
              <a href="#solucoes">Telegram Bot</a>
              <a href="https://github.com/coelhotv/dosiq/">Código Aberto</a>
            </div>

            <p className="lp-footer__copy">© 2026 Dosiq. Desenvolvido para o bem comum.</p>
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
  return (
    <LandingVariantNew
      isAuthenticated={isAuthenticated}
      onOpenAuth={onOpenAuth}
      onContinue={onContinue}
    />
  )
}
