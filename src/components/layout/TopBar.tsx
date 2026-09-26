import React, { useState } from 'react';
import {
  Building2,
  Moon,
  Sun,
  Bell,
  LogOut,
  ChevronDown,
  Settings,
  Sparkles,
  CheckCheck,
  Plus,
  FileArchive,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataStore } from '../../lib/dataStore';
import { formatHebrewDate } from '../../lib/utils';
import { CreateOrgModal } from '../dialogs/CreateOrgModal';
import { ImportDataModal } from '../dialogs/ImportDataModal';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface TopBarProps {
  onNavigate: (path: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onNavigate }) => {
  const { activeOrg, organizations, switchOrganization } = useOrganization();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const unreadCount = dataStore.getUnreadNotificationCount();
  const notifications = dataStore.getNotifications();

  const handleMarkAllRead = () => {
    dataStore.markAllNotificationsAsRead();
  };

  return (
    <>
      {(showOrgDropdown || showNotifDropdown || showUserDropdown) && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => {
            setShowOrgDropdown(false);
            setShowNotifDropdown(false);
            setShowUserDropdown(false);
          }}
        />
      )}

      <header className="h-16 bg-card border-b border-border relative z-40 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
        {/* Right side: Org Selector & Brand on mobile */}
        <div className="flex items-center gap-4">
          {/* Mobile brand indicator */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm">
              K
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">Kabbalah CRM</span>
          </div>

          {/* Org Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowOrgDropdown((p) => !p);
                setShowNotifDropdown(false);
                setShowUserDropdown(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-medium text-foreground hover:bg-slate-100 transition-colors"
            >
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <span className="max-w-[130px] sm:max-w-[180px] truncate font-medium">
                {activeOrg?.name || 'בחר קליניקה'}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 ml-0.5 shrink-0" />
            </button>

            {showOrgDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl py-2 z-50 text-right animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-border flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>הקליניקות שלי</span>
                  <button
                    onClick={() => {
                      setShowCreateOrgModal(true);
                      setShowOrgDropdown(false);
                    }}
                    className="text-primary hover:underline flex items-center gap-1 font-bold text-[11px]"
                  >
                    <Plus className="w-3 h-3" />
                    צור ארגון
                  </button>
                </div>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      switchOrganization(org.id);
                      setShowOrgDropdown(false);
                    }}
                    className={`w-full text-right px-3 py-2 text-xs font-medium hover:bg-muted flex items-center justify-between transition-colors ${
                      org.id === activeOrg?.id ? 'text-primary bg-primary/10 font-bold' : ''
                    }`}
                  >
                    <span className="truncate">{org.name}</span>
                    {org.id === activeOrg?.id && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">פעיל</span>}
                  </button>
                ))}
                <div className="border-t border-border mt-1 pt-1 px-2 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowCreateOrgModal(true);
                      setShowOrgDropdown(false);
                    }}
                    className="w-full text-right px-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + צור ארגון חדש
                  </button>
                  <button
                    onClick={() => {
                      onNavigate('/settings');
                      setShowOrgDropdown(false);
                    }}
                    className="w-full text-right px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-lg font-medium flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    ניהול קליניקות והגדרות
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Left side: Controls (Notifications, Dark mode, Profile, + New Client, Import ZIP) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Import ZIP Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/80 hover:bg-muted text-foreground border border-border rounded-lg text-xs font-bold transition-colors"
            title="ייבוא נתונים מקובץ ZIP או JSON"
          >
            <FileArchive className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">ייבוא נתונים (ZIP)</span>
          </button>

          {/* Quick + Client Button */}
          <button
            onClick={() => onNavigate('/clients')}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs sm:text-sm font-bold shadow-xs hover:bg-primary/90 transition-colors"
          >
            + לקוח חדש
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton variant="header" />

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
          title={theme === 'dark' ? 'עבור למצב אור' : 'עבור למצב כהה'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifDropdown((p) => !p);
              setShowOrgDropdown(false);
              setShowUserDropdown(false);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 rounded-lg transition-colors relative"
            title="התראות"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl py-2 z-50 text-right animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-bold">התראות למטפל</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    סמן הכל כנקרא
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">אין התראות חדשות</div>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <div
                      key={`topbar-notif-${n.id}`}
                      onClick={() => {
                        if (n.link) onNavigate(n.link);
                        setShowNotifDropdown(false);
                      }}
                      className={`p-3 text-xs hover:bg-muted cursor-pointer transition-colors ${
                        !n.read_at ? 'bg-primary/5 font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-foreground">{n.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatHebrewDate(n.created_at, 'HH:mm')}
                        </span>
                      </div>
                      {n.body && <p className="text-muted-foreground text-[11px] leading-relaxed">{n.body}</p>}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border mt-1 pt-1 text-center">
                <button
                  onClick={() => {
                    onNavigate('/notifications');
                    setShowNotifDropdown(false);
                  }}
                  className="text-xs text-primary font-medium hover:underline py-1"
                >
                  לכל ההתראות ({notifications.length})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Trigger */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserDropdown((p) => !p);
              setShowOrgDropdown(false);
              setShowNotifDropdown(false);
            }}
            className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile?.full_name || ''}
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-300 dark:border-slate-600">
                {profile?.full_name?.charAt(0) || 'מ'}
              </div>
            )}
            <span className="hidden md:inline text-xs font-semibold max-w-[110px] truncate text-slate-700 dark:text-slate-200">
              {profile?.full_name || 'מטפל'}
            </span>
          </button>

          {showUserDropdown && (
            <div className="absolute left-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-xl py-2 z-50 text-right animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 border-b border-border">
                <p className="text-xs font-bold truncate">{profile?.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{profile?.email}</p>
              </div>
              <button
                onClick={() => {
                  onNavigate('/settings');
                  setShowUserDropdown(false);
                }}
                className="w-full text-right px-3 py-2 text-xs hover:bg-muted flex items-center gap-2"
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                הגדרות חשבון
              </button>
              <button
                onClick={signOut}
                className="w-full text-right px-3 py-2 text-xs text-rose-600 hover:bg-rose-500/10 flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                התנתק מהמערכת
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    <CreateOrgModal
      isOpen={showCreateOrgModal}
      onClose={() => setShowCreateOrgModal(false)}
    />

    <ImportDataModal
      isOpen={showImportModal}
      onClose={() => setShowImportModal(false)}
    />
    </>
  );
};
