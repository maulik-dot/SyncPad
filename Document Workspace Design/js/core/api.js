        // AUTHENTICATED FETCH HELPER
        async function fetchWithAuth(url, options = {}) {
            const headers = Object.assign({}, options.headers || {});
            if (token && !headers['Authorization']) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
                options.body = JSON.stringify(options.body);
                if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
            }
            options.headers = headers;
            const res = await fetch(url, options);
            if (res.status === 401) {
                logout();
            }
            return res;
        }
