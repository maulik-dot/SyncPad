        // ==========================================
        let stompClient = null;
        let isWebSocketConnecting = false;
        let userNotifications = [];

        function initWebSocketNotifications() {
            if (!currentUser || !currentUser.email) return;
            if (isWebSocketConnecting) return;
            if (stompClient && stompClient.connected) return;
            isWebSocketConnecting = true;
            try {
                if (stompClient) {
                    try { stompClient.disconnect(); } catch (e) {}
                    stompClient = null;
                }
                // Expose for PDF collaborator + other modules (live refs)
                window.currentUser = currentUser;
                const socket = new SockJS('/ws');
                stompClient = Stomp.over(socket);
                window.stompClient = stompClient;
                stompClient.debug = null; // Suppress verbose log noise

                const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
                stompClient.connect(headers, () => {
                    isWebSocketConnecting = false;
                    window.stompClient = stompClient;
                    window.currentUser = currentUser;
                    // Re-attach PDF live annotations on (re)connect
                    try { if (window.pdfCollaborator && window.pdfCollaborator.resubscribe) window.pdfCollaborator.resubscribe(); } catch (e) {}

                    // Dot-style topics only — RabbitMQ STOMP relay rejects '/' in topic names
                    try {
                        stompClient.subscribe('/topic/notifications.' + currentUser.email, (msg) => {
                            try {
                                handleIncomingNotification(JSON.parse(msg.body));
                            } catch (err) {
                                console.error('Error parsing notification:', err);
                            }
                        });
                    } catch (e) { console.warn('Notification subscription failed:', e); }

                    if (currentUser && currentUser.id) {
                        stompClient.subscribe('/topic/users.' + currentUser.id + '.notifications', (msg) => {
                            try {
                                const notif = JSON.parse(msg.body);
                                handleIncomingNotification(notif);
                            } catch (err) {
                                console.error('Error parsing user notification:', err);
                            }
                        });
                    }

                    // Restore document collaboration subscription if currently viewing a document
                    if (currentDoc && currentDoc.id && !document.getElementById('editorView').classList.contains('hidden')) {
                        subscribeToDocumentCollaboration(currentDoc.id);
                    }
                }, (error) => {
                    isWebSocketConnecting = false;
                    console.warn('STOMP notification connection not active');
                });
            } catch (e) {
                isWebSocketConnecting = false;
                console.warn('WebSocket init error:', e);
            }
        }

        function handleIncomingNotification(notif) {
            loadNotifications();
            if (typeof loadSharedWithMe === 'function') loadSharedWithMe();
            if (notif.type === 'WORKSPACE_INVITE' && notif.status === 'PENDING') {
                showInteractiveInviteToast(notif);
            } else if (notif.type === 'INVITE_ACCEPTED') {
                toast(`🎉 ${notif.message}`);
                loadUserWorkspaces();
                if (activeWorkspace) renderWorkspaceMembers();
            } else if (notif.type === 'INVITE_DECLINED') {
                toast(`ℹ️ ${notif.message}`);
            } else if (notif.type === 'ROLE_UPDATED') {
                toast(`👑 ${notif.message}`);
                loadUserWorkspaces();
                if (activeWorkspace) {
                    renderWorkspaceMembers();
                    updateActiveWorkspaceUI();
                }
            } else if (notif.type === 'DOCUMENT_MENTION') {
                toast(`🔔 ${notif.message}`);
                loadNotifications();
            } else {
                toast(notif.message || notif.title);
            }
        }

        function showInteractiveInviteToast(notif) {
            const container = document.getElementById('toastContainer');
            const toastEl = document.createElement('div');
            toastEl.className = 'toast-interactive';
            toastEl.id = `toast-notif-${notif.id}`;
            toastEl.innerHTML = `
                <div class="toast-interactive-header">
                    <div style="display:flex;align-items:center;gap:0.4rem;">
                        <i data-lucide="mail" style="width:16px;height:16px;color:var(--primary);"></i>
                        <span>${escapeHtml(notif.title)}</span>
                    </div>
                    <button class="btn btn-icon" onclick="this.closest('.toast-interactive').remove()" style="padding:2px;width:20px;height:20px;">
                        <i data-lucide="x" style="width:13px;height:13px;"></i>
                    </button>
                </div>
                <div class="toast-interactive-body">
                    ${escapeHtml(notif.message)}
                </div>
                <div class="toast-interactive-actions">
                    <button class="btn-notif-accept" onclick="acceptInvitation(${notif.id}, event); this.closest('.toast-interactive').remove();">
                        <i data-lucide="check" style="width:13px;height:13px;"></i> Accept
                    </button>
                    <button class="btn-notif-decline" onclick="declineInvitation(${notif.id}, event); this.closest('.toast-interactive').remove();">
                        <i data-lucide="x" style="width:13px;height:13px;"></i> Decline
                    </button>
                </div>
            `;
            container.appendChild(toastEl);
            refreshIcons();
            setTimeout(() => { if (toastEl.parentNode) toastEl.remove(); }, 15000);
        }

        let currentNotifFilter = 'all';

        async function loadNotifications() {
            if (!token) return;
            try {
                const res = await fetch('/notifications', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    userNotifications = await res.json();
                    renderNotifications();
                    renderFullNotificationsList();
                }
            } catch (e) {}
        }

        function renderNotifications() {
            const list = document.getElementById('notificationsList');
            const badge = document.getElementById('notifBadge');
            const countPill = document.getElementById('notifCountPill');
            if (!list) return;

            const unreadCount = userNotifications.filter(n => !n.read).length;
            if (badge) {
                badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
            }
            const sidebarBadge = document.getElementById('sidebarNotifBadge');
            if (sidebarBadge) {
                sidebarBadge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                sidebarBadge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
            }
            if (countPill) {
                if (unreadCount > 0) {
                    countPill.innerText = `${unreadCount} new`;
                    countPill.style.display = 'inline-flex';
                } else {
                    countPill.style.display = 'none';
                }
            }

            if (userNotifications.length === 0) {
                list.innerHTML = `
                    <div style="padding: 2.25rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
                        <i data-lucide="bell-off" style="width:28px;height:28px;margin:0 auto 0.5rem auto;opacity:0.4;display:block;"></i>
                        <div>No notifications yet</div>
                    </div>
                `;
                refreshIcons();
                return;
            }

            list.innerHTML = userNotifications.map(n => {
                const isUnread = !n.read;
                const timeStr = formatTimeAgo(n.createdAt);
                const initial = n.workspaceInitial || (n.senderName ? n.senderName.substring(0, 1).toUpperCase() : 'W');
                const color = n.workspaceColor || '#2563eb';

                if (n.type === 'WORKSPACE_INVITE') {
                    if (n.status === 'PENDING') {
                        return `
                            <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${n.id}" onclick="markSingleNotificationRead(${n.id})">
                                <div class="notification-card-header">
                                    <div class="notification-avatar" style="background: ${color};">
                                        ${initial}
                                    </div>
                                    <div class="notification-meta">
                                        <div class="notification-title">${escapeHtml(n.title)}</div>
                                        <div class="notification-msg">${escapeHtml(n.message)}</div>
                                        <div class="notification-time">${timeStr} • <span class="notif-badge-pill role">${n.targetRole || 'Editor'}</span></div>
                                    </div>
                                    <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:20px;height:20px;padding:2px;margin-left:auto;flex-shrink:0;">
                                        <i data-lucide="x" style="width:13px;height:13px;"></i>
                                    </button>
                                </div>
                                <div class="notification-actions">
                                    <button class="btn-notif-accept" onclick="acceptInvitation(${n.id}, event)">
                                        <i data-lucide="check" style="width:13px;height:13px;"></i> Accept
                                    </button>
                                    <button class="btn-notif-decline" onclick="declineInvitation(${n.id}, event)">
                                        <i data-lucide="x" style="width:13px;height:13px;"></i> Decline
                                    </button>
                                </div>
                            </div>
                        `;
                    } else if (n.status === 'ACCEPTED') {
                        return `
                            <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${n.id}" onclick="markSingleNotificationRead(${n.id})">
                                <div class="notification-card-header">
                                    <div class="notification-avatar" style="background: #16a34a;">
                                        <i data-lucide="check" style="width:16px;height:16px;"></i>
                                    </div>
                                    <div class="notification-meta">
                                        <div class="notification-title">${escapeHtml(n.title)}</div>
                                        <div class="notification-msg">${escapeHtml(n.message)}</div>
                                        <div class="notification-time">${timeStr} • <span class="notif-badge-pill accepted">Accepted</span></div>
                                    </div>
                                    <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:20px;height:20px;padding:2px;margin-left:auto;flex-shrink:0;">
                                        <i data-lucide="x" style="width:13px;height:13px;"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${n.id}" onclick="markSingleNotificationRead(${n.id})">
                                <div class="notification-card-header">
                                    <div class="notification-avatar" style="background: #dc2626;">
                                        <i data-lucide="x" style="width:16px;height:16px;"></i>
                                    </div>
                                    <div class="notification-meta">
                                        <div class="notification-title">${escapeHtml(n.title)}</div>
                                        <div class="notification-msg">${escapeHtml(n.message)}</div>
                                        <div class="notification-time">${timeStr} • <span class="notif-badge-pill declined">Declined</span></div>
                                    </div>
                                    <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:20px;height:20px;padding:2px;margin-left:auto;flex-shrink:0;">
                                        <i data-lucide="x" style="width:13px;height:13px;"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }
                } else if (n.type === 'INVITE_ACCEPTED') {
                    return `
                        <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${n.id}" onclick="markSingleNotificationRead(${n.id})">
                            <div class="notification-card-header">
                                <div class="notification-avatar" style="background: #16a34a;">
                                    <i data-lucide="user-check" style="width:16px;height:16px;"></i>
                                </div>
                                <div class="notification-meta">
                                    <div class="notification-title">${escapeHtml(n.title)}</div>
                                    <div class="notification-msg">${escapeHtml(n.message)}</div>
                                    <div class="notification-time">${timeStr} • <span class="notif-badge-pill accepted">Member Joined</span></div>
                                </div>
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:20px;height:20px;padding:2px;margin-left:auto;flex-shrink:0;">
                                    <i data-lucide="x" style="width:13px;height:13px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else if (n.type === 'INVITE_DECLINED') {
                    return `
                        <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${n.id}" onclick="markSingleNotificationRead(${n.id})">
                            <div class="notification-card-header">
                                <div class="notification-avatar" style="background: #64748b;">
                                    <i data-lucide="user-x" style="width:16px;height:16px;"></i>
                                </div>
                                <div class="notification-meta">
                                    <div class="notification-title">${escapeHtml(n.title)}</div>
                                    <div class="notification-msg">${escapeHtml(n.message)}</div>
                                    <div class="notification-time">${timeStr} • <span class="notif-badge-pill declined">Declined</span></div>
                                </div>
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:20px;height:20px;padding:2px;margin-left:auto;flex-shrink:0;">
                                    <i data-lucide="x" style="width:13px;height:13px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else if (n.type === 'ROLE_UPDATED') {
                    const isAdmin = n.targetRole === 'ADMIN';
                    return `
                        <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${n.id}" onclick="markSingleNotificationRead(${n.id})">
                            <div class="notification-card-header">
                                <div class="notification-avatar" style="background: ${isAdmin ? '#8b5cf6' : '#2563eb'};">
                                    <i data-lucide="${isAdmin ? 'crown' : 'shield-check'}" style="width:16px;height:16px;"></i>
                                </div>
                                <div class="notification-meta">
                                    <div class="notification-title">${escapeHtml(n.title)}</div>
                                    <div class="notification-msg">${escapeHtml(n.message)}</div>
                                    <div class="notification-time">${timeStr} • <span class="notif-badge-pill role">${escapeHtml(n.targetRole || 'ADMIN')}</span></div>
                                </div>
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:20px;height:20px;padding:2px;margin-left:auto;flex-shrink:0;">
                                    <i data-lucide="x" style="width:13px;height:13px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else if (n.type === 'DOCUMENT_MENTION') {
                    return `
                        <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${n.id}" onclick="markSingleNotificationRead(${n.id})">
                            <div class="notification-card-header">
                                <div class="notification-avatar" style="background: linear-gradient(135deg, #6366f1, #8b5cf6);">
                                    <i data-lucide="at-sign" style="width:16px;height:16px;"></i>
                                </div>
                                <div class="notification-meta">
                                    <div class="notification-title">${escapeHtml(n.title)}</div>
                                    <div class="notification-msg">${escapeHtml(n.message)}</div>
                                    <div class="notification-time">${timeStr} • <span class="notif-badge-pill role" style="background:rgba(99,102,241,0.15);color:#818cf8;">Mention</span></div>
                                </div>
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:20px;height:20px;padding:2px;margin-left:auto;flex-shrink:0;">
                                    <i data-lucide="x" style="width:13px;height:13px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-card-${n.id}" onclick="markSingleNotificationRead(${n.id})">
                            <div class="notification-card-header">
                                <div class="notification-avatar" style="background: var(--primary);">
                                    <i data-lucide="info" style="width:16px;height:16px;"></i>
                                </div>
                                <div class="notification-meta">
                                    <div class="notification-title">${escapeHtml(n.title)}</div>
                                    <div class="notification-msg">${escapeHtml(n.message)}</div>
                                    <div class="notification-time">${timeStr}</div>
                                </div>
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:20px;height:20px;padding:2px;margin-left:auto;flex-shrink:0;">
                                    <i data-lucide="x" style="width:13px;height:13px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
            }).join('');

            refreshIcons();
        }

        function filterFullNotifications(tab, el) {
            currentNotifFilter = tab;
            document.querySelectorAll('#notificationsView .tab-item').forEach(btn => btn.classList.remove('active'));
            if (el) el.classList.add('active');
            renderFullNotificationsList();
            refreshIcons();
        }

        function renderFullNotificationsList() {
            const list = document.getElementById('fullNotificationsList');
            const unreadPill = document.getElementById('fullNotifUnreadPill');
            const tabAll = document.getElementById('tabCountAll');
            const tabInvites = document.getElementById('tabCountInvites');
            const tabUnread = document.getElementById('tabCountUnread');
            const searchInput = document.getElementById('notifSearchInput');
            const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

            if (!list) return;

            const allInvites = userNotifications.filter(n => n.type === 'WORKSPACE_INVITE');
            const allUnread = userNotifications.filter(n => !n.read);

            if (tabAll) tabAll.innerText = `(${userNotifications.length})`;
            if (tabInvites) tabInvites.innerText = `(${allInvites.length})`;
            if (tabUnread) tabUnread.innerText = `(${allUnread.length})`;
            if (unreadPill) {
                unreadPill.innerText = `${allUnread.length} unread`;
                unreadPill.className = `notif-badge-pill ${allUnread.length > 0 ? 'role' : 'accepted'}`;
            }

            let filtered = userNotifications;
            if (currentNotifFilter === 'invites') {
                filtered = allInvites;
            } else if (currentNotifFilter === 'unread') {
                filtered = allUnread;
            }

            if (query) {
                filtered = filtered.filter(n => 
                    (n.title && n.title.toLowerCase().includes(query)) ||
                    (n.message && n.message.toLowerCase().includes(query)) ||
                    (n.workspaceName && n.workspaceName.toLowerCase().includes(query)) ||
                    (n.senderName && n.senderName.toLowerCase().includes(query))
                );
            }

            if (filtered.length === 0) {
                list.innerHTML = `
                    <div class="card" style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted);">
                        <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: var(--text-muted);">
                            <i data-lucide="bell-off" style="width: 26px; height: 26px;"></i>
                        </div>
                        <h3 style="font-size: 1.05rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.35rem;">No notifications found</h3>
                        <p style="font-size: 0.82rem; max-width: 360px; margin: 0 auto;">${query ? 'No activity matches your search filter.' : 'You are all caught up! New workspace invitations and activity alerts will appear here.'}</p>
                    </div>
                `;
                refreshIcons();
                return;
            }

            list.innerHTML = filtered.map(n => {
                const isUnread = !n.read;
                const timeStr = formatTimeAgo(n.createdAt);
                const color = n.workspaceColor || '#2563eb';
                const initial = n.workspaceInitial || (n.senderName ? n.senderName.substring(0, 1).toUpperCase() : 'W');

                if (n.type === 'WORKSPACE_INVITE') {
                    const isPending = n.status === 'PENDING';
                    const isAccepted = n.status === 'ACCEPTED';

                    return `
                        <div class="notif-full-card ${isUnread ? 'unread' : ''}" onclick="markSingleNotificationRead(${n.id})">
                            <div style="display: flex; align-items: flex-start; gap: 1rem; flex: 1;">
                                <div class="avatar" style="width: 44px; height: 44px; font-size: 1.1rem; background: ${color}; flex-shrink: 0; box-shadow: var(--shadow-sm);">
                                    ${initial}
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                                        <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(n.title)}</span>
                                        <span class="notif-badge-pill role" style="font-size: 0.68rem; text-transform: uppercase;">${n.targetRole || 'Editor'}</span>
                                        ${isUnread ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--primary);display:inline-block;"></span>' : ''}
                                    </div>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; line-height: 1.4;">${escapeHtml(n.message)}</p>
                                    <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">
                                        <span><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${timeStr}</span>
                                        ${n.workspaceName ? `<span>• <i data-lucide="layout-grid" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${escapeHtml(n.workspaceName)}</span>` : ''}
                                    </div>
                                </div>
                            </div>

                            <div style="display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; margin-left: 1rem;">
                                ${isPending ? `
                                    <button class="btn btn-primary" onclick="acceptInvitation(${n.id}, event)" style="font-size: 0.82rem; padding: 0.45rem 0.95rem; display: flex; align-items: center; gap: 0.35rem;">
                                        <i data-lucide="check" style="width:14px;height:14px;"></i>
                                        <span>Accept</span>
                                    </button>
                                    <button class="btn btn-outline" onclick="declineInvitation(${n.id}, event)" style="font-size: 0.82rem; padding: 0.45rem 0.85rem; display: flex; align-items: center; gap: 0.35rem; color: var(--danger); border-color: var(--border-color);">
                                        <i data-lucide="x" style="width:14px;height:14px;"></i>
                                        <span>Decline</span>
                                    </button>
                                ` : (isAccepted ? `
                                    <span class="notif-badge-pill accepted" style="font-size: 0.75rem; padding: 0.3rem 0.65rem; display: flex; align-items: center; gap: 0.35rem;">
                                        <i data-lucide="check" style="width:13px;height:13px;"></i> Accepted
                                    </span>
                                ` : `
                                    <span class="notif-badge-pill declined" style="font-size: 0.75rem; padding: 0.3rem 0.65rem; display: flex; align-items: center; gap: 0.35rem;">
                                        <i data-lucide="x" style="width:13px;height:13px;"></i> Declined
                                    </span>
                                `)}
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:30px;height:30px;color:var(--text-muted);border-radius:var(--radius-sm);">
                                    <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else if (n.type === 'INVITE_ACCEPTED') {
                    return `
                        <div class="notif-full-card ${isUnread ? 'unread' : ''}" onclick="markSingleNotificationRead(${n.id})">
                            <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                                <div class="avatar" style="width: 44px; height: 44px; font-size: 1.1rem; background: #16a34a; color: #fff; flex-shrink: 0;">
                                    <i data-lucide="user-check" style="width: 22px; height: 22px;"></i>
                                </div>
                                <div>
                                    <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.15rem;">${escapeHtml(n.title)}</div>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">${escapeHtml(n.message)}</p>
                                    <span style="font-size: 0.75rem; color: var(--text-muted);"><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${timeStr}</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span class="notif-badge-pill accepted" style="font-size: 0.75rem; padding: 0.3rem 0.65rem;">Member Joined</span>
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:30px;height:30px;color:var(--text-muted);border-radius:var(--radius-sm);">
                                    <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else if (n.type === 'ROLE_UPDATED') {
                    const isAdmin = n.targetRole === 'ADMIN';
                    return `
                        <div class="notif-full-card ${isUnread ? 'unread' : ''}" onclick="markSingleNotificationRead(${n.id})">
                            <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                                <div class="avatar" style="width: 44px; height: 44px; font-size: 1.1rem; background: ${isAdmin ? '#8b5cf6' : '#2563eb'}; color: #fff; flex-shrink: 0; box-shadow: var(--shadow-sm);">
                                    <i data-lucide="${isAdmin ? 'crown' : 'shield-check'}" style="width: 22px; height: 22px;"></i>
                                </div>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                                        <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(n.title)}</span>
                                        <span class="notif-badge-pill role" style="font-size: 0.68rem; text-transform: uppercase;">${escapeHtml(n.targetRole || 'ADMIN')}</span>
                                        ${isUnread ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--primary);display:inline-block;"></span>' : ''}
                                    </div>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">${escapeHtml(n.message)}</p>
                                    <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">
                                        <span><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${timeStr}</span>
                                        ${n.workspaceName ? `<span>• <i data-lucide="layout-grid" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${escapeHtml(n.workspaceName)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span class="notif-badge-pill ${isAdmin ? 'accepted' : 'role'}" style="font-size: 0.75rem; padding: 0.3rem 0.65rem;">Role Updated</span>
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:30px;height:30px;color:var(--text-muted);border-radius:var(--radius-sm);">
                                    <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else if (n.type === 'DOCUMENT_MENTION') {
                    return `
                        <div class="notif-full-card ${isUnread ? 'unread' : ''}" onclick="markSingleNotificationRead(${n.id})">
                            <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                                <div class="avatar" style="width: 44px; height: 44px; font-size: 1.1rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; flex-shrink: 0; box-shadow: var(--shadow-sm);">
                                    <i data-lucide="at-sign" style="width: 22px; height: 22px;"></i>
                                </div>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                                        <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(n.title)}</span>
                                        <span class="notif-badge-pill role" style="font-size: 0.68rem; text-transform: uppercase; background:rgba(99,102,241,0.15);color:#818cf8;">Mention</span>
                                        ${isUnread ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--primary);display:inline-block;"></span>' : ''}
                                    </div>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">${escapeHtml(n.message)}</p>
                                    <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">
                                        <span><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${timeStr}</span>
                                        ${n.workspaceName ? `<span>• <i data-lucide="layout-grid" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${escapeHtml(n.workspaceName)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:30px;height:30px;color:var(--text-muted);border-radius:var(--radius-sm);">
                                    <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="notif-full-card ${isUnread ? 'unread' : ''}" onclick="markSingleNotificationRead(${n.id})">
                            <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                                <div class="avatar" style="width: 44px; height: 44px; font-size: 1.1rem; background: var(--primary); color: #fff; flex-shrink: 0;">
                                    <i data-lucide="info" style="width: 22px; height: 22px;"></i>
                                </div>
                                <div>
                                    <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.15rem;">${escapeHtml(n.title)}</div>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">${escapeHtml(n.message)}</p>
                                    <span style="font-size: 0.75rem; color: var(--text-muted);"><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${timeStr}</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <button class="btn btn-icon notif-clear-btn" onclick="clearSingleNotification(${n.id}, event)" title="Clear notification" style="width:30px;height:30px;color:var(--text-muted);border-radius:var(--radius-sm);">
                                    <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
            }).join('');

            refreshIcons();
        }

        let rawSharedDocuments = [];

        async function loadSharedWithMe() {
            if (!token) return;
            try {
                const [notifRes, docsRes, wsRes] = await Promise.all([
                    fetch('/notifications', { headers: { 'Authorization': 'Bearer ' + token } }).catch(() => null),
                    fetch('/documents/shared-with-me', { headers: { 'Authorization': 'Bearer ' + token } }).catch(() => null),
                    fetch('/workspaces', { headers: { 'Authorization': 'Bearer ' + token } }).catch(() => null)
                ]);

                if (notifRes && notifRes.ok) {
                    userNotifications = await notifRes.json();
                    renderNotifications();
                }
                if (docsRes && docsRes.ok) {
                    rawSharedDocuments = await docsRes.json();
                }
                if (wsRes && wsRes.ok) {
                    workspacesList = await wsRes.json();
                }
            } catch (e) {
                console.error('Failed to load shared with me items', e);
            }
            renderSharedWithMeScreen();
        }

        function createSharedDocCard(item) {
            const isBoard = item.fileType === 'WHITEBOARD';
            const isStarred = !!item.isStarred;
            const card = document.createElement('div');
            card.className = 'card card-hover';
            card.style.cursor = 'pointer';
            card.style.position = 'relative';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.minHeight = '158px';
            card.onclick = () => openItemView(item);

            const ownerDisplay = item.owner ? (item.owner.name || item.owner.email) : 'Collaborator';
            const roleStr = item.currentUserRole ? (item.currentUserRole === 'EDITOR' ? 'Can Edit' : (item.currentUserRole === 'COMMENTER' ? 'Can Comment' : 'Read Only')) : 'Shared';
            const roleBadgeStyle = item.currentUserRole === 'EDITOR' 
                ? 'background: rgba(37,99,235,0.12); color: #2563eb; border: 1px solid rgba(37,99,235,0.25);'
                : (item.currentUserRole === 'COMMENTER'
                    ? 'background: rgba(245,158,11,0.12); color: #d97706; border: 1px solid rgba(245,158,11,0.25);'
                    : 'background: var(--bg-surface-hover); color: var(--text-secondary); border: 1px solid var(--border-color);');

            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                        <div class="${isBoard ? 'icon-box-board' : 'icon-box-doc'}" style="width: 38px; height: 38px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="${isBoard ? 'presentation' : 'file-text'}" style="width:20px;height:20px;"></i>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <span class="badge" style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; ${roleBadgeStyle}">
                                ${escapeHtml(roleStr)}
                            </span>
                            <button class="btn btn-icon" onclick="event.stopPropagation(); toggleStarDoc(${item.id})" title="${isStarred ? 'Unstar' : 'Star'}" aria-label="Star">
                                <i data-lucide="star" style="width:14px;height:14px;${isStarred ? 'fill:#f59e0b;color:#f59e0b;' : 'color:var(--text-muted);'}"></i>
                            </button>
                        </div>
                    </div>
                    <h3 style="font-size: 0.98rem; font-weight: 600; margin-bottom: 0.25rem; line-height: 1.35; color: var(--text-primary); word-break: break-word;">${escapeHtml(item.title || 'Untitled')}</h3>
                    <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                        Shared by: <strong style="color: var(--text-secondary);">${escapeHtml(ownerDisplay)}</strong>
                    </div>
                    ${item.workspaceName ? `<div style="font-size: 0.7rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 3px; background: var(--bg-surface-hover); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-color);"><i data-lucide="layout-grid" style="width: 10px; height: 10px;"></i> ${escapeHtml(item.workspaceName)}</div>` : ''}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.65rem; margin-top: 0.75rem;">
                    <span style="font-size: 0.73rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem;">
                        <i data-lucide="clock" style="width:12px;height:12px;"></i>
                        ${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently'}
                    </span>
                    <span style="font-size: 0.78rem; color: var(--accent-primary); font-weight: 600; display: flex; align-items: center; gap: 0.2rem;">
                        Open <i data-lucide="arrow-right" style="width:13px;height:13px;"></i>
                    </span>
                </div>
            `;
            return card;
        }

        function renderSharedWithMeScreen() {
            const pendingSection = document.getElementById('sharedPendingInvitesSection');
            const pendingGrid = document.getElementById('sharedPendingGrid');
            const pendingBadge = document.getElementById('sharedPendingBadge');
            const wsGrid = document.getElementById('sharedWorkspacesGrid');
            const docsGrid = document.getElementById('sharedDocsGrid');
            const totalBadge = document.getElementById('sharedTotalBadge');
            const sidebarSharedCount = document.getElementById('sidebarSharedCount');
            const searchInput = document.getElementById('sharedSearchInput');
            const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

            if (!wsGrid || !docsGrid) return;

            // 1. Pending Collaboration Requests & Invitations
            const pendingInvites = (userNotifications || []).filter(n =>
                n.status === 'PENDING' && (n.type === 'WORKSPACE_INVITE' || n.type === 'DOCUMENT_SHARE')
            );

            if (pendingSection && pendingGrid) {
                let filteredPending = pendingInvites;
                if (query) {
                    filteredPending = filteredPending.filter(n =>
                        (n.title && n.title.toLowerCase().includes(query)) ||
                        (n.message && n.message.toLowerCase().includes(query)) ||
                        (n.senderName && n.senderName.toLowerCase().includes(query)) ||
                        (n.senderEmail && n.senderEmail.toLowerCase().includes(query)) ||
                        (n.workspaceName && n.workspaceName.toLowerCase().includes(query))
                    );
                }

                if (pendingBadge) {
                    pendingBadge.innerText = `${filteredPending.length} pending`;
                }

                if (filteredPending.length > 0) {
                    pendingSection.style.display = 'block';
                    pendingGrid.innerHTML = filteredPending.map(n => {
                        const senderDisplay = n.senderName || n.senderEmail || 'Collaborator';
                        const roleStr = n.targetRole || 'Editor';
                        const initial = n.workspaceInitial || (n.workspaceName ? n.workspaceName.charAt(0).toUpperCase() : 'W');
                        const color = n.workspaceColor || '#2563eb';
                        return `
                            <div class="card" style="padding: 1.25rem; border: 1px solid rgba(245, 158, 11, 0.4); background: var(--bg-surface); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; position: relative;">
                                <div style="position: absolute; top: 12px; right: 12px;">
                                    <span class="notif-badge-pill pending" style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); display: inline-flex; align-items: center; gap: 3px;">
                                        <i data-lucide="clock" style="width: 11px; height: 11px;"></i> ${escapeHtml(roleStr)}
                                    </span>
                                </div>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem; padding-right: 70px;">
                                        <div class="avatar" style="width: 40px; height: 40px; font-size: 1rem; background: ${color}; color: #fff; font-weight: 700; flex-shrink: 0;">${escapeHtml(initial)}</div>
                                        <div>
                                            <h3 style="font-size: 1.02rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.15rem;">${escapeHtml(n.workspaceName || 'Collaboration Invite')}</h3>
                                            <div style="font-size: 0.75rem; color: var(--text-muted);">From: <strong style="color: var(--text-secondary);">${escapeHtml(senderDisplay)}</strong></div>
                                        </div>
                                    </div>
                                    <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 1.15rem;">${escapeHtml(n.message || `You have been invited to join as ${roleStr}.`)}</p>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.85rem; gap: 0.5rem;">
                                    <span style="font-size: 0.72rem; color: var(--text-muted);">${formatRelativeTime(n.createdAt)}</span>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button class="btn btn-outline" onclick="declineInvitation(${n.id}, event)" style="font-size: 0.78rem; padding: 0.35rem 0.75rem; color: var(--danger); border-color: var(--border-color);">
                                            Decline
                                        </button>
                                        <button class="btn btn-primary" onclick="acceptInvitation(${n.id}, event)" style="font-size: 0.78rem; padding: 0.35rem 0.9rem; display: flex; align-items: center; gap: 0.35rem; background: #059669; border-color: #059669;">
                                            <i data-lucide="check" style="width: 13px; height: 13px;"></i>
                                            <span>Accept</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    pendingSection.style.display = 'none';
                }
            }

            // 2. Shared Workspaces (workspaces not owned by currentUser)
            let sharedWorkspaces = (workspacesList || []).filter(ws => {
                if (!ws || !currentUser) return false;
                if (ws.owner) {
                    return (ws.owner.email && ws.owner.email !== currentUser.email) || (ws.owner.id && ws.owner.id !== currentUser.id);
                }
                return ws.currentUserRole && ws.currentUserRole !== 'OWNER';
            });

            // 3. Shared Documents & Whiteboards
            let sharedDocs = [];
            const seenDocIds = new Set();
            if (rawSharedDocuments && Array.isArray(rawSharedDocuments)) {
                rawSharedDocuments.forEach(d => {
                    if (d && !seenDocIds.has(d.id)) {
                        seenDocIds.add(d.id);
                        sharedDocs.push(d);
                    }
                });
            }
            if (documentsList && Array.isArray(documentsList)) {
                documentsList.forEach(d => {
                    if (d && !seenDocIds.has(d.id) && (d.shared || d.isShared || (d.owner && currentUser && d.owner.email !== currentUser.email))) {
                        seenDocIds.add(d.id);
                        sharedDocs.push(d);
                    }
                });
            }

            if (query) {
                sharedWorkspaces = sharedWorkspaces.filter(ws => 
                    ws.name.toLowerCase().includes(query) || 
                    (ws.description && ws.description.toLowerCase().includes(query)) ||
                    (ws.owner && ws.owner.name && ws.owner.name.toLowerCase().includes(query))
                );
                sharedDocs = sharedDocs.filter(d => 
                    d.title.toLowerCase().includes(query) ||
                    (d.fileType && d.fileType.toLowerCase().includes(query)) ||
                    (d.owner && d.owner.name && d.owner.name.toLowerCase().includes(query)) ||
                    (d.workspaceName && d.workspaceName.toLowerCase().includes(query))
                );
            }

            const totalCount = pendingInvites.length + sharedWorkspaces.length + sharedDocs.length;
            if (totalBadge) totalBadge.innerText = `${totalCount} ${totalCount === 1 ? 'item' : 'items'}`;
            if (sidebarSharedCount) {
                sidebarSharedCount.innerText = totalCount;
                sidebarSharedCount.style.display = totalCount > 0 ? 'inline-flex' : 'none';
            }

            if (sharedWorkspaces.length === 0) {
                wsGrid.innerHTML = `
                    <div class="card" style="grid-column: 1/-1; padding: 2.5rem 1.5rem; text-align: center; color: var(--text-muted);">
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto; color: var(--text-muted);">
                            <i data-lucide="layout-grid" style="width: 22px; height: 22px;"></i>
                        </div>
                        <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">No shared workspaces</h3>
                        <p style="font-size: 0.8rem; max-width: 320px; margin: 0 auto;">When team members invite you to collaborate on their workspaces, they will appear here.</p>
                    </div>
                `;
            } else {
                wsGrid.innerHTML = sharedWorkspaces.map(ws => {
                    const ownerName = ws.owner ? (ws.owner.name || ws.owner.email) : 'Team Admin';
                    const roleLabel = ws.currentUserRole || ws.role || 'Member';
                    return `
                        <div class="shared-ws-card">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.9rem;">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div class="avatar" style="width: 40px; height: 40px; font-size: 1rem; background: ${ws.color || '#8b5cf6'};">${ws.initial || ws.name.charAt(0)}</div>
                                        <div>
                                            <h3 style="font-size: 1.02rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(ws.name)}</h3>
                                            <div style="font-size: 0.73rem; color: var(--text-muted); margin-top: 0.1rem;">Owner: <strong style="color:var(--text-secondary);">${escapeHtml(ownerName)}</strong></div>
                                        </div>
                                    </div>
                                    <span class="notif-badge-pill role" style="font-size: 0.68rem; text-transform: uppercase;">${escapeHtml(roleLabel)}</span>
                                </div>
                                <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 1.25rem; min-height: 38px;">${escapeHtml(ws.description || 'Collaborative workspace container')}</p>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.85rem;">
                                <div style="display: flex; align-items: center; gap: 0.4rem;">
                                    <button class="btn btn-icon" onclick="event.stopPropagation(); openWorkspaceShareModalById(${ws.id})" title="View Members" aria-label="Members">
                                        <i data-lucide="users" style="width:15px;height:15px;"></i>
                                    </button>
                                    <button class="btn btn-outline" onclick="event.stopPropagation(); leaveWorkspace(${ws.id})" title="Leave Workspace" style="font-size:0.72rem; padding:0.25rem 0.5rem; color:var(--danger); border-color:var(--border-color);">
                                        <i data-lucide="log-out" style="width:12px;height:12px;"></i> Leave
                                    </button>
                                </div>
                                <button class="btn btn-primary" onclick="selectWorkspaceById(${ws.id})" style="font-size: 0.8rem; padding: 0.4rem 0.85rem; display: flex; align-items: center; gap: 0.35rem;">
                                    <span>Open</span>
                                    <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            if (sharedDocs.length === 0) {
                docsGrid.innerHTML = `
                    <div class="card" style="grid-column: 1/-1; padding: 2.5rem 1.5rem; text-align: center; color: var(--text-muted);">
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-surface-hover); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto; color: var(--text-muted);">
                            <i data-lucide="file-text" style="width: 22px; height: 22px;"></i>
                        </div>
                        <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">No shared documents</h3>
                        <p style="font-size: 0.8rem; max-width: 320px; margin: 0 auto;">Directly shared documents and whiteboards will appear here.</p>
                    </div>
                `;
            } else {
                docsGrid.innerHTML = '';
                sharedDocs.forEach(item => {
                    docsGrid.appendChild(createSharedDocCard(item));
                });
            }

            refreshIcons();
        }

        async function acceptInvitation(id, e) {
            if (e) e.stopPropagation();
            try {
                const res = await fetch(`/notifications/${id}/accept`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    toast('🎉 Workspace invitation accepted!');
                    await loadNotifications();
                    await loadUserWorkspaces();
                    if (typeof loadSharedWithMe === 'function') await loadSharedWithMe();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to accept invitation');
                }
            } catch (err) {
                toast('Failed to accept invitation');
            }
        }

        async function declineInvitation(id, e) {
            if (e) e.stopPropagation();
            try {
                const res = await fetch(`/notifications/${id}/decline`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    toast('Invitation declined');
                    await loadNotifications();
                    if (typeof loadSharedWithMe === 'function') await loadSharedWithMe();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to decline invitation');
                }
            } catch (err) {
                toast('Failed to decline invitation');
            }
        }

        async function markNotificationsAsRead() {
            if (!token) return;
            try {
                await fetch('/notifications/read-all', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                userNotifications.forEach(n => n.read = true);
                renderNotifications();
                renderFullNotificationsList();
                toast('All notifications marked as read');
            } catch (e) {}
        }

        async function markAllNotificationsRead() {
            await markNotificationsAsRead();
        }

        async function markSingleNotificationRead(notifId) {
            if (!token) return;
            const notif = userNotifications.find(n => n.id === notifId);
            if (!notif || notif.read) return;
            try {
                const res = await fetch(`/notifications/${notifId}/read`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    notif.read = true;
                    renderNotifications();
                    renderFullNotificationsList();
                }
            } catch (e) {}
        }

        async function clearSingleNotification(notifId, event) {
            if (event) event.stopPropagation();
            if (!token) return;
            try {
                const res = await fetch(`/notifications/${notifId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    userNotifications = userNotifications.filter(n => n.id !== notifId);
                    renderNotifications();
                    renderFullNotificationsList();
                    toast('Notification cleared');
                } else {
                    toast('Failed to clear notification');
                }
            } catch (e) {
                toast('Failed to clear notification');
            }
        }

        async function clearAllNotifications() {
            if (!token || userNotifications.length === 0) return;
            if (!confirm('Clear all notifications?')) return;
            try {
                const res = await fetch('/notifications/clear-all', {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    userNotifications = [];
                    renderNotifications();
                    renderFullNotificationsList();
                    toast('All notifications cleared');
                } else {
                    toast('Failed to clear notifications');
                }
            } catch (e) {
                toast('Failed to clear notifications');
            }
        }

        function toggleNotificationsMenu() {
            const menu = document.getElementById('notificationsMenu');
            menu.classList.toggle('hidden');
            if (!menu.classList.contains('hidden')) {
                loadNotifications();
            }
            refreshIcons();
        }

        function formatTimeAgo(dateStr) {
            if (!dateStr) return 'Just now';
            const date = new Date(dateStr);
            const now = new Date();
            const diffSeconds = Math.floor((now - date) / 1000);
            if (diffSeconds < 60) return 'Just now';
            const diffMinutes = Math.floor(diffSeconds / 60);
            if (diffMinutes < 60) return `${diffMinutes}m ago`;
            const diffHours = Math.floor(diffMinutes / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }



        // Document typing and selection listeners + pane resizer init
        document.addEventListener('DOMContentLoaded', () => {
            initPaneResizer();
            if (typeof initPdfEngine === 'function') {
                initPdfEngine();
            }
            if (typeof updateDocOutline === 'function') {
                updateDocOutline();
                initDocOutlineScrollSpy();
            }
            const sheet = document.getElementById('docPageSheet');
            const pane = document.getElementById('docEditorPane');
            if (pane) {
                pane.addEventListener('scroll', () => {
                    updateDocStats();
                }, { passive: true });
            }


            if (sheet) {
                sheet.addEventListener('input', () => {
                    onDocChange();
                    checkMentionTrigger();
                    saveDocSelection();
                    updateDocStats();
                    scrollCursorIntoView();
                    broadcastLocalCursorPosition();
                });
                sheet.addEventListener('keydown', (e) => {
                    if (handleMentionKeydown(e)) {
                        return;
                    }
                    if (handleChecklistKeydown(e)) {
                        return;
                    }
                    if (handleSpecialBlockKeydown(e)) {
                        return;
                    }
                    if (['Enter', 'ArrowDown', 'PageDown'].includes(e.key)) {
                        setTimeout(() => scrollCursorIntoView(), 10);
                    }
                });
                sheet.addEventListener('keyup', (e) => {
                    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                        return;
                    }
                    checkMentionTrigger();
                    saveDocSelection();
                    syncToolbarStates();
                    scrollCursorIntoView();
                    broadcastLocalCursorPosition();
                });
                sheet.addEventListener('mouseup', () => {
                    saveDocSelection();
                    syncToolbarStates();
                    broadcastLocalCursorPosition();
                });
                sheet.addEventListener('click', () => {
                    broadcastLocalCursorPosition();
                });
                sheet.addEventListener('paste', (e) => {
                    const clipboardData = e.clipboardData || window.clipboardData;
                    if (!clipboardData) return;

                    // Check if pasting an image file (e.g. screenshot or copied graphic)
                    const items = clipboardData.items;
                    if (items) {
                        for (let i = 0; i < items.length; i++) {
                            if (items[i].type.indexOf('image') !== -1) {
                                const blob = items[i].getAsFile();
                                if (blob) {
                                    e.preventDefault();
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        const dataUrl = event.target.result;
                                        const imgHtml = `
                                            <div class="doc-pasted-image" style="margin: 1rem 0; text-align: center;">
                                                <img src="${dataUrl}" alt="Pasted Image" style="max-width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
                                            </div><p><br></p>
                                        `;
                                        if (window.pdfEngine && window.pdfEngine.captureManager) {
                                            window.pdfEngine.captureManager.insertHtmlAtCursor(imgHtml, sheet);
                                        } else {
                                            document.execCommand('insertHTML', false, imgHtml);
                                            onDocChange();
                                        }
                                        setTimeout(() => scrollCursorIntoView(120), 40);
                                    };
                                    reader.readAsDataURL(blob);
                                    return;
                                }
                            }
                        }
                    }

                    setTimeout(() => {
                        onDocChange();
                        updateDocStats();
                        scrollCursorIntoView(120);
                        broadcastLocalCursorPosition(true);
                    }, 20);
                });
            }
            document.addEventListener('selectionchange', () => {
                if (isReceivingRemoteEdit) return;
                const sheetEl = document.getElementById('docPageSheet');
                if (!sheetEl) return;
                
                // Only broadcast cursor if user is actively focused on the editor sheet
                if (document.activeElement !== sheetEl && !sheetEl.contains(document.activeElement)) {
                    return;
                }

                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const node = sel.anchorNode;
                    if (node && (sheetEl.contains(node) || sheetEl === node)) {
                        saveDocSelection();
                        syncToolbarStates();
                        broadcastLocalCursorPosition();
                    }
                }
            });

            // Prevent toolbar buttons from stealing focus / collapsing selection on mousedown
            const toolbar = document.querySelector('.doc-toolbar');
            if (toolbar) {
                toolbar.addEventListener('mousedown', (e) => {
                    if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
                        e.preventDefault();
                    }
                });
            }
        });

        // Close dashboard dropdown menus and popovers on outside click
        document.addEventListener('click', (e) => {
            const notifMenu = document.getElementById('notificationsMenu');
            const notifBtn = e.target.closest('button[onclick*="toggleNotificationsMenu"]');
            if (notifMenu && !notifMenu.classList.contains('hidden') && !notifMenu.contains(e.target) && !notifBtn) {
                notifMenu.classList.add('hidden');
            }

            const wsMenu = document.getElementById('workspaceMenu');
            const wsBtn = e.target.closest('button[onclick*="toggleWorkspaceMenu"]');
            if (wsMenu && !wsMenu.classList.contains('hidden') && !wsMenu.contains(e.target) && !wsBtn) {
                wsMenu.classList.add('hidden');
            }
        });
        // =========================================================================
        // TEMPLATES & BLUEPRINT GALLERY JS ENGINE