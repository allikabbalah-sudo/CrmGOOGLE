import React from 'react';
import {
  LayoutDashboard,
  Users,
  Kanban,
  Calendar,
  CheckSquare,
  HardDrive,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
  { path: '/clients', label: 'לקוחות', icon: Users },
  { path: '/pipeline', label: 'פייפליין', icon: Kanban },
  { path: '/calendar', label: 'יומן', icon: Calendar },
  { path: '/tasks', label: 'משימות', icon: CheckSquare },
  { path: '/media', label: 'ספריית מדיה', icon: HardDrive },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({ currentPath, onNavigate }) => {
  const { profile } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-[#151B23] text-white border-l border-white/10 h-screen sticky top-0 justify-between select-none">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[oklch(0.62_0.13_200)] flex items-center justify-center font-bold text-white text-base shadow-xs">
              K
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">Kabbalah CRM</h1>
              <p className="text-[10px] text-slate-400 font-medium mt-1">ניהול קליניקה קבלית</p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.path ||
              (item.path !== '/dashboard' && currentPath.startsWith(item.path));

            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[oklch(0.62_0.13_200)] text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile Box */}
      <div className="p-4 border-t border-white/5 space-y-3">
        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile?.full_name || ''}
              className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {profile?.full_name?.charAt(0) || 'מ'}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{profile?.full_name || 'ישראל ישראלי'}</p>
            <p className="text-[10px] text-slate-500 truncate">מטפל בכיר</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1 border-t border-white/5">
          <button
            onClick={() => onNavigate('/')}
            className="hover:text-white transition-colors"
          >
            crmkabbalah
          </button>
          <span>•</span>
          <button
            onClick={() => onNavigate('/privacy')}
            className="hover:text-white transition-colors"
          >
            מדיניות פרטיות
          </button>
        </div>
      </div>
    </aside>
  );
};
