/**
 * LandingSections — Seções estáticas da Landing page.
 */
import {
  ZapIcon,
  DatabaseIcon,
  LockIcon,
  PackageIcon,
  FileTextIcon,
  ShieldCheckIcon,
  ActivityIcon,
  SmartphoneIcon,
  CircleCheckIcon,
  BarcodeIcon,
  LayersIcon,
  TargetIcon,
  BellIcon,
} from './LandingIcons'

export function LandingWedge() {
  return (
    <section className="lp-section lp-wedge">
      <div className="lp-shell">
        <div className="lp-wedge__in">
          <div>
            <h2>Faz tratamento com caneta injetável?</h2>
            <p>
              Titulação em degraus, dia fixo da aplicação, mapa do corpo para rodízio de local e evolução do peso por etapa — a parte do dosiq feita para semaglutida, tirzepatida e insulina, com as respostas práticas de quem está começando.
            </p>
          </div>
          <div>
            <a className="lp-wedge__cta" href="/glp-1">
              Entenda o progresso dos tratamentos →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

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
            <div className="lp-card__icon"><BellIcon className="lp-text-sky" size={24} /></div>
            <div className="lp-card__eyebrow">Confiável</div>
            <h3>Alertas Críticos</h3>
            <p>Notificações precisas no celular e alarme sonoro dedicado que toca mesmo no modo Silencioso e no Foco.</p>
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
          <div className="lp-feature">
            <div className="lp-feature__icon"><BarcodeIcon size={20} /></div>
            <h3>Código de Barras ANVISA</h3>
            <p>Aponte a câmera para a caixa no app ou busque na lista oficial da ANVISA sem digitar nada à mão.</p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon"><LayersIcon size={20} /></div>
            <h3>Titulação de Doses</h3>
            <p>Escada de aumento gradual com o degrau atual e peso médio por etapa, mesmo ao trocar de caneta.</p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon"><TargetIcon size={20} /></div>
            <h3>Mapa do Corpo (Rodízio)</h3>
            <p>Toque no desenho do corpo (frente e costas) para registrar onde aplicou e não repetir o local.</p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon"><BellIcon size={20} /></div>
            <h3>Alarme Crítico no Silencioso</h3>
            <p>Alertas Críticos no iPhone e canal de alarme no Android para doses que não podem atrasar.</p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon"><FileTextIcon size={20} /></div>
            <h3>PDF Clínico para o Médico</h3>
            <p>Relatório de 7, 30 ou 90 dias com tomadas, escada de doses, locais de injeção e medidas.</p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon"><ActivityIcon size={20} /></div>
            <h3>Biomarcadores Integrados</h3>
            <p>Registre seu peso logo após a dose semanal e acompanhe glicemia e pressão ao lado da adesão.</p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon"><PackageIcon size={20} /></div>
            <h3>Estoque Opcional pela Caixa</h3>
            <p>Escaneie a caixa ao comprar para atualizar o estoque — ou desligue se só quiser lembretes.</p>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon"><LockIcon size={20} /></div>
            <h3>Privacidade & Portabilidade</h3>
            <p>Código aberto (AGPL-3.0), sem anúncios, sem venda de dados e exportação CSV/JSON (LGPD).</p>
          </div>
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
              href="/politica-de-privacidade"
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

import { appStoreUrl, playStoreUrl } from './storeLinks'

/**
 * LandingApp — promove os apps nativos (iOS e Android ambos publicados).
 */
export function LandingApp() {
  return (
    <section id="app" className="lp-section lp-section--muted">
      <div className="lp-shell">
        <div className="lp-section__intro lp-section__intro--center">
          <div className="lp-pill">
            <SmartphoneIcon size={16} />
            <span>Disponível no celular</span>
          </div>
          <h2>Leve o Dosiq no bolso.</h2>
          <p>O app nativo traz alarmes críticos na hora certa, leitura de código de barras e funcionamento offline.</p>
        </div>

        <div className="lp-app-grid">
          {/* iOS — disponível */}
          <div className="lp-app-card">
            <div className="lp-app-card__body">
              <div className="lp-card__eyebrow">iPhone (iOS)</div>
              <h3>Disponível na App Store</h3>
              <p>Alertas Críticos que tocam no Silencioso e Live Activities na Ilha Dinâmica.</p>
            </div>
            <div className="lp-app-card__cta">
              <a
                className="lp-app-badge"
                href={appStoreUrl('section')}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Baixar na App Store"
              >
                <img src="/badges/app-store-pt.svg" alt="Baixar na App Store" width={135} height={40} />
              </a>
            </div>
          </div>

          {/* Android — disponível */}
          <div className="lp-app-card">
            <div className="lp-app-card__body">
              <div className="lp-card__eyebrow">Android</div>
              <h3>Disponível no Google Play</h3>
              <p>Canal de alarme sonoro dedicado e leitura de código de barras pela câmera.</p>
            </div>
            <div className="lp-app-card__cta">
              <a
                className="lp-app-badge"
                href={playStoreUrl('section')}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Disponível no Google Play"
              >
                <img
                  src="/badges/google-play-pt.svg"
                  alt="Disponível no Google Play"
                  width={135}
                  height={44}
                  className="lp-app-badge-img"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
