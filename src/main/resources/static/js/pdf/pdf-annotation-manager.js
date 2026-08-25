/**
 * SyncPad PDF Annotation Manager
 * Manages all multi-layer annotation objects (Pen, Highlighter, Underline, Rectangle,
 * Arrow, Text Box, Sticky Notes) stored in unscaled PDF coordinates per page.
 */
class PDFAnnotationManager {
    constructor(coordSystem) {
        this.coords = coordSystem || new window.PDFCoordinateSystem();
        this.annotations = []; // Array of annotation objects for the active PDF
        this.activePdfKey = 'rfc-7629';
        this.currentDocId = 'default';
        this.activePage = 1;
        this.selectedAnnotationId = null;
        this.onChangeListener = null;

        // Auto-load initial saved annotations
        this.loadAnnotationsFromStorage();
    }

    getStorageKey(pdfKey = this.activePdfKey, docId = this.currentDocId) {
        let userKey = 'guest';
        try {
            const u = JSON.parse(localStorage.getItem('syncpad_user') || '{}');
            if (u && (u.id || u.email)) userKey = u.id || u.email;
        } catch (e) {}

        const cleanDocId = docId || (window.currentDoc && window.currentDoc.id) || 'global';
        const cleanPdfKey = pdfKey || (window.pdfRenderer && window.pdfRenderer.activePresetKey) || 'rfc-7629';
        return `syncpad_annots_${userKey}_doc${cleanDocId}_pdf_${cleanPdfKey}`;
    }

    saveAnnotationsToStorage() {
        try {
            const key = this.getStorageKey();
            localStorage.setItem(key, JSON.stringify(this.annotations));
        } catch (e) {
            console.warn('[PDFAnnotationManager] Failed to save annotations:', e);
        }
    }

    loadAnnotationsFromStorage(pdfKey = this.activePdfKey, docId = this.currentDocId) {
        try {
            const key = this.getStorageKey(pdfKey, docId);
            const saved = localStorage.getItem(key);
            if (saved) {
                this.annotations = JSON.parse(saved);
            } else {
                this.annotations = [];
            }
        } catch (e) {
            console.warn('[PDFAnnotationManager] Failed to load annotations:', e);
            this.annotations = [];
        }
    }

