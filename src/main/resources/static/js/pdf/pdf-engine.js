/**
 * SyncPad PDF Workspace Engine — Master Orchestrator
 * Connects all PDF submodules (Renderer, Coordinates, Text Extraction, Annotations,
 * Selection, Capture, History, and STOMP Collaboration) to the application UI.
 */
class PDFEngine {
    constructor() {
        this.activeTool = 'pointer'; // pointer | pen | highlight | underline | rect | arrow | text-box | note | eraser
        this.currentScale = 1.25;
        this.currentHighlightColor = 'rgba(250, 204, 21, 0.35)';
        this.currentPenColor = '#2563eb';
        this.currentPenWidth = 3;

        // Initialize core submodules
        this.coords = new window.PDFCoordinateSystem(595, 842);
        this.renderer = new window.PDFRenderer(this.coords);
        this.textExtractor = new window.PDFTextExtractor(this.coords);
        this.annotManager = new window.PDFAnnotationManager(this.coords);
        this.selectionManager = new window.PDFSelectionManager(this.annotManager, this.coords);
        this.captureManager = new window.PDFCaptureManager(this.coords, this.textExtractor);
        this.historyManager = new window.PDFHistoryManager(this.annotManager);
        this.collaborator = new window.PDFCollaborator(this.annotManager);

        // Expose globally for convenience
        window.pdfCoordinateSystem = this.coords;
        window.pdfRenderer = this.renderer;
        window.pdfTextExtractor = this.textExtractor;
        window.pdfAnnotationManager = this.annotManager;
        window.pdfSelectionManager = this.selectionManager;
        window.pdfCaptureManager = this.captureManager;
        window.pdfHistoryManager = this.historyManager;
        window.pdfCollaborator = this.collaborator;

        this.initDrawingInteractions();
        this.initTextSelectionWatcher();
    }

    get currentPage() { return this.renderer.currentPage; }
    get numPages() { return this.renderer.numPages; }
    get currentFileName() { return this.renderer.currentFileName; }

    async setZoom(scale) {
        await this.renderer.setScale(scale);
        this.currentScale = this.renderer.scale;
        this.annotManager.renderActivePage(this.currentScale, this.renderer.rotation);
        if (this.captureManager) this.captureManager.updateScreenPositions(this.currentScale, this.renderer.rotation);
        if (this.selectionManager) this.selectionManager.renderSelectionHandles(this.currentScale, this.renderer.rotation);
    }

    async setRotation(rotation) {
        await this.renderer.setRotation(rotation);
        this.annotManager.renderActivePage(this.currentScale, this.renderer.rotation);
        if (this.captureManager) this.captureManager.updateScreenPositions(this.currentScale, this.renderer.rotation);
    }

    async goToPage(pageNum) {
        await this.renderer.goToPage(pageNum);
    }

    getCurrentPageData() {
        const preset = window.PRESET_PDF_LIBRARY ? window.PRESET_PDF_LIBRARY[this.renderer.activePresetKey || 'rfc-7629'] : null;
        return preset ? preset.pages[this.currentPage - 1] : null;
    }

