        // =========================================================================
        // TRASH SCREEN ADVANCED LOGIC & STATE
        // =========================================================================
        let rawTrashDocuments = [];
        let currentTrashFilter = 'all'; // 'all' | 'DOC' | 'WHITEBOARD'
        let currentTrashSort = 'recent'; // 'recent' | 'oldest' | 'expiring' | 'title'
        let currentTrashSearch = '';
        let currentTrashViewMode = 'grid'; // 'grid' | 'list'
        let selectedTrashIds = new Set();

        async function showTrashView(el) {
            if (el) {
                document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
            }
            activeFolder = null;
            previousView = 'trash';
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');
            document.getElementById('homeView').classList.add('hidden');
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('folderView').classList.add('hidden');
            document.getElementById('editorView').classList.add('hidden');
            document.getElementById('whiteboardView').classList.add('hidden');
            document.getElementById('notificationsView').classList.add('hidden');
            document.getElementById('sharedWithMeView').classList.add('hidden');
            const sv5 = document.getElementById('starredView'); if (sv5) sv5.classList.add('hidden');
            const tv = document.getElementById('trashView');
            if (tv) tv.classList.remove('hidden');

            selectedTrashIds.clear();
            updateTrashBatchBar();
            await loadAndRenderTrash();
            refreshIcons();
        }

        async function loadAndRenderTrash() {
            const grid = document.getElementById('trashDocumentsGrid');
            const tableContainer = document.getElementById('trashDocumentsTableContainer');
            const badge = document.getElementById('trashTotalBadge');
            const emptyTrashBtn = document.getElementById('emptyTrashBtn');
            const restoreAllBtn = document.getElementById('trashRestoreAllBtn');

            if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);"><i data-lucide="loader-2" class="spin" style="width:24px;height:24px;margin-bottom:0.5rem;"></i><p style="font-size:0.85rem;">Loading trash items...</p></div>';
            refreshIcons();

            try {
                const res = await fetchWithAuth('/documents/trash');
                if (!res.ok) {
                    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--danger);">Failed to load trash</div>';
                    return;
                }
                rawTrashDocuments = await res.json() || [];

                // Update total badge and header buttons
                if (badge) badge.innerText = `${rawTrashDocuments.length} item${rawTrashDocuments.length === 1 ? '' : 's'}`;
                if (emptyTrashBtn) emptyTrashBtn.style.display = rawTrashDocuments.length > 0 ? 'inline-flex' : 'none';
                if (restoreAllBtn) restoreAllBtn.style.display = rawTrashDocuments.length > 0 ? 'inline-flex' : 'none';

                // Update tab counters
                const docCount = rawTrashDocuments.filter(d => d.fileType === 'DOC').length;
                const boardCount = rawTrashDocuments.filter(d => d.fileType === 'WHITEBOARD').length;
                const countAll = document.getElementById('trashCountAll');
                const countDoc = document.getElementById('trashCountDoc');
                const countBoard = document.getElementById('trashCountBoard');
                if (countAll) countAll.innerText = rawTrashDocuments.length;
                if (countDoc) countDoc.innerText = docCount;
                if (countBoard) countBoard.innerText = boardCount;

                // Validate selection against fresh data
                const existingIds = new Set(rawTrashDocuments.map(d => d.id));
                for (let id of selectedTrashIds) {
                    if (!existingIds.has(id)) selectedTrashIds.delete(id);
                }
                updateTrashBatchBar();

                renderFilteredTrash();
            } catch (err) {
                console.error('Error loading trash:', err);
                if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--danger);">Error loading trash</div>';
            }
        }

        function getFilteredTrashDocuments() {
            let list = [...rawTrashDocuments];

            // 1. Filter by type
            if (currentTrashFilter !== 'all') {
                list = list.filter(d => d.fileType === currentTrashFilter);
            }

            // 2. Filter by search query
            if (currentTrashSearch) {
                const q = currentTrashSearch.toLowerCase().trim();
                list = list.filter(d =>
                    (d.title && d.title.toLowerCase().includes(q)) ||
                    (d.content && d.content.toLowerCase().includes(q)) ||
                    (d.workspaceName && d.workspaceName.toLowerCase().includes(q))
                );
            }

            // 3. Sort
            list.sort((a, b) => {
                const dateA = a.trashedAt ? new Date(a.trashedAt).getTime() : 0;
                const dateB = b.trashedAt ? new Date(b.trashedAt).getTime() : 0;

                if (currentTrashSort === 'recent') {
                    return dateB - dateA;
                } else if (currentTrashSort === 'oldest') {
                    return dateA - dateB;
                } else if (currentTrashSort === 'expiring') {
                    // Soonest to be purged (oldest trashed date first)
                    return dateA - dateB;
                } else if (currentTrashSort === 'title') {
                    return (a.title || '').localeCompare(b.title || '');
                }
                return 0;
            });

            return list;
        }

        function renderFilteredTrash() {
            const items = getFilteredTrashDocuments();
            const grid = document.getElementById('trashDocumentsGrid');
            const tableContainer = document.getElementById('trashDocumentsTableContainer');
            const tableBody = document.getElementById('trashDocumentsTableBody');
            const toolbar = document.getElementById('trashToolbar');

            if (rawTrashDocuments.length === 0) {
                if (toolbar) toolbar.style.display = 'none';
                if (tableContainer) tableContainer.style.display = 'none';
                if (grid) {
                    grid.style.display = 'grid';
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; padding: 4rem 2rem; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
                            <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(239, 68, 68, 0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: #ef4444;">
                                <i data-lucide="trash-2" style="width: 28px; height: 28px;"></i>
                            </div>
                            <h3 style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary); margin-bottom: 0.35rem;">Trash is Empty</h3>
                            <p style="font-size: 0.85rem; max-width: 380px; margin: 0 auto 1.5rem; color: var(--text-secondary); line-height: 1.5;">
                                Items deleted from your workspaces and folders will be kept here for 30 days before being permanently removed.
                            </p>
                            <button onclick="showHomeView(document.querySelector('.sidebar-item'))" class="btn btn-primary" style="font-size: 0.82rem; padding: 0.45rem 1rem;">
                                <i data-lucide="home" style="width: 14px; height: 14px; margin-right: 0.35rem;"></i>
                                Return to Dashboard
                            </button>
                        </div>`;
                }
                refreshIcons();
                return;
            }

            if (toolbar) toolbar.style.display = 'flex';

            if (items.length === 0) {
                if (tableContainer) tableContainer.style.display = 'none';
                if (grid) {
                    grid.style.display = 'grid';
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                            <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; color: var(--text-muted);">
                                <i data-lucide="search" style="width: 22px; height: 22px;"></i>
                            </div>
                            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">No matching items found</h4>
                            <p style="font-size: 0.8rem; margin: 0 0 1rem;">No trashed items match the filter '${escapeHtml(currentTrashSearch)}'</p>
                            <button onclick="clearTrashSearch()" class="btn btn-outline" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;">
                                Clear Filters
                            </button>
                        </div>`;
                }
                refreshIcons();
                return;
            }

            // Sync select all checkboxes
            const allSelected = items.length > 0 && items.every(d => selectedTrashIds.has(d.id));
            const selectAllCheck = document.getElementById('trashSelectAllCheckbox');
            const tableHeaderCheck = document.getElementById('trashTableHeaderCheckbox');
            if (selectAllCheck) selectAllCheck.checked = allSelected;
            if (tableHeaderCheck) tableHeaderCheck.checked = allSelected;

            if (currentTrashViewMode === 'grid') {
                if (tableContainer) tableContainer.style.display = 'none';
                if (grid) {
                    grid.style.display = 'grid';
                    grid.innerHTML = '';
                    items.forEach(doc => {
                        grid.appendChild(createTrashCard(doc));
                    });
                }
            } else {
                if (grid) grid.style.display = 'none';
                if (tableContainer && tableBody) {
                    tableContainer.style.display = 'block';
                    tableBody.innerHTML = '';
                    items.forEach(doc => {
                        tableBody.appendChild(createTrashTableRow(doc));
                    });
                }
            }

            refreshIcons();
        }

        function calculateDaysRemaining(trashedAt) {
            if (!trashedAt) return { days: 30, text: '30 days left', status: 'safe' };
            const trashedDate = new Date(trashedAt);
            const now = new Date();
            const daysPassed = Math.floor((now - trashedDate) / (1000 * 60 * 60 * 24));
            const daysRemaining = Math.max(0, 30 - daysPassed);
            let status = 'safe';
            if (daysRemaining <= 5) status = 'urgent';
            else if (daysRemaining <= 14) status = 'warning';

            return {
                days: daysRemaining,
                text: daysRemaining === 0 ? 'Purging soon' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`,
                status
            };
        }

        function createTrashCard(doc) {
            const card = document.createElement('div');
            card.className = 'card card-hover';
            card.style.padding = '1.2rem';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.position = 'relative';
            card.style.border = selectedTrashIds.has(doc.id) ? '1.5px solid var(--primary)' : '1px solid var(--border-color)';
            card.style.background = selectedTrashIds.has(doc.id) ? 'rgba(37, 99, 235, 0.03)' : 'var(--bg-card)';

            const isBoard = doc.fileType === 'WHITEBOARD';
            const icon = isBoard ? 'presentation' : 'file-text';
            const iconBg = isBoard ? 'rgba(168, 85, 247, 0.1)' : 'rgba(37, 99, 235, 0.1)';
            const iconColor = isBoard ? '#a855f7' : 'var(--primary)';
            const typeLabel = isBoard ? 'Whiteboard' : 'Document';

            const remaining = calculateDaysRemaining(doc.trashedAt);
            let badgeBg = 'rgba(100, 116, 139, 0.1)';
            let badgeColor = 'var(--text-muted)';
            let badgeIcon = 'clock';
            if (remaining.status === 'urgent') {
                badgeBg = 'rgba(239, 68, 68, 0.12)';
                badgeColor = '#ef4444';
                badgeIcon = 'alert-triangle';
            } else if (remaining.status === 'warning') {
                badgeBg = 'rgba(245, 158, 11, 0.12)';
                badgeColor = '#f59e0b';
                badgeIcon = 'clock';
            }

            const trashedDateStr = doc.trashedAt ? new Date(doc.trashedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';
            const originLocation = doc.workspaceName ? `Workspace: ${doc.workspaceName}` : 'Personal Workspace';
            const isChecked = selectedTrashIds.has(doc.id);

            card.innerHTML = `
                <div>
                    <!-- Top Row: Checkbox, Type Badge & Retention Pill -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <input type="checkbox" onchange="toggleTrashItemSelect(${doc.id}, this.checked)" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                            <span style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: ${iconColor}; background: ${iconBg}; padding: 0.15rem 0.45rem; border-radius: var(--radius-sm);">
                                ${typeLabel}
                            </span>
                        </div>
                        <span style="font-size: 0.7rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; background: ${badgeBg}; color: ${badgeColor}; padding: 0.2rem 0.5rem; border-radius: 9999px;">
                            <i data-lucide="${badgeIcon}" style="width: 11px; height: 11px;"></i>
                            ${remaining.text}
                        </span>
                    </div>

                    <!-- Title & Icon -->
                    <div style="display: flex; align-items: flex-start; gap: 0.65rem; margin-bottom: 0.65rem;">
                        <div style="width: 32px; height: 32px; border-radius: var(--radius-sm); background: ${iconBg}; display: flex; align-items: center; justify-content: center; color: ${iconColor}; flex-shrink: 0; margin-top: 2px;">
                            <i data-lucide="${icon}" style="width: 16px; height: 16px;"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h3 style="font-size: 0.96rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.15rem;" title="${escapeHtml(doc.title || 'Untitled')}">
                                ${escapeHtml(doc.title || 'Untitled Document')}
                            </h3>
                            <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.74rem; color: var(--text-muted);">
                                <i data-lucide="folder" style="width: 11px; height: 11px;"></i>
                                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(originLocation)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Trashed Timestamp -->
                    <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444;"></i>
                        <span>Trashed on ${trashedDateStr}</span>
                    </div>
                </div>

                <!-- Action Footer -->
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: 0.5rem;">
                    <button onclick="restoreTrashedDoc(${doc.id})" class="btn btn-outline" style="font-size: 0.76rem; padding: 0.35rem 0.65rem; border-color: rgba(34, 197, 94, 0.4); color: #16a34a;" title="Restore back to active documents">
                        <i data-lucide="rotate-ccw" style="width: 12px; height: 12px; margin-right: 0.25rem;"></i>
                        Restore
                    </button>
                    <button onclick="confirmSingleDeleteDoc(${doc.id}, '${escapeQuotes(doc.title || 'Untitled Document')}')" class="btn btn-outline" style="font-size: 0.76rem; padding: 0.35rem 0.65rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" title="Permanently delete from database">
                        <i data-lucide="trash-2" style="width: 12px; height: 12px; margin-right: 0.25rem;"></i>
                        Delete Forever
                    </button>
                </div>
            `;
            return card;
        }

        function createTrashTableRow(doc) {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.style.transition = 'background 0.15s ease';
            if (selectedTrashIds.has(doc.id)) {
                tr.style.background = 'rgba(37, 99, 235, 0.04)';
            }

            const isBoard = doc.fileType === 'WHITEBOARD';
            const icon = isBoard ? 'presentation' : 'file-text';
            const iconColor = isBoard ? '#a855f7' : 'var(--primary)';
            const typeLabel = isBoard ? 'Whiteboard' : 'Document';
            const remaining = calculateDaysRemaining(doc.trashedAt);
            const trashedDateStr = doc.trashedAt ? new Date(doc.trashedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
            const originLocation = doc.workspaceName || 'Personal';

            let badgeBg = 'rgba(100, 116, 139, 0.1)';
            let badgeColor = 'var(--text-muted)';
            if (remaining.status === 'urgent') {
                badgeBg = 'rgba(239, 68, 68, 0.12)';
                badgeColor = '#ef4444';
            } else if (remaining.status === 'warning') {
                badgeBg = 'rgba(245, 158, 11, 0.12)';
                badgeColor = '#f59e0b';
            }

            tr.innerHTML = `
                <td style="padding: 0.75rem 1rem; text-align: center;">
                    <input type="checkbox" onchange="toggleTrashItemSelect(${doc.id}, this.checked)" ${selectedTrashIds.has(doc.id) ? 'checked' : ''} style="cursor: pointer;">
                </td>
                <td style="padding: 0.75rem 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <i data-lucide="${icon}" style="width: 16px; height: 16px; color: ${iconColor}; flex-shrink: 0;"></i>
                        <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(doc.title || 'Untitled Document')}</span>
                    </div>
                </td>
                <td style="padding: 0.75rem 1rem; color: var(--text-secondary); font-size: 0.8rem;">
                    ${typeLabel}
                </td>
                <td style="padding: 0.75rem 1rem; color: var(--text-secondary); font-size: 0.8rem;">
                    ${escapeHtml(originLocation)}
                </td>
                <td style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.8rem;">
                    ${trashedDateStr}
                </td>
                <td style="padding: 0.75rem 1rem;">
                    <span style="font-size: 0.72rem; font-weight: 600; background: ${badgeBg}; color: ${badgeColor}; padding: 0.18rem 0.5rem; border-radius: 9999px;">
                        ${remaining.text}
                    </span>
                </td>
                <td style="padding: 0.75rem 1rem; text-align: right;">
                    <div style="display: inline-flex; gap: 0.35rem;">
                        <button onclick="restoreTrashedDoc(${doc.id})" class="btn btn-icon" style="width: 28px; height: 28px; color: #16a34a;" title="Restore document">
                            <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button onclick="confirmSingleDeleteDoc(${doc.id}, '${escapeQuotes(doc.title || 'Untitled Document')}')" class="btn btn-icon" style="width: 28px; height: 28px; color: var(--danger);" title="Permanently delete">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                </td>
            `;
            return tr;
        }

        function onTrashSearchInput() {
            const input = document.getElementById('trashSearchInput');
            const clearBtn = document.getElementById('trashSearchClearBtn');
            currentTrashSearch = input ? input.value : '';
            if (clearBtn) clearBtn.style.display = currentTrashSearch ? 'block' : 'none';
            renderFilteredTrash();
        }

        function clearTrashSearch() {
            const input = document.getElementById('trashSearchInput');
            const clearBtn = document.getElementById('trashSearchClearBtn');
            if (input) input.value = '';
            currentTrashSearch = '';
            if (clearBtn) clearBtn.style.display = 'none';
            renderFilteredTrash();
        }

        function filterTrashByType(type, el) {
            currentTrashFilter = type;
            document.querySelectorAll('#trashToolbar .tab-item').forEach(b => b.classList.remove('active'));
            if (el) el.classList.add('active');
            renderFilteredTrash();
        }

        function onTrashSortChange() {
            const select = document.getElementById('trashSortSelect');
            if (select) currentTrashSort = select.value;
            renderFilteredTrash();
        }

        function setTrashViewMode(mode) {
            currentTrashViewMode = mode;
            const gridBtn = document.getElementById('trashViewGridBtn');
            const listBtn = document.getElementById('trashViewListBtn');
            if (gridBtn) gridBtn.style.background = mode === 'grid' ? 'var(--bg-hover)' : 'transparent';
            if (listBtn) listBtn.style.background = mode === 'list' ? 'var(--bg-hover)' : 'transparent';
            renderFilteredTrash();
        }

        function toggleTrashItemSelect(docId, checked) {
            if (checked) {
                selectedTrashIds.add(docId);
            } else {
                selectedTrashIds.delete(docId);
            }
            updateTrashBatchBar();
            renderFilteredTrash();
        }

        function toggleTrashSelectAll(checked) {
            const items = getFilteredTrashDocuments();
            if (checked) {
                items.forEach(d => selectedTrashIds.add(d.id));
            } else {
                items.forEach(d => selectedTrashIds.delete(d.id));
            }
            updateTrashBatchBar();
            renderFilteredTrash();
        }

        function clearTrashSelection() {
            selectedTrashIds.clear();
            updateTrashBatchBar();
            renderFilteredTrash();
        }

        function updateTrashBatchBar() {
            const bar = document.getElementById('trashBatchBar');
            const text = document.getElementById('trashSelectedCountText');
            if (!bar) return;

            if (selectedTrashIds.size > 0) {
                bar.style.display = 'flex';
                if (text) text.innerText = `${selectedTrashIds.size} item${selectedTrashIds.size === 1 ? '' : 's'} selected`;
            } else {
                bar.style.display = 'none';
            }
        }

        // CONFIRMATION MODALS LOGIC
        function openTrashConfirmModal({ title, message, confirmText, confirmClass, onConfirm }) {
            const modal = document.getElementById('trashConfirmModal');
            const titleEl = document.getElementById('trashModalTitle');
            const msgEl = document.getElementById('trashModalMessage');
            const confirmBtn = document.getElementById('trashModalConfirmBtn');

            if (!modal) return;

            if (titleEl) titleEl.innerText = title;
            if (msgEl) msgEl.innerText = message;
            if (confirmBtn) {
                confirmBtn.innerText = confirmText || 'Confirm';
                confirmBtn.className = `btn ${confirmClass || 'btn-primary'}`;
                confirmBtn.onclick = () => {
                    closeTrashConfirmModal();
                    if (onConfirm) onConfirm();
                };
            }

            modal.classList.remove('hidden');
            refreshIcons();
        }

        function closeTrashConfirmModal() {
            const modal = document.getElementById('trashConfirmModal');
            if (modal) modal.classList.add('hidden');
        }

        function confirmSingleDeleteDoc(docId, title) {
            openTrashConfirmModal({
                title: 'Delete Permanently?',
                message: `Are you sure you want to permanently delete "${title}"? This cannot be undone and will erase all version snapshots.`,
                confirmText: 'Delete Forever',
                confirmClass: 'btn-danger',
                onConfirm: async () => {
                    await permanentlyDeleteDoc(docId);
                }
            });
        }

        function emptyTrashConfirm() {
            if (rawTrashDocuments.length === 0) return;
            openTrashConfirmModal({
                title: 'Empty Trash?',
                message: `Are you sure you want to empty the trash? All ${rawTrashDocuments.length} document(s) will be permanently purged immediately.`,
                confirmText: 'Empty Trash',
                confirmClass: 'btn-danger',
                onConfirm: async () => {
                    try {
                        const res = await fetchWithAuth('/documents/trash/empty', { method: 'DELETE' });
                        if (res.ok) {
                            const data = await res.json();
                            toast(`Trash emptied (${data.count || 0} item(s) purged)`);
                            selectedTrashIds.clear();
                            await loadAndRenderTrash();
                            await loadWorkspaceContents();
                    try { await loadUserWorkspaces(); } catch(e) {}
                    renderDashboardGrids();
                    renderHomeScreen();
                        } else {
                            toast('Failed to empty trash');
                        }
                    } catch (e) {
                        toast('Error emptying trash');
                    }
                }
            });
        }

        function restoreAllTrashConfirm() {
            if (rawTrashDocuments.length === 0) return;
            openTrashConfirmModal({
                title: 'Restore All Items?',
                message: `Restore all ${rawTrashDocuments.length} document(s) in trash back to their original workspaces?`,
                confirmText: 'Restore All',
                confirmClass: 'btn-primary',
                onConfirm: async () => {
                    const ids = rawTrashDocuments.map(d => d.id);
                    try {
                        const res = await fetchWithAuth('/documents/trash/restore-bulk', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ documentIds: ids })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            toast(`Restored ${data.count || ids.length} document(s) successfully`);
                            selectedTrashIds.clear();
                            await loadAndRenderTrash();
                            await loadWorkspaceContents();
                    try { await loadUserWorkspaces(); } catch(e) {}
                    renderDashboardGrids();
                    renderHomeScreen();
                        } else {
                            toast('Failed to restore all items');
                        }
                    } catch (e) {
                        toast('Error restoring items');
                    }
                }
            });
        }

        function restoreSelectedTrashConfirm() {
            if (selectedTrashIds.size === 0) return;
            const ids = Array.from(selectedTrashIds);
            (async () => {
                try {
                    const res = await fetchWithAuth('/documents/trash/restore-bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ documentIds: ids })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        toast(`Restored ${data.count || ids.length} selected document(s)`);
                        selectedTrashIds.clear();
                        await loadAndRenderTrash();
                        await loadWorkspaceContents();
                    try { await loadUserWorkspaces(); } catch(e) {}
                    renderDashboardGrids();
                    renderHomeScreen();
                    } else {
                        toast('Failed to restore selected documents');
                    }
                } catch (e) {
                    toast('Error restoring selected documents');
                }
            })();
        }

        function deleteSelectedTrashConfirm() {
            if (selectedTrashIds.size === 0) return;
            const ids = Array.from(selectedTrashIds);
            openTrashConfirmModal({
                title: 'Delete Selected Items?',
                message: `Permanently delete ${ids.length} selected document(s)? This action cannot be reversed.`,
                confirmText: 'Delete Selected',
                confirmClass: 'btn-danger',
                onConfirm: async () => {
                    try {
                        const res = await fetchWithAuth('/documents/trash/delete-bulk', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ documentIds: ids })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            toast(`Permanently deleted ${data.count || ids.length} item(s)`);
                            selectedTrashIds.clear();
                            await loadAndRenderTrash();
                        } else {
                            toast('Failed to delete selected items');
                        }
                    } catch (e) {
                        toast('Error deleting selected items');
                    }
                }
            });
        }

        async function restoreTrashedDoc(docId) {
            try {
                const res = await fetchWithAuth(`/documents/${docId}/restore-trash`, { method: 'POST' });
                if (res.ok) {
                    toast('Document restored successfully');
                    selectedTrashIds.delete(docId);
                    await loadAndRenderTrash();
                    await loadWorkspaceContents();
                    try { await loadUserWorkspaces(); } catch(e) {}
                    renderDashboardGrids();
                    renderHomeScreen();
                } else {
                    toast('Failed to restore document');
                }
            } catch (e) {
                toast('Error restoring document');
            }
        }

        async function permanentlyDeleteDoc(docId) {
            try {
                const res = await fetchWithAuth(`/documents/${docId}/permanent`, { method: 'DELETE' });
                if (res.ok) {
                    toast('Document permanently deleted');
                    selectedTrashIds.delete(docId);
                    await loadAndRenderTrash();
                } else {
                    toast('Failed to delete document');
                }
            } catch (e) {
                toast('Error deleting document');
            }
        }

        function escapeQuotes(str) {
            return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        }

        window.showTrashView = showTrashView;

