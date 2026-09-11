/**
 * SyncPad PDF Coordinate System
 * Maps between unscaled PDF page coordinates (PDF points: 0..pageWidth, 0..pageHeight)
 * and active viewport / canvas screen pixels across all zoom levels and rotations.
 */
class PDFCoordinateSystem {
    constructor(baseWidth = 595, baseHeight = 842) {
        this.baseWidth = baseWidth;
        this.baseHeight = baseHeight;
        this.activeViewport = null;
    }

    setPageDimensions(width, height) {
        this.baseWidth = width || 595;
        this.baseHeight = height || 842;
    }

    setPdfJsViewport(viewport) {
        this.activeViewport = viewport || null;
    }

    /**
     * Converts client mouse/pointer coordinates (e.clientX, e.clientY)
     * to canonical unscaled PDF page coordinates [0..pageWidth, 0..pageHeight].
     */
    screenToPdfPoint(clientX, clientY, containerElement, scale = 1.0, rotation = 0) {
        if (!containerElement) return { x: 0, y: 0 };
        const rect = containerElement.getBoundingClientRect();
        
        // Relative screen pixel offset within the PDF page container
        let screenX = clientX - rect.left;
        let screenY = clientY - rect.top;

        if (this.activeViewport && typeof this.activeViewport.convertToPdfPoint === 'function') {
            const pt = this.activeViewport.convertToPdfPoint(screenX, screenY);
            return {
                x: Math.round(pt[0] * 100) / 100,
                y: Math.round(pt[1] * 100) / 100
            };
        }

        // Canonical mathematical transformation for PDF page (top-left origin)
        let unscaledX = screenX / scale;
        let unscaledY = screenY / scale;

        let pdfX = unscaledX;
        let pdfY = unscaledY;

        const rot = (rotation % 360 + 360) % 360;
        if (rot === 90) {
            pdfX = unscaledY;
            pdfY = this.baseHeight - unscaledX;
        } else if (rot === 180) {
            pdfX = this.baseWidth - unscaledX;
            pdfY = this.baseHeight - unscaledY;
        } else if (rot === 270) {
            pdfX = this.baseWidth - unscaledY;
            pdfY = unscaledX;
        }

        return {
            x: Math.round(pdfX * 100) / 100,
            y: Math.round(pdfY * 100) / 100
        };
    }

    /**
     * Converts unscaled PDF page coordinate (pdfX, pdfY)
     * to current rendered screen/canvas pixel position relative to page origin.
     */
    pdfToScreenPoint(pdfX, pdfY, scale = 1.0, rotation = 0) {
        if (this.activeViewport && typeof this.activeViewport.convertToViewportPoint === 'function') {
            const pt = this.activeViewport.convertToViewportPoint(pdfX, pdfY);
            return {
                x: pt[0],
                y: pt[1]
            };
        }

        let x = pdfX;
        let y = pdfY;
        const rot = (rotation % 360 + 360) % 360;

        if (rot === 90) {
            x = this.baseHeight - pdfY;
            y = pdfX;
        } else if (rot === 180) {
            x = this.baseWidth - pdfX;
            y = this.baseHeight - pdfY;
        } else if (rot === 270) {
            x = pdfY;
            y = this.baseWidth - pdfX;
        }

        return {
            x: x * scale,
            y: y * scale
        };
    }

    /**
     * Converts an unscaled PDF rectangle { x, y, width, height }
     * to screen pixel rectangle { left, top, width, height }
     */
    pdfToScreenRect(pdfRect, scale = 1.0, rotation = 0) {
        const x = pdfRect.x !== undefined ? pdfRect.x : (pdfRect.startX !== undefined ? Math.min(pdfRect.startX, pdfRect.endX) : 0);
        const y = pdfRect.y !== undefined ? pdfRect.y : (pdfRect.startY !== undefined ? Math.min(pdfRect.startY, pdfRect.endY) : 0);
        const w = pdfRect.width !== undefined ? pdfRect.width : (pdfRect.startX !== undefined ? Math.abs(pdfRect.endX - pdfRect.startX) : 0);
        const h = pdfRect.height !== undefined ? pdfRect.height : (pdfRect.startY !== undefined ? Math.abs(pdfRect.endY - pdfRect.startY) : 0);

        if (this.activeViewport && typeof this.activeViewport.convertToViewportRectangle === 'function') {
            const rect = this.activeViewport.convertToViewportRectangle([x, y, x + w, y + h]);
            const left = Math.min(rect[0], rect[2]);
            const top = Math.min(rect[1], rect[3]);
            const width = Math.abs(rect[2] - rect[0]);
            const height = Math.abs(rect[3] - rect[1]);
            return {
                left: Math.round(left * 10) / 10,
                top: Math.round(top * 10) / 10,
                width: Math.round(width * 10) / 10,
                height: Math.round(height * 10) / 10
            };
        }

        let left, top, width, height;
        const rot = (rotation % 360 + 360) % 360;

        if (rot === 90) {
            left = (this.baseHeight - (y + h)) * scale;
            top = x * scale;
            width = h * scale;
            height = w * scale;
        } else if (rot === 180) {
            left = (this.baseWidth - (x + w)) * scale;
            top = (this.baseHeight - (y + h)) * scale;
            width = w * scale;
            height = h * scale;
        } else if (rot === 270) {
            left = y * scale;
            top = (this.baseWidth - (x + w)) * scale;
            width = h * scale;
            height = w * scale;
        } else {
            left = x * scale;
            top = y * scale;
            width = w * scale;
            height = h * scale;
        }

        return {
            left: Math.round(left * 10) / 10,
            top: Math.round(top * 10) / 10,
            width: Math.round(width * 10) / 10,
            height: Math.round(height * 10) / 10
        };
    }

