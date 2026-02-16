import React, { useState, useEffect } from 'react'
import './Landing.css' // Keep this import
// Consider importing common components from a centralized place
// import { Button } from '../components/ui/Button'; // Example

// Consider extracting this into a separate component if it becomes complex
const FloatingCard = ({ icon, text, animationDelay }) => (
  <div className={`floating-card card-1`} style={{ animationDelay: `${animationDelay}s` }}>
    <div className="card-icon">{icon}</div>
    <div className="card-text">{text}</div>
  </div>
)

export default function Landing({
  isAuthenticated = false,
  onOpenAuth = () => {},
  onContinue = () => {},
}) {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-section" style={{ transform: `translateY(${scrollY * 0.5}px)` }}>
        <div className="hero-content">
          <div className="hero-badge">
            <span>✨ Gerenciamento de Medicamentos Inteligente</span>
          </div>

          <h1 className="hero-title">
            Nunca Esqueça
            <br />
            <span className="gradient-text">Seus Remédios Novamente</span>
          </h1>

          <p className="hero-subtitle">
            Organize medicamentos, controle estoque e automatize lembretes — tudo em sincronização
            perfeita entre seus dispositivos.
          </p>

          <div className="hero-cta">
            {!isAuthenticated ? (
              <>
                <button className="btn-primary" onClick={onOpenAuth}>
                  Começar Agora
                  <span className="btn-arrow">→</span>
                </button>
                <button className="btn-secondary" onClick={onOpenAuth}>
                  Fazer Login
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
              <span className="stat-number">100%</span>
              <span className="stat-label">Sincronizado</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">∞</span>
              <span className="stat-label">Dispositivos</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">24/7</span>
              <span className="stat-label">Disponível</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <FloatingCard icon="💊" text="Medicamento" animationDelay={0} />
          <FloatingCard icon="📅" text="Agenda" animationDelay={0.5} />
          <FloatingCard icon="📊" text="Histórico" animationDelay={1} />
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header">
          <h2>Recursos Principais</h2>
          <p>Tudo que você precisa em um único lugar</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon glow-cyan">🎯</div>
            <h3>Doses Precisas</h3>
            <p>
              Agende medicamentos com horários específicos e receba lembretes automáticos para não
              esquecer nenhuma dose.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon glow-magenta">📦</div>
            <h3>Controle de Estoque</h3>
            <p>
              Monitore a quantidade de medicamentos e receba alertas quando estiverem acabando.
              Reposição facilitada.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon glow-cyan">📋</div>
            <h3>Protocolos Flexíveis</h3>
            <p>
              Configure tratamentos com titulação de dose, múltiplos medicamentos e acompanhe toda
              evolução.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon glow-magenta">📊</div>
            <h3>Relatórios Detalhados</h3>
            <p>
              Acesse histórico completo com gráficos, adesão a tratamento e compartilhe com seu
              médico.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon glow-cyan">🤖</div>
            <h3>Bot Telegram</h3>
            <p>
              Receba lembretes, verifique status e tome doses direto do Telegram. Automação total
              opcional.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon glow-magenta">🔒</div>
            <h3>100% Seguro</h3>
            <p>
              Dados criptografados, backup automático e autenticação segura. Sua privacidade é
              prioridade.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="section-header">
          <h2>Por Que Escolher</h2>
          <p>Benefícios reais para sua saúde</p>
        </div>

        <div className="benefits-container">
          <div className="benefit-item">
            <div className="benefit-number">1</div>
            <h3>Maior Adesão</h3>
            <p>
              Lembretes inteligentes garantem que você nunca perca uma dose. Estudos mostram aumento
              de 87% na adesão ao tratamento.
            </p>
          </div>

          <div className="benefit-item">
            <div className="benefit-number">2</div>
            <h3>Menos Stress</h3>
            <p>
              Elimine a ansiedade de "será que tomei o remédio?". Histórico automático registra tudo
              para você.
            </p>
          </div>

          <div className="benefit-item">
            <div className="benefit-number">3</div>
            <h3>Dados para seu Médico</h3>
            <p>
              Compartilhe relatórios precisos com seu médico. Dados reais melhoram diagnósticos e
              ajustes de tratamento.
            </p>
          </div>

          <div className="benefit-item">
            <div className="benefit-number">4</div>
            <h3>Controle Total</h3>
            <p>
              Monitore estoques, evite desperdícios e planeje reposições com antecedência. Economize
              tempo e dinheiro.
            </p>
          </div>
        </div>
      </section>

      {/* Multi-Device Section */}
      <section className="multidevice-section">
        <div className="section-header">
          <h2>Acesse em Qualquer Lugar</h2>
          <p>Sincronização perfeita entre todos os seus dispositivos</p>
        </div>

        <div className="devices-showcase">
          <div className="device-card device-phone">
            <div className="device-frame">
              <div className="device-notch"></div>
              <div className="device-content">
                <div className="device-header">Celular</div>
                <div className="device-item">💊 Tomar agora</div>
                <div className="device-item">📅 Próxima dose</div>
              </div>
            </div>
            <p>Sempre com você</p>
          </div>

          <div className="device-card device-tablet">
            <div className="device-frame">
              <div className="device-content">
                <div className="device-header">Tablet</div>
                <div className="device-item">📊 Dashboard</div>
                <div className="device-item">📋 Protocolos</div>
              </div>
            </div>
            <p>Visualização ampla</p>
          </div>

          <div className="device-card device-desktop">
            <div className="device-frame">
              <div className="device-content">
                <div className="device-header">Desktop</div>
                <div className="device-item">📈 Relatórios</div>
                <div className="device-item">⚙️ Configurações</div>
              </div>
            </div>
            <p>Gerenciamento completo</p>
          </div>
        </div>

        <p className="sync-info">✨ Login uma vez. Tudo sincronizado automaticamente.</p>
      </section>

      {/* Telegram Section */}
      <section className="telegram-section">
        <div className="telegram-content">
          <div className="telegram-icon">🤖</div>
          <h2>Telegram Bot Integrado</h2>
          <p className="telegram-subtitle">
            Tenha acesso a tudo no seu Telegram. Sem sair do app de mensagens!
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

          <p className="telegram-note">
            Configure em 30 segundos na seção de Configurações do app.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="final-cta-section">
        <div className="cta-card">
          <h2>Pronto para simplificar sua vida?</h2>
          <p>Comece gratuitamente. Sem cartão de crédito necessário.</p>

          <div className="final-cta-buttons">
            {!isAuthenticated ? (
              <>
                <button className="btn-large btn-primary" onClick={onOpenAuth}>
                  Criar Conta Agora
                </button>
                <button className="btn-large btn-secondary" onClick={onOpenAuth}>
                  Já tenho conta
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

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2025 Meus Remédios. Todos os direitos reservados.</p>
        <p className="footer-tagline">Saúde em primeiro lugar. Tecnologia a serviço do bem.</p>
      </footer>
    </div>
  )
}
