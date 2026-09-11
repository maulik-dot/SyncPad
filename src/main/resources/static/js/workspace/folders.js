        // =========================================================================
        // ACTIVE FOLDER SCREEN LOGIC & OPERATIONS
        // =========================================================================
        async function openFolderView(folder) {
            activeFolder = folder;
            if (!document.getElementById('homeView').classList.contains('hidden')) {
                previousView = 'home';
            } else if (!document.getElementById('dashboardView').classList.contains('hidden')) {
                previousView = 'dashboard';
            }

            document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(i => i.classList.remove('active'));

            document.getElementById('homeView').classList.add('hidden');
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('folderView').classList.remove('hidden');
            document.getElementById('editorView').classList.add('hidden');
            document.getElementById('whiteboardView').classList.add('hidden');
            document.getElementById('notificationsView').classList.add('hidden');
            document.getElementById('sharedWithMeView').classList.add('hidden');

            document.getElementById('activeFolderName').innerText = folder.name;
            document.getElementById('folderNameBreadcrumb').innerText = folder.name;
            const wsName = folder.workspaceName || (activeWorkspace ? activeWorkspace.name : 'Workspace');
            document.getElementById('folderWorkspaceBreadcrumb').innerText = wsName;
            document.getElementById('folderWorkspaceBadge').innerText = wsName;

            currentFolderFilter = 'all';
            folderSearchQuery = '';
            const searchInput = document.getElementById('folderSearchInput');
            if (searchInput) searchInput.value = '';

            document.querySelectorAll('#folderView .tab-item').forEach((tab, index) => {
                tab.classList.toggle('active', index === 0);
            });

            await loadFolderDocuments(folder.id);
            refreshIcons();
        }

        async function loadFolderDocuments(folderId) {
            try {
                const res = await fetch(`/documents?folderId=${folderId}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    folderDocumentsList = await res.json();
                } else {
                    folderDocumentsList = documentsList.filter(d => d.folder && d.folder.id === folderId);
                }
            } catch (e) {
                folderDocumentsList = documentsList.filter(d => d.folder && d.folder.id === folderId);
            }
            renderFolderFiles();
        }

        function renderFolderFiles() {
            const grid = document.getElementById('folderFilesGrid');
            const list = document.getElementById('folderFilesList');
            grid.innerHTML = '';
            if (list) list.innerHTML = '';

            const total = folderDocumentsList.length;
            const docCount = folderDocumentsList.filter(d => d.fileType === 'DOC').length;
            const boardCount = folderDocumentsList.filter(d => d.fileType === 'WHITEBOARD').length;

            const itemCountBadge = document.getElementById('folderItemCountBadge');
            const docCountBadge = document.getElementById('folderDocCountBadge');
            const boardCountBadge = document.getElementById('folderBoardCountBadge');

            if (itemCountBadge) itemCountBadge.innerHTML = `<i data-lucide="files" style="width:12px;height:12px;"></i> ${total} ${total === 1 ? 'item' : 'items'}`;
            if (docCountBadge) docCountBadge.innerHTML = `<i data-lucide="file-text" style="width:12px;height:12px;"></i> ${docCount} ${docCount === 1 ? 'Doc' : 'Docs'}`;
            if (boardCountBadge) boardCountBadge.innerHTML = `<i data-lucide="presentation" style="width:12px;height:12px;"></i> ${boardCount} ${boardCount === 1 ? 'Board' : 'Boards'}`;

            let filtered = folderDocumentsList;
            if (currentFolderFilter !== 'all') {
                filtered = filtered.filter(d => d.fileType === currentFolderFilter);
            }
            if (folderSearchQuery) {
                filtered = filtered.filter(d => (d.title && d.title.toLowerCase().includes(folderSearchQuery)) || (d.content && d.content.toLowerCase().includes(folderSearchQuery)));
            }

            if (folderViewMode === 'grid') {
                grid.classList.remove('hidden');
                if (list) list.classList.add('hidden');
            } else {
                grid.classList.add('hidden');
                if (list) list.classList.remove('hidden');
            }

            if (folderDocumentsList.length === 0) {
                grid.classList.remove('hidden');
                if (list) list.classList.add('hidden');
                grid.innerHTML = `
                    <div class="card" style="grid-column: 1 / -1; padding: 3.5rem 2rem; text-align: center; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-lg);">
                        <div style="width: 58px; height: 58px; border-radius: 50%; background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(147, 51, 234, 0.12)); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; border: 1px solid rgba(37, 99, 235, 0.2);">
                            <i data-lucide="folder-open" style="width: 28px; height: 28px;"></i>
                        </div>
                        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.4rem; letter-spacing: -0.01em;">This folder is empty</h3>
                        <p style="font-size: 0.86rem; color: var(--text-muted); max-width: 440px; margin: 0 auto 1.75rem; line-height: 1.5;">
                            Create your first document or whiteboard inside <strong style="color:var(--text-primary);">${activeFolder ? activeFolder.name : 'this folder'}</strong> to start collaborating.
                        </p>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; max-width: 500px; margin: 0 auto;">
                            <div class="type-choice-card" onclick="openCreateInFolderModal('DOC')" style="text-align: left; padding: 1.25rem; display: flex; align-items: center; gap: 0.85rem;">
                                <div class="icon-box-doc" style="width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <i data-lucide="file-text" style="width:20px;height:20px;"></i>
                                </div>
                                <div>
                                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.15rem;">New Document</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Rich notes & specs</div>
                                </div>
                            </div>
                            <div class="type-choice-card" onclick="openCreateInFolderModal('WHITEBOARD')" style="text-align: left; padding: 1.25rem; display: flex; align-items: center; gap: 0.85rem;">
                                <div class="icon-box-board" style="width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <i data-lucide="presentation" style="width:20px;height:20px;"></i>
                                </div>
                                <div>
                                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.15rem;">New Whiteboard</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Visual diagramming</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else if (filtered.length === 0) {
                const target = folderViewMode === 'grid' ? grid : list;
                target.innerHTML = `
                    <div class="card" style="grid-column: 1 / -1; padding: 2.5rem 1.5rem; text-align: center; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-hover); color: var(--text-muted); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem;">
                            <i data-lucide="search-x" style="width: 22px; height: 22px;"></i>
                        </div>
                        <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem;">No files found</h4>
                        <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1rem;">No items in this folder match "${folderSearchQuery}".</p>
                        <button class="btn btn-outline" onclick="clearFolderSearch()" style="font-size:0.8rem; padding:0.35rem 0.75rem;">Clear search filter</button>
                    </div>
                `;
            } else {
                if (folderViewMode === 'grid') {
                    filtered.forEach(item => {
                        grid.appendChild(createWorkspaceCard(item));
                    });
                } else {
                    filtered.forEach(item => {
                        list.appendChild(createFileListRow(item));
                    });
                }
            }
            refreshIcons();
        }

        function handleFolderSearch(query) {
            folderSearchQuery = (query || '').toLowerCase().trim();
            renderFolderFiles();
        }

        function clearFolderSearch() {
            folderSearchQuery = '';
            const searchInput = document.getElementById('folderSearchInput');
            if (searchInput) searchInput.value = '';
            renderFolderFiles();
        }

        function toggleFolderViewMode(mode) {
            folderViewMode = mode;
            const gridBtn = document.getElementById('folderGridViewBtn');
            const listBtn = document.getElementById('folderListViewBtn');
            if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
            if (listBtn) listBtn.classList.toggle('active', mode === 'list');
            renderFolderFiles();
        }

        function switchFolderFilterTab(filter, el) {
            currentFolderFilter = filter;
            document.querySelectorAll('#folderView .tab-item').forEach(tab => tab.classList.remove('active'));
            if (el) el.classList.add('active');
            renderFolderFiles();
        }

        function closeFolderView() {
            document.getElementById('folderView').classList.add('hidden');
            if (previousView === 'home') {
                showHomeView(document.getElementById('navHomeItem'));
            } else {
                showWorkspaceDashboardView(document.getElementById('navDashboardItem'));
            }
        }

        async function deleteActiveFolder() {
            if (!activeFolder) return;
            const folderId = activeFolder.id;
            await deleteFolderItem(folderId);
            closeFolderView();
        }

        function selectFolderModalType(type) {
            createFolderItemType = type;
            const typeInput = document.getElementById('folderItemTypeSelect');
            if (typeInput) typeInput.value = type;
            
            const docCard = document.getElementById('folderChoiceDoc');
            const boardCard = document.getElementById('folderChoiceBoard');
            if (docCard) docCard.classList.toggle('selected', type === 'DOC');
            if (boardCard) boardCard.classList.toggle('selected', type === 'WHITEBOARD');

            const titleInput = document.getElementById('folderItemTitleInput');
            if (titleInput && (titleInput.value === 'Untitled Document' || titleInput.value === 'Untitled Whiteboard' || !titleInput.value.trim())) {
                titleInput.value = type === 'DOC' ? 'Untitled Document' : 'Untitled Whiteboard';
            }
            const modalTitle = document.getElementById('createInFolderModalTitle');
            if (modalTitle) modalTitle.innerText = `Add ${type === 'DOC' ? 'Document' : 'Whiteboard'} in ${activeFolder ? activeFolder.name : 'Folder'}`;
        }

        function openCreateInFolderModal(type = 'DOC') {
            selectFolderModalType(type);
            const titleInput = document.getElementById('folderItemTitleInput');
            document.getElementById('createInFolderModal').classList.remove('hidden');
            refreshIcons();
            if (titleInput) {
                titleInput.focus();
                titleInput.select();
            }
        }

        function closeCreateInFolderModal() {
            document.getElementById('createInFolderModal').classList.add('hidden');
        }

        async function handleCreateInFolderSubmit(e) {
            e.preventDefault();
            const fileType = document.getElementById('folderItemTypeSelect').value;
            const defaultTitle = fileType === 'DOC' ? 'Untitled Document' : 'Untitled Whiteboard';
            const title = document.getElementById('folderItemTitleInput').value.trim() || defaultTitle;
            const folderId = activeFolder ? activeFolder.id : null;
            const wsName = (activeFolder && activeFolder.workspaceName) || (activeWorkspace ? activeWorkspace.name : null);

            try {
                const res = await fetch('/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ title, content: '', fileType, folderId, workspaceName: wsName })
                });
                if (res.ok) {
                    const newItem = await res.json();
                    // Folder-owned doc: only in folder list, NOT in workspace root list.
                    folderDocumentsList.unshift(newItem);
                    closeCreateInFolderModal();
                    openItemView(newItem);
                } else {
                    const newItem = { id: Date.now(), title, fileType, content: '# ' + title, folder: activeFolder, folderId, workspaceName: wsName };
                    folderDocumentsList.unshift(newItem);
                    closeCreateInFolderModal();
                    openItemView(newItem);
                }
            } catch (err) {
                const newItem = { id: Date.now(), title, fileType, content: '# ' + title, folder: activeFolder, folderId, workspaceName: wsName };
                folderDocumentsList.unshift(newItem);
                closeCreateInFolderModal();
                openItemView(newItem);
            }
            renderFolderFiles();
            renderDashboardGrids();
            renderHomeScreen();
            toast(`Created ${fileType === 'DOC' ? 'document' : 'whiteboard'}: ${title}`);
        }


        // FOLDER ACCESS & RESTRICTION CONTROLS
        async function openFolderAccessModal(folderId, folderName) {
            activeAccessFolderId = folderId || (activeFolder ? activeFolder.id : null);
            if (!activeAccessFolderId) return;

            const modal = document.getElementById('folderAccessModal');
            const titleEl = document.getElementById('folderAccessModalTitle');
            if (titleEl) {
                titleEl.textContent = folderName ? `Folder Access: ${folderName}` : 'Folder Access & Restrictions';
            }
            modal.classList.remove('hidden');
            if (modal) modal.classList.remove('hidden');
            await loadFolderPermissions(activeAccessFolderId);
            refreshIcons();
        }

        function closeFolderAccessModal() {
            document.getElementById('folderAccessModal').classList.add('hidden');
            const modal = document.getElementById('folderAccessModal');
            if (modal) modal.classList.add('hidden');
            activeAccessFolderId = null;
        }

        async function loadFolderPermissions(folderId) {
            const list = document.getElementById('folderPermissionsList');
            const countBadge = document.getElementById('folderMembersCountBadge');
            if (!list) return;
            list.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.75rem;">Loading permissions...</div>';

            try {
                const res = await fetch(`/folders/${folderId}/permissions`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const permissions = await res.json();
                    if (countBadge) {
                        countBadge.textContent = `${permissions.length} members`;
                    }
                    renderFolderPermissionsList(permissions, folderId);
                } else {
                    list.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.75rem;">No member list available.</div>';
                }
            } catch (e) {
                list.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.75rem;">Error loading permissions.</div>';
            }
        }

        function renderFolderPermissionsList(permissions, folderId) {
            const list = document.getElementById('folderPermissionsList');
            if (!list) return;

            if (!permissions || permissions.length === 0) {
                list.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.75rem;">All workspace members inherit default access.</div>';
                return;
            }

            list.innerHTML = permissions.map(p => {
                const initial = (p.userName || p.userEmail || 'U').substring(0, 1).toUpperCase();
                const isOwner = p.role === 'OWNER';
                const isRestricted = p.role === 'RESTRICTED';
                const isViewer = p.role === 'VIEWER';
                const isEditor = p.role === 'EDITOR';
                const isInherited = p.id === null;
                const isMe = currentUser && (currentUser.email === p.userEmail || currentUser.id === p.userId);

                let selectHtml = '';
                if (isOwner) {
                    selectHtml = `<span class="badge" style="background: rgba(37,99,235,0.1); color: var(--accent-primary); font-size: 0.72rem; font-weight: 600;">Owner</span>`;
                } else {
                    selectHtml = `
                        <select onchange="changeFolderUserAccess(${folderId}, ${p.userId}, '${escapeHtml(p.userEmail)}', this.value)" class="app-select app-select-sm ${isRestricted ? 'app-select-restricted' : ''}">
                            <option value="" ${isInherited ? 'selected' : ''}>Workspace Default</option>
                            <option value="EDITOR" ${(!isInherited && isEditor) ? 'selected' : ''}>Editor (Can edit)</option>
                            <option value="VIEWER" ${(!isInherited && isViewer) ? 'selected' : ''}>View Only (Read only)</option>
                            <option value="RESTRICTED" ${isRestricted ? 'selected' : ''}>Restricted (No Access)</option>
                        </select>
                    `;
                }

                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 0.45rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                        <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
                            <div class="avatar" style="width: 26px; height: 26px; font-size: 0.7rem; background: ${isRestricted ? '#ef4444' : (isOwner ? '#2563eb' : '#059669')}; flex-shrink: 0;">${initial}</div>
                            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                <div style="font-size: 0.78rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(p.userName || p.userEmail)} ${isMe ? '<span style="font-size:0.68rem;color:var(--text-muted);">(You)</span>' : ''}</div>
                                <div style="font-size: 0.7rem; color: var(--text-muted);">${escapeHtml(p.userEmail)}</div>
                            </div>
                        </div>
                        <div style="flex-shrink: 0; margin-left: 0.5rem;">
                            ${selectHtml}
                        </div>
                    </div>
                `;
            }).join('');
            refreshIcons();
        }

        async function changeFolderUserAccess(folderId, userId, email, roleValue) {
            try {
                const payload = {
                    userId: userId,
                    email: email,
                    role: roleValue ? roleValue : null
                };
                const res = await fetch(`/folders/${folderId}/permissions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const roleLabel = roleValue === 'RESTRICTED' ? 'Restricted' : (roleValue === 'VIEWER' ? 'View Only' : (roleValue === 'EDITOR' ? 'Editor' : 'Workspace Default'));
                    toast(`Updated folder access for ${email}: ${roleLabel}`);
                    await loadFolderPermissions(folderId);
                    loadWorkspaceContents();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to update folder access');
                    await loadFolderPermissions(folderId);
                }
            } catch (e) {
                toast('Failed to update folder access');
            }
        }


        function openSettingsView() { document.getElementById('settingsModal').classList.remove('hidden'); refreshIcons(); }
        function closeSettingsView() { document.getElementById('settingsModal').classList.add('hidden'); }

        window.openFolderView = openFolderView;
        window.closeFolderView = closeFolderView;
        window.openSettingsView = openSettingsView;
        window.closeSettingsView = closeSettingsView;