    /**
     * Converts a screen pixel rectangle { left, top, width, height }
     * to unscaled PDF coordinates { x, y, width, height }
     */
    screenToPdfRect(screenRect, scale = 1.0, rotation = 0) {
        const l = screenRect.left || 0;
        const t = screenRect.top || 0;
        const w = screenRect.width || 0;
        const h = screenRect.height || 0;

        if (this.activeViewport && typeof this.activeViewport.convertToPdfRectangle === 'function') {
            const rect = this.activeViewport.convertToPdfRectangle([l, t, l + w, t + h]);
            const x = Math.min(rect[0], rect[2]);
            const y = Math.min(rect[1], rect[3]);
            const width = Math.abs(rect[2] - rect[0]);
            const height = Math.abs(rect[3] - rect[1]);
            return {
                x: Math.round(x * 100) / 100,
                y: Math.round(y * 100) / 100,
                width: Math.round(width * 100) / 100,
                height: Math.round(height * 100) / 100
            };
        }

        let x, y, width, height;
        const rot = (rotation % 360 + 360) % 360;

        if (rot === 90) {
            x = t / scale;
            y = this.baseHeight - ((l + w) / scale);
            width = h / scale;
            height = w / scale;
        } else if (rot === 180) {
            x = this.baseWidth - ((l + w) / scale);
            y = this.baseHeight - ((t + h) / scale);
            width = w / scale;
            height = h / scale;
        } else if (rot === 270) {
            x = this.baseWidth - ((t + h) / scale);
            y = l / scale;
            width = h / scale;
            height = w / scale;
        } else {
            x = l / scale;
            y = t / scale;
            width = w / scale;
            height = h / scale;
        }

        return {
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            width: Math.round(width * 100) / 100,
            height: Math.round(height * 100) / 100
        };
    }

    /**
     * Normalizes two arbitrary points p1 and p2 into a standard bounding box
     */
    pointsToPdfRect(p1, p2) {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const width = Math.abs(p2.x - p1.x);
        const height = Math.abs(p2.y - p1.y);
        return { x, y, width, height };
    }

    /**
     * Checks if a PDF point is inside a PDF rectangle
     */
    pointInRect(pt, rect, tolerance = 0) {
        return (
            pt.x >= rect.x - tolerance &&
            pt.x <= rect.x + rect.width + tolerance &&
            pt.y >= rect.y - tolerance &&
            pt.y <= rect.y + rect.height + tolerance
        );
    }

    /**
     * Converts a screen pixel movement delta (screenDx, screenDy)
     * to canonical unscaled PDF page movement delta { dx, dy }.
     */
    screenDeltaToPdfDelta(screenDx, screenDy, scale = 1.0, rotation = 0) {
        const s = scale || 1.0;
        const rot = (rotation % 360 + 360) % 360;

        if (rot === 90) {
            return {
                dx: screenDy / s,
                dy: -screenDx / s
            };
        } else if (rot === 180) {
            return {
                dx: -screenDx / s,
                dy: -screenDy / s
            };
        } else if (rot === 270) {
            return {
                dx: -screenDy / s,
                dy: screenDx / s
            };
        }

        return {
            dx: screenDx / s,
            dy: screenDy / s
        };
    }

    /**
     * Distance between two points
     */
    distance(p1, p2) {
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
}

// Export as window global for application-wide access
window.PDFCoordinateSystem = PDFCoordinateSystem;
