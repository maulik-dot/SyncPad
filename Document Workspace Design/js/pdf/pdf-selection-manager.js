/**
 * SyncPad PDF Selection Manager
 * Manages object selection, movement, 8-handle resizing, and deletion
 * in unscaled PDF coordinates without altering underlying PDF content.
 */
class PDFSelectionManager {
    constructor(annotationManager, coordSystem) {
        this.annotManager = annotationManager;
        this.coords = coordSystem || new window.PDFCoordinateSystem();
        this.selectedAnnotation = null;
        this.overlayElement = null;
        this.isInteracting = false;
        this.activeHandle = null;
        
        this.initOverlay();
    }

    initOverlay() {
        let overlay = document.getElementById('pdfSelectionOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pdfSelectionOverlay';
            overlay.className = 'pdf-selection-overlay hidden';
            overlay.innerHTML = `
                <div class="pdf-selection-box">
                    <div class="pdf-sel-handle handle-nw" data-handle="nw"></div>
                    <div class="pdf-sel-handle handle-n" data-handle="n"></div>
                    <div class="pdf-sel-handle handle-ne" data-handle="ne"></div>
                    <div class="pdf-sel-handle handle-e" data-handle="e"></div>
                    <div class="pdf-sel-handle handle-se" data-handle="se"></div>
                    <div class="pdf-sel-handle handle-s" data-handle="s"></div>
                    <div class="pdf-sel-handle handle-sw" data-handle="sw"></div>
                    <div class="pdf-sel-handle handle-w" data-handle="w"></div>
                    <div class="pdf-sel-toolbar">
                        <button class="btn btn-icon btn-del-selected" title="Delete Object"><i data-lucide="trash-2" style="width:12px;height:12px;color:#ef4444;"></i></button>
                    </div>
                </div>
            `;
            const wrapper = document.getElementById('pdfPageWrapper');
            if (wrapper) wrapper.appendChild(overlay);
        }
        this.overlayElement = overlay;

        // Delete button listener
        const delBtn = overlay.querySelector('.btn-del-selected');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedAnnotation) {
                    this.annotManager.deleteAnnotation(this.selectedAnnotation.id);
                    this.clearSelection();
                }
            });
        }

        this.initInteractionListeners();
    }

    selectAnnotation(annot) {
        if (!annot || annot.type === 'STICKY_NOTE' || annot.type === 'TEXT_BOX') {
            this.clearSelection();
            return;
        }
        this.selectedAnnotation = annot;
        this.annotManager.selectedAnnotationId = annot ? annot.id : null;
        this.renderSelectionHandles();
        if (annot) {
            toast(`Selected: ${annot.type}`);
        }
    }

    clearSelection() {
        this.selectedAnnotation = null;
        this.annotManager.selectedAnnotationId = null;
        if (this.overlayElement) {
            this.overlayElement.classList.add('hidden');
        }
    }

    getBoundsOfAnnotation(annot) {
        if (!annot) return null;
        if (annot.x !== undefined && annot.width !== undefined) {
            return { x: annot.x, y: annot.y, width: annot.width, height: annot.height };
        }
        if (annot.startX !== undefined && annot.endX !== undefined) {
            const endY = annot.endY !== undefined ? annot.endY : annot.startY;
            const r = this.coords.pointsToPdfRect({ x: annot.startX, y: annot.startY }, { x: annot.endX, y: endY });
            if (annot.type === 'UNDERLINE') {
                return {
                    x: r.x,
                    y: r.y - 4,
                    width: Math.max(16, r.width),
                    height: Math.max(12, r.height + 8)
                };
            }
            return r;
        }
        if (annot.points && annot.points.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            annot.points.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            });
            return { x: minX - 4, y: minY - 4, width: Math.max(16, maxX - minX + 8), height: Math.max(16, maxY - minY + 8) };
        }
        return null;
    }

    renderSelectionHandles(
        scale = (window.pdfEngine ? window.pdfEngine.currentScale : 1.0),
        rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0))
    ) {
        if (!this.overlayElement) return;
        if (!this.selectedAnnotation) {
            this.overlayElement.classList.add('hidden');
            return;
        }

        const bounds = this.getBoundsOfAnnotation(this.selectedAnnotation);
        if (!bounds) {
            this.overlayElement.classList.add('hidden');
            return;
        }

        const screenRect = this.coords.pdfToScreenRect(bounds, scale, rotation);
        const box = this.overlayElement.querySelector('.pdf-selection-box');
        if (box) {
            box.style.left = `${screenRect.left - 4}px`;
            box.style.top = `${screenRect.top - 4}px`;
            box.style.width = `${screenRect.width + 8}px`;
            box.style.height = `${screenRect.height + 8}px`;
        }

        this.overlayElement.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    initInteractionListeners() {
        if (!this.overlayElement) return;
        const box = this.overlayElement.querySelector('.pdf-selection-box');
        if (!box) return;

        let isDragging = false;
        let isResizing = false;
        let currentHandle = null;
        let startClientX = 0, startClientY = 0;
        let startBounds = null;

        // Move annotation
        box.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('pdf-sel-handle') || e.target.closest('.pdf-sel-toolbar')) return;
            if (!this.selectedAnnotation) return;

            isDragging = true;
            startClientX = e.clientX;
            startClientY = e.clientY;
            startBounds = {
                ...this.getBoundsOfAnnotation(this.selectedAnnotation),
                startX: this.selectedAnnotation.startX,
                startY: this.selectedAnnotation.startY,
                endX: this.selectedAnnotation.endX,
                endY: this.selectedAnnotation.endY !== undefined ? this.selectedAnnotation.endY : this.selectedAnnotation.startY
            };

            const onMove = (mv) => {
                if (!isDragging) return;
                const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
                const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));
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

                this.applyMove(this.selectedAnnotation, startBounds, deltaX, deltaY);
                this.annotManager.renderActivePage(scale, rotation);
                this.renderSelectionHandles(scale, rotation);
            };

            const onUp = () => {
                if (isDragging) {
                    isDragging = false;
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    this.annotManager.notifyChange('MOVE_OBJECT');
                }
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        // 8 Resize Handles
        box.querySelectorAll('.pdf-sel-handle').forEach(handleEl => {
            handleEl.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (!this.selectedAnnotation) return;

                isResizing = true;
                currentHandle = handleEl.dataset.handle;
                startClientX = e.clientX;
                startClientY = e.clientY;
                startBounds = {
                    ...this.getBoundsOfAnnotation(this.selectedAnnotation),
                    startX: this.selectedAnnotation.startX,
                    startY: this.selectedAnnotation.startY,
                    endX: this.selectedAnnotation.endX,
                    endY: this.selectedAnnotation.endY !== undefined ? this.selectedAnnotation.endY : this.selectedAnnotation.startY
                };

                const onResizeMove = (mv) => {
                    if (!isResizing) return;
                    const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
                    const rotation = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.rotation : (window.pdfRotation || 0));
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

                    this.applyResize(this.selectedAnnotation, startBounds, currentHandle, deltaX, deltaY);
                    this.annotManager.renderActivePage(scale, rotation);
                    this.renderSelectionHandles(scale, rotation);
                };

                const onResizeUp = () => {
                    if (isResizing) {
                        isResizing = false;
                        window.removeEventListener('mousemove', onResizeMove);
                        window.removeEventListener('mouseup', onResizeUp);
                        this.annotManager.notifyChange('RESIZE_OBJECT');
                    }
                };

                window.addEventListener('mousemove', onResizeMove);
                window.addEventListener('mouseup', onResizeUp);
            });
        });

        // Keyboard handler for Delete key and Esc
        window.addEventListener('keydown', (e) => {
            if (this.selectedAnnotation && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    return;
                }
                e.preventDefault();
                this.annotManager.deleteAnnotation(this.selectedAnnotation.id);
                this.clearSelection();
                toast('✓ Deleted annotation');
            } else if (e.key === 'Escape') {
                this.clearSelection();
            }
        });
    }

    applyMove(annot, startBounds, deltaX, deltaY) {
        if (annot.x !== undefined) {
            annot.x = Math.max(0, Math.round(startBounds.x + deltaX));
            annot.y = Math.max(0, Math.round(startBounds.y + deltaY));
        }
        if (annot.startX !== undefined) {
            const w = (startBounds.endX !== undefined ? startBounds.endX - startBounds.startX : annot.endX - annot.startX);
            const h = (startBounds.endY !== undefined ? startBounds.endY - startBounds.startY : (annot.endY || annot.startY) - annot.startY);
            const origX = startBounds.startX !== undefined ? startBounds.startX : startBounds.x;
            const origY = startBounds.startY !== undefined ? startBounds.startY : startBounds.y;
            annot.startX = Math.max(0, Math.round(origX + deltaX));
            annot.startY = Math.max(0, Math.round(origY + deltaY));
            annot.endX = annot.startX + w;
            annot.endY = annot.startY + h;
        }
        if (annot.points && annot.points.length > 0) {
            const shiftX = deltaX;
            const shiftY = deltaY;
            annot.points.forEach(p => {
                p.x = Math.round(p.x + shiftX);
                p.y = Math.round(p.y + shiftY);
            });
        }
    }

    applyResize(annot, bounds, handle, deltaX, deltaY) {
        let newX = bounds.x;
        let newY = bounds.y;
        let newW = bounds.width;
        let newH = bounds.height;

        if (handle.includes('e')) newW = Math.max(20, bounds.width + deltaX);
        if (handle.includes('s')) newH = Math.max(20, bounds.height + deltaY);
        if (handle.includes('w')) {
            const adjustedW = Math.max(20, bounds.width - deltaX);
            newX = bounds.x + (bounds.width - adjustedW);
            newW = adjustedW;
        }
        if (handle.includes('n')) {
            const adjustedH = Math.max(20, bounds.height - deltaY);
            newY = bounds.y + (bounds.height - adjustedH);
            newH = adjustedH;
        }

        if (annot.x !== undefined && annot.width !== undefined) {
            annot.x = Math.round(newX);
            annot.y = Math.round(newY);
            annot.width = Math.round(newW);
            annot.height = Math.round(newH);
        } else if (annot.type === 'UNDERLINE') {
            annot.startX = Math.round(newX);
            annot.endX = Math.round(newX + newW);
            if (handle.includes('n') || handle.includes('s')) {
                annot.startY = Math.round(newY + (newH / 2));
                annot.endY = Math.round(newY + (newH / 2));
            }
        } else if (annot.startX !== undefined) {
            annot.startX = Math.round(newX);
            annot.startY = Math.round(newY);
            annot.endX = Math.round(newX + newW);
            annot.endY = Math.round(newY + newH);
        }
    }
}

window.PDFSelectionManager = PDFSelectionManager;
