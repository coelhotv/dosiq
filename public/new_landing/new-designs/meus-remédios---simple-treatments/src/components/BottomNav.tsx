import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Pill, Package, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BottomNav = () => {
  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Hoje' },
    { to: '/treatments', icon: Pill, label: 'Tratamentos' },
    { to: '/stock', icon: Package, label: 'Estoque' },
    { to: '/profile', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 glass px-6 py-3 flex justify-between items-center z-50">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center space-y-1 transition-all duration-200",
              isActive ? "text-primary scale-110" : "text-on-surface/40"
            )
          }
        >
          <item.icon size={22} />
          <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
