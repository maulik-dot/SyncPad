        // WORKSPACE MANAGEMENT
        async function loadUserWorkspaces() {
            try {
                const res = await fetch('/workspaces', { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) {
                    workspacesList = await res.json();
                } else {
                    workspacesList = [];
                }
            } catch (e) {
                workspacesList = [];
            }

            if (!workspacesList) {
                workspacesList = [];
            }

            if (workspacesList.length > 0) {
                activeWorkspace = workspacesList[0];
            } else {
                activeWorkspace = null;
            }

            renderWorkspaceMenu();
            updateActiveWorkspaceUI();
            loadWorkspaceContents();
            renderHomeScreen();
            renderSharedWithMeScreen();
            loadStarredCount();
        }

        async function loadStarredCount() {
            try {
                const res = await fetchWithAuth('/documents/starred');
                if (res.ok) {
                    const starred = await res.json() || [];
                    rawStarredDocuments = starred;
                    const sideBadge = document.getElementById('sidebarStarredCount');
                    if (sideBadge) {
                        sideBadge.innerText = starred.length;
                        sideBadge.style.display = starred.length > 0 ? 'inline-block' : 'none';
                    }
                }
            } catch (e) {}
        }

        function renderWorkspaceMenu() {
            const list = document.getElementById('workspaceMenuList');
            list.innerHTML = '';
            if (workspacesList.length === 0) {
                list.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);padding:0.5rem;text-align:center;">No workspaces yet</div>';
                return;
            }
            workspacesList.forEach(ws => {
                const isAdmin = isWorkspaceAdmin(ws);
                const isActive = activeWorkspace && ws.id === activeWorkspace.id;
                const btn = document.createElement('button');
                btn.className = `sidebar-item ${isActive ? 'active' : ''}`;
                btn.style.width = '100%'; btn.style.border = 'none'; btn.style.background = 'transparent'; btn.style.display = 'flex'; btn.style.alignItems = 'center'; btn.style.justifyContent = 'space-between';
                btn.onclick = () => selectWorkspace(ws);
                btn.innerHTML = `
                    <div style="display:flex; align-items:center; gap:0.5rem; overflow:hidden;">
                        <div class="avatar" style="width:20px;height:20px;font-size:0.65rem;background:${ws.color || '#2563eb'};flex-shrink:0;">${ws.initial || ws.name.charAt(0)}</div>
                        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.82rem;">${escapeHtml(ws.name)}</span>
                    </div>
                    <span class="notif-badge-pill ${isAdmin ? 'accepted' : 'role'}" style="font-size:0.58rem;padding:0px 5px;text-transform:uppercase;">${isAdmin ? 'Admin' : 'Member'}</span>
                `;
                list.appendChild(btn);
            });
        }

        function selectWorkspace(ws) {
            activeWorkspace = ws;
            renderWorkspaceMenu();
            updateActiveWorkspaceUI();
            loadWorkspaceContents();
            showWorkspaceDashboardView(document.getElementById('navDashboardItem'));
            document.getElementById('workspaceMenu').classList.add('hidden');
            toast(`Switched to workspace: ${ws.name}`);
        }

        function isWorkspaceAdmin(ws) {
            if (!ws || !currentUser) return false;
            if (ws.currentUserRole === 'ADMIN' || ws.currentUserRole === 'OWNER') return true;
            if (ws.role === 'ADMIN' || ws.role === 'OWNER') return true;
            if (ws.ownerId && currentUser.id && ws.ownerId === currentUser.id) return true;
            if (ws.owner) {
                if (ws.owner.email && currentUser.email && ws.owner.email.toLowerCase() === currentUser.email.toLowerCase()) return true;
                if (ws.owner.id && currentUser.id && ws.owner.id === currentUser.id) return true;
            }
            if (!ws.owner) return true;
            return false;
        }

        function toggleWorkspaceMenu() {
            document.getElementById('workspaceMenu').classList.toggle('hidden');
            refreshIcons();
        }

        function updateActiveWorkspaceUI() {
            if (!activeWorkspace) {
                const currentName = document.getElementById('wsCurrentName');
                const initialBadge = document.getElementById('wsInitialBadge');
                const title = document.getElementById('activeWorkspaceTitle');
                const desc = document.getElementById('activeWorkspaceDesc');
                const deleteBtn = document.getElementById('activeWsDeleteBtn');
                const renameBtn = document.getElementById('activeWsRenameBtn');
                const leaveBtn = document.getElementById('activeWsLeaveBtn');
                const roleBadge = document.getElementById('activeWorkspaceRoleBadge');

                if (currentName) currentName.innerText = 'No Workspace';
                if (initialBadge) {
                    initialBadge.innerText = '+';
                    initialBadge.style.background = 'var(--accent-primary)';
                }
                if (title) title.innerText = 'No Workspace Selected';
                if (desc) desc.innerText = 'Create a workspace using the "+" button to start organizing folders and documents.';
                if (deleteBtn) deleteBtn.style.display = 'none';
                if (renameBtn) renameBtn.style.display = 'none';
                if (leaveBtn) leaveBtn.style.display = 'none';
                if (roleBadge) {
                    roleBadge.innerText = 'None';
                    roleBadge.className = 'notif-badge-pill role';
                }
                refreshIcons();
                return;
            }

            document.getElementById('wsCurrentName').innerText = activeWorkspace.name;
            document.getElementById('wsInitialBadge').innerText = activeWorkspace.initial || activeWorkspace.name.charAt(0);
            document.getElementById('wsInitialBadge').style.background = activeWorkspace.color || '#2563eb';
            
            document.getElementById('activeWorkspaceTitle').innerText = activeWorkspace.name;
            document.getElementById('activeWorkspaceDesc').innerText = activeWorkspace.description || 'Collaborative workspace environment';

            const isAdmin = isWorkspaceAdmin(activeWorkspace);
            const isOwner = currentUser && activeWorkspace.owner && (activeWorkspace.owner.email === currentUser.email || activeWorkspace.owner.id === currentUser.id);
            const deleteBtn = document.getElementById('activeWsDeleteBtn');
            const renameBtn = document.getElementById('activeWsRenameBtn');
            const leaveBtn = document.getElementById('activeWsLeaveBtn');
            const roleBadge = document.getElementById('activeWorkspaceRoleBadge');

            if (deleteBtn) deleteBtn.style.display = isAdmin ? 'inline-flex' : 'none';
            if (renameBtn) renameBtn.style.display = isAdmin ? 'inline-flex' : 'none';
            if (leaveBtn) leaveBtn.style.display = (!isOwner) ? 'inline-flex' : 'none';

            if (roleBadge) {
                let roleText = 'Member';
                if (isOwner) roleText = 'Owner';
                else if (isAdmin) roleText = 'Admin';
                else if (activeWorkspace.currentUserRole) roleText = activeWorkspace.currentUserRole;

                roleBadge.innerText = roleText;
                roleBadge.className = `notif-badge-pill ${isAdmin ? 'accepted' : 'role'}`;
            }
            refreshIcons();
        }


        // WORKSPACE & ITEM CREATION
        function openNewWorkspaceContainerModal() {
            document.getElementById('workspaceMenu').classList.add('hidden');
            document.getElementById('newWorkspaceModal').classList.remove('hidden');
            refreshIcons();
        }

        function closeNewWorkspaceContainerModal() {
            document.getElementById('newWorkspaceModal').classList.add('hidden');
        }

        async function handleCreateWorkspaceSubmit(e) {
            e.preventDefault();
            const name = document.getElementById('wsNameInput').value;
            const description = document.getElementById('wsDescInput').value;

            try {
                const res = await fetch('/workspaces', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ name, description, color: '#2563eb' })
                });
                if (res.ok) {
                    const newWs = await res.json();
                    workspacesList.unshift(newWs);
                    selectWorkspace(newWs);
                } else {
                    const newWs = { id: Date.now(), name, description, initial: name.charAt(0).toUpperCase(), color: '#2563eb' };
                    workspacesList.unshift(newWs);
                    selectWorkspace(newWs);
                }
            } catch (err) {
                const newWs = { id: Date.now(), name, description, initial: name.charAt(0).toUpperCase(), color: '#2563eb' };
                workspacesList.unshift(newWs);
                selectWorkspace(newWs);
            }
            closeNewWorkspaceContainerModal();
            renderHomeScreen();
        }

        function openCreateModal() {
            const modal = document.getElementById('createModal');
            if (modal) {
                modal.classList.remove('hidden');
                refreshIcons();
            }
        }

        function closeCreateModal() {
            const modal = document.getElementById('createModal');
            if (modal) {
                modal.classList.add('hidden');
            }
        }

        function openCreateFolderModal() { document.getElementById('createFolderModal').classList.remove('hidden'); refreshIcons(); }
        function closeCreateFolderModal() { document.getElementById('createFolderModal').classList.add('hidden'); }

        async function handleCreateFolderSubmit(e) {
            e.preventDefault();
            const name = document.getElementById('folderNameInput').value;
            try {
                const res = await fetch('/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ name, workspaceName: activeWorkspace.name })
                });
                if (res.ok) {
                    const newFolder = await res.json();
                    foldersList.unshift(newFolder);
                } else {
                    foldersList.unshift({ id: Date.now(), name, workspaceName: activeWorkspace.name });
                }
            } catch (err) {
                foldersList.unshift({ id: Date.now(), name, workspaceName: activeWorkspace.name });
            }
            renderDashboardGrids();
            renderHomeScreen();
            closeCreateFolderModal();
            toast(`Created folder: ${name}`);
        }

        async function submitCreateWorkspaceItem(type) {
            const title = type === 'DOC' ? 'Untitled Document' : 'Untitled Whiteboard';
            const wsName = activeWorkspace ? activeWorkspace.name : null;
            try {
                const res = await fetch('/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ title, content: '', fileType: type, workspaceName: wsName })
                });
                if (res.ok) {
                    const newItem = await res.json();
                    documentsList.unshift(newItem);
                    openItemView(newItem);
                } else {
                    const newItem = { id: Date.now(), title, fileType: type, content: '# ' + title, workspaceName: wsName };
                    documentsList.unshift(newItem);
                    openItemView(newItem);
                }
            } catch (err) {
                const newItem = { id: Date.now(), title, fileType: type, content: '# ' + title, workspaceName: wsName };
                documentsList.unshift(newItem);
                openItemView(newItem);
            }
            renderDashboardGrids();
            renderHomeScreen();
            closeCreateModal();
        }

        // RENAME CONTROLS
        function openRenameModal(type, id, currentName) {
            renameTarget = { type, id, name: currentName };
            document.getElementById('renameModalTitle').innerText = `Rename ${type.toUpperCase()}`;
            document.getElementById('renameInput').value = currentName;
            document.getElementById('renameModal').classList.remove('hidden');
            refreshIcons();
        }

        function closeRenameModal() { document.getElementById('renameModal').classList.add('hidden'); }

        async function handleRenameSubmit(e) {
            e.preventDefault();
            if (!renameTarget) return;
            const newName = document.getElementById('renameInput').value;

            if (renameTarget.type === 'workspace') {
                try {
                    await fetch(`/workspaces/${renameTarget.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ name: newName, description: activeWorkspace.description, color: activeWorkspace.color })
                    });
                } catch (err) {}
                activeWorkspace.name = newName;
                updateActiveWorkspaceUI();
                renderWorkspaceMenu();
            } else if (renameTarget.type === 'folder') {
                try {
                    await fetch(`/folders/${renameTarget.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ name: newName, workspaceName: activeWorkspace.name })
                    });
                } catch (err) {}
                const f = foldersList.find(item => item.id === renameTarget.id);
                if (f) f.name = newName;
                if (activeFolder && activeFolder.id === renameTarget.id) {
                    activeFolder.name = newName;
                    document.getElementById('activeFolderName').innerText = newName;
                    document.getElementById('folderNameBreadcrumb').innerText = newName;
                }
            } else if (renameTarget.type === 'doc') {
                try {
                    const res = await fetchWithAuth(`/documents/${renameTarget.id}/rename`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: newName })
                    });
                    if (res && res.ok) {
                        const updated = await res.json();
                        const d = documentsList.find(item => item.id === renameTarget.id);
                        if (d) Object.assign(d, updated);
                        const fd = folderDocumentsList.find(item => item.id === renameTarget.id);
                        if (fd) Object.assign(fd, updated);
                        const sd = rawStarredDocuments.find(item => item.id === renameTarget.id);
                        if (sd) Object.assign(sd, updated);
                        if (currentDoc && currentDoc.id === renameTarget.id) {
                            Object.assign(currentDoc, updated);
                            const titleInput = document.getElementById('docTitleInput');
                            if (titleInput) titleInput.value = updated.title || newName;
                            const bc = document.getElementById('docTitleBreadcrumb');
                            if (bc) bc.innerText = updated.title || newName;
                            const wsTitle = document.getElementById('docWorkspaceTitle');
                            if (wsTitle && updated.title) wsTitle.innerText = updated.title;
                        }
                        if (activeFolder) renderFolderFiles();
                    } else {
                        const d = documentsList.find(item => item.id === renameTarget.id);
                        if (d) d.title = newName;
                        const fd = folderDocumentsList.find(item => item.id === renameTarget.id);
                        if (fd) fd.title = newName;
                        if (currentDoc && currentDoc.id === renameTarget.id) {
                            currentDoc.title = newName;
                            const ti = document.getElementById('docTitleInput');
                            if (ti) ti.value = newName;
                        }
                    }
                } catch (err) {
                    const d = documentsList.find(item => item.id === renameTarget.id);
                    if (d) d.title = newName;
                    const fd = folderDocumentsList.find(item => item.id === renameTarget.id);
                    if (fd) fd.title = newName;
                    if (currentDoc && currentDoc.id === renameTarget.id) currentDoc.title = newName;
                }
            }

            renderDashboardGrids();
            renderHomeScreen();
            closeRenameModal();
            toast(`Renamed successfully to "${newName}"`);
        }

        // DELETE CONTROLS
        async function deleteFolderItem(id) {
            try {
                await fetch(`/folders/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            } catch (e) {}
            foldersList = foldersList.filter(f => f.id !== id);
            if (activeFolder && activeFolder.id === id) {
                closeFolderView();
            }
            renderDashboardGrids();
            renderHomeScreen();
            toast('Folder deleted from database');
        }

        async function deleteWorkspaceItem(id) {
            try {
                await fetch(`/documents/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            } catch (e) {}
            documentsList = documentsList.filter(d => d.id !== id);
            folderDocumentsList = folderDocumentsList.filter(d => d.id !== id);
            if (activeFolder) renderFolderFiles();
            renderDashboardGrids();
            renderHomeScreen();
            toast('File deleted from database');
        }

        async function deleteActiveWorkspace() {
            if (!activeWorkspace) return;
            if (!isWorkspaceAdmin(activeWorkspace)) {
                toast('Only the workspace admin can delete this workspace');
                return;
            }
            if (workspacesList.length <= 1) {
                toast('Cannot delete the only active workspace');
                return;
            }
            if (!confirm(`Are you sure you want to delete workspace "${activeWorkspace.name}"? This action cannot be undone.`)) {
                return;
            }
            const name = activeWorkspace.name;
            const targetId = activeWorkspace.id;
            try {
                const res = await fetch(`/workspaces/${targetId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    workspacesList = workspacesList.filter(w => w.id !== targetId);
                    selectWorkspace(workspacesList[0]);
                    renderHomeScreen();
                    toast(`Deleted workspace: ${name}`);
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to delete workspace');
                }
            } catch (e) {
                toast('Failed to delete workspace');
            }
        }

        // WORKSPACE SHARE & COLLABORATION MODAL
        function openWorkspaceShareModal() {
            if (!activeWorkspace) return;
            
            const avatarEl = document.getElementById('wsShareAvatar');
            const subTitleEl = document.getElementById('wsShareSubtitle');
            const adminBadgeEl = document.getElementById('wsShareAdminBadge');
            if (avatarEl) {
                avatarEl.innerText = activeWorkspace.initial || (activeWorkspace.name ? activeWorkspace.name.charAt(0).toUpperCase() : 'W');
                avatarEl.style.background = activeWorkspace.color || '#2563eb';
            }
            if (subTitleEl) {
                subTitleEl.innerText = `Workspace: ${activeWorkspace.name || 'Untitled'}`;
            }

            const isAdmin = isWorkspaceAdmin(activeWorkspace);
            if (adminBadgeEl) {
                adminBadgeEl.innerText = isAdmin ? 'Admin Access' : 'Member View';
                adminBadgeEl.style.color = isAdmin ? 'var(--accent-primary)' : 'var(--text-muted)';
                adminBadgeEl.style.background = isAdmin ? 'rgba(37,99,235,0.1)' : 'var(--bg-hover)';
            }

            const inviteBox = document.getElementById('wsInviteBox');
            if (inviteBox) {
                if (isAdmin) {
                    inviteBox.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <label class="input-label" style="font-weight: 600; font-size: 0.82rem; margin: 0; display: flex; align-items: center; gap: 0.45rem;">
                                <i data-lucide="user-plus" style="width: 14px; height: 14px; color: var(--accent-primary);"></i>
                                <span>Invite Collaborator</span>
                            </label>
                            <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">Real-time sync access</span>
                        </div>
                        
                        <div style="margin-bottom: 0.7rem;">
                            <div class="ws-role-pill-group">
                                <button type="button" class="ws-role-tab active" onclick="selectWorkspaceInviteRole('EDITOR', this)">
                                    <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
                                    <span>Editor</span>
                                </button>
                                <button type="button" class="ws-role-tab" onclick="selectWorkspaceInviteRole('ADMIN', this)">
                                    <i data-lucide="shield-check" style="width: 13px; height: 13px;"></i>
                                    <span>Admin</span>
                                </button>
                                <button type="button" class="ws-role-tab" onclick="selectWorkspaceInviteRole('VIEWER', this)">
                                    <i data-lucide="eye" style="width: 13px; height: 13px;"></i>
                                    <span>Viewer</span>
                                </button>
                            </div>
                            <input type="hidden" id="wsInviteRole" value="EDITOR">
                        </div>

                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <div style="position: relative; flex: 1; min-width: 0;">
                                <i data-lucide="mail" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--text-muted); pointer-events: none;"></i>
                                <input type="email" id="wsInviteEmail" class="input" placeholder="colleague@company.com" onkeydown="if(event.key==='Enter') submitWorkspaceInvite()" style="padding-left: 2.35rem; font-size: 0.84rem; height: 38px; width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);">
                            </div>
                            <button id="wsInviteSubmitBtn" type="button" class="btn btn-primary" onclick="submitWorkspaceInvite()" style="font-size: 0.84rem; padding: 0 1.1rem; height: 38px; display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap; border-radius: var(--radius-sm); font-weight: 600;">
                                <i data-lucide="send" style="width: 14px; height: 14px;"></i>
                                <span>Send Invite</span>
                            </button>
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.55rem; display: flex; align-items: center; gap: 0.35rem;">
                            <i data-lucide="info" style="width: 13px; height: 13px; color: var(--accent-primary); flex-shrink: 0;"></i>
                            <span>The invitee will receive an instant notification with Accept / Decline options.</span>
                        </div>
                    `;
                } else {
                    inviteBox.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.75rem; color: var(--text-secondary); font-size: 0.8rem; padding: 0.35rem 0.2rem;">
                            <div style="width:34px;height:34px;border-radius:50%;background:rgba(37,99,235,0.1);display:flex;align-items:center;justify-content:center;color:var(--accent-primary);flex-shrink:0;">
                                <i data-lucide="shield" style="width:17px;height:17px;"></i>
                            </div>
                            <div>
                                <div style="font-weight:600;font-size:0.84rem;color:var(--text-primary);">Collaborator Access</div>
                                <div style="font-size:0.73rem;color:var(--text-muted);margin-top:2px;">You have member access to this workspace. Only workspace admins can invite new members or manage roles.</div>
                            </div>
                        </div>
                    `;
                }
            }

            renderWorkspaceMembers();
            document.getElementById('workspaceShareModal').classList.remove('hidden');
            refreshIcons();
            setTimeout(() => {
                const emailInput = document.getElementById('wsInviteEmail');
                if (emailInput && isAdmin) emailInput.focus();
            }, 100);
        }

        function openWorkspaceShareModalById(wsId) {
            const ws = workspacesList.find(w => w.id === wsId);
            if (ws) {
                activeWorkspace = ws;
                updateActiveWorkspaceUI();
            }
            openWorkspaceShareModal();
        }

        function closeWorkspaceShareModal() { 
            document.getElementById('workspaceShareModal').classList.add('hidden'); 
            hideRoleDropdowns();
        }

        async function renderWorkspaceMembers() {
            const list = document.getElementById('wsMembersList');
            const countBadge = document.getElementById('wsMembersCountBadge');
            const headerAvatarGroup = document.getElementById('wsMembersAvatarGroup');
            if (!activeWorkspace || !list) return;

            list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:1rem 0;text-align:center;"><i data-lucide="loader-2" class="spin" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Loading members...</div>';
            refreshIcons();

            try {
                const res = await fetch(`/workspaces/${activeWorkspace.id}/members`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const members = await res.json();
                    if (countBadge) {
                        countBadge.innerText = `${members.length} ${members.length === 1 ? 'member' : 'members'}`;
                    }

                    // Update header avatar group on dashboard
                    if (headerAvatarGroup) {
                        headerAvatarGroup.innerHTML = members.slice(0, 4).map(m => {
                            const u = m.user || {};
                            const userName = m.userName || u.name || (m.userEmail ? m.userEmail.split('@')[0] : 'Member');
                            const initial = (userName.charAt(0) || 'U').toUpperCase();
                            const isOwner = m.role === 'OWNER';
                            const isAdmin = m.role === 'ADMIN';
                            return `<div class="avatar" style="width:28px;height:28px;font-size:0.72rem;background:${isOwner ? '#2563eb' : (isAdmin ? '#8b5cf6' : '#059669')};" title="${escapeHtml(userName)} (${m.role})">${initial}</div>`;
                        }).join('');
                        if (members.length > 4) {
                            headerAvatarGroup.innerHTML += `<div class="avatar" style="width:28px;height:28px;font-size:0.68rem;background:var(--bg-hover);color:var(--text-secondary);" title="${members.length - 4} more">+${members.length - 4}</div>`;
                        }
                    }

                    if (members.length === 0) {
                        list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:1rem 0;text-align:center;">No members found in this workspace.</div>';
                        return;
                    }
                    list.innerHTML = members.map(m => {
                        const u = m.user || {};
                        const userId = m.userId || u.id;
                        const userName = m.userName || u.name || (m.userEmail ? m.userEmail.split('@')[0] : 'Member');
                        const userEmail = m.userEmail || u.email || '';
                        const initial = (userName.charAt(0) || 'U').toUpperCase();
                        const role = m.role || 'MEMBER';
                        const isOwner = role === 'OWNER';
                        const isAdmin = role === 'ADMIN';
                        const isEditor = role === 'EDITOR';
                        const isViewer = role === 'VIEWER';
                        const isCurrentUser = currentUser && ((userEmail && currentUser.email && currentUser.email.toLowerCase() === userEmail.toLowerCase()) || (userId && currentUser.id && currentUser.id === userId));
                        const isCurrentAdmin = isWorkspaceAdmin(activeWorkspace);

                        let roleBadgeColor = '#64748b';
                        let roleIcon = 'eye';
                        let roleDisplayName = 'Viewer';
                        let roleTextColor = 'var(--text-secondary)';

                        if (isOwner) {
                            roleBadgeColor = '#2563eb';
                            roleIcon = 'crown';
                            roleDisplayName = 'Owner';
                            roleTextColor = '#2563eb';
                        } else if (isAdmin) {
                            roleBadgeColor = '#8b5cf6';
                            roleIcon = 'shield-check';
                            roleDisplayName = 'Admin';
                            roleTextColor = '#8b5cf6';
                        } else if (isEditor) {
                            roleBadgeColor = '#2563eb';
                            roleBadgeColor = '#0284c7';
                            roleIcon = 'edit-3';
                            roleDisplayName = 'Editor';
                            roleTextColor = '#2563eb';
                            roleTextColor = '#0284c7';
                        }

                        let controlsHtml = '';
                        if (isOwner) {
                            controlsHtml = `<span class="notif-badge-pill accepted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="crown" style="width:11px;height:11px;"></i> OWNER</span>`;
                            controlsHtml = `<span style="font-size:0.72rem; font-weight:700; color:#2563eb; background:rgba(37,99,235,0.1); border:1px solid rgba(37,99,235,0.25); border-radius:var(--radius-full); padding:0.25rem 0.65rem; display:inline-flex; align-items:center; gap:0.3rem;"><i data-lucide="crown" style="width:12px;height:12px;"></i> OWNER</span>`;
                        } else if (isCurrentAdmin && !isCurrentUser) {
                            controlsHtml = `
                                <div class="role-dropdown-container" style="position: relative;">
                                    <button type="button" class="btn btn-outline" onclick="toggleMemberRoleDropdown(${u.id}, event)" style="font-size:0.72rem; padding:0.22rem 0.55rem; height:28px; border-radius:var(--radius-sm); display:inline-flex; align-items:center; gap:0.35rem; font-weight:600; color:${roleTextColor};">
                                <div class="role-dropdown-container">
                                    <button type="button" class="btn btn-outline role-dropdown-btn" onclick="toggleMemberRoleDropdown(${userId}, event)" style="font-size:0.75rem; padding:0.25rem 0.6rem; height:28px; border-radius:var(--radius-sm); display:inline-flex; align-items:center; gap:0.35rem; font-weight:600; color:${roleTextColor}; border:1px solid var(--border-color); background:var(--bg-surface); cursor:pointer;">
                                        <i data-lucide="${roleIcon}" style="width:13px;height:13px;"></i>
                                        <span>${roleDisplayName}</span>
                                        <i data-lucide="chevron-down" style="width:11px;height:11px;color:var(--text-muted);margin-left:2px;"></i>
                                    </button>
                                    <div id="roleDropdown-${u.id}" class="role-dropdown-menu hidden" style="position: absolute; right: 0; top: 100%; margin-top: 4px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-md); z-index: 100; min-width: 135px; padding: 4px; display: flex; flex-direction: column; gap: 2px;">
                                        <button type="button" class="role-option-btn ${isAdmin ? 'active' : ''}" onclick="changeMemberRole(${activeWorkspace.id}, ${u.id}, 'ADMIN'); hideRoleDropdowns();">
                                    <div id="roleDropdown-${userId}" class="role-dropdown-menu hidden">
                                        <button type="button" class="role-option-btn ${isAdmin ? 'active' : ''}" onclick="changeMemberRole(${activeWorkspace.id}, ${userId}, 'ADMIN'); hideRoleDropdowns();">
                                            <i data-lucide="shield-check" style="width:14px;height:14px;color:#8b5cf6;"></i>
                                            <span style="font-weight:600;font-size:0.75rem;">Admin</span>
                                            <div>
                                                <div style="font-weight:600;font-size:0.76rem;">Admin</div>
                                                <div style="font-size:0.68rem;color:var(--text-muted);">Can invite & manage</div>
                                            </div>
                                        </button>
                                        <button type="button" class="role-option-btn ${isEditor ? 'active' : ''}" onclick="changeMemberRole(${activeWorkspace.id}, ${u.id}, 'EDITOR'); hideRoleDropdowns();">
                                            <i data-lucide="edit-3" style="width:14px;height:14px;color:#2563eb;"></i>
                                            <span style="font-weight:600;font-size:0.75rem;">Editor</span>
                                        <button type="button" class="role-option-btn ${isEditor ? 'active' : ''}" onclick="changeMemberRole(${activeWorkspace.id}, ${userId}, 'EDITOR'); hideRoleDropdowns();">
                                            <i data-lucide="edit-3" style="width:14px;height:14px;color:#0284c7;"></i>
                                            <div>
                                                <div style="font-weight:600;font-size:0.76rem;">Editor</div>
                                                <div style="font-size:0.68rem;color:var(--text-muted);">Can edit documents</div>
                                            </div>
                                        </button>
                                        <button type="button" class="role-option-btn ${isViewer ? 'active' : ''}" onclick="changeMemberRole(${activeWorkspace.id}, ${u.id}, 'VIEWER'); hideRoleDropdowns();">
                                        <button type="button" class="role-option-btn ${isViewer ? 'active' : ''}" onclick="changeMemberRole(${activeWorkspace.id}, ${userId}, 'VIEWER'); hideRoleDropdowns();">
                                            <i data-lucide="eye" style="width:14px;height:14px;color:#64748b;"></i>
                                            <span style="font-weight:600;font-size:0.75rem;">Viewer</span>
                                            <div>
                                                <div style="font-weight:600;font-size:0.76rem;">Viewer</div>
                                                <div style="font-size:0.68rem;color:var(--text-muted);">Read-only access</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                                <button onclick="removeWorkspaceMember(${u.id})" class="btn btn-icon" title="Remove member" style="color:var(--danger);padding:3px;width:26px;height:26px;"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
                                <button onclick="removeWorkspaceMember(${userId})" class="btn btn-icon" title="Remove collaborator" style="color:var(--destructive);padding:4px;width:28px;height:28px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
                            `;
                        } else if (isCurrentUser) {
                            controlsHtml = `
                                <span class="notif-badge-pill ${isAdmin ? 'accepted' : 'role'}" style="font-size:0.68rem; font-weight:600; text-transform:uppercase; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="${roleIcon}" style="width:11px;height:11px;"></i> ${role}</span>
                                <button onclick="leaveWorkspace(${activeWorkspace.id})" class="btn btn-outline" style="font-size:0.7rem;padding:0.2rem 0.5rem;color:var(--danger);border-color:var(--border-color);display:inline-flex;align-items:center;gap:0.25rem;"><i data-lucide="log-out" style="width:12px;height:12px;"></i> Leave</button>
                                <span style="font-size:0.72rem; font-weight:600; color:${roleTextColor}; background:var(--bg-hover); border:1px solid var(--border-color); border-radius:var(--radius-full); padding:0.22rem 0.6rem; display:inline-flex; align-items:center; gap:0.3rem;"><i data-lucide="${roleIcon}" style="width:12px;height:12px;"></i> ${roleDisplayName}</span>
                                <button onclick="leaveWorkspace(${activeWorkspace.id})" class="btn btn-outline" style="font-size:0.72rem;padding:0.22rem 0.55rem;height:28px;color:var(--destructive);border-color:var(--border-color);display:inline-flex;align-items:center;gap:0.3rem;border-radius:var(--radius-sm);"><i data-lucide="log-out" style="width:12px;height:12px;"></i> Leave</button>
                            `;
                        } else {
                            controlsHtml = `<span class="notif-badge-pill role" style="font-size:0.68rem; font-weight:600; text-transform:uppercase; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="${roleIcon}" style="width:11px;height:11px;"></i> ${role}</span>`;
                            controlsHtml = `<span style="font-size:0.72rem; font-weight:600; color:${roleTextColor}; background:var(--bg-hover); border:1px solid var(--border-color); border-radius:var(--radius-full); padding:0.22rem 0.6rem; display:inline-flex; align-items:center; gap:0.3rem;"><i data-lucide="${roleIcon}" style="width:12px;height:12px;"></i> ${roleDisplayName}</span>`;
                        }

                        return `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.55rem 0.65rem; border-radius: var(--radius-sm); background: var(--bg-surface); border: 1px solid var(--border-color); gap: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
                                    <div class="avatar" style="background:${roleBadgeColor}; width:32px; height:32px; font-size:0.8rem; font-weight:600; flex-shrink: 0;">${initial}</div>
                            <div class="ws-member-item">
                                <div style="display: flex; align-items: center; gap: 0.7rem; min-width: 0;">
                                    <div class="avatar" style="background:${roleBadgeColor}; width:34px; height:34px; font-size:0.82rem; font-weight:700; color:#fff; border-radius:var(--radius-sm); flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">${initial}</div>
                                    <div style="min-width:0;">
                                        <div style="font-size: 0.83rem; font-weight: 600; color: var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHtml(userName)} ${isCurrentUser ? '<span style="font-size:0.7rem;color:var(--text-muted);font-weight:400;">(You)</span>' : ''}</div>
                                        <div style="font-size: 0.72rem; color: var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHtml(userEmail)}</div>
                                        <div style="font-size: 0.84rem; font-weight: 600; color: var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:flex; align-items:center; gap:0.35rem;">
                                            <span>${escapeHtml(userName)}</span>
                                            ${isCurrentUser ? '<span style="font-size:0.68rem;padding:1px 5px;border-radius:4px;background:rgba(37,99,235,0.12);color:var(--accent-primary);font-weight:600;">You</span>' : ''}
                                        </div>
                                        <div style="font-size: 0.73rem; color: var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHtml(userEmail || 'No email provided')}</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink: 0;">
                                <div style="display:flex; align-items:center; gap:0.45rem; flex-shrink: 0;">
                                    ${controlsHtml}
                                </div>
                            </div>
                        `;
                    }).join('');
                    refreshIcons();
                } else {
                    list.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);padding:0.75rem 0;text-align:center;">Could not load members.</div>';
                    list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:1rem 0;text-align:center;">Could not load workspace members.</div>';
                }
            } catch (err) {
                list.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);padding:0.75rem 0;text-align:center;">Could not load members.</div>';
                list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:1rem 0;text-align:center;">Could not load workspace members.</div>';
            }
        }

        function selectWorkspaceInviteRole(role, el) {
            const roleInput = document.getElementById('wsInviteRole');
            if (roleInput) roleInput.value = role;
            document.querySelectorAll('.ws-role-tab').forEach(b => b.classList.remove('active'));
            if (el) el.classList.add('active');
            refreshIcons();
        }

        function toggleMemberRoleDropdown(userId, event) {
            if (event) event.stopPropagation();
            const dropdown = document.getElementById(`roleDropdown-${userId}`);
            if (!dropdown) return;
            const isHidden = dropdown.classList.contains('hidden');
            hideRoleDropdowns();
            if (isHidden) {
                const btn = event && (event.currentTarget || event.target?.closest('button'));
                if (btn) {
                    const rect = btn.getBoundingClientRect();
                    dropdown.style.position = 'fixed';
                    dropdown.style.right = 'auto';
                    dropdown.style.left = `${Math.max(10, rect.right - 165)}px`;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 150) {
                        dropdown.style.top = `${rect.top - 125}px`;
                    } else {
                        dropdown.style.top = `${rect.bottom + 4}px`;
                    }
                    dropdown.style.zIndex = '99999';
                }
                dropdown.classList.remove('hidden');
                refreshIcons();
            }
        }

        function hideRoleDropdowns() {
            document.querySelectorAll('.role-dropdown-menu').forEach(m => m.classList.add('hidden'));
        }

        window.addEventListener('click', (e) => {
            if (!e.target.closest('.role-dropdown-container') && !e.target.closest('.role-dropdown-menu')) {
                hideRoleDropdowns();
            }
        });
        window.addEventListener('scroll', hideRoleDropdowns, true);

        async function changeMemberRole(workspaceId, userId, newRole) {
            try {
                const res = await fetch(`/workspaces/${workspaceId}/members/${userId}/role`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ role: newRole })
                });
                if (res.ok) {
                    toast(`Role updated to ${newRole}`);
                    renderWorkspaceMembers();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to update member role');
                    renderWorkspaceMembers();
                }
            } catch (e) {
                toast('Failed to update member role');
                renderWorkspaceMembers();
            }
        }

        async function leaveActiveWorkspace() {
            if (!activeWorkspace) return;
            await leaveWorkspace(activeWorkspace.id);
        }

        async function leaveWorkspace(wsId) {
            if (!currentUser || !confirm('Leave this workspace? You will no longer have access to its documents and folders.')) return;
            try {
                const res = await fetch(`/workspaces/${wsId}/members/${currentUser.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    toast('Left workspace');
                    closeWorkspaceShareModal();
                    await loadUserWorkspaces();
                    if (activeWorkspace && activeWorkspace.id === wsId) {
                        if (workspacesList.length > 0) {
                            switchWorkspace(workspacesList[0].id);
                        } else {
                            showHomeView(document.getElementById('navHomeItem'));
                        }
                    }
                } else {
                    toast('Failed to leave workspace');
                }
            } catch (e) {
                toast('Failed to leave workspace');
            }
        }

        async function submitWorkspaceInvite() {
            const emailInput = document.getElementById('wsInviteEmail');
            const roleSelect = document.getElementById('wsInviteRole');
            const submitBtn = document.getElementById('wsInviteSubmitBtn');
            if (!emailInput) return;
            const email = emailInput.value.trim();
            const role = roleSelect ? roleSelect.value : 'EDITOR';

            if (!email) {
                toast('Please enter a collaborator email address');
                emailInput.focus();
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                toast('Please enter a valid email address');
                emailInput.focus();
                return;
            }
            if (!activeWorkspace) {
                toast('No active workspace selected');
                return;
            }

            let origBtnHtml = '';
            if (submitBtn) {
                origBtnHtml = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width:14px;height:14px;"></i> <span>Sending...</span>';
                refreshIcons();
            }

            try {
                const res = await fetch(`/workspaces/${activeWorkspace.id}/invite`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ email, role })
                });

                if (res.ok) {
                    toast(`Invitation sent to ${email}`);
                    emailInput.value = '';
                    renderWorkspaceMembers();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast(err.message || 'Failed to send invitation');
                }
            } catch (err) {
                toast('Failed to send invitation');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = origBtnHtml || '<i data-lucide="send" style="width:14px;height:14px;"></i> <span>Send Invite</span>';
                    refreshIcons();
                }
            }
        }

        async function removeWorkspaceMember(userId) {
            if (!activeWorkspace || !confirm('Remove this collaborator from the workspace?')) return;
            try {
                const res = await fetch(`/workspaces/${activeWorkspace.id}/members/${userId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    toast('Member removed');
                    renderWorkspaceMembers();
                } else {
                    toast('Failed to remove member');
                }
            } catch (e) {
                toast('Failed to remove member');
            }
        }

        function canEditCurrentDoc() {
            if (!currentDoc) return false;
            const role = (currentDoc.currentUserRole || '').toUpperCase();
            if (role === 'VIEWER' || role === 'COMMENTER' || role === 'RESTRICTED') {
                return false;
            }
            return true;
        }

        function applyDocumentRole(role) {
            const normalizedRole = (role || 'EDITOR').toUpperCase();
            if (currentDoc) {
                currentDoc.currentUserRole = normalizedRole;
            }

            const sheet = document.getElementById('docPageSheet');
            const titleInput = document.getElementById('docTitleInput');
            const toolbar = document.getElementById('docToolbar');
            const badge = document.getElementById('docRoleBadge');
            const badgeText = document.getElementById('docRoleBadgeText');
            const savePill = document.getElementById('docSavePill');

            // Update role badge in top bar
            if (badge && badgeText) {
                badge.className = 'doc-role-badge';
                if (normalizedRole === 'OWNER') {
                    badge.classList.add('role-owner');
                    badgeText.textContent = 'Owner';
                    badge.title = 'You are the Document Owner (Full Access)';
                } else if (normalizedRole === 'EDITOR') {
                    badge.classList.add('role-editor');
                    badgeText.textContent = 'Editor';
                    badge.title = 'You have Edit access to this document';
                } else if (normalizedRole === 'COMMENTER') {
                    badge.classList.add('role-commenter');
                    badgeText.textContent = 'Commenter';
                    badge.title = 'You have Comment-only access to this document';
                } else if (normalizedRole === 'VIEWER') {
                    badge.classList.add('role-viewer');
                    badgeText.textContent = 'View Only';
                    badge.title = 'You have View-only access to this document';
                } else if (normalizedRole === 'RESTRICTED') {
                    badge.classList.add('role-restricted');
                    badgeText.textContent = 'Restricted';
                    badge.title = 'Access to this document is restricted';
                }
            }

            const isReadOnly = (normalizedRole === 'VIEWER' || normalizedRole === 'COMMENTER' || normalizedRole === 'RESTRICTED');

            if (sheet) {
                sheet.contentEditable = isReadOnly ? "false" : "true";
                if (isReadOnly) {
                    sheet.style.userSelect = 'text';
                    sheet.style.cursor = 'default';
                } else {
                    sheet.style.userSelect = 'auto';
                    sheet.style.cursor = 'text';
                }
            }

            if (titleInput) {
                titleInput.disabled = isReadOnly;
                if (isReadOnly) {
                    titleInput.title = `Title is locked (${normalizedRole.toLowerCase()} mode)`;
                    titleInput.style.cursor = 'default';
                } else {
                    titleInput.title = 'Click to rename document';
                    titleInput.style.cursor = 'text';
                }
            }

            if (toolbar) {
                if (isReadOnly) {
                    toolbar.style.pointerEvents = 'none';
                    toolbar.style.opacity = '0.35';
                    toolbar.setAttribute('aria-disabled', 'true');
                } else {
                    toolbar.style.pointerEvents = 'auto';
                    toolbar.style.opacity = '1';
                    toolbar.removeAttribute('aria-disabled');
                }
            }

            if (savePill) {
                if (isReadOnly) {
                    savePill.style.display = 'none';
                } else {
                    savePill.style.display = 'inline-flex';
                }
            }
        }
