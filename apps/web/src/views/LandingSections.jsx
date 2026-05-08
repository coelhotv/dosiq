/**
 * LandingSections — Seções estáticas da Landing page.
 */
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
          <h2>O fim do esquecimento</h2>
          <p>
            Uma ferramenta profissional de saúde, simplificada para o uso diário. Sem
            assinaturas, sem anúncios.
          </p>
        </div>

        <div className="lp-card-grid lp-card-grid--three">
          <div className="lp-card">
            <div className="lp-card__icon"><ZapIcon className="lp-text-green" size={24} /></div>
            <div className="lp-card__eyebrow">Sempre Grátis</div>
            <h3>100% Gratuito</h3>
            <p>Funcionalidades essenciais ilimitadas. Sem travas, sem versões &apos;Pro&apos;. Nosso compromisso é com a sua saúde.</p>
          </div>

          <div className="lp-card">
            <div className="lp-card__icon"><DatabaseIcon className="lp-text-blue" size={24} /></div>
            <div className="lp-card__eyebrow">Dados Oficiais</div>
            <h3>Base ANVISA</h3>
            <p>Autocompletar com mais de 10.000 medicamentos registrados. Preenchimento automático de dosagens e apresentações.</p>
          </div>

          <div className="lp-card">
            <div className="lp-card__icon"><MessageCircleIcon className="lp-text-sky" size={24} /></div>
            <div className="lp-card__eyebrow">Flexível</div>
            <h3>Alertas Multicanal</h3>
            <p>Receba notificações via PWA no celular ou através do nosso Bot exclusivo no Telegram. Você escolhe onde ser avisado.</p>
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
            <h2>Pronto para o uso clínico.</h2>
            <p>Ferramentas avançadas que ajudam você e seu médico a tomarem melhores decisões baseadas em dados reais.</p>
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
          <div className="lp-feature"><div className="lp-feature__icon"><ActivityIcon size={20} /></div><h4>Escore de Adesão</h4><p>Acompanhe sua evolução com gráficos de tendências e streaks.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><SmartphoneIcon size={20} /></div><h4>PWA Instalável</h4><p>Instale na sua tela inicial sem precisar de lojas de aplicativos.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><ClockIcon size={20} /></div><h4>Protocolos Flexíveis</h4><p>Diário, semanal, personalizado ou &apos;quando necessário&apos;.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><DownloadIcon size={20} /></div><h4>Portabilidade Total</h4><p>Exporte seus dados em CSV ou JSON a qualquer momento.</p></div>
          <div className="lp-feature"><div className="lp-feature__icon"><LockIcon size={20} /></div><h4>Sem Rastreadores</h4><p>Não vendemos seus dados nem exibimos anúncios. Nosso foco é sua saúde.</p></div>
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
              criptografia <b>HTTPS</b> e proteção por <b>Row Level Security (RLS)</b> para
              garantir que seu histórico permaneça privado e inacessível a qualquer pessoa,
              incluindo nossa equipe.
            </p>

            <ul className="lp-check-list">
              <li><CircleCheckIcon className="lp-text-green" size={18} />Sem rastreadores de publicidade</li>
              <li><CircleCheckIcon className="lp-text-green" size={18} />Sem venda de dados para farmácias</li>
              <li><CircleCheckIcon className="lp-text-green" size={18} />Arquitetura técnica segura (HTTPS e RLS)</li>
              <li><CircleCheckIcon className="lp-text-green" size={18} />Exportação completa (CSV/JSON)</li>
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
  )
}
