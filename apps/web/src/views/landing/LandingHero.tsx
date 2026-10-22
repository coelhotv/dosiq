/**
 * LandingHero — Seção hero da Landing page.
 */
import {
  ZapIcon,
  ArrowRightIcon,
  BellIcon,
  ShieldCheckIcon,
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
              <span>Gratuito para sempre • Sem paywall em saúde</span>
            </div>

            <h1>
              Nunca mais erre uma <span>dose</span>.
            </h1>

            <p>
              Comprimido de todo dia ou caneta de toda semana: escaneie o código de barras da caixa pela câmera, receba alarmes que tocam até no silencioso e gere o relatório em PDF que o seu médico vai querer ver. Base oficial da <b>ANVISA</b>, funciona offline, sem assinatura.
            </p>

            <div className="lp-hero__cta">
              {!isAuthenticated ? (
                <>
                  <button
                    className="lp-btn lp-btn--primary lp-btn--large"
                    onClick={() => onOpenAuth?.('signup')}
                  >
                    Criar conta grátis
                    <ArrowRightIcon size={20} />
                  </button>
                  <button
                    className="lp-btn lp-btn--secondary lp-btn--large"
                    onClick={() => onOpenAuth?.('login')}
                  >
                    Já tenho conta — entrar
                  </button>
                </>
              ) : (
                <button className="lp-btn lp-btn--primary lp-btn--large" onClick={onContinue}>
                  Abrir meu painel
                  <ArrowRightIcon size={20} />
                </button>
              )}
            </div>

            <div className="lp-hero__scope">
              <div className="lp-scope">
                <span className="lp-scope__tag">Comprimidos</span>
                <p>
                  <b>Vários remédios, vários horários.</b> Cadastro pelo código de barras da caixa (base ANVISA), lembretes críticos que tocam até no modo Silencioso e cartão de emergência offline.
                </p>
              </div>
              <div className="lp-scope">
                <span className="lp-scope__tag">Caneta</span>
                <p>
                  <b>Injetável semanal com titulação.</b> Escada de doses, mapa corporal frente e costas de rodízio, peso por etapa e relatório em PDF para a consulta.{' '}
                  <a href="/glp-1">Ver como funciona →</a>
                </p>
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
                      <p className="lp-app-header__score">91% • Excelente!</p>
                    </div>
                  </div>
                  <div className="lp-icon-circle">
                    <BellIcon size={20} />
                  </div>
                </div>

                <div className="lp-alert-card">
                  <div className="lp-alert-card__header">
                    <p>Próxima aplicação</p>
                    <span className="lp-badge lp-badge--blue">Semanal</span>
                  </div>
                  <div className="lp-alert-card__row">
                    <p>Semaglutida 1,7 mg</p>
                    <p className="lp-text-green">quinta, 20:00</p>
                  </div>
                  <div className="lp-progress">
                    <div className="lp-progress__fill" style={{ width: '72%', background: 'var(--lp-green-500)' }} />
                  </div>
                  <p className="lp-dose-item__meta" style={{ marginTop: '8px' }}>
                    Degrau 4 de 5 · sobe em 2 semanas
                  </p>
                </div>

                <div className="lp-dose-list">
                  <div className="lp-dose-list__header">
                    <p>Hoje</p>
                  </div>

                  <div className="lp-dose-item">
                    <div className="lp-dose-item__info">
                      <div className="lp-dose-item__time">12:00</div>
                      <div>
                        <div className="lp-dose-item__name">Losartana 50 mg</div>
                        <div className="lp-dose-item__meta">1 comp</div>
                      </div>
                    </div>
                    <div className="lp-badge lp-badge--blue">Hipertensão</div>
                  </div>

                  <div className="lp-dose-item">
                    <div className="lp-dose-item__info">
                      <div className="lp-dose-item__time">14:00</div>
                      <div>
                        <div className="lp-dose-item__name">Metformina 850 mg</div>
                        <div className="lp-dose-item__meta">1 comp</div>
                      </div>
                    </div>
                    <div className="lp-badge lp-badge--purple">Diabetes</div>
                  </div>

                  <div className="lp-dose-item">
                    <div className="lp-dose-item__info">
                      <div className="lp-dose-item__time">20:00</div>
                      <div>
                        <div className="lp-dose-item__name">Sinvastatina 20 mg</div>
                        <div className="lp-dose-item__meta">2 comp</div>
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
          </div>
        </div>
      </div>
    </section>
  )
}
