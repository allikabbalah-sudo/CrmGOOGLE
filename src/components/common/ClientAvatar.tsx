import React, { useState, useEffect } from 'react';
import { User, Sparkles } from 'lucide-react';
import { getMediaBlobFromIDB } from '../../lib/indexedDbStorage';
import { dataStore } from '../../lib/dataStore';

interface ClientAvatarProps {
  avatarUrl?: string;
  name?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
}

// Deterministic pleasing palette for client initials
const COLOR_PALETTES = [
  'bg-teal-600/20 text-teal-700 dark:text-teal-300 border-teal-500/30',
  'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  'bg-amber-600/20 text-amber-800 dark:text-amber-300 border-amber-500/30',
  'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'bg-sky-600/20 text-sky-700 dark:text-sky-300 border-sky-500/30',
  'bg-purple-600/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  'bg-rose-600/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
];

function getColorClass(name?: string): string {
  if (!name || !name.trim()) return COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTES[Math.abs(hash) % COLOR_PALETTES.length];
}

export const ClientAvatar: React.FC<ClientAvatarProps> = ({
  avatarUrl,
  name = '',
  className = 'w-12 h-12',
  imgClassName = '',
  fallbackClassName = '',
  size = 'md',
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);

    if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.trim()) {
      setResolvedUrl('');
      return;
    }

    const trimmed = avatarUrl.trim();

    // If it's a direct image, SVG data URL, http URL, or standard base64 data URL
    if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
      setResolvedUrl(trimmed);
      return;
    }

    // If it's a cloud_media or idb_media reference
    if (trimmed.startsWith('cloud_media:') || trimmed.startsWith('idb_media:')) {
      const blobId = trimmed.replace(/^(cloud_media:|idb_media:)/, '');
      let isMounted = true;

      // 1. Try local IndexedDB
      getMediaBlobFromIDB(blobId)
        .then((blobData) => {
          if (!isMounted) return;
          if (blobData) {
            setResolvedUrl(blobData);
          } else {
            // 2. Try dataStore resolver
            dataStore.resolveBlobUrl(trimmed).then((cloudUrl) => {
              if (isMounted && cloudUrl) {
                setResolvedUrl(cloudUrl);
              }
            });
          }
        })
        .catch(() => {
          if (isMounted) setHasError(true);
        });

      return () => {
        isMounted = false;
      };
    }

    setResolvedUrl(trimmed);
  }, [avatarUrl]);

  const cleanName = name ? name.trim() : '';
  const initial = cleanName ? cleanName.charAt(0) : '';
  const colorClass = getColorClass(cleanName);

  // If we have a resolved image URL and no loading error
  if (resolvedUrl && !hasError) {
    return (
      <div className={`relative shrink-0 rounded-full overflow-hidden flex items-center justify-center ${className}`}>
        <img
          src={resolvedUrl}
          alt={cleanName || 'אווטר'}
          className={`w-full h-full object-cover transition-opacity duration-200 ${imgClassName}`}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  // Fallback: stylish colored initials circle
  return (
    <div
      className={`relative shrink-0 rounded-full border flex items-center justify-center font-bold select-none shadow-2xs ${colorClass} ${className} ${fallbackClassName}`}
      title={cleanName || 'לקוח'}
    >
      {initial ? (
        <span className="leading-none text-center">
          {initial}
        </span>
      ) : (
        <User className="w-1/2 h-1/2 opacity-75" />
      )}
    </div>
  );
};