    setActiveTool(toolName) {
        this.activeTool = toolName || 'pointer';

        if (this.captureManager && this.captureManager.isCaptureModeActive) {
            this.captureManager.setCaptureMode(false);
        }

        // 1. Update toolbar button active states
        const toolMap = {
            'pointer': 'pdfToolPointer',
            'pen': 'pdfToolPen',
            'highlight': 'pdfToolHighlight',
            'underline': 'pdfToolUnderline',
            'rect': 'pdfToolRect',
            'arrow': 'pdfToolArrow',
            'text-box': 'pdfToolTextBox',
            'note': 'pdfToolNote',
            'eraser': 'pdfToolEraser'
        };

        Object.values(toolMap).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.classList.remove('active');
        });

        const activeBtn = document.getElementById(toolMap[this.activeTool]);
        if (activeBtn) activeBtn.classList.add('active');

        // 2. Adjust Layer Z-Index & Pointer Events
        const canvas = document.getElementById('pdfAnnotationCanvas');
        const textLayer = document.getElementById('pdfTextLayer');
        const wrapper = document.getElementById('pdfPageWrapper');

        if (this.activeTool === 'pointer') {
            if (canvas) { canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '12'; canvas.style.cursor = 'default'; }
            if (textLayer) { textLayer.style.pointerEvents = 'auto'; textLayer.style.zIndex = '25'; textLayer.style.cursor = 'text'; }
            if (wrapper) wrapper.style.cursor = 'default';
        } else if (this.activeTool === 'eraser') {
            if (canvas) { canvas.style.pointerEvents = 'auto'; canvas.style.zIndex = '32'; canvas.style.cursor = 'crosshair'; }
            if (textLayer) { textLayer.style.pointerEvents = 'none'; textLayer.style.zIndex = '10'; }
            if (wrapper) wrapper.style.cursor = 'crosshair';
            this.selectionManager.clearSelection();
        } else if (this.activeTool === 'note') {
            if (canvas) { canvas.style.pointerEvents = 'auto'; canvas.style.zIndex = '32'; canvas.style.cursor = 'crosshair'; }
            if (textLayer) { textLayer.style.pointerEvents = 'none'; textLayer.style.zIndex = '10'; }
            if (wrapper) wrapper.style.cursor = 'crosshair';
            this.selectionManager.clearSelection();
            toast('📌 Click anywhere on the PDF to place a sticky note');
            return;
        } else if (this.activeTool === 'text-box') {
            if (canvas) { canvas.style.pointerEvents = 'auto'; canvas.style.zIndex = '32'; canvas.style.cursor = 'crosshair'; }
            if (textLayer) { textLayer.style.pointerEvents = 'none'; textLayer.style.zIndex = '10'; }
            if (wrapper) wrapper.style.cursor = 'crosshair';
            this.selectionManager.clearSelection();
            toast('🔤 Click anywhere on the PDF to place a text box');
            return;
        } else {
            // Drawing / Shape tools
            if (canvas) { canvas.style.pointerEvents = 'auto'; canvas.style.zIndex = '28'; canvas.style.cursor = 'crosshair'; }
            if (textLayer) { textLayer.style.pointerEvents = 'none'; textLayer.style.zIndex = '10'; }
            if (wrapper) wrapper.style.cursor = 'crosshair';
            this.selectionManager.clearSelection();
        }
    }

    initDrawingInteractions() {
        const wrapper = document.getElementById('pdfPageWrapper');
        if (!wrapper) return;

        let isDrawing = false;
        let isErasing = false;
        let erasedInCurrentDrag = 0;
        let startPdfPt = null;
        let currentStrokePoints = [];

        wrapper.addEventListener('mousedown', (e) => {
            if (e.target.closest('.pdf-capture-box') || e.target.closest('.pdf-embedded-textbox') || e.target.closest('.pdf-sticky-note') || e.target.closest('.pdf-selection-box') || e.target.closest('#pdfSelectionToolbar')) {
                return;
            }

            const pdfPt = this.coords.screenToPdfPoint(e.clientX, e.clientY, wrapper, this.currentScale, this.renderer.rotation);

            if (this.activeTool === 'pointer') {
                const target = this.annotManager.findAnnotationAtPoint(pdfPt, this.currentPage);
                this.selectionManager.selectAnnotation(target);
                return;
            }

            if (this.activeTool === 'eraser') {
                isErasing = true;
                erasedInCurrentDrag = 0;
                const erased = this.annotManager.eraseAtPoint(pdfPt, this.currentPage, 24);
                if (erased) {
                    erasedInCurrentDrag++;
                    this.annotManager.renderActivePage(this.currentScale);
                }
                return;
            }

            if (this.activeTool === 'note') {
                const pageW = (this.renderer && this.renderer.coords && this.renderer.coords.baseWidth) || 595;
                const pageH = (this.renderer && this.renderer.coords && this.renderer.coords.baseHeight) || 842;
                const noteW = 180;
                const noteH = 105;
                const noteX = Math.max(10, Math.min(pageW - noteW - 10, Math.round(pdfPt.x - 10)));
                const noteY = Math.max(10, Math.min(pageH - noteH - 10, Math.round(pdfPt.y - 10)));

                const newNote = this.annotManager.addAnnotation({
                    type: 'STICKY_NOTE',
                    page: this.currentPage,
                    x: noteX,
                    y: noteY,
                    width: noteW,
                    height: noteH,
                    text: '',
                    colorTheme: 'yellow',
                    isCollapsed: false
                });
                this.historyManager.pushState();
                this.setActiveTool('pointer');
                setTimeout(() => {
                    const ta = document.querySelector(`.pdf-sticky-note[data-id="${newNote.id}"] textarea`);
                    if (ta) ta.focus();
                }, 60);
                return;
            }

            if (this.activeTool === 'text-box') {
                const pageW = (this.renderer && this.renderer.coords && this.renderer.coords.baseWidth) || 595;
                const pageH = (this.renderer && this.renderer.coords && this.renderer.coords.baseHeight) || 842;
                const boxW = 220;
                const boxH = 32;
                const boxX = Math.max(10, Math.min(pageW - boxW - 10, Math.round(pdfPt.x)));
                const boxY = Math.max(10, Math.min(pageH - boxH - 10, Math.round(pdfPt.y)));

                const newBox = this.annotManager.addAnnotation({
                    type: 'TEXT_BOX',
                    page: this.currentPage,
                    x: boxX,
                    y: boxY,
                    width: boxW,
                    height: boxH,
                    text: '',
                    fontSize: 13
                });
                this.historyManager.pushState();
                this.setActiveTool('pointer');
                setTimeout(() => {
                    const ta = document.querySelector(`.pdf-embedded-textbox[data-id="${newBox.id}"] textarea`);
                    if (ta) ta.focus();
                }, 60);
                return;
            }

            if (['pen', 'highlight', 'underline', 'rect', 'arrow'].includes(this.activeTool)) {
                isDrawing = true;
                startPdfPt = pdfPt;
                currentStrokePoints = [pdfPt];
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isErasing) {
                const pdfPt = this.coords.screenToPdfPoint(e.clientX, e.clientY, wrapper, this.currentScale, this.renderer.rotation);
                const erased = this.annotManager.eraseAtPoint(pdfPt, this.currentPage, 24);
                if (erased) {
                    erasedInCurrentDrag++;
                    this.annotManager.renderActivePage(this.currentScale);
                }
                return;
            }

            if (!isDrawing || !startPdfPt) return;

            const currentRotation = (this.renderer && this.renderer.rotation) || (window.pdfRotation || 0);
            const pdfPt = this.coords.screenToPdfPoint(e.clientX, e.clientY, wrapper, this.currentScale, currentRotation);
            currentStrokePoints.push(pdfPt);

            // Live preview drawing on canvas
            const canvas = document.getElementById('pdfAnnotationCanvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const dpr = window.devicePixelRatio || 1;
                this.annotManager.renderActivePage(this.currentScale, currentRotation);

                // Render in-progress draft with high-DPI scaling
                ctx.save();
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                if (this.activeTool === 'pen') {
                    this.annotManager.renderCanvasAnnotation(ctx, {
                        type: 'PEN',
                        points: currentStrokePoints,
                        color: this.currentPenColor,
                        strokeWidth: this.currentPenWidth
                    }, this.currentScale, currentRotation);
                } else if (this.activeTool === 'highlight') {
                    this.annotManager.renderCanvasAnnotation(ctx, {
                        type: 'HIGHLIGHT',
                        points: currentStrokePoints,
                        color: this.currentHighlightColor,
                        strokeWidth: 20
                    }, this.currentScale, currentRotation);
                } else if (this.activeTool === 'underline') {
                    // Smooth straight underline: snap vertical deviation to startY when dragging horizontally across text
                    const dy = Math.abs(pdfPt.y - startPdfPt.y);
                    const dx = Math.abs(pdfPt.x - startPdfPt.x);
                    const isHorizontal = dx >= dy || dy < 14;
                    const effectiveEndY = isHorizontal ? startPdfPt.y : pdfPt.y;

                    this.annotManager.renderCanvasAnnotation(ctx, {
                        type: 'UNDERLINE',
                        startX: startPdfPt.x,
                        startY: startPdfPt.y,
                        endX: pdfPt.x,
                        endY: effectiveEndY,
                        color: '#ef4444',
                        strokeWidth: 3
                    }, this.currentScale, currentRotation);
                } else if (this.activeTool === 'rect') {
                    const r = this.coords.pointsToPdfRect(startPdfPt, pdfPt);
                    this.annotManager.renderCanvasAnnotation(ctx, {
                        type: 'RECTANGLE',
                        ...r,
                        strokeColor: '#2563eb',
                        fillColor: 'rgba(37, 99, 235, 0.08)',
                        strokeWidth: 2.5
                    }, this.currentScale, currentRotation);
                } else if (this.activeTool === 'arrow') {
                    this.annotManager.renderCanvasAnnotation(ctx, {
                        type: 'ARROW',
                        startX: startPdfPt.x,
                        startY: startPdfPt.y,
                        endX: pdfPt.x,
                        endY: pdfPt.y,
                        color: '#9333ea',
                        strokeWidth: 3
                    }, this.currentScale, currentRotation);
                }

                ctx.restore();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (isErasing) {
                isErasing = false;
                if (erasedInCurrentDrag > 0) {
                    this.historyManager.pushState();
                    toast(`✓ Erased ${erasedInCurrentDrag} annotation${erasedInCurrentDrag > 1 ? 's' : ''}`);
                }
                return;
            }

            if (!isDrawing || !startPdfPt) return;
            isDrawing = false;

            const currentRotation = (this.renderer && this.renderer.rotation) || (window.pdfRotation || 0);
            const pdfPt = this.coords.screenToPdfPoint(e.clientX, e.clientY, wrapper, this.currentScale, currentRotation);

            if (this.activeTool === 'pen') {
                if (currentStrokePoints.length >= 2) {
                    this.annotManager.addAnnotation({
                        type: 'PEN',
                        page: this.currentPage,
                        points: currentStrokePoints,
                        color: this.currentPenColor,
                        strokeWidth: this.currentPenWidth,
                        opacity: 1.0
                    });
                    this.historyManager.pushState();
                }
            } else if (this.activeTool === 'highlight') {
                if (currentStrokePoints.length >= 2) {
                    this.annotManager.addAnnotation({
                        type: 'HIGHLIGHT',
                        page: this.currentPage,
                        points: currentStrokePoints,
                        color: this.currentHighlightColor,
                        strokeWidth: 22,
                        opacity: 0.45
                    });
                    this.historyManager.pushState();
                }
            } else if (this.activeTool === 'underline') {
                const dy = Math.abs(pdfPt.y - startPdfPt.y);
                const dx = Math.abs(pdfPt.x - startPdfPt.x);
                const isHorizontal = dx >= dy || dy < 14;
                const effectiveEndY = isHorizontal ? startPdfPt.y : pdfPt.y;

                if (Math.hypot(pdfPt.x - startPdfPt.x, effectiveEndY - startPdfPt.y) > 4) {
                    this.annotManager.addAnnotation({
                        type: 'UNDERLINE',
                        page: this.currentPage,
                        startX: startPdfPt.x,
                        startY: startPdfPt.y,
                        endX: pdfPt.x,
                        endY: effectiveEndY,
                        color: '#ef4444',
                        strokeWidth: 3
                    });
                    this.historyManager.pushState();
                }
            } else if (this.activeTool === 'rect') {
                const r = this.coords.pointsToPdfRect(startPdfPt, pdfPt);
                if (r.width > 5 && r.height > 5) {
                    this.annotManager.addAnnotation({
                        type: 'RECTANGLE',
                        page: this.currentPage,
                        ...r,
                        strokeColor: '#2563eb',
                        fillColor: 'rgba(37, 99, 235, 0.08)',
                        strokeWidth: 2.5
                    });
                    this.historyManager.pushState();
                }
            } else if (this.activeTool === 'arrow') {
                if (this.coords.distance(startPdfPt, pdfPt) > 8) {
                    this.annotManager.addAnnotation({
                        type: 'ARROW',
                        page: this.currentPage,
                        startX: startPdfPt.x,
                        startY: startPdfPt.y,
                        endX: pdfPt.x,
                        endY: pdfPt.y,
                        color: '#9333ea',
                        strokeWidth: 3
                    });
                    this.historyManager.pushState();
                }
            }

            this.annotManager.renderActivePage(this.currentScale);
            startPdfPt = null;
            currentStrokePoints = [];
        });
    }

    initTextSelectionWatcher() {
        const textLayer = document.getElementById('pdfTextLayer');
        const toolbar = document.getElementById('pdfSelectionToolbar');
        if (!textLayer || !toolbar) return;

        const handleSelection = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) {
                if (toolbar && !toolbar.contains(document.activeElement)) {
                    toolbar.classList.add('hidden');
                }
                return;
            }

            const range = sel.getRangeAt(0);
            if (!textLayer.contains(range.commonAncestorContainer) && !textLayer.contains(sel.anchorNode)) {
                toolbar.classList.add('hidden');
                return;
            }

            const text = sel.toString().trim();
            if (!text) {
                toolbar.classList.add('hidden');
                return;
            }

            const rect = range.getBoundingClientRect();
            const wrapper = document.getElementById('pdfPageWrapper');
            const wrapperRect = wrapper.getBoundingClientRect();

            toolbar.style.left = `${Math.max(10, rect.left - wrapperRect.left + (rect.width / 2) - 100)}px`;
            toolbar.style.top = `${Math.max(10, rect.top - wrapperRect.top - 42)}px`;
            toolbar.classList.remove('hidden');
            if (window.lucide) window.lucide.createIcons();
        };

        document.addEventListener('selectionchange', handleSelection);
        textLayer.addEventListener('mouseup', () => setTimeout(handleSelection, 40));
    }

    copyAllPageText() {
        const textLayer = document.getElementById('pdfTextLayer');
        if (!textLayer) return;
        const spans = Array.from(textLayer.querySelectorAll('span'));
        const lines = [];
        let curY = null;
        let curLine = [];

        spans.forEach(s => {
            const top = parseFloat(s.style.top) || 0;
            const text = (s.textContent || '').trim();
            if (!text) return;
            if (curY === null || Math.abs(top - curY) > 6) {
                if (curLine.length > 0) lines.push(curLine.join(' '));
                curLine = [text];
                curY = top;
            } else {
                curLine.push(text);
            }
        });
        if (curLine.length > 0) lines.push(curLine.join(' '));
        const fullText = lines.join('\n');
        if (fullText) {
            navigator.clipboard.writeText(fullText);
            const wordCount = fullText.split(/\s+/).filter(Boolean).length;
            toast(`📋 Copied all text from page ${this.currentPage} (${wordCount} words)`);
        } else {
            toast('No text found on this page');
        }
    }
}

