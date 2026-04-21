import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Activity as MedIcon, 
  Package, 
  HeartPulse, 
  User, 
  Bell, 
  Search, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus,
  Moon,
  Sun,
  Sunrise,
  ArrowRight,
  TrendingDown,
  MoreVertical,
  Pill,
  Syringe,
  Droplets,
  Zap
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { MOCK_MEDICATIONS, type Medication, type View } from './types';

// --- Shared Components ---

const Sidebar = ({ currentView, setView }: { currentView: View; setView: (v: View) => void }) => {
  const navItems = [
    { id: 'hoje', label: 'Hoje', icon: Calendar },
    { id: 'tratamentos', label: 'Tratamentos', icon: MedIcon },
    { id: 'estoque', label: 'Estoque', icon: Package },
    { id: 'saude', label: 'Saúde & Portabilidade', icon: HeartPulse },
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  return (
    <aside className="hidden md:flex flex-col h-screen w-72 border-r border-outline-variant bg-surface-container-low py-8 px-4 gap-2 sticky top-0">
      <div className="mb-8 px-4">
        <h1 className="text-xl font-bold text-primary font-headline tracking-tight">Dosiq</h1>
        <p className="text-xs text-outline mt-1 font-medium">Gestão de Saúde</p>
      </div>
      
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as View)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium",
              currentView === item.id 
                ? "bg-primary-container/10 text-primary font-semibold" 
                : "text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <item.icon size={20} className={cn(currentView === item.id && "fill-primary/20")} />
            <span className="font-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto px-4 py-4 bg-surface-container-lowest rounded-xl editorial-shadow">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed font-bold">
            JS
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">João Silva</p>
            <p className="text-xs text-primary font-semibold">Hoje, 08:00</p>
          </div>
        </div>
        <button className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-label text-sm py-3 rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2">
          <Plus size={16} />
          Adicionar Medicamento
        </button>
      </div>
    </aside>
  );
};

const TopBar = ({ title }: { title: string }) => (
  <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center h-16 px-8 w-full border-b border-surface-container-high">
    <h2 className="font-headline font-extrabold text-xl text-on-surface tracking-tight">{title}</h2>
    <div className="flex items-center gap-4">
      <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors relative">
        <Bell size={20} />
        <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
      </button>
      <div className="h-8 w-8 rounded-full bg-tertiary-fixed flex items-center justify-center">
        <User size={18} className="text-tertiary" />
      </div>
    </div>
  </header>
);

// --- Views ---

