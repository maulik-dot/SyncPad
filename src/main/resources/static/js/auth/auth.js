        // AUTHENTICATION
        function checkAuthSession() {
            if (token) {
                const savedUser = localStorage.getItem('syncpad_user');
                if (savedUser) {
                    try { currentUser = JSON.parse(savedUser); } catch(e) {
                        currentUser = { name: 'Alex Morgan', email: 'demo@syncpad.com' };
                    }
                } else {
                    currentUser = { name: 'Alex Morgan', email: 'demo@syncpad.com' };
                }
                showMainShell();
                loadUserWorkspaces();
            } else {
                document.getElementById('authScreen').classList.remove('hidden');
                document.getElementById('mainShell').classList.add('hidden');
                if (typeof initGoogleSignIn === 'function') {
                    initGoogleSignIn();
                }
            }
        }

        function toggleAuthMode(mode) {
            if (mode === 'register') {
                document.getElementById('loginCard').classList.add('hidden');
                document.getElementById('registerCard').classList.remove('hidden');
            } else {
                document.getElementById('registerCard').classList.add('hidden');
                document.getElementById('loginCard').classList.remove('hidden');
            }
        }

        async function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const res = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (res.ok) {
                    const data = await res.json();
                    token = data.token;
                    localStorage.setItem('syncpad_token', token);
                    currentUser = { id: data.id, name: data.name || email.split('@')[0], email: data.email || email };
                    localStorage.setItem('syncpad_user', JSON.stringify(currentUser));
                    showMainShell();
                    loadUserWorkspaces();
                    toast('Signed in successfully');
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Invalid email or password');
                }
            } catch (err) {
                toast('Login failed. Please check your network connection.');
            }
        }

        async function handleRegister(e) {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;

            try {
                const res = await fetch('/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                if (res.ok) {
                    const data = await res.json();
                    token = data.token;
                    localStorage.setItem('syncpad_token', token);
                    currentUser = { id: data.id, name: data.name || name, email: data.email || email };
                    localStorage.setItem('syncpad_user', JSON.stringify(currentUser));
                    showMainShell();
                    loadUserWorkspaces();
                    toast('Account created successfully');
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Registration failed');
                }
            } catch (err) {
                toast('Registration failed. Please check connection.');
            }
        }

        function openSsoModal() {
            const modal = document.getElementById('ssoModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
                if (window.lucide) lucide.createIcons();
            }
        }

        function closeSsoModal() {
            const modal = document.getElementById('ssoModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        }

        async function handleSsoDiscover(e) {
            e.preventDefault();
            const emailInput = document.getElementById('ssoWorkEmail');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email) return;

            try {
                const res = await fetch('/auth/sso/discover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (res.ok) {
                    const provider = await res.json();
                    toast(`Authenticating with ${provider.displayName || 'SSO Provider'}...`);

                    // Execute SSO Login with JIT provisioning
                    const loginRes = await fetch('/auth/sso/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            provider: provider.provider,
                            email: email,
                            name: email.split('@')[0],
                            assertion: 'corporate-saml-sso-token'
                        })
                    });

                    if (loginRes.ok) {
                        const data = await loginRes.json();
                        token = data.accessToken || data.token;
                        localStorage.setItem('syncpad_token', token);
                        currentUser = { id: data.id, name: data.name || email.split('@')[0], email: data.email || email };
                        localStorage.setItem('syncpad_user', JSON.stringify(currentUser));
                        closeSsoModal();
                        showMainShell();
                        loadUserWorkspaces();
                        toast(`Signed in via Enterprise SSO (${provider.displayName})!`);
                    } else {
                        const err = await loginRes.json().catch(() => ({}));
                        toast(err.message || 'SSO authentication rejected');
                    }
                } else {
                    toast('SSO identity provider not found for this domain');
                }
            } catch (err) {
                toast('Error connecting to enterprise SSO service');
            }
        }

        function logout() {
            if (stompClient) {
                try { stompClient.disconnect(); } catch(e) {}
                stompClient = null;
                window.stompClient = null;
            }
            if (typeof isWebSocketConnecting !== 'undefined') {
                isWebSocketConnecting = false;
            }
            token = null;
            currentUser = null;
            localStorage.removeItem('syncpad_token');
            localStorage.removeItem('syncpad_user');
            document.getElementById('mainShell').classList.add('hidden');
            document.getElementById('authScreen').classList.remove('hidden');
            toast('Signed out');
        }

        function showMainShell() {
            document.getElementById('authScreen').classList.add('hidden');
            document.getElementById('mainShell').classList.remove('hidden');
            if (currentUser) {
                window.currentUser = currentUser;
                document.getElementById('userName').innerText = currentUser.name;
                document.getElementById('userEmailDisplay').innerText = currentUser.email;
                document.getElementById('userAvatar').innerText = currentUser.name.charAt(0).toUpperCase();
                document.getElementById('headerUserAvatar').innerText = currentUser.name.charAt(0).toUpperCase();
                document.getElementById('homeGreetingTitle').innerText = `Welcome back, ${currentUser.name}`;
            }
            initWebSocketNotifications();
            loadNotifications();
            loadSharedWithMe();
            refreshIcons();
        }


        async function initGoogleSignIn() {
            if (googleAuthInitialized) return;
            googleAuthInitialized = true;
            try {
                const configRes = await fetch('/auth/config');
                if (!configRes.ok) {
                    googleAuthInitialized = false;
                    return;
                }
                const cfg = await configRes.json();
                const googleClientId = cfg.googleClientId || '';
                const isConfigured = googleClientId && !googleClientId.includes('YOUR_GOOGLE') && googleClientId.includes('.apps.googleusercontent.com');
                if (!isConfigured) {
                    googleAuthInitialized = false;
                    return;
                }

                const checkAndRender = () => {
                    if (window.google && window.google.accounts && window.google.accounts.id) {
                        try {
                            google.accounts.id.initialize({
                                client_id: googleClientId,
                                callback: handleGoogleCredentialResponse,
                                auto_select: false,
                                cancel_on_tap_outside: true,
                                use_fedcm_for_prompt: true
                            });

                            const loginContainer = document.getElementById('googleSignInBtnContainer');
                            if (loginContainer) {
                                const fallbackLogin = loginContainer.innerHTML;
                                try {
                                    loginContainer.innerHTML = '';
                                    google.accounts.id.renderButton(loginContainer, {
                                        theme: 'outline',
                                        size: 'large',
                                        type: 'standard',
                                        shape: 'rectangular',
                                        text: 'continue_with',
                                        logo_alignment: 'left',
                                        width: 356
                                    });
                                    if (!loginContainer.querySelector('[role="button"]') && !loginContainer.querySelector('iframe')) loginContainer.innerHTML = fallbackLogin;
                                } catch (e) {
                                    loginContainer.innerHTML = fallbackLogin;
                                }
                            }

                            const regContainer = document.getElementById('googleRegisterBtnContainer');
                            if (regContainer) {
                                const fallbackReg = regContainer.innerHTML;
                                try {
                                    regContainer.innerHTML = '';
                                    google.accounts.id.renderButton(regContainer, {
                                        theme: 'outline',
                                        size: 'large',
                                        type: 'standard',
                                        shape: 'rectangular',
                                        text: 'signup_with',
                                        logo_alignment: 'left',
                                        width: 356
                                    });
                                    if (!regContainer.querySelector('[role="button"]') && !regContainer.querySelector('iframe')) regContainer.innerHTML = fallbackReg;
                                } catch (e) {
                                    regContainer.innerHTML = fallbackReg;
                                }
                            }

                            // Optional: prompt One Tap if available, handling suppression gracefully
                            try {
                                google.accounts.id.prompt((notification) => {
                                    if (notification.isNotDisplayed()) {
                                        // FedCM or One Tap cool-down / suppressed by user
                                    } else if (notification.isSkippedMoment()) {
                                        // User skipped or closed prompt
                                    } else if (notification.isDismissedMoment()) {
                                        // User tapped outside or dismissed
                                    }
                                });
                            } catch (_) {}
                        } catch (err) {
                            console.warn('Error rendering Google button:', err);
                        }
                    } else {
                        setTimeout(checkAndRender, 200);
                    }
                };
                checkAndRender();
            } catch (e) {
                console.warn('Google Sign-In initialization failed:', e);
            }
        }

        function ensureGsiLoaded() {
            return new Promise((resolve) => {
                if (window.google && window.google.accounts && window.google.accounts.id) {
                    resolve(true);
                    return;
                }
                // GSI script blocked or slow (adblocker / offline) — inject and wait
                try {
                    if (!document.querySelector('script[data-syncpad-gsi]')) {
                        const s = document.createElement('script');
                        s.src = 'https://accounts.google.com/gsi/client';
                        s.async = true;
                        s.defer = true;
                        s.setAttribute('data-syncpad-gsi', '1');
                        document.head.appendChild(s);
                    }
                } catch (e) {}
                let waited = 0;
                const timer = setInterval(() => {
                    waited += 200;
                    if (window.google && window.google.accounts && window.google.accounts.id) {
                        clearInterval(timer);
                        resolve(true);
                    } else if (waited >= 6000) {
                        clearInterval(timer);
                        resolve(false);
                    }
                }, 200);
            });
        }

        async function triggerGoogleAuth() {
            try {
                let cfg;
                try {
                    const configRes = await fetch('/auth/config');
                    if (!configRes.ok) {
                        toast('Unable to verify Google configuration. Please use email/password.');
                        return;
                    }
                    cfg = await configRes.json();
                } catch (e) {
                    toast('Cannot reach server. Check your connection or use email/password.');
                    return;
                }
                const googleClientId = (cfg && cfg.googleClientId) || '';
                const isConfigured = googleClientId && !googleClientId.includes('YOUR_GOOGLE') && googleClientId.includes('.apps.googleusercontent.com');

                if (!isConfigured) {
                    toast('Google Sign-In is not configured. Please set GOOGLE_CLIENT_ID environment variable with a valid OAuth 2.0 Client ID, or use email/password.');
                    return;
                }
                const gsiOk = await ensureGsiLoaded();
                if (!gsiOk) {
                    toast('Google library blocked. Disable your adblocker for accounts.google.com and try again, or use email/password.');
                    return;
                }

                // 1. Direct interactive OAuth 2.0 Token Client (opens Google account picker popup immediately)
                if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                    try {
                        const tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: googleClientId,
                            scope: 'openid email profile',
                            callback: async (tokenResponse) => {
                                if (tokenResponse && tokenResponse.access_token) {
                                    try {
                                        let email = '';
                                        let name = '';
                                        let sub = '';
                                        try {
                                            const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                                            });
                                            if (userinfoRes.ok) {
                                                const u = await userinfoRes.json();
                                                email = u.email || '';
                                                name = u.name || '';
                                                sub = u.sub || '';
                                            }
                                        } catch (_) {}
                                        await performGoogleLoginFetch(tokenResponse.access_token, email, name, sub);
                                    } catch (fetchErr) {
                                        toast('Google sign-in error: ' + (fetchErr.message || 'Verification failed'));
                                    }
                                } else if (tokenResponse && tokenResponse.error) {
                                    console.warn('Google OAuth response error:', tokenResponse.error);
                                    if (tokenResponse.error === 'popup_failed_to_open' || tokenResponse.error === 'popup_blocked_by_browser') {
                                        toast('Google sign-in popup was blocked. Please allow popups for localhost or use email/password.');
                                    } else {
                                        toast('Google OAuth error: ' + (tokenResponse.error_description || tokenResponse.error));
                                    }
                                }
                            },
                            error_callback: (err) => {
                                console.error('Google OAuth init/token error:', err);
                                toast('Google Sign-In error: ' + (err.message || err.type || JSON.stringify(err)));
                            }
                        });
                        tokenClient.requestAccessToken({ prompt: 'select_account' });
                        return;
                    } catch (oauthErr) {
                        console.warn('OAuth tokenClient failed, falling back to One Tap:', oauthErr);
                    }
                }

                // 2. Fallback to google.accounts.id
                google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleGoogleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });

                let settled = false;
                const done = (msg) => { if (!settled) { settled = true; if (msg) toast(msg); } };
                try {
                    google.accounts.id.prompt((notification) => {
                        try {
                            const notDisplayed = notification.isNotDisplayed && notification.isNotDisplayed();
                            const skipped = notification.isSkippedMoment && notification.isSkippedMoment();
                            if (notDisplayed || skipped) {
                                done('Google popup was blocked. Allow popups/cookies for accounts.google.com, or use email/password.');
                            } else {
                                done(null);
                            }
                        } catch (e) { done(null); }
                    });
                } catch (e) {
                    done('Google Sign-In failed to start. Use email/password or try again.');
                    return;
                }
                setTimeout(() => done('Google did not respond. Check popup/cookie settings for accounts.google.com, or use email/password.'), 4000);
            } catch (e) {
                console.warn('Google auth error:', e);
                toast('Google Sign-In failed. Please use email/password.');
            }
        }
        window.triggerGoogleAuth = window._triggerGoogleAuthImpl = triggerGoogleAuth;

        async function handleGoogleCredentialResponse(response) {
            if (response && response.credential) {
                let email = 'google.user@syncpad.com';
                let name = 'Google User';
                try {
                    const base64Url = response.credential.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                    const payload = JSON.parse(jsonPayload);
                    email = payload.email || email;
                    name = payload.name || name;
                } catch (e) {}
                await performGoogleLoginFetch(response.credential, email, name, 'google_sub_123');
            }
        }

        async function performGoogleLoginFetch(idToken, email, name, googleSub) {
            try {
                const res = await fetch('/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken, email, name, googleSub })
                });
                if (res.ok) {
                    const data = await res.json();
                    token = data.token;
                    localStorage.setItem('syncpad_token', token);
                    if (data.refreshToken) localStorage.setItem('syncpad_refreshToken', data.refreshToken);
                    currentUser = { id: data.id, name: data.name || name, email: data.email || email };
                    localStorage.setItem('syncpad_user', JSON.stringify(currentUser));
                    showMainShell();
                    loadUserWorkspaces();
                    toast(`Welcome, ${currentUser.name}! Signed in via Google.`);
                } else {
                    let msg = 'Google sign-in failed';
                    try {
                        const err = await res.json();
                        if (err.message) msg = err.message;
                        else if (err.error) msg = err.error;
                    } catch (_) {}
                    if (res.status === 401 && msg.includes('not configured')) {
                        toast('Google Sign-In not configured. Please use email/password.');
                    } else {
                        toast(msg);
                    }
                }
            } catch (err) {
                toast('Google sign-in failed');
            }
        }

        // ==========================================
        // REAL-TIME DOCUMENT COLLABORATION ENGINE
        // ==========================================