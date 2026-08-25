/**
 * SyncPad Document Rendering Model
 * 
 * Canonical Intermediate Representation of documents:
 * Document -> Sections -> Blocks (Paragraphs, Headings, Lists, Tables, Images, Callouts, LaTeX, HR, PageBreaks) -> TextRuns
 * 
 * Serves as the single source of truth for both Editor rendering and Export renderers (PDF, DOCX).
 */

class DocumentModel {
    constructor() {
        this.metadata = {
            title: 'Untitled Document',
            author: 'SyncPad Editor',
            created: new Date().toISOString(),
            pageSize: 'letter', // 8.5in x 11in
            orientation: 'portrait',
            pageWidthPt: 612,   // 8.5 * 72
            pageHeightPt: 792,  // 11 * 72
            margins: {
                top: 54,    // 0.75in
                bottom: 54,
                left: 54,
                right: 54
            },
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSizePt: 11,
            lineHeight: 1.6,
            color: '#1e293b',
            backgroundColor: '#ffffff'
        };

        this.blocks = [];
        this.pages = [];
        this.annotations = [];
    }

    /**
     * Parses the DOM element of the document sheet into the canonical DocumentModel
     * @param {HTMLElement} sheetEl - The #docPageSheet element
     * @param {Object} options - Custom metadata options
     * @returns {DocumentModel}
     */
    static fromDOM(sheetEl, options = {}) {
        const model = new DocumentModel();
        if (!sheetEl) return model;

        model.sourceEl = sheetEl;
        model.metadata.title = options.title || document.getElementById('docTitleInput')?.value || 'Untitled Document';
        model.metadata.author = options.author || 'SyncPad User';

        // Read computed base styles of the sheet
        const sheetComputed = window.getComputedStyle ? window.getComputedStyle(sheetEl) : null;
        if (sheetComputed) {
            model.metadata.fontFamily = sheetComputed.fontFamily || model.metadata.fontFamily;
            model.metadata.color = sheetComputed.color || model.metadata.color;
        }

        // Traverse children of sheetEl
        const nodes = Array.from(sheetEl.childNodes);
        for (const node of nodes) {
            const block = DocumentModel.parseNode(node, sheetEl);
            if (block) {
                if (Array.isArray(block)) {
                    model.blocks.push(...block);
                } else {
                    model.blocks.push(block);
                }
            }
        }

        // Attach annotations if present
        if (typeof docAnnotStrokes !== 'undefined' && docAnnotStrokes && docAnnotStrokes.length > 0) {
            model.annotations = JSON.parse(JSON.stringify(docAnnotStrokes));
        }

        return model;
    }

