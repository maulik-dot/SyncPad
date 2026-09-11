        // =========================================================================
        async function openTemplatesModal() {
            const modal = document.getElementById('templatesModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            await loadTemplatesGallery();
            refreshIcons();
        }

        function closeTemplatesModal() {
            const modal = document.getElementById('templatesModal');
            if (modal) modal.classList.add('hidden');
        }

        async function loadTemplatesGallery() {
            const container = document.getElementById('templatesGalleryGrid');
            if (!container) return;
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-muted);"><i data-lucide="loader-2" class="spin" style="width:24px;height:24px;margin:0 auto 0.5rem;"></i><p>Loading enterprise blueprint gallery...</p></div>';
            refreshIcons();

            try {
                const wsId = activeWorkspace ? activeWorkspace.id : '';
                const url = wsId ? `/templates?workspaceId=${wsId}` : '/templates';
                const res = await fetch(url, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) throw new Error('Failed to load blueprints');
                const templates = await res.json();
                renderTemplatesGallery(templates);
            } catch (err) {
                container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">${escapeHtml(err.message)}</div>`;
            }
        }

        function renderTemplatesGallery(templates) {
            const container = document.getElementById('templatesGalleryGrid');
            if (!container) return;
            if (!templates || templates.length === 0) {
                container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">No templates available.</div>';
                return;
            }

            container.innerHTML = templates.map(t => `
                <div class="card card-hover" style="display: flex; flex-direction: column; justify-content: space-between; padding: 1.15rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-surface); transition: all 0.2s ease;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: rgba(99, 102, 241, 0.1); color: var(--accent-primary); display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="${t.icon || 'file-text'}" style="width: 18px; height: 18px;"></i>
                            </div>
                            <span class="badge" style="font-size: 0.68rem; background: ${t.builtin ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)'}; color: ${t.builtin ? '#10b981' : '#6366f1'};">
                                ${t.builtin ? 'Built-in' : 'Custom'}
                            </span>
                        </div>
                        <h3 style="font-size: 0.92rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-primary);">${escapeHtml(t.title)}</h3>
                        <p style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 0.75rem;">${escapeHtml(t.description || '')}</p>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: 0.5rem;">
                        <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">${escapeHtml(t.category || 'General')}</span>
                        <button class="btn btn-primary btn-sm" onclick="useTemplate(${t.id})" style="font-size: 0.76rem; padding: 0.25rem 0.65rem; gap: 0.25rem;">
                            <i data-lucide="plus" style="width: 12px; height: 12px;"></i>
                            <span>Use</span>
                        </button>
                    </div>
                </div>
            `).join('');
            refreshIcons();
        }

        async function useTemplate(templateId) {
            try {
                // If we are currently viewing a document (doc screen), apply template to current doc instead of creating new
                const isDocViewActive = currentDoc && currentDoc.id && document.getElementById('editorView') && !document.getElementById('editorView').classList.contains('hidden');
                if (isDocViewActive) {
                    toast('📄 Loading template onto current document...');
                    // Fetch template details (we already have it in gallery, but fetch to get content)
                    const tplRes = await fetch(`/templates`, { headers: { 'Authorization': 'Bearer ' + token } });
                    let template = null;
                    if (tplRes.ok) {
                        const all = await tplRes.json();
                        template = all.find(t => String(t.id) === String(templateId));
                    }
                    if (!template) {
                        // Fallback: fetch single template if not found (should not happen)
                        const singleRes = await fetch(`/templates/${templateId}`, { headers: { 'Authorization': 'Bearer ' + token } });
                        if (singleRes.ok) template = await singleRes.json();
                    }
                    if (!template || !template.content) throw new Error('Template not found');
                    // Confirm if current doc has content
                    const sheet = document.getElementById('docPageSheet');
                    const hasContent = sheet && sheet.innerText.trim().length > 50;
                    if (hasContent && !confirm(`Replace current document "${currentDoc.title}" content with template "${template.title}"? This will overwrite the current content.`)) {
                        return;
                    }
                    const res = await fetch(`/documents/${currentDoc.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ title: currentDoc.title, content: template.content })
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.message || 'Failed to apply template');
                    }
                    const updated = await res.json();
                    currentDoc.content = updated.content;
                    currentDoc.title = updated.title;
                    // Update editor UI 1:1
                    const titleInput = document.getElementById('docTitleInput');
                    if (titleInput) titleInput.value = updated.title;
                    if (sheet) {
                        sheet.innerHTML = updated.content;
                        if (window.latexEngine) window.latexEngine.initAllCards(sheet);
                        if (typeof normalizeDocChecklists === 'function') normalizeDocChecklists(sheet);
                        refreshIcons();
                        updateDocStats();
                        if (typeof updateDocOutline === 'function') updateDocOutline();
                    }
                    syncDocumentInLists(currentDoc.id, updated.title, updated.content);
                    broadcastDocumentEdit(updated.content, updated.title);
                    renderDashboardGrids();
                    closeTemplatesModal();
                    toast(`✅ Loaded template "${template.title}" onto current document!`);
                    return;
                }
                // Default: create new doc from template (when not on doc screen)
                toast('📄 Instantiating document from template blueprint...');
                const wsId = activeWorkspace ? activeWorkspace.id : '';
                const url = wsId ? `/templates/${templateId}/instantiate?workspaceId=${wsId}` : `/templates/${templateId}/instantiate`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to instantiate template');
                }
                const newDoc = await res.json();
                closeTemplatesModal();
                toast(`✅ Created document "${newDoc.title}" from template!`);
                await loadDocuments();
                openItemView(newDoc);
            } catch (e) {
                toast(e.message, 'error');
            }
        }

        // =========================================================================
        // WEBHOOKS & INTEGRATIONS JS ENGINE