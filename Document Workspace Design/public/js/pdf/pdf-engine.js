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

    /**
     * Exports the entire PDF with all annotations baked in as a downloadable multi-page PDF.
     * FIXED: Uses actual per-page dimensions and PDFCoordinateSystem transforms so annotations
     * persist 1:1 at downloaded resolution. Previously hardcoded 595x842 caused drift on real
     * PDFs (letter/A4) and direct x*DPR multiplication misaligned text boxes/sticky notes.
     * Now respects per-page viewport, rotation, and DevicePixelRatio for pixel-perfect parity.
     */
    async exportEditedPdf() {
        const totalPages = this.numPages || 1;
        const fileName = (this.currentFileName || 'document').replace(/\.pdf$/i, '');
        toast(`⏳ Building edited PDF (${totalPages} page${totalPages > 1 ? 's' : ''})...`);

        const DPR = 2.0;
        const pageCanvases = [];
        const savedPage = this.currentPage;

        try {
            for (let pg = 1; pg <= totalPages; pg++) {
                let baseW = 595;
                let baseH = 842;
                let rotation = this.renderer.rotation || 0;
                let viewportForExport = null;
                let offCanvas;
                let ctx;

                // --- Layer 1: Render the page background with correct dimensions ---
                if (this.renderer.pdfDoc) {
                    const page = await this.renderer.pdfDoc.getPage(pg);
                    const unrotated = page.getViewport({ scale: 1, rotation: 0 });
                    baseW = unrotated.width;
                    baseH = unrotated.height;
                    const viewport = page.getViewport({ scale: DPR, rotation: rotation });
                    offCanvas = document.createElement('canvas');
                    offCanvas.width = viewport.width;
                    offCanvas.height = viewport.height;
                    ctx = offCanvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                    viewportForExport = viewport;
                } else {
                    // Vector preset pages (595x842) with rotation-aware canvas
                    const isRot90 = rotation === 90 || rotation === 270;
                    const canvasW = (isRot90 ? baseH : baseW) * DPR;
                    const canvasH = (isRot90 ? baseW : baseH) * DPR;
                    offCanvas = document.createElement('canvas');
                    offCanvas.width = canvasW;
                    offCanvas.height = canvasH;
                    ctx = offCanvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvasW, canvasH);

                    const preset = (window.PRESET_PDF_LIBRARY && window.PRESET_PDF_LIBRARY[this.renderer.activePresetKey]) ||
                                   (window.PRESET_PDF_LIBRARY && window.PRESET_PDF_LIBRARY['rfc-7629']);
                    const pageData = preset ? preset.pages[pg - 1] : null;
                    if (pageData && this.renderer.drawVectorContent) {
                        ctx.save();
                        if (rotation === 90) { ctx.translate(canvasW, 0); ctx.rotate(90 * Math.PI / 180); }
                        else if (rotation === 180) { ctx.translate(canvasW, canvasH); ctx.rotate(180 * Math.PI / 180); }
                        else if (rotation === 270) { ctx.translate(0, canvasH); ctx.rotate(270 * Math.PI / 180); }
                        const unrotatedW = baseW * DPR;
                        const unrotatedH = baseH * DPR;
                        this.renderer.drawVectorContent(ctx, pageData, unrotatedW, unrotatedH);
                        ctx.restore();
                    }
                }

                // Export coordinate system must mirror the background's coordinate space
                const exportCoords = new window.PDFCoordinateSystem(baseW, baseH);
                if (viewportForExport) exportCoords.setPdfJsViewport(viewportForExport);
                else exportCoords.setPdfJsViewport(null);

                const pageAnnots = this.annotManager.getAnnotationsForPage(pg);

                // --- Layer 2: Canvas annotations (Pen/Highlight/Underline/Rect/Arrow) ---
                const canvasAnnots = pageAnnots.filter(a =>
                    a.type === 'PEN' || a.type === 'HIGHLIGHT' || a.type === 'UNDERLINE' ||
                    a.type === 'RECTANGLE' || a.type === 'ARROW'
                );
                canvasAnnots.forEach(annot => {
                    ctx.save();
                    this._renderAnnotToCtx(ctx, annot, DPR, exportCoords);
                    ctx.restore();
                });

                // --- Layer 3: Text Boxes (now via coordinate system, not x*DPR) ---
                const textBoxes = pageAnnots.filter(a => a.type === 'TEXT_BOX');
                textBoxes.forEach(box => {
                    ctx.save();
                    const screenPt = exportCoords.pdfToScreenPoint(box.x, box.y, DPR, rotation);
                    const screenSize = exportCoords.pdfToScreenRect({ x: box.x, y: box.y, width: box.width || 220, height: 0 }, DPR, rotation);
                    const sx = Math.round(screenPt.x);
                    const sy = Math.round(screenPt.y);
                    const sw = Math.round(screenSize.width);
                    const fontSize = (box.fontSize || 13) * DPR;
                    const padding = 8 * DPR;
                    const headerH = 20 * DPR;

                    // Wrap using the actual rendered width (viewport-scaled)
                    ctx.font = `400 ${fontSize}px Inter, -apple-system, sans-serif`;
                    const textLines = this._wrapTextLines(ctx, box.text || '', sw - padding * 2);
                    const textH = textLines.length * fontSize * 1.4;
                    const totalH = Math.round(headerH + textH + padding * 2);

                    ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1.5 * DPR;
                    ctx.fillRect(sx, sy, sw, totalH);
                    ctx.strokeRect(sx, sy, sw, totalH);

                    ctx.fillStyle = 'rgba(59,130,246,0.08)';
                    ctx.fillRect(sx, sy, sw, headerH);
                    ctx.strokeStyle = '#e2e8f0';
                    ctx.lineWidth = 0.5 * DPR;
                    ctx.beginPath();
                    ctx.moveTo(sx, sy + headerH);
                    ctx.lineTo(sx + sw, sy + headerH);
                    ctx.stroke();

                    ctx.fillStyle = '#1e293b';
                    ctx.font = `400 ${fontSize}px Inter, -apple-system, sans-serif`;
                    let ty = sy + headerH + padding + fontSize;
                    textLines.forEach(line => {
                        ctx.fillText(line, sx + padding, ty);
                        ty += fontSize * 1.4;
                    });
                    ctx.restore();
                });

                // --- Layer 4: Sticky Notes (via coordinate system) ---
                const stickyNotes = pageAnnots.filter(a => a.type === 'STICKY_NOTE');
                const stickyThemes = {
                    yellow:  { bg: '#fef9c3', header: '#facc15', text: '#713f12' },
                    green:   { bg: '#dcfce7', header: '#86efac', text: '#14532d' },
                    blue:    { bg: '#dbeafe', header: '#93c5fd', text: '#1e3a5f' },
                    pink:    { bg: '#fce7f3', header: '#f472b6', text: '#831843' },
                    purple:  { bg: '#f3e8ff', header: '#c084fc', text: '#581c87' },
                    orange:  { bg: '#ffedd5', header: '#fdba74', text: '#7c2d12' }
                };

                stickyNotes.forEach(note => {
                    if (note.isCollapsed) return;
                    ctx.save();
                    const theme = stickyThemes[note.colorTheme || 'yellow'] || stickyThemes.yellow;
                    const screenPt = exportCoords.pdfToScreenPoint(note.x, note.y, DPR, rotation);
                    const screenSize = exportCoords.pdfToScreenRect({ x: note.x, y: note.y, width: note.width || 200, height: 0 }, DPR, rotation);
                    const sx = Math.round(screenPt.x);
                    const sy = Math.round(screenPt.y);
                    const sw = Math.round(screenSize.width);
                    const fontSize = 12 * DPR;
                    const headerH = 22 * DPR;
                    const padding = 8 * DPR;

                    ctx.font = `400 ${fontSize}px Inter, -apple-system, sans-serif`;
                    const textLines = this._wrapTextLines(ctx, note.text || '', sw - padding * 2);
                    const textH = Math.max(textLines.length * fontSize * 1.4, 30 * DPR);
                    const totalH = Math.round(headerH + textH + padding * 2);

                    ctx.shadowColor = 'rgba(0,0,0,0.12)';
                    ctx.shadowBlur = 6 * DPR;
                    ctx.shadowOffsetY = 2 * DPR;

                    ctx.fillStyle = theme.bg;
                    ctx.beginPath();
                    const r = 4 * DPR;
                    ctx.moveTo(sx + r, sy);
                    ctx.lineTo(sx + sw - r, sy);
                    ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + r);
                    ctx.lineTo(sx + sw, sy + totalH - r);
                    ctx.quadraticCurveTo(sx + sw, sy + totalH, sx + sw - r, sy + totalH);
                    ctx.lineTo(sx + r, sy + totalH);
                    ctx.quadraticCurveTo(sx, sy + totalH, sx, sy + totalH - r);
                    ctx.lineTo(sx, sy + r);
                    ctx.quadraticCurveTo(sx, sy, sx + r, sy);
                    ctx.closePath();
                    ctx.fill();

                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;

                    ctx.fillStyle = theme.header;
                    ctx.beginPath();
                    ctx.moveTo(sx + r, sy);
                    ctx.lineTo(sx + sw - r, sy);
                    ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + r);
                    ctx.lineTo(sx + sw, sy + headerH);
                    ctx.lineTo(sx, sy + headerH);
                    ctx.lineTo(sx, sy + r);
                    ctx.quadraticCurveTo(sx, sy, sx + r, sy);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = theme.text;
                    ctx.globalAlpha = 0.7;
                    ctx.font = `600 ${10 * DPR}px Inter, -apple-system, sans-serif`;
                    ctx.fillText('📝 Note', sx + padding, sy + headerH - 6 * DPR);
                    ctx.globalAlpha = 1.0;

                    ctx.fillStyle = theme.text;
                    ctx.font = `400 ${fontSize}px Inter, -apple-system, sans-serif`;
                    let ty = sy + headerH + padding + fontSize;
                    textLines.forEach(line => {
                        ctx.fillText(line, sx + padding, ty);
                        ty += fontSize * 1.4;
                    });
                    ctx.restore();
                });

                pageCanvases.push({ canvas: offCanvas, baseW, baseH });
            }

            // --- Build the PDF binary (page size = viewport / DPR) ---
            const builder = new PdfDocumentBuilder();
            for (const { canvas } of pageCanvases) {
                const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
                builder.addPage(canvas.width, canvas.height, jpegDataUrl, DPR);
            }
            const pdfBlob = builder.build();

            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}_edited.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);

            toast(`✅ Downloaded "${fileName}_edited.pdf" with all annotations`);

        } catch (err) {
            console.error('[PDFEngine] exportEditedPdf failed:', err);
            toast('❌ Failed to export PDF: ' + (err.message || err));
        }

        try {
            await this.goToPage(savedPage);
        } catch (e) {}
    }

    /**
     * Renders a single canvas annotation to an arbitrary context using the given coordinate system.
     * Mirrors the logic in PDFAnnotationManager.renderCanvasAnnotation but with a supplied coordSystem.
     */
    _renderAnnotToCtx(ctx, a, scale, coordSystem) {
        if (a.type === 'PEN') {
            if (!a.points || a.points.length < 2) return;
            ctx.strokeStyle = a.color || '#2563eb';
            ctx.lineWidth = (a.strokeWidth || 3) * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 1.0;
            ctx.beginPath();
            const p0 = coordSystem.pdfToScreenPoint(a.points[0].x, a.points[0].y, scale, 0);
            ctx.moveTo(p0.x, p0.y);
            if (a.points.length === 2) {
                const p1 = coordSystem.pdfToScreenPoint(a.points[1].x, a.points[1].y, scale, 0);
                ctx.lineTo(p1.x, p1.y);
            } else {
                for (let i = 1; i < a.points.length - 1; i++) {
                    const pt = coordSystem.pdfToScreenPoint(a.points[i].x, a.points[i].y, scale, 0);
                    const nextPt = coordSystem.pdfToScreenPoint(a.points[i + 1].x, a.points[i + 1].y, scale, 0);
                    ctx.quadraticCurveTo(pt.x, pt.y, (pt.x + nextPt.x) / 2, (pt.y + nextPt.y) / 2);
                }
                const last = coordSystem.pdfToScreenPoint(a.points[a.points.length - 1].x, a.points[a.points.length - 1].y, scale, 0);
                ctx.lineTo(last.x, last.y);
            }
            ctx.stroke();

        } else if (a.type === 'HIGHLIGHT') {
            if (!a.points || a.points.length < 2) return;
            ctx.strokeStyle = a.color || 'rgba(250, 204, 21, 0.35)';
            ctx.lineWidth = (a.strokeWidth || 20) * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 0.40;
            ctx.beginPath();
            const p0 = coordSystem.pdfToScreenPoint(a.points[0].x, a.points[0].y, scale, 0);
            ctx.moveTo(p0.x, p0.y);
            if (a.points.length === 2) {
                const p1 = coordSystem.pdfToScreenPoint(a.points[1].x, a.points[1].y, scale, 0);
                ctx.lineTo(p1.x, p1.y);
            } else {
                for (let i = 1; i < a.points.length - 1; i++) {
                    const pt = coordSystem.pdfToScreenPoint(a.points[i].x, a.points[i].y, scale, 0);
                    const nextPt = coordSystem.pdfToScreenPoint(a.points[i + 1].x, a.points[i + 1].y, scale, 0);
                    ctx.quadraticCurveTo(pt.x, pt.y, (pt.x + nextPt.x) / 2, (pt.y + nextPt.y) / 2);
                }
                const last = coordSystem.pdfToScreenPoint(a.points[a.points.length - 1].x, a.points[a.points.length - 1].y, scale, 0);
                ctx.lineTo(last.x, last.y);
            }
            ctx.stroke();

        } else if (a.type === 'UNDERLINE') {
            const p1 = coordSystem.pdfToScreenPoint(a.startX, a.startY, scale, 0);
            const p2 = coordSystem.pdfToScreenPoint(a.endX, a.endY !== undefined ? a.endY : a.startY, scale, 0);
            ctx.strokeStyle = a.color || '#ef4444';
            ctx.lineWidth = (a.strokeWidth || 3) * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

        } else if (a.type === 'RECTANGLE') {
            const sr = coordSystem.pdfToScreenRect(a, scale, 0);
            ctx.strokeStyle = a.strokeColor || '#2563eb';
            ctx.fillStyle = a.fillColor || 'rgba(37, 99, 235, 0.08)';
            ctx.lineWidth = (a.strokeWidth || 3) * scale;
            ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 1.0;
            ctx.fillRect(sr.left, sr.top, sr.width, sr.height);
            ctx.strokeRect(sr.left, sr.top, sr.width, sr.height);

        } else if (a.type === 'ARROW') {
            const from = coordSystem.pdfToScreenPoint(a.startX, a.startY, scale, 0);
            const to = coordSystem.pdfToScreenPoint(a.endX, a.endY, scale, 0);
            const headlen = 14 * scale;
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            ctx.strokeStyle = a.color || '#9333ea';
            ctx.fillStyle = a.color || '#9333ea';
            ctx.lineWidth = (a.strokeWidth || 3) * scale;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(to.x, to.y);
            ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
        }
    }

    /**
     * Word-wraps text into lines that fit within maxWidth.
     */
    _wrapTextLines(ctx, text, maxWidth) {
        if (!text) return [];
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            if (ctx.measureText(testLine).width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines.length > 0 ? lines : [''];
    }
}

