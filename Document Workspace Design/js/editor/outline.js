        // =========================================================================
        // DYNAMIC DOCUMENT OUTLINE & HEADING NAVIGATION SYSTEM
        // =========================================================================
        let docOutlineDebounceTimer = null;
        let docOutlineScrollSpyAttached = false;
        let activeOutlineHeadingId = null;

        function toggleDocOutline() {
            const outline = document.getElementById('docOutlineDrawer');
            if (!outline) return;
            const isOpening = outline.classList.contains('hidden');
            outline.classList.toggle('hidden');
            const btn = document.getElementById('docOutlineBtn');
            if (btn) btn.classList.toggle('active', isOpening);
            if (isOpening) {
                updateDocOutline();
                initDocOutlineScrollSpy();
            }
            refreshIcons();
        }

        function triggerDocOutlineUpdate(debounceMs = 300) {
            if (docOutlineDebounceTimer) clearTimeout(docOutlineDebounceTimer);
            docOutlineDebounceTimer = setTimeout(() => {
                const outline = document.getElementById('docOutlineDrawer');
                // Always update if drawer is open or exists
                if (outline && !outline.classList.contains('hidden')) {
                    updateDocOutline();
                }
            }, debounceMs);
        }

        function updateDocOutline() {
            const list = document.getElementById('docOutlineList');
            const countBadge = document.getElementById('docOutlineCountBadge');
            if (!list) return;

            const sheet = document.getElementById('docPageSheet');
            if (!sheet) {
                list.innerHTML = `
                    <div class="doc-outline-empty">
                        <div class="doc-outline-empty-icon"><i data-lucide="file-text" style="width:16px;height:16px;"></i></div>
                        <span style="font-size:0.75rem;">No active document loaded.</span>
                    </div>`;
                if (countBadge) countBadge.textContent = '0';
                refreshIcons();
                return;
            }

            const titleInput = document.getElementById('docTitleInput');
            const docTitle = (titleInput ? titleInput.value.trim() : '') || (currentDoc ? currentDoc.title : '') || 'Untitled Document';

            const headings = Array.from(sheet.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            if (countBadge) countBadge.textContent = String(headings.length);

            let html = '';

            // 1. Root Document Title Item
            html += `
                <div class="doc-outline-item doc-outline-title ${!activeOutlineHeadingId ? 'active' : ''}" onclick="scrollToDocTop()" title="Jump to Document Title">
                    <span class="doc-outline-dot" style="background: var(--accent-primary);"></span>
                    <span class="truncate" style="font-weight:600;">${escapeHtml(docTitle)}</span>
                </div>
            `;

            if (headings.length === 0) {
                html += `
                    <div class="doc-outline-empty">
                        <div class="doc-outline-empty-icon">
                            <i data-lucide="heading" style="width:16px;height:16px;"></i>
                        </div>
                        <div style="font-weight:600; font-size:0.78rem; color:var(--text-primary);">No Headings Yet</div>
                        <div style="font-size:0.72rem; line-height:1.4;">
                            Use the formatting toolbar or shortcuts <kbd style="font-family:monospace; background:var(--bg-hover); padding:1px 4px; border-radius:3px;">⌘1</kbd>, <kbd style="font-family:monospace; background:var(--bg-hover); padding:1px 4px; border-radius:3px;">⌘2</kbd>, <kbd style="font-family:monospace; background:var(--bg-hover); padding:1px 4px; border-radius:3px;">⌘3</kbd> to add headings to your document.
                        </div>
                    </div>
                `;
                list.innerHTML = html;
                refreshIcons();
                return;
            }

            // Dot colors by heading level
            const levelDotColors = {
                1: 'var(--accent-primary)',
                2: '#8b5cf6',
                3: '#10b981',
                4: '#f59e0b',
                5: '#ec4899',
                6: '#64748b'
            };

            headings.forEach((heading, idx) => {
                const tag = heading.tagName.toLowerCase();
                const level = parseInt(tag.charAt(1), 10) || 1;
                const text = heading.innerText.trim() || `(Untitled ${tag.toUpperCase()})`;

                // Ensure unique, stable heading ID
                let headingId = heading.getAttribute('id');
                if (!headingId) {
                    headingId = `doc-h-${idx}-${text.slice(0, 20).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                    heading.setAttribute('id', headingId);
                }

                const isActive = activeOutlineHeadingId === headingId;
                const dotColor = levelDotColors[level] || 'var(--border-strong)';

                html += `
                    <a href="javascript:void(0)" 
                       class="doc-outline-item doc-outline-level-${level} ${isActive ? 'active' : ''}" 
                       data-heading-id="${headingId}"
                       onclick="scrollToDocOutlineItem('${headingId}')" 
                       title="${escapeHtml(text)}">
                        <span class="doc-outline-dot" style="background: ${dotColor};"></span>
                        <span class="truncate">${escapeHtml(text)}</span>
                    </a>
                `;
            });

            list.innerHTML = html;
            refreshIcons();
        }

        function scrollToDocTop() {
            activeOutlineHeadingId = null;
            const editorPane = document.querySelector('.doc-editor-pane');
            if (editorPane) {
                editorPane.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            updateDocOutlineActiveState(null);
        }

        function scrollToDocOutlineItem(headingId) {
            const heading = document.getElementById(headingId);
            if (!heading) return;

            activeOutlineHeadingId = headingId;
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Apply attention flash animation
            heading.classList.remove('doc-heading-highlight');
            void heading.offsetWidth; // Force reflow
            heading.classList.add('doc-heading-highlight');
            setTimeout(() => {
                heading.classList.remove('doc-heading-highlight');
            }, 1800);

            updateDocOutlineActiveState(headingId);
        }

        function updateDocOutlineActiveState(activeId) {
            const items = document.querySelectorAll('#docOutlineList .doc-outline-item');
            items.forEach(item => {
                if (!activeId) {
                    if (item.classList.contains('doc-outline-title')) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                } else {
                    const itemId = item.getAttribute('data-heading-id');
                    if (itemId === activeId) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                }
            });
        }

        function initDocOutlineScrollSpy() {
            const editorPane = document.querySelector('.doc-editor-pane');
            if (!editorPane || docOutlineScrollSpyAttached) return;

            docOutlineScrollSpyAttached = true;
            let ticking = false;

            editorPane.addEventListener('scroll', () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        handleDocOutlineScroll();
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });
        }

        function handleDocOutlineScroll() {
            const outline = document.getElementById('docOutlineDrawer');
            if (!outline || outline.classList.contains('hidden')) return;

            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;

            const editorPane = document.querySelector('.doc-editor-pane');
            const paneTop = editorPane ? editorPane.getBoundingClientRect().top : 0;

            const headings = Array.from(sheet.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            if (headings.length === 0) return;

            // Check if user scrolled near top
            if (editorPane && editorPane.scrollTop < 60) {
                if (activeOutlineHeadingId !== null) {
                    activeOutlineHeadingId = null;
                    updateDocOutlineActiveState(null);
                }
                return;
            }

            // Find heading closest to top viewport line
            let currentHeading = null;
            const threshold = paneTop + 140;

            for (let i = 0; i < headings.length; i++) {
                const h = headings[i];
                const rect = h.getBoundingClientRect();
                if (rect.top <= threshold) {
                    currentHeading = h;
                } else {
                    break;
                }
            }

            if (currentHeading) {
                const headingId = currentHeading.getAttribute('id');
                if (headingId && headingId !== activeOutlineHeadingId) {
                    activeOutlineHeadingId = headingId;
                    updateDocOutlineActiveState(headingId);
                }
            }
        }


        // Find and Replace System
        function toggleDocSearch() {
            const bar = document.getElementById('docFindBar');
            if (!bar) return;
            bar.classList.toggle('hidden');
            if (!bar.classList.contains('hidden')) {
                const input = document.getElementById('docFindInput');
                if (input) {
                    input.focus();
                    if (input.value) onSearchDoc(input.value);
                }
            } else {
                clearDocSearchMarks();
            }
            refreshIcons();
        }

        function closeDocSearch() {
            const bar = document.getElementById('docFindBar');
            if (bar) bar.classList.add('hidden');
            clearDocSearchMarks();
        }

        function clearDocSearchMarks() {
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;
            const marks = sheet.querySelectorAll('mark.doc-find-highlight');
            marks.forEach(mark => {
                const parent = mark.parentNode;
                if (parent) {
                    while (mark.firstChild) {
                        parent.insertBefore(mark.firstChild, mark);
                    }
                    parent.removeChild(mark);
                    parent.normalize();
                }
            });
            currentMatches = [];
            currentMatchIndex = -1;
            const counter = document.getElementById('docFindCounter');
            if (counter) counter.textContent = '0 / 0';
        }

        function onSearchDoc(query) {
            clearDocSearchMarks();
            if (!query || query.trim() === '') return;

            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;

            const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            let textNode;
            while (textNode = walker.nextNode()) {
                if (textNode.nodeValue.toLowerCase().includes(query.toLowerCase())) {
                    textNodes.push(textNode);
                }
            }

            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            textNodes.forEach(node => {
                const val = node.nodeValue;
                const parent = node.parentNode;
                if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;

                const fragment = document.createDocumentFragment();
                let lastIdx = 0;
                let match;
                while ((match = regex.exec(val)) !== null) {
                    if (match.index > lastIdx) {
                        fragment.appendChild(document.createTextNode(val.substring(lastIdx, match.index)));
                    }
                    const mark = document.createElement('mark');
                    mark.className = 'doc-find-highlight';
                    mark.textContent = match[0];
                    fragment.appendChild(mark);
                    lastIdx = regex.lastIndex;
                }
                if (lastIdx < val.length) {
                    fragment.appendChild(document.createTextNode(val.substring(lastIdx)));
                }
                parent.replaceChild(fragment, node);
            });

            currentMatches = Array.from(sheet.querySelectorAll('mark.doc-find-highlight'));
            const counter = document.getElementById('docFindCounter');
            if (currentMatches.length > 0) {
                currentMatchIndex = 0;
                highlightCurrentMatch();
            } else {
                if (counter) counter.textContent = '0 / 0';
            }
        }

        function highlightCurrentMatch() {
            currentMatches.forEach((m, idx) => {
                m.classList.toggle('current', idx === currentMatchIndex);
            });
            const counter = document.getElementById('docFindCounter');
            if (counter) {
                counter.textContent = `${currentMatchIndex + 1} / ${currentMatches.length}`;
            }
            if (currentMatches[currentMatchIndex]) {
                currentMatches[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function findNextMatch() {
            if (currentMatches.length === 0) return;
            currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length;
            highlightCurrentMatch();
        }

        function findPrevMatch() {
            if (currentMatches.length === 0) return;
            currentMatchIndex = (currentMatchIndex - 1 + currentMatches.length) % currentMatches.length;
            highlightCurrentMatch();
        }

        function replaceCurrentMatch() {
            if (currentMatches.length === 0 || currentMatchIndex < 0) return;
            const currentMark = currentMatches[currentMatchIndex];
            const replaceInput = document.getElementById('docReplaceInput');
            const replaceVal = replaceInput ? replaceInput.value : '';
            
            const textNode = document.createTextNode(replaceVal);
            if (currentMark.parentNode) {
                currentMark.parentNode.replaceChild(textNode, currentMark);
            }
            
            currentMatches.splice(currentMatchIndex, 1);
            if (currentMatches.length > 0) {
                if (currentMatchIndex >= currentMatches.length) currentMatchIndex = 0;
                highlightCurrentMatch();
            } else {
                const counter = document.getElementById('docFindCounter');
                if (counter) counter.textContent = '0 / 0';
            }
            updateDocStats();
            toast('1 match replaced');
        }

        function replaceAllMatches() {
            if (currentMatches.length === 0) return;
            const replaceInput = document.getElementById('docReplaceInput');
            const replaceVal = replaceInput ? replaceInput.value : '';
            const total = currentMatches.length;
            
            currentMatches.forEach(mark => {
                const textNode = document.createTextNode(replaceVal);
                if (mark.parentNode) {
                    mark.parentNode.replaceChild(textNode, mark);
                }
            });
            
            currentMatches = [];
            currentMatchIndex = -1;
            const counter = document.getElementById('docFindCounter');
            if (counter) counter.textContent = '0 / 0';
            
            updateDocStats();
            toast(`All ${total} matches replaced`);
        }

        // Rich Text Formatting Toolbar
        function toggleStyleDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('styleDropdownMenu');
            const willOpen = menu && menu.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen && menu) menu.classList.remove('hidden');
            refreshIcons();
        }

        function toggleFontDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('fontDropdownMenu');
            const willOpen = menu && menu.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen && menu) menu.classList.remove('hidden');
            refreshIcons();
        }

        function toggleFontSizeDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('fontSizeDropdownMenu');
            const willOpen = menu && menu.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen && menu) menu.classList.remove('hidden');
            refreshIcons();
        }

        function selectTextStyle(type, label) {
            restoreDocSelection();
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;
            sheet.focus();

            const styleLabel = document.getElementById('currentStyleLabel');
            if (styleLabel) styleLabel.textContent = label;
            const menu = document.getElementById('styleDropdownMenu');
            if (menu) menu.classList.add('hidden');

            if (type === 'code') {
                insertElement('codeblock');
            } else if (type === 'callout') {
                insertElement('callout');
            } else if (type === 'latex') {
                insertElement('latex');
            } else {
                const tag = type === 'quote' ? 'blockquote' : (type === 'p' ? 'p' : type);
                try {
                    document.execCommand('formatBlock', false, `<${tag}>`);
                } catch (e) {
                    try {
                        document.execCommand('formatBlock', false, tag);
                    } catch (e2) {}
                }

                // Verify block element was updated; if not, wrap/convert block element directly
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    let node = sel.anchorNode;
                    if (node.nodeType === 3) node = node.parentElement;
                    while (node && node !== sheet && !['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'DIV', 'LI'].includes(node.tagName)) {
                        node = node.parentElement;
                    }
                    if (node && node !== sheet && node.tagName !== 'LI') {
                        const targetTag = tag.toUpperCase();
                        if (node.tagName !== targetTag && node.tagName !== 'DIV') {
                            const newEl = document.createElement(tag);
                            newEl.innerHTML = node.innerHTML;
                            node.parentNode.replaceChild(newEl, node);
                            
                            const newRange = document.createRange();
                            newRange.selectNodeContents(newEl);
                            newRange.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(newRange);
                        }
                    }
                }
            }

            saveDocSelection();
            onDocChange();
            if (typeof triggerDocOutlineUpdate === 'function') {
                triggerDocOutlineUpdate(0);
            }
            updateDocStats();
            syncToolbarStates();
            toast(`Style: ${label}`);
        }


        function saveDocSelection() {
            try {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    const sheet = document.getElementById('docPageSheet');
                    if (sheet && (sheet.contains(range.commonAncestorContainer) || sheet === range.commonAncestorContainer)) {
                        savedDocRange = range.cloneRange();
                    }
                }
            } catch (e) {}
        }

        function restoreDocSelection() {
            try {
                if (savedDocRange) {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(savedDocRange);
                }
            } catch (e) {}
        }

        function applyInlineStyle(property, value) {
            restoreDocSelection();
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;

            sheet.focus();
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            const range = sel.getRangeAt(0);
            if (!sheet.contains(range.commonAncestorContainer) && sheet !== range.commonAncestorContainer) {
                return;
            }

            if (property === 'fontFamily') {
                try {
                    document.execCommand('fontName', false, value);
                } catch (e) {}
            }

            const cssProp = property === 'fontSize' ? 'font-size' : (property === 'fontFamily' ? 'font-family' : property);

            if (!range.collapsed) {
                // 1. Character-level precision: Single Text Node selection
                if (range.startContainer === range.endContainer && range.startContainer.nodeType === 3) {
                    const textNode = range.startContainer;
                    const fullText = textNode.nodeValue;
                    const start = range.startOffset;
                    const end = range.endOffset;

                    const beforeText = fullText.substring(0, start);
                    const selectedText = fullText.substring(start, end);
                    const afterText = fullText.substring(end);

                    const parent = textNode.parentNode;

                    // If the parent is already a span with only this text node and entire text is selected
                    if (parent && parent.tagName === 'SPAN' && parent !== sheet && parent.childNodes.length === 1 && !beforeText && !afterText) {
                        parent.style[property] = value;
                        const newRange = document.createRange();
                        newRange.selectNodeContents(parent);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        savedDocRange = newRange.cloneRange();
                    } else {
                        // Create styled span for the selected character(s)
                        const span = document.createElement('span');
                        if (parent && parent.tagName === 'SPAN' && parent !== sheet) {
                            const parentStyle = parent.getAttribute('style') || '';
                            if (parentStyle) span.setAttribute('style', parentStyle);
                        }
                        span.style[property] = value;
                        span.textContent = selectedText;

                        const frag = document.createDocumentFragment();
                        if (beforeText) frag.appendChild(document.createTextNode(beforeText));
                        frag.appendChild(span);
                        if (afterText) frag.appendChild(document.createTextNode(afterText));

                        parent.replaceChild(frag, textNode);

                        const newRange = document.createRange();
                        newRange.selectNodeContents(span);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        savedDocRange = newRange.cloneRange();
                    }
                } else {
                    // 2. Multi-node selection across elements
                    try {
                        const fragment = range.extractContents();
                        const span = document.createElement('span');
                        span.style[property] = value;

                        // Strip conflicting inner style property so new span applies to all characters
                        span.querySelectorAll('*').forEach(child => {
                            if (child.style) {
                                child.style[property] = '';
                                const st = child.getAttribute('style');
                                if (!st || st.trim() === '' || st.trim() === ';') {
                                    child.removeAttribute('style');
                                    if (child.tagName === 'SPAN') {
                                        const p = child.parentNode;
                                        while (child.firstChild) p.insertBefore(child.firstChild, child);
                                        p.removeChild(child);
                                    }
                                }
                            }
                        });

                        span.appendChild(fragment);
                        range.insertNode(span);

                        const newRange = document.createRange();
                        newRange.selectNodeContents(span);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        savedDocRange = newRange.cloneRange();
                    } catch (err) {
                        try {
                            if (property === 'fontFamily') {
                                document.execCommand('fontName', false, value);
                            }
                        } catch (e) {}
                    }
                }
            } else {
                // Collapsed range (caret): prepare zero-width span for typed characters
                let node = sel.anchorNode;
                if (node && node.nodeType === 3) {
                    const textNode = node;
                    const offset = sel.anchorOffset;
                    const span = document.createElement('span');
                    if (textNode.parentElement && textNode.parentElement.tagName === 'SPAN') {
                        span.setAttribute('style', textNode.parentElement.getAttribute('style') || '');
                    }
                    span.style[property] = value;
                    span.textContent = '\u200B';

                    const afterNode = textNode.splitText(offset);
                    textNode.parentNode.insertBefore(span, afterNode);

                    const newRange = document.createRange();
                    newRange.setStart(span.firstChild, 1);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    savedDocRange = newRange.cloneRange();
                } else if (node && node !== sheet) {
                    node.style[property] = value;
                    saveDocSelection();
                } else if (node === sheet) {
                    const p = document.createElement('p');
                    p.style[property] = value;
                    const span = document.createElement('span');
                    span.style[property] = value;
                    span.textContent = '\u200B';
                    p.appendChild(span);
                    sheet.appendChild(p);

                    const newRange = document.createRange();
                    newRange.setStart(span.firstChild, 1);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    savedDocRange = newRange.cloneRange();
                }
            }

            onDocChange();
            updateDocStats();
            syncToolbarStates();
        }

        function selectFontFamily(font, label) {
            restoreDocSelection();
            const fontLabel = document.getElementById('currentFontLabel');
            if (fontLabel) {
                fontLabel.textContent = label;
                fontLabel.style.fontFamily = font;
            }

            // Update active item in dropdown menu
            const menu = document.getElementById('fontDropdownMenu');
            if (menu) {
                menu.querySelectorAll('.doc-menu-item').forEach(btn => {
                    btn.classList.remove('active');
                    const check = btn.querySelector('svg, i');
                    if (check) check.remove();
                    if (btn.innerText.trim() === label.trim()) {
                        btn.classList.add('active');
                        const icon = document.createElement('i');
                        icon.setAttribute('data-lucide', 'check');
                        icon.style.width = '13px';
                        icon.style.height = '13px';
                        btn.appendChild(icon);
                    }
                });
                menu.classList.add('hidden');
            }

            applyInlineStyle('fontFamily', font);
            refreshIcons();
            toast(`Font: ${label}`);
        }

        function adjustFontSize(delta) {
            restoreDocSelection();
            let current = 16;

            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                let el = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
                if (el && el.firstElementChild && el.firstElementChild.tagName === 'SPAN' && el.firstElementChild.style.fontSize) {
                    el = el.firstElementChild;
                }

                let foundSize = null;
                let scan = el;
                while (scan && scan !== document.getElementById('docPageSheet')) {
                    if (scan.style && scan.style.fontSize) {
                        const parsed = parseInt(scan.style.fontSize, 10);
                        if (parsed) {
                            foundSize = parsed;
                            break;
                        }
                    }
                    scan = scan.parentElement;
                }
                if (foundSize) {
                    current = foundSize;
                } else if (el) {
                    const computedPx = parseFloat(window.getComputedStyle(el).fontSize);
                    if (computedPx) current = Math.round(computedPx * 0.75);
                }
            }

            const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];
            let next;
            if (delta > 0) {
                next = sizes.find(s => s > current) || (current + 4);
            } else {
                const rev = [...sizes].reverse();
                next = rev.find(s => s < current) || Math.max(8, current - 2);
            }

            if (next < 8) next = 8;
            if (next > 96) next = 96;

            selectFontSize(next);
        }

        function selectFontSize(size) {
            const sizePt = parseInt(size, 10);
            if (!sizePt) return;

            const sizeLabel = document.getElementById('currentFontSizeLabel');
            if (sizeLabel) sizeLabel.textContent = sizePt;

            applyInlineStyle('fontSize', sizePt + 'pt');

            const sizeMenu = document.getElementById('fontSizeDropdownMenu');
            if (sizeMenu) sizeMenu.classList.add('hidden');
            toast(`Font size: ${sizePt}pt`);
        }