    /**
     * Parses an individual DOM node into a structured block
     */
    static parseNode(node, rootSheet) {
        if (!node) return null;

        // Ignore text nodes that are just whitespace between blocks
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (!text || text.trim().length === 0) return null;
            return {
                type: 'paragraph',
                align: 'left',
                lineSpacing: 1.5,
                spacingBeforePt: 0,
                spacingAfterPt: 6,
                runs: [{
                    text: text,
                    font: 'Inter, sans-serif',
                    sizePt: 11,
                    weight: 400,
                    bold: false,
                    italic: false,
                    underline: false,
                    strikethrough: false,
                    color: '#1e293b',
                    highlight: null
                }]
            };
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return null;

        const el = node;
        const tagName = el.tagName.toLowerCase();
        const computed = window.getComputedStyle ? window.getComputedStyle(el) : {};

        // 1. Manual Page Break or Page Break Badge
        if (el.classList?.contains('doc-page-break') || el.classList?.contains('page-break') || el.getAttribute?.('data-page-break') === 'true' || el.style?.pageBreakBefore === 'always' || el.style?.pageBreakAfter === 'always' || el.style?.breakBefore === 'page' || el.style?.breakAfter === 'page') {
            return { type: 'pageBreak' };
        }

        // 2. Container Elements (DIV, SECTION, ARTICLE) containing block elements
        if (tagName === 'div' || tagName === 'section' || tagName === 'article') {
            const isSelfCard = el.classList.contains('doc-callout') ||
                el.classList.contains('callout') ||
                el.classList.contains('doc-latex-card') ||
                el.classList.contains('latex-block') ||
                el.classList.contains('doc-code-block') ||
                el.classList.contains('doc-code-card') ||
                el.classList.contains('code-block') ||
                el.classList.contains('doc-checklist-item') ||
                el.classList.contains('pdf-snapshot-embed') ||
                el.classList.contains('pdf-capture-container') ||
                el.classList.contains('doc-pasted-image') ||
                (tagName === 'div' && el.querySelector('img') && !el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre'));

            const hasBlockChildren = el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre, hr, .doc-callout, .doc-page-break, .page-break, .doc-latex-card, .doc-code-block, .doc-code-card');
            if (hasBlockChildren && !isSelfCard) {
                const childBlocks = [];
                for (const child of Array.from(el.childNodes)) {
                    const parsed = DocumentModel.parseNode(child, rootSheet);
                    if (parsed) {
                        if (Array.isArray(parsed)) {
                            childBlocks.push(...parsed);
                        } else {
                            childBlocks.push(parsed);
                        }
                    }
                }
                return childBlocks.length > 0 ? childBlocks : null;
            }
        }

        // 3. Headings (H1 - H6)
        if (/^h[1-6]$/.test(tagName)) {
            const level = parseInt(tagName.substring(1), 10);
            const defaultSizes = { 1: 24, 2: 19, 3: 15, 4: 13, 5: 11, 6: 10 };
            const sizePt = DocumentModel.parsePxToPt(computed.fontSize) || defaultSizes[level] || 16;
            const align = computed.textAlign || 'left';

            return {
                type: 'heading',
                level: level,
                align: align,
                spacingBeforePt: level === 1 ? 16 : 12,
                spacingAfterPt: 6,
                runs: DocumentModel.extractTextRuns(el, {
                    sizePt: sizePt,
                    weight: computed.fontWeight || 700,
                    bold: true,
                    font: computed.fontFamily || 'Inter, sans-serif',
                    color: computed.color || '#0f172a'
                })
            };
        }

        // 3. Code Block / Code Snippet Card
        if (tagName === 'pre' || el.classList.contains('doc-code-block') || el.classList.contains('doc-code-card') || el.classList.contains('code-block') || (tagName === 'div' && el.querySelector('pre'))) {
            const preEl = tagName === 'pre' ? el : el.querySelector('pre');
            const codeEl = preEl ? (preEl.querySelector('code') || preEl) : el;
            const badgeEl = el.querySelector ? (el.querySelector('.badge') || el.querySelector('.pdf-code-lang')) : null;
            let lang = el.getAttribute('data-language') || (codeEl ? codeEl.getAttribute('data-language') : null) || (badgeEl ? badgeEl.textContent.trim() : null) || 'javascript';
            if (lang.toLowerCase() === 'code') lang = 'javascript';
            
            const rawText = codeEl ? (codeEl.innerText || codeEl.textContent || '') : (el.innerText || el.textContent || '');
            return {
                type: 'code',
                language: lang,
                codeText: rawText.replace(/\r\n/g, '\n'),
                spacingBeforePt: 10,
                spacingAfterPt: 10
            };
        }

        // 4. LaTeX Math Card
        if (el.classList.contains('doc-latex-card') || el.classList.contains('latex-block') || el.getAttribute('data-latex') || el.getAttribute('data-latex-source')) {
            const rawCode = el.getAttribute('data-latex-source') || el.getAttribute('data-latex') || el.querySelector('.doc-latex-source')?.value || el.textContent || '';
            const cleanCode = rawCode.trim().replace(/^\\\[|\\\]$/g, '').replace(/^\$\$|\$\$$/g, '');
            
            let renderedHTML = '';
            const mathEl = el.querySelector('.latex-rendered-math') || el.querySelector('.katex') || el.querySelector('.doc-latex-rendered');
            if (mathEl) {
                renderedHTML = mathEl.innerHTML;
            } else if (typeof katex !== 'undefined' && cleanCode) {
                try {
                    renderedHTML = katex.renderToString(cleanCode, { displayMode: true, throwOnError: false });
                } catch (e) {
                    renderedHTML = '';
                }
            }

            const isFloating = el.classList.contains('is-floating') || el.style.position === 'absolute' || el.getAttribute('data-latex-floating') === 'true';
            const leftPx = parseFloat(el.style.left) || parseFloat(el.getAttribute('data-latex-x')) || 0;
            const topPx = parseFloat(el.style.top) || parseFloat(el.getAttribute('data-latex-y')) || 0;
            const sizeStr = el.getAttribute('data-latex-size') || el.style.fontSize || '1.2rem';

            return {
                type: 'latex',
                latexCode: cleanCode,
                isBlock: !isFloating,
                isFloating: isFloating,
                leftPt: Math.round(DocumentModel.parsePxToPt(leftPx)),
                topPt: Math.round(DocumentModel.parsePxToPt(topPx)),
                sizeRem: sizeStr,
                renderedHTML: renderedHTML,
                runs: [{ text: cleanCode, font: 'Cambria Math', sizePt: 12, color: '#0f172a' }]
            };
        }

        // 5. Callout / Notice Box
        if (el.classList.contains('doc-callout') || el.classList.contains('callout') || (computed.borderLeftWidth && parseInt(computed.borderLeftWidth) >= 3 && computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)')) {
            const accentColor = DocumentModel.rgbToHex(computed.borderLeftColor) || '#3b82f6';
            const bgColor = DocumentModel.rgbToHex(computed.backgroundColor) || '#eff6ff';

            const clone = el.cloneNode(true);
            const iconEls = clone.querySelectorAll('i, svg, .doc-callout-icon');
            iconEls.forEach(icon => icon.remove());

            return {
                type: 'callout',
                accentColor: accentColor,
                backgroundColor: bgColor,
                align: computed.textAlign || 'left',
                spacingBeforePt: 8,
                spacingAfterPt: 8,
                runs: DocumentModel.extractTextRuns(clone, {
                    font: computed.fontFamily || 'Inter, sans-serif',
                    color: computed.color || '#1e293b'
                })
            };
        }

        // 6. Blockquote / Quote
        if (tagName === 'blockquote' || el.classList.contains('doc-quote')) {
            return {
                type: 'blockquote',
                align: computed.textAlign || 'left',
                borderLeftColor: DocumentModel.rgbToHex(computed.borderLeftColor) || '#7c3aed',
                spacingBeforePt: 8,
                spacingAfterPt: 8,
                runs: DocumentModel.extractTextRuns(el, {
                    italic: true,
                    font: computed.fontFamily || 'Inter, Georgia, serif',
                    color: computed.color || '#475569'
                })
            };
        }

        // 7. Horizontal Rule
        if (tagName === 'hr' || el.classList.contains('doc-hr')) {
            return {
                type: 'hr',
                color: DocumentModel.rgbToHex(computed.borderColor) || '#e2e8f0',
                thicknessPt: 1,
                spacingBeforePt: 12,
                spacingAfterPt: 12
            };
        }

        // 8. Standalone Checklist Item Box
        // 8. Standalone Checklist Item Box
        if (el.classList.contains('doc-checklist-item') || ((el.querySelector && el.querySelector('input[type="checkbox"], .doc-checklist-checkbox')) && tagName !== 'ul' && tagName !== 'ol')) {
            const checkbox = el.querySelector ? el.querySelector('input[type="checkbox"]') : null;
            const isChecked = el.classList.contains('checked') || el.classList.contains('completed') || el.getAttribute('data-checked') === 'true' || (checkbox && checkbox.checked);

            const textEl = el.querySelector ? el.querySelector('.doc-checklist-text') : null;
            let targetEl = textEl;
            if (!targetEl) {
                const clone = el.cloneNode ? el.cloneNode(true) : el;
                const cbElsInClone = clone.querySelectorAll ? clone.querySelectorAll('.doc-checklist-checkbox, input[type="checkbox"], svg') : [];
                cbElsInClone.forEach(cb => cb.remove());
                targetEl = clone;
            }

            const runs = DocumentModel.extractTextRuns(targetEl, {
                font: computed.fontFamily || 'Inter, sans-serif',
                sizePt: DocumentModel.parsePxToPt(computed.fontSize) || 11,
                color: isChecked ? '#94a3b8' : (computed.color || '#1e293b'),
                strikethrough: isChecked || (targetEl.querySelector && targetEl.querySelector('s, del, strike') !== null)
            });

            return {
                type: 'list',
                listType: 'bullet',
                spacingBeforePt: 3,
                spacingAfterPt: 3,
                items: [{
                    index: 1,
                    isChecklist: true,
                    isChecked: isChecked,
                    runs: runs
                }]
            };
        }

        // 9. Lists (UL, OL)
        if (tagName === 'ul' || tagName === 'ol') {
            const isOrdered = tagName === 'ol';
            const items = [];
            const listItems = el.querySelectorAll ? Array.from(el.querySelectorAll(':scope > li')) : (Array.isArray(el.childNodes) ? el.childNodes.filter(n => n.tagName === 'LI') : []);

            for (let i = 0; i < listItems.length; i++) {
                const li = listItems[i];
                const liComputed = window.getComputedStyle ? window.getComputedStyle(li) : {};
                
                // Check if checklist item
                const checkbox = li.querySelector ? li.querySelector('input[type="checkbox"], .doc-checklist-checkbox') : null;
                const isChecklist = Boolean(checkbox) || li.classList.contains('checklist-item') || li.classList.contains('doc-checklist-item') || el.classList.contains('doc-checklist');
                const isChecked = li.classList.contains('checked') || li.classList.contains('completed') || li.getAttribute('data-checked') === 'true' || (checkbox && checkbox.checked);

                // Check for nested list
                const nestedList = li.querySelector ? li.querySelector('ul, ol') : null;
                let nestedModel = null;
                if (nestedList) {
                    nestedModel = DocumentModel.parseNode(nestedList, rootSheet);
                }

                let textEl = li.querySelector ? li.querySelector('.doc-checklist-text') : null;
                let targetEl = textEl;
                if (!targetEl) {
                    const liClone = li.cloneNode ? li.cloneNode(true) : li;
                    const nestedInClone = liClone.querySelector ? liClone.querySelector('ul, ol') : null;
                    if (nestedInClone) nestedInClone.remove();
                    const cbElsInClone = liClone.querySelectorAll ? liClone.querySelectorAll('.doc-checklist-checkbox, input[type="checkbox"], svg') : [];
                    cbElsInClone.forEach(cb => cb.remove());
                    targetEl = liClone;
                }

                const isStriked = isChecked || li.classList.contains('completed') || (targetEl.querySelector && targetEl.querySelector('s, del, strike') !== null);

                items.push({
                    index: i + 1,
                    isChecklist: isChecklist,
                    isChecked: isChecked,
                    runs: DocumentModel.extractTextRuns(targetEl, {
                        font: liComputed.fontFamily || computed.fontFamily || 'Inter, sans-serif',
                        sizePt: DocumentModel.parsePxToPt(liComputed.fontSize) || 11,
                        color: isStriked ? '#94a3b8' : (liComputed.color || '#1e293b'),
                        strikethrough: isStriked
                    }),
                    nested: nestedModel
                });
            }

            return {
                type: 'list',
                listType: isOrdered ? 'ordered' : 'bullet',
                spacingBeforePt: 4,
                spacingAfterPt: 6,
                items: items
            };
        }

        // 10. Tables
        if (tagName === 'table') {
            const rows = [];
            const trElements = el.querySelectorAll ? Array.from(el.querySelectorAll('tr')) : (Array.isArray(el.childNodes) ? el.childNodes.filter(n => n.tagName === 'TR') : []);
            const colCount = trElements[0] && trElements[0].children ? trElements[0].children.length : 0;

            for (const tr of trElements) {
                const rowCells = [];
                const cellElements = tr.children ? Array.from(tr.children) : (Array.isArray(tr.childNodes) ? tr.childNodes.filter(n => n.nodeType === 1) : []);
                for (const cell of cellElements) {
                    const cellComputed = window.getComputedStyle ? window.getComputedStyle(cell) : {};
                    const isHeader = (cell.tagName || '').toLowerCase() === 'th';
                    const bg = DocumentModel.rgbToHex(cellComputed.backgroundColor);

                    rowCells.push({
                        isHeader: isHeader,
                        colspan: parseInt((cell.getAttribute && cell.getAttribute('colspan')) || '1', 10),
                        rowspan: parseInt((cell.getAttribute && cell.getAttribute('rowspan')) || '1', 10),
                        align: cellComputed.textAlign || 'left',
                        backgroundColor: bg && bg !== '#ffffff' && bg !== 'transparent' ? bg : (isHeader ? '#f8fafc' : null),
                        borderColor: DocumentModel.rgbToHex(cellComputed.borderColor) || '#e2e8f0',
                        borderWidthPt: DocumentModel.parsePxToPt(cellComputed.borderWidth) || 1,
                        paddingPt: DocumentModel.parsePxToPt(cellComputed.paddingTop) || 6,
                        runs: DocumentModel.extractTextRuns(cell, {
                            font: cellComputed.fontFamily || 'Inter, sans-serif',
                            sizePt: DocumentModel.parsePxToPt(cellComputed.fontSize) || 10,
                            bold: isHeader || cellComputed.fontWeight >= 600,
                            color: cellComputed.color || '#1e293b'
                        })
                    });
                }
                rows.push(rowCells);
            }

            return {
                type: 'table',
                colCount: colCount,
                rowCount: rows.length,
                spacingBeforePt: 8,
                spacingAfterPt: 8,
                rows: rows
            };
        }

        // 11. Images / Visual Captures / PDF Snapshots / Figures
        if (tagName === 'img' || el.classList.contains('pdf-snapshot-embed') || el.classList.contains('pdf-capture-container') || el.classList.contains('doc-pasted-image') || tagName === 'figure' || (el.querySelector && el.querySelector('img'))) {
            const img = tagName === 'img' ? el : el.querySelector('img');
            if (img && (img.src || (img.getAttribute && img.getAttribute('src')))) {
                const imgSrc = img.src || img.getAttribute('src');
                const captionEl = el.querySelector ? (el.querySelector('.pdf-capture-caption, figcaption, .pdf-image-caption') || el.querySelector('div[style*="font-size"]')) : null;
                const caption = captionEl ? captionEl.textContent.trim() : (img.alt && img.alt !== 'PDF Snapshot' && img.alt !== 'Image' && img.alt !== 'Pasted Image' ? img.alt : '');
                const widthPx = img.naturalWidth || img.offsetWidth || img.width || 500;
                const heightPx = img.naturalHeight || img.offsetHeight || img.height || 300;

                // Scale to fit page content width (max 480pt)
                const maxPt = 480;
                let widthPt = DocumentModel.parsePxToPt(widthPx) || 420;
                let heightPt = DocumentModel.parsePxToPt(heightPx) || 260;
                if (widthPt > maxPt) {
                    const ratio = maxPt / widthPt;
                    widthPt = maxPt;
                    heightPt = heightPt * ratio;
                }

                const imgBlock = {
                    type: 'image',
                    src: imgSrc,
                    widthPt: Math.round(widthPt),
                    heightPt: Math.round(heightPt),
                    align: computed.textAlign || 'center',
                    caption: caption,
                    borderRadius: parseInt(computed.borderRadius || '4', 10),
                    spacingBeforePt: 12,
                    spacingAfterPt: 12
                };

                // Check if container (like <p>) also contains text outside the image
                if (tagName === 'p' || (tagName === 'div' && !el.classList.contains('pdf-snapshot-embed') && !el.classList.contains('doc-pasted-image'))) {
                    const clone = el.cloneNode(true);
                    const imgInClone = clone.querySelector('img');
                    if (imgInClone) imgInClone.remove();
                    const allCaptions = clone.querySelectorAll('.pdf-capture-caption, figcaption, .pdf-image-caption, div[style*="font-size"]');
                    allCaptions.forEach(c => c.remove());
                    const otherText = clone.textContent.trim();
                    if (otherText.length > 0) {
                        const textRuns = DocumentModel.extractTextRuns(clone, {
                            font: computed.fontFamily || 'Inter, sans-serif',
                            sizePt: DocumentModel.parsePxToPt(computed.fontSize) || 11,
                            color: computed.color || '#1e293b'
                        });
                        if (textRuns.length > 0) {
                            return [
                                imgBlock,
                                {
                                    type: 'paragraph',
                                    align: computed.textAlign || 'left',
                                    lineSpacing: 1.5,
                                    spacingBeforePt: 0,
                                    spacingAfterPt: 6,
                                    runs: textRuns
                                }
                            ];
                        }
                    }
                }

                return imgBlock;
            }
        }

        // 12. Generic Paragraphs & DIV blocks
        const align = computed.textAlign || 'left';
        const lineSpacing = parseFloat(computed.lineHeight) ? parseFloat(computed.lineHeight) / (parseFloat(computed.fontSize) || 16) : 1.5;
        const runs = DocumentModel.extractTextRuns(el, {
            font: computed.fontFamily || 'Inter, sans-serif',
            sizePt: DocumentModel.parsePxToPt(computed.fontSize) || 11,
            color: computed.color || '#1e293b'
        });

        // Skip completely empty paragraphs
        if (runs.length === 0 || (runs.length === 1 && runs[0].text === '')) {
            return {
                type: 'paragraph',
                align: align,
                lineSpacing: 1.5,
                spacingBeforePt: 0,
                spacingAfterPt: 6,
                runs: [{ text: '', font: 'Inter, sans-serif', sizePt: 11, color: '#1e293b' }]
            };
        }

        return {
            type: 'paragraph',
            align: align,
            lineSpacing: Math.min(Math.max(lineSpacing, 1.1), 2.2),
            spacingBeforePt: 0,
            spacingAfterPt: 6,
            runs: runs
        };
    }

    /**
     * Recursively walks element children to extract formatted TextRuns with exact typography
     */
    static extractTextRuns(rootEl, inherited = {}) {
        const runs = [];

        function walk(node, currentStyle) {
            if (node.nodeType === Node.TEXT_NODE) {
                const rawText = node.textContent;
                if (!rawText) return;

                // Ignore whitespace-only indentation nodes (e.g. \n     between HTML tags)
                if (/^\s*$/.test(rawText) && rawText.includes('\n')) {
                    return;
                }

                // Handle text with embedded newlines (e.g. from preformatted text or multiline blocks)
                if (rawText.includes('\n')) {
                    const lines = rawText.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.length > 0) {
                            runs.push({
                                text: line,
                                font: currentStyle.font || 'Inter, sans-serif',
                                sizePt: currentStyle.sizePt || 11,
                                weight: currentStyle.weight || 400,
                                bold: Boolean(currentStyle.bold),
                                italic: Boolean(currentStyle.italic),
                                underline: Boolean(currentStyle.underline),
                                strikethrough: Boolean(currentStyle.strikethrough),
                                color: currentStyle.color || '#1e293b',
                                highlight: currentStyle.highlight || null,
                                href: currentStyle.href || null
                            });
                        }
                        if (i < lines.length - 1 && line.length > 0) {
                            runs.push({
                                text: '\n',
                                isLineBreak: true,
                                font: currentStyle.font || 'Inter, sans-serif'
                            });
                        }
                    }
                } else if (rawText.length > 0) {
                    runs.push({
                        text: rawText,
                        font: currentStyle.font || 'Inter, sans-serif',
                        sizePt: currentStyle.sizePt || 11,
                        weight: currentStyle.weight || 400,
                        bold: Boolean(currentStyle.bold),
                        italic: Boolean(currentStyle.italic),
                        underline: Boolean(currentStyle.underline),
                        strikethrough: Boolean(currentStyle.strikethrough),
                        color: currentStyle.color || '#1e293b',
                        highlight: currentStyle.highlight || null,
                        href: currentStyle.href || null
                    });
                }
                return;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const el = node;
            const tag = el.tagName.toLowerCase();

            // Handle explicit <br> line break tags
            if (tag === 'br') {
                runs.push({
                    text: '\n',
                    isLineBreak: true,
                    font: currentStyle.font || 'Inter, sans-serif'
                });
                return;
            }

            const comp = window.getComputedStyle ? window.getComputedStyle(el) : {};
            const nextStyle = { ...currentStyle };

            // Tag-based styles
            if (tag === 'b' || tag === 'strong' || parseInt(comp.fontWeight || '400') >= 600) nextStyle.bold = true;
            if (tag === 'i' || tag === 'em' || comp.fontStyle === 'italic') nextStyle.italic = true;
            if (tag === 'u' || comp.textDecorationLine?.includes('underline') || comp.textDecoration?.includes('underline')) nextStyle.underline = true;
            if (tag === 's' || tag === 'strike' || tag === 'del' || comp.textDecorationLine?.includes('line-through') || comp.textDecoration?.includes('line-through')) nextStyle.strikethrough = true;
            if (tag === 'mark' || el.classList.contains('highlight') || (comp.backgroundColor && comp.backgroundColor !== 'rgba(0, 0, 0, 0)' && comp.backgroundColor !== 'transparent')) {
                nextStyle.highlight = DocumentModel.rgbToHex(comp.backgroundColor) || '#fef08a';
            }
            if (tag === 'a' && el.href) {
                nextStyle.href = el.href;
                nextStyle.underline = true;
                if (!nextStyle.color || nextStyle.color === currentStyle.color) {
                    nextStyle.color = '#2563eb';
                }
            }
            if (tag === 'code') {
                nextStyle.font = 'JetBrains Mono, Fira Code, monospace';
                nextStyle.sizePt = Math.max((currentStyle.sizePt || 11) - 1, 9);
                nextStyle.highlight = '#f1f5f9';
            }

            // Inline styles
            if (el.style.color) nextStyle.color = DocumentModel.rgbToHex(el.style.color);
            if (el.style.fontSize) nextStyle.sizePt = DocumentModel.parsePxToPt(el.style.fontSize);
            if (el.style.fontFamily) nextStyle.font = el.style.fontFamily;
            if (el.style.fontWeight) nextStyle.bold = parseInt(el.style.fontWeight) >= 600 || el.style.fontWeight === 'bold';

            for (const child of Array.from(el.childNodes)) {
                walk(child, nextStyle);
            }
        }

        walk(rootEl, inherited);

        // Clean up any leading/trailing blank linebreaks
        while (runs.length > 0 && (runs[0].isLineBreak || runs[0].text === '\n' || runs[0].text === '')) {
            runs.shift();
        }
        while (runs.length > 0 && (runs[runs.length - 1].isLineBreak || runs[runs.length - 1].text === '\n' || runs[runs.length - 1].text === '')) {
            runs.pop();
        }

        return runs;
    }

    /**
     * Helper: Converts CSS px string to pt (1px = 0.75pt)
     */
    static parsePxToPt(val) {
        if (!val) return null;
        if (typeof val === 'number') return Math.round(val * 0.75);
        const match = String(val).match(/([0-9.]+)(px|pt|rem|em)?/);
        if (!match) return null;
        const num = parseFloat(match[1]);
        const unit = match[2] || 'px';
        if (unit === 'pt') return Math.round(num);
        if (unit === 'rem' || unit === 'em') return Math.round(num * 16 * 0.75);
        return Math.round(num * 0.75);
    }

    /**
     * Helper: Converts rgb(...) or rgba(...) to #rrggbb
     */
    static rgbToHex(rgbStr) {
        if (!rgbStr) return null;
        if (rgbStr.startsWith('#')) return rgbStr;
        const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return null;
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
}

// Attach to window / globalThis / module.exports
if (typeof window !== 'undefined') {
    window.DocumentModel = DocumentModel;
}
if (typeof globalThis !== 'undefined') {
    globalThis.DocumentModel = DocumentModel;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocumentModel;
}
