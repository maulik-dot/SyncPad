/**
 * SyncPad AI Document Assistant & Gemini Copilot
 * Provides inline slash commands (/ai), Cmd+J palette, real-time SSE streaming, and Copilot drawer.
 */

(function () {
    'use strict';

    let currentSelectionRange = null;
    let currentSelectedText = '';
    let isGenerating = false;
    let abortController = null;
    let lastGeneratedMarkdown = '';

    // Initialize once DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        initAiAssistantListeners();
    });

    function initAiAssistantListeners() {
        // Keyboard shortcut: Cmd+J or Ctrl+J
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
                e.preventDefault();
                openAiPalette();
            }
            if (e.key === 'Escape') {
                closeAiPalette();
                closeAiResultCard();
            }
        });

        // Slash command /ai detection in editor
        const editor = document.getElementById('docPageSheet');
        if (editor) {
            editor.addEventListener('keyup', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    checkSlashCommand(editor);
                }
            });
        }
    }

    function checkSlashCommand(editor) {
        const selection = window.getSelection();
        if (!selection || !selection.focusNode) return;

        const nodeText = selection.focusNode.textContent || '';
        const offset = selection.focusOffset;
        const textBeforeCursor = nodeText.substring(0, offset);

        if (textBeforeCursor.endsWith('/ai ') || textBeforeCursor.endsWith('/ai')) {
            const newText = textBeforeCursor.replace(/\/ai\s*$/, '') + nodeText.substring(offset);
            selection.focusNode.textContent = newText;
            openAiPalette();
        }
    }

    function captureSelection() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            currentSelectionRange = selection.getRangeAt(0).cloneRange();
            currentSelectedText = selection.toString().trim();
        } else {
            currentSelectionRange = null;
            currentSelectedText = '';
        }
    }

    window.openAiPalette = function () {
        captureSelection();
        const palette = document.getElementById('docAiPalette');
        if (!palette) return;

        const selectionBadge = document.getElementById('aiSelectionBadge');
        if (selectionBadge) {
            if (currentSelectedText) {
                selectionBadge.textContent = `Selection: "${currentSelectedText.substring(0, 32)}${currentSelectedText.length > 32 ? '...' : ''}"`;
                selectionBadge.classList.remove('hidden');
            } else {
                selectionBadge.classList.add('hidden');
            }
        }

        const input = document.getElementById('aiPromptInput');
        if (input) {
            input.value = '';
        }

        palette.classList.remove('hidden');
        if (input) {
            setTimeout(() => input.focus(), 50);
        }
    };

    window.closeAiPalette = function () {
        const palette = document.getElementById('docAiPalette');
        if (palette) {
            palette.classList.add('hidden');
        }
    };

    window.executeAiAction = function (actionType, defaultPrompt) {
        closeAiPalette();
        const customPrompt = document.getElementById('aiPromptInput')?.value?.trim();
        const promptToUse = customPrompt || defaultPrompt || '';

        startAiStreaming(actionType, promptToUse, currentSelectedText);
    };

    window.submitAiPrompt = function () {
        const input = document.getElementById('aiPromptInput');
        const prompt = input ? input.value.trim() : '';
        if (!prompt) return;

        closeAiPalette();
        startAiStreaming('CUSTOM', prompt, currentSelectedText);
    };

    // Contextual language for code/latex
    window._aiLanguage = null;
    window._aiSelectionLength = null;

    window.startAiStreamingWithContext = async function (action, prompt, selectedText, language, selectionLength) {
        window._aiLanguage = language || null;
        window._aiSelectionLength = selectionLength != null ? selectionLength : (selectedText ? selectedText.length : 0);
        return startAiStreaming(action, prompt, selectedText);
    };

    async function startAiStreaming(action, prompt, selectedText) {
        const resultCard = document.getElementById('docAiResultCard');
        const resultContent = document.getElementById('docAiResultContent');
        const resultStatus = document.getElementById('docAiResultStatus');
        const actionButtons = document.getElementById('docAiActionButtons');

        if (!resultCard || !resultContent) return;

        resultCard.classList.remove('hidden');
        resultContent.innerHTML = '<span class="ai-cursor-blink">▌</span>';
        if (resultStatus) {
            const langHint = window._aiLanguage ? ` • ${window._aiLanguage}` : '';
            const lenHint = window._aiSelectionLength ? ` • ${window._aiSelectionLength} chars` : '';
            resultStatus.textContent = `SyncPad AI is generating (${action.toLowerCase()}${langHint}${lenHint})...`;
        }
        if (actionButtons) {
            actionButtons.classList.add('hidden');
        }

        isGenerating = true;
        lastGeneratedMarkdown = '';
        abortController = new AbortController();

        const token = localStorage.getItem('syncpad_token') || localStorage.getItem('syncpad_jwt_token') || sessionStorage.getItem('syncpad_token') || sessionStorage.getItem('syncpad_jwt_token') || '';
        if (!token) {
            console.warn('AI stream: no auth token found in localStorage (syncpad_token / syncpad_jwt_token)');
        }
        const docId = window.currentDocId || window.currentDoc?.id || null;
        const selectionLength = window._aiSelectionLength != null ? window._aiSelectionLength : (selectedText ? selectedText.length : 0);
        const language = window._aiLanguage || null;

        const payload = {
            documentId: docId ? Number(docId) : null,
            action: action,
            prompt: prompt,
            selectedText: selectedText,
            language: language,
            selectionLength: selectionLength,
            tone: 'PROFESSIONAL'
        };

        try {
            const response = await fetch('/api/ai/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(payload),
                signal: abortController.signal,
                cache: 'no-store'
            });

            if (!response.ok) {
                let bodyText = '';
                try { bodyText = await response.text(); } catch(e) {}
                // Try to surface quota / auth detail
                let detail = bodyText ? ` — ${bodyText.substring(0,300)}` : '';
                throw new Error(`AI generation failed with status ${response.status}${detail}`);
            }
            if (!response.body) {
                throw new Error('No response body for SSE stream (check nginx buffering / proxy)');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulatedText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data:')) {
                        const dataContent = trimmed.substring(5).trim();
                        if (dataContent === '[DONE]') {
                            break;
                        }
                        try {
                            const parsed = JSON.parse(dataContent);
                            if (parsed.chunk) {
                                accumulatedText += parsed.chunk;
                                lastGeneratedMarkdown = accumulatedText;
                                renderStreamingMarkdown(resultContent, accumulatedText);
                            }
                        } catch (err) {
                            if (dataContent && dataContent !== '[DONE]') {
                                accumulatedText += dataContent;
                                lastGeneratedMarkdown = accumulatedText;
                                renderStreamingMarkdown(resultContent, accumulatedText);
                            }
                        }
                    }
                }
            }

            if (resultStatus) {
                resultStatus.innerHTML = '<i data-lucide="check" style="width:13px;height:13px;color:#10b981;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Generation Complete';
                if (window.lucide) lucide.createIcons();
            }
            if (actionButtons) {
                actionButtons.classList.remove('hidden');
                const replaceBtn = document.getElementById('aiReplaceSelectionBtn');
                if (replaceBtn) {
                    replaceBtn.style.display = currentSelectionRange ? 'inline-flex' : 'none';
                }
            }

            // If we are working on a LaTeX card/hover editor, automatically write into the LaTeX box & compile
            const activeCodeCtx = window._codeLatexContext;
            if (activeCodeCtx && activeCodeCtx.type === 'latex') {
                const formula = extractLatexFormula(lastGeneratedMarkdown);
                if (formula) {
                    applyToLatexCard(activeCodeCtx.element, formula, true);
                    if (typeof toast === 'function') toast('Equation written into LaTeX box & compiled!');
                }
            } else if (activeCodeCtx && activeCodeCtx.type === 'code') {
                const snippet = extractCodeSnippet(lastGeneratedMarkdown, activeCodeCtx.language || window._aiLanguage || 'javascript');
                if (snippet) {
                    applyToCodeCard(activeCodeCtx.element, snippet.code, snippet.lang);
                    if (typeof toast === 'function') toast('Code written into code box!');
                }
            }

            updateResultActionButtons();
        } catch (err) {
            if (err.name === 'AbortError') {
                if (resultStatus) resultStatus.textContent = 'Generation stopped by user.';
            } else {
                console.error('AI generation error:', err, 'payload:', payload);
                let msg = err.message || String(err);
                const lower = msg.toLowerCase();
                const isNetwork = lower.includes('network') || lower.includes('failed to fetch') || lower.includes('load failed') || lower.includes('prematurely closed') || lower.includes('abort');
                if (isNetwork) {
                    // Fallback to non-streaming generate (more reliable, no SSE)
                    try {
                        if (resultStatus) resultStatus.textContent = 'Stream interrupted, retrying via generate...';
                        if (resultContent) resultContent.innerHTML = '<span class="ai-cursor-blink">Retrying via fallback...</span>';
                        const genResp = await fetch('/api/ai/generate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': token ? `Bearer ${token}` : '',
                                'Cache-Control': 'no-cache'
                            },
                            body: JSON.stringify(payload),
                            cache: 'no-store'
                        });
                        if (!genResp.ok) {
                            let txt = '';
                            try { txt = await genResp.text(); } catch(e) {}
                            throw new Error(`Generate fallback failed ${genResp.status} ${txt.substring(0,200)}`);
                        }
                        const data = await genResp.json();
                        const fallbackText = data.text || '';
                        lastGeneratedMarkdown = fallbackText;
                        renderStreamingMarkdown(resultContent, fallbackText);
                        if (resultStatus) {
                            resultStatus.innerHTML = '<i data-lucide="check" style="width:13px;height:13px;color:#10b981;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Generation Complete (fallback)';
                            if (window.lucide) lucide.createIcons();
                        }
                        // Write to latex box on fallback completion as well
                        if (window._codeLatexContext?.type === 'latex') {
                            const formula = extractLatexFormula(fallbackText);
                            if (formula) {
                                applyToLatexCard(window._codeLatexContext.element, formula, true);
                                if (typeof toast === 'function') toast('Equation written into LaTeX box & compiled!');
                            }
                        }
                        updateResultActionButtons();
                        // success via fallback, don't show error
                        return;
                    } catch (fallbackErr) {
                        console.error('Fallback generate also failed:', fallbackErr);
                        msg = `Stream failed (${msg}) and fallback failed: ${fallbackErr.message}`;
                    }
                } else if (msg.includes('429') || msg.includes('503')) {
                    msg = 'Gemini busy/quota (free tier). Backend uses gemini-flash-lite-latest with fallback chain — retry shortly. ' + msg;
                }
                if (resultContent) resultContent.innerHTML = `<span style="color:#ef4444;">Error: ${msg}</span><br><small style="color:var(--text-muted);">Try again or check console (F12). Ensure logged in and GEMINI_API_KEY set. Model gemini-flash-lite-latest is active.</small>`;
                if (resultStatus) resultStatus.textContent = 'Failed to generate response.';
                if (typeof toast === 'function') toast(`AI error: ${msg}`, 'error');
            }
        } finally {
            isGenerating = false;
        }
    }

    function updateResultActionButtons() {
        const actionButtons = document.getElementById('docAiActionButtons');
        if (!actionButtons) return;
        actionButtons.classList.remove('hidden');
        const replaceBtn = document.getElementById('aiReplaceSelectionBtn');
        if (!replaceBtn) return;

        const codeCtx = window._codeLatexContext;
        const hasMath = lastGeneratedMarkdown && (lastGeneratedMarkdown.includes('$$') || lastGeneratedMarkdown.includes('\\[') || lastGeneratedMarkdown.includes('```latex'));

        if (codeCtx && codeCtx.type === 'latex') {
            replaceBtn.style.display = 'inline-flex';
            replaceBtn.innerHTML = '<i data-lucide="play" style="width:12px;height:12px;"></i> Apply to LaTeX Box & Compile';
        } else if (codeCtx && codeCtx.type === 'code') {
            replaceBtn.style.display = 'inline-flex';
            replaceBtn.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;"></i> Apply to Code Box';
        } else if (hasMath) {
            replaceBtn.style.display = 'inline-flex';
            replaceBtn.innerHTML = '<i data-lucide="play" style="width:12px;height:12px;"></i> Insert Equation Box & Compile';
        } else {
            replaceBtn.style.display = currentSelectionRange ? 'inline-flex' : 'none';
            replaceBtn.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;"></i> Replace Selection';
        }
        if (window.lucide) lucide.createIcons();
    }

    function renderStreamingMarkdown(container, markdown) {
        let html = markdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^- \[ \] (.*$)/gim, '<div class="doc-ai-task-item"><input type="checkbox" disabled style="margin-right:6px;"><span>$1</span></div>')
            .replace(/^- \[x\] (.*$)/gim, '<div class="doc-ai-task-item"><input type="checkbox" checked disabled style="margin-right:6px;"><span>$1</span></div>')
            .replace(/^- (.*$)/gim, '<li>$1</li>');

        // Render display math blocks with KaTeX if latexEngine is ready
        if (window.latexEngine && typeof window.latexEngine.renderToString === 'function') {
            html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
                try {
                    const rendered = window.latexEngine.renderToString(formula.trim());
                    return `<div class="ai-stream-math-preview" style="margin:8px 0;padding:6px 12px;background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.2);border-radius:6px;text-align:center;">${rendered}</div>`;
                } catch(e) {
                    return match;
                }
            });
            html = html.replace(/```latex\s*[\r\n]+([\s\S]*?)```/gi, (match, formula) => {
                try {
                    const rendered = window.latexEngine.renderToString(formula.trim());
                    return `<div class="ai-stream-math-preview" style="margin:8px 0;padding:6px 12px;background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.2);border-radius:6px;text-align:center;">${rendered}</div>`;
                } catch(e) {
                    return match;
                }
            });
        }

        html = html.replace(/\n\n/gim, '<p></p>').replace(/\n/gim, '<br>');
        container.innerHTML = html + '<span class="ai-cursor-blink">▌</span>';
    }

    function extractCodeSnippet(markdown, fallbackLang) {
        if (!markdown) return null;
        const fence = markdown.match(/```(\w+)?\s*[\r\n]+([\s\S]*?)```/);
        if (fence) {
            return {
                lang: (fence[1] || fallbackLang || 'javascript').toLowerCase(),
                code: fence[2].trim()
            };
        }
        let cleaned = markdown.trim().replace(/^```(\w+)?/i, '').replace(/```$/i, '').trim();
        cleaned = cleaned.replace(/^Here is the (?:corrected |fixed |generated )?code:?\s*[\r\n]*/i, '');
        return {
            lang: (fallbackLang || 'javascript').toLowerCase(),
            code: cleaned
        };
    }

    function extractLatexFormula(markdown) {
        if (!markdown) return '';
        let text = markdown.trim();
        const fence = text.match(/```(?:latex)?\s*[\r\n]+([\s\S]*?)```/i);
        if (fence) return fence[1].trim();
        const blockMath = text.match(/\$\$([\s\S]*?)\$\$/);
        if (blockMath) return blockMath[1].trim();
        const bracketMath = text.match(/\\\[([\s\S]*?)\\\]/);
        if (bracketMath) return bracketMath[1].trim();
        const inlineMath = text.match(/\$([^\$]+)\$/);
        if (inlineMath) return inlineMath[1].trim();
        text = text.replace(/^Here is the (?:LaTeX|equation|formula):?\s*[\r\n]*/i, '');
        text = text.replace(/```/g, '').trim();
        return text;
    }

    function applyToCodeCard(card, code, lang) {
        let targetCard = card;
        if (!targetCard) {
            targetCard = document.querySelector('.doc-code-card');
        }
        if (!targetCard) return false;

        let codeEl = targetCard.querySelector('pre code') || targetCard.querySelector('code');
        if (!codeEl) {
            let pre = targetCard.querySelector('pre');
            if (!pre) {
                pre = document.createElement('pre');
                pre.style.margin = '0';
                pre.style.fontFamily = 'inherit';
                const contentDiv = targetCard.querySelector('.doc-code-content') || targetCard;
                contentDiv.appendChild(pre);
            }
            codeEl = document.createElement('code');
            pre.appendChild(codeEl);
        }

        codeEl.textContent = code;
        if (lang) {
            codeEl.setAttribute('data-language', lang);
            targetCard.setAttribute('data-language', lang);
            const badge = targetCard.querySelector('.badge');
            if (badge) badge.textContent = lang;
        }
        return true;
    }

    function applyToLatexCard(card, latexSource, keepEditorOpen = true) {
        let targetCard = card;
        if (!targetCard && window.latexEngine?.activeHoverCardId) {
            targetCard = document.getElementById(window.latexEngine.activeHoverCardId);
        }
        if (!targetCard) {
            targetCard = document.querySelector('.doc-latex-card');
        }

        // 1. Write directly into the LaTeX input box and update live preview
        const hoverInput = document.getElementById('latexHoverSourceInput');
        const hoverPreview = document.getElementById('latexHoverLivePreviewMath');
        if (hoverInput) {
            hoverInput.value = latexSource;
            if (window.latexEngine && typeof window.latexEngine.updateHoverPreview === 'function') {
                window.latexEngine.updateHoverPreview();
            } else if (hoverPreview && window.latexEngine && typeof window.latexEngine.renderToString === 'function') {
                hoverPreview.innerHTML = window.latexEngine.renderToString(latexSource);
            }
        }

        // 2. Update and compile the card in the document
        if (targetCard && targetCard.classList && targetCard.classList.contains('doc-latex-card')) {
            targetCard.setAttribute('data-latex-source', latexSource);
            targetCard.setAttribute('data-latex-compiled', 'true');
            targetCard.classList.remove('is-draft');
            targetCard.classList.add('is-compiled');
            const size = targetCard.getAttribute('data-latex-size') || '1.2rem';
            const rendered = targetCard.querySelector('.latex-rendered-math');
            if (rendered && window.latexEngine && typeof window.latexEngine.renderToString === 'function') {
                rendered.innerHTML = window.latexEngine.renderToString(latexSource);
                rendered.style.fontSize = size;
            }

            // Keep the hover editor open anchored to this card so user can edit & compile
            if (keepEditorOpen && window.latexEngine && typeof window.latexEngine.openHoverEditor === 'function') {
                window.latexEngine.openHoverEditor(targetCard.id);
            }
        } else {
            // No existing card found: create a new .doc-latex-card in the document!
            const editor = document.getElementById('docPageSheet');
            if (editor && window.latexEngine && typeof window.latexEngine.generateCardHtml === 'function') {
                const cardHtml = window.latexEngine.generateCardHtml(latexSource);
                const temp = document.createElement('div');
                temp.innerHTML = cardHtml;
                const newCard = temp.firstElementChild;
                editor.appendChild(newCard);
                window.latexEngine.initAllCards(editor);
                if (keepEditorOpen && window.latexEngine && typeof window.latexEngine.openHoverEditor === 'function') {
                    window.latexEngine.openHoverEditor(newCard.id);
                }
            }
        }
        return true;
    }

    window.insertAiResultBelow = function () {
        if (!lastGeneratedMarkdown) return;
        const editor = document.getElementById('docPageSheet');
        if (!editor) return;

        const codeCtx = window._codeLatexContext;
        if (codeCtx && codeCtx.type === 'code') {
            const extracted = extractCodeSnippet(lastGeneratedMarkdown, codeCtx.language || window._aiLanguage || 'javascript');
            if (extracted && applyToCodeCard(codeCtx.element, extracted.code, extracted.lang)) {
                closeAiResultCard();
                triggerDocChange();
                if (typeof toast === 'function') toast('Code updated in code box');
                return;
            }
        }

        if (codeCtx && codeCtx.type === 'latex') {
            const formula = extractLatexFormula(lastGeneratedMarkdown);
            if (formula && applyToLatexCard(codeCtx.element, formula, true)) {
                closeAiResultCard();
                triggerDocChange();
                if (typeof toast === 'function') toast('Equation written into LaTeX box & compiled!');
                return;
            }
        }

        const htmlToInsert = renderMarkdownToHtml(lastGeneratedMarkdown);
        const div = document.createElement('div');
        div.className = 'doc-ai-generated-block';
        div.innerHTML = htmlToInsert;

        if (currentSelectionRange) {
            try {
                currentSelectionRange.collapse(false);
                let container = currentSelectionRange.commonAncestorContainer;
                if (container.nodeType === 3) container = container.parentElement;
                const insideCode = container && container.closest && container.closest('.doc-code-card, pre, .doc-latex-card');
                if (insideCode) {
                    const card = container.closest('.doc-code-card, .doc-latex-card') || container.closest('pre') || insideCode;
                    card.after(div);
                } else {
                    currentSelectionRange.insertNode(div);
                }
            } catch (e) {
                editor.appendChild(div);
            }
        } else {
            editor.appendChild(div);
        }

        if (window.latexEngine && typeof window.latexEngine.initAllCards === 'function') {
            window.latexEngine.initAllCards(editor);
        }

        closeAiResultCard();
        triggerDocChange();
    };

    window.replaceAiSelection = function () {
        if (!lastGeneratedMarkdown) return;

        const codeCtx = window._codeLatexContext;
        if (codeCtx && codeCtx.type === 'code') {
            const extracted = extractCodeSnippet(lastGeneratedMarkdown, codeCtx.language || window._aiLanguage || 'javascript');
            if (extracted && applyToCodeCard(codeCtx.element, extracted.code, extracted.lang)) {
                closeAiResultCard();
                triggerDocChange();
                if (typeof toast === 'function') toast('Code replaced in code box');
                return;
            }
        }

        if (codeCtx && codeCtx.type === 'latex') {
            const formula = extractLatexFormula(lastGeneratedMarkdown);
            if (formula && applyToLatexCard(codeCtx.element, formula, true)) {
                closeAiResultCard();
                triggerDocChange();
                if (typeof toast === 'function') toast('Equation written into LaTeX box & compiled!');
                return;
            }
        }

        const editor = document.getElementById('docPageSheet');
        const hasMath = lastGeneratedMarkdown.includes('$$') || lastGeneratedMarkdown.includes('\\[') || lastGeneratedMarkdown.includes('```latex');

        if (!currentSelectionRange && hasMath && editor) {
            window.insertAiResultBelow();
            return;
        }

        if (!currentSelectionRange) return;

        const htmlToInsert = renderMarkdownToHtml(lastGeneratedMarkdown);
        const frag = currentSelectionRange.createContextualFragment(htmlToInsert);

        currentSelectionRange.deleteContents();
        currentSelectionRange.insertNode(frag);

        if (window.latexEngine && typeof window.latexEngine.initAllCards === 'function' && editor) {
            window.latexEngine.initAllCards(editor);
        }

        closeAiResultCard();
        triggerDocChange();
    };

    window.copyAiResult = function () {
        if (!lastGeneratedMarkdown) return;
        navigator.clipboard.writeText(lastGeneratedMarkdown).then(() => {
            if (window.toast) {
                toast('AI text copied to clipboard!');
            }
        });
    };

    window.closeAiResultCard = function () {
        if (isGenerating && abortController) {
            abortController.abort();
        }
        const card = document.getElementById('docAiResultCard');
        if (card) card.classList.add('hidden');
        setTimeout(() => {
            window._codeLatexContext = null;
            window._aiLanguage = null;
            window._aiSelectionLength = null;
        }, 300);
    };

    function renderMarkdownToHtml(md) {
        if (!md) return '';

        const latexBlocks = [];
        const codeBlocks = [];

        let processed = md.replace(/```latex\s*[\r\n]+([\s\S]*?)```/gi, (match, formula) => {
            const idx = latexBlocks.length;
            latexBlocks.push(formula.trim());
            return `\n\n__LATEX_CARD_BLOCK_${idx}__\n\n`;
        });

        processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const idx = latexBlocks.length;
            latexBlocks.push(formula.trim());
            return `\n\n__LATEX_CARD_BLOCK_${idx}__\n\n`;
        });

        processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
            const idx = latexBlocks.length;
            latexBlocks.push(formula.trim());
            return `\n\n__LATEX_CARD_BLOCK_${idx}__\n\n`;
        });

        processed = processed.replace(/```(\w+)?\s*[\r\n]+([\s\S]*?)```/g, (match, lang, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push({ lang: (lang || 'javascript').toLowerCase(), code: code.trim() });
            return `\n\n__CODE_CARD_BLOCK_${idx}__\n\n`;
        });

        processed = processed
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^- \[ \] (.*$)/gim, '<li class="doc-checklist-item"><span class="doc-checklist-checkbox"><input type="checkbox"></span><span>$1</span></li>')
            .replace(/^- \[x\] (.*$)/gim, '<li class="doc-checklist-item"><span class="doc-checklist-checkbox"><input type="checkbox" checked></span><span>$1</span></li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n+/gim, '</p><p>')
            .replace(/\n/gim, '<br>');

        processed = '<p>' + processed + '</p>';
        processed = processed.replace(/<p>\s*<\/p>/g, '');

        latexBlocks.forEach((formula, idx) => {
            let cardHtml = '';
            if (window.latexEngine && typeof window.latexEngine.generateCardHtml === 'function') {
                cardHtml = window.latexEngine.generateCardHtml(formula);
            } else {
                cardHtml = `<div class="doc-latex-card is-compiled" data-latex-card="true" data-latex-source="${escapeHtmlAttr(formula)}"><div class="latex-rendered-math">$$${escapeHtmlAttr(formula)}$$</div></div>`;
            }
            const placeholder = `__LATEX_CARD_BLOCK_${idx}__`;
            const regex = new RegExp(`(<p>\\s*)?${placeholder}(\\s*<\\/p>)?`, 'g');
            processed = processed.replace(regex, cardHtml);
        });

        codeBlocks.forEach((item, idx) => {
            const escapedCode = escapeHtmlAttr(item.code);
            const cardHtml = `
                <div class="doc-code-card" data-language="${item.lang}">
                    <div class="doc-code-header">
                        <span>Code Snippet</span>
                        <span class="badge" style="background:#334155;color:#cbd5e1;font-size:0.65rem;">${item.lang}</span>
                    </div>
                    <div class="doc-code-content">
                        <pre style="margin:0;font-family:inherit;"><code data-language="${item.lang}">${escapedCode}</code></pre>
                    </div>
                </div><p></p>
            `;
            const placeholder = `__CODE_CARD_BLOCK_${idx}__`;
            const regex = new RegExp(`(<p>\\s*)?${placeholder}(\\s*<\\/p>)?`, 'g');
            processed = processed.replace(regex, cardHtml);
        });

        return processed;
    }

    function escapeHtmlAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function triggerDocChange() {
        if (typeof window.onDocChange === 'function') {
            window.onDocChange();
        }
    }

    window.toggleAiCopilotDrawer = function () {
        const drawer = document.getElementById('aiCopilotDrawer');
        if (!drawer) return;
        drawer.classList.toggle('open');
        if (drawer.classList.contains('open')) {
            const chatInput = document.getElementById('copilotChatInput');
            if (chatInput) setTimeout(() => chatInput.focus(), 100);
        }
    };

    window.sendCopilotMessage = async function () {
        const input = document.getElementById('copilotChatInput');
        const messageList = document.getElementById('copilotMessagesList');
        if (!input || !messageList) return;

        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        const userMsg = document.createElement('div');
        userMsg.className = 'copilot-msg copilot-msg-user';
        userMsg.textContent = text;
        messageList.appendChild(userMsg);
        messageList.scrollTop = messageList.scrollHeight;

        const aiMsg = document.createElement('div');
        aiMsg.className = 'copilot-msg copilot-msg-ai';
        aiMsg.innerHTML = '<span class="ai-cursor-blink">Thinking...</span>';
        messageList.appendChild(aiMsg);
        messageList.scrollTop = messageList.scrollHeight;

        const token = localStorage.getItem('syncpad_token') || localStorage.getItem('syncpad_jwt_token') || sessionStorage.getItem('syncpad_jwt_token') || sessionStorage.getItem('syncpad_token') || '';
        const docId = window.currentDocId || window.currentDoc?.id || null;

        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    documentId: docId ? Number(docId) : null,
                    action: 'CUSTOM',
                    prompt: text
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            aiMsg.innerHTML = renderMarkdownToHtml(data.text);
            // Show selection-length aware tokens/latency already returned by backend
            const meta = document.createElement('div');
            meta.style.cssText = 'font-size:0.7rem; color:var(--text-muted); margin-top:6px; display:flex; gap:8px;';
            meta.innerHTML = `<span>Tokens: ${data.estimatedTokens ?? '—'}</span><span>Latency: ${data.latencyMs ?? '—'}ms</span><span>Model: ${data.modelUsed ?? ''}</span>`;
            aiMsg.appendChild(meta);
            const insertBtn = document.createElement('button');
            insertBtn.className = 'btn btn-outline btn-xs mt-2';
            insertBtn.innerHTML = '<i data-lucide="plus" style="width:11px;height:11px;"></i> Insert into Document';
            insertBtn.onclick = () => {
                lastGeneratedMarkdown = data.text;
                insertAiResultBelow();
            };
            aiMsg.appendChild(insertBtn);
            if (window.lucide) lucide.createIcons();
            messageList.scrollTop = messageList.scrollHeight;
        } catch (err) {
            aiMsg.textContent = `Error: ${err.message}`;
        }
    };
})();
