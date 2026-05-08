/**
 * LandingHero — Seção hero da Landing page.
 */
import {
  ZapIcon,
  ArrowRightIcon,
  DatabaseIcon,
  LockIcon,
  BellIcon,
  PackageIcon,
  CalendarIcon,
  ShieldCheckIcon,
  MessageCircleIcon,
  LogoMark,
} from './LandingIcons'

export default function LandingHero({ isAuthenticated, onOpenAuth, onContinue }) {
  return (
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
  )
}