/**
 * PdfDocumentBuilder — Zero-dependency PDF-1.4 binary serializer.
 * Accepts JPEG page images (as data URLs) and produces a valid multi-page PDF Blob.
 */
class PdfDocumentBuilder {
    constructor() {
        this.pages = []; // Array of { width, height, jpegDataUrl }
    }

    addPage(widthPx, heightPx, jpegDataUrl, dpr = 2.0) {
        this.pages.push({ width: widthPx, height: heightPx, dataUrl: jpegDataUrl, dpr });
    }

    build() {
        const parts = [];
        const offsets = [];
        let pos = 0;
        let objNum = 0;

        const addStr = (s) => {
            const bytes = new TextEncoder().encode(s);
            parts.push(bytes);
            pos += bytes.length;
        };

        const addBinary = (arr) => {
            parts.push(arr);
            pos += arr.length;
        };

        const startObj = () => {
            objNum++;
            offsets[objNum] = pos;
            addStr(`${objNum} 0 obj\n`);
            return objNum;
        };

        const endObj = () => addStr('endobj\n');

        // PDF Header
        addStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

        // Build image objects first, then page objects, then pages dict, then catalog
        const imageObjs = [];
        const pageObjs = [];

        // Pass 1: Create image XObjects
        for (const page of this.pages) {
            const imgId = startObj();

            // Decode JPEG data from data URL
            const base64Data = page.dataUrl.split(',')[1];
            const binaryStr = atob(base64Data);
            const imgBytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                imgBytes[i] = binaryStr.charCodeAt(i);
            }

            addStr(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`);
            addBinary(imgBytes);
            addStr('\nendstream\n');
            endObj();
            imageObjs.push({ id: imgId, width: page.width, height: page.height });
        }

        // Pass 2: Create content streams and page objects
        // We need to know the pages dict ID ahead of time
        // Layout: imageObjs are done, now content streams, then page objs, then pages dict, then catalog

        const contentObjs = [];
        for (let i = 0; i < this.pages.length; i++) {
            const img = imageObjs[i];
            // Scale image to fit the PDF page in points (72 DPI)
            // We'll use the image dimensions to define the page size in points
            // Standard: 1 pixel at 2x DPI = 0.5 points -> page = width/2 x height/2 points
            const dpr = img.dpr || 2.0;
            const pageW = img.width / dpr;
            const pageH = img.height / dpr;
            const contentStr = `q ${pageW} 0 0 ${pageH} 0 0 cm /Img${i} Do Q\n`;

            const contentId = startObj();
            addStr(`<< /Length ${contentStr.length} >>\nstream\n${contentStr}endstream\n`);
            endObj();
            contentObjs.push({ id: contentId, pageW, pageH, imgIndex: i });
        }

        // Calculate pages dict and catalog obj numbers
        const pagesObjStart = objNum + 1;
        // Page objects: pagesObjStart to pagesObjStart + pages.length - 1
        // Pages dict: pagesObjStart + pages.length
        // Catalog: pagesObjStart + pages.length + 1
        const pagesDictNum = pagesObjStart + this.pages.length;
        const catalogNum = pagesDictNum + 1;

        // Pass 3: Create page objects
        for (let i = 0; i < this.pages.length; i++) {
            const co = contentObjs[i];
            const img = imageObjs[i];
            const pageId = startObj();
            addStr(`<< /Type /Page /Parent ${pagesDictNum} 0 R /MediaBox [0 0 ${co.pageW} ${co.pageH}] /Contents ${co.id} 0 R /Resources << /XObject << /Img${i} ${img.id} 0 R >> >> >>\n`);
            endObj();
            pageObjs.push(pageId);
        }

        // Pass 4: Pages dictionary
        const pagesId = startObj();
        const kidRefs = pageObjs.map(id => `${id} 0 R`).join(' ');
        addStr(`<< /Type /Pages /Kids [${kidRefs}] /Count ${pageObjs.length} >>\n`);
        endObj();

        // Pass 5: Catalog
        const catalogId = startObj();
        addStr(`<< /Type /Catalog /Pages ${pagesId} 0 R >>\n`);
        endObj();

        // Cross-reference table
        const xrefOffset = pos;
        const totalObjects = objNum;
        addStr(`xref\n0 ${totalObjects + 1}\n`);
        addStr('0000000000 65535 f \n');
        for (let i = 1; i <= totalObjects; i++) {
            const off = offsets[i].toString().padStart(10, '0');
            addStr(`${off} 00000 n \n`);
        }

        addStr(`trailer\n<< /Size ${totalObjects + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

        return new Blob(parts, { type: 'application/pdf' });
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
