/**
 * SyncPad High-Fidelity PDF & Print Export Engine
 * 
 * Renders pixel-accurate, typography-rich, paginated output matching the
 * SyncPad document editor (#docPageSheet) 1:1 ditto.
 */

class PdfExportRenderer {
    /**
     * Renders a DocumentModel or DOM sheet into a fully-styled standalone HTML document
     * @param {DocumentModel|HTMLElement} target - DocumentModel instance or #docPageSheet element
     * @param {Object} options 
     * @returns {string} Standalone HTML string
     */
    static renderToHTML(target, options = {}) {
        let contentHTML = '';
        const title = (target && target.metadata && target.metadata.title)
            ? target.metadata.title
            : (document.getElementById('docTitleInput')?.value || 'SyncPad Document');

        // Check if we have direct access to the DOM sheet element
        let sheetEl = null;
        if (target && target.nodeType === Node.ELEMENT_NODE) {
            sheetEl = target;
        } else if (target && target.sourceEl && target.sourceEl.nodeType === Node.ELEMENT_NODE) {
            sheetEl = target.sourceEl;
        } else if (typeof document !== 'undefined') {
            sheetEl = document.getElementById('docPageSheet');
        }

        if (sheetEl && (!options || !options.forceAstRender)) {
            // Render directly from the live sanitized DOM of the document sheet
            contentHTML = PdfExportRenderer.sanitizeSheetDOM(sheetEl);
        } else if (target && target.blocks) {
            // Render from structured DocumentModel AST blocks
            let blocksHTML = '';
            for (const block of target.blocks) {
                blocksHTML += PdfExportRenderer.renderBlock(block);
            }
            contentHTML = blocksHTML;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${PdfExportRenderer.escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <style>
        :root {
            --bg-surface: #ffffff;
            --bg-card: #ffffff;
            --bg-surface-hover: #f8fafc;
            --text-primary: #0f172a;
            --text-secondary: #475569;
            --text-muted: #64748b;
            --border-color: #cbd5e1;
            --accent-primary: #2563eb;
            --icon-doc-bg: #eff6ff;
            --radius-sm: 4px;
            --radius-md: 8px;
            --radius-lg: 12px;
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        @page {
            size: letter portrait;
            margin: 18mm 18mm 18mm 18mm;
        }

        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.65;
            -webkit-font-smoothing: antialiased;
        }

        body {
            padding: 16mm 18mm;
        }

        @media print {
            body {
                padding: 0 !important;
                margin: 0 !important;
                background: #ffffff !important;
            }
            .pdf-export-sheet, .doc-page-sheet {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
            }
        }

        .doc-page-sheet, .pdf-export-sheet {
            width: 100%;
            max-width: 816px;
            margin: 0 auto;
            background: #ffffff;
            padding: 0;
            color: #0f172a;
            font-size: 11pt;
            line-height: 1.65;
            position: relative;
        }

        /* Headings & Typography matching live SyncPad editor 1:1 */
        h1, h2, h3, h4, h5, h6 {
            color: #0f172a;
            font-weight: 700;
            page-break-after: avoid;
            break-after: avoid;
        }

        h1 {
            font-size: 2rem;
            font-weight: 700;
            line-height: 1.3;
            margin: 1.25rem 0 0.75rem 0;
            color: #0f172a;
        }

        h1:first-child {
            margin-top: 0;
        }

        h2 {
            font-size: 1.5rem;
            font-weight: 600;
            line-height: 1.35;
            margin: 1.2rem 0 0.5rem 0;
            color: #0f172a;
        }

        h3 {
            font-size: 1.2rem;
            font-weight: 600;
            line-height: 1.4;
            margin: 1rem 0 0.4rem 0;
            color: #0f172a;
        }

        h4 {
            font-size: 1.05rem;
            font-weight: 600;
            line-height: 1.4;
            margin: 0.9rem 0 0.35rem 0;
            color: #0f172a;
        }

        p {
            margin: 0 0 0.85rem 0;
            color: inherit;
            line-height: 1.65;
            text-rendering: optimizeLegibility;
        }

        p:last-child {
            margin-bottom: 0;
        }

        /* Links */
        a {
            color: #2563eb;
            text-decoration: underline;
        }

        /* Inline Code */
        code {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.88em;
            background-color: #f1f5f9;
            padding: 1.5px 4px;
            border-radius: 3px;
            color: #0f172a;
            border: 1px solid #e2e8f0;
        }

        /* Lists */
        ul, ol {
            margin: 0.65rem 0 0.85rem 0;
            padding-left: 1.75rem;
        }

        li {
            margin-bottom: 0.35rem;
            line-height: 1.65;
        }

        /* Authentic Interactive Checklist matching SyncPad editor */
        .doc-checklist {
            list-style: none !important;
            padding-left: 0 !important;
            margin: 0.65rem 0 !important;
            display: block !important;
        }

        .doc-checklist-item {
            display: block !important;
            position: relative !important;
            padding-left: 28px !important;
            margin: 0 0 0.4rem 0 !important;
            line-height: 1.6 !important;
            font-size: 0.95rem !important;
            color: #0f172a !important;
            min-height: 22px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
        }

        .doc-checklist-checkbox {
            position: absolute !important;
            left: 0 !important;
            top: 2px !important;
            width: 18px !important;
            height: 18px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 4px !important;
        }

        .checkbox-tick-svg {
            width: 18px !important;
            height: 18px !important;
            display: block !important;
        }

        .checkbox-box {
            fill: #ffffff !important;
            stroke: #cbd5e1 !important;
            stroke-width: 1.5 !important;
        }

        .checkbox-mark {
            stroke: #ffffff !important;
            stroke-dasharray: 16 !important;
            stroke-dashoffset: 16 !important;
        }

        .doc-checklist-item.checked .checkbox-box,
        .doc-checklist-item[data-checked="true"] .checkbox-box {
            fill: #7c3aed !important;
            stroke: #7c3aed !important;
        }

        .doc-checklist-item.checked .checkbox-mark,
        .doc-checklist-item[data-checked="true"] .checkbox-mark {
            stroke-dashoffset: 0 !important;
        }

        .doc-checklist-text {
            display: block !important;
            width: 100% !important;
            line-height: 1.6 !important;
            color: inherit !important;
            word-break: break-word !important;
        }

        .doc-checklist-item.checked .doc-checklist-text,
        .doc-checklist-item[data-checked="true"] .doc-checklist-text {
            text-decoration: line-through !important;
            text-decoration-color: #8b5cf6 !important;
            text-decoration-thickness: 1.5px !important;
            color: #94a3b8 !important;
            opacity: 0.7 !important;
        }

        /* Callout Notes */
        .doc-callout {
            position: relative !important;
            display: block !important;
            border-left: 4px solid #2563eb !important;
            background: #eff6ff !important;
            border-radius: 0 6px 6px 0 !important;
            padding: 0.85rem 1.15rem 0.85rem 3rem !important;
            margin: 1.25rem 0 !important;
            font-size: 0.92rem !important;
            color: #1e3a8a !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
        }

        .doc-callout > i,
        .doc-callout > svg,
        .doc-callout > .doc-callout-icon {
            position: absolute !important;
            left: 1rem !important;
            top: 0.85rem !important;
            width: 20px !important;
            height: 20px !important;
            color: #2563eb !important;
        }

        .doc-callout > div,
        .doc-callout > p,
        .doc-callout > .doc-callout-content {
            display: block !important;
            width: 100% !important;
            line-height: 1.6 !important;
            color: inherit !important;
        }

        /* Code Cards */
        .doc-code-card {
            margin: 1.25rem 0 !important;
            background: #0f172a !important;
            border: 1px solid #1e293b !important;
            border-radius: 8px !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1) !important;
        }

        .doc-code-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 0.5rem 0.85rem !important;
            background: #1e293b !important;
            border-bottom: 1px solid #334155 !important;
            font-size: 0.75rem !important;
            color: #94a3b8 !important;
        }

        .doc-code-content {
            padding: 0.85rem 1rem !important;
            background: #0f172a !important;
        }

        .doc-code-content pre, pre {
            margin: 0 !important;
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace !important;
            font-size: 0.85rem !important;
            line-height: 1.55 !important;
            color: #f8fafc !important;
            white-space: pre-wrap !important;
            word-break: normal !important;
            overflow-wrap: break-word !important;
        }

        .doc-code-content code, code {
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace !important;
            font-size: 0.85rem !important;
            color: inherit !important;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
        }

        /* Tables */
        .doc-table, table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 1.25rem 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            font-size: 0.92rem !important;
        }

