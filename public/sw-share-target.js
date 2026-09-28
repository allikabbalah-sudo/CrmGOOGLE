// Service Worker helper to handle Web Share Target API requests (e.g. WhatsApp, Photos, Voice Notes)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Helper to inspect magic bytes of typeless blobs from WhatsApp
async function inspectBlobType(blob) {
  try {
    const slice = await blob.slice(0, 16).arrayBuffer();
    const b = new Uint8Array(slice);
    if (b.length >= 4) {
      // Ogg / Opus voice note: "OggS" (0x4F, 0x67, 0x67, 0x53)
      if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
        return { cat: 'audio', mime: 'audio/ogg', ext: 'opus' };
      }
      // JPEG: 0xFF, 0xD8, 0xFF
      if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
        return { cat: 'image', mime: 'image/jpeg', ext: 'jpg' };
      }
      // PNG: 0x89, 0x50, 0x4E, 0x47
      if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
        return { cat: 'image', mime: 'image/png', ext: 'png' };
      }
      // WebP: RIFF ... WEBP
      if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
        return { cat: 'image', mime: 'image/webp', ext: 'webp' };
      }
      // MP4 / M4A: "ftyp" at offset 4
      if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
        return { cat: 'audio', mime: 'audio/mp4', ext: 'm4a' };
      }
      // AMR: "#!AMR"
      if (b[0] === 0x23 && b[1] === 0x21 && b[2] === 0x41 && b[3] === 0x4d) {
        return { cat: 'audio', mime: 'audio/amr', ext: 'amr' };
      }
      // MP3: "ID3"
      if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
        return { cat: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
      }
      // PDF: "%PDF"
      if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
        return { cat: 'document', mime: 'application/pdf', ext: 'pdf' };
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if this is the Share Target POST request
  if ((url.pathname === '/share-receive' || url.pathname === '/share-receive/') && event.request.method === 'POST') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        
        // Collect all files from any field (files, file, media, audio, image, etc.)
        const files = [];
        for (const [key, value] of formData.entries()) {
          const isFileLike = value && typeof value === 'object' && (
            (typeof File !== 'undefined' && value instanceof File) ||
            (typeof Blob !== 'undefined' && value instanceof Blob) ||
            (typeof value.size === 'number' && typeof value.slice === 'function')
          );
          if (isFileLike && value.size > 0) {
            files.push(value);
          }
        }

        const title = formData.get('title') || '';
        const text = formData.get('text') || '';
        const shareUrl = formData.get('url') || '';

        // Store into Cache Storage under 'pwa-shared-cache'
        const cache = await caches.open('pwa-shared-cache');
        
        // Metadata
        const metadata = {
          title: String(title || ''),
          text: String(text || ''),
          url: String(shareUrl || ''),
          filesCount: files.length,
          receivedAt: Date.now(),
        };
        await cache.put('/pwa-shared-meta.json', new Response(JSON.stringify(metadata), {
          headers: { 'Content-Type': 'application/json' }
        }));

        // Store each file with proper metadata
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          let fileName = f.name || '';
          let fileType = f.type || '';

          // If MIME or filename is missing or generic (e.g. from WhatsApp Android), inspect bytes
          const detected = await inspectBlobType(f);
          if (detected) {
            if (!fileType || fileType === 'application/octet-stream') {
              fileType = detected.mime;
            }
            if (!fileName || fileName === 'blob' || !fileName.includes('.')) {
              fileName = `whatsapp_${detected.cat}_${Date.now()}_${i}.${detected.ext}`;
            }
          }

          // Fallback normalization
          if (!fileName || fileName === 'blob') {
            if (fileType.includes('audio') || fileType.includes('ogg') || fileType.includes('opus')) {
              fileName = `whatsapp_voice_${Date.now()}_${i}.opus`;
            } else if (fileType.includes('image')) {
              fileName = `whatsapp_image_${Date.now()}_${i}.jpg`;
            } else {
              fileName = `shared_file_${Date.now()}_${i}`;
            }
          }

          if (!fileType || fileType === 'application/octet-stream') {
            if (fileName.endsWith('.opus') || fileName.endsWith('.ogg')) {
              fileType = 'audio/ogg';
            } else if (fileName.endsWith('.m4a') || fileName.endsWith('.mp4')) {
              fileType = 'audio/mp4';
            } else if (fileName.endsWith('.mp3')) {
              fileType = 'audio/mpeg';
            } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
              fileType = 'image/jpeg';
            } else if (fileName.endsWith('.png')) {
              fileType = 'image/png';
            } else if (fileName.endsWith('.webp')) {
              fileType = 'image/webp';
            }
          }
          
          await cache.put(`/pwa-shared-file-${i}`, new Response(f, {
            headers: {
              'x-file-name': encodeURIComponent(fileName),
              'x-file-type': fileType || 'application/octet-stream',
              'Content-Type': fileType || 'application/octet-stream',
              'x-received-at': String(Date.now()),
            },
          }));
        }
      } catch (err) {
        console.error('PWA Share Target Error in SW:', err);
      }

      // 303 Redirect to GET /share-receive?shared=1 so the client renders the reception UI
      return Response.redirect('/share-receive?shared=1', 303);
    })());
  }
});