// Global Application API Functions matching existing HTML onclick attributes
window.initPdfEngine = function() {
    window.pdfEngine = new PDFEngine();
    window.pdfEngine.renderer.loadPdfDocument('rfc-7629');
};

window.setPdfActiveTool = function(toolName) {
    if (window.pdfEngine) {
        if (toolName === 'highlight' && window.pdfEngine.activeTool === 'highlight') {
            window.togglePdfHighlightPalette();
            return;
        }
        window.pdfEngine.setActiveTool(toolName);
    }
};

window.togglePdfCaptureMode = function() {
    if (window.pdfEngine) window.pdfEngine.captureManager.toggleCaptureMode();
};

window.copyAllPdfText = function() {
    if (window.pdfEngine) window.pdfEngine.copyAllPageText();
};

window.capturePdfAction = function(action) {
    if (window.pdfEngine) window.pdfEngine.captureManager.executeAction(action);
};

window.openInsertCaptureModal = function() {
    if (window.pdfEngine && window.pdfEngine.captureManager) {
        window.pdfEngine.captureManager.openInsertModal();
    }
};

window.closeInsertCaptureModal = function() {
    const modal1 = document.getElementById('insertCaptureModal');
    const modal2 = document.getElementById('pdfInsertModal');
    if (modal1) modal1.classList.add('hidden');
    if (modal2) modal2.classList.add('hidden');
};

