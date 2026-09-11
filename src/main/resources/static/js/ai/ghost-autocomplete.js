/**
 * SyncPad Ghost Autocomplete — Tab to accept next sentence
 * Debounce 800ms on docPageSheet, streams EXPAND with 500 chars before caret,
 * shows ghost text at caret, Tab to accept, Esc to dismiss. Toggle in Settings → AI & Ghost.
 */
(function () {
    'use strict';

    const DEBOUNCE_MS = 800;
    const CONTEXT_CHARS = 500;
    const GHOST_ID = 'ghostAutocompleteText';

    let debounceTimer = null;
    let abortController = null;
    let ghostText = '';
    let isEnabled = false;

    function loadEnabled() {
        try {
            const v = localStorage.getItem('syncpad_ghost_enabled');
            if (v !== null) return v === 'true';
        } catch (e) {}
        return false; // default OFF until user enables in Settings
    }

    function saveEnabled(val) {
        try { localStorage.setItem('syncpad_ghost_enabled', String(val)); } catch (e) {}
    }

    function updateSettingsUI() {
        const toggle = document.getElementById('ghostToggle');
        const slider = document.getElementById('ghostToggleSlider');
        const knob = document.getElementById('ghostToggleKnob');
        const label = document.getElementById('ghostStatusLabel');
        const statusText = document.getElementById('ghostStatusText');
        if (toggle) toggle.checked = isEnabled;
        if (slider) slider.style.background = isEnabled ? '#7c3aed' : '#cbd5e1';
        if (knob) knob.style.left = isEnabled ? '22px' : '2px';
        if (label) {
            label.textContent = isEnabled ? 'ON' : 'OFF';
            label.style.color = isEnabled ? '#7c3aed' : 'var(--text-muted)';
        }
        if (statusText) {
            statusText.innerHTML = isEnabled
                ? 'Ghost is <strong style="color:#7c3aed">ON</strong> — type a half-word like <code>collab</code> + pause 300ms or full sentence + 800ms, then <kbd>Tab</kbd> to accept.'
                : 'Ghost is <strong>OFF</strong> — enable to get inline Tab completions for half-words & sentences.';
        }
        if (window.lucide) window.lucide.createIcons();
    }

    window.switchSettingsTab = function (tab, el) {
        document.querySelectorAll('#settingsModal .sidebar-item').forEach(a => a.classList.remove('active'));
        if (el) el.classList.add('active');
        ['profile', 'ai', 'appearance', 'notifications', 'security'].forEach(t => {
            const pane = document.getElementById('settingsTab-' + t);
            if (pane) pane.classList.toggle('hidden', t !== tab);
        });
        if (tab === 'ai') updateSettingsUI();
        if (window.lucide) window.lucide.createIcons();
    };

    window.toggleGhostAutocomplete = function (checked) {
        isEnabled = !!checked;
        saveEnabled(isEnabled);
        updateSettingsUI();
        if (!isEnabled) dismissGhost();
        if (isEnabled) {
            if (typeof toast === 'function') toast(isEnabled ? 'Ghost Autocomplete ON — Tab to accept' : 'Ghost Autocomplete OFF');
        }
    };

    function isDocViewActive() {
        const sheet = document.getElementById('docPageSheet');
        const editorView = document.getElementById('editorView');
        if (!sheet || !editorView || editorView.classList.contains('hidden')) return false;
        return sheet.isContentEditable;
    }

    function getCaretContext() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        const sheet = document.getElementById('docPageSheet');
        if (!sheet || !sheet.contains(range.commonAncestorContainer) && sheet !== range.commonAncestorContainer) return null;
        if (!sel.isCollapsed) return null;
        const preRange = document.createRange();
        preRange.selectNodeContents(sheet);
        preRange.setEnd(range.startContainer, range.startOffset);
        const textBefore = preRange.toString();
        if (!textBefore || textBefore.trim().length < 3) return null; // allow half words (3 chars)
        const context = textBefore.slice(-CONTEXT_CHARS);
        // Detect half-word prefix (e.g., "collab" in "The collab")
        let wordPrefix = '';
        let isHalfWord = false;
        if (textBefore.length > 0 && !/\s$/.test(textBefore)) {
            const lastSpace = textBefore.lastIndexOf(' ');
            const lastNl = textBefore.lastIndexOf('\n');
            const lastIdx = Math.max(lastSpace, lastNl);
            const afterLast = textBefore.substring(lastIdx + 1);
            // If afterLast is a partial word (no space, and not punctuation-ended)
            if (afterLast.length > 0 && afterLast.length < 20 && !/[.!?]$/.test(afterLast)) {
                // Check if it's likely a half-word (not a complete word followed by punctuation)
                // Consider it half-word if the AI context suggests incomplete
                wordPrefix = afterLast;
                isHalfWord = true;
            }
        }
        return { range: range.cloneRange(), context, wordPrefix, isHalfWord, textBefore };
    }

    let ghostWordPrefix = ''; // for half-word completion

    function showGhost(text, range, wordPrefix = '') {
        dismissGhost();
        if (!text || !text.trim()) return;
        ghostText = text.trim();
        ghostWordPrefix = wordPrefix || '';
        // For half-word, ghostText is the completion of the prefix (e.g., "orative ...")
        // The displayed ghost should be the completion only, not the prefix
        const span = document.createElement('span');
        span.id = GHOST_ID;
        span.textContent = ghostText;
        span.style.color = '#9ca3af';
        span.style.opacity = '0.85';
        span.style.pointerEvents = 'none';
        span.style.userSelect = 'none';
        span.style.fontStyle = 'italic';
        span.setAttribute('data-ghost', 'true');
        if (wordPrefix) span.setAttribute('data-ghost-prefix', wordPrefix);
        try {
            range.insertNode(span);
            const hint = document.createElement('span');
            hint.id = GHOST_ID + '-hint';
            hint.textContent = '  Tab ↹';
            hint.style.cssText = 'color:#7c3aed; opacity:0.7; font-size:0.7em; font-style:normal; margin-left:6px; border:1px solid #cbd5e1; padding:0 4px; border-radius:4px; background:#f5f3ff;';
            hint.setAttribute('data-ghost', 'true');
            span.after(hint);
        } catch (e) {
            ghostText = '';
            ghostWordPrefix = '';
        }
    }

    function dismissGhost() {
        ghostText = '';
        ghostWordPrefix = '';
        document.querySelectorAll('[data-ghost="true"]').forEach(el => el.remove());
        if (abortController) {
            try { abortController.abort(); } catch (e) {}
            abortController = null;
        }
    }

    function acceptGhost() {
        const ghost = document.getElementById(GHOST_ID);
        if (!ghost || !ghostText) return false;
        const sel = window.getSelection();
        // For half-word, we need to delete the prefix before inserting completion
        if (ghostWordPrefix) {
            const range = sel.getRangeAt(0);
            // Find and delete the half-word prefix before caret
            const preRange = document.createRange();
            const sheet = document.getElementById('docPageSheet');
            preRange.selectNodeContents(sheet);
            // The ghost is at caret, so the prefix is immediately before ghost
            // We need to delete wordPrefix characters before ghost
            try {
                // Create a range that covers the prefix
                const ghostRange = document.createRange();
                ghostRange.selectNode(ghost);
                const beforeGhostRange = document.createRange();
                beforeGhostRange.setStart(ghostRange.startContainer, ghostRange.startOffset);
                // Move start back by wordPrefix length
                // Simpler: delete via selection: find text node containing prefix
                const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, null);
                let node, found = null;
                while (node = walker.nextNode()) {
                    const idx = node.nodeValue.lastIndexOf(ghostWordPrefix);
                    if (idx !== -1 && node.nodeValue.substring(idx) === ghostWordPrefix) {
                        // Check if this node is immediately before ghost
                        const tempRange = document.createRange();
                        tempRange.selectNodeContents(node);
                        tempRange.setEnd(node, idx + ghostWordPrefix.length);
                        // If this range is before ghost, it's the prefix
                        found = { node, idx };
                    }
                }
                if (found) {
                    const n = found.node;
                    const before = n.nodeValue.substring(0, found.idx);
                    const after = n.nodeValue.substring(found.idx + ghostWordPrefix.length);
                    n.nodeValue = before + after;
                    // Adjust range to be at correct position
                }
            } catch (e) {}
        }
        const textNode = document.createTextNode(ghostText + ' ');
        ghost.replaceWith(textNode);
        document.querySelectorAll('[data-ghost="true"]').forEach(el => el.remove());
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        ghostText = '';
        ghostWordPrefix = '';
        if (typeof window.onDocChange === 'function') window.onDocChange();
        if (typeof window.updateDocStats === 'function') window.updateDocStats();
        return true;
    }

    async function triggerGhost() {
        if (!isEnabled || !isDocViewActive()) {
            dismissGhost();
            return;
        }
        const ctx = getCaretContext();
        if (!ctx) {
            dismissGhost();
            return;
        }
        if (abortController) {
            try { abortController.abort(); } catch (e) {}
        }
        abortController = new AbortController();
        const token = localStorage.getItem('syncpad_token') || localStorage.getItem('syncpad_jwt_token') || sessionStorage.getItem('syncpad_token') || sessionStorage.getItem('syncpad_jwt_token') || '';
        const docId = (window.currentDoc && window.currentDoc.id) ? Number(window.currentDoc.id) : null;
        let prompt, selectedText;
        if (ctx.isHalfWord && ctx.wordPrefix) {
            // Half-word: ask to complete the word and continue
            prompt = `The user is typing and stopped mid-word. Context (last ${CONTEXT_CHARS} chars):\n${ctx.context}\n\nCurrent partial word: "${ctx.wordPrefix}"\nComplete this word and continue with the rest of the sentence (total 15-30 words), no prefix, no quotes. Only return the completion (without repeating the prefix) plus the next words. Example: if prefix is "collab" and next is "orative editing is fun", return "orative editing is fun."`;
            selectedText = ctx.wordPrefix;
        } else {
            prompt = `Continue the document from the caret. Context (last ${CONTEXT_CHARS} chars):\n${ctx.context}\n\nContinue with exactly ONE next sentence (15-30 words), no prefix, no quotes, just the sentence.`;
            selectedText = ctx.context.slice(-200);
        }
        const payload = {
            documentId: docId,
            action: 'EXPAND',
            prompt: prompt,
            selectedText: selectedText,
            tone: 'PROFESSIONAL'
        };
        try {
            const res = await fetch('/api/ai/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });
            if (!res.ok || !res.body) throw new Error('no stream');
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let acc = '';
            let buffer = '';
            let firstSentence = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    const t = line.trim();
                    if (t.startsWith('data:')) {
                        const d = t.substring(5).trim();
                        if (d === '[DONE]') break;
                        try {
                            const p = JSON.parse(d);
                            if (p.chunk) acc += p.chunk;
                        } catch (e) {
                            if (d && d !== '[DONE]') acc += d;
                        }
                    }
                }
                // Extract first sentence (up to . ! ? )
                const m = acc.match(/^[^.!?]+[.!?]/);
                if (m) {
                    firstSentence = m[0].trim();
                    const curCtx = getCaretContext();
                    if (curCtx) showGhost(firstSentence, curCtx.range, curCtx.isHalfWord ? curCtx.wordPrefix : '');
                    if (firstSentence.split(/\s+/).length >= 8) break;
                }
            }
            if (!firstSentence) {
                const words = acc.trim().split(/\s+/).slice(0, 20).join(' ');
                if (words) {
                    firstSentence = words + (words.endsWith('.') ? '' : '.');
                    const curCtx = getCaretContext();
                    if (curCtx) showGhost(firstSentence, curCtx.range, curCtx.isHalfWord ? curCtx.wordPrefix : '');
                } else {
                    dismissGhost();
                }
            } else {
                // Already shown, keep it
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                // Silent fail, no ghost
                dismissGhost();
            }
        } finally {
            abortController = null;
        }
    }

    function initGhost() {
        isEnabled = loadEnabled();
        // Defer UI update until DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', updateSettingsUI);
        } else {
            setTimeout(updateSettingsUI, 100);
        }

        const sheet = document.getElementById('docPageSheet');
        if (!sheet) return;

        // Key handling for Tab / Esc
        sheet.addEventListener('keydown', (e) => {
            if (!isEnabled) return;
            const ghost = document.getElementById(GHOST_ID);
            if (ghost && e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                acceptGhost();
                return;
            }
            if (ghost && e.key === 'Escape') {
                e.preventDefault();
                dismissGhost();
                return;
            }
            // Any typing should dismiss ghost and debounce new trigger
            if (ghost && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                dismissGhost();
            }
        });

        // Input debounce — shorter for half-words (300ms) vs full (800ms)
        sheet.addEventListener('input', () => {
            if (!isEnabled) {
                dismissGhost();
                return;
            }
            if (debounceTimer) clearTimeout(debounceTimer);
            dismissGhost();
            const ctx = getCaretContext();
            const delay = (ctx && ctx.isHalfWord) ? 300 : DEBOUNCE_MS;
            debounceTimer = setTimeout(() => {
                triggerGhost();
            }, delay);
        });

        // Also on keyup for navigation, dismiss
        sheet.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                dismissGhost();
            }
        });

        // Click dismisses
        sheet.addEventListener('click', () => dismissGhost());
        sheet.addEventListener('blur', () => dismissGhost());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGhost);
    } else {
        initGhost();
    }

    // Expose for debugging
    window.GhostAutocomplete = {
        isEnabled: () => isEnabled,
        dismiss: dismissGhost,
        trigger: triggerGhost
    };
})();
