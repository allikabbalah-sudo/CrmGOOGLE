import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function shareTargetServerPlugin(): Plugin {
  let storedShareData: {
    title: string;
    text: string;
    url: string;
    files: Array<{ name: string; type: string; size: number; dataUrl: string }>;
    timestamp: number;
  } | null = null;

  // Detect mime type and extension from buffer magic bytes
  function detectBufferType(buf: Buffer): { mime: string; ext: string; cat: 'audio' | 'image' | 'video' | 'document' } | null {
    if (buf.length >= 4) {
      // OggS (Ogg / Opus WhatsApp voice note)
      if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
        return { mime: 'audio/ogg', ext: 'opus', cat: 'audio' };
      }
      // JPEG
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return { mime: 'image/jpeg', ext: 'jpg', cat: 'image' };
      }
      // PNG
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        return { mime: 'image/png', ext: 'png', cat: 'image' };
      }
      // WebP
      if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
        return { mime: 'image/webp', ext: 'webp', cat: 'image' };
      }
      // MP4 / M4A (ftyp at offset 4)
      if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
        return { mime: 'audio/mp4', ext: 'm4a', cat: 'audio' };
      }
      // AMR
      if (buf[0] === 0x23 && buf[1] === 0x21 && buf[2] === 0x41 && buf[3] === 0x4d) {
        return { mime: 'audio/amr', ext: 'amr', cat: 'audio' };
      }
      // MP3
      if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
        return { mime: 'audio/mpeg', ext: 'mp3', cat: 'audio' };
      }
      // PDF
      if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
        return { mime: 'application/pdf', ext: 'pdf', cat: 'document' };
      }
    }
    return null;
  }

  return {
    name: 'share-target-server-handler',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Clear endpoint
        if (req.method === 'POST' && req.url === '/api/server-shared-files/clear') {
          storedShareData = null;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // GET shared data - Retain for 15 minutes so React StrictMode or re-renders do NOT lose files!
        if (req.method === 'GET' && req.url === '/api/server-shared-files') {
          res.setHeader('Content-Type', 'application/json');
          if (storedShareData && Date.now() - storedShareData.timestamp < 15 * 60 * 1000) {
            res.end(JSON.stringify(storedShareData));
          } else {
            storedShareData = null;
            res.end(JSON.stringify(null));
          }
          return;
        }

        // POST /share-receive from Web Share Target or WhatsApp
        if (req.method === 'POST' && req.url && (req.url === '/share-receive' || req.url.startsWith('/share-receive?') || req.url.startsWith('/share-receive/'))) {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              const contentType = req.headers['content-type'] || '';
              const files: Array<{ name: string; type: string; size: number; dataUrl: string }> = [];
              let title = '';
              let text = '';
              let shareUrl = '';

              if (contentType.includes('multipart/form-data')) {
                const boundaryMatch = contentType.match(/boundary=(?:["']?)([^"';]+)(?:["']?)/);
                if (boundaryMatch) {
                  const boundary = boundaryMatch[1];
                  const boundaryBuffer = Buffer.from(`--${boundary}`);
                  let start = 0;
                  while (start < buffer.length) {
                    const idx = buffer.indexOf(boundaryBuffer, start);
                    if (idx === -1) break;
                    const nextIdx = buffer.indexOf(boundaryBuffer, idx + boundaryBuffer.length);
                    if (nextIdx === -1) break;

                    const partBuffer = buffer.subarray(idx + boundaryBuffer.length, nextIdx);
                    start = nextIdx;

                    const headerEnd = partBuffer.indexOf('\r\n\r\n');
                    if (headerEnd === -1) continue;

                    const headerStr = partBuffer.subarray(0, headerEnd).toString('utf-8');
                    // Body without trailing \r\n
                    let body = partBuffer.subarray(headerEnd + 4);
                    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
                      body = body.subarray(0, body.length - 2);
                    }

                    const nameMatch = headerStr.match(/name=(?:["']?)([^"';\r\n]+)(?:["']?)/i);
                    const filenameMatch = headerStr.match(/filename=(?:["']?)([^"';\r\n]+)(?:["']?)/i);
                    const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

                    const fieldName = (nameMatch ? nameMatch[1] : '').trim();
                    const filename = (filenameMatch ? filenameMatch[1] : '').trim();
                    let mimeType = ctMatch ? ctMatch[1].trim() : '';

                    if (fieldName === 'title') {
                      title = body.toString('utf-8');
                    } else if (fieldName === 'text') {
                      text = body.toString('utf-8');
                    } else if (fieldName === 'url') {
                      shareUrl = body.toString('utf-8');
                    } else if (body.length > 0) {
                      // Inspect bytes to detect WhatsApp audio or image
                      const detected = detectBufferType(body);
                      if (detected) {
                        if (!mimeType || mimeType === 'application/octet-stream') {
                          mimeType = detected.mime;
                        }
                      }

                      let cleanName = filename;
                      if (!cleanName || cleanName === 'blob') {
                        const ext = detected ? detected.ext : 'bin';
                        const cat = detected ? detected.cat : 'file';
                        cleanName = `whatsapp_${cat}_${Date.now()}_${files.length}.${ext}`;
                      }

                      if (!mimeType) {
                        mimeType = 'application/octet-stream';
                      }

                      files.push({
                        name: cleanName,
                        type: mimeType,
                        size: body.length,
                        dataUrl: `data:${mimeType};base64,${body.toString('base64')}`,
                      });
                    }
                  }
                }
              }

              storedShareData = {
                title,
                text,
                url: shareUrl,
                files,
                timestamp: Date.now(),
              };

              res.writeHead(303, { Location: '/share-receive?server_shared=1' });
              res.end();
            } catch (err) {
              console.error('Error handling share target POST:', err);
              res.writeHead(303, { Location: '/share-receive?shared_err=1' });
              res.end();
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      shareTargetServerPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'Kabbalah CRM — ניהול קליניקה טיפולית',
          short_name: 'KabbalahCRM',
          description: 'מערכת CRM מתקדמת לניהול קליניקה טיפולית קבלית ואנרגטית',
          theme_color: '#0d9488',
          background_color: '#042f2e',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          dir: 'rtl',
          lang: 'he',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          share_target: {
            action: '/share-receive',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
              files: [
                {
                  name: 'files',
                  accept: [
                    '*/*',
                    'image/*',
                    'audio/*',
                    'video/*',
                    'application/*',
                    '.mp3',
                    '.wav',
                    '.m4a',
                    '.ogg',
                    '.aac',
                    '.opus',
                    '.amr',
                    '.png',
                    '.jpg',
                    '.jpeg',
                    '.webp',
                    '.pdf',
                  ],
                },
              ],
            },
          },
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          importScripts: ['/sw-share-target.js'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
