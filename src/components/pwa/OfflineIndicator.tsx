import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/95 text-white px-3.5 py-2 text-xs font-semibold shadow-lg backdrop-blur-xs animate-in slide-in-from-bottom-2">
      <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
      <span>מצב לא מקוון — נתוני האפליקציה זמינים מהזיכרון המקומי (Cache).</span>
    </div>
  );
};
