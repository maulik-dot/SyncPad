        function toggleFormat(type) {
            restoreDocSelection();
            const sheet = document.getElementById('docPageSheet');
            if (sheet) sheet.focus();

            if (type === 'bold') {
                document.execCommand('bold', false, null);
            } else if (type === 'italic') {
                document.execCommand('italic', false, null);
            } else if (type === 'underline') {
                document.execCommand('underline', false, null);
            } else if (type === 'strikethrough') {
                document.execCommand('strikeThrough', false, null);
            } else if (type === 'code') {
                const sel = window.getSelection();
                if (sel.rangeCount > 0 && !sel.isCollapsed) {
                    const range = sel.getRangeAt(0);
                    const codeEl = document.createElement('code');
                    codeEl.textContent = range.toString();
                    range.deleteContents();
                    range.insertNode(codeEl);
                }
            } else if (type === 'subscript') {
                document.execCommand('subscript', false, null);
            } else if (type === 'superscript') {
                document.execCommand('superscript', false, null);
            }
            saveDocSelection();
            updateDocStats();
            syncToolbarStates();
            onDocChange();
        }

        function toggleColorPicker(type, e) {
            if (e) e.stopPropagation();
            const menuId = type === 'text' ? 'textColorPicker' : 'highlightColorPicker';
            const menu = document.getElementById(menuId);
            const willOpen = menu && menu.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen && menu) menu.classList.remove('hidden');
            refreshIcons();
        }

        function applyColor(type, color) {
            restoreDocSelection();
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;
            sheet.focus();

            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (sheet.contains(range.commonAncestorContainer) || sheet === range.commonAncestorContainer) {
                    if (!range.collapsed) {
                        try {
                            const fragment = range.extractContents();
                            const span = document.createElement('span');
                            if (type === 'text') {
                                const isGradient = color && color.includes('gradient');
                                if (isGradient) {
                                    span.style.background = color;
                                    span.style.webkitBackgroundClip = 'text';
                                    span.style.webkitTextFillColor = 'transparent';
                                    span.style.backgroundClip = 'text';
                                    span.style.color = 'transparent';
                                    // Clear previous gradient/color styles inside
                                    const innerEls = fragment.querySelectorAll('[style*="color"], [style*="background"]');
                                    innerEls.forEach(el => { el.style.color = ''; el.style.background = ''; el.style.webkitBackgroundClip = ''; el.style.webkitTextFillColor = ''; el.style.backgroundClip = ''; });
                                } else {
                                    span.style.color = color;
                                    const innerEls = fragment.querySelectorAll('[style*="color"]');
                                    innerEls.forEach(el => { el.style.color = ''; el.style.background = ''; el.style.webkitBackgroundClip = ''; el.style.webkitTextFillColor = ''; el.style.backgroundClip = ''; });
                                }
                            } else {
                                span.style.backgroundColor = color;
                                const innerEls = fragment.querySelectorAll('[style*="background"]');
                                innerEls.forEach(el => { el.style.backgroundColor = ''; });
                            }
                            span.appendChild(fragment);
                            range.insertNode(span);

                            const newRange = document.createRange();
                            newRange.selectNodeContents(span);
                            sel.removeAllRanges();
                            sel.addRange(newRange);
                            savedDocRange = newRange.cloneRange();
                        } catch (e) {
                            if (type === 'text') {
                                const isGrad = color && color.includes('gradient');
                                if (isGrad) {
                                    // Fallback: create span with gradient for future typing
                                    const span = document.createElement('span');
                                    span.style.background = color;
                                    span.style.webkitBackgroundClip = 'text';
                                    span.style.webkitTextFillColor = 'transparent';
                                    span.style.backgroundClip = 'text';
                                    span.style.color = 'transparent';
                                    span.textContent = '\u200B';
                                    range.insertNode(span);
                                    const nr = document.createRange();
                                    nr.setStart(span.firstChild, 1);
                                    nr.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(nr);
                                } else {
                                    document.execCommand('foreColor', false, color);
                                }
                            } else {
                                document.execCommand('hiliteColor', false, color);
                            }
                        }
                    } else {
                        if (type === 'text') {
                            const isGrad = color && color.includes('gradient');
                            if (isGrad) {
                                // Collapsed caret: prepare gradient span for next typed chars
                                const sel2 = window.getSelection();
                                let node = sel2.anchorNode;
                                if (node && node.nodeType === 3) {
                                    const offset = sel2.anchorOffset;
                                    const span = document.createElement('span');
                                    span.style.background = color;
                                    span.style.webkitBackgroundClip = 'text';
                                    span.style.webkitTextFillColor = 'transparent';
                                    span.style.backgroundClip = 'text';
                                    span.style.color = 'transparent';
                                    span.textContent = '\u200B';
                                    const after = node.splitText(offset);
                                    node.parentNode.insertBefore(span, after);
                                    const nr = document.createRange();
                                    nr.setStart(span.firstChild, 1);
                                    nr.collapse(true);
                                    sel2.removeAllRanges();
                                    sel2.addRange(nr);
                                } else if (node) {
                                    node.style.background = color;
                                    node.style.webkitBackgroundClip = 'text';
                                    node.style.webkitTextFillColor = 'transparent';
                                    node.style.backgroundClip = 'text';
                                    node.style.color = 'transparent';
                                }
                            } else {
                                document.execCommand('foreColor', false, color);
                            }
                        } else {
                            document.execCommand('hiliteColor', false, color);
                        }
                    }
                }
            }

            if (type === 'text') {
                const ind = document.getElementById('textColorIndicator');
                if (ind) ind.style.background = color;
                const menu = document.getElementById('textColorPicker');
                if (menu) menu.classList.add('hidden');
                // Sync custom picker inputs
                const cIn = document.getElementById('customTextColorInput');
                const hIn = document.getElementById('customTextColorHex');
                if (cIn && color && !color.includes('gradient') && /^#[0-9A-Fa-f]{3,6}$/.test(color)) {
                    cIn.value = color.length === 4 ? '#' + color[1]+color[1]+color[2]+color[2]+color[3]+color[3] : color;
                    if (hIn) hIn.value = color;
                }
                toast('Text color applied');
            } else {
                const ind = document.getElementById('highlightColorIndicator');
                if (ind) ind.style.background = color;
                const menu = document.getElementById('highlightColorPicker');
                if (menu) menu.classList.add('hidden');
                toast('Highlight color applied');
            }
            updateDocStats();
            syncToolbarStates();
            onDocChange();
        }

        function applyCustomTextColor() {
            const hexInput = document.getElementById('customTextColorHex');
            const colorInput = document.getElementById('customTextColorInput');
            let color = (hexInput && hexInput.value.trim()) || (colorInput && colorInput.value) || '#2563eb';
            if (!color.startsWith('#')) color = '#' + color;
            if (!/^#[0-9A-Fa-f]{6}$/.test(color) && !/^#[0-9A-Fa-f]{3}$/.test(color)) {
                toast('Invalid hex color, use #RRGGBB');
                return;
            }
            if (color.length === 4) color = '#' + color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
            if (colorInput) colorInput.value = color;
            if (hexInput) hexInput.value = color;
            applyColor('text', color);
        }

        // Sync custom text color picker inputs
        document.addEventListener('DOMContentLoaded', () => {
            const cIn = document.getElementById('customTextColorInput');
            const hIn = document.getElementById('customTextColorHex');
            if (cIn && hIn) {
                cIn.addEventListener('input', () => { hIn.value = cIn.value; });
                hIn.addEventListener('input', () => {
                    let v = hIn.value.trim();
                    if (!v.startsWith('#')) v = '#' + v;
                    if (/^#[0-9A-Fa-f]{6}$/.test(v) || /^#[0-9A-Fa-f]{3}$/.test(v)) {
                        const norm = v.length===4 ? '#'+v[1]+v[1]+v[2]+v[2]+v[3]+v[3] : v;
                        cIn.value = norm;
                    }
                });
                hIn.addEventListener('keydown', (e) => { if (e.key==='Enter') { e.preventDefault(); applyCustomTextColor(); }});
            }
        });

        function setTextAlign(align) {
            document.getElementById('docPageSheet').focus();
            if (align === 'left') document.execCommand('justifyLeft', false, null);
            else if (align === 'center') document.execCommand('justifyCenter', false, null);
            else if (align === 'right') document.execCommand('justifyRight', false, null);
            else if (align === 'justify') document.execCommand('justifyFull', false, null);
            updateDocStats();
            syncToolbarStates();
            onDocChange();
            toast(`Align: ${align}`);
        }

        function toggleLineSpacing(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('lineSpacingMenu');
            const willOpen = menu && menu.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen && menu) menu.classList.remove('hidden');
            refreshIcons();
        }

        function setDocLineSpacing(val, label) {
            restoreDocSelection();
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;
            sheet.focus();

            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                let node = range.commonAncestorContainer;
                if (node.nodeType === 3) node = node.parentElement;
                
                while (node && node !== sheet && !['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'DIV', 'LI'].includes(node.tagName)) {
                    node = node.parentElement;
                }
                if (node && node !== sheet) {
                    node.style.lineHeight = val;
                } else {
                    sheet.style.lineHeight = val;
                }
            } else {
                sheet.style.lineHeight = val;
            }
            
            closeAllDocMenus();
            onDocChange();
            toast(`Line spacing: ${label}`);
        }

        function addDocParagraphSpacing(pos) {
            restoreDocSelection();
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;
            sheet.focus();

            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                let node = range.commonAncestorContainer;
                if (node.nodeType === 3) node = node.parentElement;
                while (node && node !== sheet && !['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'DIV'].includes(node.tagName)) {
                    node = node.parentElement;
                }
                if (node && node !== sheet) {
                    if (pos === 'before') {
                        node.style.marginTop = '1.25rem';
                    } else {
                        node.style.marginBottom = '1.25rem';
                    }
                }
            }
            closeAllDocMenus();
            onDocChange();
            toast(`Added space ${pos} paragraph`);
        }

        function toggleDocChecklistItem(checkboxEl, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            const item = checkboxEl.closest('.doc-checklist-item');
            if (!item) return;

            const isChecked = item.classList.contains('checked') || item.getAttribute('data-checked') === 'true';
            if (isChecked) {
                item.classList.remove('checked');
                item.setAttribute('data-checked', 'false');
            } else {
                item.classList.add('checked');
                item.setAttribute('data-checked', 'true');
            }

            if (typeof onDocChange === 'function') {
                onDocChange();
            }
            if (typeof updateDocStats === 'function') {
                updateDocStats();
            }
        }

        function createChecklistItemHtml(text = 'New action item', checked = false) {
            return `<li class="doc-checklist-item ${checked ? 'checked' : ''}" data-checked="${checked ? 'true' : 'false'}"><span class="doc-checklist-checkbox" contenteditable="false" onclick="toggleDocChecklistItem(this, event)" title="Toggle completion"><svg class="checkbox-tick-svg" viewBox="0 0 16 16"><rect class="checkbox-box" x="1" y="1" width="14" height="14" rx="3.5" ry="3.5"></rect><path class="checkbox-mark" d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span><span class="doc-checklist-text" contenteditable="true">${text}</span></li>`;
        }

        function handleChecklistKeydown(e) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return false;

            const node = sel.anchorNode;
            const textSpan = node && node.nodeType === 3 ? (node.parentElement ? node.parentElement.closest('.doc-checklist-text') : null) : (node ? node.closest('.doc-checklist-text') : null);
            const item = textSpan ? textSpan.closest('.doc-checklist-item') : (node && node.closest ? node.closest('.doc-checklist-item') : null);

            if (!item) return false;

            if (e.key === 'Enter') {
                e.preventDefault();
                const currentText = textSpan ? textSpan.innerText.trim() : '';

                // If empty, exit the checklist and convert to a standard paragraph
                if (!currentText || currentText === '') {
                    const ul = item.closest('.doc-checklist');
                    item.remove();
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    if (ul && ul.parentNode) {
                        if (ul.children.length === 0) {
                            ul.parentNode.replaceChild(p, ul);
                        } else {
                            ul.parentNode.insertBefore(p, ul.nextSibling);
                        }
                    }
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    onDocChange();
                    return true;
                }

                // Create next checklist item
                const temp = document.createElement('div');
                temp.innerHTML = createChecklistItemHtml('<br>', false);
                const newItem = temp.firstElementChild;
                item.parentNode.insertBefore(newItem, item.nextSibling);

                const nextTextSpan = newItem.querySelector('.doc-checklist-text');
                if (nextTextSpan) {
                    nextTextSpan.focus();
                    const range = document.createRange();
                    range.selectNodeContents(nextTextSpan);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                onDocChange();
                return true;
            }

            if (e.key === 'Backspace') {
                const isAtStart = sel.anchorOffset === 0 && sel.focusOffset === 0;
                const currentText = textSpan ? textSpan.innerText.trim() : '';
                if (isAtStart && (!currentText || currentText === '')) {
                    e.preventDefault();
                    const ul = item.closest('.doc-checklist');
                    const prevItem = item.previousElementSibling;
                    item.remove();

                    if (prevItem) {
                        const prevText = prevItem.querySelector('.doc-checklist-text');
                        if (prevText) {
                            const range = document.createRange();
                            range.selectNodeContents(prevText);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    } else if (ul) {
                        const p = document.createElement('p');
                        p.innerHTML = '<br>';
                        if (ul.children.length === 0) {
                            ul.parentNode.replaceChild(p, ul);
                        } else {
                            ul.parentNode.insertBefore(p, ul);
                        }
                        const range = document.createRange();
                        range.setStart(p, 0);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                    onDocChange();
                    return true;
                }
            }

            return false;
        }

        function handleSpecialBlockKeydown(e) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return false;

            const node = sel.anchorNode;
            if (!node) return false;

            const sheet = document.getElementById('docPageSheet');
            if (!sheet || (!sheet.contains(node) && sheet !== node)) return false;

            // 1. Check for Callout Box (.doc-callout)
            let callout = node.nodeType === 3 ? node.parentElement : node;
            while (callout && callout !== sheet && !callout.classList?.contains('doc-callout')) {
                callout = callout.parentElement;
            }
            if (callout === sheet) callout = null;

            // 2. Check for Quote Box (blockquote or .doc-quote)
            let quote = node.nodeType === 3 ? node.parentElement : node;
            while (quote && quote !== sheet && quote.tagName !== 'BLOCKQUOTE' && !quote.classList?.contains('doc-quote')) {
                quote = quote.parentElement;
            }
            if (quote === sheet) quote = null;

            // 3. Check for Code Block (.doc-code-card / pre)
            let codeCard = node.nodeType === 3 ? node.parentElement : node;
            while (codeCard && codeCard !== sheet && !codeCard.classList?.contains('doc-code-card') && codeCard.tagName !== 'PRE') {
                codeCard = codeCard.parentElement;
            }
            if (codeCard === sheet) codeCard = null;
            if (codeCard && codeCard.tagName === 'PRE') {
                codeCard = codeCard.closest('.doc-code-card') || codeCard;
            }

            const targetBlock = callout || quote || codeCard;
            if (!targetBlock) return false;

            if (e.key === 'Enter') {
                // Code block has its own Shift+Enter (newline) / Enter (exit) handling
                if (codeCard) {
                    if (e.shiftKey) {
                        // Shift+Enter: New line INSIDE code block — preserve as code
                        e.preventDefault();
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        // In <pre><code> a text "\n" preserves code formatting better than <br>
                        const nl = document.createTextNode('\n');
                        range.insertNode(nl);
                        const newRange = document.createRange();
                        newRange.setStartAfter(nl);
                        newRange.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        onDocChange();
                        updateDocStats();
                        setTimeout(() => scrollCursorIntoView(), 10);
                        return true;
                    } else {
                        // Enter: Exit code block to normal paragraph
                        e.preventDefault();
                        const p = document.createElement('p');
                        p.innerHTML = '<br>';
                        if (targetBlock.parentNode) {
                            targetBlock.parentNode.insertBefore(p, targetBlock.nextSibling);
                        }
                        const newRange = document.createRange();
                        newRange.setStart(p, 0);
                        newRange.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        syncToolbarStates();
                        onDocChange();
                        updateDocStats();
                        setTimeout(() => scrollCursorIntoView(), 10);
                        return true;
                    }
                }
                if (e.shiftKey) {
                    // Shift+Enter: Insert a soft line break INSIDE the current callout / quote
                    e.preventDefault();
                    const range = sel.getRangeAt(0);
                    range.deleteContents();

                    const br = document.createElement('br');
                    range.insertNode(br);

                    // Position caret immediately after the <br>
                    const newRange = document.createRange();
                    newRange.setStartAfter(br);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);

                    onDocChange();
                    updateDocStats();
                    setTimeout(() => scrollCursorIntoView(), 10);
                    return true;
                } else {
                    // Enter: Exit the callout / quote and switch to Normal Text (<p>) on the next line
                    e.preventDefault();
                    const range = sel.getRangeAt(0);

                    // Container holding the text (div inside callout, or quote block)
                    let textContainer = callout ? (callout.querySelector('.doc-callout-content') || callout.querySelector('div:not(.doc-callout-icon)') || callout) : quote;

                    const p = document.createElement('p');

                    // Extract trailing contents if the cursor is in the middle of text
                    let hasTrailing = false;
                    try {
                        const trailingRange = document.createRange();
                        trailingRange.setStart(range.endContainer, range.endOffset);
                        trailingRange.setEndAfter(textContainer.lastChild || textContainer);
                        const extracted = trailingRange.extractContents();
                        if (extracted && extracted.textContent && extracted.textContent.trim().length > 0) {
                            p.appendChild(extracted);
                            hasTrailing = true;
                        }
                    } catch (err) {
                        hasTrailing = false;
                    }

                    if (!hasTrailing) {
                        p.innerHTML = '<br>';
                    }

                    // Insert the new <p> immediately after the callout/quote
                    if (targetBlock.parentNode) {
                        targetBlock.parentNode.insertBefore(p, targetBlock.nextSibling);
                    }

                    // Move caret to the beginning of the new normal text paragraph
                    const newRange = document.createRange();
                    newRange.setStart(p, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);

                    // Sync toolbar style dropdown to 'Normal text'
                    syncToolbarStates();
                    onDocChange();
                    updateDocStats();
                    setTimeout(() => scrollCursorIntoView(), 10);
                    return true;
                }
            }

            if (e.key === 'Backspace') {
                const isAtStart = sel.anchorOffset === 0 && sel.focusOffset === 0;
                const blockText = targetBlock.textContent.trim();
                // If the block is empty (or only contains placeholder "Note:" with no user text), convert back to normal <p>
                if (isAtStart && (!blockText || blockText === '' || blockText === 'Note:')) {
                    e.preventDefault();
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    if (targetBlock.parentNode) {
                        targetBlock.parentNode.replaceChild(p, targetBlock);
                    }
                    const newRange = document.createRange();
                    newRange.setStart(p, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);

                    syncToolbarStates();
                    onDocChange();
                    updateDocStats();
                    return true;
                }
            }

            return false;
        }

        function normalizeDocChecklists(container = document.getElementById('docPageSheet')) {
            if (!container) return;
            const items = container.querySelectorAll('.doc-checklist-item');
            items.forEach(item => {
                item.removeAttribute('onclick');
                const isChecked = item.classList.contains('checked') || item.getAttribute('data-checked') === 'true';
                item.setAttribute('data-checked', isChecked ? 'true' : 'false');
                if (isChecked) item.classList.add('checked');

                let checkbox = item.querySelector('.doc-checklist-checkbox');
                let textSpan = item.querySelector('.doc-checklist-text');

                if (!checkbox || !textSpan) {
                    const rawText = item.textContent.replace(/^[✓✔︎\s\u25a2\u25a0]*/, '').trim() || 'Action item';
                    item.innerHTML = `
                        <span class="doc-checklist-checkbox" contenteditable="false" onclick="toggleDocChecklistItem(this, event)" title="Toggle completion">
                            <svg class="checkbox-tick-svg" viewBox="0 0 16 16">
                                <rect class="checkbox-box" x="1" y="1" width="14" height="14" rx="3.5" ry="3.5"></rect>
                                <path class="checkbox-mark" d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                            </svg>
                        </span>
                        <span class="doc-checklist-text" contenteditable="true">${rawText}</span>
                    `;
                }
            });
        }

        function insertList(type) {
            const sheet = document.getElementById('docPageSheet');
            sheet.focus();
            if (type === 'bullet') {
                document.execCommand('insertUnorderedList', false, null);
            } else if (type === 'number') {
                document.execCommand('insertOrderedList', false, null);
            } else if (type === 'check') {
                const checklistHtml = `
                    <ul class="doc-checklist">
                        ${createChecklistItemHtml('New action item', false)}
                    </ul><p><br></p>
                `;
                document.execCommand('insertHTML', false, checklistHtml);
                setTimeout(() => {
                    const lastText = sheet.querySelector('.doc-checklist-item:last-of-type .doc-checklist-text');
                    if (lastText) {
                        lastText.focus();
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(lastText);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }, 40);
            }
            updateDocStats();
            onDocChange();
        }

        function adjustIndent(delta) {
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;
            sheet.focus();
            // Try native indent first for list handling, then ensure margin-left is captured for persistence
            const sel = window.getSelection();
            let target = null;
            if (sel && sel.rangeCount > 0) {
                let node = sel.getRangeAt(0).commonAncestorContainer;
                if (node.nodeType === 3) node = node.parentElement;
                while (node && node !== sheet && !['P','H1','H2','H3','H4','BLOCKQUOTE','PRE','LI','DIV'].includes(node.tagName) && !node.classList.contains('doc-callout') && !node.classList.contains('doc-code-card')) {
                    node = node.parentElement;
                }
                if (node && node !== sheet) target = node;
            }
            if (target) {
                // Direct margin-left handling for reliable export persistence
                const computed = window.getComputedStyle(target);
                const currentMl = parseFloat(computed.marginLeft) || 0;
                const step = 40; // 40px per indent level ~ 30pt
                let nextMl = delta > 0 ? currentMl + step : Math.max(0, currentMl - step);
                // Also try native for lists, but override with explicit margin for blocks
                if (target.tagName === 'LI' || target.closest('ul, ol')) {
                    try { document.execCommand(delta > 0 ? 'indent' : 'outdent', false, null); } catch(e) {}
                    // Re-query after execCommand
                    if (sel && sel.rangeCount > 0) {
                        let n = sel.getRangeAt(0).commonAncestorContainer;
                        if (n.nodeType === 3) n = n.parentElement;
                        while (n && n !== sheet && n.tagName !== 'LI') n = n.parentElement;
                        if (n && n !== sheet) n.style.marginLeft = nextMl > 0 ? nextMl + 'px' : '';
                    }
                } else {
                    target.style.marginLeft = nextMl > 0 ? nextMl + 'px' : '';
                    // Ensure block keeps its semantic tag, just indented
                }
            } else {
                try { document.execCommand(delta > 0 ? 'indent' : 'outdent', false, null); } catch(e) {}
            }
            updateDocStats();
            onDocChange();
            syncToolbarStates();
        }

        function toggleInsertDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('insertDropdownMenu');
            const willOpen = menu && menu.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen && menu) menu.classList.remove('hidden');
            refreshIcons();
        }

        function insertElement(type) {
            const menu = document.getElementById('insertDropdownMenu');
            if (menu) menu.classList.add('hidden');
            document.getElementById('docPageSheet').focus();
            
            if (type === 'link') {
                const url = prompt('Enter hyperlink URL:', 'https://');
                if (url) document.execCommand('createLink', false, url);
            } else if (type === 'image') {
                const url = prompt('Enter image URL:', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800');
                if (url) {
                    const imgHtml = `<img src="${url}" style="max-width:100%; border-radius:var(--radius-md); margin:1rem 0; border:1px solid var(--border-color);" alt="Inserted Image"><p></p>`;
                    document.execCommand('insertHTML', false, imgHtml);
                }
            } else if (type === 'table') {
                const tableHtml = `
                    <table class="doc-table">
                        <thead>
                            <tr>
                                <th>Header 1</th>
                                <th>Header 2</th>
                                <th>Header 3</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Data cell 1</td>
                                <td>Data cell 2</td>
                                <td>Data cell 3</td>
                            </tr>
                            <tr>
                                <td>Data cell 4</td>
                                <td>Data cell 5</td>
                                <td>Data cell 6</td>
                            </tr>
                        </tbody>
                    </table><p></p>
                `;
                document.execCommand('insertHTML', false, tableHtml);
            } else if (type === 'codeblock') {
                const codeHtml = `
                    <div class="doc-code-card">
                        <div class="doc-code-header">
                            <span>Code Snippet</span>
                            <span class="badge" style="background:#334155;color:#cbd5e1;font-size:0.65rem;">Code</span>
                        </div>
                        <div class="doc-code-content">
                            <pre style="margin:0;font-family:inherit;"><code>// Enter code snippet here...</code></pre>
                        </div>
                    </div><p></p>
                `;
                document.execCommand('insertHTML', false, codeHtml);
            } else if (type === 'divider') {
                document.execCommand('insertHorizontalRule', false, null);
            } else if (type === 'callout') {
                const calloutHtml = `
                    <div class="doc-callout">
                        <i data-lucide="info" style="width:20px;height:20px;color:var(--accent-primary);flex-shrink:0;margin-top:2px;"></i>
                        <div class="doc-callout-content" contenteditable="true"><strong>Note:</strong> Add important context or takeaway notes here.</div>
                    </div><p><br></p>
                `;
                document.execCommand('insertHTML', false, calloutHtml);
                refreshIcons();
                setTimeout(() => {
                    const sheet = document.getElementById('docPageSheet');
                    if (sheet) {
                        const lastCallout = sheet.querySelector('.doc-callout:last-of-type .doc-callout-content') || sheet.querySelector('.doc-callout:last-of-type div');
                        if (lastCallout) {
                            lastCallout.focus();
                            const range = document.createRange();
                            range.selectNodeContents(lastCallout);
                            range.collapse(false);
                            const sel = window.getSelection();
                            if (sel) {
                                sel.removeAllRanges();
                                sel.addRange(range);
                            }
                        }
                    }
                }, 50);
            } else if (type === 'mention') {
                openMentionDropdownAtCaret();
            } else if (type === 'comment') {
                captureSelectionForComment();
                toggleCommentsSidebar();
            } else if (type === 'latex') {
                console.log('[ latex insert ] clicked, latexEngine:', !!window.latexEngine);
                if (typeof toast === 'function') toast('LaTeX style clicked — inserting...');
                const sheet = document.getElementById('docPageSheet');
                if (sheet) sheet.focus();
                restoreDocSelection();

                let selectedFormula = '';
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    selectedFormula = sel.toString().trim();
                }

                if (window.latexEngine) {
                    const latexHtml = window.latexEngine.generateCardHtml(selectedFormula);
                    let inserted = false;

                    if (sel && sel.rangeCount > 0 && sheet && sheet.contains(sel.anchorNode)) {
                        try {
                            const range = sel.getRangeAt(0);
                            range.deleteContents();
                            const frag = range.createContextualFragment(latexHtml + '<p><br></p>');
                            range.insertNode(frag);
                            inserted = true;
                        } catch (e) {
                            inserted = false;
                        }
                    }

                    if (!inserted) {
                        try {
                            inserted = document.execCommand('insertHTML', false, latexHtml);
                        } catch (e) {
                            inserted = false;
                        }
                    }

                    if (!inserted && sheet) {
                        const temp = document.createElement('div');
                        temp.innerHTML = latexHtml + '<p><br></p>';
                        while (temp.firstChild) {
                            sheet.appendChild(temp.firstChild);
                        }
                        inserted = true;
                    }

                    refreshIcons();
                    setTimeout(() => {
                        if (sheet) {
                            window.latexEngine.initAllCards(sheet);
                            const cards = sheet.querySelectorAll('.doc-latex-card');
                            const targetCard = cards[cards.length - 1];
                            if (targetCard) {
                                try {
                                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                } catch (_) {}
                                window.latexEngine.openHoverEditor(targetCard);
                            }
                        }
                    }, 60);

                    if (typeof toast === 'function') {
                        toast('LaTeX equation box inserted!');
                    }
                } else {
                    console.error('latexEngine not loaded for insertElement latex');
                    if (typeof toast === 'function') toast('LaTeX engine not loaded — hard refresh (Ctrl+Shift+R)','error');
                }
            }
            updateDocStats();
            onDocChange();
        }

        function formatDocAction(action) {
            document.getElementById('docPageSheet').focus();
            if (action === 'undo') {
                document.execCommand('undo', false, null);
            } else if (action === 'redo') {
                document.execCommand('redo', false, null);
            }
            updateDocStats();
            onDocChange();
        }

        function syncToolbarStates() {
            try {
                const sheet = document.getElementById('docPageSheet');
                if (!sheet) return;

                const isBold = document.queryCommandState('bold');
                const isItalic = document.queryCommandState('italic');
                const isUnderline = document.queryCommandState('underline');
                const isStrike = document.queryCommandState('strikeThrough');
                const isSub = document.queryCommandState('subscript');
                const isSup = document.queryCommandState('superscript');

                const boldBtn = document.getElementById('boldBtn');
                const italicBtn = document.getElementById('italicBtn');
                const underlineBtn = document.getElementById('underlineBtn');
                const strikeBtn = document.getElementById('strikeBtn');
                const subBtn = document.getElementById('subBtn');
                const supBtn = document.getElementById('supBtn');

                if (boldBtn) boldBtn.classList.toggle('active', isBold);
                if (italicBtn) italicBtn.classList.toggle('active', isItalic);
                if (underlineBtn) underlineBtn.classList.toggle('active', isUnderline);
                if (strikeBtn) strikeBtn.classList.toggle('active', isStrike);
                if (subBtn) subBtn.classList.toggle('active', isSub);
                if (supBtn) supBtn.classList.toggle('active', isSup);

                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const node = sel.anchorNode;
                    let el = node && node.nodeType === 3 ? node.parentElement : node;
                    if (el && el.firstElementChild && el.firstElementChild.tagName === 'SPAN') {
                        if (el.firstElementChild.style.fontSize || el.firstElementChild.style.fontFamily) {
                            el = el.firstElementChild;
                        }
                    }

                    if (el && (sheet.contains(el) || sheet === el)) {
                        // 1. Detect Block Style
                        let block = el;
                        while (block && block !== sheet && !['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'LI'].includes(block.tagName) && !block.classList.contains('doc-callout')) {
                            block = block.parentElement;
                        }

                        let styleName = 'Normal text';
                        let styleType = 'p';
                        if (block && block !== sheet) {
                            if (block.tagName === 'H1') { styleName = 'Heading 1'; styleType = 'h1'; }
                            else if (block.tagName === 'H2') { styleName = 'Heading 2'; styleType = 'h2'; }
                            else if (block.tagName === 'H3') { styleName = 'Heading 3'; styleType = 'h3'; }
                            else if (block.tagName === 'BLOCKQUOTE') { styleName = 'Quote'; styleType = 'quote'; }
                            else if (block.tagName === 'PRE') { styleName = 'Code Block'; styleType = 'code'; }
                            else if (block.classList.contains('doc-callout')) { styleName = 'Callout'; styleType = 'callout'; }
                        }

                        const styleLabel = document.getElementById('currentStyleLabel');
                        if (styleLabel) styleLabel.textContent = styleName;

                        const styleMenuItems = document.querySelectorAll('#styleDropdownMenu .doc-menu-item');
                        styleMenuItems.forEach(item => {
                            const fnAttr = item.getAttribute('onclick') || '';
                            item.classList.toggle('active', fnAttr.includes(`'${styleType}'`));
                        });

                        // 2. Detect Font Size
                        let sizePt = null;
                        let sizeNode = el;
                        while (sizeNode && sizeNode !== sheet && !sizePt) {
                            if (sizeNode.style && sizeNode.style.fontSize) {
                                const parsed = parseInt(sizeNode.style.fontSize, 10);
                                if (parsed) sizePt = parsed;
                            }
                            sizeNode = sizeNode.parentElement;
                        }
                        if (!sizePt) {
                            const computed = window.getComputedStyle(el);
                            const px = parseFloat(computed.fontSize);
                            if (px) sizePt = Math.round(px * 0.75);
                        }
                        if (sizePt) {
                            const sizeLabel = document.getElementById('currentFontSizeLabel');
                            if (sizeLabel) sizeLabel.textContent = sizePt;
                            const sizeMenuItems = document.querySelectorAll('#fontSizeDropdownMenu .doc-menu-item');
                            sizeMenuItems.forEach(item => {
                                const text = item.innerText.trim();
                                item.classList.toggle('active', text === String(sizePt));
                            });
                        }

                        // 3. Detect Font Family
                        let fontName = null;
                        let fontNode = el;
                        while (fontNode && fontNode !== sheet && !fontName) {
                            if (fontNode.style && fontNode.style.fontFamily) {
                                fontName = fontNode.style.fontFamily;
                            }
                            fontNode = fontNode.parentElement;
                        }
                        if (!fontName) {
                            const computed = window.getComputedStyle(el);
                            fontName = computed.fontFamily;
                        }
                        if (fontName) {
                            const firstFont = fontName.split(',')[0].replace(/['"]/g, '').trim();
                            const fontLabel = document.getElementById('currentFontLabel');
                            if (fontLabel && firstFont) {
                                fontLabel.textContent = firstFont;
                                fontLabel.style.fontFamily = fontName;
                            }
                            const fontMenuItems = document.querySelectorAll('#fontDropdownMenu .doc-menu-item');
                            fontMenuItems.forEach(item => {
                                const text = item.innerText.trim();
                                item.classList.toggle('active', text.toLowerCase() === firstFont.toLowerCase());
                            });
                        }

                        // 4. Detect Alignment
                        const computed = window.getComputedStyle(el);
                        const textAlign = computed.textAlign;
                        const alignLeftBtn = document.getElementById('alignLeftBtn');
                        const alignCenterBtn = document.getElementById('alignCenterBtn');
                        const alignRightBtn = document.getElementById('alignRightBtn');
                        const alignJustifyBtn = document.getElementById('alignJustifyBtn');

                        if (alignLeftBtn) alignLeftBtn.classList.toggle('active', textAlign === 'left' || textAlign === 'start');
                        if (alignCenterBtn) alignCenterBtn.classList.toggle('active', textAlign === 'center');
                        if (alignRightBtn) alignRightBtn.classList.toggle('active', textAlign === 'right');
                        if (alignJustifyBtn) alignJustifyBtn.classList.toggle('active', textAlign === 'justify');
                    }
                }
            } catch (e) {
                console.warn('syncToolbarStates error:', e);
            }
        }

        // =========================================================================
        // CONTRIBUTOR MENTION SYSTEM (@MENTION)