const DashboardView = () => {
  const periods = [
    { id: 'Madrugada', icon: Moon, color: 'text-outline' },
    { id: 'Manhã', icon: Sunrise, color: 'text-tertiary' },
    { id: 'Tarde', icon: Sun, color: 'text-secondary' },
    { id: 'Noite', icon: Moon, color: 'text-on-secondary-container' },
  ];

  const medsByPeriod = useMemo(() => {
    return periods.reduce((acc, p) => {
      acc[p.id] = MOCK_MEDICATIONS.filter(m => m.period === p.id);
      return acc;
    }, {} as Record<string, Medication[]>);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column */}
      <div className="lg:col-span-4 flex flex-col gap-8">
        <section className="bg-surface-container-lowest p-8 rounded-xl editorial-shadow flex flex-col items-center text-center">
          <h3 className="font-headline text-lg font-bold text-on-surface mb-6">Adesão Diária</h3>
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="96" cy="96" r="80" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-surface-container" />
              <circle 
                cx="96" cy="96" r="80" fill="transparent" stroke="currentColor" strokeWidth="12" 
                strokeDasharray={502.6} strokeDashoffset={502.6 * (1 - 0.85)}
                strokeLinecap="round"
                className="text-primary transition-all duration-1000" 
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-headline text-4xl font-black text-primary">85%</span>
              <span className="font-label text-[10px] text-outline font-bold uppercase tracking-widest mt-1">Concluído</span>
            </div>
          </div>
          <p className="mt-6 text-sm text-on-surface-variant leading-relaxed">
            Excelente progresso! Você tomou <span className="font-bold text-primary">6 de 8</span> doses programadas para hoje.
          </p>
        </section>

        <section className="bg-gradient-to-br from-secondary to-secondary-container p-6 rounded-xl editorial-shadow text-on-primary">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Prioridade Máxima</span>
            <Clock size={18} />
          </div>
          <div className="mb-6">
            <h3 className="font-headline text-3xl font-black mb-1">08:00</h3>
            <p className="font-label text-sm opacity-90">Em 15 minutos</p>
          </div>
          <div className="space-y-3">
            {MOCK_MEDICATIONS.filter(m => m.time === '08:00' && m.status === 'pending').map(m => (
              <div key={m.id} className="bg-white/10 p-3 rounded-lg flex items-center gap-3">
                <MedIcon size={18} className="text-secondary-fixed" />
                <div>
                  <p className="font-bold text-sm">{m.name} {m.dosage}</p>
                  <p className="text-[10px] opacity-80">1 {m.type} • Jejum</p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full bg-white text-secondary font-bold py-3 rounded-lg active:scale-95 transition-transform">
            Confirmar Agora
          </button>
        </section>
      </div>

      {/* Right Column */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <header className="flex justify-between items-end">
          <div>
            <h3 className="font-headline text-2xl font-black text-on-surface">Cronograma de Hoje</h3>
            <p className="text-on-surface-variant text-sm mt-1">Sexta-feira, 24 de Maio</p>
          </div>
          <div className="flex gap-2">
            <button className="p-2 border border-outline-variant rounded-lg text-outline hover:bg-surface-container-low transition-colors">
              <Calendar size={20} />
            </button>
            <button className="p-2 border border-outline-variant rounded-lg text-outline hover:bg-surface-container-low transition-colors">
              <Filter size={20} />
            </button>
          </div>
        </header>

        <div className="space-y-6">
          {periods.map(period => (
            <div key={period.id} className="space-y-3">
              <div className="flex items-center gap-3 px-2">
                <period.icon size={18} className={period.color} />
                <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface-variant">{period.id}</h4>
                <div className="h-[1px] flex-1 bg-surface-container-highest" />
              </div>
              
              {medsByPeriod[period.id]?.length === 0 ? (
                <div className="px-6 py-4 bg-surface-container-low rounded-xl border border-dashed border-outline-variant text-center">
                  <p className="text-xs text-outline italic">Nenhum medicamento para este período</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {medsByPeriod[period.id].map(med => (
                    <div 
                      key={med.id} 
                      className={cn(
                        "bg-surface-container-lowest p-5 rounded-xl border-l-4 editorial-shadow transition-all group",
                        med.status === 'taken' ? "border-primary-fixed opacity-60" : "border-primary hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-12 w-12 rounded-full flex items-center justify-center",
                            med.status === 'taken' ? "bg-surface-container" : "bg-primary-fixed"
                          )}>
                            <MedIcon size={20} className={med.status === 'taken' ? "text-outline" : "text-primary"} />
                          </div>
                          <div>
                            <p className="font-headline font-bold text-on-surface">{med.name}</p>
                            <p className="text-xs text-on-surface-variant font-medium">{med.dosage} • {med.time}</p>
                          </div>
                        </div>
                        {med.status === 'taken' && <CheckCircle2 size={16} className="text-primary" />}
                        {med.stockDays && med.stockDays < 15 && (
                          <span className="text-[9px] font-black bg-primary-fixed text-on-primary-fixed-variant px-2 py-1 rounded">ESTOQUE: {med.stockDays} dias</span>
                        )}
                      </div>
                      {med.status === 'pending' && (
                        <div className="mt-4 flex gap-2">
                          <button className="flex-1 bg-primary text-on-primary text-xs font-bold py-2 rounded-lg">TOMAR</button>
                          <button className="px-3 bg-surface-container text-outline text-xs font-bold py-2 rounded-lg">ADIAR</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 bg-error-container/20 p-6 rounded-xl border border-error/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-error" />
              <span className="text-sm font-bold text-on-error-container">Estoque Crítico: Metformina</span>
            </div>
            <span className="text-xs font-black text-error">4 doses restantes</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-error rounded-full" style={{ width: '15%' }} />
          </div>
          <div className="mt-4 flex justify-end">
            <button className="text-error font-bold text-xs flex items-center gap-2 hover:underline">
              Solicitar Refil <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TreatmentsView = () => {
  const [expandedId, setExpandedId] = useState<string | null>('7'); // Prednisona expanded by default

  const categories = Array.from(new Set(MOCK_MEDICATIONS.map(m => m.category)));

  return (
    <div className="flex-1 flex flex-col">
      <section className="px-8 py-6 flex flex-col md:flex-row gap-4 items-center justify-between border-b border-surface-container">
        <div className="relative w-full md:max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input 
            className="w-full pl-12 pr-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-body" 
            placeholder="Buscar medicamento ou sintoma..." 
            type="text"
          />
        </div>
        <div className="flex p-1 bg-surface-container-low rounded-xl w-full md:w-auto">
          <button className="flex-1 md:flex-none px-6 py-2 bg-white shadow-sm rounded-lg text-xs font-bold text-primary transition-all">Ativos</button>
          <button className="flex-1 md:flex-none px-6 py-2 text-xs font-medium text-outline-variant hover:text-on-surface-variant transition-all">Pausados</button>
          <button className="flex-1 md:flex-none px-6 py-2 text-xs font-medium text-outline-variant hover:text-on-surface-variant transition-all">Finalizados</button>
        </div>
      </section>

      <section className="px-8 py-8 flex flex-col gap-8">
        {categories.map(category => (
          <div key={category} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-bold text-outline uppercase tracking-widest flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  category === 'Cardiovascular' ? "bg-secondary" : 
                  category === 'Diabetes' ? "bg-tertiary" : "bg-error"
                )} />
                {category}
              </h3>
              <span className="text-[10px] font-bold text-outline-variant">
                {MOCK_MEDICATIONS.filter(m => m.category === category).length} ITENS
              </span>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              {MOCK_MEDICATIONS.filter(m => m.category === category).map((med, idx, arr) => (
                <div key={med.id}>
                  <div 
                    onClick={() => setExpandedId(expandedId === med.id ? null : med.id)}
                    className="grid grid-cols-12 gap-4 items-center p-4 hover:bg-surface-container-low transition-colors cursor-pointer group"
                  >
                    <div className="col-span-4 flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        category === 'Cardiovascular' ? "bg-secondary-fixed" : 
                        category === 'Diabetes' ? "bg-tertiary-fixed" : "bg-error-container"
                      )}>
                        <MedIcon size={20} className={cn(
                          category === 'Cardiovascular' ? "text-on-secondary-fixed" : 
                          category === 'Diabetes' ? "text-on-tertiary-fixed" : "text-on-error-container"
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{med.name}</h4>
                          {med.titration && (
                            <span className="bg-tertiary-fixed text-on-tertiary-fixed text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase flex items-center gap-1">
                              <TrendingDown size={10} />
                              Titulação
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-outline font-medium">{med.dosage} • {med.type}</p>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-bold text-on-surface">{med.time === 'Semanal' ? '1x por semana' : '1x ao dia'}</p>
                      <p className="text-[10px] text-outline font-medium">{med.time}</p>
                    </div>
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="flex gap-[2px]">
                        {[1, 2, 3, 4, 5, 6, 7].map(i => (
                          <div key={i} className={cn("w-1 h-3 rounded-full", i <= 5 ? "bg-primary" : "bg-primary/20")} />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-primary">{med.adherence}%</span>
                    </div>
                    <div className="col-span-2 flex flex-col gap-1">
                      <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", med.remainingDoses < 5 ? "bg-error" : "bg-secondary")} style={{ width: `${(med.remainingDoses / med.totalDoses) * 100}%` }} />
                      </div>
                      <span className={cn("text-[10px] font-bold", med.remainingDoses < 5 ? "text-error" : "text-outline")}>
                        {med.remainingDoses < 5 && <AlertTriangle size={10} className="inline mr-1" />}
                        {med.remainingDoses} {med.type === 'Injetável' ? 'frasco' : 'unidades'}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <ChevronRight size={18} className={cn("text-outline-variant transition-transform", expandedId === med.id && "rotate-90")} />
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedId === med.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-surface-container-low px-4 py-6 border-t border-white/50 overflow-hidden"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="flex flex-col gap-4">
                            <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Protocolo de Redução</p>
                            <div className="flex flex-col gap-2">
                              {med.titration?.steps.map(step => (
                                <div 
                                  key={step.week}
                                  className={cn(
                                    "flex items-center justify-between p-2 rounded-lg border-l-4",
                                    step.status === 'completed' ? "bg-white border-primary opacity-60" :
                                    step.status === 'current' ? "bg-white border-primary-fixed shadow-sm" :
                                    "bg-white/50 border-outline-variant"
                                  )}
                                >
                                  <span className={cn("text-xs", step.status === 'current' ? "font-bold" : "font-medium")}>
                                    Semana {step.week}: {step.dose} {step.status === 'current' && "(Atual)"}
                                  </span>
                                  {step.status === 'completed' && <CheckCircle2 size={14} className="text-primary" />}
                                  {step.status === 'current' && <span className="text-[9px] font-bold text-primary">DIA 3/7</span>}
                                  {step.status === 'upcoming' && <Clock size={14} className="text-outline-variant" />}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-4">Notas Clínicas</p>
                            <div className="bg-white/80 p-4 rounded-xl text-xs leading-relaxed text-on-surface-variant">
                              {med.titration?.notes || "Nenhuma nota clínica disponível para este tratamento."}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {idx < arr.length - 1 && <div className="h-[1px] bg-surface-container-low mx-4" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="fixed bottom-8 right-8 w-80 bg-surface-container-lowest rounded-2xl p-6 shadow-2xl border border-surface-container z-40 hidden xl:block">
        <h4 className="text-sm font-bold text-primary mb-4 flex items-center justify-between">
          Resumo Semanal
          <Zap size={18} className="text-primary" />
        </h4>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-surface-container" />
              <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray="176" strokeDashoffset={176 * (1 - 0.85)} className="text-primary" />
            </svg>
            <span className="absolute text-[10px] font-bold text-primary">85%</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-outline uppercase">Adesão Geral</p>
            <p className="text-xs font-medium text-on-surface-variant leading-tight">Você esqueceu apenas 2 doses esta semana.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-outline">Melhor Horário:</span>
            <span className="font-bold text-on-surface">Manhã (100%)</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-outline">Próxima Consulta:</span>
            <span className="font-bold text-secondary">Em 4 dias</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StockView = () => {
  const criticalMeds = MOCK_MEDICATIONS.filter(m => m.remainingDoses < 5);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full flex flex-col gap-10">
      <section>
        <div className="bg-error-container/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-8 border-error">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-error" />
            </div>
            <div>
              <h3 className="font-headline text-2xl font-bold text-on-error-container">{criticalMeds.length} itens precisam de reposição imediata</h3>
              <p className="font-body text-sm text-on-surface-variant">Seu estoque de medicação contínua está abaixo do limite de segurança.</p>
            </div>
          </div>
          <button className="px-6 h-14 bg-error text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-error/20 active:scale-95 transition-all">
            <Package size={20} />
            Comprar Tudo Agora
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h4 className="font-headline text-lg font-bold text-on-surface">Inventário Ativo ({MOCK_MEDICATIONS.length})</h4>
          <button className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-container-low text-on-surface-variant flex items-center gap-2">
            <Filter size={14} />
            Dias Restantes
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_MEDICATIONS.map(med => {
            const isCritical = med.remainingDoses < 5;
            const isWarning = med.remainingDoses >= 5 && med.remainingDoses < 10;
            
            return (
              <div 
                key={med.id} 
                className={cn(
                  "bg-surface-container-lowest rounded-2xl p-5 shadow-sm border-l-4 transition-all hover:shadow-md",
                  isCritical ? "border-error" : isWarning ? "border-tertiary" : "border-primary"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={cn(
                      "inline-block px-2 py-1 rounded text-[9px] font-bold mb-2 uppercase tracking-wider",
                      isCritical ? "bg-error/10 text-error" : isWarning ? "bg-tertiary-fixed text-tertiary" : "bg-primary-fixed text-primary"
                    )}>
                      {isCritical ? "URGENTE" : isWarning ? "ATENÇÃO" : "SEGURO"}
                    </span>
                    <h5 className="font-headline text-lg font-bold">{med.name} {med.dosage}</h5>
                    <p className="text-xs text-on-surface-variant">1 dose/dia - {med.period}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-2xl font-black leading-none", isCritical ? "text-error" : isWarning ? "text-tertiary" : "text-primary")}>
                      {med.stockDays || Math.floor(med.remainingDoses)}
                    </p>
                    <p className={cn("text-[9px] uppercase font-bold", isCritical ? "text-error" : isWarning ? "text-tertiary" : "text-primary")}>Dias</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex justify-between text-[10px] font-bold mb-2">
                    <span>{med.remainingDoses} de {med.totalDoses} {med.type === 'Injetável' ? 'frasco' : 'unidades'}</span>
                    <span className={isCritical ? "text-error" : ""}>{Math.round((med.remainingDoses / med.totalDoses) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full", isCritical ? "bg-error" : isWarning ? "bg-tertiary" : "bg-primary")} 
                      style={{ width: `${(med.remainingDoses / med.totalDoses) * 100}%` }} 
                    />
                  </div>
                </div>

                {isCritical ? (
                  <button className="w-full h-12 bg-error text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-xs">
                    <Package size={16} />
                    Comprar Agora
                  </button>
                ) : isWarning ? (
                  <button className="w-full h-12 bg-surface-container-low text-tertiary font-bold rounded-xl flex items-center justify-center gap-2 border border-tertiary/20 hover:bg-tertiary/5 active:scale-95 transition-all text-xs">
                    <Plus size={16} />
                    Reabastecer
                  </button>
                ) : (
                  <button className="w-full h-12 bg-transparent text-on-surface-variant font-semibold rounded-xl flex items-center justify-center gap-2 opacity-40 hover:opacity-100 transition-all text-xs">
                    <Clock size={16} />
                    Agendar Compra
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<View>('hoje');

  const renderView = () => {
    switch (view) {
      case 'hoje': return <DashboardView />;
      case 'tratamentos': return <TreatmentsView />;
      case 'estoque': return <StockView />;
      default: return (
        <div className="flex-1 flex items-center justify-center text-outline italic">
          Funcionalidade em desenvolvimento...
        </div>
      );
    }
  };

  const getTitle = () => {
    switch (view) {
      case 'hoje': return 'Painel de Controle';
      case 'tratamentos': return 'Tratamentos';
      case 'estoque': return 'Estoque de Medicamentos';
      case 'saude': return 'Saúde & Portabilidade';
      case 'perfil': return 'Perfil';
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar currentView={view} setView={setView} />
      
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <TopBar title={getTitle()} />
        
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-surface-container-high flex justify-around items-center h-16 z-50">
          {[
            { id: 'hoje', icon: Calendar, label: 'Hoje' },
            { id: 'tratamentos', icon: MedIcon, label: 'Tratamento' },
            { id: 'estoque', icon: Package, label: 'Estoque' },
            { id: 'perfil', icon: User, label: 'Perfil' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={cn(
                "flex flex-col items-center gap-1",
                view === item.id ? "text-primary" : "text-on-surface-variant"
              )}
            >
              <item.icon size={20} className={view === item.id ? "fill-primary/10" : ""} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
