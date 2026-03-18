/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { 
  Bell, 
  CheckCircle2, 
  Smartphone, 
  Users, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  HeartPulse, 
  MessageCircle, 
  Camera, 
  Watch, 
  FileText, 
  Activity,
  Database,
  Package,
  Calendar,
  Lock,
  Download,
  Zap
} from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <HeartPulse size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Meus Remédios</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#solucoes" className="text-sm font-medium text-slate-600 hover:text-blue-600">Soluções</a>
            <a href="#funcionalidades" className="text-sm font-medium text-slate-600 hover:text-blue-600">Recursos</a>
            <a href="#privacidade" className="text-sm font-medium text-slate-600 hover:text-blue-600">Privacidade</a>
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-semibold text-emerald-600 lg:block">100% Gratuito</span>
            <button className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 active:scale-95">
              Instalar App
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-6 py-20 md:py-32">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-50/50 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-emerald-50/50 blur-3xl" />
          
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
                  <Zap size={16} />
                  <span>Gratuito para sempre • Sem Paywall</span>
                </div>
                <h1 className="mb-6 text-5xl font-extrabold leading-[1.1] tracking-tight text-slate-900 md:text-7xl">
                  Controle total da sua saúde, <span className="text-blue-600">no seu bolso.</span>
                </h1>
                <p className="mb-10 text-lg leading-relaxed text-slate-600 md:text-xl">
                  Organize seus medicamentos com a base oficial da <b>ANVISA</b>, receba alertas via <b>Telegram</b> e gere relatórios profissionais para seu médico. Tudo privado, tudo gratuito.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-bold text-white transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200 active:scale-95">
                    Começar Agora
                    <ArrowRight size={20} />
                  </button>
                  <button className="flex items-center justify-center gap-2 rounded-full border-2 border-slate-200 bg-white px-8 py-4 text-lg font-bold text-slate-700 transition-all hover:border-blue-200 hover:bg-blue-50 active:scale-95">
                    Conhecer o Bot Telegram
                  </button>
                </div>
                <div className="mt-10 flex items-center gap-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Database size={18} className="text-blue-500" />
                    <span>10.000+ Meds ANVISA</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Lock size={18} className="text-emerald-500" />
                    <span>Privacy-First (Local Only)</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
              >
                <div className="relative z-10 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
                  <div className="aspect-[9/16] w-full rounded-2xl bg-slate-50 p-6 overflow-y-auto custom-scrollbar">
                    {/* Simulated App Interface */}
                    <div className="mb-8 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">M</div>
                        <div>
                          <p className="text-xs text-slate-400">Adesão hoje</p>
                          <p className="text-lg font-bold text-slate-900">92% • Streak: 12d</p>
                        </div>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Bell size={20} />
                      </div>
                    </div>
                    
                    <div className="mb-6 rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold uppercase text-slate-400">Estoque Crítico</p>
                        <Package size={16} className="text-red-500" />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-700">Metformina 850mg</p>
                        <p className="text-sm font-bold text-red-600">4 comps restantes</p>
                      </div>
                      <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full w-[15%] bg-red-500" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Próximas Doses</p>
                        <Calendar size={14} className="text-slate-400" />
                      </div>
                      {[
                        { time: "12:00", name: "Losartana", dose: "1 comp", type: "Hipertensão", color: "bg-blue-100 text-blue-700" },
                        { time: "14:00", name: "Omeprazol", dose: "20mg", type: "Gástrico", color: "bg-purple-100 text-purple-700" },
                        { time: "20:00", name: "Sinvastatina", dose: "40mg", type: "Colesterol", color: "bg-orange-100 text-orange-700" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="text-xs font-bold text-slate-500">{item.time}</div>
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                              <div className="text-[10px] text-slate-400">{item.dose}</div>
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-md text-[10px] font-bold ${item.color}`}>{item.type}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <p className="text-xs font-bold text-emerald-800">Cartão de Emergência Ativo</p>
                      </div>
                      <p className="text-[10px] text-emerald-700 leading-tight">Disponível offline para socorristas e médicos em caso de urgência.</p>
                    </div>
                  </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute -right-8 -top-8 z-20 animate-bounce rounded-2xl bg-white p-4 shadow-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="text-blue-500" size={24} />
                    <span className="text-xs font-bold">Telegram Bot Ativo</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Value Proposition Grid */}
        <section id="solucoes" className="bg-slate-50 py-24 px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-5xl">O fim do esquecimento</h2>
              <p className="mx-auto max-w-2xl text-slate-600">Uma ferramenta profissional de saúde, simplificada para o uso diário. Sem assinaturas, sem anúncios.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                { 
                  icon: <Zap className="text-emerald-600" />, 
                  title: "100% Gratuito", 
                  desc: "Funcionalidades essenciais ilimitadas. Sem paywalls, sem versões 'Pro'. Nosso compromisso é com a sua saúde.",
                  tag: "Sempre Grátis"
                },
                { 
                  icon: <Database className="text-blue-600" />, 
                  title: "Base ANVISA", 
                  desc: "Autocomplete com mais de 10.000 medicamentos registrados. Preenchimento automático de dosagens e apresentações.",
                  tag: "Dados Oficiais"
                },
                { 
                  icon: <MessageCircle className="text-sky-500" />, 
                  title: "Alertas Multicanal", 
                  desc: "Receba notificações via PWA no celular ou através do nosso Bot exclusivo no Telegram. Você escolhe onde ser avisado.",
                  tag: "Flexível"
                }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -5 }}
                  className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100"
                >
                  <div className="mb-4 inline-block rounded-lg bg-slate-50 p-3">
                    {item.icon}
                  </div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.tag}</div>
                  <h3 className="mb-3 text-xl font-bold text-slate-900">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Detailed Features (MVP) */}
        <section id="funcionalidades" className="py-24 px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-20 grid items-end gap-8 md:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 md:text-5xl tracking-tight mb-4">Pronto para o uso clínico.</h2>
                <p className="text-lg text-slate-600">Ferramentas avançadas que ajudam você e seu médico a tomarem melhores decisões baseadas em dados reais.</p>
              </div>
              <div className="flex justify-md-end">
                <div className="rounded-2xl bg-blue-50 p-6 border border-blue-100">
                  <p className="text-sm font-bold text-blue-800 mb-1">Inteligência Local</p>
                  <p className="text-xs text-blue-600 leading-tight">Previsão de estoque e score de risco calculados diretamente no seu aparelho. Privacidade total.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: <Package />, title: "Controle de Estoque", desc: "Alertas automáticos quando seus comprimidos estão acabando." },
                { icon: <FileText />, title: "PDF para o Médico", desc: "Gere relatórios profissionais com seu histórico de adesão em um clique." },
                { icon: <ShieldCheck />, title: "Cartão de Emergência", desc: "Acesso offline aos seus medicamentos ativos para situações de urgência." },
                { icon: <Activity />, title: "Score de Adesão", desc: "Acompanhe sua evolução com gráficos de tendências e streaks." },
                { icon: <Smartphone />, title: "PWA Instalável", desc: "Instale na sua tela inicial sem precisar de lojas de aplicativos." },
                { icon: <Clock />, title: "Protocolos Flexíveis", desc: "Diário, semanal, personalizado ou 'quando necessário'." },
                { icon: <Download />, title: "Portabilidade Total", desc: "Exporte seus dados em CSV ou JSON a qualquer momento." },
                { icon: <Lock />, title: "Analytics Privado", desc: "Sem telemetria externa. Seus dados de uso ficam apenas no seu celular." },
              ].map((feature, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    {cloneElement(feature.icon as React.ReactElement, { size: 20 })}
                  </div>
                  <h4 className="font-bold text-slate-900">{feature.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section id="privacidade" className="bg-slate-900 py-24 px-6 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 blur-[120px] -z-10" />
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-blue-300">
                  <Lock size={16} />
                  <span>Privacidade em Primeiro Lugar</span>
                </div>
                <h2 className="mb-6 text-3xl font-bold md:text-5xl tracking-tight">Seus dados são apenas seus.</h2>
                <p className="mb-8 text-lg text-slate-400 leading-relaxed">
                  Diferente de outros apps, o <b>Meus Remédios</b> não armazena suas informações em servidores centrais. Tudo é processado e guardado localmente no seu dispositivo (localStorage). 
                </p>
                <ul className="space-y-4 mb-10">
                  {[
                    "Sem rastreadores de publicidade",
                    "Sem venda de dados para farmácias",
                    "Sem necessidade de criar conta com senha",
                    "Exportação completa de dados garantida"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-300">
                      <CheckCircle2 size={18} className="text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="rounded-3xl bg-white/5 border border-white/10 p-8 backdrop-blur-md">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <ShieldCheck className="text-blue-400" size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-lg">Segurança Offline</p>
                      <p className="text-sm text-slate-400">Arquitetura Privacy-First</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed italic">
                    "Acreditamos que dados de saúde são sagrados. Por isso, construímos uma ferramenta onde a inteligência acontece no seu navegador, garantindo que ninguém — nem mesmo nós — tenha acesso ao que você toma."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6">
          <div className="mx-auto max-w-4xl rounded-[3rem] bg-blue-600 p-12 text-center text-white md:p-20 shadow-2xl shadow-blue-200">
            <h2 className="mb-6 text-4xl font-bold md:text-6xl tracking-tight">Comece a cuidar da sua saúde hoje.</h2>
            <p className="mb-10 text-lg text-blue-100 md:text-xl">Gratuito para sempre. Sem pegadinhas. Sem anúncios.</p>
            <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
              <button className="w-full rounded-full bg-white px-10 py-5 text-xl font-bold text-blue-600 transition-all hover:bg-slate-50 hover:shadow-2xl active:scale-95 sm:w-auto">
                Instalar Agora
              </button>
              <div className="flex flex-col items-start text-left">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <CheckCircle2 size={16} />
                  <span>PWA Compatível</span>
                </div>
                <p className="text-xs text-blue-200">iOS, Android e Desktop</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-12 px-6 bg-slate-50">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <HeartPulse size={18} />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">Meus Remédios</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-500">
              <a href="#" className="hover:text-blue-600">Base ANVISA</a>
              <a href="#" className="hover:text-blue-600">Telegram Bot</a>
              <a href="#" className="hover:text-blue-600">Código Aberto</a>
            </div>
            <p className="text-sm text-slate-400">© 2026 Meus Remédios. Desenvolvido para o bem comum.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper to clone icons with specific size
import { cloneElement } from "react";
