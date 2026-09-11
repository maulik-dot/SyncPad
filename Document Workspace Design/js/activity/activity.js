        // =========================================================================
        let currentActivityScope = 'document';
        let currentActivityPage = 0;
        let totalActivityPages = 1;

        function toggleActivitySidebar() {
            const sidebar = document.getElementById('activitySidebar');
            if (!sidebar) return;
            sidebar.classList.toggle('hidden');
            if (!sidebar.classList.contains('hidden')) {
                const comments = document.getElementById('commentsSidebar');
                if (comments && !comments.classList.contains('hidden')) comments.classList.add('hidden');
                const history = document.getElementById('historyPanel');
                if (history && !history.classList.contains('hidden')) history.classList.add('hidden');
                currentActivityPage = 0;
                loadActivityData();
            }
            refreshIcons();
        }

        function switchActivityScope(scope) {
            currentActivityScope = scope;
            currentActivityPage = 0;
            const docBtn = document.getElementById('activityScopeDoc');
            const wsBtn = document.getElementById('activityScopeWs');
            if (docBtn && wsBtn) {
                if (scope === 'document') {
                    docBtn.classList.add('active');
                    wsBtn.classList.remove('active');
                } else {
                    wsBtn.classList.add('active');
                    docBtn.classList.remove('active');
                }
            }
            loadActivityData();
        }

        async function loadActivityData() {
            const container = document.getElementById('activityLogsContainer');
            if (!container || !token) return;

            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;"><i data-lucide="loader-2" class="spin" style="width: 20px; height: 20px;"></i></div>`;
            refreshIcons();

            let url = '';
            if (currentActivityScope === 'document') {
                if (!currentDoc || !currentDoc.id) {
                    container.innerHTML = `
                        <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
                            <i data-lucide="file-text" style="width: 32px; height: 32px; opacity: 0.5; margin-bottom: 0.5rem;"></i>
                            <div style="font-size: 0.85rem; font-weight: 600;">No active document</div>
                            <div style="font-size: 0.75rem; margin-top: 0.25rem;">Open a document to see its audit trail.</div>
                        </div>`;
                    refreshIcons();
                    return;
                }
                url = `/documents/${currentDoc.id}/activity?page=${currentActivityPage}&size=20`;
            } else {
                const wsId = activeWorkspace && activeWorkspace.id;
                if (!wsId) {
                    container.innerHTML = `
                        <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
                            <i data-lucide="briefcase" style="width: 32px; height: 32px; opacity: 0.5; margin-bottom: 0.5rem;"></i>
                            <div style="font-size: 0.85rem; font-weight: 600;">No active workspace</div>
                            <div style="font-size: 0.75rem; margin-top: 0.25rem;">Select a workspace to view timeline events.</div>
                        </div>`;
                    refreshIcons();
                    return;
                }
                url = `/workspaces/${wsId}/activity?page=${currentActivityPage}&size=20`;
            }

            try {
                const res = await fetch(url, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) throw new Error('Failed to load activity logs');
                const data = await res.json();
                const logs = data.content || [];
                totalActivityPages = data.totalPages || 1;

                const pageInfo = document.getElementById('activityPageInfo');
                if (pageInfo) pageInfo.textContent = `Page ${currentActivityPage + 1} of ${Math.max(1, totalActivityPages)}`;

                const prevBtn = document.getElementById('activityPrevBtn');
                const nextBtn = document.getElementById('activityNextBtn');
                if (prevBtn) prevBtn.disabled = currentActivityPage <= 0;
                if (nextBtn) nextBtn.disabled = currentActivityPage >= totalActivityPages - 1;

                if (logs.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
                            <i data-lucide="activity" style="width: 32px; height: 32px; opacity: 0.5; margin-bottom: 0.5rem;"></i>
                            <div style="font-size: 0.85rem; font-weight: 600;">No activity recorded yet</div>
                            <div style="font-size: 0.75rem; margin-top: 0.25rem;">Actions like document edits, comments, invites, and trash changes will appear here.</div>
                        </div>`;
                    refreshIcons();
                    return;
                }

                container.innerHTML = logs.map(l => {
                    const actionIcon = getActivityActionIcon(l.action);
                    const timeAgo = formatTimeAgo(new Date(l.createdAt));
                    return `
                        <div class="card" style="padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-surface); font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.35rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 0.4rem;">
                                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--bg-surface-hover); color: var(--accent-primary);">
                                        <i data-lucide="${actionIcon}" style="width: 13px; height: 13px;"></i>
                                    </span>
                                    <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(l.userName || 'System')}</span>
                                </div>
                                <span style="font-size: 0.72rem; color: var(--text-muted);">${timeAgo}</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-left: 1.8rem;">
                                ${escapeHtml(l.details || l.action)}
                            </div>
                        </div>`;
                }).join('');
                refreshIcons();
            } catch (err) {
                console.error('Error loading activity:', err);
                container.innerHTML = `<div style="text-align: center; color: var(--text-danger); padding: 1.5rem; font-size: 0.82rem;">Failed to load activity timeline.</div>`;
            }
        }

        function getActivityActionIcon(action) {
            if (!action) return 'activity';
            if (action.includes('COMMENT')) return 'message-square';
            if (action.includes('MEMBER') || action.includes('INVITE')) return 'user-plus';
            if (action.includes('WORKSPACE')) return 'briefcase';
            if (action.includes('TRASH') || action.includes('PURGE')) return 'trash-2';
            if (action.includes('RESTORE')) return 'rotate-ccw';
            if (action.includes('STAR')) return 'star';
            if (action.includes('TAG')) return 'tag';
            if (action.includes('SHARE')) return 'share-2';
            if (action.includes('RENAME')) return 'edit-2';
            return 'file-text';
        }

        function changeActivityPage(delta) {
            const next = currentActivityPage + delta;
            if (next >= 0 && next < totalActivityPages) {
                currentActivityPage = next;
                loadActivityData();
            }
        }

        // Version History Engine
        function toggleHistoryPanel() {
            const panel = document.getElementById('historyPanel');
            if (!panel) return;
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden') && currentDoc && currentDoc.id) {
                loadDocVersions(currentDoc.id);
            }
            refreshIcons();
        }

        async function loadDocVersions(docId) {
            if (!docId || !token) return;
            const list = document.getElementById('docVersionList');
            if (!list) return;

            list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;"><i data-lucide="loader-2" class="spin" style="width: 20px; height: 20px;"></i></div>`;
            refreshIcons();

            try {
                const res = await fetch(`/documents/${docId}/versions`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const versions = await res.json();
                    if (versions.length === 0) {
                        list.innerHTML = `
                            <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
                                <i data-lucide="history" style="width: 32px; height: 32px; opacity: 0.5; margin-bottom: 0.5rem;"></i>
                                <div style="font-size: 0.85rem; font-weight: 600;">No past revisions yet</div>
                                <div style="font-size: 0.75rem; margin-top: 0.25rem;">Revisions are automatically created on cloud saves.</div>
                            </div>
                        `;
                        refreshIcons();
                        return;
                    }

                    list.innerHTML = versions.map((v, idx) => {
                        const isCurrent = idx === 0;
                        const author = v.editedByName || v.editedByEmail || 'You';
                        const time = v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        const date = v.createdAt ? new Date(v.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today';
                        const wordCount = v.content ? v.content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(w => w.length > 0).length : 0;

                        return `
                            <div class="card" style="padding: 0.85rem; border: 1px solid ${isCurrent ? 'var(--accent-primary)' : 'var(--border-color)'}; background: ${isCurrent ? 'rgba(37,99,235,0.03)' : 'var(--bg-surface)'};">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                                        <span class="badge ${isCurrent ? 'badge-primary' : 'badge-doc'}" style="font-size: 0.7rem; font-weight: 700;">v${v.versionNumber}</span>
                                        <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(v.title || 'Untitled')}</span>
                                    </div>
                                    <span style="font-size: 0.7rem; color: var(--text-muted);">${date} ${time}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.4rem;">
                                    <span>Edited by ${escapeHtml(author)} • ${wordCount} words</span>
                                    ${!isCurrent ? `
                                        <button class="btn btn-outline btn-sm" onclick="restoreDocVersion(${v.versionNumber})" style="font-size: 0.72rem; padding: 0.2rem 0.55rem; height: 24px; gap: 0.3rem;">
                                            <i data-lucide="rotate-ccw" style="width: 12px; height: 12px;"></i>
                                            <span>Restore</span>
                                        </button>
                                    ` : `
                                        <span class="badge" style="background: rgba(16,185,129,0.12); color: var(--success); font-size: 0.68rem;">Current</span>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('');
                    refreshIcons();
                }
            } catch (e) {
                list.innerHTML = `<div style="color: var(--danger); font-size: 0.8rem; text-align: center;">Failed to load version history</div>`;
            }
        }

        async function restoreDocVersion(versionNum) {
            if (!currentDoc || !currentDoc.id || !token) return;
            try {
                const res = await fetch(`/documents/${currentDoc.id}/restore/${versionNum}`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const restored = await res.json();
                    currentDoc.title = restored.title;
                    currentDoc.content = restored.content;
                    
                    const titleInput = document.getElementById('docTitleInput');
                    const sheet = document.getElementById('docPageSheet');
                    if (titleInput) titleInput.value = restored.title || 'Untitled';
                    if (sheet) {
                        sheet.innerHTML = restored.content || '';
                        if (window.latexEngine) window.latexEngine.initAllCards(sheet);
                        if (typeof normalizeDocChecklists === 'function') normalizeDocChecklists(sheet);
                        refreshIcons();
                        updateDocStats();
                        if (typeof updateDocOutline === 'function') updateDocOutline();
                    }
                    syncDocumentInLists(currentDoc.id, restored.title, restored.content);
                    broadcastDocumentEdit(restored.content, restored.title);
                    
                    await loadDocVersions(currentDoc.id);
                    toggleHistoryPanel();
                    toast(`Restored version ${versionNum} successfully!`);
                } else {
                    toast('Failed to restore version');
                }
            } catch (e) {
                toast('Error restoring version');
            }
        }

        // Document Details & Analytics Modal
async function openDocInfoModal() {
            const modal = document.getElementById('docInfoModal');
            if (modal) modal.classList.remove('hidden');
            refreshIcons();
            
            const loadingEl = document.getElementById('docInfoLoading');
            const errorEl = document.getElementById('docInfoError');
            const contentEl = document.getElementById('docInfoContent');
            
            if (loadingEl) loadingEl.classList.remove('hidden');
            if (errorEl) errorEl.classList.add('hidden');
            if (contentEl) contentEl.classList.add('hidden');
            
            if (!currentDoc || !currentDoc.id || !token) return;
            try {
                const res = await fetch(`/documents/${currentDoc.id}/detail`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (loadingEl) loadingEl.classList.add('hidden');
                if (res.ok) {
                    const data = await res.json();
                    const stats = data.stats || {};
                    
                    const wordsEl = document.getElementById('docInfoWords');
                    const charsEl = document.getElementById('docInfoChars');
                    const readTimeEl = document.getElementById('docInfoReadTime');
                    const paraEl = document.getElementById('docInfoParagraphs');
                    
                    if (wordsEl) wordsEl.textContent = (stats.wordCount || 0).toLocaleString();
                    if (charsEl) charsEl.textContent = (stats.characterCount || 0).toLocaleString();
                    if (readTimeEl) readTimeEl.textContent = `~${stats.readingTimeMinutes || 1} min${(stats.readingTimeMinutes || 1) === 1 ? '' : 's'}`;
                    if (paraEl) paraEl.textContent = (stats.paragraphCount || 1).toLocaleString();
                    
                    const createdByEl = document.getElementById('docInfoCreatedBy');
                    const createdAtEl = document.getElementById('docInfoCreatedAt');
                    const lastEditedEl = document.getElementById('docInfoLastEditedBy');
                    const locEl = document.getElementById('docInfoLocation');
                    const verEl = document.getElementById('docInfoVersion');
                    
                    if (createdByEl) createdByEl.textContent = data.ownerName || data.ownerEmail || 'You';
                    if (createdAtEl) createdAtEl.textContent = data.createdAt ? new Date(data.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Just now';
                    if (lastEditedEl) lastEditedEl.textContent = stats.lastEditedBy || data.ownerName || 'You';
                    if (locEl) locEl.textContent = data.folderName ? `Personal Workspace / ${data.folderName}` : 'Personal Workspace';
                    if (verEl) verEl.textContent = `v${stats.versionCount || data.version || 1} (Synchronized)`;
                    
                    if (errorEl) errorEl.classList.add('hidden');
                    if (contentEl) contentEl.classList.remove('hidden');
                } else {
                    // User doesn't have permission or document not found
                    if (errorEl) {
                        errorEl.textContent = 'Access denied: You do not have permission to view this document details.';
                        errorEl.classList.remove('hidden');
                    }
                }
            } catch (err) {
                console.error('Failed to load document info detail', err);
                if (errorEl) {
                    errorEl.textContent = 'Failed to load document details. Please try again.';
                    errorEl.classList.remove('hidden');
                }
            }
        }

        function closeDocInfoModal() {
            const modal = document.getElementById('docInfoModal');
            if (modal) modal.classList.add('hidden');
        }

        function syncDocumentInLists(id, title, content) {
            if (!id) return;
            const docInList = documentsList.find(d => d.id === id);
            if (docInList) {
                if (title !== undefined && title !== null) docInList.title = title;
                if (content !== undefined && content !== null) docInList.content = content;
                docInList.updatedAt = new Date().toISOString();
            }
            const docInFolder = folderDocumentsList.find(d => d.id === id);
            if (docInFolder) {
                if (title !== undefined && title !== null) docInFolder.title = title;
                if (content !== undefined && content !== null) docInFolder.content = content;
                docInFolder.updatedAt = new Date().toISOString();
            }
            if (document.getElementById('dashboardView') && !document.getElementById('dashboardView').classList.contains('hidden')) {
                renderDashboardGrids();
            }
            if (document.getElementById('homeView') && !document.getElementById('homeView').classList.contains('hidden')) {
                renderHomeScreen();
            }
            if (activeFolder && document.getElementById('folderView') && !document.getElementById('folderView').classList.contains('hidden')) {
                renderFolderFiles();
            }
        }

        let docRenameTimeout = null;
        function onDocTitleChange(newTitle) {
            if (!canEditCurrentDoc()) return;
            const cleanTitle = (newTitle || '').trim() || 'Untitled Document';
            if (currentDoc) currentDoc.title = cleanTitle;
            syncDocumentInLists(currentDoc?.id, cleanTitle);

            const sheet = document.getElementById('docPageSheet');
            const content = sheet ? sheet.innerHTML : '';
            broadcastDocumentEdit(content, cleanTitle);

            if (typeof triggerDocOutlineUpdate === 'function') {
                triggerDocOutlineUpdate(150);
            }

            if (docRenameTimeout) clearTimeout(docRenameTimeout);
            docRenameTimeout = setTimeout(async () => {
                await persistDocRename(cleanTitle);
            }, 500);
        }


        async function onDocTitleBlur(newTitle) {
            if (!canEditCurrentDoc()) return;
            if (docRenameTimeout) {
                clearTimeout(docRenameTimeout);
                docRenameTimeout = null;
            }
            const cleanTitle = (newTitle || '').trim() || 'Untitled Document';
            await persistDocRename(cleanTitle);
        }

        async function persistDocRename(newTitle) {
            if (!canEditCurrentDoc() || !currentDoc || !currentDoc.id || (!token && !currentDoc.shareToken)) return;
            try {
                let res;
                if (token) {
                    res = await fetch(`/documents/${currentDoc.id}/rename`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ title: newTitle })
                    });
                } else if (currentDoc.shareToken) {
                    res = await fetch(`/documents/share/${encodeURIComponent(currentDoc.shareToken)}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ title: newTitle, content: currentDoc.content || '' })
                    });
                }
                if (res && res.ok) {
                    const updated = await res.json();
                    currentDoc.title = updated.title;
                    if (typeof syncDocumentInLists === 'function') {
                        syncDocumentInLists(currentDoc.id, updated.title);
                    }
                }
            } catch (e) {
                console.error('Failed to persist document rename', e);
            }
        }

        let wbRenameTimeout = null;
        function onWhiteboardTitleChange(newTitle) {
            const cleanTitle = (newTitle || '').trim() || 'Untitled Whiteboard';
            if (currentDoc) currentDoc.title = cleanTitle;
            syncDocumentInLists(currentDoc?.id, cleanTitle);

            if (wbRenameTimeout) clearTimeout(wbRenameTimeout);
            wbRenameTimeout = setTimeout(async () => {
                await persistDocRename(cleanTitle);
            }, 500);
        }

        async function onWhiteboardTitleBlur(newTitle) {
            if (wbRenameTimeout) {
                clearTimeout(wbRenameTimeout);
                wbRenameTimeout = null;
            }
            const cleanTitle = (newTitle || '').trim() || 'Untitled Whiteboard';
            await persistDocRename(cleanTitle);
        }

        function getCleanDocContent(sheet) {
            if (!sheet) return '';
            const clone = sheet.cloneNode(true);
            const ghosts = clone.querySelectorAll('[data-ghost="true"], #ghostAutocompleteText');
            ghosts.forEach(g => g.remove());
            return clone.innerHTML;
        }

        let docAutoSaveTimeout = null;
        function onDocChange() {
            if (!canEditCurrentDoc()) return;
            const pill = document.getElementById('docSavePill');
            const text = document.getElementById('docSaveText');
            if (pill) {
                pill.className = 'doc-save-pill saving';
                if (text) text.textContent = 'Saving...';
            }

            const titleInput = document.getElementById('docTitleInput');
            const sheet = document.getElementById('docPageSheet');
            const title = titleInput ? titleInput.value : (currentDoc ? currentDoc.title : 'Untitled Document');
            const content = sheet ? getCleanDocContent(sheet) : '';

            if (currentDoc) {
                currentDoc.title = title;
                currentDoc.content = content;
                syncDocumentInLists(currentDoc.id, title, content);
            }

            // Real-time broadcast to all active collaborators
            broadcastDocumentEdit(content, title);

            if (typeof triggerDocOutlineUpdate === 'function') {
                triggerDocOutlineUpdate(300);
            }

            if (docAutoSaveTimeout) clearTimeout(docAutoSaveTimeout);
            docAutoSaveTimeout = setTimeout(async () => {
                if (!currentDoc || !currentDoc.id || (!token && !currentDoc.shareToken)) {
                    if (pill) {
                        pill.className = 'doc-save-pill saved';
                        if (text) text.textContent = 'Saved just now';
                    }
                    return;
                }
                const titleInput = document.getElementById('docTitleInput');
                const sheet = document.getElementById('docPageSheet');
                const titleVal = titleInput ? titleInput.value.trim() : (currentDoc.title || 'Untitled Document');
                const contentVal = sheet ? sheet.innerHTML : '';

                try {
                    let res;
                    if (token) {
                        res = await fetch(`/documents/${currentDoc.id}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify({ title: titleVal || 'Untitled Document', content: contentVal })
                        });
                    } else if (currentDoc.shareToken) {
                        res = await fetch(`/documents/share/${encodeURIComponent(currentDoc.shareToken)}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ title: titleVal || 'Untitled Document', content: contentVal })
                        });
                    }
                    if (res && res.ok) {
                        const updated = await res.json();
                        currentDoc.title = updated.title;
                        currentDoc.content = updated.content;
                        if (typeof syncDocumentInLists === 'function') {
                            syncDocumentInLists(currentDoc.id, updated.title, updated.content);
                        }

                        if (window.SyncPadOffline) {
                            window.SyncPadOffline.cacheDocument(updated);
                        }
                        if (pill) {
                            pill.className = 'doc-save-pill saved';
                            if (text) text.textContent = 'Saved just now';
                        }
                        const footerStatus = document.getElementById('footerStatusText');
                        if (footerStatus) {
                            const now = new Date();
                            footerStatus.textContent = `Auto-saved at ${now.toLocaleTimeString()}`;
                        }
                    } else {
                        if (pill) {
                            pill.className = 'doc-save-pill';
                            if (text) text.textContent = 'Error saving';
                        }
                    }
                } catch (e) {
                    if (window.SyncPadOffline) {
                        window.SyncPadOffline.saveDocumentOffline(currentDoc.id, titleVal, contentVal);
                    } else {
                        if (pill) {
                            pill.className = 'doc-save-pill';
                            if (text) text.textContent = 'Offline';
                        }
                    }
                }
            }, 600);
        }

        function closeAllDocMenus(exceptId) {
            const ids = [
                'styleDropdownMenu', 
                'fontDropdownMenu', 
                'fontSizeDropdownMenu',
                'textColorPicker', 
                'highlightColorPicker', 
                'insertDropdownMenu', 
                'lineSpacingMenu',
                'docExportMenu',
                'layoutSwitcherPopover',
                'docMentionDropdown',
                'pdfAttachmentMenu',
                'pdfHighlightPalette'
            ];
            ids.forEach(id => {
                if (id !== exceptId) {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('hidden');
                }
            });
        }

        // Global click listener to dismiss floating menus
        window.addEventListener('click', (e) => {
            if (!e.target.closest('.doc-dropdown-btn') && 
                !e.target.closest('.doc-floating-menu') && 
                !e.target.closest('.doc-dropdown-menu') &&
                !e.target.closest('.doc-tool-group') &&
                !e.target.closest('#layoutSwitcherBtn') &&
                !e.target.closest('#docExportBtn') &&
                !e.target.closest('#pdfAttachBtn') &&
                !e.target.closest('#pdfAttachmentMenu') &&
                !e.target.closest('#pdfHighlightPaletteBtn') &&
                !e.target.closest('#pdfHighlightPalette') &&
                !e.target.closest('#docMentionDropdown') &&
                !e.target.closest('#pdfSelectionToolbar')) {
                closeAllDocMenus();
            }
        });

        // =========================================================================
        // SYNCPAD DOCUMENT SMOOTH ANNOTATION ENGINE