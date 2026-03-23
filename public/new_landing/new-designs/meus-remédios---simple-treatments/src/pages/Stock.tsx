import { motion } from 'motion/react';
import { Package, AlertCircle, Calendar, Plus, Search, ShoppingCart, ChevronRight, Clock } from 'lucide-react';

const Stock = () => {
  const inventory = [
    {
      id: 1,
      name: "Sertralina 50mg",
      remaining: 5,
      total: 30,
      expiry: "12/2026",
      status: "low",
      type: "Comprimidos"
    },
    {
      id: 2,
      name: "Amoxicilina 500mg",
      remaining: 2,
      total: 14,
      expiry: "08/2026",
      status: "critical",
      type: "Cápsulas"
    },
    {
      id: 3,
      name: "Vitamina D 2000UI",
      remaining: 45,
      total: 60,
      expiry: "03/2027",
      status: "good",
      type: "Cápsulas"
    },
    {
      id: 4,
      name: "Melatonina 3mg",
      remaining: 15,
      total: 30,
      expiry: "01/2027",
      status: "good",
      type: "Gotas"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'low': return 'bg-orange-400';
      default: return 'bg-accent';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-50 text-red-500 border-red-100';
      case 'low': return 'bg-orange-50 text-orange-500 border-orange-100';
      default: return 'bg-secondary/10 text-accent border-secondary/20';
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-4">
          <span className="inline-block px-4 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-bold text-[10px] uppercase tracking-widest">
            Gestão Ativa
          </span>
          <h1 className="text-4xl md:text-5xl font-display font-bold">Controle de Estoque</h1>
          <p className="text-on-surface/60 text-lg max-w-2xl">
            Monitore sua disponibilidade de medicamentos e antecipe suas compras com inteligência preditiva.
          </p>
        </div>
        <button className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-3 font-bold">
          <ShoppingCart size={20} /> Registrar Compra
        </button>
      </header>

      {/* Alerts & Critical Items */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Critical Alert Card */}
        <div className="relative overflow-hidden bg-red-50 rounded-[2.5rem] p-8 shadow-ambient border border-red-100 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-10 -mt-10 blur-2xl" />
          <div className="absolute top-10 right-10 opacity-10">
            <AlertCircle size={120} className="text-red-500" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 text-red-600">
              <AlertCircle size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Atenção Imediata</span>
            </div>
            <h3 className="text-3xl font-display font-bold text-red-900 mb-3">Reposição Crítica</h3>
            <p className="text-red-900/60 text-sm leading-relaxed mb-8">
              Você tem {inventory.filter(i => i.status === 'critical').length} medicamentos que acabam em menos de 48 horas.
            </p>
          </div>
          
          <button className="relative z-10 w-fit px-8 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">
            Ver Itens
          </button>
        </div>

        {/* Individual Medicine Alerts */}
        {inventory.filter(i => i.status === 'critical' || i.status === 'low').slice(0, 2).map((item) => (
          <div key={item.id} className="glass p-8 rounded-[2.5rem] shadow-ambient flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl ${item.status === 'critical' ? 'bg-red-100 text-red-600' : 'bg-secondary-fixed text-primary'}`}>
                <Package size={28} />
              </div>
              <span className="text-xs font-bold text-on-surface/40">50mg</span>
            </div>
            
            <div>
              <h4 className="text-2xl font-display font-bold mb-2">{item.name.split(' ')[0]}</h4>
              <div className="flex items-center gap-2 mb-8">
                <Clock size={16} className={item.status === 'critical' ? 'text-red-500' : 'text-primary'} />
                <span className={`text-sm font-bold ${item.status === 'critical' ? 'text-red-600' : 'text-primary'}`}>
                  Acaba em {item.status === 'critical' ? '2 dias' : '5 dias'}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-bold text-on-surface/40 uppercase tracking-widest">
                  <span>{item.remaining} {item.type.toLowerCase()} restantes</span>
                  <span>{Math.round((item.remaining / item.total) * 100)}% do total</span>
                </div>
                <div className="h-2 bg-on-surface/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.remaining / item.total) * 100}%` }}
                    className={`h-full ${item.status === 'critical' ? 'bg-red-500' : 'bg-primary'}`}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Inventory List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-display font-bold">Histórico de Entradas</h3>
          <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
            Ver tudo <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {inventory.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass p-6 rounded-[2rem] shadow-ambient hover:scale-[1.01] transition-transform group"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl ${item.status === 'critical' ? 'bg-error text-white' : item.status === 'low' ? 'bg-secondary text-white' : 'bg-secondary-fixed text-primary'}`}>
                    <Package size={28} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xl font-display font-bold group-hover:text-primary transition-colors">{item.name}</h4>
                    <p className="text-sm font-bold text-on-surface/40 uppercase tracking-widest">{item.type}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-on-surface/60">
                        <Calendar size={14} className="text-primary" /> Exp: {item.expiry}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest ${item.status === 'critical' ? 'bg-error/10 text-error' : item.status === 'low' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                  {item.status === 'critical' ? 'Crítico' : item.status === 'low' ? 'Baixo' : 'Ok'}
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-on-surface/40 uppercase tracking-widest">Quantidade Restante</span>
                  <span className={item.status === 'critical' ? 'text-error' : 'text-primary'}>{item.remaining} de {item.total}</span>
                </div>
                <div className="h-2 bg-on-surface/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.remaining / item.total) * 100}%` }}
                    className={`h-full ${item.status === 'critical' ? 'bg-error' : item.status === 'low' ? 'bg-secondary' : 'bg-primary'}`}
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button className="px-5 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-bold text-sm hover:bg-on-surface/5 transition-all duration-200">
                  Editar
                </button>
                <button className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20">
                  Repor Estoque
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Shopping List Integration */}
      <section className="glass p-8 rounded-[3rem] shadow-ambient bg-gradient-to-br from-primary to-primary-container text-white overflow-hidden relative">
        <div className="relative z-10">
          <h3 className="text-3xl font-display font-bold mb-4">Sincronize com sua Farmácia</h3>
          <p className="text-white/80 leading-relaxed mb-8 max-w-xl">
            Conecte sua conta com as principais redes de farmácias para receber descontos exclusivos 
            e alertas de disponibilidade em tempo real.
          </p>
          <button className="bg-white text-primary px-8 py-4 rounded-full font-bold text-lg hover:bg-white/90 transition-all duration-300 flex items-center gap-2 group shadow-2xl">
            Conectar Agora
            <ChevronRight className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
      </section>
    </div>
  );
};

export default Stock;
