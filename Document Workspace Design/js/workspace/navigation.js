        // VIEW SWITCHERS (HOME VS DASHBOARD VS FOLDER VS NOTIFICATIONS VS SHARED)
        function showHomeView(el) {
            if (el) {
                document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
            }
            activeFolder = null;
            previousView = 'home';
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');
            document.getElementById('homeView').classList.remove('hidden');
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('folderView').classList.add('hidden');
            document.getElementById('editorView').classList.add('hidden');
            document.getElementById('whiteboardView').classList.add('hidden');
            document.getElementById('notificationsView').classList.add('hidden');
            document.getElementById('sharedWithMeView').classList.add('hidden');
            const tv1 = document.getElementById('trashView'); if (tv1) tv1.classList.add('hidden');
            const sv1 = document.getElementById('starredView'); if (sv1) sv1.classList.add('hidden');
            renderHomeScreen();
            refreshIcons();
        }

        function showWorkspaceDashboardView(el) {
            if (el) {
                document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
            }
            activeFolder = null;
            previousView = 'dashboard';
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');
            document.getElementById('homeView').classList.add('hidden');
            document.getElementById('dashboardView').classList.remove('hidden');
            document.getElementById('folderView').classList.add('hidden');
            document.getElementById('editorView').classList.add('hidden');
            document.getElementById('whiteboardView').classList.add('hidden');
            document.getElementById('notificationsView').classList.add('hidden');
            document.getElementById('sharedWithMeView').classList.add('hidden');
            const tv2 = document.getElementById('trashView'); if (tv2) tv2.classList.add('hidden');
            const sv2 = document.getElementById('starredView'); if (sv2) sv2.classList.add('hidden');
            renderDashboardGrids();
            refreshIcons();
        }

        function showNotificationsView(el) {
            if (el) {
                document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
            }
            activeFolder = null;
            previousView = 'notifications';
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');
            document.getElementById('homeView').classList.add('hidden');
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('folderView').classList.add('hidden');
            document.getElementById('editorView').classList.add('hidden');
            document.getElementById('whiteboardView').classList.add('hidden');
            document.getElementById('sharedWithMeView').classList.add('hidden');
            const tv3 = document.getElementById('trashView'); if (tv3) tv3.classList.add('hidden');
            const sv3 = document.getElementById('starredView'); if (sv3) sv3.classList.add('hidden');
            document.getElementById('notificationsView').classList.remove('hidden');
            
            const notifMenu = document.getElementById('notificationsMenu');
            if (notifMenu) notifMenu.classList.add('hidden');

            currentNotifFilter = 'all';
            const searchInput = document.getElementById('notifSearchInput');
            if (searchInput) searchInput.value = '';
            document.querySelectorAll('#notificationsView .tab-item').forEach((btn, idx) => {
                btn.classList.toggle('active', idx === 0);
            });
            
            renderFullNotificationsList();
            refreshIcons();
        }

        async function showSharedWithMeView(el) {
            if (el) {
                document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
            }
            activeFolder = null;
            previousView = 'shared';
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');
            document.getElementById('homeView').classList.add('hidden');
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('folderView').classList.add('hidden');
            document.getElementById('editorView').classList.add('hidden');
            document.getElementById('whiteboardView').classList.add('hidden');
            document.getElementById('notificationsView').classList.add('hidden');
            const tv4 = document.getElementById('trashView'); if (tv4) tv4.classList.add('hidden');
            const sv4 = document.getElementById('starredView'); if (sv4) sv4.classList.add('hidden');
            document.getElementById('sharedWithMeView').classList.remove('hidden');
            
            renderSharedWithMeScreen();
            if (typeof loadSharedWithMe === 'function') {
                await loadSharedWithMe();
            }
            refreshIcons();
        }


        // RENDER HOME SCREEN OVERVIEW (WORKSPACES + RECENT FOLDERS + RECENT FILES)
        function renderHomeScreen() {
            const homeWorkspacesGrid = document.getElementById('homeWorkspacesGrid');
            const homeFoldersGrid = document.getElementById('homeFoldersGrid');
            const homeFilesGrid = document.getElementById('homeFilesGrid');

            homeWorkspacesGrid.innerHTML = '';
            homeFoldersGrid.innerHTML = '';
            homeFilesGrid.innerHTML = '';

            // Render Workspaces Cards
            workspacesList.forEach(ws => {
                const isAdmin = isWorkspaceAdmin(ws);
                const card = document.createElement('div');
                card.className = 'card card-hover';
                card.style.display = 'flex'; card.style.flexDirection = 'column'; card.style.justifyName = 'space-between';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.9rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div class="avatar" style="width: 38px; height: 38px; font-size: 1rem; background: ${ws.color || '#2563eb'};">${ws.initial || ws.name.charAt(0)}</div>
                            <div>
                                <h3 style="font-size: 1rem; font-weight: 600;">${escapeHtml(ws.name)}</h3>
                                <span class="badge ${isAdmin ? 'badge-role' : 'notif-badge-pill role'}" style="font-size: 0.7rem; margin-top: 0.1rem;">${isAdmin ? 'Admin' : 'Member'}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.2rem;" onclick="event.stopPropagation()">
                            <button class="btn btn-icon card-action-btn" onclick="event.stopPropagation(); openWorkspaceShareModalById(${ws.id})" title="Collaborate / Members" aria-label="Collaborate">
                                <i data-lucide="user-plus" style="width:14px;height:14px;"></i>
                            </button>
                            ${isAdmin ? `
                            <button class="btn btn-icon card-action-btn" onclick="event.stopPropagation(); openRenameModal('workspace', ${ws.id}, '${escapeHtml(ws.name)}')" title="Rename Workspace" aria-label="Rename">
                                <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                            </button>
                            <button class="btn btn-icon card-action-btn btn-icon-danger" onclick="event.stopPropagation(); deleteWorkspaceById(${ws.id})" title="Delete Workspace" aria-label="Delete">
                                <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                            </button>` : ''}
                        </div>
                    </div>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.2rem; min-height: 38px;">${escapeHtml(ws.description || 'Collaborative workspace container')}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                        <div class="avatar-group">
                            <div class="avatar" style="width:22px;height:22px;font-size:0.65rem;background:${ws.color || '#2563eb'};">${ws.initial || ws.name.charAt(0)}</div>
                        </div>
                        <button class="btn btn-primary" onclick="selectWorkspaceById(${ws.id})" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;">
                            <span>Open Workspace</span>
                            <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                `;
                homeWorkspacesGrid.appendChild(card);
            });

            // Render Recent Folders Cards (Fully clickable & interactive)
            if (!foldersList || foldersList.length === 0) {
                homeFoldersGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 1.75rem 1rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--radius-md); background: var(--bg-surface);">
                    <i data-lucide="folder" style="width:24px;height:24px;margin-bottom:0.3rem;color:var(--accent-primary);"></i>
                    <p style="font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-bottom:0.25rem;">No folders in this workspace yet</p>
                    <button class="btn btn-outline" onclick="openCreateFolderModal()" style="font-size:0.78rem;padding:0.3rem 0.75rem;margin-top:0.4rem;">
                        <i data-lucide="folder-plus" style="width:13px;height:13px;"></i>
                        <span>New Folder</span>
                    </button>
                </div>`;
            } else {
                foldersList.forEach(folder => {
                    const card = document.createElement('div');
                    card.className = 'card card-hover';
                    card.style.padding = '1.1rem';
                    card.style.cursor = 'pointer';
                    card.onclick = () => openFolderView(folder);
                    card.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                            <div style="display: flex; align-items: center; gap: 0.65rem;">
                                <div style="width: 34px; height: 34px; border-radius: var(--radius-sm); background: rgba(37, 99, 235, 0.1); display: flex; align-items: center; justify-content: center; color: var(--accent-primary);">
                                    <i data-lucide="folder" style="width:18px;height:18px;"></i>
                                </div>
                                <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${folder.name}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.2rem;" onclick="event.stopPropagation()">
                                <button class="btn btn-icon card-action-btn" onclick="openFolderAccessModal(${folder.id}, '${folder.name}')" title="Folder Permissions & Restrictions" aria-label="Permissions">
                                    <i data-lucide="shield" style="width:14px;height:14px;color:var(--accent-primary);"></i>
                                </button>
                                <button class="btn btn-icon card-action-btn" onclick="openRenameModal('folder', ${folder.id}, '${folder.name}')" title="Rename Folder" aria-label="Rename">
                                    <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                                </button>
                                <button class="btn btn-icon card-action-btn btn-icon-danger" onclick="deleteFolderItem(${folder.id})" title="Delete Folder" aria-label="Delete">
                                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                                </button>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                            <span class="badge badge-role" style="font-size: 0.72rem;">${folder.workspaceName || 'Workspace Folder'}</span>
                            <span style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 600; display: flex; align-items: center; gap: 0.25rem;">
                                Open Folder <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
                            </span>
                        </div>
                    `;
                    homeFoldersGrid.appendChild(card);
                });
            }

            // Render Recent Files Cards — click-tracked recents (folder + workspace docs).
            // Falls back to workspace root docs when no clicks yet.
            loadRecentFilesFromStorage();
            let recentToShow = (recentFilesList || []).filter(r => {
                if (!activeWorkspace) return true;
                if (!r.workspaceName) return true;
                return r.workspaceName.toLowerCase() === activeWorkspace.name.toLowerCase();
            }).slice(0, 4);
            if (recentToShow.length === 0 && documentsList && documentsList.length > 0) {
                recentToShow = documentsList.slice(0, 4);
            }
            if (recentToShow.length === 0) {
                homeFilesGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 1.75rem 1rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--radius-md); background: var(--bg-surface);">
                    <i data-lucide="file-text" style="width:24px;height:24px;margin-bottom:0.3rem;color:var(--accent-primary);"></i>
                    <p style="font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-bottom:0.25rem;">No files in this workspace yet</p>
                    <button class="btn btn-primary" onclick="openCreateModal()" style="font-size:0.78rem;padding:0.3rem 0.8rem;margin-top:0.4rem;">
                        <i data-lucide="plus" style="width:13px;height:13px;"></i>
                        <span>New Document</span>
                    </button>
                </div>`;
            } else {
                recentToShow.forEach(item => {
                    homeFilesGrid.appendChild(createWorkspaceCard(item));
                });
            }

            refreshIcons();
        }

        function selectWorkspaceById(id) {
            const ws = workspacesList.find(w => w.id === id);
            if (ws) selectWorkspace(ws);
        }

        async function deleteWorkspaceById(id) {
            const ws = workspacesList.find(w => w.id === id);
            if (!isWorkspaceAdmin(ws)) {
                toast('Only the workspace admin can delete this workspace');
                return;
            }
            if (workspacesList.length <= 1) {
                toast('Cannot delete the only active workspace');
                return;
            }
            if (!confirm(`Are you sure you want to delete workspace "${ws ? ws.name : ''}"? This action cannot be undone.`)) {
                return;
            }
            try {
                const res = await fetch(`/workspaces/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    workspacesList = workspacesList.filter(w => w.id !== id);
                    selectWorkspace(workspacesList[0]);
                    renderHomeScreen();
                    toast('Workspace deleted');
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to delete workspace');
                }
            } catch (e) {
                toast('Failed to delete workspace');
            }
        }

        // WORKSPACE CONTENTS (FOLDERS + DOCUMENTS)
        async function loadWorkspaceContents() {
            if (!activeWorkspace) {
                foldersList = [];
                documentsList = [];
                renderDashboardGrids();
                renderHomeScreen();
                return;
            }

            try {
                const res = await fetch(`/folders?workspace=${encodeURIComponent(activeWorkspace.name)}`, { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) foldersList = await res.json();
                else foldersList = [];
            } catch (e) { foldersList = []; }

            try {
                const res = await fetch(`/documents?workspace=${encodeURIComponent(activeWorkspace.name)}&rootOnly=true`, { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) {
                    const rawDocs = await res.json();
                    documentsList = rawDocs.filter(d => {
                        let wsMatch = true;
                        if (d.workspaceName) {
                            wsMatch = d.workspaceName.toLowerCase() === activeWorkspace.name.toLowerCase();
                        } else if (!(workspacesList.length > 0 && activeWorkspace.id === workspacesList[0].id)) {
                            wsMatch = false;
                        }
                        // Folder-owned docs belong to the folder view only, never the workspace root.
                        return wsMatch && isRootDoc(d);
                    });
                } else {
                    documentsList = [];
                }
            } catch (e) { documentsList = []; }

            renderDashboardGrids();
            renderHomeScreen();
        }

        function renderDashboardGrids() {
            const foldersGrid = document.getElementById('foldersGrid');
            const docsGrid = document.getElementById('docsGrid');
            const whiteboardsGrid = document.getElementById('whiteboardsGrid');

            foldersGrid.innerHTML = '';
            docsGrid.innerHTML = '';
            whiteboardsGrid.innerHTML = '';

            // Render Folders
            if (!foldersList || foldersList.length === 0) {
                foldersGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem 1.5rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--radius-md); background: var(--bg-surface);">
                    <i data-lucide="folder" style="width:28px;height:28px;margin-bottom:0.4rem;color:var(--accent-primary);"></i>
                    <p style="font-size:0.88rem;font-weight:600;color:var(--text-primary);margin-bottom:0.25rem;">No folders yet</p>
                    <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.75rem;">Organize your workspace documents with structured folders.</p>
                    <button class="btn btn-outline" onclick="openCreateFolderModal()" style="font-size:0.8rem;padding:0.35rem 0.8rem;">
                        <i data-lucide="folder-plus" style="width:14px;height:14px;"></i>
                        <span>Create First Folder</span>
                    </button>
                </div>`;
            } else {
                foldersList.forEach(folder => {
                    foldersGrid.appendChild(createFolderCard(folder));
                });
            }

            const rootDocs = (documentsList || []).filter(d => isRootDoc(d));
            const docs = rootDocs.filter(d => d.fileType === 'DOC');
            const whiteboards = rootDocs.filter(d => d.fileType === 'WHITEBOARD');

            // Render Docs
            if (docs.length === 0) {
                docsGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem 1.5rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--radius-md); background: var(--bg-surface);">
                    <i data-lucide="file-text" style="width:28px;height:28px;margin-bottom:0.4rem;color:var(--accent-primary);"></i>
                    <p style="font-size:0.88rem;font-weight:600;color:var(--text-primary);margin-bottom:0.25rem;">No documents yet</p>
                    <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.75rem;">Create rich-text collaborative documents with markdown & LaTeX support.</p>
                    <button class="btn btn-primary" onclick="openCreateModal()" style="font-size:0.8rem;padding:0.35rem 0.85rem;">
                        <i data-lucide="plus" style="width:14px;height:14px;"></i>
                        <span>Create First Document</span>
                    </button>
                </div>`;
            } else {
                docs.forEach(doc => docsGrid.appendChild(createWorkspaceCard(doc)));
            }

            // Render Whiteboards
            if (whiteboards.length === 0) {
                whiteboardsGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem 1.5rem; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--radius-md); background: var(--bg-surface);">
                    <i data-lucide="presentation" style="width:28px;height:28px;margin-bottom:0.4rem;color:#9333ea;"></i>
                    <p style="font-size:0.88rem;font-weight:600;color:var(--text-primary);margin-bottom:0.25rem;">No whiteboards yet</p>
                    <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.75rem;">Collaborate on infinite vector canvases, flowcharts and diagrams.</p>
                    <button class="btn btn-outline" onclick="createWhiteboardItem()" style="font-size:0.8rem;padding:0.35rem 0.8rem;">
                        <i data-lucide="plus" style="width:14px;height:14px;"></i>
                        <span>Create First Whiteboard</span>
                    </button>
                </div>`;
            } else {
                whiteboards.forEach(board => whiteboardsGrid.appendChild(createWorkspaceCard(board)));
            }

            refreshIcons();
        }

        function createFolderCard(folder) {
            const card = document.createElement('div');
            card.className = 'card card-hover';
            card.style.padding = '1.1rem';
            card.style.cursor = 'pointer';
            card.onclick = () => openFolderView(folder);
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div style="width: 34px; height: 34px; border-radius: var(--radius-sm); background: rgba(37, 99, 235, 0.1); display: flex; align-items: center; justify-content: center; color: var(--accent-primary);">
                            <i data-lucide="folder" style="width:18px;height:18px;"></i>
                        </div>
                        <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${folder.name}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.2rem;" onclick="event.stopPropagation()">
                        <button class="btn btn-icon card-action-btn" onclick="openFolderAccessModal(${folder.id}, '${folder.name}')" title="Folder Permissions & Restrictions" aria-label="Permissions">
                            <i data-lucide="shield" style="width:14px;height:14px;color:var(--accent-primary);"></i>
                        </button>
                        <button class="btn btn-icon card-action-btn" onclick="openRenameModal('folder', ${folder.id}, '${folder.name}')" title="Rename Folder" aria-label="Rename">
                            <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                        </button>
                        <button class="btn btn-icon card-action-btn btn-icon-danger" onclick="deleteFolderItem(${folder.id})" title="Delete Folder" aria-label="Delete">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <span class="badge badge-role" style="font-size: 0.72rem;">${folder.workspaceName || 'Folder'}</span>
                    <span style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 600; display: flex; align-items: center; gap: 0.25rem;">
                        Open <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
                    </span>
                </div>
            `;
            return card;
        }

        function createWorkspaceCard(item) {
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

            const tagsHtml = (item.tags && item.tags.length > 0) ? `
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
                    ${item.tags.map(t => `<span class="badge" style="background:${t.color || '#3b82f6'}20; color:${t.color || '#3b82f6'}; border:1px solid ${t.color || '#3b82f6'}40; font-size:0.68rem; padding:1px 6px; border-radius:4px; font-weight:600;">#${t.name}</span>`).join('')}
                </div>
            ` : '';

            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                        <div class="${isBoard ? 'icon-box-board' : 'icon-box-doc'}" style="width: 38px; height: 38px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="${isBoard ? 'presentation' : 'file-text'}" style="width:20px;height:20px;"></i>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.2rem;" onclick="event.stopPropagation()">
                            <span class="badge" style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; ${isBoard ? 'background: rgba(147,51,234,0.1); color: #9333ea;' : 'background: rgba(37,99,235,0.1); color: var(--accent-primary);'}">
                                ${isBoard ? 'Board' : 'Doc'}
                            </span>
                            <button class="btn btn-icon card-action-btn" onclick="event.stopPropagation(); toggleStarDoc(${item.id})" title="${isStarred ? 'Unstar' : 'Star'}" aria-label="Star">
                                <i data-lucide="star" style="width:14px;height:14px;${isStarred ? 'fill:#f59e0b;color:#f59e0b;' : 'color:var(--text-muted);'}"></i>
                            </button>
                            <button class="btn btn-icon card-action-btn" onclick="event.stopPropagation(); openTagModal(${item.id}, '${item.title ? item.title.replace(/'/g, "\\'") : ''}')" title="Manage Tags" aria-label="Tags">
                                <i data-lucide="tag" style="width:13px;height:13px;"></i>
                            </button>
                            <button class="btn btn-icon card-action-btn" onclick="event.stopPropagation(); openDocumentAccessModal(${item.id}, '${item.title ? item.title.replace(/'/g, "\\'") : ''}')" title="File Permissions & Restrictions" aria-label="Permissions">
                                <i data-lucide="shield" style="width:13px;height:13px;color:var(--accent-primary);"></i>
                            </button>
                            <button class="btn btn-icon card-action-btn" onclick="event.stopPropagation(); openRenameModal('doc', ${item.id}, '${item.title ? item.title.replace(/'/g, "\\'") : ''}')" title="Rename Item" aria-label="Rename">
                                <i data-lucide="edit-2" style="width:13px;height:13px;"></i>
                            </button>
                            <button class="btn btn-icon card-action-btn btn-icon-danger" onclick="event.stopPropagation(); deleteWorkspaceItem(${item.id})" title="Delete Item" aria-label="Delete">
                                <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                            </button>
                        </div>
                    </div>
                    <h3 style="font-size: 0.96rem; font-weight: 600; margin-bottom: 0.25rem; line-height: 1.35; color: var(--text-primary); word-break: break-word;">${item.title || 'Untitled'}</h3>
                    ${tagsHtml}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.65rem; margin-top: 0.75rem;">
                    <span style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem;">
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

        function createFileListRow(item) {
            const isBoard = item.fileType === 'WHITEBOARD';
            const isStarred = !!item.isStarred;
            const row = document.createElement('div');
            row.className = 'file-list-row';
            row.onclick = () => openItemView(item);

            const tagsInline = (item.tags && item.tags.length > 0) ? `
                <span style="display:inline-flex; gap:3px; margin-left:6px;">
                    ${item.tags.slice(0, 2).map(t => `<span class="badge" style="background:${t.color || '#3b82f6'}20; color:${t.color || '#3b82f6'}; border:1px solid ${t.color || '#3b82f6'}40; font-size:0.65rem; padding:0 5px; border-radius:3px;">#${t.name}</span>`).join('')}
                    ${item.tags.length > 2 ? `<span style="font-size:0.65rem; color:var(--text-muted);">+${item.tags.length - 2}</span>` : ''}
                </span>
            ` : '';

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 0;">
                    <div class="${isBoard ? 'icon-box-board' : 'icon-box-doc'}" style="width: 34px; height: 34px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i data-lucide="${isBoard ? 'presentation' : 'file-text'}" style="width:18px;height:18px;"></i>
                    </div>
                    <div style="min-width: 0; display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                        <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title || 'Untitled'}</span>
                        ${tagsInline}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1.25rem; flex-shrink: 0;">
                    <span class="badge" style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; ${isBoard ? 'background: rgba(147,51,234,0.1); color: #9333ea;' : 'background: rgba(37,99,235,0.1); color: var(--accent-primary);'}">
                        ${isBoard ? 'Whiteboard' : 'Document'}
                    </span>
                    <span style="font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem;">
                        <i data-lucide="clock" style="width:12px;height:12px;"></i>
                        ${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently'}
                    </span>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <button class="btn btn-icon" onclick="event.stopPropagation(); toggleStarDoc(${item.id})" title="${isStarred ? 'Unstar' : 'Star'}" aria-label="Star">
                            <i data-lucide="star" style="width:14px;height:14px;${isStarred ? 'fill:#f59e0b;color:#f59e0b;' : 'color:var(--text-muted);'}"></i>
                        </button>
                        <button class="btn btn-icon" onclick="event.stopPropagation(); openTagModal(${item.id}, '${item.title ? item.title.replace(/'/g, "\\'") : ''}')" title="Manage Tags" aria-label="Tags">
                            <i data-lucide="tag" style="width:13px;height:13px;"></i>
                        </button>
                        <button class="btn btn-icon" onclick="event.stopPropagation(); openDocumentAccessModal(${item.id}, '${item.title ? item.title.replace(/'/g, "\\'") : ''}')" title="File Permissions & Restrictions" aria-label="Permissions">
                            <i data-lucide="shield" style="width:13px;height:13px;color:var(--accent-primary);"></i>
                        </button>
                        <button class="btn btn-icon" onclick="event.stopPropagation(); openRenameModal('doc', ${item.id}, '${item.title ? item.title.replace(/'/g, "\\'") : ''}')" title="Rename Item" aria-label="Rename">
                            <i data-lucide="edit-2" style="width:13px;height:13px;"></i>
                        </button>
                        <button class="btn btn-icon btn-icon-danger" onclick="event.stopPropagation(); deleteWorkspaceItem(${item.id})" title="Delete Item" aria-label="Delete">
                            <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                        </button>
                    </div>
                </div>
            `;
            return row;
        }


        // ITEM VIEW & NAVIGATION
        function openItemView(item) {
            currentDoc = item;
            if (window.SyncPadOffline && item) {
                window.SyncPadOffline.cacheDocument(item);
            }
            // Any clicked file (folder-owned or workspace-root) goes to Recent Files.
            try { trackRecentFile(item); } catch (e) {}
            document.getElementById('homeView').classList.add('hidden');
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('folderView').classList.add('hidden');
            document.getElementById('notificationsView').classList.add('hidden');
            document.getElementById('sharedWithMeView').classList.add('hidden');
            const tv = document.getElementById('trashView'); if (tv) tv.classList.add('hidden');
            const sv = document.getElementById('starredView'); if (sv) sv.classList.add('hidden');
            
            // Collapse main sidebar for full document & whiteboard focus
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('hidden');

            if (item.fileType === 'WHITEBOARD') {
                document.getElementById('editorView').classList.add('hidden');
                document.getElementById('whiteboardView').classList.remove('hidden');
                document.getElementById('whiteboardTitleInput').value = item.title;
            } else {
                document.getElementById('whiteboardView').classList.add('hidden');
                document.getElementById('editorView').classList.remove('hidden');
                if (document.getElementById('docTitleInput')) {
                    document.getElementById('docTitleInput').value = item.title || 'Untitled Document';
                }
                updateEditorStarIcon(!!item.isStarred);

                // Resolve and enforce document role
                let role = item.currentUserRole;
                if (!role && currentUser && item.ownerEmail && currentUser.email === item.ownerEmail) {
                    role = 'OWNER';
                }
                if (!role) {
                    role = 'EDITOR';
                }
                applyDocumentRole(role);

                // Fetch latest doc metadata asynchronously if currentUserRole was missing from cached item
                if (item.id && !item.currentUserRole && token) {
                    fetchWithAuth(`/documents/${item.id}`).then(res => {
                        if (res && res.ok) return res.json();
                    }).then(freshDoc => {
                        if (freshDoc && freshDoc.currentUserRole && currentDoc && currentDoc.id === freshDoc.id) {
                            applyDocumentRole(freshDoc.currentUserRole);
                        }
                    }).catch(() => {});
                }
                const sheet = document.getElementById('docPageSheet');
                if (sheet) {
                    if (item.content && item.content.trim().length > 0) {
                        sheet.innerHTML = item.content;
                    } else {
                        sheet.innerHTML = `<h1>${escapeHtml(item.title || 'Untitled Document')}</h1><p>Start typing your document content here...</p>`;
                    }
                    if (window.latexEngine) {
                        window.latexEngine.initAllCards(sheet);
                    }
                    if (typeof normalizeDocChecklists === 'function') {
                        normalizeDocChecklists(sheet);
                    }
                    refreshIcons();
                    updateDocStats();
                    if (typeof updateDocOutline === 'function') {
                        updateDocOutline();
                    }
                    if (typeof loadDocAnnotationsFromStorage === 'function') {
                        loadDocAnnotationsFromStorage(item.id);
                    }
                }


                // PDF Attachment metadata & dynamic loader
                const pdfName = item.pdfFileName || 'RFC-7629-Architecture.pdf';
                const pdfUrl = item.pdfUrl || null;
                
                let matchedPreset = 'rfc-7629';
                for (const [k, v] of Object.entries(PRESET_PDF_LIBRARY)) {
                    if (v.name === pdfName || v.title === pdfName || v.fileName === pdfName) {
                        matchedPreset = k;
                        break;
                    }
                }
                currentPdfFileName = pdfName;
                currentPdfPresetKey = matchedPreset || 'rfc-7629';
                updatePdfUiMetadata(pdfName, 1, 3);
                updatePdfDropdownSelectionUi(currentPdfPresetKey, pdfName);

                if (!window.pdfEngine && typeof initPdfEngine === 'function') {
                    initPdfEngine();
                }
                if (window.pdfEngine) {
                    if (pdfUrl) {
                        window.pdfEngine.renderer.loadPdfDocument(pdfUrl, pdfName);
                    } else if (window.pdfStorage && item.id) {
                        window.pdfStorage.getUploadedPdfByName(pdfName, item.id).then(stored => {
                            if (stored && stored.data) {
                                window.pdfEngine.renderer.loadPdfDocument(stored.data, stored.fileName);
                            } else {
                                window.pdfEngine.renderer.loadPdfDocument(matchedPreset || 'rfc-7629');
                            }
                        }).catch(() => {
                            window.pdfEngine.renderer.loadPdfDocument(matchedPreset || 'rfc-7629');
                        });
                    } else {
                        window.pdfEngine.renderer.loadPdfDocument(matchedPreset || 'rfc-7629');
                    }
                    if (window.pdfCollaborator && item.id) {
                        window.pdfCollaborator.setDocumentId(item.id);
                    }
                }

                // Load active comments and subscribe to real-time document collaboration
                if (item.id) {
                    loadDocComments(item.id);
                    subscribeToDocumentCollaboration(item.id);
                    setTimeout(() => {
                        const editor = document.getElementById('editorView');
                        if (currentDoc && currentDoc.id === item.id && editor && !editor.classList.contains('hidden') &&
                            (!stompClient || !stompClient.connected || !docStompSubscription)) {
                            subscribeToDocumentCollaboration(item.id);
                        }
                    }, 1000);
                }
            }
            refreshIcons();
        }

        async function closeEditorView() {
            if (docAutoSaveTimeout) {
                clearTimeout(docAutoSaveTimeout);
                docAutoSaveTimeout = null;
            }
            if (docRenameTimeout) {
                clearTimeout(docRenameTimeout);
                docRenameTimeout = null;
            }

            if (currentDoc && currentDoc.id && canEditCurrentDoc() && (token || currentDoc.shareToken)) {
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
                    }
                } catch (e) {}
            }

            unsubscribeDocumentCollaboration();
            document.getElementById('editorView').classList.add('hidden');
            
            // Restore main sidebar
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');

            if (activeWorkspace) {
                loadWorkspaceContents();
            }

            if (activeFolder) {
                document.getElementById('folderView').classList.remove('hidden');
                loadFolderDocuments(activeFolder.id);
            } else if (previousView === 'dashboard') {
                document.getElementById('dashboardView').classList.remove('hidden');
                renderDashboardGrids();
            } else if (previousView === 'notifications') {
                document.getElementById('notificationsView').classList.remove('hidden');
            } else if (previousView === 'shared') {
                document.getElementById('sharedWithMeView').classList.remove('hidden');
            } else {
                document.getElementById('homeView').classList.remove('hidden');
                renderHomeScreen();
            }
            refreshIcons();
        }

        async function closeWhiteboardView() {
            if (wbRenameTimeout) {
                clearTimeout(wbRenameTimeout);
                wbRenameTimeout = null;
            }

            if (currentDoc && currentDoc.id && token) {
                const titleInput = document.getElementById('whiteboardTitleInput');
                const titleVal = titleInput ? titleInput.value.trim() : (currentDoc.title || 'Untitled Whiteboard');
                try {
                    const res = await fetch(`/documents/${currentDoc.id}/rename`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ title: titleVal || 'Untitled Whiteboard' })
                    });
                    if (res.ok) {
                        const updated = await res.json();
                        currentDoc.title = updated.title;
                        syncDocumentInLists(currentDoc.id, updated.title);
                    }
                } catch (e) {}
            }

            document.getElementById('whiteboardView').classList.add('hidden');
            
            // Restore main sidebar
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');

            if (activeWorkspace) {
                loadWorkspaceContents();
            }

            if (activeFolder) {
                document.getElementById('folderView').classList.remove('hidden');
                loadFolderDocuments(activeFolder.id);
            } else if (previousView === 'dashboard') {
                document.getElementById('dashboardView').classList.remove('hidden');
                renderDashboardGrids();
            } else if (previousView === 'notifications') {
                document.getElementById('notificationsView').classList.remove('hidden');
            } else if (previousView === 'shared') {
                document.getElementById('sharedWithMeView').classList.remove('hidden');
            } else {
                document.getElementById('homeView').classList.remove('hidden');
                renderHomeScreen();
            }
            refreshIcons();
        }

        let activeAccessDocId = null;
        let activeAccessFolderId = null;

        function selectDocShareRole(role, el) {
            const hidden = document.getElementById('shareRoleSelect');
            if (hidden) hidden.value = role;
            document.querySelectorAll('.doc-role-tab').forEach(t => t.classList.remove('active'));
            if (el) el.classList.add('active');
        }

        let docShareSearchTimer = null;
        function setupDocShareAutocomplete(input) {
            if (!input || input.dataset.hasAutocomplete) return;
            input.dataset.hasAutocomplete = 'true';

            input.addEventListener('input', () => {
                const val = input.value.trim();
                const suggestions = document.getElementById('docShareUserSuggestions');
                if (!suggestions) return;

                if (!val || val.length < 1) {
                    suggestions.classList.add('hidden');
                    suggestions.innerHTML = '';
                    return;
                }

                clearTimeout(docShareSearchTimer);
                docShareSearchTimer = setTimeout(async () => {
                    let matches = [];
                    if (typeof getWorkspaceContributorsList === 'function') {
                        const all = getWorkspaceContributorsList();
                        matches = all.filter(c => 
                            (c.name && c.name.toLowerCase().includes(val.toLowerCase())) || 
                            (c.email && c.email.toLowerCase().includes(val.toLowerCase()))
                        ).slice(0, 5);
                    }

                    if (matches.length === 0 && val.length >= 2) {
                        try {
                            const res = await fetch(`/users/search?q=${encodeURIComponent(val)}&limit=5`, {
                                headers: { 'Authorization': 'Bearer ' + token }
                            });
                            if (res.ok) {
                                const users = await res.json();
                                matches = users.map(u => ({
                                    name: u.name,
                                    email: u.email,
                                    role: 'Member'
                                }));
                            }
                        } catch (e) {}
                    }

                    if (matches.length === 0) {
                        suggestions.classList.add('hidden');
                        return;
                    }

                    suggestions.innerHTML = matches.map(m => {
                        const initial = (m.name || m.email || 'U').charAt(0).toUpperCase();
                        return `
                            <div class="doc-share-suggestion-item" onclick="selectDocShareUser('${escapeHtml(m.email)}', '${escapeHtml(m.name)}')">
                                <div class="avatar" style="width: 28px; height: 28px; font-size: 0.75rem; background: #2563eb; flex-shrink: 0; font-weight: 700;">${initial}</div>
                                <div style="min-width: 0; flex: 1;">
                                    <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(m.name || m.email)}</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(m.email)}</div>
                                </div>
                            </div>
                        `;
                    }).join('');
                    suggestions.classList.remove('hidden');
                    refreshIcons();
                }, 150);
            });

            document.addEventListener('click', (e) => {
                if (!input.contains(e.target)) {
                    const suggestions = document.getElementById('docShareUserSuggestions');
                    if (suggestions && !suggestions.contains(e.target)) {
                        suggestions.classList.add('hidden');
                    }
                }
            });
        }

        function selectDocShareUser(email, name) {
            const input = document.getElementById('shareEmailInput');
            if (input) input.value = email;
            const suggestions = document.getElementById('docShareUserSuggestions');
            if (suggestions) suggestions.classList.add('hidden');
        }

        async function openDocumentAccessModal(docId, docTitle, isShareMode = false) {
            activeAccessDocId = docId || (currentDoc ? currentDoc.id : null);
            if (!activeAccessDocId) return;

            const modal = document.getElementById('shareModal');
            const titleEl = document.getElementById('shareModalTitle');
            const subtitleEl = document.getElementById('shareModalSubtitle');
            const avatarEl = document.getElementById('docShareAvatar');
            if (titleEl) {
                if (isShareMode) {
                    titleEl.textContent = docTitle ? `Share: ${docTitle}` : 'Share Document';
                } else {
                    titleEl.textContent = docTitle ? `Access: ${docTitle}` : 'Document Access & Permissions';
                }
            }
            if (subtitleEl) {
                subtitleEl.textContent = isShareMode
                    ? 'Invite collaborators and manage public share links for this document.'
                    : 'Manage workspace collaborator access and permissions for this document.';
            }
            if (avatarEl) {
                avatarEl.innerHTML = isShareMode
                    ? '<i data-lucide="share-2" style="width:19px;height:19px;"></i>'
                    : '<i data-lucide="shield-check" style="width:19px;height:19px;"></i>';
            }

            // Reset role selector to EDITOR default
            const roleSelect = document.getElementById('shareRoleSelect');
            if (roleSelect) roleSelect.value = 'EDITOR';
            document.querySelectorAll('.doc-role-tab').forEach((t, i) => {
                if (i === 0) t.classList.add('active');
                else t.classList.remove('active');
            });

            // Reset input and initialize autocomplete
            const input = document.getElementById('shareEmailInput');
            if (input) {
                input.value = '';
                setupDocShareAutocomplete(input);
            }
            const suggestions = document.getElementById('docShareUserSuggestions');
            if (suggestions) {
                suggestions.classList.add('hidden');
                suggestions.innerHTML = '';
            }

            modal.classList.remove('hidden');
            await loadDocumentPermissions(activeAccessDocId);
            await loadPublicShareLink(activeAccessDocId);
            refreshIcons();
        }

        function openShareModal(docId) {
            const doc = docId ? (documentsList.find(d => d.id === docId) || currentDoc) : currentDoc;
            openDocumentAccessModal(docId, doc ? doc.title : '', true);
        }

        function closeShareModal() {
            document.getElementById('shareModal').classList.add('hidden');
            const suggestions = document.getElementById('docShareUserSuggestions');
            if (suggestions) suggestions.classList.add('hidden');
            activeAccessDocId = null;
            activePublicShareToken = null;
        }

        let activePublicShareToken = null;

        async function loadPublicShareLink(docId) {
            const toggle = document.getElementById('docPublicLinkToggle');
            const details = document.getElementById('docPublicLinkDetails');
            const input = document.getElementById('docPublicLinkInput');
            const roleSelect = document.getElementById('docPublicLinkRole');
            const statusText = document.getElementById('docPublicLinkStatusText');
            if (!toggle || !docId) return;

            activePublicShareToken = null;
            try {
                const res = await fetch(`/documents/${docId}/share-link`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok && res.status === 200) {
                    const data = await res.json();
                    if (data && data.token && data.active) {
                        activePublicShareToken = data.token;
                        toggle.checked = true;
                        if (details) details.classList.remove('hidden');
                        if (roleSelect && data.role) roleSelect.value = data.role;
                        const shareUrl = `${window.location.origin}/share/${data.token}`;
                        if (input) input.value = shareUrl;
                        if (statusText) statusText.textContent = `Active - Anyone with the link has ${data.role ? data.role.toLowerCase() : 'viewer'} access`;
                        refreshIcons();
                        return;
                    }
                }
            } catch (e) {}

            // Inactive state
            toggle.checked = false;
            if (details) details.classList.add('hidden');
            if (input) input.value = '';
            if (statusText) statusText.textContent = 'Anyone with the link can view or collaborate';
            refreshIcons();
        }

        async function togglePublicShareLink(enabled) {
            if (!activeAccessDocId) return;
            const toggle = document.getElementById('docPublicLinkToggle');
            const details = document.getElementById('docPublicLinkDetails');
            const input = document.getElementById('docPublicLinkInput');
            const roleSelect = document.getElementById('docPublicLinkRole');
            const statusText = document.getElementById('docPublicLinkStatusText');

            if (enabled) {
                const selectedRole = roleSelect ? roleSelect.value : 'VIEWER';
                try {
                    const res = await fetch(`/documents/${activeAccessDocId}/share-link`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ role: selectedRole, expiresInDays: 0 })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        activePublicShareToken = data.token;
                        const shareUrl = `${window.location.origin}/share/${data.token}`;
                        if (input) input.value = shareUrl;
                        if (details) details.classList.remove('hidden');
                        if (statusText) statusText.textContent = `Active - Anyone with the link has ${selectedRole.toLowerCase()} access`;
                        toast(`Public share link enabled (${selectedRole.toLowerCase()} access)`);
                        refreshIcons();
                    } else {
                        const err = await res.json().catch(() => ({}));
                        if (toggle) toggle.checked = false;
                        if (details) details.classList.add('hidden');
                        toast(err.message || 'Failed to generate public share link');
                    }
                } catch (e) {
                    if (toggle) toggle.checked = false;
                    if (details) details.classList.add('hidden');
                    toast('Error creating share link');
                }
            } else {
                if (activePublicShareToken) {
                    try {
                        await fetch(`/documents/share-link/${encodeURIComponent(activePublicShareToken)}/revoke`, {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + token }
                        });
                    } catch (e) {}
                    activePublicShareToken = null;
                }
                if (details) details.classList.add('hidden');
                if (input) input.value = '';
                if (statusText) statusText.textContent = 'Public link access disabled';
                toast('Public share link deactivated');
                refreshIcons();
            }
        }

        async function updatePublicShareLinkRole(newRole) {
            if (!activeAccessDocId) return;
            const toggle = document.getElementById('docPublicLinkToggle');
            const input = document.getElementById('docPublicLinkInput');
            const statusText = document.getElementById('docPublicLinkStatusText');

            try {
                const res = await fetch(`/documents/${activeAccessDocId}/share-link`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ role: newRole, expiresInDays: 0 })
                });
                if (res.ok) {
                    const data = await res.json();
                    activePublicShareToken = data.token;
                    const shareUrl = `${window.location.origin}/share/${data.token}`;
                    if (input) input.value = shareUrl;
                    if (toggle) toggle.checked = true;
                    if (statusText) statusText.textContent = `Active - Anyone with the link has ${newRole.toLowerCase()} access`;
                    toast(`Public link updated: ${newRole.toLowerCase()} access`);
                } else {
                    toast('Failed to update public link role');
                }
            } catch (e) {
                toast('Failed to update public link role');
            }
        }

        function copyShareLink() {
            const input = document.getElementById('docPublicLinkInput');
            const copyBtn = document.getElementById('copyShareLinkBtn');
            const copyBtnText = document.getElementById('copyShareLinkBtnText');

            if (!input || !input.value) {
                const toggle = document.getElementById('docPublicLinkToggle');
                if (toggle && !toggle.checked) {
                    toggle.checked = true;
                    togglePublicShareLink(true).then(() => {
                        copyShareLink();
                    });
                    return;
                }
                toast('No active share link to copy');
                return;
            }

            const urlToCopy = input.value;
            const fallbackCopy = () => {
                input.select();
                try {
                    document.execCommand('copy');
                    showCopiedFeedback();
                } catch (err) {
                    toast('Failed to copy link');
                }
            };

            const showCopiedFeedback = () => {
                if (copyBtnText) copyBtnText.textContent = 'Copied!';
                if (copyBtn) {
                    const icon = copyBtn.querySelector('[data-lucide]');
                    if (icon) icon.setAttribute('data-lucide', 'check');
                    refreshIcons();
                }
                toast('Share link copied to clipboard');
                setTimeout(() => {
                    if (copyBtnText) copyBtnText.textContent = 'Copy Link';
                    if (copyBtn) {
                        const icon = copyBtn.querySelector('[data-lucide]');
                        if (icon) icon.setAttribute('data-lucide', 'copy');
                        refreshIcons();
                    }
                }, 2000);
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(urlToCopy).then(showCopiedFeedback).catch(fallbackCopy);
            } else {
                fallbackCopy();
            }
        }

        async function checkIncomingShareLink() {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const shareToken = urlParams.get('share');
                if (!shareToken) return;

                const res = await fetch(`/documents/share/${encodeURIComponent(shareToken)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (!token) {
                        currentUser = { name: 'Guest Collaborator', email: 'guest@syncpad.com', isGuest: true };
                        if (typeof showMainShell === 'function') showMainShell();
                    }
                    const docItem = {
                        id: data.id,
                        title: data.title,
                        content: data.content,
                        fileType: data.fileType,
                        currentUserRole: data.role,
                        pdfUrl: data.pdfUrl,
                        pdfFileName: data.pdfFileName,
                        shareToken: shareToken,
                        isSharedViaLink: true
                    };
                    openItemView(docItem);
                    if (typeof applyDocumentRole === 'function') {
                        applyDocumentRole(data.role);
                    }
                    toast(`Opened shared document with ${data.role.toLowerCase()} access`);
                } else if (res.status === 403 || res.status === 404) {
                    toast('This share link has expired or been revoked');
                }
            } catch (e) {
                console.warn('Share link resolution error:', e);
            }
        }

        async function submitShareInvite() {
            const emailInput = document.getElementById('shareEmailInput');
            const roleSelect = document.getElementById('shareRoleSelect');
            const durationSelect = document.getElementById('shareDurationSelect');
            let email = emailInput ? emailInput.value.trim() : '';
            const role = roleSelect ? roleSelect.value : 'EDITOR';
            const durationHours = durationSelect ? parseInt(durationSelect.value, 10) : 0;

            if (!email) {
                toast('Please enter a collaborator username or email', 'error');
                return;
            }

            // Auto-resolve username to email if no '@' provided
            if (!email.includes('@')) {
                try {
                    let resolved = null;
                    if (typeof getWorkspaceContributorsList === 'function') {
                        const match = getWorkspaceContributorsList().find(c => 
                            (c.name && c.name.toLowerCase() === email.toLowerCase()) || 
                            (c.name && c.name.toLowerCase().startsWith(email.toLowerCase()))
                        );
                        if (match) resolved = match.email;
                    }
                    if (!resolved) {
                        const searchRes = await fetch(`/users/search?q=${encodeURIComponent(email)}&limit=1`, {
                            headers: { 'Authorization': 'Bearer ' + token }
                        });
                        if (searchRes.ok) {
                            const found = await searchRes.json();
                            if (found && found.length > 0 && found[0].email) {
                                resolved = found[0].email;
                            }
                        }
                    }
                    if (resolved) {
                        email = resolved;
                    }
                } catch (err) {
                    console.warn('Could not auto-resolve username to email:', err);
                }
            }

            try {
                if (activeAccessDocId) {
                    const res = await fetch(`/documents/${activeAccessDocId}/share`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ email, role, durationHours: durationHours > 0 ? durationHours : null })
                    });
                    if (res.ok) {
                        toast(`Shared document with ${email} as ${role}${durationHours > 0 ? ` (Expires in ${durationHours}h)` : ''}`);
                        if (emailInput) emailInput.value = '';
                        const suggestions = document.getElementById('docShareUserSuggestions');
                        if (suggestions) suggestions.classList.add('hidden');
                        await loadDocumentPermissions(activeAccessDocId);
                        return;
                    } else {
                        const err = await res.json().catch(() => ({}));
                        toast(err.message || 'Failed to share document', 'error');
                        return;
                    }
                }

                const targetWs = activeWorkspace || (userWorkspaces && userWorkspaces[0]) || null;
                if (!targetWs) {
                    toast('No active workspace found', 'error');
                    return;
                }

                const res = await fetch(`/workspaces/${targetWs.id}/invite`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ email, role })
                });

                if (res.ok) {
                    toast(`Collaboration invitation sent to ${email} as ${role}`);
                    if (emailInput) emailInput.value = '';
                    const suggestions = document.getElementById('docShareUserSuggestions');
                    if (suggestions) suggestions.classList.add('hidden');
                    if (typeof renderWorkspaceMembers === 'function') renderWorkspaceMembers();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to send invitation', 'error');
                }
            } catch (err) {
                toast('Failed to send invitation', 'error');
            }
        }

        async function loadDocumentPermissions(docId) {
            const list = document.getElementById('docPermissionsList');
            const countBadge = document.getElementById('docMembersCountBadge');
            if (!list) return;
            list.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.75rem;">Loading permissions...</div>';

            try {
                const res = await fetch(`/documents/${docId}/permissions`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const permissions = await res.json();
                    if (countBadge) {
                        countBadge.textContent = `${permissions.length} member${permissions.length === 1 ? '' : 's'}`;
                    }
                    renderDocumentPermissionsList(permissions, docId);
                } else {
                    list.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.75rem;">No member list available.</div>';
                }
            } catch (e) {
                list.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.75rem;">Error loading permissions.</div>';
            }
        }

        function renderDocumentPermissionsList(permissions, docId) {
            const list = document.getElementById('docPermissionsList');
            if (!list) return;

            if (!permissions || permissions.length === 0) {
                list.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);text-align:center;padding:1.25rem 0;">All workspace members inherit default access.</div>';
                return;
            }

            list.innerHTML = permissions.map(p => {
                const initial = (p.userName || p.userEmail || 'U').substring(0, 1).toUpperCase();
                const isOwner = p.role === 'OWNER';
                const isRestricted = p.role === 'RESTRICTED';
                const isViewer = p.role === 'VIEWER';
                const isCommenter = p.role === 'COMMENTER';
                const isEditor = p.role === 'EDITOR';
                const isInherited = p.id === null;
                const isMe = currentUser && ((currentUser.email && p.userEmail && currentUser.email.toLowerCase() === p.userEmail.toLowerCase()) || (currentUser.id && p.userId && currentUser.id === p.userId));
                const expiryBadge = p.expiresAt ? `<span class="access-guest-badge">Guest</span>` : '';

                const roleColor = isRestricted ? '#ef4444' : (isOwner ? '#2563eb' : (isEditor ? '#0284c7' : (isCommenter ? '#d97706' : '#059669')));

                let selectHtml = '';
                if (isOwner) {
                    selectHtml = `<span class="access-role-badge" style="--role-color:#2563eb;"><i data-lucide="crown" style="width:13px;height:13px;"></i>Owner</span>`;
                } else {
                    selectHtml = `
                        <select onchange="changeDocumentUserAccess(${docId}, ${p.userId}, '${escapeHtml(p.userEmail)}', this.value)" class="access-role-select access-document-role ${isRestricted ? 'app-select-restricted' : ''}" aria-label="Access for ${escapeHtml(p.userName || p.userEmail)}">
                            <option value="" ${isInherited ? 'selected' : ''}>Default (Workspace)</option>
                            <option value="EDITOR" ${(!isInherited && isEditor) ? 'selected' : ''}>Editor</option>
                            <option value="COMMENTER" ${(!isInherited && isCommenter) ? 'selected' : ''}>Commenter</option>
                            <option value="VIEWER" ${(!isInherited && isViewer) ? 'selected' : ''}>Viewer</option>
                            <option value="RESTRICTED" ${isRestricted ? 'selected' : ''}>Restricted</option>
                        </select>
                    `;
                }

                return `
                    <div class="access-document-member ${isRestricted ? 'is-restricted' : ''}">
                        <div class="access-member-identity">
                            <div class="access-member-avatar" style="--avatar-color:${roleColor};">${initial}</div>
                            <div class="access-member-copy">
                                <div class="access-member-name">
                                    <span>${escapeHtml(p.userName || (p.userEmail ? p.userEmail.split('@')[0] : 'Member'))}</span>
                                    ${isMe ? '<span class="access-you-badge">You</span>' : ''}
                                    ${expiryBadge}
                                </div>
                                <div class="access-member-email">${escapeHtml(p.userEmail || 'No email')}</div>
                            </div>
                        </div>
                        <div class="access-member-actions">
                            ${selectHtml}
                        </div>
                    </div>
                `;
            }).join('');
            refreshIcons();
        }

        async function changeDocumentUserAccess(docId, userId, email, roleValue) {
            try {
                const payload = {
                    userId: userId,
                    email: email,
                    role: roleValue ? roleValue : null
                };
                const res = await fetch(`/documents/${docId}/permissions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const roleLabel = roleValue === 'RESTRICTED' ? 'Restricted' : (roleValue === 'VIEWER' ? 'Viewer' : (roleValue === 'COMMENTER' ? 'Commenter' : (roleValue === 'EDITOR' ? 'Editor' : 'Workspace Default')));
                    toast(`Updated document access for ${email}: ${roleLabel}`);
                    await loadDocumentPermissions(docId);
                    loadWorkspaceContents();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to update document access');
                    await loadDocumentPermissions(docId);
                }
            } catch (e) {
                toast('Failed to update document access');
            }
        }

        // Explicitly attach navigation handlers to global window scope
        window.showHomeView = showHomeView;
        window.showWorkspaceDashboardView = showWorkspaceDashboardView;
        window.showNotificationsView = showNotificationsView;
        window.showSharedWithMeView = showSharedWithMeView;
        window.selectWorkspaceById = selectWorkspaceById;
        window.renderHomeScreen = renderHomeScreen;
        window.renderDashboardGrids = renderDashboardGrids;
        window.createWorkspaceCard = createWorkspaceCard;
        window.createFolderCard = createFolderCard;
        window.loadWorkspaceContents = loadWorkspaceContents;
        window.openItemView = openItemView;
        window.closeEditorView = closeEditorView;
        window.closeWhiteboardView = closeWhiteboardView;
        window.openDocumentAccessModal = openDocumentAccessModal;
        window.openShareModal = openShareModal;
        window.closeShareModal = closeShareModal;
        window.selectDocShareRole = selectDocShareRole;
        window.submitShareInvite = submitShareInvite;
        window.togglePublicShareLink = togglePublicShareLink;
        window.updatePublicShareLinkRole = updatePublicShareLinkRole;
        window.copyShareLink = copyShareLink;
        window.checkIncomingShareLink = checkIncomingShareLink;
        window.loadPublicShareLink = loadPublicShareLink;
