// Service Worker helper to handle Web Share Target API requests (e.g. WhatsApp, Photos, Voice Notes)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if this is the Share Target POST request
  if (url.pathname === '/share-receive' && event.request.method === 'POST') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        
        // Collect all files from any field (files, media, file, or generic keys)
        const files = [];
        for (const [, value] of formData.entries()) {
          if (value && typeof value === 'object' && (value instanceof File || value instanceof Blob || (value.size !== undefined && value.slice !== undefined))) {
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

        // Store each file
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const fileName = f.name || `shared_item_${Date.now()}_${i}`;
          const fileType = f.type || 'application/octet-stream';
          
          await cache.put(`/pwa-shared-file-${i}`, new Response(f, {
            headers: {
              'x-file-name': encodeURIComponent(fileName),
              'x-file-type': fileType,
              'Content-Type': fileType,
            },
          }));
        }
      } catch (err) {
        console.error('PWA Share Target Error in SW:', err);
      }

      // 303 Redirect to GET /share-receive so the client renders the reception UI
      return Response.redirect('/share-receive?shared=1', 303);
    })());
  }
});
