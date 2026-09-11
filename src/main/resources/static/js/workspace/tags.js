        // =========================================================================
        // STARRED DOCUMENTS & FAVORITES LOGIC
        // =========================================================================
        let rawStarredDocuments = [];
        let currentStarredFilter = 'all'; // 'all' | 'DOC' | 'WHITEBOARD'
        let currentStarredSearch = '';

        async function showStarredView(el) {
            if (el) {
                document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
            }
            activeFolder = null;
            previousView = 'starred';
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('hidden');
            document.getElementById('homeView').classList.add('hidden');
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('folderView').classList.add('hidden');
            document.getElementById('editorView').classList.add('hidden');
            document.getElementById('whiteboardView').classList.add('hidden');
            document.getElementById('notificationsView').classList.add('hidden');
            document.getElementById('sharedWithMeView').classList.add('hidden');
            const tv = document.getElementById('trashView'); if (tv) tv.classList.add('hidden');
            const sv = document.getElementById('starredView'); if (sv) sv.classList.remove('hidden');

            await loadAndRenderStarred();
            refreshIcons();
        }

        async function loadAndRenderStarred() {
            const grid = document.getElementById('starredDocumentsGrid');
            const badge = document.getElementById('starredTotalBadge');
            if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);"><i data-lucide="loader-2" class="spin" style="width:24px;height:24px;margin-bottom:0.5rem;"></i><p style="font-size:0.85rem;">Loading starred items...</p></div>';
            refreshIcons();

            try {
                const res = await fetchWithAuth('/documents/starred');
                if (!res.ok) {
                    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--danger);">Failed to load starred documents</div>';
                    return;
                }
                rawStarredDocuments = await res.json() || [];

                if (badge) badge.innerText = `${rawStarredDocuments.length} item${rawStarredDocuments.length === 1 ? '' : 's'}`;
                const sideBadge = document.getElementById('sidebarStarredCount');
                if (sideBadge) {
                    sideBadge.innerText = rawStarredDocuments.length;
                    sideBadge.style.display = rawStarredDocuments.length > 0 ? 'inline-block' : 'none';
                }

                const docCount = rawStarredDocuments.filter(d => d.fileType === 'DOC').length;
                const boardCount = rawStarredDocuments.filter(d => d.fileType === 'WHITEBOARD').length;
                const countAll = document.getElementById('starredCountAll');
                const countDoc = document.getElementById('starredCountDoc');
                const countBoard = document.getElementById('starredCountBoard');
                if (countAll) countAll.innerText = rawStarredDocuments.length;
                if (countDoc) countDoc.innerText = docCount;
                if (countBoard) countBoard.innerText = boardCount;

                renderFilteredStarred();
            } catch (err) {
                if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--danger);">Error loading starred documents</div>';
            }
        }

        function setStarredFilter(filter) {
            currentStarredFilter = filter;
            document.querySelectorAll('#starredView .tab-item').forEach(btn => btn.classList.remove('active'));
            if (filter === 'all') document.getElementById('starredTabAll')?.classList.add('active');
            else if (filter === 'DOC') document.getElementById('starredTabDoc')?.classList.add('active');
            else if (filter === 'WHITEBOARD') document.getElementById('starredTabBoard')?.classList.add('active');
            renderFilteredStarred();
        }

        function handleStarredSearch(query) {
            currentStarredSearch = (query || '').trim().toLowerCase();
            renderFilteredStarred();
        }

        function renderFilteredStarred() {
            const grid = document.getElementById('starredDocumentsGrid');
            if (!grid) return;

            let filtered = rawStarredDocuments.filter(doc => {
                if (currentStarredFilter !== 'all' && doc.fileType !== currentStarredFilter) return false;
                if (currentStarredSearch) {
                    const titleMatch = (doc.title || '').toLowerCase().includes(currentStarredSearch);
                    const tagMatch = (doc.tags || []).some(t => t.name.toLowerCase().includes(currentStarredSearch.replace(/^#/, '')));
                    if (!titleMatch && !tagMatch) return false;
                }
                return true;
            });

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
                        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(245, 158, 11, 0.1); color: #f59e0b; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
                            <i data-lucide="star" style="width: 28px; height: 28px;"></i>
                        </div>
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-primary);">
                            ${currentStarredSearch ? 'No matching starred documents' : 'No starred documents yet'}
                        </h3>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 380px; margin: 0 auto 1.5rem;">
                            ${currentStarredSearch ? 'Try adjusting your search terms or filter.' : 'Star important documents and whiteboards to keep them pinned for quick access right here.'}
                        </p>
                        ${!currentStarredSearch ? `<button class="btn btn-primary" onclick="switchDashboardTab('all', document.querySelector('.sidebar-nav .sidebar-item'))">Browse Documents</button>` : ''}
                    </div>
                `;
            } else {
                grid.innerHTML = '';
                filtered.forEach(doc => {
                    grid.appendChild(createWorkspaceCard(doc));
                });
            }
            refreshIcons();
        }

        async function toggleStarDoc(docId) {
            try {
                let isCurrentlyStarred = false;
                let target = (documentsList && documentsList.find(d => d.id === docId)) ||
                             (folderDocumentsList && folderDocumentsList.find(d => d.id === docId)) ||
                             (rawStarredDocuments && rawStarredDocuments.find(d => d.id === docId));
                if (target) {
                    isCurrentlyStarred = !!target.isStarred;
                } else if (currentDoc && currentDoc.id === docId) {
                    isCurrentlyStarred = !!currentDoc.isStarred;
                }

                const method = isCurrentlyStarred ? 'DELETE' : 'POST';
                const res = await fetchWithAuth(`/documents/${docId}/star`, { method });
                if (!res.ok) {
                    toast('Failed to update star status');
                    return;
                }
                const updated = await res.json();
                toast(isCurrentlyStarred ? 'Removed from Starred' : 'Added to Starred');

                if (target) target.isStarred = updated.isStarred;
                if (documentsList) {
                    const dIdx = documentsList.findIndex(d => d.id === docId);
                    if (dIdx !== -1) documentsList[dIdx].isStarred = updated.isStarred;
                }
                if (folderDocumentsList) {
                    const fIdx = folderDocumentsList.findIndex(d => d.id === docId);
                    if (fIdx !== -1) folderDocumentsList[fIdx].isStarred = updated.isStarred;
                }
                if (rawStarredDocuments) {
                    const sIdx = rawStarredDocuments.findIndex(d => d.id === docId);
                    if (sIdx !== -1) {
                        if (!updated.isStarred) {
                            rawStarredDocuments.splice(sIdx, 1);
                        } else {
                            rawStarredDocuments[sIdx].isStarred = true;
                        }
                    } else if (updated.isStarred) {
                        rawStarredDocuments.unshift(updated);
                    }
                }
                if (currentDoc && currentDoc.id === docId) {
                    currentDoc.isStarred = updated.isStarred;
                    updateEditorStarIcon(updated.isStarred);
                }

                // Update sidebar badge
                const sideBadge = document.getElementById('sidebarStarredCount');
                if (sideBadge) {
                    const count = rawStarredDocuments ? rawStarredDocuments.length : (documentsList ? documentsList.filter(d => d.isStarred).length : 0);
                    sideBadge.innerText = count;
                    sideBadge.style.display = count > 0 ? 'inline-block' : 'none';
                }

                renderDashboardGrids();
                if (activeFolder) {
                    renderFolderFiles();
                }
                if (previousView === 'starred' || !document.getElementById('starredView').classList.contains('hidden')) {
                    await loadAndRenderStarred();
                }
                refreshIcons();
            } catch (err) {
                toast('Error updating star status');
            }
        }

        function updateEditorStarIcon(isStarred) {
            const icon = document.getElementById('editorStarIcon');
            if (icon) {
                if (isStarred) {
                    icon.style.fill = '#f59e0b';
                    icon.style.color = '#f59e0b';
                } else {
                    icon.style.fill = 'none';
                    icon.style.color = 'var(--text-muted)';
                }
            }
        }

        function toggleCurrentDocStar() {
            if (currentDoc && currentDoc.id) {
                toggleStarDoc(currentDoc.id);
            }
        }

        // =========================================================================
        // TAG MANAGEMENT MODAL & OPERATIONS
        // =========================================================================
        let currentTagDocId = null;
        let currentTagDoc = null;

        async function openTagModal(docId, docTitle) {
            currentTagDocId = docId;
            const modal = document.getElementById('tagManagementModal');
            const titleEl = document.getElementById('tagModalDocTitle');
            if (titleEl) titleEl.innerText = docTitle || 'Document #' + docId;
            if (modal) modal.classList.remove('hidden');

            const nameInput = document.getElementById('newTagNameInput');
            if (nameInput) {
                nameInput.value = '';
                nameInput.focus();
            }

            await renderTagModalContent();
            refreshIcons();
        }

        function openCurrentDocTagModal() {
            if (currentDoc && currentDoc.id) {
                openTagModal(currentDoc.id, currentDoc.title);
            }
        }

        function closeTagModal() {
            const modal = document.getElementById('tagManagementModal');
            if (modal) modal.classList.add('hidden');
            currentTagDocId = null;
            currentTagDoc = null;
        }

        async function renderTagModalContent() {
            if (!currentTagDocId) return;

            const tagsContainer = document.getElementById('tagModalCurrentTags');
            const suggestedContainer = document.getElementById('tagModalSuggestedTags');

            currentTagDoc = (documentsList && documentsList.find(d => d.id === currentTagDocId)) || (rawStarredDocuments && rawStarredDocuments.find(d => d.id === currentTagDocId));
            if (!currentTagDoc) {
                try {
                    const res = await fetchWithAuth(`/documents/${currentTagDocId}`);
                    if (res.ok) currentTagDoc = await res.json();
                } catch (e) {}
            }

            // Render current tags
            if (tagsContainer) {
                const assignedTags = (currentTagDoc && currentTagDoc.tags) ? currentTagDoc.tags : [];
                if (assignedTags.length === 0) {
                    tagsContainer.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted);">No tags assigned yet</span>';
                } else {
                    tagsContainer.innerHTML = assignedTags.map(tag => `
                        <span class="badge" style="display:inline-flex; align-items:center; gap:5px; background:${tag.color || '#3b82f6'}20; color:${tag.color || '#3b82f6'}; border:1px solid ${tag.color || '#3b82f6'}40; padding:3px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">
                            #${tag.name}
                            <button onclick="removeTagFromModal(${tag.id})" style="background:none; border:none; color:inherit; cursor:pointer; padding:0; display:flex; align-items:center;" title="Remove tag">
                                <i data-lucide="x" style="width:12px;height:12px;"></i>
                            </button>
                        </span>
                    `).join('');
                }
            }

            // Load suggested workspace tags if workspace is known
            if (suggestedContainer && activeWorkspace && activeWorkspace.id) {
                try {
                    const res = await fetchWithAuth(`/workspaces/${activeWorkspace.id}/tags`);
                    if (res.ok) {
                        const wsTags = await res.json() || [];
                        const assignedIds = new Set(((currentTagDoc && currentTagDoc.tags) || []).map(t => t.id));
                        const unassigned = wsTags.filter(t => !assignedIds.has(t.id));
                        if (unassigned.length === 0) {
                            suggestedContainer.innerHTML = '<span style="font-size:0.72rem; color:var(--text-muted);">No additional workspace tags</span>';
                        } else {
                            suggestedContainer.innerHTML = unassigned.map(t => `
                                <button onclick="attachSuggestedTag(${t.id})" class="btn btn-outline" style="font-size:0.72rem; padding:2px 8px; height:24px; border-color:${t.color || '#3b82f6'}40; color:${t.color || '#3b82f6'};" title="Click to attach">
                                    + #${t.name}
                                </button>
                            `).join('');
                        }
                    }
                } catch (e) {
                    suggestedContainer.innerHTML = '<span style="font-size:0.72rem; color:var(--text-muted);">Could not load suggestions</span>';
                }
            }
            refreshIcons();
        }

        async function addTagFromModal() {
            if (!currentTagDocId) return;
            const nameInput = document.getElementById('newTagNameInput');
            const colorInput = document.getElementById('newTagColorInput');
            const name = (nameInput ? nameInput.value : '').trim();
            const color = (colorInput ? colorInput.value : '#3b82f6');

            if (!name) {
                toast('Please enter a tag name');
                return;
            }

            try {
                const res = await fetchWithAuth(`/documents/${currentTagDocId}/tags`, {
                    method: 'POST',
                    body: { name, color }
                });
                if (!res.ok) {
                    toast('Failed to add tag');
                    return;
                }
                const updated = await res.json();
                toast(`Tag #${name} added!`);
                if (nameInput) nameInput.value = '';

                if (documentsList) {
                    const dIdx = documentsList.findIndex(d => d.id === currentTagDocId);
                    if (dIdx !== -1) documentsList[dIdx].tags = updated.tags;
                }
                if (folderDocumentsList) {
                    const fIdx = folderDocumentsList.findIndex(d => d.id === currentTagDocId);
                    if (fIdx !== -1) folderDocumentsList[fIdx].tags = updated.tags;
                }
                if (rawStarredDocuments) {
                    const sIdx = rawStarredDocuments.findIndex(d => d.id === currentTagDocId);
                    if (sIdx !== -1) rawStarredDocuments[sIdx].tags = updated.tags;
                }
                if (currentDoc && currentDoc.id === currentTagDocId) {
                    currentDoc.tags = updated.tags;
                }
                if (currentTagDoc) currentTagDoc.tags = updated.tags;

                await renderTagModalContent();
                renderDashboardGrids();
                if (activeFolder) renderFolderFiles();
                if (previousView === 'starred' || !document.getElementById('starredView').classList.contains('hidden')) {
                    renderFilteredStarred();
                }
            } catch (e) {
                toast('Error adding tag');
            }
        }

        async function attachSuggestedTag(tagId) {
            if (!currentTagDocId) return;
            try {
                const res = await fetchWithAuth(`/documents/${currentTagDocId}/tags`, {
                    method: 'POST',
                    body: { tagId }
                });
                if (!res.ok) {
                    toast('Failed to attach tag');
                    return;
                }
                const updated = await res.json();
                toast('Tag attached!');

                if (documentsList) {
                    const dIdx = documentsList.findIndex(d => d.id === currentTagDocId);
                    if (dIdx !== -1) documentsList[dIdx].tags = updated.tags;
                }
                if (folderDocumentsList) {
                    const fIdx = folderDocumentsList.findIndex(d => d.id === currentTagDocId);
                    if (fIdx !== -1) folderDocumentsList[fIdx].tags = updated.tags;
                }
                if (rawStarredDocuments) {
                    const sIdx = rawStarredDocuments.findIndex(d => d.id === currentTagDocId);
                    if (sIdx !== -1) rawStarredDocuments[sIdx].tags = updated.tags;
                }
                if (currentDoc && currentDoc.id === currentTagDocId) {
                    currentDoc.tags = updated.tags;
                }
                if (currentTagDoc) currentTagDoc.tags = updated.tags;

                await renderTagModalContent();
                renderDashboardGrids();
                if (activeFolder) renderFolderFiles();
                if (previousView === 'starred' || !document.getElementById('starredView').classList.contains('hidden')) {
                    renderFilteredStarred();
                }
            } catch (e) {
                toast('Error attaching tag');
            }
        }

        async function removeTagFromModal(tagId) {
            if (!currentTagDocId) return;
            try {
                const res = await fetchWithAuth(`/documents/${currentTagDocId}/tags/${tagId}`, {
                    method: 'DELETE'
                });
                if (!res.ok) {
                    toast('Failed to remove tag');
                    return;
                }
                const data = await res.json();
                const updated = data.document;
                toast('Tag removed');

                if (documentsList && updated) {
                    const dIdx = documentsList.findIndex(d => d.id === currentTagDocId);
                    if (dIdx !== -1) documentsList[dIdx].tags = updated.tags;
                }
                if (folderDocumentsList && updated) {
                    const fIdx = folderDocumentsList.findIndex(d => d.id === currentTagDocId);
                    if (fIdx !== -1) folderDocumentsList[fIdx].tags = updated.tags;
                }
                if (rawStarredDocuments && updated) {
                    const sIdx = rawStarredDocuments.findIndex(d => d.id === currentTagDocId);
                    if (sIdx !== -1) rawStarredDocuments[sIdx].tags = updated.tags;
                }
                if (currentDoc && currentDoc.id === currentTagDocId && updated) {
                    currentDoc.tags = updated.tags;
                }
                if (currentTagDoc && updated) currentTagDoc.tags = updated.tags;

                await renderTagModalContent();
                renderDashboardGrids();
                if (activeFolder) renderFolderFiles();
                if (previousView === 'starred' || !document.getElementById('starredView').classList.contains('hidden')) {
                    renderFilteredStarred();
                }
            } catch (e) {
                toast('Error removing tag');
            }
        }

        window.showStarredView = showStarredView;

