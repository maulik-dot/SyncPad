        let docStompSubscription = null;
        let docStompDotSubscription = null;
        let docCrdtSubscription = null;
        let docPresenceSubscription = null;
        let docPresenceSlashSubscription = null;
        let presenceHeartbeatTimer = null;
        let presencePruneTimer = null;
        let activeDocCollaborators = new Map(); // email -> { name, email, color, lastSeen }
        let collabRemoteCursors = new Map(); // email -> { el, caret, flag, color, timer }
        let docEditBroadcastTimeout = null;
        let cursorBroadcastThrottle = null;
        let lastBroadcastCursor = null;
        let isReceivingRemoteEdit = false;

        const collabColorPalette = [
            '#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444'
        ];

        function getCollabColor(email) {
            if (!email) return collabColorPalette[0];
            let hash = 0;
            for (let i = 0; i < email.length; i++) {
                hash = email.charCodeAt(i) + ((hash << 5) - hash);
            }
            return collabColorPalette[Math.abs(hash) % collabColorPalette.length];
        }

        function getCaretCharacterOffsetWithin(element) {
            let caretOffset = 0;
            const doc = element.ownerDocument || element.document;
            const win = doc.defaultView || window;
            const sel = win.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (element.contains(range.commonAncestorContainer) || element === range.commonAncestorContainer) {
                    const preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(element);
                    preCaretRange.setEnd(range.endContainer, range.endOffset);
                    caretOffset = preCaretRange.toString().length;
                }
            }
            return caretOffset;
        }

        function setCaretCharacterOffsetWithin(element, offset) {
            if (offset < 0) return;
            const doc = element.ownerDocument || element.document;
            const win = doc.defaultView || window;
            const sel = win.getSelection();
            if (!sel) return;

            let charIndex = 0;
            const range = doc.createRange();
            range.setStart(element, 0);
            range.collapse(true);

            const nodeStack = [element];
            let node;
            let found = false;

            while (!found && (node = nodeStack.pop())) {
                if (node.nodeType === 3) {
                    const nextCharIndex = charIndex + node.length;
                    if (offset >= charIndex && offset <= nextCharIndex) {
                        range.setStart(node, offset - charIndex);
                        range.collapse(true);
                        found = true;
                    }
                    charIndex = nextCharIndex;
                } else {
                    let i = node.childNodes.length;
                    while (i--) {
                        nodeStack.push(node.childNodes[i]);
                    }
                }
            }

            if (found) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        function getLocalCaretCoordinates() {
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return null;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return null;
            const range = sel.getRangeAt(0);

            if (!sheet.contains(range.commonAncestorContainer)) return null;

            const sheetRect = sheet.getBoundingClientRect();
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
                            const prevRect = tempRange.getBoundingClientRect();
                            rect = {
                                left: prevRect.right,
                                top: prevRect.top,
                                right: prevRect.right,
                                bottom: prevRect.bottom,
                                width: 0,
                                height: prevRect.height
                            };
                        }
                    }
                    
                    if (!rect || (rect.left === 0 && rect.top === 0)) {
                        const dummy = document.createElement('span');
                        dummy.style.display = 'inline-block';
                        dummy.style.width = '1px';
                        dummy.style.height = '1em';
                        dummy.textContent = '\u200B';
                        const clone = range.cloneRange();
                        clone.insertNode(dummy);
                        rect = dummy.getBoundingClientRect();
                        if (dummy.parentNode) {
                            const parent = dummy.parentNode;
                            parent.removeChild(dummy);
                            parent.normalize();
                        }
                    }
                } else {
                    rect = range.getBoundingClientRect();
                }
            } catch (e) {}

            if (!rect || (rect.left === 0 && rect.top === 0)) {
                return null;
            }

            const left = Math.round(rect.left - sheetRect.left);
            const top = Math.round(rect.top - sheetRect.top);
            const height = Math.min(48, Math.max(16, Math.round(rect.height || 20)));

            return { left, top, height };
        }

        function broadcastLocalCursorPosition(immediate = false) {
            if (!stompClient || !stompClient.connected || !currentDoc || !currentDoc.id || !currentUser) return;
            if (isReceivingRemoteEdit) return;

            const send = () => {
                const coords = getLocalCaretCoordinates();
                if (!coords) return;

                if (lastBroadcastCursor && 
                    Math.abs(lastBroadcastCursor.left - coords.left) < 2 && 
                    Math.abs(lastBroadcastCursor.top - coords.top) < 2) {
                    return;
                }
                lastBroadcastCursor = coords;

                try {
                    stompClient.send(`/app/documents/${currentDoc.id}/edit`, {}, JSON.stringify({
                        documentId: currentDoc.id,
                        title: currentDoc.title || 'Untitled Document',
                        content: '',
                        senderEmail: currentUser.email,
                        senderName: currentUser.name || currentUser.email.split('@')[0],
                        type: 'CURSOR',
                        cursorX: coords.left,
                        cursorY: coords.top,
                        cursorHeight: coords.height,
                        timestamp: Date.now()
                    }));
                } catch (e) {}
            };

            if (immediate) {
                if (cursorBroadcastThrottle) {
                    clearTimeout(cursorBroadcastThrottle);
                    cursorBroadcastThrottle = null;
                }
                send();
            } else {
                if (cursorBroadcastThrottle) return;
                cursorBroadcastThrottle = setTimeout(() => {
                    cursorBroadcastThrottle = null;
                    send();
                }, 30);
            }
        }

        function renderRemoteCursor(email, name, x, y, height) {
            if (!email || x === undefined || y === undefined || isNaN(x) || isNaN(y) || x < 0 || y < 0) return;
            const layer = document.getElementById('collabCursorsLayer');
            if (!layer) return;

            const cleanId = 'collab-cursor-' + email.replace(/[^a-zA-Z0-9]/g, '_');
            let cursorObj = collabRemoteCursors.get(email);

            if (!cursorObj || !document.getElementById(cleanId)) {
                const color = getCollabColor(email);
                const cursorEl = document.createElement('div');
                cursorEl.id = cleanId;
                cursorEl.className = 'collab-cursor';
                cursorEl.style.setProperty('--cursor-color', color);

                const caret = document.createElement('div');
                caret.className = 'collab-cursor-caret';

                const flag = document.createElement('div');
                flag.className = 'collab-cursor-flag';
                flag.textContent = name || email.split('@')[0];

                cursorEl.appendChild(caret);
                cursorEl.appendChild(flag);
                layer.appendChild(cursorEl);

                cursorObj = {
                    el: cursorEl,
                    caret: caret,
                    flag: flag,
                    color: color,
                    timer: null
                };
                collabRemoteCursors.set(email, cursorObj);
            }

            cursorObj.el.classList.remove('inactive', 'idle');
            cursorObj.el.style.left = x + 'px';
            cursorObj.el.style.top = y + 'px';
            if (height) {
                cursorObj.caret.style.height = height + 'px';
            }
            if (name) {
                cursorObj.flag.textContent = name;
            }

            if (cursorObj.timer) clearTimeout(cursorObj.timer);
            cursorObj.timer = setTimeout(() => {
                if (cursorObj.el) {
                    cursorObj.el.classList.add('idle');
                }
            }, 3500);
        }

        function removeRemoteCursor(email) {
            if (!email) return;
            const cursorObj = collabRemoteCursors.get(email);
            if (cursorObj) {
                if (cursorObj.timer) clearTimeout(cursorObj.timer);
                if (cursorObj.el && cursorObj.el.parentNode) {
                    cursorObj.el.parentNode.removeChild(cursorObj.el);
                }
                collabRemoteCursors.delete(email);
            }
        }

        function clearAllRemoteCursors() {
            collabRemoteCursors.forEach(obj => {
                if (obj.timer) clearTimeout(obj.timer);
                if (obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
            });
            collabRemoteCursors.clear();
            const layer = document.getElementById('collabCursorsLayer');
            if (layer) layer.innerHTML = '';
        }

        let currentSubscribedDocId = null;

        function subscribeToDocumentCollaboration(docId) {
            if (!docId) return;

            // If already subscribed to this document and connection is healthy, re-announce JOIN and return
            if (currentSubscribedDocId === Number(docId) && docStompSubscription && stompClient && stompClient.connected) {
                broadcastDocumentPresence('JOIN');
                return;
            }

            // If switching from a different document, cleanly unsubscribe from previous
            if (currentSubscribedDocId && currentSubscribedDocId !== Number(docId)) {
                unsubscribeDocumentCollaboration();
            }

            currentSubscribedDocId = Number(docId);
            activeDocCollaborators.clear();
            clearAllRemoteCursors();

            if (currentUser) {
                const myRole = ((currentDoc && currentDoc.currentUserRole) || (currentDoc && currentDoc.ownerEmail === currentUser.email ? 'OWNER' : 'EDITOR') || 'EDITOR').toUpperCase();
                activeDocCollaborators.set(currentUser.email, {
                    name: currentUser.name || 'You',
                    email: currentUser.email,
                    role: myRole,
                    color: getCollabColor(currentUser.email),
                    lastSeen: Date.now()
                });
                renderDocCollaboratorsUI();
            }

            if (!stompClient || !stompClient.connected) {
                initWebSocketNotifications();
            }

            const trySubscribe = () => {
                // If user switched document in the meantime, abort this subscription attempt
                if (currentSubscribedDocId !== Number(docId)) return;

                if (stompClient && stompClient.connected) {
                    try {
                        if (docStompSubscription) { try { docStompSubscription.unsubscribe(); } catch (e) {} docStompSubscription = null; }
                        if (docCrdtSubscription) { try { docCrdtSubscription.unsubscribe(); } catch (e) {} docCrdtSubscription = null; }
                        if (docPresenceSubscription) { try { docPresenceSubscription.unsubscribe(); } catch (e) {} docPresenceSubscription = null; }

                        docStompSubscription = stompClient.subscribe(`/topic/documents.${docId}`, (message) => {
                            try {
                                const data = JSON.parse(message.body);
                                handleDocumentCollaborationEvent(data);
                            } catch (e) {
                                console.error('Error parsing collaboration message:', e);
                            }
                        });

                        // Character-level CRDT channel subscription
                        docCrdtSubscription = stompClient.subscribe(`/topic/documents.${docId}.crdt`, (message) => {
                            try {
                                const op = JSON.parse(message.body);
                                handleRemoteCrdtOperation(op);
                            } catch (e) {
                                console.error('Error parsing CRDT message:', e);
                            }
                        });

                        // Presence channel
                        const onPresence = (message) => {
                            try {
                                handlePresenceMessage(JSON.parse(message.body));
                            } catch (e) {
                                console.error('Error parsing presence message:', e);
                            }
                        };
                        docPresenceSubscription = stompClient.subscribe(`/topic/documents.${docId}.presence`, onPresence);

                        if (window.SyncPadCrdt && currentDoc) {
                            window.SyncPadCrdt.init(docId, currentDoc.content || '', currentUser ? currentUser.email : null);
                        }

                        broadcastDocumentPresence('JOIN');
                        startPresenceHeartbeat();
                        startPresencePruneLoop();
                    } catch (e) {
                        console.warn('Document subscription failed:', e);
                    }
                } else {
                    setTimeout(trySubscribe, 400);
                }
            };

            trySubscribe();
        }

        function handleRemoteCrdtOperation(op) {
            if (!op || !currentDoc || Number(op.documentId) !== Number(currentDoc.id)) return;
            if (currentUser && op.senderEmail === currentUser.email) return;

            if (window.SyncPadCrdt) {
                const applied = window.SyncPadCrdt.applyRemote(op);
                if (applied) {
                    const sheet = document.getElementById('docPageSheet');
                    if (sheet) {
                        const isFocused = (document.activeElement === sheet || sheet.contains(document.activeElement));
                        const savedOffset = isFocused ? getCaretCharacterOffsetWithin(sheet) : -1;

                        isReceivingRemoteEdit = true;
                        const newText = window.SyncPadCrdt.toText();
                        sheet.innerHTML = newText;
                        currentDoc.content = newText;

                        if (window.latexEngine) {
                            window.latexEngine.initAllCards(sheet);
                        }
                        if (typeof normalizeDocChecklists === 'function') {
                            normalizeDocChecklists(sheet);
                        }
                        refreshIcons();
                        updateDocStats();

                        if (isFocused && savedOffset >= 0) {
                            try {
                                setCaretCharacterOffsetWithin(sheet, savedOffset);
                            } catch (e) {}
                        }
                        isReceivingRemoteEdit = false;
                    }
                    showRemoteCollaboratorActivity(op.senderEmail ? op.senderEmail.split('@')[0] : 'Collaborator');
                }
            }
        }

        function unsubscribeDocumentCollaboration() {
            if (currentSubscribedDocId && stompClient && stompClient.connected) {
                try {
                    broadcastDocumentPresence('LEAVE', currentSubscribedDocId);
                } catch (e) {}
            }
            if (docStompSubscription) {
                try {
                    docStompSubscription.unsubscribe();
                } catch (e) {}
                docStompSubscription = null;
            }
            if (docCrdtSubscription) {
                try {
                    docCrdtSubscription.unsubscribe();
                } catch (e) {}
                docCrdtSubscription = null;
            }
            if (docPresenceSubscription) {
                try { docPresenceSubscription.unsubscribe(); } catch (e) {}
                docPresenceSubscription = null;
            }
            currentSubscribedDocId = null;
            stopPresenceHeartbeat();
            stopPresencePruneLoop();
            activeDocCollaborators.clear();
            clearAllRemoteCursors();
            renderDocCollaboratorsUI();
        }

        function startPresenceHeartbeat() {
            stopPresenceHeartbeat();
            presenceHeartbeatTimer = setInterval(() => {
                broadcastDocumentPresence('HEARTBEAT');
            }, 10000);
        }

        function stopPresenceHeartbeat() {
            if (presenceHeartbeatTimer) {
                try { clearInterval(presenceHeartbeatTimer); } catch (e) {}
                presenceHeartbeatTimer = null;
            }
        }

        function startPresencePruneLoop() {
            stopPresencePruneLoop();
            presencePruneTimer = setInterval(() => {
                const now = Date.now();
                let changed = false;
                activeDocCollaborators.forEach((u, email) => {
                    if (currentUser && email === currentUser.email) return;
                    if (now - (u.lastSeen || 0) > 30000) {
                        activeDocCollaborators.delete(email);
                        changed = true;
                    }
                });
                if (changed) renderDocCollaboratorsUI();
            }, 5000);
        }

        function stopPresencePruneLoop() {
            if (presencePruneTimer) {
                try { clearInterval(presencePruneTimer); } catch (e) {}
                presencePruneTimer = null;
            }
        }

        function handlePresenceMessage(data) {
            if (!data || !currentDoc) return;
            const docId = Number(data.documentId);
            if (docId && Number(currentDoc.id) !== docId) return;
            const email = data.userEmail || data.senderEmail;
            if (!email) return;
            if (currentUser && email === currentUser.email) {
                // Refresh own lastSeen so we never prune ourselves
                const me = activeDocCollaborators.get(email);
                if (me) { me.lastSeen = Date.now(); activeDocCollaborators.set(email, me); }
                return;
            }
            const action = (data.action || data.type || 'HEARTBEAT').toUpperCase();
            const displayName = data.senderName || data.name || email.split('@')[0];
            if (action === 'LEAVE') {
                const wasPresent = activeDocCollaborators.has(email);
                activeDocCollaborators.delete(email);
                try { removeRemoteCursor(email); } catch (e) {}
                renderDocCollaboratorsUI();
                if (wasPresent) toast(`${escapeHtml(displayName)} left the document`);
                return;
            }
            const isNew = !activeDocCollaborators.has(email);
            const role = (data.role || (email === (currentDoc && currentDoc.ownerEmail) ? 'OWNER' : 'EDITOR')).toUpperCase();
            activeDocCollaborators.set(email, {
                name: displayName,
                email: email,
                role: role,
                color: getCollabColor(email),
                lastSeen: Date.now()
            });
            renderDocCollaboratorsUI();
            if (isNew && (action === 'JOIN')) {
                toast(`${escapeHtml(displayName)} joined the document`);
            }
            if (action === 'JOIN') {
                // When another user joins, immediately reply with our presence so they discover us without waiting 10s
                broadcastDocumentPresence('HEARTBEAT');
            }
        }

        function broadcastDocumentPresence(action = 'HEARTBEAT', targetDocId = null) {
            const doc = targetDocId ? { id: targetDocId } : currentDoc;
            if (!stompClient || !stompClient.connected || !doc || !doc.id || !currentUser) return;
            const myRole = ((currentDoc && currentDoc.currentUserRole) || (currentDoc && currentDoc.ownerEmail === currentUser.email ? 'OWNER' : 'EDITOR') || 'EDITOR').toUpperCase();
            if (!targetDocId) {
                // Keep self visible even if our own broadcast echoes are ignored
                activeDocCollaborators.set(currentUser.email, {
                    name: currentUser.name || 'You',
                    email: currentUser.email,
                    role: myRole,
                    color: getCollabColor(currentUser.email),
                    lastSeen: Date.now()
                });
                renderDocCollaboratorsUI();
            }
            try {
                stompClient.send(`/app/documents/${doc.id}/presence`, {}, JSON.stringify({
                    documentId: doc.id,
                    action: action,
                    senderEmail: currentUser.email,
                    senderName: currentUser.name || currentUser.email.split('@')[0],
                    role: myRole
                }));
            } catch (e) {}
        }

        function broadcastDocumentEdit(content, title) {
            if (!canEditCurrentDoc() || !stompClient || !stompClient.connected || !currentDoc || !currentDoc.id || !currentUser) return;
            if (isReceivingRemoteEdit) return;

            // Synchronize CRDT state and broadcast character-level CRDT operations
            if (window.SyncPadCrdt) {
                try {
                    const crdtOps = window.SyncPadCrdt.syncFromText(content, currentUser.email);
                    if (crdtOps && crdtOps.length > 0 && crdtOps.length <= 500) {
                        for (const op of crdtOps) {
                            stompClient.send(`/app/documents/${currentDoc.id}/crdt`, {}, JSON.stringify(op));
                        }
                    }
                } catch (e) {
                    console.warn('[CRDT] syncFromText failed:', e);
                }
            }

            const coords = getLocalCaretCoordinates();

            if (docEditBroadcastTimeout) clearTimeout(docEditBroadcastTimeout);
            docEditBroadcastTimeout = setTimeout(() => {
                try {
                    stompClient.send(`/app/documents/${currentDoc.id}/edit`, {}, JSON.stringify({
                        documentId: currentDoc.id,
                        title: title || (currentDoc.title || 'Untitled Document'),
                        content: content,
                        senderEmail: currentUser.email,
                        senderName: currentUser.name || currentUser.email.split('@')[0],
                        type: 'EDIT',
                        cursorX: coords ? coords.left : null,
                        cursorY: coords ? coords.top : null,
                        cursorHeight: coords ? coords.height : 20,
                        timestamp: Date.now()
                    }));
                } catch (e) {}
            }, 60);
        }

        function handleDocumentCollaborationEvent(data) {
            if (!data || !currentDoc || Number(data.documentId) !== Number(currentDoc.id)) return;

            // Dual-broadcast (dot + slash topics) delivers each message twice — dedup.
            try {
                const dedupKey = (data.senderEmail || '') + '|' + (data.type || '') + '|' + (data.timestamp || '') + '|' + String((data.content || '').length) + '|' + String(data.cursorX ?? '') + ',' + String(data.cursorY ?? '');
                const now = Date.now();
                if (!window.__collabDedup) window.__collabDedup = new Map();
                const last = window.__collabDedup.get(dedupKey);
                if (last && (now - last) < 2000) return;
                window.__collabDedup.set(dedupKey, now);
                if (window.__collabDedup.size > 200) {
                    const firstKey = window.__collabDedup.keys().next().value;
                    window.__collabDedup.delete(firstKey);
                }
            } catch (e) {}

            const isMe = currentUser && data.senderEmail === currentUser.email;

            // Track collaborator presence
            if (data.senderEmail) {
                const existing = activeDocCollaborators.get(data.senderEmail);
                activeDocCollaborators.set(data.senderEmail, {
                    name: data.senderName || data.senderEmail.split('@')[0],
                    email: data.senderEmail,
                    role: (data.role || (existing && existing.role) || (data.senderEmail === currentDoc.ownerEmail ? 'OWNER' : 'EDITOR')).toUpperCase(),
                    color: getCollabColor(data.senderEmail),
                    lastSeen: Date.now()
                });
                renderDocCollaboratorsUI();
            }

            if (isMe) return; // Ignore own echoes

            if (data.type === 'CURSOR') {
                if (data.cursorX !== undefined && data.cursorX !== null && data.cursorY !== undefined && data.cursorY !== null) {
                    renderRemoteCursor(data.senderEmail, data.senderName, data.cursorX, data.cursorY, data.cursorHeight);
                }
            } else if (data.type === 'EDIT') {
                const sheet = document.getElementById('docPageSheet');
                const titleInput = document.getElementById('docTitleInput');

                if (titleInput && data.title && titleInput.value !== data.title) {
                    titleInput.value = data.title;
                    currentDoc.title = data.title;
                }

                if (sheet && data.content !== undefined) {
                    const isFocused = (document.activeElement === sheet || sheet.contains(document.activeElement));
                    // When CRDT is active and local user is focused/typing, character-level CRDT operations
                    // already handle real-time convergence without clobbering the caret.
                    if (!isFocused || !window.SyncPadCrdt) {
                        const savedOffset = isFocused ? getCaretCharacterOffsetWithin(sheet) : -1;

                        isReceivingRemoteEdit = true;
                        sheet.innerHTML = data.content;
                        currentDoc.content = data.content;
                        if (window.SyncPadCrdt) {
                            try {
                                window.SyncPadCrdt.init(currentDoc.id, data.content, currentUser ? currentUser.email : null);
                            } catch (e) {}
                        }
                        if (window.latexEngine) {
                            window.latexEngine.initAllCards(sheet);
                        }
                        if (typeof normalizeDocChecklists === 'function') {
                            normalizeDocChecklists(sheet);
                        }
                        refreshIcons();
                        updateDocStats();

                        if (isFocused && savedOffset >= 0) {
                            try {
                                setCaretCharacterOffsetWithin(sheet, savedOffset);
                            } catch (e) {}
                        }

                        isReceivingRemoteEdit = false;
                    }
                }

                syncDocumentInLists(currentDoc.id, data.title, data.content);

                if (data.cursorX !== undefined && data.cursorX !== null && data.cursorY !== undefined && data.cursorY !== null) {
                    renderRemoteCursor(data.senderEmail, data.senderName, data.cursorX, data.cursorY, data.cursorHeight);
                }

                showRemoteCollaboratorActivity(data.senderName || 'Collaborator');
            } else if (data.type === 'SAVED') {
                const pill = document.getElementById('docSavePill');
                const text = document.getElementById('docSaveText');
                if (pill) {
                    pill.className = 'doc-save-pill saved';
                    if (text) text.textContent = `Saved by ${data.senderName || 'collaborator'}`;
                }
            } else if (data.type === 'COMMENT' || data.type === 'COMMENT_ADDED') {
                if (currentDoc && currentDoc.id) {
                    loadDocComments(currentDoc.id);
                }
                const commenter = data.senderName || 'Collaborator';
                const commentText = data.comment && data.comment.text ? `"${data.comment.text.substring(0, 35)}..."` : 'a new comment';
                toast(`${escapeHtml(commenter)}: ${escapeHtml(commentText)}`);
            } else if (data.type === 'COMMENT_RESOLVED') {
                if (currentDoc && currentDoc.id) {
                    loadDocComments(currentDoc.id);
                }
                const resolver = data.senderName || 'Collaborator';
                const isResolved = data.comment && data.comment.resolved;
                toast(isResolved ? `${escapeHtml(resolver)} resolved a comment` : `${escapeHtml(resolver)} re-opened a comment`);
            } else if (data.type === 'COMMENT_DELETED') {
                if (currentDoc && currentDoc.id) {
                    loadDocComments(currentDoc.id);
                }
            } else if (data.type === 'MENTION') {
                const mentioner = data.senderName || data.senderEmail || 'A collaborator';
                const mentionedEmail = data.mentionedEmail;
                const mentionedName = data.mentionedName || 'you';
                const isMentionedMe = currentUser && (
                    (mentionedEmail && currentUser.email && mentionedEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
                    (data.mentionedUserId && currentUser.id && Number(data.mentionedUserId) === Number(currentUser.id))
                );

                if (isMentionedMe) {
                    toast(`${escapeHtml(mentioner)} mentioned you in this document!`);
                    if (typeof highlightMentionPillsForUser === 'function') {
                        highlightMentionPillsForUser(currentUser.email, currentUser.name, currentUser.id);
                    }
                } else {
                    toast(`${escapeHtml(mentioner)} mentioned @${escapeHtml(mentionedName)}`);
                }
            } else if (data.type === 'PERMISSION_CHANGE') {
                const targetEmail = data.targetEmail;
                const targetUserId = data.targetUserId;
                const isTargetMe = currentUser && (currentUser.email === targetEmail || currentUser.id === targetUserId);

                if (isTargetMe) {
                    const newRole = data.newRole;
                    if (newRole) {
                        currentDoc.currentUserRole = newRole;
                        applyDocumentRole(newRole);
                        const roleNameMap = {
                            'OWNER': 'Owner',
                            'EDITOR': 'Editor',
                            'COMMENTER': 'Commenter',
                            'VIEWER': 'View Only',
                            'RESTRICTED': 'Restricted'
                        };
                        toast(`Your role for this document was updated to: ${roleNameMap[newRole] || newRole}`);
                    } else {
                        // Reverted to workspace default: fetch document to resolve effective role
                        if (token && currentDoc.id) {
                            fetchWithAuth(`/documents/${currentDoc.id}`).then(r => r && r.ok ? r.json() : null).then(fresh => {
                                if (fresh && fresh.currentUserRole) {
                                    currentDoc.currentUserRole = fresh.currentUserRole;
                                    applyDocumentRole(fresh.currentUserRole);
                                    toast(`Your permissions have reverted to workspace default (${fresh.currentUserRole}).`);
                                }
                            }).catch(() => {});
                        }
                    }
                } else if (targetEmail && activeDocCollaborators.has(targetEmail)) {
                    const collab = activeDocCollaborators.get(targetEmail);
                    collab.role = data.newRole || 'EDITOR';
                    activeDocCollaborators.set(targetEmail, collab);
                    renderDocCollaboratorsUI();
                }

                if (activeAccessDocId && Number(activeAccessDocId) === Number(currentDoc.id)) {
                    loadDocumentPermissions(activeAccessDocId);
                }
            }
        }

        function renderDocCollaboratorsUI() {
            const group = document.getElementById('docCollaboratorsAvatarGroup');
            const countLabel = document.getElementById('docConnectedUsersCount');
            if (!group) return;

            const users = Array.from(activeDocCollaborators.values());
            const count = Math.max(1, users.length);

            if (countLabel) {
                countLabel.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:var(--success);"></span> ${count} ${count === 1 ? 'user' : 'users'} connected`;
            }

            if (users.length === 0) {
                group.innerHTML = `
                    <div class="avatar-presence" style="background: var(--accent-primary);" title="You (Active)">
                        ${(currentUser && currentUser.name) ? currentUser.name[0].toUpperCase() : 'Y'}
                        <span class="presence-dot"></span>
                    </div>
                `;
                return;
            }

            group.innerHTML = users.slice(0, 4).map(u => {
                const initial = (u.name || u.email || 'U')[0].toUpperCase();
                const isYou = currentUser && u.email === currentUser.email;
                const role = (u.role || (isYou ? (currentDoc ? currentDoc.currentUserRole : 'EDITOR') : 'EDITOR')).toUpperCase();
                const roleLabels = {
                    'OWNER': 'Owner',
                    'EDITOR': 'Editor',
                    'COMMENTER': 'Commenter',
                    'VIEWER': 'View Only',
                    'RESTRICTED': 'Restricted'
                };
                const roleText = roleLabels[role] || role;
                return `
                    <div class="avatar-presence" style="background: ${u.color};" title="${escapeHtml(u.name)}${isYou ? ' (You)' : ''} • ${roleText}">
                        ${initial}
                        <span class="presence-dot"></span>
                    </div>
                `;
            }).join('');

            if (users.length > 4) {
                group.innerHTML += `
                    <div class="avatar-presence" style="background: var(--bg-hover); color: var(--text-secondary); font-size: 0.68rem;" title="+${users.length - 4} other team members">+${users.length - 4}</div>
                `;
            }
        }

        let remoteActivityTimeout = null;
        function showRemoteCollaboratorActivity(name) {
            const footerStatus = document.getElementById('footerStatusText');
            if (!footerStatus) return;
            footerStatus.innerHTML = `<span style="color: var(--accent-primary); font-weight: 500;">${escapeHtml(name)} edited just now</span>`;
            if (remoteActivityTimeout) clearTimeout(remoteActivityTimeout);
            remoteActivityTimeout = setTimeout(() => {
                const now = new Date();
                footerStatus.textContent = `Auto-saved at ${now.toLocaleTimeString()}`;
            }, 3000);
        }

        // ==========================================
        // REAL-TIME NOTIFICATIONS & STOMP WEBSOCKETS