window.confirmInsertCapture = function() {
    const modal1 = document.getElementById('insertCaptureModal');
    let choice = 'snapshot';
    if (modal1) {
        choice = modal1.querySelector('input[name="insertCaptureType"]:checked')?.value || 'snapshot';
        modal1.classList.add('hidden');
    }
    if (window.pdfEngine && window.pdfEngine.captureManager) {
        window.pdfEngine.captureManager.confirmInsertion(choice);
    } else if (window.pdfCaptureManager) {
        window.pdfCaptureManager.confirmInsertion(choice);
    }
};

window.undoPdfAnnotation = function() {
    if (window.pdfEngine) window.pdfEngine.historyManager.undo();
};

window.redoPdfAnnotation = function() {
    if (window.pdfEngine) window.pdfEngine.historyManager.redo();
};

window.changePdfPage = function(delta) {
    if (window.pdfEngine) {
        window.pdfEngine.renderer.renderPage(window.pdfEngine.currentPage + delta);
    }
};

window.zoomPdf = function(delta) {
    if (window.pdfEngine) {
        if (delta > 0) window.pdfEngine.renderer.zoomIn();
        else window.pdfEngine.renderer.zoomOut();
        window.pdfEngine.currentScale = window.pdfEngine.renderer.scale;
        window.pdfEngine.annotManager.renderActivePage(window.pdfEngine.currentScale);
    }
};

