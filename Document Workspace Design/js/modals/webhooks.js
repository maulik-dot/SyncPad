        // =========================================================================
        async function openWebhooksModal() {
            const modal = document.getElementById('webhooksModal');
            if (!modal) return;
            const targetWs = activeWorkspace || (userWorkspaces && userWorkspaces[0]) || null;
            if (!targetWs) {
                toast('Please select a workspace to manage webhooks');
                return;
            }
            modal.classList.remove('hidden');
            const titleEl = document.getElementById('webhooksModalWsTitle');
            if (titleEl) {
                titleEl.innerHTML = `<i data-lucide="webhook" style="width: 20px; height: 20px; color: #10b981;"></i><span>Webhooks: ${escapeHtml(targetWs.name)}</span>`;
            }
            await loadWorkspaceWebhooks();
            refreshIcons();
        }

        function closeWebhooksModal() {
            const modal = document.getElementById('webhooksModal');
            if (modal) modal.classList.add('hidden');
        }

        async function loadWorkspaceWebhooks() {
            const listEl = document.getElementById('webhooksList');
            if (!listEl) return;
            const targetWs = activeWorkspace || (userWorkspaces && userWorkspaces[0]);
            if (!targetWs) return;
            listEl.innerHTML = '<div style="text-align: center; padding: 1.25rem; color: var(--text-muted); font-size: 0.78rem;">Loading webhooks...</div>';

            try {
                const res = await fetch(`/workspaces/${targetWs.id}/webhooks`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) throw new Error('Failed to load webhooks');
                const hooks = await res.json();
                renderWorkspaceWebhooks(hooks);
            } catch (err) {
                listEl.innerHTML = `<div style="text-align: center; padding: 1.25rem; color: var(--text-muted); font-size: 0.78rem;">${escapeHtml(err.message)}</div>`;
            }
        }

        function renderWorkspaceWebhooks(hooks) {
            const listEl = document.getElementById('webhooksList');
            if (!listEl) return;
            if (!hooks || hooks.length === 0) {
                listEl.innerHTML = '<div style="text-align: center; padding: 1.25rem; color: var(--text-muted); font-size: 0.78rem;">No active webhooks configured for this workspace.</div>';
                return;
            }

            listEl.innerHTML = hooks.map(h => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-hover);">
                    <div style="min-width: 0; flex: 1; margin-right: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                            <strong style="font-size: 0.84rem; color: var(--text-primary);">${escapeHtml(h.name)}</strong>
                            <span class="badge" style="font-size: 0.65rem; background: rgba(16, 185, 129, 0.1); color: #10b981;">Active</span>
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(h.url)}</div>
                        <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.2rem;">Events: <code style="font-size: 0.68rem;">${escapeHtml(h.events || '*')}</code></div>
                    </div>
                    <div style="display: flex; gap: 0.35rem; flex-shrink: 0;">
                        <button class="btn btn-outline btn-sm" onclick="testWebhook(${h.id})" style="font-size: 0.72rem; padding: 0.25rem 0.5rem;">
                            <i data-lucide="send" style="width: 12px; height: 12px;"></i>
                            <span>Test</span>
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="deleteWebhook(${h.id})" style="font-size: 0.72rem; padding: 0.25rem 0.5rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            refreshIcons();
        }

        async function submitCreateWebhook() {
            const targetWs = activeWorkspace || (userWorkspaces && userWorkspaces[0]);
            if (!targetWs) return;

            const nameInput = document.getElementById('webhookNameInput');
            const urlInput = document.getElementById('webhookUrlInput');
            const secretInput = document.getElementById('webhookSecretInput');
            const eventsInput = document.getElementById('webhookEventsInput');

            const name = nameInput ? nameInput.value.trim() : '';
            const url = urlInput ? urlInput.value.trim() : '';
            const secret = secretInput ? secretInput.value.trim() : '';
            const events = eventsInput ? eventsInput.value.trim() : '*';

            if (!name || !url) {
                toast('Please provide webhook name and destination URL');
                return;
            }

            try {
                const res = await fetch(`/workspaces/${targetWs.id}/webhooks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ name, url, secret: secret || null, events: events || '*' })
                });

                if (res.ok) {
                    toast('✅ Webhook registered successfully!');
                    if (nameInput) nameInput.value = '';
                    if (urlInput) urlInput.value = '';
                    if (secretInput) secretInput.value = '';
                    await loadWorkspaceWebhooks();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to register webhook', 'error');
                }
            } catch (e) {
                toast('Network error registering webhook', 'error');
            }
        }

        async function testWebhook(webhookId) {
            const targetWs = activeWorkspace || (userWorkspaces && userWorkspaces[0]);
            if (!targetWs) return;
            try {
                toast('📡 Dispatching test webhook ping...');
                const res = await fetch(`/workspaces/${targetWs.id}/webhooks/${webhookId}/test`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    toast('✅ Test webhook ping dispatched!');
                } else {
                    toast('Failed to dispatch test ping', 'error');
                }
            } catch (e) {
                toast('Error sending test ping', 'error');
            }
        }

        async function deleteWebhook(webhookId) {
            const targetWs = activeWorkspace || (userWorkspaces && userWorkspaces[0]);
            if (!targetWs) return;
            if (!confirm('Are you sure you want to delete this webhook endpoint?')) return;

            try {
                const res = await fetch(`/workspaces/${targetWs.id}/webhooks/${webhookId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    toast('Webhook removed');
                    await loadWorkspaceWebhooks();
                } else {
                    toast('Failed to delete webhook', 'error');
                }
            } catch (e) {
                toast('Error deleting webhook', 'error');
            }
        }

        // =========================================================================
        // LOCAL-FIRST OFFLINE EDITING & RECONNECT SYNC (INDEXEDDB)