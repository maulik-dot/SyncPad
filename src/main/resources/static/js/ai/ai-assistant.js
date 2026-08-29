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
            // Remove the /ai text
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

    async function startAiStreaming(action, prompt, selectedText) {
        const resultCard = document.getElementById('docAiResultCard');
        const resultContent = document.getElementById('docAiResultContent');
        const resultStatus = document.getElementById('docAiResultStatus');
        const actionButtons = document.getElementById('docAiActionButtons');

        if (!resultCard || !resultContent) return;

        resultCard.classList.remove('hidden');
        resultContent.innerHTML = '<span class="ai-cursor-blink">▌</span>';
        if (resultStatus) {
            resultStatus.textContent = `SyncPad AI is generating (${action.toLowerCase()})...`;
        }
        if (actionButtons) {
            actionButtons.classList.add('hidden');
        }

        isGenerating = true;
        lastGeneratedMarkdown = '';
        abortController = new AbortController();

        const token = localStorage.getItem('syncpad_jwt_token') || sessionStorage.getItem('syncpad_jwt_token');
        const docId = window.currentDocId || null;

        const payload = {
            documentId: docId ? Number(docId) : null,
            action: action,
            prompt: prompt,
            selectedText: selectedText,
            tone: 'PROFESSIONAL'
        };

        try {
            const response = await fetch('/api/ai/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });

            if (!response.ok) {
                throw new Error(`AI generation failed with status ${response.status}`);
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
                buffer = lines.pop(); // keep last incomplete line

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
                            // Non-JSON token string fallback
                            if (dataContent && dataContent !== '[DONE]') {
                                accumulatedText += dataContent;
                                lastGeneratedMarkdown = accumulatedText;
                                renderStreamingMarkdown(resultContent, accumulatedText);
                            }
                        }
                    }
                }
            }

            // Completed successfully
            if (resultStatus) {
                resultStatus.innerHTML = '<i data-lucide="check" style="width:13px;height:13px;color:#10b981;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Generation Complete';
                if (window.lucide) lucide.createIcons();
            }
            if (actionButtons) {
                actionButtons.classList.remove('hidden');
                // Adjust "Replace" button visibility
                const replaceBtn = document.getElementById('aiReplaceSelectionBtn');
                if (replaceBtn) {
                    replaceBtn.style.display = currentSelectionRange ? 'inline-flex' : 'none';
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                if (resultStatus) resultStatus.textContent = 'Generation stopped by user.';
            } else {
                console.error('AI generation error:', err);
                if (resultContent) resultContent.textContent = `Error: ${err.message}`;
                if (resultStatus) resultStatus.textContent = 'Failed to generate response.';
            }
        } finally {
            isGenerating = false;
        }
    }

    function renderStreamingMarkdown(container, markdown) {
        // Quick high-fidelity markdown converter
        let html = markdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^- \[ \] (.*$)/gim, '<div class="doc-ai-task-item"><input type="checkbox" disabled style="margin-right:6px;"><span>$1</span></div>')
            .replace(/^- \[x\] (.*$)/gim, '<div class="doc-ai-task-item"><input type="checkbox" checked disabled style="margin-right:6px;"><span>$1</span></div>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/gim, '<p></p>')
            .replace(/\n/gim, '<br>');

        container.innerHTML = html + '<span class="ai-cursor-blink">▌</span>';
    }

    window.insertAiResultBelow = function () {
        if (!lastGeneratedMarkdown) return;
        const editor = document.getElementById('docPageSheet');
        if (!editor) return;

        const htmlToInsert = renderMarkdownToHtml(lastGeneratedMarkdown);
        const div = document.createElement('div');
        div.className = 'doc-ai-generated-block';
        div.innerHTML = htmlToInsert;

        if (currentSelectionRange) {
            currentSelectionRange.collapse(false);
            currentSelectionRange.insertNode(div);
        } else {
            editor.appendChild(div);
        }

        closeAiResultCard();
        triggerDocChange();
    };

    window.replaceAiSelection = function () {
        if (!lastGeneratedMarkdown || !currentSelectionRange) return;

        const htmlToInsert = renderMarkdownToHtml(lastGeneratedMarkdown);
        const frag = currentSelectionRange.createContextualFragment(htmlToInsert);

        currentSelectionRange.deleteContents();
        currentSelectionRange.insertNode(frag);

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
    };

    function renderMarkdownToHtml(md) {
        return md
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^- \[ \] (.*$)/gim, '<li class="doc-checklist-item"><span class="doc-checklist-checkbox"><input type="checkbox"></span><span>$1</span></li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/gim, '<p></p>')
            .replace(/\n/gim, '<br>');
    }

    function triggerDocChange() {
        if (typeof window.onDocChange === 'function') {
            window.onDocChange();
        }
    }

    // AI Copilot Sidebar Drawer
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

        // Render user message bubble
        const userMsg = document.createElement('div');
        userMsg.className = 'copilot-msg copilot-msg-user';
        userMsg.textContent = text;
        messageList.appendChild(userMsg);
        messageList.scrollTop = messageList.scrollHeight;

        // Render loading AI bubble
        const aiMsg = document.createElement('div');
        aiMsg.className = 'copilot-msg copilot-msg-ai';
        aiMsg.innerHTML = '<span class="ai-cursor-blink">Thinking...</span>';
        messageList.appendChild(aiMsg);
        messageList.scrollTop = messageList.scrollHeight;

        const token = localStorage.getItem('syncpad_jwt_token') || sessionStorage.getItem('syncpad_jwt_token');
        const docId = window.currentDocId || null;

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