    setPdfDocument(pdfKey, docId) {
        // 1. Save outgoing PDF annotations
        this.saveAnnotationsToStorage();

        // 2. Switch active PDF key & docId
        this.activePdfKey = pdfKey || 'rfc-7629';
        this.currentDocId = docId || (window.currentDoc && window.currentDoc.id) || 'default';
        this.activePage = 1;
        this.selectedAnnotationId = null;

        // 3. Load incoming PDF annotations
        this.loadAnnotationsFromStorage(this.activePdfKey, this.currentDocId);

        // 4. Reset history manager for clean state on the new PDF
        if (window.pdfHistoryManager) {
            window.pdfHistoryManager.undoStack = [];
            window.pdfHistoryManager.redoStack = [];
            window.pdfHistoryManager.updateUiButtons();
        }

        // 5. Render active page with the new annotations
        const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.25;
        const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));
        this.renderActivePage(scale, rotation);
    }

    setPage(pageNum) {
        this.activePage = pageNum || 1;
        const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.25;
        const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));
        this.renderActivePage(scale, rotation);
    }

    setOnChange(callback) {
        this.onChangeListener = callback;
    }

    notifyChange(actionType = 'MUTATION') {
        this.saveAnnotationsToStorage();
        if (typeof this.onChangeListener === 'function') {
            this.onChangeListener({
                actionType,
                annotations: this.getAnnotationsForPage(this.activePage),
                allAnnotations: this.annotations
            });
        }
    }

    getAnnotationsForPage(pageNum) {
        const targetPage = pageNum || this.activePage;
        return this.annotations.filter(a => a.page === targetPage);
    }

    getAnnotationById(id) {
        return this.annotations.find(a => a.id === id);
    }

    addAnnotation(annotation, triggerEvent = true) {
        if (!annotation.id) {
            annotation.id = 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        }
        if (!annotation.page) {
            annotation.page = this.activePage;
        }
        if (!annotation.pdfKey) {
            annotation.pdfKey = this.activePdfKey;
        }
        if (!annotation.createdAt) {
            annotation.createdAt = new Date().toISOString();
        }

        this.annotations.push(annotation);
        this.renderActivePage();
        this.saveAnnotationsToStorage();
        if (triggerEvent) this.notifyChange('ADD');
        return annotation;
    }

    updateAnnotation(id, updates, triggerEvent = true) {
        const index = this.annotations.findIndex(a => a.id === id);
        if (index !== -1) {
            this.annotations[index] = { ...this.annotations[index], ...updates, updatedAt: new Date().toISOString() };
            this.renderActivePage();
            this.saveAnnotationsToStorage();
            if (triggerEvent) this.notifyChange('UPDATE');
            return this.annotations[index];
        }
        return null;
    }

    deleteAnnotation(id, triggerEvent = true) {
        const index = this.annotations.findIndex(a => a.id === id);
        if (index !== -1) {
            const removed = this.annotations.splice(index, 1)[0];
            if (this.selectedAnnotationId === id) {
                this.selectedAnnotationId = null;
            }
            this.renderActivePage();
            this.saveAnnotationsToStorage();
            if (triggerEvent) this.notifyChange('DELETE');
            return removed;
        }
        return null;
    }

    clearPageAnnotations(pageNum, triggerEvent = true) {
        const targetPage = pageNum || this.activePage;
        this.annotations = this.annotations.filter(a => a.page !== targetPage);
        this.selectedAnnotationId = null;
        this.renderActivePage();
        this.saveAnnotationsToStorage();
        if (triggerEvent) this.notifyChange('CLEAR');
    }

    /**
     * Hit-test to find the nearest annotation under mouse pointer in PDF coordinates
     */
    findAnnotationAtPoint(pdfPoint, pageNum = this.activePage, tolerance = 20) {
        const pageAnnots = this.getAnnotationsForPage(pageNum);

        // Search in reverse (top-most first)
        for (let i = pageAnnots.length - 1; i >= 0; i--) {
            const a = pageAnnots[i];

            if (a.type === 'RECTANGLE' || a.type === 'TEXT_BOX') {
                if (this.coords.pointInRect(pdfPoint, a, tolerance)) {
                    return a;
                }
            } else if (a.type === 'STICKY_NOTE') {
                const noteRect = a.isCollapsed ?
                    { x: a.x, y: a.y, width: 28, height: 28 } :
                    { x: a.x, y: a.y, width: a.width || 180, height: a.height || 105 };
                if (this.coords.pointInRect(pdfPoint, noteRect, tolerance)) {
                    return a;
                }
            } else if (a.type === 'ARROW') {
                const distToSegment = this.distanceToLineSegment(pdfPoint, { x: a.startX, y: a.startY }, { x: a.endX, y: a.endY });
                if (distToSegment <= tolerance + (a.strokeWidth || 4)) {
                    return a;
                }
            } else if (a.type === 'UNDERLINE') {
                const distToSegment = this.distanceToLineSegment(pdfPoint, { x: a.startX, y: a.startY }, { x: a.endX, y: a.endY });
                if (distToSegment <= tolerance + 10) {
                    return a;
                }
            } else if (a.type === 'PEN' || a.type === 'HIGHLIGHT') {
                if (a.points && a.points.length > 0) {
                    const strokeRadius = (a.strokeWidth || (a.type === 'HIGHLIGHT' ? 22 : 4)) / 2;
                    if (a.points.length === 1) {
                        if (this.coords.distance(pdfPoint, a.points[0]) <= tolerance + strokeRadius) return a;
                    } else {
                        for (let k = 0; k < a.points.length - 1; k++) {
                            const d = this.distanceToLineSegment(pdfPoint, a.points[k], a.points[k + 1]);
                            if (d <= tolerance + strokeRadius) return a;
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Smart Eraser: Erases any annotation intersecting or closest to the point
     */
    eraseAtPoint(pdfPoint, pageNum = this.activePage, tolerance = 24) {
        const target = this.findAnnotationAtPoint(pdfPoint, pageNum, tolerance);
        if (target) {
            this.deleteAnnotation(target.id);
            return target;
        }
        return null;
    }

    /**
     * Renders all active page annotations to the canvas and DOM layers
     */
    renderActivePage(
        scale = (window.pdfEngine ? window.pdfEngine.currentScale : 1.0),
        rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0))
    ) {
        const canvas = document.getElementById('pdfAnnotationCanvas');
        const textBoxesLayer = document.getElementById('pdfTextBoxesLayer');
        const stickyNotesLayer = document.getElementById('pdfStickyNotesLayer');

        if (canvas) {
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            const pageAnnots = this.getAnnotationsForPage(this.activePage);

            pageAnnots.forEach(annot => {
                this.renderCanvasAnnotation(ctx, annot, scale, rotation);
            });
            ctx.restore();
        }

        if (textBoxesLayer) {
            this.syncDomTextBoxes(textBoxesLayer, scale, rotation);
        }

        if (stickyNotesLayer) {
            this.syncDomStickyNotes(stickyNotesLayer, scale, rotation);
        }

        // Selection handles
        if (window.pdfSelectionManager) {
            window.pdfSelectionManager.renderSelectionHandles(scale, rotation);
        }
    }

    /**
     * Renders vector canvas annotations (Pen, Highlight, Underline, Rect, Arrow)
     */
    renderCanvasAnnotation(ctx, a, scale, rotation = 0) {
        ctx.save();

        if (a.type === 'PEN') {
            if (!a.points || a.points.length < 2) { ctx.restore(); return; }
            ctx.strokeStyle = a.color || '#2563eb';
            ctx.lineWidth = (a.strokeWidth || 3) * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 1.0;

            ctx.beginPath();
            const p0 = this.coords.pdfToScreenPoint(a.points[0].x, a.points[0].y, scale, rotation);
            ctx.moveTo(p0.x, p0.y);

            if (a.points.length === 2) {
                const p1 = this.coords.pdfToScreenPoint(a.points[1].x, a.points[1].y, scale, rotation);
                ctx.lineTo(p1.x, p1.y);
            } else {
                for (let i = 1; i < a.points.length - 1; i++) {
                    const pt = this.coords.pdfToScreenPoint(a.points[i].x, a.points[i].y, scale, rotation);
                    const nextPt = this.coords.pdfToScreenPoint(a.points[i + 1].x, a.points[i + 1].y, scale, rotation);
                    const midX = (pt.x + nextPt.x) / 2;
                    const midY = (pt.y + nextPt.y) / 2;
                    ctx.quadraticCurveTo(pt.x, pt.y, midX, midY);
                }
                const lastPt = this.coords.pdfToScreenPoint(a.points[a.points.length - 1].x, a.points[a.points.length - 1].y, scale, rotation);
                ctx.lineTo(lastPt.x, lastPt.y);
            }
            ctx.stroke();

        } else if (a.type === 'HIGHLIGHT') {
            if (!a.points || a.points.length < 2) { ctx.restore(); return; }
            ctx.strokeStyle = a.color || 'rgba(250, 204, 21, 0.35)';
            ctx.lineWidth = (a.strokeWidth || 20) * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 0.40;

            ctx.beginPath();
            const p0 = this.coords.pdfToScreenPoint(a.points[0].x, a.points[0].y, scale, rotation);
            ctx.moveTo(p0.x, p0.y);

            if (a.points.length === 2) {
                const p1 = this.coords.pdfToScreenPoint(a.points[1].x, a.points[1].y, scale, rotation);
                ctx.lineTo(p1.x, p1.y);
            } else {
                for (let i = 1; i < a.points.length - 1; i++) {
                    const pt = this.coords.pdfToScreenPoint(a.points[i].x, a.points[i].y, scale, rotation);
                    const nextPt = this.coords.pdfToScreenPoint(a.points[i + 1].x, a.points[i + 1].y, scale, rotation);
                    const midX = (pt.x + nextPt.x) / 2;
                    const midY = (pt.y + nextPt.y) / 2;
                    ctx.quadraticCurveTo(pt.x, pt.y, midX, midY);
                }
                const lastPt = this.coords.pdfToScreenPoint(a.points[a.points.length - 1].x, a.points[a.points.length - 1].y, scale, rotation);
                ctx.lineTo(lastPt.x, lastPt.y);
            }
            ctx.stroke();

        } else if (a.type === 'UNDERLINE') {
            const startY = a.startY;
            const endY = a.endY !== undefined ? a.endY : a.startY;
            const p1 = this.coords.pdfToScreenPoint(a.startX, startY, scale, rotation);
            const p2 = this.coords.pdfToScreenPoint(a.endX, endY, scale, rotation);
            ctx.strokeStyle = a.color || '#ef4444';
            ctx.lineWidth = (a.strokeWidth || 3) * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

        } else if (a.type === 'RECTANGLE') {
            const screenRect = this.coords.pdfToScreenRect(a, scale, rotation);
            ctx.strokeStyle = a.strokeColor || '#2563eb';
            ctx.fillStyle = a.fillColor || 'rgba(37, 99, 235, 0.08)';
            ctx.lineWidth = (a.strokeWidth || 3) * scale;
            ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 1.0;

            ctx.fillRect(screenRect.left, screenRect.top, screenRect.width, screenRect.height);
            ctx.strokeRect(screenRect.left, screenRect.top, screenRect.width, screenRect.height);

        } else if (a.type === 'ARROW') {
            const from = this.coords.pdfToScreenPoint(a.startX, a.startY, scale, rotation);
            const to = this.coords.pdfToScreenPoint(a.endX, a.endY, scale, rotation);
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

        ctx.restore();
    }

    /**
     * Synchronizes DOM Text Boxes with current PDF annotations
     */
    syncDomTextBoxes(layer, scale, rotation = 0) {
        layer.innerHTML = '';
        const boxes = this.getAnnotationsForPage(this.activePage).filter(a => a.type === 'TEXT_BOX');
        const rot = (rotation % 360 + 360) % 360;

        boxes.forEach(box => {
            const screenPt = this.coords.pdfToScreenPoint(box.x, box.y, scale, rotation);
            const el = document.createElement('div');
            el.className = 'pdf-embedded-textbox';
            el.dataset.id = box.id;
            el.style.left = `${screenPt.x}px`;
            el.style.top = `${screenPt.y}px`;
            el.style.width = `${(box.width || 220) * scale}px`;
            if (box.height) el.style.height = `${box.height * scale}px`;
            if (rot !== 0) {
                el.style.transform = `rotate(${rot}deg)`;
                el.style.transformOrigin = '0 0';
            } else {
                el.style.transform = '';
                el.style.transformOrigin = '';
            }

            const currentFontSize = box.fontSize || 13;

            el.innerHTML = `
                <div class="pdf-embedded-textbox-header">
                    <div class="textbox-drag-handle" style="display: flex; align-items: center; gap: 4px; cursor: move; flex: 1; padding: 1px 2px;" title="Drag to move">
                        <i data-lucide="grip-vertical" style="width: 11px; height: 11px; opacity: 0.55; color: var(--text-secondary, #64748b);"></i>
                        <i data-lucide="type" style="width: 12px; height: 12px; color: #3b82f6;"></i>
                    </div>
                    <div class="textbox-controls" style="display: flex; align-items: center; gap: 2px;">
                        <button class="btn btn-icon btn-tb-font-dec" style="width: 17px; height: 17px; padding: 0; min-height: unset; font-size: 8px; font-weight: 700; border-radius: 3px;" title="Smaller font">A-</button>
                        <button class="btn btn-icon btn-tb-font-inc" style="width: 17px; height: 17px; padding: 0; min-height: unset; font-size: 8px; font-weight: 700; border-radius: 3px;" title="Larger font">A+</button>
                        <div style="width: 1px; height: 10px; background: var(--border-color, #cbd5e1); margin: 0 1px; opacity: 0.6;"></div>
                        <button class="btn btn-icon btn-tb-delete" style="width: 17px; height: 17px; padding: 0; min-height: unset; border-radius: 3px; color: var(--text-secondary, #64748b);" onclick="window.pdfAnnotationManager.deleteAnnotation('${box.id}')" title="Delete text box"><i data-lucide="trash-2" style="width: 10px; height: 10px;"></i></button>
                    </div>
                </div>
                <textarea class="pdf-embedded-textbox-input" placeholder="Type text on PDF..." style="font-size: ${currentFontSize * scale}px;">${box.text || ''}</textarea>
                <div class="pdf-textbox-resize-handle" title="Drag to resize text box"></div>
            `;

            const textarea = el.querySelector('textarea');
            textarea.addEventListener('input', () => {
                box.text = textarea.value;
                textarea.style.height = 'auto';
                textarea.style.height = `${Math.max(22, textarea.scrollHeight)}px`;
                box.height = Math.round(textarea.scrollHeight / scale);
                this.notifyChange('EDIT_TEXT');
            });

            textarea.addEventListener('focus', () => {
                el.classList.add('editing');
            });

            textarea.addEventListener('blur', () => {
                el.classList.remove('editing');
                if (!box.text || !box.text.trim()) {
                    setTimeout(() => {
                        if (document.activeElement !== textarea && (!box.text || !box.text.trim())) {
                            this.deleteAnnotation(box.id);
                        }
                    }, 300);
                }
            });

            // Font steppers
            const btnDec = el.querySelector('.btn-tb-font-dec');
            const btnInc = el.querySelector('.btn-tb-font-inc');
            if (btnDec) {
                btnDec.addEventListener('click', (e) => {
                    e.stopPropagation();
                    box.fontSize = Math.max(9, (box.fontSize || 13) - 2);
                    textarea.style.fontSize = `${box.fontSize * scale}px`;
                    textarea.style.height = 'auto';
                    textarea.style.height = `${Math.max(22, textarea.scrollHeight)}px`;
                    box.height = Math.round(textarea.scrollHeight / scale);
                    this.notifyChange('UPDATE');
                });
            }
            if (btnInc) {
                btnInc.addEventListener('click', (e) => {
                    e.stopPropagation();
                    box.fontSize = Math.min(36, (box.fontSize || 13) + 2);
                    textarea.style.fontSize = `${box.fontSize * scale}px`;
                    textarea.style.height = 'auto';
                    textarea.style.height = `${Math.max(22, textarea.scrollHeight)}px`;
                    box.height = Math.round(textarea.scrollHeight / scale);
                    this.notifyChange('UPDATE');
                });
            }

            this.setupDraggable(el, box, scale, rotation);
            this.setupResizable(el, box, scale, rotation);
            layer.appendChild(el);
        });
        if (window.lucide) window.lucide.createIcons();
    }

    /**
     * Synchronizes DOM Sticky Notes with current PDF annotations
     */
    syncDomStickyNotes(layer, scale, rotation = 0) {
        layer.innerHTML = '';
        const notes = this.getAnnotationsForPage(this.activePage).filter(a => a.type === 'STICKY_NOTE');
        const rot = (rotation % 360 + 360) % 360;

        notes.forEach(note => {
            const screenPt = this.coords.pdfToScreenPoint(note.x, note.y, scale, rotation);
            const el = document.createElement('div');
            const isCollapsed = !!note.isCollapsed;
            el.className = `pdf-sticky-note color-${note.colorTheme || 'yellow'} ${isCollapsed ? 'collapsed' : ''}`;
            el.dataset.id = note.id;
            el.dataset.color = note.colorTheme || 'yellow';
            el.style.left = `${screenPt.x}px`;
            el.style.top = `${screenPt.y}px`;
            if (!isCollapsed) {
                if (note.width) el.style.width = `${note.width * scale}px`;
                if (note.height) el.style.height = `${note.height * scale}px`;
            }
            if (rot !== 0) {
                el.style.transform = `rotate(${rot}deg)`;
                el.style.transformOrigin = '0 0';
            } else {
                el.style.transform = '';
                el.style.transformOrigin = '';
            }

            el.innerHTML = `
                <div class="pdf-sticky-note-pin-icon" title="Expand note" onclick="window.pdfAnnotationManager.toggleNoteCollapse('${note.id}')">
                    <i data-lucide="sticky-note" style="width: 14px; height: 14px;"></i>
                </div>
                <div class="pdf-sticky-note-header">
                    <div style="display: flex; align-items: center; gap: 4px; cursor: move; flex: 1;">
                        <i data-lucide="grip-vertical" style="width: 10px; height: 10px; opacity: 0.6;"></i>
                        <i data-lucide="sticky-note" style="width: 11px; height: 11px; opacity: 0.85;"></i>
                    </div>
                    <div style="display: flex; align-items: center; gap: 3px; margin-left: auto; margin-right: 4px;">
                        <button class="color-dot" style="width: 9px; height: 9px; border-radius: 50%; background: #facc15; border: none; cursor: pointer; padding: 0;" onclick="window.pdfAnnotationManager.setStickyColor('${note.id}', 'yellow')" title="Yellow"></button>
                        <button class="color-dot" style="width: 9px; height: 9px; border-radius: 50%; background: #86efac; border: none; cursor: pointer; padding: 0;" onclick="window.pdfAnnotationManager.setStickyColor('${note.id}', 'green')" title="Green"></button>
                        <button class="color-dot" style="width: 9px; height: 9px; border-radius: 50%; background: #93c5fd; border: none; cursor: pointer; padding: 0;" onclick="window.pdfAnnotationManager.setStickyColor('${note.id}', 'blue')" title="Blue"></button>
                        <button class="color-dot" style="width: 9px; height: 9px; border-radius: 50%; background: #f472b6; border: none; cursor: pointer; padding: 0;" onclick="window.pdfAnnotationManager.setStickyColor('${note.id}', 'pink')" title="Pink"></button>
                        <button class="color-dot" style="width: 9px; height: 9px; border-radius: 50%; background: #c084fc; border: none; cursor: pointer; padding: 0;" onclick="window.pdfAnnotationManager.setStickyColor('${note.id}', 'purple')" title="Purple"></button>
                        <button class="color-dot" style="width: 9px; height: 9px; border-radius: 50%; background: #fdba74; border: none; cursor: pointer; padding: 0;" onclick="window.pdfAnnotationManager.setStickyColor('${note.id}', 'orange')" title="Orange"></button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <button class="btn btn-icon btn-note-toggle" style="width: 17px; height: 17px; padding: 0; min-height: unset;" onclick="window.pdfAnnotationManager.toggleNoteCollapse('${note.id}')" title="Collapse note"><i data-lucide="minimize-2" style="width: 10px; height: 10px;"></i></button>
                        <button class="btn btn-icon btn-note-delete" style="width: 17px; height: 17px; padding: 0; min-height: unset;" onclick="window.pdfAnnotationManager.deleteAnnotation('${note.id}')" title="Delete note"><i data-lucide="trash-2" style="width: 10px; height: 10px; color: #ef4444;"></i></button>
                    </div>
                </div>
                <textarea class="pdf-sticky-note-input" placeholder="Type sticky note on PDF..." style="font-size: ${(note.fontSize || 11.5) * scale}px;">${note.text || ''}</textarea>
                <div class="pdf-note-resize-handle" title="Drag to resize note"></div>
            `;

            const textarea = el.querySelector('textarea');
            if (textarea) {
                textarea.style.fontSize = `${(note.fontSize || 11.5) * scale}px`;
            }
            textarea.addEventListener('input', () => {
                note.text = textarea.value;
                this.notifyChange('EDIT_TEXT');
            });

            this.setupDraggable(el, note, scale, rotation);
            this.setupResizable(el, note, scale, rotation);
            layer.appendChild(el);
        });
        if (window.lucide) window.lucide.createIcons();
    }

    toggleNoteCollapse(noteId) {
        const note = this.annotations.find(a => a.id === noteId);
        if (!note) return;
        note.isCollapsed = !note.isCollapsed;
        const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
        const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));
        this.syncDomStickyNotes(document.getElementById('pdfStickyNotesLayer'), scale, rotation);
        this.notifyChange('UPDATE');
        if (!note.isCollapsed) {
            setTimeout(() => {
                const ta = document.querySelector(`.pdf-sticky-note[data-id="${noteId}"] textarea`);
                if (ta) ta.focus();
            }, 50);
        }
    }

    setStickyColor(noteId, colorTheme) {
        this.updateAnnotation(noteId, { colorTheme });
    }

    setupDraggable(domElement, model, scale, rotation = 0) {
        const header = domElement.querySelector('.pdf-embedded-textbox-header, .pdf-sticky-note-header');
        const pinIcon = domElement.querySelector('.pdf-sticky-note-pin-icon');
        const handle = header || pinIcon;
        if (!handle && !domElement) return;

        let isDragging = false;
        let startClientX = 0, startClientY = 0;
        let startPdfX = model.x, startPdfY = model.y;

        // Click on element marks it selected
        domElement.addEventListener('mousedown', () => {
            domElement.classList.add('selected');
        });
        document.addEventListener('mousedown', (e) => {
            if (!domElement.contains(e.target)) {
                domElement.classList.remove('selected');
            }
        });

        const dragTrigger = header || domElement;
        dragTrigger.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            if (e.target.tagName === 'TEXTAREA' || e.target.closest('textarea')) return;
            if (e.target.classList.contains('pdf-textbox-resize-handle') || e.target.classList.contains('pdf-note-resize-handle')) return;
            e.preventDefault();
            isDragging = true;
            domElement.classList.add('is-dragging', 'selected');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'move';
            startClientX = e.clientX;
            startClientY = e.clientY;
            startPdfX = model.x;
            startPdfY = model.y;

            const pageW = this.coords.baseWidth || 595;
            const pageH = this.coords.baseHeight || 842;
            const objW = model.isCollapsed ? 32 : (model.width || (model.type === 'STICKY_NOTE' ? 180 : 220));
            const objH = model.isCollapsed ? 32 : (model.height || (model.type === 'STICKY_NOTE' ? 105 : 32));

            const onMove = (mv) => {
                if (!isDragging) return;
                const rot = (rotation % 360 + 360) % 360;
                let rawDx = (mv.clientX - startClientX) / scale;
                let rawDy = (mv.clientY - startClientY) / scale;
                let deltaX = rawDx;
                let deltaY = rawDy;

                if (rot === 90) {
                    deltaX = rawDy;
                    deltaY = -rawDx;
                } else if (rot === 180) {
                    deltaX = -rawDx;
                    deltaY = -rawDy;
                } else if (rot === 270) {
                    deltaX = -rawDy;
                    deltaY = rawDx;
                }

                // Strict boundary clamping so text box / sticky note stays 100% inside PDF page bounds
                const maxX = Math.max(0, pageW - objW);
                const maxY = Math.max(0, pageH - objH);

                model.x = Math.max(0, Math.min(maxX, Math.round(startPdfX + deltaX)));
                model.y = Math.max(0, Math.min(maxY, Math.round(startPdfY + deltaY)));
                
                const screenPt = this.coords.pdfToScreenPoint(model.x, model.y, scale, rotation);
                domElement.style.left = `${screenPt.x}px`;
                domElement.style.top = `${screenPt.y}px`;
            };

            const onUp = () => {
                if (isDragging) {
                    isDragging = false;
                    domElement.classList.remove('is-dragging');
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    this.notifyChange('MOVE_OBJECT');
                }
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });
    }

    setupResizable(domElement, model, scale, rotation = 0) {
        const handle = domElement.querySelector('.pdf-textbox-resize-handle, .pdf-note-resize-handle');
        if (!handle) return;

        let isResizing = false;
        let startClientX = 0, startClientY = 0;
        let startWidth = model.width || (domElement.offsetWidth / scale);
        let startHeight = model.height || (domElement.offsetHeight / scale);

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            domElement.classList.add('is-resizing', 'selected');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'nwse-resize';
            startClientX = e.clientX;
            startClientY = e.clientY;
            startWidth = model.width || (domElement.offsetWidth / scale);
            startHeight = model.height || (domElement.offsetHeight / scale);

            const pageW = this.coords.baseWidth || 595;
            const pageH = this.coords.baseHeight || 842;

            const onResizeMove = (mv) => {
                if (!isResizing) return;
                const rot = (rotation % 360 + 360) % 360;
                let rawDx = (mv.clientX - startClientX) / scale;
                let rawDy = (mv.clientY - startClientY) / scale;
                let deltaX = rawDx;
                let deltaY = rawDy;

                if (rot === 90) {
                    deltaX = rawDy;
                    deltaY = -rawDx;
                } else if (rot === 180) {
                    deltaX = -rawDx;
                    deltaY = -rawDy;
                } else if (rot === 270) {
                    deltaX = -rawDy;
                    deltaY = rawDx;
                }

                const minWidth = model.type === 'STICKY_NOTE' ? 140 : 80;
                const minHeight = model.type === 'STICKY_NOTE' ? 70 : 28;

                // Strict boundary clamping so resizing cannot extend outside PDF page limits
                const maxAllowedW = Math.max(minWidth, pageW - (model.x || 0));
                const maxAllowedH = Math.max(minHeight, pageH - (model.y || 0));

                model.width = Math.max(minWidth, Math.min(maxAllowedW, Math.round(startWidth + deltaX)));
                model.height = Math.max(minHeight, Math.min(maxAllowedH, Math.round(startHeight + deltaY)));

                domElement.style.width = `${model.width * scale}px`;
                domElement.style.height = `${model.height * scale}px`;
            };

            const onResizeUp = () => {
                if (isResizing) {
                    isResizing = false;
                    domElement.classList.remove('is-resizing');
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                    window.removeEventListener('mousemove', onResizeMove);
                    window.removeEventListener('mouseup', onResizeUp);
                    this.notifyChange('RESIZE_OBJECT');
                }
            };

            window.addEventListener('mousemove', onResizeMove);
            window.addEventListener('mouseup', onResizeUp);
        });
    }

    distanceToLineSegment(p, p1, p2) {
        const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) ** 2;
        if (l2 === 0) return this.coords.distance(p, p1);
        let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (p1.x + t * (p2.x - p1.x)), p.y - (p1.y + t * (p2.y - p1.y)));
    }
}

window.PDFAnnotationManager = PDFAnnotationManager;