        .doc-table th, table th {
            background: #f8fafc !important;
            font-weight: 600 !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            padding: 0.6rem 0.85rem !important;
            text-align: left !important;
        }

        .doc-table td, table td {
            border: 1px solid #cbd5e1 !important;
            padding: 0.6rem 0.85rem !important;
            color: #0f172a !important;
            text-align: left !important;
        }

        /* LaTeX Math Equations */
        .doc-latex-card {
            position: relative !important;
            margin: 1.25rem 0 !important;
            text-align: center !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }

        .doc-latex-card.is-floating {
            position: absolute !important;
            margin: 0 !important;
            z-index: 10 !important;
        }

        .latex-rendered-math {
            display: block !important;
            text-align: center !important;
        }

        .latex-placeholder-text, .latex-hover-trigger, .latex-resizer, .latex-drag-handle, .latex-quick-edit-pill, .latex-equation-resize-handle {
            display: none !important;
        }

        /* Images & PDF Snapshots */
        .pdf-snapshot-embed, .pdf-capture-container, .doc-pasted-image, figure {
            margin: 1.25rem 0 !important;
            text-align: center !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .pdf-snapshot-embed img, .pdf-capture-container img, .doc-pasted-image img, img {
            max-width: 100% !important;
            height: auto !important;
            border-radius: 6px !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
            display: inline-block !important;
        }

        .pdf-image-caption {
            font-size: 0.75rem !important;
            color: #64748b !important;
            margin-top: 0.4rem !important;
            font-weight: 500 !important;
            text-align: center !important;
        }

        /* Blockquotes */
        blockquote {
            margin: 1.25rem 0 !important;
            padding: 0.65rem 1rem !important;
            border-left: 3.5px solid #7c3aed !important;
            background: #f8fafc !important;
            color: #475569 !important;
            font-style: italic !important;
            border-radius: 0 4px 4px 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        /* Dividers & Page Breaks */
        hr {
            border: none !important;
            border-top: 1px solid #e2e8f0 !important;
            margin: 1.5rem 0 !important;
        }

        .pdf-page-break {
            page-break-before: always;
            break-before: page;
            height: 0;
            margin: 0;
            border: none;
        }
    </style>
</head>
<body>
    <div class="doc-page-sheet pdf-export-sheet">
        ${contentHTML}
    </div>
</body>
</html>`;
    }

    /**
     * Sanitizes and extracts the inner HTML of the document sheet
     */
    static sanitizeSheetDOM(sheetEl) {
        if (!sheetEl) return '';
        const clone = sheetEl.cloneNode(true);

        // 1. Remove editor attributes
        clone.removeAttribute('contenteditable');
        clone.removeAttribute('spellcheck');
        clone.removeAttribute('oninput');
        clone.removeAttribute('id');

        clone.querySelectorAll('[contenteditable]').forEach(el => {
            el.removeAttribute('contenteditable');
            el.removeAttribute('spellcheck');
        });

        // 2. Remove editor-only transient UI controls
        clone.querySelectorAll('.latex-placeholder-text, .latex-hover-trigger, .latex-resizer, .latex-drag-handle, .latex-quick-edit-pill, .latex-equation-resize-handle, .comment-anchor, .mention-tag-menu, .active-cursor, .selection-highlight, .doc-cursor').forEach(el => el.remove());

        // 3. Ensure LaTeX math cards have compiled KaTeX math
        clone.querySelectorAll('.doc-latex-card').forEach(card => {
            const mathWrap = card.querySelector('.latex-rendered-math');
            const source = card.getAttribute('data-latex-source');
            if ((!mathWrap || !mathWrap.innerHTML.trim()) && source && typeof katex !== 'undefined') {
                try {
                    const rendered = katex.renderToString(source, { displayMode: true, throwOnError: false });
                    if (mathWrap) {
                        mathWrap.innerHTML = rendered;
                    } else {
                        const newWrap = document.createElement('div');
                        newWrap.className = 'latex-rendered-math';
                        newWrap.innerHTML = rendered;
                        card.appendChild(newWrap);
                    }
                } catch (e) {}
            }
        });

        // 4. Ensure checklists have checkbox SVG if missing
        clone.querySelectorAll('.doc-checklist-item').forEach(item => {
            const isChecked = item.classList.contains('checked') || item.getAttribute('data-checked') === 'true';
            if (isChecked) {
                item.classList.add('checked');
                item.setAttribute('data-checked', 'true');
            }
            const checkbox = item.querySelector('.doc-checklist-checkbox');
            if (checkbox && !checkbox.querySelector('svg')) {
                checkbox.innerHTML = `<svg class="checkbox-tick-svg" viewBox="0 0 16 16"><rect class="checkbox-box" x="1" y="1" width="14" height="14" rx="3.5" ry="3.5"></rect><path class="checkbox-mark" d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
            }
        });

        return clone.innerHTML;
    }

    /**
     * Renders an individual DocumentModel block into HTML
     */
    static renderBlock(block) {
        if (!block) return '';

        switch (block.type) {
            case 'pageBreak':
                return '<div class="pdf-page-break"></div>';

            case 'code': {
                const lang = (block.language || 'CODE').toUpperCase();
                const codeText = PdfExportRenderer.escapeHtml(block.codeText || '');
                return `<div class="doc-code-card">
                    <div class="doc-code-header">
                        <span>Code Snippet</span>
                        <span style="background:#334155;color:#cbd5e1;font-size:0.65rem;padding:2px 6px;border-radius:4px;">${PdfExportRenderer.escapeHtml(lang)}</span>
                    </div>
                    <div class="doc-code-content">
                        <pre><code>${codeText}</code></pre>
                    </div>
                </div>`;
            }

            case 'heading': {
                const tag = `h${block.level || 1}`;
                const runsHTML = PdfExportRenderer.renderRuns(block.runs);
                const alignStyle = block.align && block.align !== 'left' ? ` style="text-align: ${block.align};"` : '';
                return `<${tag}${alignStyle}>${runsHTML}</${tag}>`;
            }

            case 'paragraph': {
                const runsHTML = PdfExportRenderer.renderRuns(block.runs);
                const alignStyle = block.align && block.align !== 'left' ? ` style="text-align: ${block.align};"` : '';
                return `<p${alignStyle}>${runsHTML || '&nbsp;'}</p>`;
            }

            case 'list': {
                const isAnyChecklist = (block.items || []).some(item => item.isChecklist);
                let itemsHTML = '';
                for (const item of block.items || []) {
                    const runsHTML = PdfExportRenderer.renderRuns(item.runs);
                    if (item.isChecklist) {
                        const isChecked = Boolean(item.isChecked);
                        const checkedClass = isChecked ? 'checked' : '';
                        itemsHTML += `<li class="doc-checklist-item ${checkedClass}" data-checked="${isChecked ? 'true' : 'false'}">
                            <span class="doc-checklist-checkbox">
                                <svg class="checkbox-tick-svg" viewBox="0 0 16 16">
                                    <rect class="checkbox-box" x="1" y="1" width="14" height="14" rx="3.5" ry="3.5"></rect>
                                    <path class="checkbox-mark" d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                                </svg>
                            </span>
                            <span class="doc-checklist-text">${runsHTML}</span>
                        </li>`;
                    } else {
                        itemsHTML += `<li>${runsHTML}`;
                        if (item.nested) {
                            itemsHTML += PdfExportRenderer.renderBlock(item.nested);
                        }
                        itemsHTML += `</li>`;
                    }
                }
                if (isAnyChecklist) {
                    return `<ul class="doc-checklist">${itemsHTML}</ul>`;
                }
                const tag = block.listType === 'ordered' ? 'ol' : 'ul';
                return `<${tag}>${itemsHTML}</${tag}>`;
            }

            case 'table': {
                let tableHTML = '<table class="doc-table"><tbody>';
                for (const row of block.rows || []) {
                    tableHTML += '<tr>';
                    for (const cell of row) {
                        const cellTag = cell.isHeader ? 'th' : 'td';
                        const runsHTML = PdfExportRenderer.renderRuns(cell.runs);
                        let cellStyle = '';
                        if (cell.backgroundColor) cellStyle += `background-color: ${cell.backgroundColor};`;
                        if (cell.align && cell.align !== 'left') cellStyle += `text-align: ${cell.align};`;
                        const styleAttr = cellStyle ? ` style="${cellStyle}"` : '';
                        const colspanAttr = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '';
                        const rowspanAttr = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '';
                        tableHTML += `<${cellTag}${colspanAttr}${rowspanAttr}${styleAttr}>${runsHTML || '&nbsp;'}</${cellTag}>`;
                    }
                    tableHTML += '</tr>';
                }
                tableHTML += '</tbody></table>';
                return tableHTML;
            }

            case 'image': {
                const alignStyle = block.align ? ` style="text-align: ${block.align};"` : ' style="text-align: center;"';
                const captionHTML = block.caption ? `<div class="pdf-image-caption">${PdfExportRenderer.escapeHtml(block.caption)}</div>` : '';
                return `<div class="pdf-snapshot-embed"${alignStyle}><img src="${block.src}" alt="${PdfExportRenderer.escapeHtml(block.caption || 'Image')}">${captionHTML}</div>`;
            }

            case 'callout': {
                const runsHTML = PdfExportRenderer.renderRuns(block.runs);
                const accent = block.accentColor || '#2563eb';
                const borderStyle = block.accentColor ? `border-left-color: ${block.accentColor} !important;` : '';
                const bgStyle = block.backgroundColor ? `background-color: ${block.backgroundColor} !important;` : '';
                const styleAttr = (borderStyle || bgStyle) ? ` style="${borderStyle} ${bgStyle}"` : '';
                return `<div class="doc-callout"${styleAttr}>
                    <svg class="doc-callout-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <div class="doc-callout-content">${runsHTML}</div>
                </div>`;
            }

            case 'blockquote': {
                const runsHTML = PdfExportRenderer.renderRuns(block.runs);
                return `<blockquote>${runsHTML}</blockquote>`;
            }

            case 'latex': {
                let mathHtml = block.renderedHTML || '';
                if (!mathHtml && typeof katex !== 'undefined' && block.latexCode) {
                    try {
                        mathHtml = katex.renderToString(block.latexCode, { displayMode: true, throwOnError: false });
                    } catch (e) {}
                }
                if (!mathHtml) {
                    mathHtml = `<span class="katex-fallback" style="font-family:'Cambria Math', 'Times New Roman', serif; font-size:1.15em; font-style:italic;">${PdfExportRenderer.escapeHtml(block.latexCode || '')}</span>`;
                }

                if (block.isFloating) {
                    const sizeStyle = block.sizeRem ? `font-size: ${block.sizeRem};` : '';
                    return `<div class="doc-latex-card is-floating" style="position: absolute; left: ${block.leftPt}pt; top: ${block.topPt}pt; ${sizeStyle} z-index: 10; background: transparent; border: none; box-shadow: none;"><div class="latex-rendered-math">${mathHtml}</div></div>`;
                }

                return `<div class="doc-latex-card"><div class="latex-rendered-math">${mathHtml}</div></div>`;
            }

            case 'hr':
                return '<hr>';

            default:
                return '';
        }
    }

    /**
     * Renders formatted TextRuns into HTML string with styling
     */
    static renderRuns(runs) {
        if (!runs || runs.length === 0) return '';
        let html = '';

        for (const run of runs) {
            if (run.isLineBreak || run.text === '\n') {
                html += '<br/>';
                continue;
            }

            let runText = PdfExportRenderer.escapeHtml(run.text || '');
            if (!runText) continue;

            let openTags = '';
            let closeTags = '';
            let styles = [];

            if (run.bold) { openTags += '<strong>'; closeTags = '</strong>' + closeTags; }
            if (run.italic) { openTags += '<em>'; closeTags = '</em>' + closeTags; }
            if (run.underline) { openTags += '<u>'; closeTags = '</u>' + closeTags; }
            if (run.strikethrough) { openTags += '<s>'; closeTags = '</s>' + closeTags; }
            if (run.highlight) { openTags += `<mark style="background-color: ${run.highlight}; padding: 0 2pt; border-radius: 2pt;">`; closeTags = '</mark>' + closeTags; }

            if (run.color && run.color !== '#1e293b' && run.color !== '#0f172a') {
                styles.push(`color: ${run.color};`);
            }
            if (run.font && !run.font.includes('Inter') && !run.font.includes('system-ui')) {
                styles.push(`font-family: ${run.font};`);
            }
            if (run.sizePt && run.sizePt !== 11) {
                styles.push(`font-size: ${run.sizePt}pt;`);
            }

            let styleAttr = styles.length > 0 ? ` style="${styles.join(' ')}"` : '';
            let result = `${openTags}<span${styleAttr}>${runText}</span>${closeTags}`;

            if (run.href) {
                result = `<a href="${PdfExportRenderer.escapeHtml(run.href)}" target="_blank">${result}</a>`;
            }

            html += result;
        }

        return html;
    }

    /**
     * High-fidelity vector PDF print dispatch using an isolated iframe
     */
    static exportToPdf(modelOrSheet) {
        const fullHTML = PdfExportRenderer.renderToHTML(modelOrSheet);

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '-9999px';
        iframe.style.width = '1024px';
        iframe.style.height = '768px';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(fullHTML);
        doc.close();

        let printed = false;
        const triggerPrint = () => {
            if (printed) return;
            printed = true;
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => {
                if (iframe.parentNode) document.body.removeChild(iframe);
            }, 3000);
        };

        const checkReady = () => {
            const fontPromise = (doc.fonts && doc.fonts.ready)
                ? doc.fonts.ready.catch(() => {})
                : Promise.resolve();

            const imgElements = Array.from(doc.images || []);
            const imgPromises = imgElements.map(img => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                if (img.decode) {
                    return img.decode().catch(() => Promise.resolve());
                }
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                    setTimeout(resolve, 2000);
                });
            });

            Promise.all([fontPromise, ...imgPromises]).then(() => {
                setTimeout(triggerPrint, 300);
            }).catch(() => {
                setTimeout(triggerPrint, 450);
            });
        };

        if (doc.readyState === 'complete') {
            checkReady();
        } else {
            iframe.onload = checkReady;
            setTimeout(checkReady, 750);
        }
    }

    static escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Attach to window / globalThis / module.exports
if (typeof window !== 'undefined') {
    window.PdfExportRenderer = PdfExportRenderer;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PdfExportRenderer = PdfExportRenderer;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PdfExportRenderer;
}
