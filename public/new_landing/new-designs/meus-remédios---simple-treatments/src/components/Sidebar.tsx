import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Pill, Package, User, LogOut } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar = ({ onLogout }: SidebarProps) => {
  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Hoje' },
    { to: '/treatments', icon: Pill, label: 'Tratamentos' },
    { to: '/stock', icon: Package, label: 'Estoque' },
    { to: '/profile', icon: User, label: 'Perfil' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-surface-container-low z-50">
      <div className="p-8">
        <h1 className="text-2xl font-display font-bold tracking-tight text-primary">Meus Remédios</h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-on-surface/60 hover:bg-surface hover:text-on-surface"
              )
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4">
        <button
          onClick={onLogout}
          className="flex items-center space-x-3 px-4 py-3 w-full rounded-xl text-on-surface/60 hover:bg-error/10 hover:text-error transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
