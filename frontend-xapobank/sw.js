// Service Worker proxy to forward /api/* requests from the static host to backend API
// Default backend origin (overridden by page via postMessage)
self.apiBase = 'https://xa-poloan.onrender.com';

self.addEventListener('install', (evt) => { self.skipWaiting(); });
self.addEventListener('activate', (evt) => { evt.waitUntil(self.clients.claim()); });

self.addEventListener('message', (evt) => {
  try {
    const data = evt.data || {};
    if (data && data.type === 'setApiBase' && data.value) {
      self.apiBase = String(data.value).replace(/\/$/, '');
      console.log('SW: apiBase set to', self.apiBase);
    }
  } catch (e) { console.warn('SW message handling error', e); }
});

self.addEventListener('fetch', (event) => {
  try {
    const req = event.request;
    const url = new URL(req.url);
    // Only proxy requests aimed at the static origin's /api/ path
    if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
      event.respondWith((async () => {
        const target = self.apiBase + url.pathname + url.search;
        const init = {
          method: req.method,
          headers: (() => {
            const h = new Headers();
            for (const [k, v] of req.headers.entries()) {
              // Skip host header
              if (k.toLowerCase() === 'host') continue;
              h.append(k, v);
            }
            return h;
          })(),
          redirect: 'manual'
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          try {
            const buf = await req.arrayBuffer();
            init.body = buf;
          } catch (e) {
            // body may be a stream that can't be read; fall back to proxying without body
            console.warn('SW could not read request body', e);
          }
        }

        try {
          const res = await fetch(target, init);
          // Create a response with same status, headers and body
          const body = await res.arrayBuffer();
          const headers = new Headers(res.headers);
          return new Response(body, { status: res.status, statusText: res.statusText, headers });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: 'proxy error', detail: String(err) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }
      })());
    }
  } catch (e) {
    // Ignore and let default fetch handle it
  }
});