window.rotatePdf = function() {
    if (window.pdfEngine) window.pdfEngine.renderer.rotate();
};

window.fitPdfWidth = function() {
    if (window.pdfEngine) {
        window.pdfEngine.renderer.fitToWidth();
        window.pdfEngine.currentScale = window.pdfEngine.renderer.scale;
        window.pdfEngine.annotManager.renderActivePage(window.pdfEngine.currentScale);
    }
};

window.togglePdfHighlightPalette = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const palette = document.getElementById('pdfHighlightPalette');
    if (palette) {
        const isCurrentlyHidden = palette.classList.contains('hidden');
        if (typeof closeAllDocMenus === 'function') closeAllDocMenus('pdfHighlightPalette');
        if (isCurrentlyHidden) {
            palette.classList.remove('hidden');
        } else {
            palette.classList.add('hidden');
        }
    }
};

window.selectPdfHighlightColor = function(color, dotColor, label) {
    if (window.pdfEngine) {
        window.pdfEngine.currentHighlightColor = color;
        const icon = document.querySelector('#pdfToolHighlight svg, #pdfToolHighlight i');
        if (icon) icon.style.color = dotColor;
        toast(`Highlighter: ${label}`);
    }
    const palette = document.getElementById('pdfHighlightPalette');
    if (palette) palette.classList.add('hidden');
};

