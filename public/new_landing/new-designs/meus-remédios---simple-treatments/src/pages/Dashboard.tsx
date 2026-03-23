import { motion } from 'motion/react';
import { CheckCircle2, Clock, AlertCircle, ChevronRight, Plus } from 'lucide-react';

const Dashboard = () => {
  const medications = [
    { name: "Sertralina 50mg", time: "08:00", taken: true, type: "Comprimido" },
    { name: "Vitamina D 2000UI", time: "08:00", taken: true, type: "Cápsula" },
    { name: "Amoxicilina 500mg", time: "14:00", taken: false, type: "Comprimido" },
    { name: "Melatonina 3mg", time: "22:00", taken: false, type: "Gota" },
  ];

  const stockAlerts = [
    { name: "Sertralina", remaining: 5, total: 30, unit: "comprimidos" },
    { name: "Amoxicilina", remaining: 2, total: 14, unit: "comprimidos" },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-primary font-bold uppercase tracking-widest text-xs mb-2 block">Sábado, 21 de Março</span>
          <h1 className="text-4xl md:text-5xl font-display font-bold">Olá, João.</h1>
          <p className="text-on-surface/60 mt-2 text-lg">Você tomou <span className="text-primary font-bold">2 de 4</span> medicamentos hoje.</p>
        </div>
        <button className="bg-primary text-white p-4 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
          <Plus size={24} />
        </button>
      </header>

      {/* Progress Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-8 rounded-[2rem] shadow-ambient flex flex-col items-center text-center">
          <div className="relative w-32 h-32 mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-on-surface/5" />
              <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="364.4" strokeDashoffset="182.2" className="text-primary-fixed transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-display font-bold">50%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface/40">Hoje</span>
            </div>
          </div>
          <h3 className="text-xl font-display font-bold mb-2">Progresso Diário</h3>
          <p className="text-on-surface/60 text-sm">Faltam apenas 2 doses para completar seu dia.</p>
        </div>

        <div className="md:col-span-2 glass p-8 rounded-[2rem] shadow-ambient">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-display font-bold">Próximas Doses</h3>
            <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
              Ver tudo <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-4">
            {medications.map((med, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-200 ${med.taken ? 'bg-secondary-fixed/20' : 'bg-surface-container-lowest'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${med.taken ? 'bg-secondary-fixed text-primary' : 'bg-surface text-on-surface/40'}`}>
                    {med.taken ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                  </div>
                  <div>
                    <h4 className={`font-bold ${med.taken ? 'text-on-surface/40 line-through' : 'text-on-surface'}`}>{med.name}</h4>
                    <p className="text-xs text-on-surface/40 font-bold uppercase tracking-wider">{med.time} • {med.type}</p>
                  </div>
                </div>
                {!med.taken && (
                  <button className="bg-primary/5 text-primary px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary hover:text-white transition-all duration-200">
                    Tomar
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stock & Alerts */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-8 rounded-[2rem] shadow-ambient bg-error/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-error/10 text-error rounded-xl flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-2xl font-display font-bold">Alertas de Estoque</h3>
          </div>
          <div className="space-y-6">
            {stockAlerts.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>{item.name}</span>
                  <span className="text-error">{item.remaining} {item.unit} restantes</span>
                </div>
                <div className="h-2 bg-on-surface/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.remaining / item.total) * 100}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-error"
                  />
                </div>
              </div>
            ))}
            <button className="w-full py-3 rounded-xl bg-error/10 text-error font-bold text-sm hover:bg-error hover:text-white transition-all duration-200">
              Comprar Medicamentos
            </button>
          </div>
        </div>

        <div className="glass p-8 rounded-[2rem] shadow-ambient bg-gradient-to-br from-primary to-primary-container text-white">
          <h3 className="text-2xl font-display font-bold mb-4">Dica de Saúde</h3>
          <p className="text-white/80 leading-relaxed mb-8">
            Manter a hidratação adequada potencializa a absorção dos seus medicamentos e reduz efeitos colaterais. 
            Beba pelo menos 2L de água hoje.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full bg-surface/20" />
              ))}
            </div>
            <span className="text-sm font-bold">12k pessoas seguem esta rotina</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
