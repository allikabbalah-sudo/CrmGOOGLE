import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { AppLayout } from './components/layout/AppLayout';

import { DashboardView } from './views/DashboardView';
import { ClientsView } from './views/ClientsView';
import { ClientDetailView } from './views/ClientDetailView';
import { PipelineView } from './views/PipelineView';
import { CalendarView } from './views/CalendarView';
import { TasksView } from './views/TasksView';
import { NotificationsView } from './views/NotificationsView';
import { SettingsView } from './views/SettingsView';
import { MediaGalleryView } from './views/MediaGalleryView';
import { ShareReceiveView } from './views/ShareReceiveView';
import { AuthView } from './views/AuthView';
import { InviteView } from './views/InviteView';
import { LandingView } from './views/LandingView';
import { PrivacyView } from './views/PrivacyView';

function MainApp() {
  const { user, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-muted-foreground font-semibold">טוען מערכת...</p>
        </div>
      </div>
    );
  }

  // 1. Completely Public Routes (do not require login)
  if (currentPath === '/') {
    return <LandingView onNavigate={navigate} />;
  }

  if (currentPath === '/privacy') {
    return <PrivacyView onNavigate={navigate} />;
  }

  if (currentPath.startsWith('/invite/')) {
    const token = currentPath.replace('/invite/', '');
    return (
      <div className="min-h-screen bg-background text-foreground dir-rtl font-heebo">
        <InviteView token={token} onNavigate={navigate} />
      </div>
    );
  }

  // 2. Auth Route
  if (currentPath === '/auth') {
    if (user) {
      // If already logged in, redirect to dashboard
      return (
        <AppLayout currentPath="/dashboard" onNavigate={navigate}>
          <DashboardView onNavigate={navigate} />
        </AppLayout>
      );
    }
    return (
      <div className="min-h-screen bg-background text-foreground dir-rtl font-heebo">
        <AuthView onNavigate={navigate} />
      </div>
    );
  }

  // 3. Protected Routes - If not logged in, prompt AuthView
  if (!user) {
    if (currentPath.startsWith('/share-receive')) {
      return (
        <div className="min-h-screen bg-background text-foreground dir-rtl font-heebo">
          <div className="p-3 bg-teal-600 text-white text-center text-xs font-bold shadow-xs">
            📱 התקבל קובץ משיתוף חיצוני (WhatsApp / טלפון). אנא התחבר כדי לשייכו ללקוח.
          </div>
          <AuthView onNavigate={(p) => navigate(p === '/dashboard' ? '/share-receive' : p)} />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background text-foreground dir-rtl font-heebo">
        <AuthView onNavigate={navigate} />
      </div>
    );
  }

  // Route matching for logged-in users inside AppLayout
  const renderView = () => {
    if (currentPath === '/dashboard') {
      return <DashboardView onNavigate={navigate} />;
    }
    if (currentPath === '/clients') {
      return <ClientsView onNavigate={navigate} />;
    }
    if (currentPath.startsWith('/clients/')) {
      const clientId = currentPath.replace('/clients/', '').split('?')[0];
      return <ClientDetailView clientId={clientId} onNavigate={navigate} />;
    }
    if (currentPath === '/pipeline') {
      return <PipelineView onNavigate={navigate} />;
    }
    if (currentPath === '/calendar') {
      return <CalendarView onNavigate={navigate} />;
    }
    if (currentPath === '/tasks') {
      return <TasksView onNavigate={navigate} />;
    }
    if (currentPath === '/media') {
      return <MediaGalleryView onNavigate={navigate} />;
    }
    if (currentPath === '/notifications') {
      return <NotificationsView onNavigate={navigate} />;
    }
    if (currentPath === '/settings') {
      return <SettingsView />;
    }
    if (currentPath === '/share-receive' || currentPath.startsWith('/share-receive?') || currentPath.startsWith('/share-receive/')) {
      return <ShareReceiveView onNavigate={navigate} />;
    }

    // Default fallback for logged-in user
    return <DashboardView onNavigate={navigate} />;
  };

  return (
    <AppLayout currentPath={currentPath} onNavigate={navigate}>
      {renderView()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OrganizationProvider>
          <MainApp />
        </OrganizationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