window.copyPdfSelectedText = function() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast('📋 Copied selected text to clipboard');
    const toolbar = document.getElementById('pdfSelectionToolbar');
    if (toolbar) toolbar.classList.add('hidden');
};

window.quotePdfSelectedTextInDoc = function(text) {
    if (!text) {
        const sel = window.getSelection();
        text = sel ? sel.toString().trim() : '';
    }
    if (!text) return;
    const sheet = document.getElementById('docPageSheet');
    if (!sheet) return;

    const pdfName = window.pdfEngine ? window.pdfEngine.currentFileName : 'Reference Document';
    const pageNum = window.pdfEngine ? window.pdfEngine.currentPage : 1;

    const ocrSnippet = `
        <blockquote class="pdf-ocr-quote" style="border-left: 3px solid var(--accent-primary); background: var(--bg-hover); padding: 0.75rem 1rem; border-radius: 0 4px 4px 0; margin: 1rem 0;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--accent-primary); margin-bottom: 0.35rem;">[Quote from ${pdfName} • Page ${pageNum}]</div>
            <p style="margin: 0; font-size: 0.88rem; color: var(--text-primary); line-height: 1.55;">
                "${text}"
            </p>
        </blockquote><p></p>
    `;
    sheet.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sheet.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const el = document.createElement('div');
        el.innerHTML = ocrSnippet;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = el.firstChild)) frag.appendChild(node);
        range.insertNode(frag);
    } else {
        sheet.insertAdjacentHTML('beforeend', ocrSnippet);
    }
    if (typeof updateDocStats === 'function') updateDocStats();
    if (typeof onDocChange === 'function') onDocChange();
    toast('✓ Quoted selected PDF text in document');
    const toolbar = document.getElementById('pdfSelectionToolbar');
    if (toolbar) toolbar.classList.add('hidden');
};

window.highlightPdfSelectedText = function() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const wrapper = document.getElementById('pdfPageWrapper');
    if (!wrapper || !window.pdfEngine) return;

    const p1 = window.pdfEngine.coords.screenToPdfPoint(rect.left, rect.top, wrapper, window.pdfEngine.currentScale);
    const p2 = window.pdfEngine.coords.screenToPdfPoint(rect.right, rect.bottom, wrapper, window.pdfEngine.currentScale);

    window.pdfEngine.annotManager.addAnnotation({
        type: 'HIGHLIGHT',
        page: window.pdfEngine.currentPage,
        points: [{ x: p1.x, y: (p1.y + p2.y) / 2 }, { x: p2.x, y: (p1.y + p2.y) / 2 }],
        color: window.pdfEngine.currentHighlightColor,
        strokeWidth: 20,
        opacity: 0.45
    });
    window.pdfEngine.historyManager.pushState();
    toast('✓ Highlighted selected text');
    const toolbar = document.getElementById('pdfSelectionToolbar');
    if (toolbar) toolbar.classList.add('hidden');
};

window.addStickyNoteToSelection = function() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (window.pdfEngine) {
        window.pdfEngine.annotManager.addAnnotation({
            type: 'STICKY_NOTE',
            page: window.pdfEngine.currentPage,
            x: 60,
            y: 160,
            text: text ? `Quote: "${text}"` : '',
            colorTheme: 'yellow'
        });
        window.pdfEngine.historyManager.pushState();
        toast('✓ Sticky note added for selection');
    }
    const toolbar = document.getElementById('pdfSelectionToolbar');
    if (toolbar) toolbar.classList.add('hidden');
};
