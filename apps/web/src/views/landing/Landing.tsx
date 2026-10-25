import React from 'react'
import LandingHero from './LandingHero'
import {
  LandingWedge,
  LandingSolucoes,
  LandingFuncionalidades,
  LandingPrivacidade,
  LandingApp,
} from './LandingSections'
import { LogoMark, CircleCheckIcon } from './LandingIcons'
import { appStoreUrl, playStoreUrl, baixarUrl } from './storeLinks'
import './LandingPrototype.css'

function LandingVariantNew({ isAuthenticated, onOpenAuth, onContinue }) {
  const [isStickyVisible, setIsStickyVisible] = React.useState(false)

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const heroEl = document.querySelector('.lp-hero')
    if (!heroEl) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStickyVisible(!entry.isIntersecting)
      },
      { threshold: 0.1 },
    )

    observer.observe(heroEl)
    return () => observer.disconnect()
  }, [])

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
              <a className="lp-nav__wedge" href="/glp-1">
                Tratamento com caneta
              </a>
              <a href="#privacidade">Privacidade</a>
            </nav>

            <div className="lp-header__actions">
              <span className="lp-header__free">100% Gratuito</span>
              {!isAuthenticated ? (
                <>
                  <button
                    type="button"
                    className="lp-btn--web-link"
                    onClick={() => onOpenAuth?.('login')}
                  >
                    Acessar Web
                  </button>
                  <a
                    className="lp-btn--header-install lp-btn--header-install-desktop"
                    href="#app"
                  >
                    Instalar App
                  </a>
                  <a
                    className="lp-btn--header-install lp-btn--header-install-mobile"
                    href={baixarUrl('header')}
                  >
                    Instalar App
                  </a>
                </>
              ) : (
                <button className="lp-btn lp-btn--header" onClick={onContinue}>
                  Abrir painel
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="lp-main">
          <LandingHero
            isAuthenticated={isAuthenticated}
            onOpenAuth={onOpenAuth}
            onContinue={onContinue}
          />

          <LandingWedge />
          <LandingSolucoes />
          <LandingFuncionalidades />
          <LandingApp />
          <LandingPrivacidade />

          <section className="lp-section">
            <div className="lp-shell">
              <div className="lp-final-cta">
                <h2>Comece a cuidar da sua saúde hoje.</h2>
                <p>Gratuito para sempre. Sem pegadinhas. Sem anúncios.</p>
                <div className="lp-final-cta__actions">
                  {!isAuthenticated ? (
                    <>
                      <div className="lp-final-cta__badges">
                        <a
                          href={appStoreUrl('final')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="lp-store-badge-btn"
                          aria-label="Baixar na App Store"
                        >
                          <img
                            src="/badges/app-store-pt.svg"
                            alt="Baixar na App Store"
                            width={168}
                            height={50}
                          />
                        </a>
                        <a
                          href={playStoreUrl('final')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="lp-store-badge-btn"
                          aria-label="Disponível no Google Play"
                        >
                          <img
                            src="/badges/google-play-pt.svg"
                            alt="Disponível no Google Play"
                            width={168}
                            height={50}
                          />
                        </a>
                      </div>
                      <div className="lp-final-cta__fallback">
                        <button
                          type="button"
                          className="lp-link-subtle"
                          onClick={() => onOpenAuth?.('login')}
                        >
                          Quer acessar no computador? Entrar na versão web →
                        </button>
                      </div>
                    </>
                  ) : (
                    <button className="lp-btn lp-btn--white lp-btn--xl" onClick={onContinue}>
                      Abrir painel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="lp-footer">
          <div className="lp-shell">
            <div className="lp-footer__inner">
              <div className="lp-brand lp-brand--small">
                <div className="lp-brand__mark lp-brand__mark--small">
                  <LogoMark size={25} />
                </div>
                <span className="lp-brand__text lp-brand__text--small">dosiq</span>
              </div>
              <p className="lp-footer__copy">© 2026 Dosiq. Desenvolvido para o bem comum.</p>
            </div>

            <nav aria-label="Guias e páginas públicas" className="lp-footer__nav">
              <div className="lp-footer__col">
                <p className="lp-footer__col-title">Canetas & Injetáveis</p>
                <ul className="lp-footer__list">
                  <li>
                    <a href="/glp-1">Titulação de Doses GLP-1</a>
                  </li>
                  <li>
                    <a href="/guia/rodizio-aplicacao">Rodízio de Aplicação</a>
                  </li>
                  <li>
                    <a href="/guia/esqueci-dose-semanal">Dose Semanal Esquecida</a>
                  </li>
                  <li>
                    <a href="/guia/validade-caneta-aberta">Validade da Caneta Aberta</a>
                  </li>
                </ul>
              </div>
              <div className="lp-footer__col">
                <p className="lp-footer__col-title">Horários & Tratamentos</p>
                <ul className="lp-footer__list">
                  <li>
                    <a href="/insulina-e-glicemia">Insulina e Diário de Glicemia</a>
                  </li>
                  <li>
                    <a href="/guia/horario-8-em-8-horas">Remédio de 8 em 8 Horas</a>
                  </li>
                  <li>
                    <a href="/injecao-mensal">Injeção Mensal (30 dias)</a>
                  </li>
                  <li>
                    <a href="/guia/alarme-remedio-silencioso-iphone-android">Alarme no Silencioso</a>
                  </li>
                </ul>
              </div>
              <div className="lp-footer__col">
                <p className="lp-footer__col-title">dosiq & Transparência</p>
                <ul className="lp-footer__list">
                  <li>
                    <a href="/">Página Inicial</a>
                  </li>
                  <li>
                    <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">
                      Política de Privacidade
                    </a>
                  </li>
                  <li>
                    <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer">
                      Termos de Uso
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/coelhotv/dosiq/" target="_blank" rel="noopener noreferrer">
                      Código Aberto no GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </nav>

            {/* Identificação da PJ (spec 096 S11) — 1 linha no desktop, 3 no celular */}
            <p className="lp-footer__legal">
              <span>
                dosiq é operado por DOSIQ DIGITAL HEALTH WEB DESIGN LTDA · CNPJ 68.335.606/0001-11
              </span>
              <span>Rua Pais Leme, 215, cj 1713, Pinheiros, São Paulo/SP, CEP 05424-150</span>
              <span>
                <a href="mailto:privacidade@dosiq.app">privacidade@dosiq.app</a> ·{' '}
                <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">
                  Política de Privacidade
                </a>{' '}
                ·{' '}
                <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer">
                  Termos de Uso
                </a>
              </span>
            </p>
          </div>
        </footer>

        {/* Mobile Sticky Bar (spec 111 US1-AC3) */}
        <aside
          className={`lp-mobile-sticky-bar ${isStickyVisible ? 'lp-mobile-sticky-bar--visible' : ''}`}
          aria-hidden={!isStickyVisible}
          inert={!isStickyVisible}
        >
          <div className="lp-mobile-sticky-bar__inner">
            <div className="lp-mobile-sticky-bar__brand">
              <div className="lp-brand__mark lp-brand__mark--tiny">
                <LogoMark size={20} />
              </div>
              <span className="lp-mobile-sticky-bar__copy">dosiq · 100% gratuito</span>
            </div>
            <a
              href={baixarUrl('sticky')}
              className="lp-mobile-sticky-bar__btn"
              aria-label="Instalar aplicativo"
            >
              Instalar
            </a>
          </div>
        </aside>
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
