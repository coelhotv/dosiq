import React, { useRef, useEffect } from 'react'
import AppPreview from '@shared/components/AppPreview'
import { useTheme } from '@shared/hooks/useTheme'
import './Landing.css'

export default function Landing({
  isAuthenticated = false,
  onOpenAuth = () => {},
  onContinue = () => {},
}) {
  const heroSectionRef = useRef(null)
  const { isDark, toggleTheme } = useTheme()

  // Garante que Landing carrega em tema escuro
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
            Medicamentos, horários, estoque e adesão — tudo em um app gratuito feito para o Brasil.
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
              Use o autocomplete com base ANVISA (10.000+ medicamentos) e preencha nome, princípio
              ativo e laboratório em segundos.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon">📅</div>
            <h3>Defina seus protocolos</h3>
            <p>
              Configure frequência, horários e doses. O app organiza tudo nas zonas Atrasadas /
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
            <h3>Doses por Zona</h3>
            <p>Atrasadas, Agora e Próximas — organizadas automaticamente pelo horário atual</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Estoque Visual</h3>
            <p>
              Barras de criticidade mostram de relance quem vai acabar. Alertas com 7 dias de
              antecedência
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Base ANVISA</h3>
            <p>
              10.000+ medicamentos brasileiros. Autocomplete preenche nome, princípio ativo e
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
            <p>Visualize seus protocolos e histórico de forma ampla no tablet.</p>
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

        <p className="sync-info">✨ Sincronize uma vez, acesse em qualquer lugar.</p>
      </section>

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
