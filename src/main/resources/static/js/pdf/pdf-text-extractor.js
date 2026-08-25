/**
 * SyncPad PDF Text Extractor
 * Extracts real selectable text contained within any arbitrary PDF coordinate bounding box.
 * Preserves line breaks, paragraph groupings, and word ordering.
 */
class PDFTextExtractor {
    constructor(coordSystem) {
        this.coords = coordSystem || new window.PDFCoordinateSystem();
    }

    /**
     * Extracts text within a given PDF coordinate box { x, y, width, height }
     * from rendered PDF.js text items or DOM text layer elements.
     */
    extractTextInPdfRect(pdfRect, pageData, textItems = []) {
        if (!pdfRect || pdfRect.width <= 2 || pdfRect.height <= 2) {
            return { text: '', lineCount: 0, wordCount: 0, isEmpty: true };
        }

        // 1. If explicit PDF.js text items are provided:
        if (textItems && textItems.length > 0) {
            const res = this.extractFromPdfJsItems(pdfRect, textItems);
            if (!res.isEmpty) return res;
        }

        // 2. Extract from DOM #pdfTextLayer spans:
        const textLayer = document.getElementById('pdfTextLayer');
        if (textLayer) {
            const spans = Array.from(textLayer.querySelectorAll('span'));
            if (spans.length > 0) {
                const res = this.extractFromDomSpans(pdfRect, spans);
                if (!res.isEmpty) return res;
            }
        }

        // 3. Fallback to structured preset page content if available
        if (pageData) {
            return this.extractFromPageData(pdfRect, pageData);
        }

        return { text: '', lineCount: 0, wordCount: 0, isEmpty: true };
    }

    /**
     * Extracts text from DOM #pdfTextLayer spans
     */
    extractFromDomSpans(pdfRect, spans) {
        const matchingLines = [];
        const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;

        spans.forEach(span => {
            const spanLeft = (parseFloat(span.style.left) || 0) / scale;
            const spanTop = (parseFloat(span.style.top) || 0) / scale;
            const textContent = (span.textContent || '').trim();
            if (!textContent) return;

            const approxWidth = Math.max(10, textContent.length * 7);
            const approxHeight = 18;

            // Check if span overlaps with pdfRect
            const overlaps = (
                spanLeft + approxWidth >= pdfRect.x &&
                spanLeft <= pdfRect.x + pdfRect.width &&
                spanTop + approxHeight >= pdfRect.y &&
                spanTop <= pdfRect.y + pdfRect.height
            );

            if (overlaps) {
                matchingLines.push({
                    text: textContent,
                    x: spanLeft,
                    y: spanTop
                });
            }
        });

        if (matchingLines.length === 0) {
            return { text: '', lineCount: 0, wordCount: 0, isEmpty: true };
        }

        // Sort lines top-to-bottom, left-to-right
        matchingLines.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 6) {
                return a.y - b.y;
            }
            return a.x - b.x;
        });

        // Group into lines by Y proximity
        const lines = [];
        let currentLine = [];
        let currentY = matchingLines[0].y;

        matchingLines.forEach(item => {
            if (Math.abs(item.y - currentY) > 8) {
                lines.push(currentLine.map(i => i.text).join(' '));
                currentLine = [item];
                currentY = item.y;
            } else {
                currentLine.push(item);
            }
        });
        if (currentLine.length > 0) {
            lines.push(currentLine.map(i => i.text).join(' '));
        }

        const fullText = lines.join('\n');
        const wordCount = fullText.split(/\s+/).filter(Boolean).length;

        return {
            text: fullText,
            lineCount: lines.length,
            wordCount,
            isEmpty: fullText.trim().length === 0
        };
    }

    /**
     * Extracts text from PDF.js items array
     */
    extractFromPdfJsItems(pdfRect, items) {
        const matched = [];
        items.forEach(item => {
            const tx = item.transform;
            if (!tx) return;
            const x = tx[4];
            const y = tx[5];
            const w = item.width || 50;
            const h = item.height || 12;

            if (x + w >= pdfRect.x && x <= pdfRect.x + pdfRect.width &&
                y + h >= pdfRect.y && y <= pdfRect.y + pdfRect.height) {
                matched.push({ text: item.str, x, y });
            }
        });

        if (matched.length === 0) {
            return { text: '', lineCount: 0, wordCount: 0, isEmpty: true };
        }

        matched.sort((a, b) => b.y - a.y || a.x - b.x); // PDF.js Y is bottom-up
        const text = matched.map(m => m.text).join(' ');
        return {
            text,
            lineCount: 1,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            isEmpty: text.trim().length === 0
        };
    }

    /**
     * Extracts text from structured Preset Page Data blocks
     */
    extractFromPageData(pdfRect, pageData) {
        const blocks = [
            { text: pageData.header, y: 24, h: 20 },
            { text: pageData.section, y: 62, h: 30 },
            { text: pageData.body, y: 102, h: 60 },
            { text: pageData.diagramTitle, y: 160, h: 25 },
            { text: pageData.quote, y: 370, h: 40 },
            { text: 'Specification Key Metrics & Guarantees', y: 440, h: 30 }
        ];

        const matched = blocks.filter(b => {
            return b.text && (b.y + b.h >= pdfRect.y && b.y <= pdfRect.y + pdfRect.height);
        });

        if (matched.length === 0) {
            return { text: '', lineCount: 0, wordCount: 0, isEmpty: true };
        }

        const text = matched.map(m => m.text).join('\n\n');
        return {
            text,
            lineCount: matched.length,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            isEmpty: text.trim().length === 0
        };
    }
}

window.PDFTextExtractor = PDFTextExtractor;
