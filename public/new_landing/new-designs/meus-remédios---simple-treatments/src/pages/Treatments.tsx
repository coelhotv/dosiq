import { motion, AnimatePresence } from 'motion/react';
import { Pill, Calendar, Clock, ChevronRight, Info, Plus, Filter } from 'lucide-react';

const Treatments = () => {
  const treatments = [
    {
      id: 1,
      name: "Tratamento de Ansiedade",
      medication: "Sertralina 50mg",
      schedule: "Diário, 08:00",
      duration: "Contínuo",
      progress: 85,
      status: "Ativo",
      color: "bg-accent"
    },
    {
      id: 2,
      name: "Infecção Respiratória",
      medication: "Amoxicilina 500mg",
      schedule: "A cada 8h (06:00, 14:00, 22:00)",
      duration: "7 dias (Dia 4/7)",
      progress: 57,
      status: "Em andamento",
      color: "bg-blue-500"
    },
    {
      id: 3,
      name: "Suplementação Vitamínica",
      medication: "Vitamina D 2000UI",
      schedule: "Diário, 08:00",
      duration: "30 dias (Dia 12/30)",
      progress: 40,
      status: "Ativo",
      color: "bg-orange-400"
    }
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-bold">Tratamentos</h1>
          <p className="text-on-surface/60 text-lg">Gerencie seus protocolos de saúde com precisão.</p>
        </div>
        <button className="bg-primary text-white p-4 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
          <Plus size={24} />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Treatment List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-display font-bold flex items-center gap-2">
              <Filter size={20} className="text-primary" />
              Tratamentos Ativos
            </h3>
          </div>

          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {treatments.map((treatment, index) => {
                const isContinuous = treatment.duration === "Contínuo";
                const barColor = treatment.color.replace('bg-accent', 'bg-primary').replace('bg-blue-500', 'bg-secondary').replace('bg-orange-400', 'bg-tertiary');
                
                return (
                  <motion.div
                    key={treatment.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass p-6 rounded-[2rem] shadow-ambient hover:scale-[1.01] transition-transform cursor-pointer group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl ${barColor}`}>
                          <Pill size={28} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xl font-display font-bold group-hover:text-primary transition-colors">{treatment.name}</h4>
                          <p className="text-sm font-bold text-on-surface/40 uppercase tracking-widest">{treatment.medication}</p>
                          <div className="flex flex-wrap gap-4 mt-3">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-on-surface/60">
                              <Clock size={14} className="text-primary" /> {treatment.schedule}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-bold text-on-surface/60">
                              <Calendar size={14} className="text-primary" /> {treatment.duration}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        {isContinuous ? (
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest">Adesão</span>
                            <div className="relative w-16 h-16">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-on-surface/5" />
                                <motion.circle 
                                  cx="32" cy="32" r="28" 
                                  stroke="currentColor" 
                                  strokeWidth="6" 
                                  fill="transparent" 
                                  strokeDasharray="175.9" 
                                  initial={{ strokeDashoffset: 175.9 }}
                                  animate={{ strokeDashoffset: 175.9 - (175.9 * treatment.progress) / 100 }}
                                  transition={{ duration: 1.5, ease: "easeOut" }}
                                  className={barColor.replace('bg-', 'text-')} 
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-display font-bold">{treatment.progress}%</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-on-surface/40 uppercase tracking-widest">Progresso</span>
                              <span className="text-lg font-display font-bold text-primary">{treatment.progress}%</span>
                            </div>
                            <div className="w-32 h-2 rounded-full overflow-hidden bg-on-surface/5">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${treatment.progress}%` }}
                                className={`h-full ${barColor}`}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button className="p-3 rounded-xl bg-surface text-on-surface/40 hover:bg-primary hover:text-white transition-all duration-200">
                            <Info size={20} />
                          </button>
                          <button className="p-3 rounded-xl bg-surface text-on-surface/40 hover:bg-primary hover:text-white transition-all duration-200">
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        </div>

        {/* Right Column: Calendar/Summary */}
        <div className="space-y-8">
          <div className="glass p-8 rounded-[2rem] shadow-ambient">
            <h3 className="text-2xl font-display font-bold mb-6">Visão Mensal</h3>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                <div key={i} className="text-[10px] font-bold text-on-surface/20 text-center uppercase tracking-widest">{day}</div>
              ))}
              {Array.from({ length: 31 }).map((_, i) => {
                const day = i + 1;
                const isToday = day === 21;
                const hasMed = [5, 12, 18, 21, 25, 28].includes(day);
                return (
                  <div 
                    key={i} 
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200 cursor-pointer
                      ${isToday ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-surface text-on-surface/60'}
                      ${hasMed && !isToday ? 'bg-primary-fixed/30' : ''}
                    `}
                  >
                    {day}
                    {hasMed && !isToday && <div className="absolute mt-5 w-1 h-1 rounded-full bg-primary" />}
                  </div>
                );
              })}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-container-low">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-bold text-on-surface/60 uppercase tracking-widest">Dose Tomada</span>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-container-low">
                <div className="w-2 h-2 rounded-full bg-error" />
                <span className="text-xs font-bold text-on-surface/60 uppercase tracking-widest">Dose Perdida</span>
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-[2rem] shadow-ambient bg-secondary-fixed/10">
            <h3 className="text-xl font-display font-bold mb-4">Resumo Semanal</h3>
            <p className="text-sm text-on-surface/60 leading-relaxed mb-6">
              Sua aderência ao tratamento aumentou em <span className="text-primary font-bold">12%</span> em relação à semana passada. Continue assim!
            </p>
            <div className="flex items-end gap-2 h-20">
              {[40, 65, 45, 80, 70, 90, 50].map((h, i) => (
                <motion.div 
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  className={`flex-1 rounded-t-lg ${i === 5 ? 'bg-primary' : 'bg-primary-fixed'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Treatments;
