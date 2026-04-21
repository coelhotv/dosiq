import { motion } from 'motion/react';
import { User, Shield, Bell, Settings, ChevronRight, LogOut, HelpCircle } from 'lucide-react';

interface ProfileProps {
  onLogout: () => void;
}

const Profile = ({ onLogout }: ProfileProps) => {
  const profileItems = [
    { icon: User, label: "Dados Pessoais", description: "Nome, e-mail, telefone e endereço." },
    { icon: Shield, label: "Privacidade e Segurança", description: "Gerencie sua senha e dados criptografados." },
    { icon: Bell, label: "Notificações", description: "Configure seus lembretes e alertas." },
    { icon: Settings, label: "Preferências", description: "Idioma, tema e configurações do app." },
    { icon: HelpCircle, label: "Ajuda e Suporte", description: "Fale conosco ou veja as perguntas frequentes." },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Profile Header */}
      <header className="text-center space-y-6">
        <div className="relative inline-block group">
          <div className="w-32 h-32 rounded-[2.5rem] bg-secondary-fixed/20 flex items-center justify-center text-primary overflow-hidden shadow-ambient group-hover:scale-105 transition-transform duration-300">
            <User size={64} />
          </div>
          <button className="absolute bottom-0 right-0 bg-primary text-white p-2.5 rounded-2xl shadow-xl hover:scale-110 transition-transform">
            <Settings size={18} />
          </button>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-display font-bold">João da Silva</h1>
          <p className="text-on-surface/40 font-bold uppercase tracking-widest text-xs">Membro Premium desde 2024</p>
        </div>
      </header>

      {/* Profile Options */}
      <section className="space-y-4">
        {profileItems.map((item, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="w-full glass p-6 rounded-[2rem] shadow-ambient flex items-center justify-between group hover:scale-[1.01] transition-all duration-300"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-secondary-fixed text-primary rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                <item.icon size={24} />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{item.label}</h4>
                <p className="text-sm text-on-surface/40 font-bold">{item.description}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-on-surface/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </motion.button>
        ))}
      </section>

      {/* Danger Zone */}
      <section className="pt-10">
        <button 
          onClick={onLogout}
          className="w-full p-6 rounded-[2rem] bg-error/10 text-error font-bold flex items-center justify-center gap-3 hover:bg-error/20 transition-all duration-300"
        >
          <LogOut size={20} />
          Sair da Conta
        </button>
        <p className="text-center text-on-surface/20 text-xs mt-8 font-bold italic">
          Versão 1.0.4 • Dosiq Santuário Clínico
        </p>
      </section>
    </div>
  );
};

export default Profile;
