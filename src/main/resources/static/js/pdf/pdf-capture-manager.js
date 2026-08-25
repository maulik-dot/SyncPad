/**
 * SyncPad PDF Capture Manager
 * Handles camera-reticle pointer placement, region selection,
 * 4-point corner resizing, draggable repositioning, high-resolution
 * visual snapshot generation (UI-free), bounded text extraction,
 * and direct insertion into the active document.
 */
class PDFCaptureManager {
    constructor(coordSystem, textExtractor) {
        this.coords = coordSystem || new window.PDFCoordinateSystem();
        this.textExtractor = textExtractor || new window.PDFTextExtractor(this.coords);
        this.captureBoxElement = document.getElementById('pdfCaptureBox');
        this.dimensionBadgeElement = document.getElementById('pdfCaptureDimensionBadge');
        this.cameraReticleElement = document.getElementById('pdfCameraReticle');
        this.isCaptureModeActive = false;
        this.isBoxPlaced = false;

        if (this.captureBoxElement) {
            this.captureBoxElement.style.display = 'none';
        }
        if (this.cameraReticleElement) {
            this.cameraReticleElement.classList.add('hidden');
        }
        
        // Capture rectangle in unscaled PDF coordinates { x, y, width, height }
        this.currentPdfRect = { x: 30, y: 140, width: 380, height: 180 };
        
        window.pdfCaptureManager = this;

        this.initCameraReticleAndClickInteractions();
        this.initBoxInteractions();
    }

