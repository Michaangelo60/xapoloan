// Minimal data_sdk shim used by the frontend. Proxies to backend REST API.
(function(){
  window.dataSdk = {
    async init(handler) {
      this._handler = handler;
      try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const query = user && user.id ? `?userId=${encodeURIComponent(user.id)}` : '';
        // Try same-origin (Vercel proxy) first, fall back to explicit backend URL if network fails
        async function tryFetch(path, opts){
          try {
            const r = await fetch(path, opts);
            return r;
          } catch (e) {
            // network-level failure (CORS, DNS, offline) - try Render backend explicitly
            try {
              const fallback = 'https://backend-wnsn.onrender.com' + path;
              const r2 = await fetch(fallback, opts);
              return r2;
            } catch (e2) {
              throw e2;
            }
          }
        }

        const res = await tryFetch('/api/transactions' + query, {
          headers: {
            ...(token ? { Authorization: 'Bearer ' + token } : {})
          }
        });
        const json = await res.json();
        if (json && json.isOk) {
          if (handler && typeof handler.onDataChanged === 'function') handler.onDataChanged(json.data);
        }
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
        const res = await tryFetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {})
          },
          body: JSON.stringify(transaction)
        });
        const json = await res.json();
        if (json && json.isOk) {
          // call handler to refresh data
          if (this._handler && typeof this._handler.onDataChanged === 'function') {
            // fetch latest for the current user (include auth when available)
            try {
              const token = localStorage.getItem('token');
              const user = JSON.parse(localStorage.getItem('user') || '{}');
              const query = user && user.id ? `?userId=${encodeURIComponent(user.id)}` : '';
              const resList = await fetch('/api/transactions' + query, {
                headers: {
                  ...(token ? { Authorization: 'Bearer ' + token } : {})
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
