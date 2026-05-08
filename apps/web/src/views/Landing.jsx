import React from 'react'
import LandingHero from './LandingHero'
import { LandingSolucoes, LandingFuncionalidades, LandingPrivacidade } from './LandingSections'
import { LogoMark, CircleCheckIcon } from './LandingIcons'
import './LandingPrototype.css'

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
                <button className="lp-btn lp-btn--header" onClick={onOpenAuth}>Começar Agora</button>
              ) : (
                <button className="lp-btn lp-btn--header" onClick={onContinue}>Abrir App</button>
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

          <LandingSolucoes />
          <LandingFuncionalidades />
          <LandingPrivacidade />

          <section className="lp-section">
            <div className="lp-shell">
              <div className="lp-final-cta">
                <h2>Comece a cuidar da sua saúde hoje.</h2>
                <p>Gratuito para sempre. Sem pegadinhas. Sem anúncios.</p>
                <div className="lp-final-cta__actions">
                  {!isAuthenticated ? (
                    <button className="lp-btn lp-btn--white lp-btn--xl" onClick={onOpenAuth}>Começar Agora</button>
                  ) : (
                    <button className="lp-btn lp-btn--white lp-btn--xl" onClick={onContinue}>Abrir Agora</button>
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
