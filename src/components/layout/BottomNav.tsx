import React from 'react';
import { NAV_ITEMS } from './SidebarNav';

interface BottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentPath, onNavigate }) => {
  // Take first 5 items for mobile bottom bar
  const mobileItems = NAV_ITEMS.slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-2 py-1.5 flex items-center justify-around shadow-lg">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          currentPath === item.path ||
          (item.path !== '/dashboard' && currentPath.startsWith(item.path));

        return (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
              isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                isActive ? 'bg-primary/15 text-primary' : ''
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
