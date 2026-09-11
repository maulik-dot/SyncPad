        // =========================================================================
        let docMentionContext = null;
        let docMentionIndex = 0;
        let docFilteredContributors = [];

        const contributorColors = [
            'linear-gradient(135deg, #2563eb, #1d4ed8)',
            'linear-gradient(135deg, #10b981, #059669)',
            'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            'linear-gradient(135deg, #f59e0b, #d97706)',
            'linear-gradient(135deg, #ec4899, #db2777)',
            'linear-gradient(135deg, #06b6d4, #0891b2)'
        ];

        function getWorkspaceContributorsList() {
            const list = [];
            const seenEmails = new Set();

            if (currentUser) {
                list.push({
                    id: currentUser.id || 1,
                    name: currentUser.name || 'You',
                    email: currentUser.email || 'demo@syncpad.com',
                    role: 'Owner',
                    avatarColor: contributorColors[0],
                    isOnline: true,
                    isMe: true
                });
                seenEmails.add(currentUser.email);
            }

            // 1. Live Active Document Collaborators from WebSocket presence
            if (typeof activeDocCollaborators !== 'undefined' && activeDocCollaborators instanceof Map) {
                activeDocCollaborators.forEach((collab, email) => {
                    if (email && !seenEmails.has(email)) {
                        seenEmails.add(email);
                        list.push({
                            id: collab.id || ('live_' + email),
                            name: collab.name || email.split('@')[0],
                            email: email,
                            role: collab.role || 'Collaborator',
                            avatarColor: collab.color || contributorColors[list.length % contributorColors.length],
                            isOnline: true
                        });
                    }
                });
            }

            // 2. Include workspace members if active workspace has members
            if (activeWorkspace && activeWorkspace.members && Array.isArray(activeWorkspace.members)) {
                activeWorkspace.members.forEach((m, idx) => {
                    const u = m.user || m;
                    if (u && u.email && !seenEmails.has(u.email)) {
                        seenEmails.add(u.email);
                        const isOnline = !!(typeof activeDocCollaborators !== 'undefined' && activeDocCollaborators instanceof Map && activeDocCollaborators.has(u.email));
                        list.push({
                            id: u.id || (idx + 2),
                            name: u.name || u.email.split('@')[0],
                            email: u.email,
                            role: m.role || 'Editor',
                            avatarColor: contributorColors[(list.length) % contributorColors.length],
                            isOnline: isOnline
                        });
                    }
                });
            }

            // 3. Document explicit permission collaborators if available
            if (currentDoc && currentDoc.permissions && Array.isArray(currentDoc.permissions)) {
                currentDoc.permissions.forEach(p => {
                    const email = p.userEmail || (p.user && p.user.email);
                    if (email && !seenEmails.has(email)) {
                        seenEmails.add(email);
                        const isOnline = !!(typeof activeDocCollaborators !== 'undefined' && activeDocCollaborators instanceof Map && activeDocCollaborators.has(email));
                        list.push({
                            id: p.userId || (p.user && p.user.id) || ('perm_' + email),
                            name: (p.user && p.user.name) || email.split('@')[0],
                            email: email,
                            role: p.role || 'Editor',
                            avatarColor: contributorColors[(list.length) % contributorColors.length],
                            isOnline: isOnline
                        });
                    }
                });
            }

            // 4. Standard team collaborators for mention suggestions
            const defaultTeam = [
                { name: 'Alex Morgan', email: 'alex@syncpad.com', role: 'Lead Architect' },
                { name: 'Alice Chen', email: 'alice@syncpad.com', role: 'Senior Engineer' },
                { name: 'Bob Martinez', email: 'bob@syncpad.com', role: 'Product Designer' },
                { name: 'Charlie Davis', email: 'charlie@syncpad.com', role: 'Full-Stack Dev' },
                { name: 'Sarah Jenkins', email: 'sarah@syncpad.com', role: 'QA Engineer' }
            ];

            defaultTeam.forEach((t, idx) => {
                if (!seenEmails.has(t.email)) {
                    seenEmails.add(t.email);
                    const isOnline = !!(typeof activeDocCollaborators !== 'undefined' && activeDocCollaborators instanceof Map && activeDocCollaborators.has(t.email));
                    list.push({
                        id: 100 + idx,
                        name: t.name,
                        email: t.email,
                        role: t.role,
                        avatarColor: contributorColors[(list.length) % contributorColors.length],
                        isOnline: isOnline
                    });
                }
            });

            // Prioritize active online collaborators at top (after self)
            return list.sort((a, b) => {
                if (a.isMe) return -1;
                if (b.isMe) return 1;
                if (a.isOnline && !b.isOnline) return -1;
                if (!a.isOnline && b.isOnline) return 1;
                return 0;
            });
        }

        function checkMentionTrigger() {
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;

            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
                closeMentionDropdown();
                return;
            }

            const node = sel.anchorNode;
            if (!node || node.nodeType !== 3 || !sheet.contains(node)) {
                closeMentionDropdown();
                return;
            }

            const textBefore = node.nodeValue.substring(0, sel.anchorOffset);
            const match = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_.\s]*)$/);

            if (match) {
                const query = match[1] || '';
                const atPos = textBefore.lastIndexOf('@');
                
                docMentionContext = {
                    textNode: node,
                    atOffset: atPos,
                    caretOffset: sel.anchorOffset,
                    query: query
                };

                showMentionDropdown(query);
            } else {
                closeMentionDropdown();
            }
        }

        function showMentionDropdown(query) {
            const dropdown = document.getElementById('docMentionDropdown');
            const listEl = document.getElementById('docMentionList');
            const countEl = document.getElementById('docMentionCount');
            if (!dropdown || !listEl) return;

            const allContributors = getWorkspaceContributorsList();
            const q = (query || '').toLowerCase().trim();

            docFilteredContributors = allContributors.filter(c => {
                return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.role.toLowerCase().includes(q);
            });

            if (countEl) countEl.textContent = `${docFilteredContributors.length} found`;

            if (docFilteredContributors.length === 0) {
                listEl.innerHTML = `
                    <div style="padding: 1rem 0.75rem; text-align: center; color: var(--text-muted); font-size: 0.78rem;">
                        No matching contributors
                    </div>
                `;
            } else {
                if (docMentionIndex >= docFilteredContributors.length) docMentionIndex = 0;
                listEl.innerHTML = docFilteredContributors.map((c, idx) => {
                    const initials = c.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
                    const activeClass = idx === docMentionIndex ? 'active' : '';
                    const onlineBadge = c.isOnline
                        ? `<span class="doc-mention-online-indicator" title="Active now in this document"><span class="doc-mention-online-dot"></span>Active</span>`
                        : '';
                    return `
                        <button class="doc-mention-item ${activeClass}" onclick="selectMentionContributor(${idx})" data-idx="${idx}">
                            <div class="doc-mention-avatar-wrapper">
                                <div class="doc-mention-avatar" style="background: ${c.avatarColor};">
                                    ${initials}
                                </div>
                                ${c.isOnline ? '<span class="doc-mention-avatar-status"></span>' : ''}
                            </div>
                            <div class="doc-mention-info">
                                <div class="doc-mention-name-row">
                                    <span class="doc-mention-name">${escapeHtml(c.name)}</span>
                                    ${onlineBadge}
                                </div>
                                <span class="doc-mention-email">${escapeHtml(c.email)}</span>
                            </div>
                            <span class="doc-mention-role">${escapeHtml(c.role)}</span>
                        </button>
                    `;
                }).join('');
            }

            positionMentionDropdown();
            dropdown.classList.remove('hidden');
            refreshIcons();
        }

        function positionMentionDropdown() {
            const dropdown = document.getElementById('docMentionDropdown');
            if (!dropdown) return;

            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            try {
                const range = sel.getRangeAt(0).cloneRange();
                range.collapse(true);
                let rect = range.getBoundingClientRect();

                if (rect.width === 0 && rect.height === 0 && range.startContainer) {
                    const parent = range.startContainer.parentElement;
                    if (parent) rect = parent.getBoundingClientRect();
                }

                const top = Math.min(window.innerHeight - 340, rect.bottom + 6);
                const left = Math.min(window.innerWidth - 310, Math.max(16, rect.left - 10));

                dropdown.style.top = `${top}px`;
                dropdown.style.left = `${left}px`;
            } catch (e) {}
        }

        function handleMentionKeydown(e) {
            const dropdown = document.getElementById('docMentionDropdown');
            if (!dropdown || dropdown.classList.contains('hidden')) return false;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateMention(1);
                return true;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateMention(-1);
                return true;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (docFilteredContributors.length > 0) {
                    e.preventDefault();
                    selectMentionContributor(docMentionIndex);
                    return true;
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeMentionDropdown();
                return true;
            }
            return false;
        }

        function navigateMention(delta) {
            if (docFilteredContributors.length === 0) return;
            docMentionIndex = (docMentionIndex + delta + docFilteredContributors.length) % docFilteredContributors.length;
            
            const listEl = document.getElementById('docMentionList');
            if (!listEl) return;
            const items = listEl.querySelectorAll('.doc-mention-item');
            items.forEach((it, idx) => {
                it.classList.toggle('active', idx === docMentionIndex);
                if (idx === docMentionIndex) {
                    it.scrollIntoView({ block: 'nearest' });
                }
            });
        }

        function selectMentionContributor(index) {
            const user = docFilteredContributors[index] || docFilteredContributors[0];
            if (!user) {
                closeMentionDropdown();
                return;
            }

            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;

            const targetUserId = user.id && !String(user.id).startsWith('live_') && !String(user.id).startsWith('perm_') ? user.id : null;
            const targetEmail = user.email || '';
            const targetName = user.name || 'Collaborator';

            const pill = document.createElement('span');
            pill.className = 'doc-mention-pill';
            pill.setAttribute('contenteditable', 'false');
            if (targetUserId) pill.setAttribute('data-user-id', targetUserId);
            pill.setAttribute('data-user-name', targetName);
            pill.setAttribute('data-user-email', targetEmail);
            pill.setAttribute('title', `@${targetName} (${targetEmail})`);
            pill.innerHTML = `<i data-lucide="at-sign" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${escapeHtml(targetName)}`;

            if (docMentionContext && docMentionContext.textNode && sheet.contains(docMentionContext.textNode)) {
                const node = docMentionContext.textNode;
                const fullText = node.nodeValue;
                const atPos = docMentionContext.atOffset;
                const caretPos = window.getSelection().anchorOffset || docMentionContext.caretOffset;

                const before = fullText.substring(0, atPos);
                const after = fullText.substring(caretPos);

                const space = document.createTextNode('\u00A0');
                const frag = document.createDocumentFragment();
                if (before) frag.appendChild(document.createTextNode(before));
                frag.appendChild(pill);
                frag.appendChild(space);
                if (after) frag.appendChild(document.createTextNode(after));

                node.parentNode.replaceChild(frag, node);

                // Place caret immediately after the non-breaking space
                const newRange = document.createRange();
                newRange.setStartAfter(space);
                newRange.collapse(true);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(newRange);
                savedDocRange = newRange.cloneRange();
            } else {
                const pillHtml = `<span class="doc-mention-pill" contenteditable="false"${targetUserId ? ` data-user-id="${targetUserId}"` : ''} data-user-name="${escapeHtml(targetName)}" data-user-email="${escapeHtml(targetEmail)}" title="@${escapeHtml(targetName)} (${escapeHtml(targetEmail)})"><i data-lucide="at-sign" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${escapeHtml(targetName)}</span>&nbsp;`;
                document.execCommand('insertHTML', false, pillHtml);
            }

            closeMentionDropdown();
            refreshIcons();
            onDocChange();
            updateDocStats();

            // 1. Broadcast live mention over WebSocket to all active collaborators
            if (stompClient && stompClient.connected && currentDoc && currentDoc.id) {
                try {
                    stompClient.send(`/app/documents/${currentDoc.id}/mention`, {}, JSON.stringify({
                        documentId: currentDoc.id,
                        type: 'MENTION',
                        mentionedEmail: targetEmail,
                        mentionedName: targetName,
                        mentionedUserId: targetUserId,
                        senderEmail: currentUser ? currentUser.email : null,
                        senderName: currentUser ? (currentUser.name || currentUser.email.split('@')[0]) : 'Someone',
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn('[Mention] STOMP broadcast failed:', e);
                }
            }

            // 2. REST fallback to ensure server persistence and notification generation if offline/HTTP
            if (currentDoc && currentDoc.id && targetEmail && (!stompClient || !stompClient.connected)) {
                try {
                    if (typeof fetchWithAuth === 'function') {
                        fetchWithAuth(`/documents/${currentDoc.id}/mention`, {
                            method: 'POST',
                            body: JSON.stringify({
                                email: targetEmail,
                                name: targetName,
                                userId: targetUserId
                            })
                        }).catch(() => {});
                    }
                } catch (e) {}
            }

            // 3. Immediately broadcast document edit so the new mention pill synchronizes to peers
            if (typeof broadcastDocumentEdit === 'function' && currentDoc) {
                broadcastDocumentEdit(sheet.innerHTML, currentDoc.title);
            }

            toast(`Mentioned @${targetName}`);
        }

        function closeMentionDropdown() {
            const dropdown = document.getElementById('docMentionDropdown');
            if (dropdown) dropdown.classList.add('hidden');
            docMentionContext = null;
            docMentionIndex = 0;
        }

        function highlightMentionPillsForUser(email, name, id) {
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;

            const pills = sheet.querySelectorAll('.doc-mention-pill');
            let firstMatch = null;

            pills.forEach(pill => {
                const pEmail = (pill.getAttribute('data-user-email') || '').toLowerCase();
                const pName = (pill.getAttribute('data-user-name') || '').toLowerCase();
                const pId = pill.getAttribute('data-user-id');

                const matchesEmail = email && pEmail && pEmail === email.toLowerCase();
                const matchesId = id && pId && String(pId) === String(id);
                const matchesName = name && pName && pName === name.toLowerCase();

                if (matchesEmail || matchesId || matchesName) {
                    pill.classList.remove('doc-mention-pulse');
                    void pill.offsetWidth; // Trigger reflow for re-animation
                    pill.classList.add('doc-mention-pulse');
                    if (!firstMatch) firstMatch = pill;

                    setTimeout(() => {
                        pill.classList.remove('doc-mention-pulse');
                    }, 4500);
                }
            });

            if (firstMatch) {
                try {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } catch (e) {}
            }
        }

        let docMentionHoverTimer = null;
        let docMentionHovercardEl = null;

        function initDocMentionHovercard() {
            document.addEventListener('mouseover', (e) => {
                const pill = e.target.closest('.doc-mention-pill');
                if (!pill) return;

                clearTimeout(docMentionHoverTimer);
                docMentionHoverTimer = setTimeout(() => {
                    showMentionHovercard(pill);
                }, 300);
            });

            document.addEventListener('mouseout', (e) => {
                const pill = e.target.closest('.doc-mention-pill');
                if (!pill) return;
                clearTimeout(docMentionHoverTimer);
                docMentionHoverTimer = setTimeout(() => {
                    hideMentionHovercard();
                }, 350);
            });
        }

        function showMentionHovercard(pill) {
            hideMentionHovercard();

            const name = pill.getAttribute('data-user-name') || 'Collaborator';
            const email = pill.getAttribute('data-user-email') || '';
            const isOnline = !!(typeof activeDocCollaborators !== 'undefined' && activeDocCollaborators instanceof Map && email && activeDocCollaborators.has(email));
            const initials = name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
            const color = typeof getCollabColor === 'function' ? getCollabColor(email) : '#2563eb';

            const card = document.createElement('div');
            card.id = 'docMentionHovercard';
            card.className = 'doc-mention-hovercard';
            card.innerHTML = `
                <div class="doc-mention-hovercard-body">
                    <div class="doc-mention-hovercard-avatar" style="background: ${color};">
                        ${initials}
                        ${isOnline ? '<span class="doc-mention-avatar-status"></span>' : ''}
                    </div>
                    <div class="doc-mention-hovercard-meta">
                        <div class="doc-mention-hovercard-name-row">
                            <span class="doc-mention-hovercard-name">${escapeHtml(name)}</span>
                            ${isOnline ? '<span class="doc-mention-online-indicator"><span class="doc-mention-online-dot"></span>Active</span>' : '<span class="doc-mention-offline-indicator">Offline</span>'}
                        </div>
                        <span class="doc-mention-hovercard-email">${escapeHtml(email || 'Collaborator')}</span>
                    </div>
                </div>
                <div class="doc-mention-hovercard-footer">
                    <button class="doc-mention-hovercard-btn" onclick="navigator.clipboard.writeText('${escapeHtml(email)}'); toast('Copied email to clipboard!');">
                        <i data-lucide="copy" style="width:12px;height:12px;"></i> Copy email
                    </button>
                </div>
            `;

            card.addEventListener('mouseenter', () => clearTimeout(docMentionHoverTimer));
            card.addEventListener('mouseleave', () => hideMentionHovercard());

            document.body.appendChild(card);
            docMentionHovercardEl = card;
            if (window.lucide) window.lucide.createIcons();

            const rect = pill.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();

            let top = rect.bottom + 6;
            let left = rect.left;

            if (top + cardRect.height > window.innerHeight - 10) {
                top = rect.top - cardRect.height - 6;
            }
            if (left + cardRect.width > window.innerWidth - 10) {
                left = window.innerWidth - cardRect.width - 10;
            }

            card.style.top = `${Math.max(10, top)}px`;
            card.style.left = `${Math.max(10, left)}px`;
        }

        function hideMentionHovercard() {
            if (docMentionHovercardEl && docMentionHovercardEl.parentNode) {
                docMentionHovercardEl.parentNode.removeChild(docMentionHovercardEl);
            }
            docMentionHovercardEl = null;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initDocMentionHovercard);
        } else {
            initDocMentionHovercard();
        }

        function openMentionDropdownAtCaret() {
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;
            sheet.focus();

            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                document.execCommand('insertText', false, '@');
                checkMentionTrigger();
            }
        }

        const PAGE_HEIGHT_PX = 1056; // Standard US Letter page height at standard DPI

        function updateDocPaginationVisuals() {
            const sheet = document.getElementById('docPageSheet');
            const pane = document.getElementById('docEditorPane');
            const breaksLayer = document.getElementById('docPageBreaksLayer');
            if (!sheet) return { pageCount: 1, activePage: 1 };

            // Calculate content height and total pages
            const scrollHeight = Math.max(sheet.scrollHeight, sheet.offsetHeight || 1056);
            const pageCount = Math.max(1, Math.ceil((scrollHeight - 30) / PAGE_HEIGHT_PX));
            
            // Dynamically scale sheet min-height to exact page multiples
            const targetMinHeight = pageCount * PAGE_HEIGHT_PX;
            if (sheet.style.minHeight !== `${targetMinHeight}px`) {
                sheet.style.minHeight = `${targetMinHeight}px`;
            }

            // Render visual page breaks on the dedicated breaks layer
            if (breaksLayer) {
                let html = '';
                for (let p = 2; p <= pageCount; p++) {
                    const topPos = (p - 1) * PAGE_HEIGHT_PX;
                    html += `
                        <div class="doc-page-break" style="top: ${topPos}px;">
                            <div class="doc-page-break-line"></div>
                            <div class="doc-page-break-badge">
                                <i data-lucide="file-text" style="width:12px;height:12px;"></i>
                                <span>Page ${p}</span>
                            </div>
                        </div>
                    `;
                }
                if (breaksLayer.innerHTML.trim() !== html.trim()) {
                    breaksLayer.innerHTML = html;
                    if (window.lucide) window.lucide.createIcons();
                }
            }

            // Calculate current active page based on scroll or caret
            let activePage = 1;
            if (pane) {
                const paneScroll = pane.scrollTop || 0;
                activePage = Math.min(pageCount, Math.max(1, Math.ceil((paneScroll + 300) / PAGE_HEIGHT_PX)));
            }

            return { pageCount, activePage };
        }

        function scrollCursorIntoView(padding = 120) {
            const sheet = document.getElementById('docPageSheet');
            const pane = document.getElementById('docEditorPane');
            if (!sheet || !pane) return;

            const pagination = updateDocPaginationVisuals();

            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            const range = sel.getRangeAt(0);
            if (!sheet.contains(range.commonAncestorContainer) && sheet !== range.commonAncestorContainer) {
                return;
            }

            let rect = null;
            try {
                if (range.collapsed) {
                    if (range.startContainer.nodeType === Node.TEXT_NODE) {
                        const node = range.startContainer;
                        const offset = range.startOffset;
                        const tempRange = document.createRange();
                        if (offset < node.length) {
                            tempRange.setStart(node, offset);
                            tempRange.setEnd(node, offset + 1);
                            rect = tempRange.getBoundingClientRect();
                        } else if (offset > 0) {
                            tempRange.setStart(node, offset - 1);
                            tempRange.setEnd(node, offset);
                            const prev = tempRange.getBoundingClientRect();
                            rect = {
                                top: prev.top,
                                bottom: prev.bottom,
                                left: prev.right,
                                right: prev.right,
                                height: prev.height
                            };
                        }
                    }
                }
                if (!rect || (rect.top === 0 && rect.bottom === 0)) {
                    rect = range.getBoundingClientRect();
                }
                if (!rect || (rect.top === 0 && rect.bottom === 0)) {
                    let parentEl = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
                    if (parentEl && sheet.contains(parentEl)) {
                        rect = parentEl.getBoundingClientRect();
                    }
                }
            } catch (e) {}

            if (!rect || (rect.top === 0 && rect.bottom === 0)) return;

            const paneRect = pane.getBoundingClientRect();
            const caretTopInPane = rect.top - paneRect.top;
            const caretBottomInPane = rect.bottom - paneRect.top;

            // Auto-scroll if cursor is near bottom or pushed past bottom of viewport
            if (caretBottomInPane > (paneRect.height - padding)) {
                const overflow = caretBottomInPane - (paneRect.height - padding);
                pane.scrollTop += overflow;
            } else if (caretTopInPane < padding) {
                // Auto-scroll if cursor is above viewport
                const underflow = caretTopInPane - padding;
                pane.scrollTop += underflow;
            }

            // Update stats with active page calculation
            const text = sheet.innerText || '';
            const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
            const chars = text.length;
            const readingTime = Math.max(1, Math.ceil(words / 200));
            const label = document.getElementById('docStatsLabel');
            if (label) {
                label.textContent = `Page ${pagination.activePage} of ${pagination.pageCount} • ${words.toLocaleString()} words • ${chars.toLocaleString()} characters • ${readingTime} min read`;
            }
        }

        function updateDocStats() {
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;
            const pagination = updateDocPaginationVisuals();
            const text = sheet.innerText || '';
            const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
            const chars = text.length;
            const readingTime = Math.max(1, Math.ceil(words / 200));
            
            const label = document.getElementById('docStatsLabel');
            if (label) {
                label.textContent = `Page ${pagination.activePage} of ${pagination.pageCount} • ${words.toLocaleString()} words • ${chars.toLocaleString()} characters • ${readingTime} min read`;
            }
        }

        // PDF Reference Pane Controllers
        // ==========================================
        // DYNAMIC PDF REFERENCE ENGINE (PDF.js + Multi-File)