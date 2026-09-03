/**
 * SyncPad Code & LaTeX Contextual AI Help
 * Shows an additional AI pill when caret is inside doc-code-card or doc-latex-card.
 * Only in those contexts will the AI palette offer CODE/LATEX actions.
 */
(function () {
    'use strict';

    let currentContext = null; // 'code' | 'latex' | null
    let currentElement = null;
    let pillEl = null;

    function getContextAtCaret() {
        const sel = window.getSelection();
        const sheet = document.getElementById('docPageSheet');
        // Also handle LaTeX hover editor being focused (textarea #latexHoverSourceInput)
        const activeEl = document.activeElement;
        if (activeEl && activeEl.id === 'latexHoverSourceInput') {
            const hoverCard = document.getElementById('latexHoverEditorCard');
            const latexId = window.latexEngine?.activeHoverCardId;
            let source = activeEl.value || '';
            let cardEl = latexId ? document.getElementById(latexId) : null;
            if (!cardEl && hoverCard) cardEl = hoverCard;
            // Fallback: find any visible latex card near the hover
            if (!cardEl) cardEl = document.querySelector('.doc-latex-card');
            return { type: 'latex', element: cardEl || hoverCard || sheet, latexSource: source, text: source.substring(0, 500), isHoverEditor: true };
        }
        if (!sel || sel.rangeCount === 0) return null;
        let node = sel.anchorNode;
        if (!node) return null;
        if (node.nodeType === 3) node = node.parentElement;
        if (!sheet || !sheet.contains(node)) return null;

        const codeCard = node.closest('.doc-code-card');
        if (codeCard) {
            const codeEl = codeCard.querySelector('pre code') || codeCard.querySelector('code') || codeCard.querySelector('pre');
            const lang = codeCard.getAttribute('data-language') || codeEl?.getAttribute('data-language') || (codeCard.querySelector('.badge')?.textContent?.trim()) || 'javascript';
            const text = codeEl ? (codeEl.innerText || codeEl.textContent || '') : '';
            return { type: 'code', element: codeCard, codeEl, language: lang, text: text.substring(0, 800) };
        }
        const latexCard = node.closest('.doc-latex-card');
        if (latexCard) {
            const source = latexCard.getAttribute('data-latex-source') || latexCard.textContent || '';
            return { type: 'latex', element: latexCard, latexSource: source, text: source.substring(0, 500) };
        }
        // Also show pill on hover over latex card even without caret
        const hoveredLatex = node.closest ? node.closest('.doc-latex-card') : null;
        if (hoveredLatex) {
            const source = hoveredLatex.getAttribute('data-latex-source') || '';
            return { type: 'latex', element: hoveredLatex, latexSource: source, text: source.substring(0, 500) };
        }
        return null;
    }

    let hideTimer = null;
    let lastTarget = null;

    function ensurePill() {
        if (pillEl) return pillEl;
        pillEl = document.createElement('div');
        pillEl.id = 'codeLatexAiPill';
        pillEl.style.cssText = 'position:fixed; display:none; align-items:center; gap:6px; background:#0f172a; color:#e2e8f0; border:1px solid #1e293b; border-radius:9999px; padding:4px 10px; font-size:0.72rem; font-weight:600; box-shadow:0 4px 16px rgba(0,0,0,0.25); z-index:40; cursor:pointer; will-change:transform; pointer-events:auto;';
        pillEl.innerHTML = '<span style="width:18px;height:18px;background:#7c3aed;color:white;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">✦</span><span id="codeLatexAiPillText">AI Help</span>';
        pillEl.addEventListener('mousedown', (e) => { e.preventDefault(); });
        pillEl.addEventListener('click', () => {
            if (!currentContext) return;
            if (currentContext.type === 'code') openCodeAiPalette();
            else if (currentContext.type === 'latex') openLatexAiPalette();
        });
        // Keep pill visible when hovering over it
        pillEl.addEventListener('mouseenter', () => {
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
            if (lastTarget) positionPill(lastTarget);
        });
        pillEl.addEventListener('mouseleave', (e) => {
            // Only hide if not moving back to the card
            const toCard = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.doc-code-card, .doc-latex-card');
            if (!toCard) scheduleHide();
        });
        document.body.appendChild(pillEl);
        return pillEl;
    }

    function positionPill(targetEl) {
        const pill = ensurePill();
        const rect = targetEl.getBoundingClientRect();
        lastTarget = targetEl;
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        // Fixed position (viewport) to avoid scroll jitter; offset -36 to avoid overlapping latex-quick-edit-pill (-12)
        let left = rect.right - 110;
        let top = rect.top - 36;
        // Clamp within viewport
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (left < 8) left = 8;
        if (left + 120 > vw) left = vw - 124;
        if (top < 8) top = rect.bottom + 8;
        if (top + 32 > vh) top = Math.max(8, vh - 40);
        pill.style.left = left + 'px';
        pill.style.top = top + 'px';
        pill.style.display = 'flex';
        // Update label per type
        const label = pill.querySelector('#codeLatexAiPillText');
        if (label) label.textContent = targetEl.classList.contains('doc-latex-card') ? 'AI LaTeX' : 'AI Help';
    }

    function hidePill() {
        if (pillEl) pillEl.style.display = 'none';
        currentContext = null;
        currentElement = null;
        lastTarget = null;
    }

    function scheduleHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            hidePill();
        }, 120);
    }

    function openCodeAiPalette() {
        if (!currentContext || currentContext.type !== 'code') return;
        // Use existing AI palette but with code context
        const sel = window.getSelection();
        let selectedText = '';
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
            selectedText = sel.toString().trim().substring(0, 1200);
        } else {
            selectedText = currentContext.text || '';
        }
        // Store for ai-assistant to pick up
        window._codeLatexContext = {
            type: 'code',
            language: currentContext.language,
            selectedText: selectedText,
            element: currentContext.element
        };
        // Open palette with code-specific prompt
        if (typeof window.openAiPalette === 'function') {
            window.openAiPalette();
            // After opening, inject code-specific buttons
            setTimeout(() => {
                const palette = document.getElementById('docAiPalette');
                if (!palette) return;
                let extra = document.getElementById('codeAiExtraActions');
                if (!extra) {
                    extra = document.createElement('div');
                    extra.id = 'codeAiExtraActions';
                    extra.style.cssText = 'display:flex; gap:6px; margin:0.5rem 0; flex-wrap:wrap;';
                    const actions = document.getElementById('aiPromptInput')?.parentElement;
                    if (actions) actions.before(extra);
                    else palette.appendChild(extra);
                }
                extra.innerHTML = `
                    <button class="btn btn-outline btn-xs" onclick="window.executeCodeAi('CODE_EXPLAIN')" style="font-size:0.72rem; gap:4px;"><i data-lucide="code-2" style="width:11px;height:11px;"></i> Explain Code</button>
                    <button class="btn btn-outline btn-xs" onclick="window.executeCodeAi('CODE_FIX')" style="font-size:0.72rem; gap:4px;"><i data-lucide="wrench" style="width:11px;height:11px;"></i> Fix Code</button>
                    <button class="btn btn-primary btn-xs" onclick="window.executeCodeAi('CODE_GENERATE')" style="font-size:0.72rem; gap:4px;"><i data-lucide="terminal" style="width:11px;height:11px;"></i> Generate</button>
                `;
                if (window.lucide) window.lucide.createIcons();
                const hint = document.getElementById('aiSelectionBadge');
                if (hint) {
                    hint.textContent = `Code • ${currentContext.language} • ${selectedText.length} chars`;
                    hint.classList.remove('hidden');
                }
            }, 50);
        }
    }

    function openLatexAiPalette() {
        if (!currentContext || currentContext.type !== 'latex') return;
        const selectedText = currentContext.latexSource || currentContext.text || '';
        window._codeLatexContext = {
            type: 'latex',
            selectedText: selectedText,
            element: currentContext.element
        };
        if (typeof window.openAiPalette === 'function') {
            window.openAiPalette();
            setTimeout(() => {
                let extra = document.getElementById('codeAiExtraActions');
                if (!extra) {
                    extra = document.createElement('div');
                    extra.id = 'codeAiExtraActions';
                    extra.style.cssText = 'display:flex; gap:6px; margin:0.5rem 0; flex-wrap:wrap;';
                    const actions = document.getElementById('aiPromptInput')?.parentElement;
                    if (actions) actions.before(extra);
                    else document.getElementById('docAiPalette')?.appendChild(extra);
                }
                extra.innerHTML = `
                    <button class="btn btn-outline btn-xs" onclick="window.executeCodeAi('LATEX_EXPLAIN')" style="font-size:0.72rem; gap:4px;"><i data-lucide="sigma" style="width:11px;height:11px;"></i> Explain Equation</button>
                    <button class="btn btn-primary btn-xs" onclick="window.executeCodeAi('LATEX_GENERATE')" style="font-size:0.72rem; gap:4px;"><i data-lucide="function-square" style="width:11px;height:11px;"></i> Generate LaTeX</button>
                `;
                if (window.lucide) window.lucide.createIcons();
                const hint = document.getElementById('aiSelectionBadge');
                if (hint) {
                    hint.textContent = `LaTeX • ${selectedText.substring(0,30)}${selectedText.length>30?'…':''}`;
                    hint.classList.remove('hidden');
                }
            }, 50);
        }
    }

    window.executeCodeAi = function (actionType) {
        const ctx = window._codeLatexContext;
        if (!ctx) {
            if (typeof window.executeAiAction === 'function') window.executeAiAction(actionType, '');
            return;
        }
        const customPrompt = document.getElementById('aiPromptInput')?.value?.trim() || '';
        // For CODE_GENERATE/LATEX_GENERATE, use prompt; for EXPLAIN/FIX use selected code
        let promptToUse = customPrompt;
        let selectedText = ctx.selectedText || '';
        let language = ctx.language || null;

        // Close palette and trigger streaming with new params
        if (typeof window.closeAiPalette === 'function') window.closeAiPalette();

        // Call AI with code/latex context + selectionLength aware
        const selectionLength = selectedText ? selectedText.length : 0;
        if (typeof window.startAiStreamingWithContext === 'function') {
            window.startAiStreamingWithContext(actionType, promptToUse, selectedText, language, selectionLength);
        } else if (typeof window.executeAiAction === 'function') {
            // Fallback: store language for ai-assistant to pick up
            window._aiLanguage = language;
            window._aiSelectionLength = selectionLength;
            window.executeAiAction(actionType, promptToUse);
        }
        // Clean extra
        setTimeout(() => {
            const extra = document.getElementById('codeAiExtraActions');
            if (extra) extra.remove();
        }, 100);
    };

    function initCodeLatexAi() {
        const sheet = document.getElementById('docPageSheet');
        if (!sheet) return;

        const checkContext = () => {
            try {
                const ctx = getContextAtCaret();
                if (ctx) {
                    currentContext = ctx;
                    currentElement = ctx.element;
                    positionPill(ctx.element);
                } else {
                    hidePill();
                }
            } catch(e) {
                console.warn('checkContext error:', e);
            }
        };

        sheet.addEventListener('keyup', checkContext);
        sheet.addEventListener('click', () => setTimeout(checkContext, 50));
        sheet.addEventListener('focus', checkContext);
        // Hover over any code/latex card should also show pill (even without caret) — debounced and stable
        let hoverRaf = null;
        document.addEventListener('mousemove', (e) => {
            if (!e.target || !e.target.closest) return;
            const card = e.target.closest('.doc-code-card, .doc-latex-card');
            if (!card) {
                // If moving outside cards, schedule hide unless over pill
                const overPill = e.relatedTarget && e.relatedTarget.closest && (e.relatedTarget.closest('#codeLatexAiPill') || (pillEl && pillEl.contains(e.relatedTarget)));
                if (!overPill) {
                    const ctx = getContextAtCaret();
                    if (!ctx) scheduleHide();
                }
                return;
            }
            if (hoverRaf) cancelAnimationFrame(hoverRaf);
            hoverRaf = requestAnimationFrame(() => {
                const ctx = getContextAtCaret();
                // Prefer caret context if exists, otherwise use hover card
                if (ctx && ctx.element === card) {
                    currentContext = ctx;
                    currentElement = ctx.element;
                    positionPill(ctx.element);
                } else if (!ctx || ctx.element !== card) {
                    let type = card.classList.contains('doc-code-card') ? 'code' : 'latex';
                    let text = '';
                    let language = 'javascript';
                    let latexSource = '';
                    if (type === 'code') {
                        const codeEl = card.querySelector('pre code') || card.querySelector('code');
                        text = codeEl ? (codeEl.innerText || codeEl.textContent || '').substring(0,800) : '';
                        language = card.getAttribute('data-language') || (codeEl?.getAttribute('data-language')) || (card.querySelector('.badge')?.textContent?.trim()) || 'javascript';
                        currentContext = { type, element: card, language, text };
                    } else {
                        latexSource = card.getAttribute('data-latex-source') || card.textContent || '';
                        currentContext = { type, element: card, latexSource, text: latexSource.substring(0,500) };
                    }
                    currentElement = card;
                    positionPill(card);
                }
            });
        });
        sheet.addEventListener('mouseleave', (e) => {
            const toPill = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#codeLatexAiPill');
            if (toPill) return;
            const ctx = getContextAtCaret();
            if (!ctx) scheduleHide();
        });
        // Also watch LaTeX hover editor focus
        const hoverInput = document.getElementById('latexHoverSourceInput');
        if (hoverInput) {
            hoverInput.addEventListener('focus', checkContext);
            hoverInput.addEventListener('input', () => setTimeout(checkContext, 50));
        }
        // Watch for hover editor opening — only observe that card, not whole body
        const hoverCardEl = document.getElementById('latexHoverEditorCard');
        if (hoverCardEl) {
            const observer = new MutationObserver(() => {
                const hoverCard = document.getElementById('latexHoverEditorCard');
                if (hoverCard && !hoverCard.classList.contains('hidden')) {
                    const activeId = window.latexEngine?.activeHoverCardId;
                    const cardEl = activeId ? document.getElementById(activeId) : null;
                    if (cardEl) {
                        const src = document.getElementById('latexHoverSourceInput')?.value || cardEl.getAttribute('data-latex-source') || '';
                        currentContext = { type: 'latex', element: cardEl, latexSource: src, text: src.substring(0,500), isHoverEditor: true };
                        positionPill(cardEl);
                    }
                }
            });
            observer.observe(hoverCardEl, { attributes: true, attributeFilter: ['class'] });
        }

        document.addEventListener('selectionchange', () => {
            // Don't hide if hovering over a card
            const sel = window.getSelection();
            const hasHover = currentElement && document.body.contains(currentElement);
            if (hasHover) return;
            setTimeout(checkContext, 120);
        });
        sheet.addEventListener('blur', () => scheduleHide());
        // Reposition on scroll instead of hiding (fixed position handles viewport)
        document.addEventListener('scroll', () => {
            if (currentElement && pillEl && pillEl.style.display !== 'none') {
                positionPill(currentElement);
            }
        }, true);

        // Also handle Cmd+J to be contextual
        const origOpenAiPalette = window.openAiPalette;
        if (origOpenAiPalette) {
            window.openAiPalette = function () {
                const ctx = getContextAtCaret();
                if (ctx) {
                    currentContext = ctx;
                    if (ctx.type === 'code') {
                        // Will be handled by pill logic, but also ensure palette shows code actions
                        window._codeLatexContext = { type: 'code', language: ctx.language, selectedText: ctx.text, element: ctx.element };
                    } else if (ctx.type === 'latex') {
                        window._codeLatexContext = { type: 'latex', selectedText: ctx.latexSource, element: ctx.element };
                    }
                }
                return origOpenAiPalette.apply(this, arguments);
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCodeLatexAi);
    } else {
        initCodeLatexAi();
    }
})();
