import React, { useState, useEffect } from 'react';
import { FileImage, Loader2 } from 'lucide-react';
import { MediaFile } from '../../types';
import { dataStore } from '../../lib/dataStore';

interface MediaImageProps {
  file: MediaFile;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  file,
  className = 'w-full h-28 object-cover',
  alt,
  onClick,
}) => {
  const isDirectUrl = (url?: string) => {
    if (!url) return false;
    return url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:');
  };

  const [src, setSrc] = useState<string>(() => {
    if (isDirectUrl(file.url)) return file.url!;
    if (file.drive_thumbnail_link) return file.drive_thumbnail_link;
    return '';
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !isDirectUrl(file.url) && !file.drive_thumbnail_link);

  useEffect(() => {
    let isMounted = true;

    if (isDirectUrl(file.url)) {
      setSrc(file.url!);
      setIsLoading(false);
      return;
    }

    if (file.drive_thumbnail_link) {
      setSrc(file.drive_thumbnail_link);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    dataStore
      .resolveMediaFileUrl(file.id)
      .then((resolved) => {
        if (isMounted) {
          if (resolved) {
            setSrc(resolved);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [file.id, file.url]);

  if (isLoading) {
    return (
      <div className="w-full h-28 flex flex-col items-center justify-center bg-muted/40 text-muted-foreground gap-1.5 animate-pulse rounded-lg">
        <Loader2 className="w-5 h-5 animate-spin text-primary/70" />
        <span className="text-[10px] font-mono">טוען תמונה...</span>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="w-full h-28 flex flex-col items-center justify-center bg-muted/30 text-muted-foreground gap-1 rounded-lg">
        <FileImage className="w-6 h-6 text-muted-foreground/60" />
        <span className="text-[10px]">תמונה שמורה</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || file.name}
      className={className}
      onClick={onClick}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
};
