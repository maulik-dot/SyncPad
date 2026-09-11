        // =========================================================================
        // COLLABORATIVE DOCUMENT WORKSPACE CONTROLLERS & INTERACTION SYSTEM
        // =========================================================================
        let docLayoutMode = 'pdf-left'; // 'doc-only' | 'pdf-left' | 'pdf-right' | 'pdf-top' | 'pdf-bottom' | 'split-equal'
        let isPdfPanelOpen = true;
        let currentDocComments = [];
        let activeCommentFilter = 'all';
        let selectedAnchorText = '';
        let currentMatches = [];
        let currentMatchIndex = -1;
        let isResizingPanes = false;
        let savedDocRange = null;

        function togglePdfPanel() {
            isPdfPanelOpen = !isPdfPanelOpen;
            const pdfPane = document.getElementById('pdfReferencePane');
            const resizer = document.getElementById('docPaneResizer');
            const btn = document.getElementById('pdfToggleBtn');
            const btnText = document.getElementById('pdfToggleBtnText');
            
            if (isPdfPanelOpen) {
                if (pdfPane) pdfPane.classList.remove('hidden');
                if (resizer) resizer.classList.remove('hidden');
                if (btn) {
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-outline');
                }
                if (btnText) btnText.textContent = 'PDF Reference';
                toast('Reference PDF opened');
            } else {
                if (pdfPane) pdfPane.classList.add('hidden');
                if (resizer) resizer.classList.add('hidden');
                if (btn) {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-outline');
                }
                if (btnText) btnText.textContent = 'Open PDF Reference';
                toast('PDF Reference panel closed');
            }
            refreshIcons();
        }

        function toggleLayoutSwitcher(e) {
            if (e) e.stopPropagation();
            const popover = document.getElementById('layoutSwitcherPopover');
            const willOpen = popover && popover.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen && popover) popover.classList.remove('hidden');
            refreshIcons();
        }

        function setDocLayout(layout) {
            docLayoutMode = layout;
            const container = document.getElementById('docWorkspaceContainer');
            const pdfPane = document.getElementById('pdfReferencePane');
            const resizer = document.getElementById('docPaneResizer');
            if (!container || !pdfPane || !resizer) return;
            
            // Remove previous layout classes
            container.classList.remove('layout-pdf-left', 'layout-pdf-right', 'layout-pdf-top', 'layout-pdf-bottom');

            // Update card active states
            document.querySelectorAll('.layout-choice-card').forEach(card => card.classList.remove('active'));

            if (layout === 'doc-only') {
                pdfPane.classList.add('hidden');
                resizer.classList.add('hidden');
                isPdfPanelOpen = false;
                const btn = document.getElementById('pdfToggleBtn');
                if (btn) {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-outline');
                }
                const btnText = document.getElementById('pdfToggleBtnText');
                if (btnText) btnText.textContent = 'Open PDF Reference';
            } else {
                pdfPane.classList.remove('hidden');
                resizer.classList.remove('hidden');
                isPdfPanelOpen = true;
                const btn = document.getElementById('pdfToggleBtn');
                if (btn) {
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-outline');
                }
                const btnText = document.getElementById('pdfToggleBtnText');
                if (btnText) btnText.textContent = 'PDF Reference';

                if (layout === 'pdf-left') {
                    container.classList.add('layout-pdf-left');
                    pdfPane.style.width = '46%';
                    pdfPane.style.height = '100%';
                } else if (layout === 'pdf-right') {
                    container.classList.add('layout-pdf-right');
                    pdfPane.style.width = '46%';
                    pdfPane.style.height = '100%';
                } else if (layout === 'pdf-top') {
                    container.classList.add('layout-pdf-top');
                    pdfPane.style.width = '100%';
                    pdfPane.style.height = '44%';
                } else if (layout === 'pdf-bottom') {
                    container.classList.add('layout-pdf-bottom');
                    pdfPane.style.width = '100%';
                    pdfPane.style.height = '44%';
                } else if (layout === 'split-equal') {
                    container.classList.add('layout-pdf-left');
                    pdfPane.style.width = '50%';
                    pdfPane.style.height = '100%';
                }
            }

            const popover = document.getElementById('layoutSwitcherPopover');
            if (popover) popover.classList.add('hidden');
            setTimeout(() => {
                if (typeof updatePdfSizeToFitPane === 'function') {
                    updatePdfSizeToFitPane();
                }
            }, 60);
            toast(`Switched layout: ${layout}`);
            refreshIcons();
        }

        function updatePdfSizeToFitPane() {
            if (!isPdfPanelOpen) return;
            if (window.pdfEngine && window.pdfEngine.renderer) {
                const canvasContainer = document.getElementById('pdfCanvasContainer');
                if (canvasContainer && canvasContainer.clientWidth > 100) {
                    const availW = canvasContainer.clientWidth - 48;
                    const baseW = (window.pdfEngine.renderer.coords && window.pdfEngine.renderer.coords.baseWidth) || 595;
                    const newScale = Math.max(0.4, Math.min(2.5, availW / baseW));
                    window.pdfEngine.setZoom(newScale);
                    const levelEl = document.getElementById('pdfZoomLevel');
                    if (levelEl) levelEl.textContent = Math.round(newScale * 100) + '%';
                    pdfZoom = Math.round(newScale * 100);
                }
            }
        }

        // Draggable Split Pane Resizer Engine
        function initPaneResizer() {
            const resizer = document.getElementById('docPaneResizer');
            const container = document.getElementById('docWorkspaceContainer');
            const pdfPane = document.getElementById('pdfReferencePane');
            if (!resizer || !container || !pdfPane) return;

            let startX = 0, startY = 0, startW = 0, startH = 0;
            let rafId = null;
            let lastUpdate = 0;

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isResizingPanes = true;
                resizer.classList.add('dragging');
                document.body.classList.add('is-resizing-split-pane');
                startX = e.clientX;
                startY = e.clientY;
                startW = pdfPane.offsetWidth;
                startH = pdfPane.offsetHeight;

                const onMouseMove = (moveEvent) => {
                    if (!isResizingPanes) return;
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = requestAnimationFrame(() => {
                        const isVertical = container.classList.contains('layout-pdf-top') || container.classList.contains('layout-pdf-bottom');
                        if (isVertical) {
                            const totalH = container.offsetHeight;
                            let deltaY = moveEvent.clientY - startY;
                            if (container.classList.contains('layout-pdf-bottom')) deltaY = -deltaY;
                            let newH = startH + deltaY;
                            let pct = (newH / totalH) * 100;
                            pct = Math.max(20, Math.min(80, pct));
                            pdfPane.style.height = `${pct}%`;
                        } else {
                            const totalW = container.offsetWidth;
                            let deltaX = moveEvent.clientX - startX;
                            if (container.classList.contains('layout-pdf-right')) deltaX = -deltaX;
                            let newW = startW + deltaX;
                            let pct = (newW / totalW) * 100;
                            pct = Math.max(20, Math.min(80, pct));
                            pdfPane.style.width = `${pct}%`;
                        }

                        const now = performance.now();
                        if (now - lastUpdate > 30) {
                            lastUpdate = now;
                            updatePdfSizeToFitPane();
                        }
                    });
                };

                const onMouseUp = () => {
                    isResizingPanes = false;
                    resizer.classList.remove('dragging');
                    document.body.classList.remove('is-resizing-split-pane');
                    if (rafId) cancelAnimationFrame(rafId);
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    updatePdfSizeToFitPane();
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            // Auto-fit observer for container resize
            if (window.ResizeObserver) {
                const resizeObserver = new ResizeObserver(() => {
                    if (!isResizingPanes && isPdfPanelOpen) {
                        updatePdfSizeToFitPane();
                    }
                });
                resizeObserver.observe(pdfPane);
            }
        }

        // Export Document Engine
        function toggleExportDropdown(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('docExportMenu');
            const willOpen = menu && menu.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen && menu) menu.classList.remove('hidden');
            refreshIcons();
        }

        function openDocShareModal() {
            openShareModal();
        }

        function convertHtmlToMarkdown(element) {
            if (!element) return '';
            const clone = element.cloneNode(true);

            // 1. Process LaTeX Cards into $$ equations
            clone.querySelectorAll('.doc-latex-card').forEach(card => {
                const latexCode = card.getAttribute('data-latex') || 
                    (card.querySelector('.latex-source-input') ? card.querySelector('.latex-source-input').value : '') ||
                    (card.querySelector('.katex-mathml annotation') ? card.querySelector('.katex-mathml annotation').textContent : '') ||
                    '';
                const isBlock = card.classList.contains('is-block-mode');
                const mathText = isBlock ? `\n\n$$\n${latexCode.trim()}\n$$\n\n` : ` $${latexCode.trim()}$ `;
                const textNode = document.createTextNode(mathText);
                card.parentNode.replaceChild(textNode, card);
            });

            // 2. Process Checklists
            clone.querySelectorAll('.doc-checklist-item').forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                const isChecked = checkbox && checkbox.checked;
                const text = item.innerText.trim();
                const textNode = document.createTextNode(`\n- [${isChecked ? 'x' : ' '}] ${text}\n`);
                item.parentNode.replaceChild(textNode, item);
            });

            // 3. Process Tables
            clone.querySelectorAll('table').forEach(table => {
                const rows = Array.from(table.querySelectorAll('tr'));
                if (rows.length === 0) return;
                let mdTable = '\n\n';
                rows.forEach((row, rowIndex) => {
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const rowContent = cells.map(c => c.innerText.trim().replace(/\|/g, '\\|')).join(' | ');
                    mdTable += `| ${rowContent} |\n`;
                    if (rowIndex === 0) {
                        const separator = cells.map(() => '---').join(' | ');
                        mdTable += `| ${separator} |\n`;
                    }
                });
                mdTable += '\n';
                const textNode = document.createTextNode(mdTable);
                table.parentNode.replaceChild(textNode, table);
            });

            // 4. Process Images and Captures
            clone.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src') || '';
                const alt = img.getAttribute('alt') || 'Image';
                const textNode = document.createTextNode(`\n\n![${alt}](${src})\n\n`);
                img.parentNode.replaceChild(textNode, img);
            });

            let html = clone.innerHTML;

            // 5. Structure & Headings
            html = html
                .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n# $1\n\n')
                .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n\n')
                .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n')
                .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n\n#### $1\n\n')
                .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n\n##### $1\n\n')
                .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n\n###### $1\n\n');

            // 6. Formatting & Inline Elements
            html = html
                .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (m, p1) => `\n\n> ${p1.trim().replace(/\n+/g, '\n> ')}\n\n`)
                .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n\n```\n$1\n```\n\n')
                .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
                .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
                .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
                .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
                .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
                .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
                .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
                .replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
                .replace(/<u[^>]*>(.*?)<\/u>/gi, '$1')
                .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

            // 7. Lists
            html = html
                .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
                .replace(/<ul[^>]*>(.*?)<\/ul>/gis, '\n$1\n')
                .replace(/<ol[^>]*>(.*?)<\/ol>/gis, '\n$1\n');

            // 8. Paragraphs and breaks
            html = html
                .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n')
                .replace(/<br\s*[\/]?>/gi, '\n')
                .replace(/<hr\s*[\/]?>/gi, '\n\n---\n\n');

            // 9. Strip any remaining tags and entities
            html = html.replace(/<[^>]+>/g, '');
            html = html
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'");

            // 10. Clean up extra whitespace
            return html.replace(/\n{3,}/g, '\n\n').trim();
        }

        function openExportPreview(defaultFormat = 'pdf') {
            closeAllDocMenus();
            if (typeof ExportPreviewModal !== 'undefined') {
                ExportPreviewModal.open(defaultFormat);
            } else {
                exportDoc(defaultFormat);
            }
        }

        async function downloadServerExport(format = 'md') {
            closeAllDocMenus();
            if (!currentDoc || !currentDoc.id) {
                toast('⚠️ Please select or open a document first', 'error');
                return;
            }
            try {
                toast(`⏳ Preparing ${format.toUpperCase()} export...`);
                const authToken = token || localStorage.getItem('syncpad_token');
                const res = await fetch(`/documents/${currentDoc.id}/export?format=${encodeURIComponent(format)}`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                if (!res.ok) {
                    throw new Error(`Server returned ${res.status} ${res.statusText}`);
                }

                let filename = `${currentDoc.title || 'document'}.${format}`;
                const disposition = res.headers.get('Content-Disposition');
                if (disposition && disposition.includes('filename=')) {
                    const match = disposition.match(/filename="?([^";]+)"?/);
                    if (match && match[1]) filename = match[1];
                }

                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast(`✅ Exported "${filename}" successfully!`);
            } catch (err) {
                console.error('Export error:', err);
                toast(`❌ Export failed: ${err.message}`, 'error');
            }
        }

        async function exportDoc(format) {
            closeAllDocMenus();
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;

            const titleInput = document.getElementById('docTitleInput');
            const title = (titleInput ? titleInput.value.trim() : '') || (currentDoc ? currentDoc.title : '') || 'SyncPad_Document';
            const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');

            // 1. Parse canonical DocumentModel from DOM (Single Source of Truth)
            const model = (typeof DocumentModel !== 'undefined')
                ? DocumentModel.fromDOM(sheet, { title: title })
                : null;

            if (format === 'pdf') {
                if (model && typeof PdfExportRenderer !== 'undefined') {
                    toast('📄 Generating high-fidelity PDF...');
                    PdfExportRenderer.exportToPdf(model);
                } else {
                    const oldTitle = document.title;
                    document.title = title;
                    toast('Opening clean print / PDF window...');
                    setTimeout(() => {
                        window.print();
                        document.title = oldTitle;
                    }, 150);
                }
            } else if (format === 'docx') {
                if (model && typeof DocxExportRenderer !== 'undefined') {
                    toast('📄 Generating Word Document (.docx)...');
                    await DocxExportRenderer.exportToDocx(model);
                } else {
                    toast('Exporting Word Document...');
                }
            } else if (format === 'html') {
                if (model && typeof PdfExportRenderer !== 'undefined') {
                    const fullHtml = PdfExportRenderer.renderToHTML(model);
                    downloadBlob(fullHtml, `${sanitizedTitle}.html`, 'text/html;charset=utf-8;');
                    toast(`Exported "${title}.html"`);
                }
            }
        }

        function downloadBlob(content, filename, contentType) {
            const blob = new Blob([content], { type: contentType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