    setCaptureMode(active) {
        this.isCaptureModeActive = active;
        const btn = document.getElementById('pdfCaptureBtn');
        const box = document.getElementById('pdfCaptureBox');
        const reticle = document.getElementById('pdfCameraReticle');
        const container = document.getElementById('pdfCanvasContainer');
        const wrapper = document.getElementById('pdfPageWrapper');

        if (active) {
            this.isBoxPlaced = false;
            if (btn) {
                btn.classList.add('active');
                btn.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.45)';
            }
            if (container) container.classList.add('is-in-capture-mode');
            if (wrapper) wrapper.classList.add('is-in-capture-mode');

            const canvas = document.getElementById('pdfAnnotationCanvas');
            const textLayer = document.getElementById('pdfTextLayer');
            if (canvas) canvas.style.pointerEvents = 'none';
            if (textLayer) textLayer.style.pointerEvents = 'none';

            if (box) {
                box.classList.add('hidden');
                box.style.display = 'none';
            }

            // Show camera reticle follower initially for placement
            if (reticle) reticle.classList.remove('hidden');
            toast('📷 Hover & click anywhere on PDF to place capture box');
        } else {
            this.isBoxPlaced = false;
            if (btn) {
                btn.classList.remove('active');
                btn.style.boxShadow = 'none';
            }
            if (container) container.classList.remove('is-in-capture-mode');
            if (wrapper) wrapper.classList.remove('is-in-capture-mode');
            if (reticle) reticle.classList.add('hidden');
            if (box) {
                box.classList.add('hidden');
                box.style.display = 'none';
            }

            const textLayer = document.getElementById('pdfTextLayer');
            if (textLayer) textLayer.style.pointerEvents = 'auto';
        }
    }

    toggleCaptureMode() {
        this.setCaptureMode(!this.isCaptureModeActive);
    }

    setPdfRect(pdfRect) {
        const pageWidth = this.coords ? (this.coords.baseWidth || 595) : 595;
        const pageHeight = this.coords ? (this.coords.baseHeight || 842) : 842;

        const w = Math.max(40, Math.min(pageWidth, Math.round(pdfRect.width)));
        const h = Math.max(30, Math.min(pageHeight, Math.round(pdfRect.height)));
        const x = Math.max(0, Math.min(pageWidth - w, Math.round(pdfRect.x)));
        const y = Math.max(0, Math.min(pageHeight - h, Math.round(pdfRect.y)));

        this.currentPdfRect = { x, y, width: w, height: h };
        this.updateScreenPositions();
    }

    updateScreenPositions(
        scale = (window.pdfEngine ? window.pdfEngine.currentScale : 1.0),
        rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0))
    ) {
        const box = document.getElementById('pdfCaptureBox');
        if (!box) return;

        const screenRect = this.coords.pdfToScreenRect(this.currentPdfRect, scale, rotation);
        box.style.left = `${screenRect.left}px`;
        box.style.top = `${screenRect.top}px`;
        box.style.width = `${screenRect.width}px`;
        box.style.height = `${screenRect.height}px`;

        const dimText = document.getElementById('pdfCaptureDimText');
        if (dimText) {
            dimText.textContent = `${Math.round(this.currentPdfRect.width)} × ${Math.round(this.currentPdfRect.height)}px • PDF Snapshot`;
        } else {
            const badge = document.getElementById('pdfCaptureDimensionBadge');
            if (badge) badge.textContent = `${Math.round(this.currentPdfRect.width)} × ${Math.round(this.currentPdfRect.height)}px • PDF Snapshot`;
        }
    }

    /**
     * Initializes Camera Hover Reticle and PDF Click Placement
     */
    initCameraReticleAndClickInteractions() {
        const wrapper = document.getElementById('pdfPageWrapper');
        if (!wrapper) return;

        // Hover tracking for Camera Reticle during initial placement
        wrapper.addEventListener('mousemove', (e) => {
            if (!this.isCaptureModeActive || this.isBoxPlaced) {
                const reticle = document.getElementById('pdfCameraReticle');
                if (reticle) reticle.classList.add('hidden');
                return;
            }
            const reticle = document.getElementById('pdfCameraReticle');
            if (!reticle) return;

            const rect = wrapper.getBoundingClientRect();
            const relX = e.clientX - rect.left;
            const relY = e.clientY - rect.top;

            reticle.style.left = `${relX}px`;
            reticle.style.top = `${relY}px`;
            reticle.classList.remove('hidden');
        });

        wrapper.addEventListener('mouseleave', () => {
            const reticle = document.getElementById('pdfCameraReticle');
            if (reticle) reticle.classList.add('hidden');
        });

        // Click on PDF to place capture box (only when not already placed)
        wrapper.addEventListener('click', (e) => {
            if (!this.isCaptureModeActive || this.isBoxPlaced) return;

            // If click was inside capture box or on menu buttons or resize handles, ignore
            if (e.target.closest('#pdfCaptureBox') || e.target.classList.contains('resize-handle') || e.target.closest('.pdf-capture-menu')) {
                return;
            }

            const currentWrapper = document.getElementById('pdfPageWrapper');
            if (!currentWrapper) return;

            const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
            const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));

            const pdfPoint = this.coords.screenToPdfPoint(e.clientX, e.clientY, currentWrapper, scale, rotation);

            const defaultWidth = 380;
            const defaultHeight = 180;
            const pageWidth = this.coords.baseWidth || 595;
            const pageHeight = this.coords.baseHeight || 842;

            const placeX = Math.max(10, Math.min(pageWidth - defaultWidth - 10, pdfPoint.x - (defaultWidth / 2)));
            const placeY = Math.max(10, Math.min(pageHeight - defaultHeight - 10, pdfPoint.y - (defaultHeight / 2)));

            this.setPdfRect({
                x: placeX,
                y: placeY,
                width: defaultWidth,
                height: defaultHeight
            });

            this.isBoxPlaced = true;

            // Stop showing camera cursor and hide reticle immediately
            const container = document.getElementById('pdfCanvasContainer');
            if (container) container.classList.remove('is-in-capture-mode');
            if (currentWrapper) currentWrapper.classList.remove('is-in-capture-mode');

            const currentReticle = document.getElementById('pdfCameraReticle');
            if (currentReticle) currentReticle.classList.add('hidden');

            const currentBox = document.getElementById('pdfCaptureBox');
            if (currentBox) {
                currentBox.classList.remove('hidden');
                currentBox.style.display = 'block';
            }

            this.updateScreenPositions(scale, rotation);
            if (window.lucide) window.lucide.createIcons();
            toast('✨ Capture Box ready: Drag anywhere or resize from 4 corner handles');
        });

        // Global Escape key listener to cancel/close capture mode
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isCaptureModeActive) {
                this.setCaptureMode(false);
            }
        });
    }

    /**
     * Initializes Draggable Body and 4-Corner Point Resizing
     */
    initBoxInteractions() {
        const box = this.captureBoxElement || document.getElementById('pdfCaptureBox');
        if (!box) return;

        let isDragging = false;
        let isResizing = false;
        let activeHandleType = null;
        let startClientX = 0, startClientY = 0;
        let startPdfRect = null;

        // 1. Draggable Body
        box.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle') || e.target.closest('.pdf-capture-menu') || e.target.closest('.pdf-capture-close-btn')) return;
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            box.classList.add('is-dragging');
            startClientX = e.clientX;
            startClientY = e.clientY;
            startPdfRect = { ...this.currentPdfRect };

            const onMove = (mv) => {
                if (!isDragging) return;
                mv.preventDefault();

                const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
                const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));

                const screenDx = mv.clientX - startClientX;
                const screenDy = mv.clientY - startClientY;

                const pdfDelta = this.coords.screenDeltaToPdfDelta ? 
                    this.coords.screenDeltaToPdfDelta(screenDx, screenDy, scale, rotation) : 
                    { dx: screenDx / scale, dy: screenDy / scale };

                const pageWidth = this.coords.baseWidth || 595;
                const pageHeight = this.coords.baseHeight || 842;

                const newX = Math.max(0, Math.min(pageWidth - startPdfRect.width, startPdfRect.x + pdfDelta.dx));
                const newY = Math.max(0, Math.min(pageHeight - startPdfRect.height, startPdfRect.y + pdfDelta.dy));

                this.setPdfRect({
                    x: newX,
                    y: newY,
                    width: startPdfRect.width,
                    height: startPdfRect.height
                });
            };

            const onUp = (upEv) => {
                if (isDragging) {
                    if (upEv) {
                        upEv.preventDefault();
                        upEv.stopPropagation();
                    }
                    isDragging = false;
                    box.classList.remove('is-dragging');
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                }
            };

            window.addEventListener('mousemove', onMove, { passive: false });
            window.addEventListener('mouseup', onUp, { capture: true });
        });

        // 2. 4-Corner Resize Points (NW, NE, SW, SE)
        box.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                isResizing = true;
                activeHandleType = handle.dataset.handle || (handle.classList.contains('handle-nw') ? 'nw' : (handle.classList.contains('handle-ne') ? 'ne' : (handle.classList.contains('handle-sw') ? 'sw' : 'se')));
                startClientX = e.clientX;
                startClientY = e.clientY;
                startPdfRect = { ...this.currentPdfRect };

                const onResize = (mv) => {
                    if (!isResizing) return;
                    mv.preventDefault();

                    const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
                    const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));

                    const screenDx = mv.clientX - startClientX;
                    const screenDy = mv.clientY - startClientY;

                    const pdfDelta = this.coords.screenDeltaToPdfDelta ? 
                        this.coords.screenDeltaToPdfDelta(screenDx, screenDy, scale, rotation) : 
                        { dx: screenDx / scale, dy: screenDy / scale };

                    const pageWidth = this.coords.baseWidth || 595;
                    const pageHeight = this.coords.baseHeight || 842;

                    let newX = startPdfRect.x;
                    let newY = startPdfRect.y;
                    let newW = startPdfRect.width;
                    let newH = startPdfRect.height;

                    if (activeHandleType === 'se') {
                        // Bottom-Right: increase/decrease width and height
                        newW = Math.max(40, Math.min(pageWidth - startPdfRect.x, startPdfRect.width + pdfDelta.dx));
                        newH = Math.max(30, Math.min(pageHeight - startPdfRect.y, startPdfRect.height + pdfDelta.dy));
                    } else if (activeHandleType === 'ne') {
                        // Top-Right: change width and top y/height
                        newW = Math.max(40, Math.min(pageWidth - startPdfRect.x, startPdfRect.width + pdfDelta.dx));
                        const adjH = Math.max(30, Math.min(startPdfRect.y + startPdfRect.height, startPdfRect.height - pdfDelta.dy));
                        newY = Math.max(0, startPdfRect.y + (startPdfRect.height - adjH));
                        newH = adjH;
                    } else if (activeHandleType === 'sw') {
                        // Bottom-Left: change left x/width and height
                        const adjW = Math.max(40, Math.min(startPdfRect.x + startPdfRect.width, startPdfRect.width - pdfDelta.dx));
                        newX = Math.max(0, startPdfRect.x + (startPdfRect.width - adjW));
                        newW = adjW;
                        newH = Math.max(30, Math.min(pageHeight - startPdfRect.y, startPdfRect.height + pdfDelta.dy));
                    } else if (activeHandleType === 'nw') {
                        // Top-Left: change left x/width and top y/height
                        const adjW = Math.max(40, Math.min(startPdfRect.x + startPdfRect.width, startPdfRect.width - pdfDelta.dx));
                        newX = Math.max(0, startPdfRect.x + (startPdfRect.width - adjW));
                        newW = adjW;

                        const adjH = Math.max(30, Math.min(startPdfRect.y + startPdfRect.height, startPdfRect.height - pdfDelta.dy));
                        newY = Math.max(0, startPdfRect.y + (startPdfRect.height - adjH));
                        newH = adjH;
                    }

                    this.setPdfRect({ x: newX, y: newY, width: newW, height: newH });
                };

                const onResizeUp = (upEv) => {
                    if (isResizing) {
                        if (upEv) {
                            upEv.preventDefault();
                            upEv.stopPropagation();
                        }
                        isResizing = false;
                        window.removeEventListener('mousemove', onResize);
                        window.removeEventListener('mouseup', onResizeUp);
                    }
                };

                window.addEventListener('mousemove', onResize, { passive: false });
                window.addEventListener('mouseup', onResizeUp, { capture: true });
            });
        });
    }

    /**
     * Generates a pristine, high-resolution snapshot of the selected PDF region
     * perfectly compositing the base PDF, all highlights, underlines, pen strokes,
     * shapes, text boxes, and sticky notes (completely free of selection handles and UI).
     */
    generateSnapshotDataUrl() {
        const renderCanvas = document.getElementById('pdfRenderCanvas');
        if (!renderCanvas) return null;

        const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
        const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));
        const screenRect = this.coords.pdfToScreenRect(this.currentPdfRect, scale, rotation);

        // High-DPI source multiplier
        const dpr = renderCanvas.width / (renderCanvas.offsetWidth || 1);
        const cropX = Math.max(0, screenRect.left * dpr);
        const cropY = Math.max(0, screenRect.top * dpr);
        const cropW = Math.min(renderCanvas.width - cropX, screenRect.width * dpr);
        const cropH = Math.min(renderCanvas.height - cropY, screenRect.height * dpr);

        if (cropW <= 2 || cropH <= 2) return null;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = cropW;
        offCanvas.height = cropH;
        const offCtx = offCanvas.getContext('2d');

        // 1. Draw base PDF canvas
        offCtx.drawImage(renderCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // 2. Blend all vector annotations
        const annotCanvas = document.getElementById('pdfAnnotationCanvas');
        if (annotCanvas) {
            const aDpr = annotCanvas.width / (annotCanvas.offsetWidth || 1);
            const aCropX = Math.max(0, screenRect.left * aDpr);
            const aCropY = Math.max(0, screenRect.top * aDpr);
            const aCropW = Math.min(annotCanvas.width - aCropX, screenRect.width * aDpr);
            const aCropH = Math.min(annotCanvas.height - aCropY, screenRect.height * aDpr);
            offCtx.drawImage(annotCanvas, aCropX, aCropY, aCropW, aCropH, 0, 0, cropW, cropH);
        }

        // 3. Blend DOM Text Boxes & Sticky Notes that fall within the capture area
        if (window.pdfEngine && window.pdfEngine.annotManager) {
            const currentPage = window.pdfEngine.currentPage;
            const pageAnnots = window.pdfEngine.annotManager.getAnnotationsForPage(currentPage);

            pageAnnots.forEach(a => {
                if (a.type === 'TEXT_BOX' && a.text) {
                    const bScreen = this.coords.pdfToScreenRect(a, scale);
                    const bX = (bScreen.left - screenRect.left) * dpr;
                    const bY = (bScreen.top - screenRect.top) * dpr;

                    offCtx.save();
                    offCtx.font = `500 ${(a.fontSize || 13) * scale * dpr}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
                    offCtx.fillStyle = '#0f172a';
                    const lines = a.text.split('\n');
                    let lineY = bY + (a.fontSize || 13) * scale * dpr;
                    for (const line of lines) {
                        offCtx.fillText(line, bX, lineY);
                        lineY += (a.fontSize || 13) * 1.35 * scale * dpr;
                    }
                    offCtx.restore();
                } else if (a.type === 'STICKY_NOTE' && a.text && !a.isCollapsed) {
                    const nScreen = this.coords.pdfToScreenRect(a, scale);
                    const nX = (nScreen.left - screenRect.left) * dpr;
                    const nY = (nScreen.top - screenRect.top) * dpr;
                    const nW = (a.width || 180) * scale * dpr;
                    const nH = (a.height || 105) * scale * dpr;

                    offCtx.save();
                    const themeColors = {
                        yellow: { bg: '#fef08a', border: '#facc15', text: '#713f12' },
                        green: { bg: '#dcfce7', border: '#86efac', text: '#14532d' },
                        blue: { bg: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e' },
                        pink: { bg: '#fce7f3', border: '#f472b6', text: '#831843' },
                        purple: { bg: '#f3e8ff', border: '#d8b4fe', text: '#581c87' },
                        orange: { bg: '#ffedd5', border: '#fdba74', text: '#7c2d12' }
                    };
                    const theme = themeColors[a.colorTheme] || themeColors.yellow;

                    offCtx.fillStyle = theme.bg;
                    offCtx.strokeStyle = theme.border;
                    offCtx.lineWidth = 1.5 * dpr;
                    offCtx.beginPath();
                    if (offCtx.roundRect) offCtx.roundRect(nX, nY, nW, nH, 6 * dpr);
                    else offCtx.rect(nX, nY, nW, nH);
                    offCtx.fill();
                    offCtx.stroke();

                    // Note Text
                    offCtx.font = `500 ${11.5 * scale * dpr}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
                    offCtx.fillStyle = theme.text;
                    const lines = a.text.split('\n');
                    let lineY = nY + 20 * scale * dpr;
                    for (const line of lines) {
                        offCtx.fillText(line, nX + 8 * scale * dpr, lineY);
                        lineY += 14 * scale * dpr;
                    }
                    offCtx.restore();
                }
            });
        }

        return offCanvas.toDataURL('image/png', 1.0);
    }

    /**
     * Extracts text within the current capture box
     */
    extractCapturedText() {
        const pageData = window.pdfEngine ? window.pdfEngine.getCurrentPageData() : null;
        return this.textExtractor.extractTextInPdfRect(this.currentPdfRect, pageData);
    }

    /**
     * Executes Capture Tool actions (4 Options)
     */
    async executeAction(action) {
        const pageNum = window.pdfEngine ? window.pdfEngine.currentPage : 1;
        const pdfName = window.pdfEngine ? window.pdfEngine.currentFileName : 'Reference Document';

        if (action === 'snapshot') {
            const dataUrl = this.generateSnapshotDataUrl();
            if (dataUrl) {
                try {
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    toast('📸 High-res snapshot copied to clipboard!');
                } catch (e) {
                    toast('📸 Snapshot generated (ready to insert)');
                }
            } else {
                toast('Could not generate snapshot for current region');
            }
        } else if (action === 'copy') {
            const result = this.extractCapturedText();
            if (!result.isEmpty && result.text) {
                await navigator.clipboard.writeText(result.text);
                toast(`📋 Copied ${result.wordCount} words from PDF region to clipboard`);
            } else {
                toast('ℹ No selectable text found in this region');
            }
        } else if (action === 'insert') {
            this.openInsertModal();
        } else if (action === 'annotate') {
            if (window.pdfEngine) {
                window.pdfEngine.setActiveTool('pen');
            }
            toast('✏️ Annotate tool ready on selected region');
        }
    }

    /**
     * Opens modal allowing user to choose Text quote or Image snapshot insertion
     */
    openInsertModal() {
        const extracted = this.extractCapturedText();
        const snapshotUrl = this.generateSnapshotDataUrl();
        const pageNum = window.pdfEngine ? window.pdfEngine.currentPage : 1;
        const pdfName = window.pdfEngine ? window.pdfEngine.currentFileName : 'Reference Document';

        let modal = document.getElementById('pdfInsertModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pdfInsertModal';
            document.body.appendChild(modal);
        }

        modal.className = 'modal-overlay';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 480px; box-shadow: var(--shadow-xl);">
                <div class="modal-header" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="corner-down-right" style="width: 18px; height: 18px; color: var(--accent-primary);"></i>
                        <h3 class="modal-title" style="margin: 0; font-size: 1rem; font-weight: 600;">Insert PDF Content into Document</h3>
                    </div>
                    <button class="btn btn-icon" onclick="document.getElementById('pdfInsertModal').classList.add('hidden')"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
                </div>
                <div class="modal-body" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
                    <div style="font-size: 0.82rem; color: var(--text-secondary);">
                        Choose how to insert the selected PDF region into your open document editor:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem; border: 1.5px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; background: var(--bg-surface-hover);" id="labelInsertSnapshot">
                            <input type="radio" name="pdfInsertChoice" value="snapshot" checked style="margin-top: 3px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); display: flex; align-items: center; gap: 4px;">
                                    <span>🖼️ Visual Annotated Snapshot</span>
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                                    Inserts high-resolution image including all highlights, notes, and annotations.
                                </div>
                                ${snapshotUrl ? `<div style="margin-top: 8px; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; max-height: 85px; background: #fff; display: flex; align-items: center; justify-content: center;"><img src="${snapshotUrl}" style="max-width: 100%; max-height: 85px; object-fit: contain;"></div>` : ''}
                            </div>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem; border: 1.5px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; background: var(--bg-surface-hover);" id="labelInsertText">
                            <input type="radio" name="pdfInsertChoice" value="text" style="margin-top: 3px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); display: flex; align-items: center; gap: 4px;">
                                    <span>📝 Formatted Text Quote</span>
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;" id="insertTextPreview">
                                    ${extracted.isEmpty ? 'No text detected in this region' : `"${extracted.text.slice(0, 75)}..."`}
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 0.85rem 1.25rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--bg-surface);">
                    <button class="btn btn-outline" onclick="document.getElementById('pdfInsertModal').classList.add('hidden')">Cancel</button>
                    <button class="btn btn-primary" id="btnConfirmPdfInsert" onclick="window.pdfCaptureManager.confirmInsertion()">Insert Content</button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    confirmInsertion(choiceOverride) {
        const modal = document.getElementById('pdfInsertModal');
        const choice = choiceOverride || (modal ? modal.querySelector('input[name="pdfInsertChoice"]:checked')?.value : 'snapshot') || 'snapshot';
        if (modal) modal.classList.add('hidden');

        const sheet = document.getElementById('docPageSheet');
        if (!sheet) {
            toast('Document editor sheet not found');
            return;
        }

        const pageNum = window.pdfEngine ? window.pdfEngine.currentPage : 1;
        const pdfName = window.pdfEngine ? window.pdfEngine.currentFileName : 'Reference Document';

        if (choice === 'text') {
            const extracted = this.extractCapturedText();
            const textToInsert = !extracted.isEmpty ? extracted.text : 'Selected diagram specification content from reference document.';
            const html = `
                <blockquote class="pdf-ocr-quote" style="border-left: 3px solid var(--accent-primary); background: var(--bg-hover, rgba(37,99,235,0.06)); padding: 0.75rem 1rem; border-radius: 0 4px 4px 0; margin: 1rem 0;">
                    <div style="font-size: 0.72rem; font-weight: 700; color: var(--accent-primary); margin-bottom: 0.35rem;">[Quote from ${pdfName} • Page ${pageNum}]</div>
                    <p style="margin: 0; font-size: 0.88rem; color: var(--text-primary); line-height: 1.55;">
                        "${textToInsert}"
                    </p>
                </blockquote><p><br></p>
            `;
            this.insertHtmlAtCursor(html, sheet);
            toast('✓ Quoted PDF text inserted into document');
        } else {
            const dataUrl = this.generateSnapshotDataUrl();
            if (dataUrl) {
                const html = `
                    <div class="pdf-snapshot-embed" style="margin: 1.25rem 0; text-align: center;">
                        <img src="${dataUrl}" alt="PDF Snapshot" style="max-width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-md);">
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.35rem; font-weight: 500;">Figure: Extracted from ${pdfName} (Page ${pageNum})</div>
                    </div><p><br></p>
                `;
                this.insertHtmlAtCursor(html, sheet);
                toast('✓ PDF snapshot image inserted into document');
            } else {
                toast('Could not generate snapshot for selected area');
            }
        }

        if (typeof onDocChange === 'function') onDocChange();
    }

    insertHtmlAtCursor(html, sheet) {
        if (!sheet) return;
        sheet.focus();

        const sel = window.getSelection();
        let inserted = false;

        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (sheet.contains(range.commonAncestorContainer)) {
                range.deleteContents();
                const el = document.createElement('div');
                el.innerHTML = html;
                const frag = document.createDocumentFragment();
                let node;
                let lastNode = null;
                while ((node = el.firstChild)) {
                    lastNode = node;
                    frag.appendChild(node);
                }
                range.insertNode(frag);
                if (lastNode) {
                    const nextRange = document.createRange();
                    if (lastNode.tagName === 'P') {
                        nextRange.setStart(lastNode, 0);
                        nextRange.collapse(true);
                    } else {
                        nextRange.setStartAfter(lastNode);
                        nextRange.collapse(true);
                    }
                    sel.removeAllRanges();
                    sel.addRange(nextRange);
                    if (typeof saveDocSelection === 'function') saveDocSelection();
                    if (lastNode.nodeType === 1 && typeof lastNode.scrollIntoView === 'function') {
                        lastNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else if (lastNode.parentElement && typeof lastNode.parentElement.scrollIntoView === 'function') {
                        lastNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
                inserted = true;
            }
        }

        if (!inserted) {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            while (temp.firstChild) {
                sheet.appendChild(temp.firstChild);
            }
            sheet.scrollTop = sheet.scrollHeight;
        }

        if (typeof onDocChange === 'function') {
            onDocChange();
        } else if (typeof triggerDocAutoSave === 'function') {
            triggerDocAutoSave();
        }
        if (typeof scrollCursorIntoView === 'function') {
            scrollCursorIntoView(120);
        }
        if (typeof broadcastLocalCursorPosition === 'function') {
            broadcastLocalCursorPosition(true);
        }
    }
}

window.PDFCaptureManager = PDFCaptureManager;
