// Minimal data_sdk shim used by the frontend. Proxies to backend REST API.
(function(){
  // Shared fetch helper with fallbacks: local -> same-origin -> render fallback
  async function tryFetch(path, opts){
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const isTelegram = (typeof window !== 'undefined') && ((window.Telegram && window.Telegram.WebApp) || /Telegram/i.test(ua));
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const API_BASE = (typeof window !== 'undefined' && (window.API_BASE || window.API_URL)) ? ((window.API_BASE || window.API_URL).replace(/\/$/, '')) : 'https://xapoloan.onrender.com';

    // Local development override
    try {
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        try {
          const rLocal = await fetch('http://localhost:5000' + path, opts);
          return rLocal;
        } catch (e) {
          // fall through
        }
      }
    } catch (e) { /* ignore */ }

    const candidates = [];
    if (isTelegram || isIos) {
      candidates.push(API_BASE + path);
      candidates.push(path);
    } else {
      candidates.push(path);
      candidates.push(API_BASE + path);
    }

    // Ensure we prefer JSON responses
    const defaultHeaders = new Headers({ 'Accept': 'application/json' });
    if (opts && opts.headers) {
      try {
        const provided = new Headers(opts.headers);
        for (const [k,v] of provided.entries()) defaultHeaders.set(k, v);
      } catch (e) {
        try { Object.entries(opts.headers).forEach(([k,v]) => defaultHeaders.set(k, v)); } catch(_) {}
      }
    }

    let lastErr = null;
    for (const url of candidates) {
      try {
        const init = Object.assign({}, opts, { headers: defaultHeaders });
        const r = await fetch(url, init);
        return r;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('fetch failed');
  }

  // Expose global fallback in case scripts are loaded out-of-order or cached
  try { if (typeof window !== 'undefined') window.tryFetch = tryFetch; } catch (e) {}

  window.dataSdk = {
    async init(handler) {
      this._handler = handler;
      try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const query = user && user.id ? `?userId=${encodeURIComponent(user.id)}` : '';
        const res = await (typeof tryFetch === 'function' ? tryFetch : (window.tryFetch || fetch))('/api/transactions' + query, {
          headers: {
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            'X-Bypass-SW': '1'
          }
        });
        const json = await res.json();
        if (json && json.isOk) {
          if (handler && typeof handler.onDataChanged === 'function') handler.onDataChanged(json.data);
        }
        // Also fetch confirmed/completed transactions for the authenticated user and expose via onConfirmedChanged
        try {
          if (user && user.id) {
            const q2 = `?userId=${encodeURIComponent(user.id)}&status=completed`;
            const res2 = await (typeof tryFetch === 'function' ? tryFetch : (window.tryFetch || fetch))('/api/transactions' + q2, {
              headers: {
                ...(token ? { Authorization: 'Bearer ' + token } : {}),
                'X-Bypass-SW': '1'
              }
            });
            const json2 = await res2.json().catch(() => null);
            if (json2 && json2.isOk && handler && typeof handler.onConfirmedChanged === 'function') handler.onConfirmedChanged(json2.data);
          }
        } catch (e) { /* non-fatal */ }
        return { isOk: true };
      } catch (err) {
        console.error('dataSdk.init error', err);
        return { isOk: false, error: err };
      }
    },
    async create(transaction) {
      try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        // attach user info client-side as fallback
        if (user && user.id) {
          transaction.userId = transaction.userId || user.id;
          transaction.userEmail = transaction.userEmail || user.email;
          transaction.userName = transaction.userName || user.name;
        }

        const fetchFn = (typeof tryFetch === 'function' ? tryFetch : (window.tryFetch || fetch));
        const res = await fetchFn('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            'X-Bypass-SW': '1'
          },
          body: JSON.stringify(transaction)
        });

        const json = await res.json();
        if (json && json.isOk) {
          // call handler to refresh data
          if (this._handler && typeof this._handler.onDataChanged === 'function') {
            try {
              const token2 = localStorage.getItem('token');
              const user2 = JSON.parse(localStorage.getItem('user') || '{}');
              const query = user2 && user2.id ? `?userId=${encodeURIComponent(user2.id)}` : '';
              const resList = await (typeof tryFetch === 'function' ? tryFetch : (window.tryFetch || fetch))('/api/transactions' + query, {
                headers: {
                  ...(token2 ? { Authorization: 'Bearer ' + token2 } : {}),
                  'X-Bypass-SW': '1'
                }
              });
              const list = await resList.json().catch(() => ({}));
              if (list && list.isOk) this._handler.onDataChanged(list.data);
            } catch (e) {
              console.error('dataSdk.create refresh failed', e);
            }
          }
          return json;
        }
        return { isOk: false, error: json };
      } catch (err) {
        console.error('dataSdk.create error', err);
        return { isOk: false, error: err };
      }
    }
  };
})();
