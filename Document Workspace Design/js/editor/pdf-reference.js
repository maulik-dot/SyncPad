        // ==========================================
        let currentPdfDoc = null;
        let currentPdfPage = 1;
        let totalPdfPages = 3;
        let pdfZoom = 125;
        let pdfRotation = 0;
        let isRenderingPdf = false;
        let pendingPdfPage = null;
        let currentPdfDataUrl = null;
        let currentPdfFileName = 'RFC-7629-Architecture.pdf';
        let currentPdfPresetKey = 'rfc-7629';
        let isPdfCaptureActive = false;

        // Rich Multi-Page Preset Reference Library
        const PRESET_PDF_LIBRARY = {
            'rfc-7629': {
                name: 'RFC-7629-Architecture.pdf',
                title: 'RFC-7629 Collaborative Architecture Standards',
                totalPages: 3,
                pages: [
                    {
                        header: 'RFC-7629 Collaborative Architecture Standards • Page 1 of 3',
                        section: 'Section 1.0: Real-Time Full-Duplex Transport',
                        body: 'Distributed document editing systems require sub-50ms propagation of document mutation deltas. The message exchange protocol operates over full-duplex STOMP channels subscribed to destination endpoints.',
                        quote: 'Vector timestamps V_i(d) establish causality preservation. When concurrent edits conflict, operational transformation preserves convergence without data loss.',
                        diagramType: 'stomp-pipeline',
                        diagramTitle: 'Figure 1.1: Bi-directional STOMP Broker & Client Relay'
                    },
                    {
                        header: 'RFC-7629 Collaborative Architecture Standards • Page 2 of 3',
                        section: 'Section 2.0: Operational Transformation Conflict Engine',
                        body: 'Transform functions T(op1, op2) ensure intention preservation across concurrent client mutations. When two users type simultaneously at index k, the state vector offsets the subsequent insertion index by delta length.',
                        quote: 'Convergence Rule: For any two concurrent operations O_a and O_b, T(O_a, O_b) ∘ O_b ≡ T(O_b, O_a) ∘ O_a.',
                        diagramType: 'ot-matrix',
                        diagramTitle: 'Figure 2.1: Operational Transformation Convergence Matrix'
                    },
                    {
                        header: 'RFC-7629 Collaborative Architecture Standards • Page 3 of 3',
                        section: 'Section 3.0: High-Precision Caret & Presence Broadcast',
                        body: 'Collaborative caret tracking broadcasts relative coordinates { left, top, height } over websocket topics. Remote clients render colored carets and name flag badges with smooth interpolation.',
                        quote: 'Presence beacons refresh every 10 seconds; collaborators inactive for >30 seconds transition to idle state.',
                        diagramType: 'presence-flow',
                        diagramTitle: 'Figure 3.1: Caret Coordinate Tracking & Broadcast Engine'
                    }
                ]
            },
            'distributed-systems': {
                name: 'Distributed-Systems-OT-Spec.pdf',
                title: 'Distributed Systems & Real-Time Sync Protocol',
                totalPages: 4,
                pages: [
                    {
                        header: 'Distributed Systems Whitepaper • Page 1 of 4',
                        section: 'Section 1.1: Consensus & Eventual Consistency',
                        body: 'Multi-master collaborative editors employ hybrid consensus mechanisms combining lightweight pub/sub message brokers with server-side document snapshot versioning.',
                        quote: 'Eventual consistency guarantees that all replicas converge to identical state once all operations are applied.',
                        diagramType: 'consensus-ring',
                        diagramTitle: 'Figure 1.1: Hybrid Consensus & Snapshot Storage Pipeline'
                    },
                    {
                        header: 'Distributed Systems Whitepaper • Page 2 of 4',
                        section: 'Section 2.2: CRDT vs Operational Transformation',
                        body: 'State-based CRDTs require monotonically growing tombstones, whereas Operational Transformation provides compact payload transmission with deterministic server-side serialization.',
                        quote: 'SyncPad utilizes optimized OT message deltas to minimize websocket bandwidth overhead under high network latency.',
                        diagramType: 'ot-matrix',
                        diagramTitle: 'Figure 2.1: CRDT vs OT Bandwidth & Memory Comparison'
                    },
                    {
                        header: 'Distributed Systems Whitepaper • Page 3 of 4',
                        section: 'Section 3.3: Network Partition Handling & Reconnection',
                        body: 'Upon network disconnect, clients buffer local mutation queues. On reconnect, the synchronization handshake computes the version delta and reconciles diverged branches.',
                        quote: 'Automatic backoff reconnection algorithm: interval = min(10000, 500 * 2^retryCount) with jitter.',
                        diagramType: 'stomp-pipeline',
                        diagramTitle: 'Figure 3.1: Offline Buffer & Reconnection Pipeline'
                    },
                    {
                        header: 'Distributed Systems Whitepaper • Page 4 of 4',
                        section: 'Section 4.0: Benchmarks & Latency Profiling',
                        body: 'End-to-end delta propagation benchmarks demonstrate 12ms average latency across 50 concurrent simulated users on standard Spring Boot WebSocket nodes.',
                        quote: 'p99 Latency: 24ms • Memory overhead per document session: 140KB.',
                        diagramType: 'presence-flow',
                        diagramTitle: 'Figure 4.1: Benchmark Throughput & Latency Distributions'
                    }
                ]
            },
            'postgres-internals': {
                name: 'PostgreSQL-Storage-Engine.pdf',
                title: 'PostgreSQL Storage Engine & MVCC Internals',
                totalPages: 3,
                pages: [
                    {
                        header: 'PostgreSQL Engine Architecture Guide • Page 1 of 3',
                        section: 'Chapter 1: Multi-Version Concurrency Control (MVCC)',
                        body: 'PostgreSQL implements snapshot isolation using row-level xmin and xmax transaction headers. Readers do not block writers, and writers do not block readers.',
                        quote: 'Tuples remain on heap pages until VACUUM reclaims dead rows not visible to any active transaction snapshot.',
                        diagramType: 'consensus-ring',
                        diagramTitle: 'Figure 1.1: PostgreSQL Heap Tuple Header & Visibility Check'
                    },
                    {
                        header: 'PostgreSQL Engine Architecture Guide • Page 2 of 3',
                        section: 'Chapter 2: Shared Buffer Pool & Clock Sweep',
                        body: 'The shared buffer pool caches 8KB disk pages in RAM. Page replacement uses a clock-sweep algorithm tracking usage counters to balance cached hot working sets.',
                        quote: 'Dirty pages are flushed asynchronously by the background writer and checkpoint process.',
                        diagramType: 'ot-matrix',
                        diagramTitle: 'Figure 2.1: Shared Buffers & Disk Page Swapping Architecture'
                    },
                    {
                        header: 'PostgreSQL Engine Architecture Guide • Page 3 of 3',
                        section: 'Chapter 3: Write-Ahead Logging (WAL) & Crash Recovery',
                        body: 'All database mutations are appended sequentially to WAL segments before dirty pages are written to tablespace files, ensuring ACID durability and instant crash recovery.',
                        quote: 'Checkpoint records in WAL mark the point from which REDO log replay must commence during recovery.',
                        diagramType: 'stomp-pipeline',
                        diagramTitle: 'Figure 3.1: WAL Pipeline, Checkpointer & Crash Recovery Flow'
                    }
                ]
            },
            'design-system': {
                name: 'Design-System-Specification.pdf',
                title: 'Design System & Typography Guidelines',
                totalPages: 3,
                pages: [
                    {
                        header: 'SyncPad Design System Guidelines • Page 1 of 3',
                        section: 'Module 1: Design Tokens & Color Harmony',
                        body: 'The color palette is built upon curated HSL tokens with strict contrast ratios exceeding WCAG AAA standards (7.1:1). Accents utilize dynamic primary blues and emerald greens.',
                        quote: 'Core Primary: #2563eb • Surface Background: #f8fafc • Border Subtle: #e2e8f0.',
                        diagramType: 'presence-flow',
                        diagramTitle: 'Figure 1.1: Color Palette Tokens & Accessibility Contrast Grid'
                    },
                    {
                        header: 'SyncPad Design System Guidelines • Page 2 of 3',
                        section: 'Module 2: Modular Scale & Dynamic Typography',
                        body: 'Typography hierarchy utilizes a 1.25 major-third modular stepping scale (12px, 14px, 16px, 20px, 24px, 32px, 40px) rendered in Google Fonts Inter and Outfit.',
                        quote: 'Line heights scale inversely with font size: 1.6 for body copy and 1.2 for major headers.',
                        diagramType: 'ot-matrix',
                        diagramTitle: 'Figure 2.1: Typography Hierarchy & Stepping Scale'
                    },
                    {
                        header: 'SyncPad Design System Guidelines • Page 3 of 3',
                        section: 'Module 3: Split-Pane Workspace Ergonomics',
                        body: 'Split workspace layouts support customizable left, right, top, and bottom docking with draggable pane dividers and interactive canvas snapshot capture boxes.',
                        quote: 'Minimum pane width: 20% • Maximum pane width: 80% • Default split ratio: 46% reference / 54% document.',
                        diagramType: 'stomp-pipeline',
                        diagramTitle: 'Figure 3.1: Workspace Docking Modes & Drag Resizer Engine'
                    }
                ]
            }
        };

        function updatePdfDropdownSelectionUi(activeKey, activeFileName) {
            const key = activeKey || (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.currentPdfKey : currentPdfPresetKey) || 'rfc-7629';
            const fileName = activeFileName || (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.currentFileName : currentPdfFileName) || 'RFC-7629-Architecture.pdf';

            // 1. Update PDF toolbar dropdown button label
            const label = document.getElementById('pdfFileNameLabel');
            if (label) {
                label.textContent = fileName;
                label.title = fileName;
            }
            const btn = document.getElementById('pdfAttachBtn');
            if (btn) {
                btn.title = `Current PDF: ${fileName} (Click to switch or upload)`;
            }

            // 2. Update Preset items in dropdown
            const presetButtons = document.querySelectorAll('.pdf-preset-item');
            presetButtons.forEach(button => {
                const pKey = button.getAttribute('data-preset-key');
                const badge = button.querySelector('.pdf-preset-active-badge');
                const isSelected = pKey === key || (pKey === 'rfc-7629' && (key === 'rfc-7629' || !key || key.includes('rfc-7629')));
                if (isSelected) {
                    button.classList.add('active');
                    button.style.background = 'var(--bg-surface-hover, rgba(139, 92, 246, 0.1))';
                    button.style.fontWeight = '600';
                    if (badge) badge.classList.remove('hidden');
                } else {
                    button.classList.remove('active');
                    button.style.background = '';
                    button.style.fontWeight = '';
                    if (badge) badge.classList.add('hidden');
                }
            });

            // 3. Update Uploaded items in dropdown
            const uploadButtons = document.querySelectorAll('.pdf-uploaded-item-btn');
            uploadButtons.forEach(button => {
                const uKey = button.getAttribute('data-upload-key');
                const uName = button.getAttribute('data-file-name');
                const badge = button.querySelector('.pdf-upload-active-badge');
                const isSelected = (uKey && uKey === key) || (uName && uName === fileName) || (key && key.includes(uName));
                if (isSelected) {
                    button.classList.add('active');
                    button.style.background = 'var(--bg-surface-hover, rgba(139, 92, 246, 0.1))';
                    button.style.fontWeight = '600';
                    if (badge) badge.classList.remove('hidden');
                } else {
                    button.classList.remove('active');
                    button.style.background = '';
                    button.style.fontWeight = '';
                    if (badge) badge.classList.add('hidden');
                }
            });
        }

        async function togglePdfAttachmentMenu(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('pdfAttachmentMenu');
            if (!menu) return;
            const willOpen = menu.classList.contains('hidden');
            closeAllDocMenus();
            if (willOpen) {
                await renderUploadedPdfList();
                updatePdfDropdownSelectionUi();
                menu.classList.remove('hidden');
            }
            refreshIcons();
        }

        async function renderUploadedPdfList() {
            const section = document.getElementById('pdfUploadedSection');
            const listEl = document.getElementById('pdfUploadedList');
            if (!section || !listEl || !window.pdfStorage) return;

            const docId = (window.currentDoc && window.currentDoc.id) || null;
            const list = await window.pdfStorage.listUploadedPdfs(docId);

            if (!list || list.length === 0) {
                section.classList.add('hidden');
                listEl.innerHTML = '';
                return;
            }

            const currentKey = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.currentPdfKey : currentPdfPresetKey) || '';
            const currentName = (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.currentFileName : currentPdfFileName) || '';

            section.classList.remove('hidden');
            listEl.innerHTML = list.map(item => {
                const isItemActive = (item.key && item.key === currentKey) || (item.fileName && item.fileName === currentName) || currentKey.includes(item.fileName);
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 4px; border-radius: 6px; ${isItemActive ? 'background: rgba(139, 92, 246, 0.08);' : ''}">
                        <button class="doc-menu-item pdf-uploaded-item-btn ${isItemActive ? 'active' : ''}" data-upload-key="${escapeHtml(item.key)}" data-file-name="${escapeHtml(item.fileName)}" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0.35rem 0.5rem; display: flex; align-items: center; justify-content: space-between;" onclick="loadUploadedPdfByKey('${escapeHtml(item.key)}')">
                            <div style="display: flex; align-items: center; gap: 0.45rem; overflow: hidden;">
                                <i data-lucide="file-check" style="width:14px;height:14px;color:var(--success);flex-shrink:0;"></i>
                                <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.fileName)}</span>
                            </div>
                            <span class="pdf-upload-active-badge ${isItemActive ? '' : 'hidden'}" style="font-size:0.75rem; color:var(--accent-primary); font-weight:700; background:rgba(139,92,246,0.15); padding:1px 6px; border-radius:10px; flex-shrink:0;">✓ Active</span>
                        </button>
                        <button class="btn btn-icon" style="width: 22px; height: 22px; padding: 0; color: var(--danger); flex-shrink: 0;" onclick="deleteUploadedPdfItem('${escapeHtml(item.key)}', event)" title="Delete saved PDF">
                            <i data-lucide="trash" style="width: 12px; height: 12px;"></i>
                        </button>
                    </div>
                `;
            }).join('');
            refreshIcons();
        }

        async function loadUploadedPdfByKey(key) {
            closePdfAttachmentMenu();
            if (!window.pdfStorage) return;

            const stored = await window.pdfStorage.getUploadedPdf(key);
            if (!stored || !stored.data) {
                toast('Saved PDF file could not be read');
                return;
            }

            currentPdfFileName = stored.fileName;
            currentPdfPresetKey = key;

            if (window.pdfEngine) {
                await window.pdfEngine.renderer.loadPdfDocument(stored.data, stored.fileName);
            } else {
                await loadPdfFromArrayBuffer(stored.data, stored.fileName);
            }

            updatePdfUiMetadata(stored.fileName, 1, (window.pdfEngine && window.pdfEngine.renderer ? window.pdfEngine.renderer.numPages : 1));
            updatePdfDropdownSelectionUi(key, stored.fileName);

            if (currentDoc && currentDoc.id && token) {
                try {
                    await fetch(`/documents/${currentDoc.id}/pdf`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({
                            fileName: stored.fileName,
                            pdfUrl: ''
                        })
                    });
                    currentDoc.pdfFileName = stored.fileName;
                } catch (e) {}
            }
            toast(`✓ Switched to uploaded PDF "${stored.fileName}"`);
        }

        async function deleteUploadedPdfItem(key, event) {
            if (event) event.stopPropagation();
            if (!window.pdfStorage) return;
            await window.pdfStorage.deleteUploadedPdf(key);
            await renderUploadedPdfList();
            toast('Removed saved PDF');
        }

        function closePdfAttachmentMenu() {
            const menu = document.getElementById('pdfAttachmentMenu');
            if (menu) menu.classList.add('hidden');
        }

        function triggerPdfUpload() {
            closePdfAttachmentMenu();
            const input = document.getElementById('pdfFileInput');
            if (input) input.click();
        }

        async function handlePdfFileUpload(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
                toast('Please select a valid PDF file');
                return;
            }

            toast(`Loading & Saving "${file.name}"...`);
            currentPdfFileName = file.name;
            currentPdfPresetKey = null;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                currentPdfDataUrl = null;

                // Persist uploaded PDF data to persistent IndexedDB store
                if (window.pdfStorage) {
                    await window.pdfStorage.saveUploadedPdf(file.name, arrayBuffer, currentDoc?.id);
                }

                if (window.pdfEngine) {
                    await window.pdfEngine.renderer.loadPdfDocument(arrayBuffer, file.name);
                } else {
                    await loadPdfFromArrayBuffer(arrayBuffer, file.name);
                }

                // Persist attachment to backend if document is open
                if (currentDoc && currentDoc.id && token) {
                    try {
                        const res = await fetch(`/documents/${currentDoc.id}/pdf`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify({
                                fileName: file.name,
                                pdfUrl: ''
                            })
                        });
                        if (res.ok) {
                            currentDoc.pdfFileName = file.name;
                            toast(`✓ Attached & saved "${file.name}" to document`);
                        }
                    } catch (err) {
                        console.warn('Could not persist PDF attachment:', err);
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        }

        async function promptPdfUrl() {
            closePdfAttachmentMenu();
            const url = prompt('Enter public URL of PDF reference document:', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
            if (!url) return;

            const fileName = url.split('/').pop().split('?')[0] || 'Remote-Reference.pdf';
            toast(`Loading PDF from URL...`);
            currentPdfFileName = fileName;
            currentPdfPresetKey = null;

            if (window.pdfEngine) {
                await window.pdfEngine.renderer.loadPdfDocument(url, fileName);
            } else {
                await loadPdfFromUrl(url, fileName);
            }

            if (currentDoc && currentDoc.id && token) {
                try {
                    await fetch(`/documents/${currentDoc.id}/pdf`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({
                            fileName: fileName,
                            pdfUrl: url
                        })
                    });
                    currentDoc.pdfFileName = fileName;
                    currentDoc.pdfUrl = url;
                } catch (e) {}
            }
        }

        async function loadPresetPdf(presetKey) {
            closePdfAttachmentMenu();
            const preset = PRESET_PDF_LIBRARY[presetKey] || PRESET_PDF_LIBRARY['rfc-7629'];
            currentPdfPresetKey = presetKey;
            currentPdfFileName = preset.name;
            currentPdfDoc = null;
            totalPdfPages = preset.totalPages;
            currentPdfPage = 1;

            updatePdfUiMetadata(preset.name, 1, preset.totalPages);

            if (window.pdfEngine) {
                await window.pdfEngine.renderer.loadPdfDocument(presetKey);
            } else {
                renderVectorPdfPage(presetKey, 1);
            }

            if (currentDoc && currentDoc.id && token) {
                try {
                    await fetch(`/documents/${currentDoc.id}/pdf`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({
                            fileName: preset.name,
                            pdfUrl: ''
                        })
                    });
                    currentDoc.pdfFileName = preset.name;
                } catch (e) {}
            }
            toast(`✓ Switched to "${preset.name}" (${preset.totalPages} pages)`);
        }

        async function detachCurrentPdf() {
            closePdfAttachmentMenu();
            if (!confirm('Are you sure you want to detach the reference PDF from this document?')) return;

            if (currentDoc && currentDoc.id && token) {
                try {
                    await fetch(`/documents/${currentDoc.id}/pdf`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    currentDoc.pdfFileName = null;
                    currentDoc.pdfUrl = null;
                } catch (e) {}
            }

            loadPresetPdf('rfc-7629');
            toast('Detached reference PDF');
        }

        function updatePdfUiMetadata(fileName, page, total) {
            const nameLabel = document.getElementById('pdfFileNameLabel');
            const pageInput = document.getElementById('pdfPageInput');
            const totalSpan = document.getElementById('pdfTotalPages');
            const badge = document.getElementById('pdfDocBadge');
            const dimBadge = document.getElementById('pdfCaptureDimensionBadge');

            if (nameLabel) {
                nameLabel.textContent = fileName;
                nameLabel.title = fileName;
            }
            if (pageInput) {
                pageInput.value = page;
                pageInput.max = total;
            }
            if (totalSpan) totalSpan.textContent = total;
            if (badge) badge.textContent = fileName;
            if (dimBadge) dimBadge.textContent = `440 × 180px • ${fileName} (Page ${page})`;

            updatePdfDropdownSelectionUi(currentPdfPresetKey || fileName, fileName);
        }

        async function loadPdfFromArrayBuffer(arrayBuffer, fileName) {
            try {
                if (window.pdfjsLib) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                    currentPdfDoc = await loadingTask.promise;
                    totalPdfPages = currentPdfDoc.numPages;
                    currentPdfPage = 1;
                    updatePdfUiMetadata(fileName, 1, totalPdfPages);
                    await renderPdfJsPage(1);
                    return;
                }
            } catch (err) {
                console.warn('PDF.js loading failed, using vector engine:', err);
            }

            // Vector Fallback
            loadPresetPdf('rfc-7629');
        }

        async function loadPdfFromUrl(url, fileName) {
            try {
                if (window.pdfjsLib) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    const loadingTask = pdfjsLib.getDocument(url);
                    currentPdfDoc = await loadingTask.promise;
                    totalPdfPages = currentPdfDoc.numPages;
                    currentPdfPage = 1;
                    updatePdfUiMetadata(fileName, 1, totalPdfPages);
                    await renderPdfJsPage(1);
                    return;
                }
            } catch (err) {
                console.warn('PDF.js URL loading failed, using vector engine:', err);
            }
            loadPresetPdf('rfc-7629');
        }

        async function renderPdfJsPage(pageNum) {
            if (!currentPdfDoc) return;
            const canvas = document.getElementById('pdfRenderCanvas');
            const textLayer = document.getElementById('pdfTextLayer');
            if (!canvas) return;

            try {
                const page = await currentPdfDoc.getPage(pageNum);
                const ctx = canvas.getContext('2d');
                const scale = (pdfZoom / 100) * 1.5;
                const viewport = page.getViewport({ scale: scale, rotation: pdfRotation });

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${viewport.width / 1.5}px`;
                canvas.style.height = `${viewport.height / 1.5}px`;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                await page.render(renderContext).promise;

                if (textLayer) {
                    textLayer.innerHTML = '';
                    textLayer.style.width = `${viewport.width / 1.5}px`;
                    textLayer.style.height = `${viewport.height / 1.5}px`;
                }
            } catch (e) {
                console.error('Error rendering PDF.js page:', e);
            }
        }

        function renderVectorPdfPage(presetKey, pageNum) {
            const canvas = document.getElementById('pdfRenderCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            const preset = PRESET_PDF_LIBRARY[presetKey] || PRESET_PDF_LIBRARY['rfc-7629'];
            const pageData = preset.pages[pageNum - 1] || preset.pages[0];

            const baseW = 580;
            const baseH = 750;
            const scale = (pdfZoom / 100);

            canvas.width = baseW * scale * 2; // HiDPI
            canvas.height = baseH * scale * 2;
            canvas.style.width = `${baseW * scale}px`;
            canvas.style.height = `${baseH * scale}px`;

            const annotCanvas = document.getElementById('pdfAnnotationCanvas');
            if (annotCanvas) {
                annotCanvas.width = baseW * scale * 2;
                annotCanvas.height = baseH * scale * 2;
                annotCanvas.style.width = `${baseW * scale}px`;
                annotCanvas.style.height = `${baseH * scale}px`;
            }

            ctx.save();
            ctx.scale(scale * 2, scale * 2);

            // 1. Page Background & Border
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, baseW, baseH);

            // 2. Header
            ctx.fillStyle = '#64748b';
            ctx.font = '500 11px Inter, sans-serif';
            ctx.fillText(pageData.header, 30, 36);

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(30, 48);
            ctx.lineTo(baseW - 30, 48);
            ctx.stroke();

            // 3. Section Title
            ctx.fillStyle = '#0f172a';
            ctx.font = '700 17px Inter, sans-serif';
            ctx.fillText(pageData.section, 30, 78);

            // 4. Body Paragraph (Wrapped Text)
            ctx.fillStyle = '#334155';
            ctx.font = '400 12.5px Inter, sans-serif';
            wrapCanvasText(ctx, pageData.body, 30, 102, baseW - 60, 20);

            // 5. Architectural Diagram Box
            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            roundRect(ctx, 30, 150, baseW - 60, 190, 8, true, true);

            // Diagram Header
            ctx.fillStyle = '#2563eb';
            ctx.font = '700 11px Inter, sans-serif';
            ctx.fillText(pageData.diagramTitle.toUpperCase(), 45, 172);

            // Render specific diagram
            renderCanvasDiagram(ctx, pageData.diagramType, 40, 185, baseW - 80, 140);

            // 6. Blockquote Box
            ctx.fillStyle = '#eff6ff';
            ctx.fillRect(30, 360, baseW - 60, 60);
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(30, 360, 4, 60);

            ctx.fillStyle = '#1e40af';
            ctx.font = 'italic 12px Inter, sans-serif';
            wrapCanvasText(ctx, pageData.quote, 46, 384, baseW - 90, 18);

            // 7. Additional Content / Table
            ctx.fillStyle = '#0f172a';
            ctx.font = '600 13px Inter, sans-serif';
            ctx.fillText('Specification Key Metrics & Guarantees', 30, 455);

            // Metric Table
            renderCanvasMetricTable(ctx, 30, 470, baseW - 60, 180, pageNum);

            // Footer
            ctx.fillStyle = '#94a3b8';
            ctx.font = '500 10px Inter, sans-serif';
            ctx.fillText(`SyncPad Reference PDF Engine • Page ${pageNum} of ${preset.totalPages}`, 30, baseH - 24);
            ctx.fillText(`Confidential & Proprietary`, baseW - 170, baseH - 24);

            ctx.restore();

            populatePdfTextLayer(pageData, scale);
            redrawAllAnnotations();
        }

        function populatePdfTextLayer(pageData, scale) {
            const textLayer = document.getElementById('pdfTextLayer');
            if (!textLayer) return;
            textLayer.innerHTML = '';

            const baseW = 580;
            const baseH = 750;
            textLayer.style.width = `${baseW * scale}px`;
            textLayer.style.height = `${baseH * scale}px`;

            const textBlocks = [
                { text: pageData.header, x: 30, y: 24, size: 11, font: 'Inter, sans-serif' },
                { text: pageData.section, x: 30, y: 62, size: 17, font: 'Inter, sans-serif', weight: '700' },
                { text: pageData.body, x: 30, y: 102, size: 12.5, font: 'Inter, sans-serif', wrap: true, maxW: baseW - 60, lineH: 20 },
                { text: pageData.diagramTitle, x: 45, y: 160, size: 11, font: 'Inter, sans-serif', weight: '700' },
                { text: pageData.quote, x: 46, y: 370, size: 12, font: 'Inter, sans-serif', wrap: true, maxW: baseW - 90, lineH: 18 },
                { text: 'Specification Key Metrics & Guarantees', x: 30, y: 440, size: 13, font: 'Inter, sans-serif', weight: '600' }
            ];

            textBlocks.forEach(block => {
                if (block.wrap) {
                    const words = block.text.split(' ');
                    let line = '';
                    let curY = block.y;
                    const charPerLine = Math.floor(block.maxW / (block.size * 0.55));

                    words.forEach(w => {
                        if ((line + ' ' + w).length > charPerLine && line.length > 0) {
                            createSpan(line, block.x, curY, block.size, scale);
                            line = w;
                            curY += block.lineH;
                        } else {
                            line = line.length > 0 ? (line + ' ' + w) : w;
                        }
                    });
                    if (line.length > 0) {
                        createSpan(line, block.x, curY, block.size, scale);
                    }
                } else {
                    createSpan(block.text, block.x, block.y, block.size, scale);
                }
            });

            function createSpan(str, x, y, size, s) {
                const span = document.createElement('span');
                span.textContent = str;
                span.style.left = `${x * s}px`;
                span.style.top = `${y * s}px`;
                span.style.fontSize = `${size * s}px`;
                span.style.fontFamily = 'Inter, sans-serif';
                span.style.color = 'transparent';
                span.style.userSelect = 'text';
                span.style.webkitUserSelect = 'text';
                textLayer.appendChild(span);
            }
        }

        function renderCanvasDiagram(ctx, type, x, y, w, h) {
            if (type === 'stomp-pipeline') {
                // Client A
                ctx.fillStyle = '#eff6ff';
                ctx.strokeStyle = '#2563eb';
                roundRect(ctx, x + 10, y + 25, 95, 48, 6, true, true);
                ctx.fillStyle = '#1e40af';
                ctx.font = '700 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Client A (Alice)', x + 57, y + 47);
                ctx.font = '500 9px Inter, sans-serif';
                ctx.fillStyle = '#3b82f6';
                ctx.fillText('Port 8082 WS', x + 57, y + 61);

                // Central Broker
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#0f172a';
                roundRect(ctx, x + 160, y + 10, 120, 75, 8, true, true);
                ctx.fillStyle = '#0f172a';
                ctx.font = '800 12px Inter, sans-serif';
                ctx.fillText('Spring STOMP', x + 220, y + 36);
                ctx.font = '600 10px Inter, sans-serif';
                ctx.fillStyle = '#475569';
                ctx.fillText('Broker Relay', x + 220, y + 52);
                ctx.fillStyle = '#10b981';
                ctx.font = '700 9px Inter, sans-serif';
                ctx.fillText('OT Conflict Engine', x + 220, y + 68);

                // Client B
                ctx.fillStyle = '#faf5ff';
                ctx.strokeStyle = '#9333ea';
                roundRect(ctx, x + 335, y + 25, 95, 48, 6, true, true);
                ctx.fillStyle = '#6b21a8';
                ctx.font = '700 11px Inter, sans-serif';
                ctx.fillText('Client B (Bob)', x + 382, y + 47);
                ctx.font = '500 9px Inter, sans-serif';
                ctx.fillStyle = '#a855f7';
                ctx.fillText('Port 8082 WS', x + 382, y + 61);

                // Connecting Lines
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + 105, y + 49);
                ctx.lineTo(x + 160, y + 49);
                ctx.stroke();

                ctx.strokeStyle = '#9333ea';
                ctx.beginPath();
                ctx.moveTo(x + 280, y + 49);
                ctx.lineTo(x + 335, y + 49);
                ctx.stroke();
                ctx.textAlign = 'left';
            } else if (type === 'ot-matrix') {
                ctx.fillStyle = '#f1f5f9';
                roundRect(ctx, x + 20, y + 15, w - 40, 80, 6, true, false);
                ctx.fillStyle = '#0f172a';
                ctx.font = '600 10.5px Inter, sans-serif';
                ctx.fillText('Client 1: Insert("A", 0) ──▶ Transform T(Op1, Op2) ──▶ Client 1 Replay', x + 40, y + 42);
                ctx.fillText('Client 2: Insert("B", 0) ──▶ Transform T(Op2, Op1) ──▶ Client 2 Replay', x + 40, y + 70);
            } else {
                ctx.fillStyle = '#ecfdf5';
                ctx.strokeStyle = '#059669';
                roundRect(ctx, x + 20, y + 15, w - 40, 80, 6, true, true);
                ctx.fillStyle = '#065f46';
                ctx.font = '700 11px Inter, sans-serif';
                ctx.fillText('✓ Caret Delta Broadcast: { x: 250, y: 130, user: "Alice Chen", color: "#10b981" }', x + 35, y + 45);
                ctx.font = '500 10px Inter, sans-serif';
                ctx.fillText('✓ Subscribed STOMP Channel: /topic/documents/{id}', x + 35, y + 70);
            }
        }

        function renderCanvasMetricTable(ctx, x, y, w, h, pageNum) {
            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#e2e8f0';
            roundRect(ctx, x, y, w, 140, 4, true, true);

            // Table Header
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(x, y, w, 28);
            ctx.fillStyle = '#334155';
            ctx.font = '700 10.5px Inter, sans-serif';
            ctx.fillText('PARAMETER / METRIC', x + 15, y + 18);
            ctx.fillText('SPECIFICATION', x + 200, y + 18);
            ctx.fillText('STATUS', x + w - 75, y + 18);

            const rows = [
                ['Propagation Target Latency', '< 50ms P99', 'PASSED'],
                ['WebSocket Message Serialization', 'JSON Stomp Sub-protocols', 'ACTIVE'],
                ['Conflict Resolution Preservation', 'Deterministic Intention Order', 'VERIFIED'],
                ['Collaborator Presence Interval', '10 sec Heartbeat Beacons', 'ONLINE']
            ];

            rows.forEach((r, idx) => {
                const rowY = y + 28 + (idx * 28);
                ctx.strokeStyle = '#f1f5f9';
                ctx.beginPath();
                ctx.moveTo(x, rowY);
                ctx.lineTo(x + w, rowY);
                ctx.stroke();

                ctx.fillStyle = '#1e293b';
                ctx.font = '500 10.5px Inter, sans-serif';
                ctx.fillText(r[0], x + 15, rowY + 18);
                ctx.fillStyle = '#475569';
                ctx.fillText(r[1], x + 200, rowY + 18);
                ctx.fillStyle = '#10b981';
                ctx.font = '700 9.5px Inter, sans-serif';
                ctx.fillText(r[2], x + w - 75, rowY + 18);
            });
        }

        function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' ');
            let line = '';
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    ctx.fillText(line, x, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x, y);
        }

        function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        }

        // Page Navigation
        function changePdfPage(delta) {
            let next = currentPdfPage + delta;
            if (next < 1) next = 1;
            if (next > totalPdfPages) next = totalPdfPages;
            if (next === currentPdfPage) return;
            jumpToPdfPage(next);
        }

        function jumpToPdfPage(pageNum) {
            const p = parseInt(pageNum, 10);
            if (isNaN(p) || p < 1 || p > totalPdfPages) return;
            currentPdfPage = p;
            updatePdfUiMetadata(currentPdfFileName, currentPdfPage, totalPdfPages);

            if (window.pdfEngine) {
                window.pdfEngine.renderer.renderPage(currentPdfPage);
            } else if (currentPdfDoc) {
                renderPdfJsPage(currentPdfPage);
            } else {
                renderVectorPdfPage(currentPdfPresetKey || 'rfc-7629', currentPdfPage);
            }
            toast(`PDF Page ${currentPdfPage} of ${totalPdfPages}`);
        }

        // Zoom Controls
        function zoomPdf(delta) {
            pdfZoom += delta;
            if (pdfZoom < 40) pdfZoom = 40;
            if (pdfZoom > 300) pdfZoom = 300;
            const levelEl = document.getElementById('pdfZoomLevel');
            if (levelEl) levelEl.textContent = pdfZoom + '%';

            if (window.pdfEngine) {
                window.pdfEngine.setZoom(pdfZoom / 100);
            } else if (currentPdfDoc) {
                renderPdfJsPage(currentPdfPage);
            } else {
                renderVectorPdfPage(currentPdfPresetKey || 'rfc-7629', currentPdfPage);
            }
        }

        function resetPdfZoom() {
            pdfZoom = 100;
            const levelEl = document.getElementById('pdfZoomLevel');
            if (levelEl) levelEl.textContent = '100%';

            if (window.pdfEngine) {
                window.pdfEngine.setZoom(1.0);
            } else if (currentPdfDoc) {
                renderPdfJsPage(currentPdfPage);
            } else {
                renderVectorPdfPage(currentPdfPresetKey || 'rfc-7629', currentPdfPage);
            }
            toast('Reset zoom to 100%');
        }

        function rotatePdf() {
            pdfRotation = (pdfRotation + 90) % 360;

            if (window.pdfEngine) {
                window.pdfEngine.renderer.setRotation(pdfRotation);
            } else if (currentPdfDoc) {
                renderPdfJsPage(currentPdfPage);
            } else {
                renderVectorPdfPage(currentPdfPresetKey || 'rfc-7629', currentPdfPage);
            }
            toast(`Rotated ${pdfRotation}°`);
        }

        function downloadCurrentPdf() {
            if (window.pdfEngine && typeof window.pdfEngine.exportEditedPdf === 'function') {
                window.pdfEngine.exportEditedPdf();
                return;
            }
            toast(`Downloading "${currentPdfFileName}"...`);
            const canvas = document.getElementById('pdfRenderCanvas');
            if (canvas) {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${(currentPdfFileName || 'document').replace(/\.pdf$/i, '')}_page.png`;
                link.click();
            }
        }
        // ==========================================
        // PDF FULLSCREEN MODE CONTROLLER
        // ==========================================
        let isPdfFullscreen = false;
        let pdfPreFullscreenState = {
            width: '',
            height: '',
            layoutMode: 'pdf-left'
        };

        function togglePdfFullscreen() {
            if (isPdfFullscreen) {
                exitPdfFullscreen();
            } else {
                enterPdfFullscreen();
            }
        }

        function enterPdfFullscreen() {
            const pane = document.getElementById('pdfReferencePane');
            if (!pane) return;

            isPdfFullscreen = true;
            // Cache current dimensions and layout
            pdfPreFullscreenState = {
                width: pane.style.width,
                height: pane.style.height,
                layoutMode: docLayoutMode || 'pdf-left'
            };

            pane.classList.add('pdf-fullscreen');
            
            // Try native HTML5 Fullscreen API if permitted
            try {
                if (pane.requestFullscreen) {
                    pane.requestFullscreen().catch(() => {});
                } else if (pane.webkitRequestFullscreen) {
                    pane.webkitRequestFullscreen().catch(() => {});
                }
            } catch (e) {}

            // Update Fullscreen button state and icon
            const btn = document.getElementById('pdfFullscreenBtn');
            if (btn) {
                btn.title = 'Exit Full Screen (Esc)';
                btn.innerHTML = '<i data-lucide="minimize-2" id="pdfFullscreenIcon" style="width:14px;height:14px;"></i>';
                btn.classList.add('active');
            }

            // Adjust PDF viewport scale to crisp fit in fullscreen
            setTimeout(() => {
                if (typeof updatePdfSizeToFitPane === 'function') {
                    updatePdfSizeToFitPane();
                }
                refreshIcons();
            }, 60);

            toast('Entered Full Screen PDF view (Press Esc to exit)');
        }

        function exitPdfFullscreen() {
            const pane = document.getElementById('pdfReferencePane');
            if (!pane) return;

            isPdfFullscreen = false;
            pane.classList.remove('pdf-fullscreen');

            // Restore original dimension inline styles
            if (pdfPreFullscreenState) {
                pane.style.width = pdfPreFullscreenState.width || '';
                pane.style.height = pdfPreFullscreenState.height || '';
            }

            // Exit native fullscreen if active
            try {
                if (document.fullscreenElement || document.webkitFullscreenElement) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen().catch(() => {});
                    }
                }
            } catch (e) {}

            // Reset button icon and tooltip
            const btn = document.getElementById('pdfFullscreenBtn');
            if (btn) {
                btn.title = 'Full Screen (Maximize PDF)';
                btn.innerHTML = '<i data-lucide="maximize-2" id="pdfFullscreenIcon" style="width:14px;height:14px;"></i>';
                btn.classList.remove('active');
            }

            // Readjust zoom back to split pane bounds
            setTimeout(() => {
                if (typeof updatePdfSizeToFitPane === 'function') {
                    updatePdfSizeToFitPane();
                }
                refreshIcons();
            }, 60);

            toast('Exited Full Screen PDF view');
        }

        // Global Escape & Fullscreen Sync Listeners
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isPdfFullscreen) {
                // If finding bar is focused, allow find bar to close first, otherwise exit fullscreen
                const findBar = document.getElementById('pdfFindBar');
                if (findBar && !findBar.classList.contains('hidden') && document.activeElement === document.getElementById('pdfFindInput')) {
                    return;
                }
                exitPdfFullscreen();
            }
        });

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && isPdfFullscreen) {
                exitPdfFullscreen();
            }
        });
        document.addEventListener('webkitfullscreenchange', () => {
            if (!document.webkitFullscreenElement && isPdfFullscreen) {
                exitPdfFullscreen();
            }
        });

        // Modular PDF engine and annotations are managed by static/js/pdf/*.js


        // ==========================================
        // IN-PDF TEXT SEARCH SYSTEM
        // ==========================================
        function togglePdfSearch() {
            const bar = document.getElementById('pdfFindBar');
            if (!bar) return;
            bar.classList.toggle('hidden');
            if (!bar.classList.contains('hidden')) {
                const input = document.getElementById('pdfFindInput');
                if (input) {
                    input.focus();
                    input.select();
                }
            } else {
                clearPdfSearchHighlights();
            }
            refreshIcons();
        }

        let pdfSearchMatches = [];
        let currentPdfMatchIndex = -1;

        function searchInPdf(query) {
            clearPdfSearchHighlights();
            pdfSearchMatches = [];
            currentPdfMatchIndex = -1;

            const countEl = document.getElementById('pdfFindMatchesCount');
            if (!query || !query.trim()) {
                if (countEl) countEl.textContent = '0/0';
                return;
            }

            const textLayer = document.getElementById('pdfTextLayer');
            if (!textLayer) return;

            const spans = textLayer.querySelectorAll('span');
            const q = query.trim();
            const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedQ})`, 'gi');

            spans.forEach((span) => {
                if (!span.dataset.originalText) {
                    span.dataset.originalText = span.textContent;
                }
                const raw = span.dataset.originalText;
                if (regex.test(raw)) {
                    // Precision pinpoint: highlight only the exact matching substring
                    const html = raw.replace(regex, (match) => {
                        return `<mark class="pdf-search-match-text">${match}</mark>`;
                    });
                    span.innerHTML = html;
                    span.querySelectorAll('.pdf-search-match-text').forEach((mark) => {
                        pdfSearchMatches.push(mark);
                    });
                }
            });

            if (pdfSearchMatches.length > 0) {
                currentPdfMatchIndex = 0;
                highlightCurrentPdfMatch();
            } else {
                if (countEl) countEl.textContent = '0/0';
            }
        }

        function highlightCurrentPdfMatch() {
            if (pdfSearchMatches.length === 0) return;
            pdfSearchMatches.forEach((mark, i) => {
                if (i === currentPdfMatchIndex) {
                    mark.classList.add('is-active-match');
                    mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                } else {
                    mark.classList.remove('is-active-match');
                }
            });

            const countEl = document.getElementById('pdfFindMatchesCount');
            if (countEl) {
                countEl.textContent = `${currentPdfMatchIndex + 1}/${pdfSearchMatches.length}`;
            }
        }

        function findNextPdfMatch(delta) {
            if (pdfSearchMatches.length === 0) return;
            currentPdfMatchIndex = (currentPdfMatchIndex + delta + pdfSearchMatches.length) % pdfSearchMatches.length;
            highlightCurrentPdfMatch();
        }

        function clearPdfSearchHighlights() {
            const textLayer = document.getElementById('pdfTextLayer');
            if (textLayer) {
                textLayer.querySelectorAll('span').forEach((span) => {
                    if (span.dataset.originalText) {
                        span.textContent = span.dataset.originalText;
                        delete span.dataset.originalText;
                    }
                });
            }
            pdfSearchMatches = [];
            currentPdfMatchIndex = -1;
            const countEl = document.getElementById('pdfFindMatchesCount');
            if (countEl) countEl.textContent = '0/0';
        }

        // Threaded Comments System
        function toggleCommentsSidebar() {
            const sidebar = document.getElementById('commentsSidebar');
            if (!sidebar) return;
            sidebar.classList.toggle('hidden');
            if (!sidebar.classList.contains('hidden') && currentDoc && currentDoc.id) {
                loadDocComments(currentDoc.id);
            }
            refreshIcons();
        }

        async function loadDocComments(docId) {
            if (!docId || !token) return;
            try {
                const res = await fetch(`/documents/${docId}/comments`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    currentDocComments = await res.json();
                    updateCommentBadges();
                    renderDocComments();
                }
            } catch (e) {
                console.error('Failed to load comments', e);
            }
        }

        function updateCommentBadges() {
            let openCount = 0;
            let resolvedCount = 0;
            
            function countThread(c) {
                if (c.resolved) resolvedCount++;
                else openCount++;
                if (c.replies && c.replies.length > 0) {
                    c.replies.forEach(countThread);
                }
            }
            
            currentDocComments.forEach(countThread);
            const total = openCount + resolvedCount;

            const allEl = document.getElementById('allCommentCount');
            const openEl = document.getElementById('openCommentCount');
            const resEl = document.getElementById('resolvedCommentCount');
            const badgeEl = document.getElementById('docCommentsBadge');

            if (allEl) allEl.textContent = total;
            if (openEl) openEl.textContent = openCount;
            if (resEl) resEl.textContent = resolvedCount;

            if (badgeEl) {
                if (openCount > 0) {
                    badgeEl.textContent = openCount;
                    badgeEl.classList.remove('hidden');
                } else {
                    badgeEl.classList.add('hidden');
                }
            }
        }

        function filterComments(filter) {
            activeCommentFilter = filter;
            ['All', 'Open', 'Resolved'].forEach(tab => {
                const btn = document.getElementById(`commentFilter${tab}`);
                if (btn) {
                    btn.classList.toggle('active', tab.toLowerCase() === filter);
                }
            });
            renderDocComments();
        }

        function renderDocComments() {
            const container = document.getElementById('docCommentsContainer');
            if (!container) return;

            let filtered = currentDocComments;
            if (activeCommentFilter === 'open') {
                filtered = currentDocComments.filter(c => !c.resolved);
            } else if (activeCommentFilter === 'resolved') {
                filtered = currentDocComments.filter(c => c.resolved);
            }

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; text-align: center; color: var(--text-muted);">
                        <i data-lucide="message-square" style="width: 32px; height: 32px; stroke-width: 1.5; margin-bottom: 0.5rem; opacity: 0.4;"></i>
                        <div style="font-size: 0.85rem; font-weight: 600;">No ${activeCommentFilter !== 'all' ? activeCommentFilter : ''} comments</div>
                        <div style="font-size: 0.75rem; margin-top: 0.25rem;">Highlight document text and click "Anchor Selection" to start a discussion.</div>
                    </div>
                `;
                refreshIcons();
                return;
            }

            container.innerHTML = filtered.map(c => renderCommentCard(c)).join('');
            refreshIcons();
        }

        function renderCommentCard(comment) {
            const authorName = comment.authorName || comment.authorEmail || 'Collaborator';
            const initial = (authorName[0] || 'U').toUpperCase();
            const timeAgo = formatTimeAgo(comment.createdAt);
            const hasAnchor = comment.anchorText && comment.anchorText.trim().length > 0;
            const isResolved = comment.resolved;

            let repliesHtml = '';
            if (comment.replies && comment.replies.length > 0) {
                repliesHtml = comment.replies.map(r => `
                    <div style="background: var(--bg-hover); border-left: 2px solid var(--accent-primary); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; padding: 0.5rem 0.65rem; margin-top: 0.4rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.2rem;">
                            <div style="display: flex; align-items: center; gap: 0.35rem;">
                                <div class="avatar" style="width:18px;height:18px;font-size:0.6rem;background:var(--accent-primary);">${(r.authorName || 'U')[0].toUpperCase()}</div>
                                <span style="font-size: 0.75rem; font-weight: 600;">${escapeHtml(r.authorName || 'Collaborator')}</span>
                            </div>
                            <span style="font-size: 0.68rem; color: var(--text-muted);">${formatTimeAgo(r.createdAt)}</span>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-secondary);">${escapeHtml(r.text)}</div>
                    </div>
                `).join('');
            }

            return `
                <div class="comment-card ${isResolved ? 'resolved' : ''}" id="commentCard-${comment.id}" style="${isResolved ? 'opacity: 0.75;' : ''}">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="avatar" style="width:24px;height:24px;font-size:0.7rem;background:#2563eb;">${initial}</div>
                            <div>
                                <div style="font-size: 0.8rem; font-weight: 600;">${escapeHtml(authorName)}</div>
                                <div style="font-size: 0.68rem; color: var(--text-muted);">${timeAgo}</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <button class="btn btn-icon" onclick="toggleResolveComment(${comment.id})" style="width: 24px; height: 24px;" title="${isResolved ? 'Mark as unresolved' : 'Resolve comment'}">
                                <i data-lucide="${isResolved ? 'check-circle-2' : 'check'}" style="width: 14px; height: 14px; color: ${isResolved ? 'var(--success)' : 'var(--text-muted)'};"></i>
                            </button>
                            <button class="btn btn-icon" onclick="deleteDocComment(${comment.id})" style="width: 24px; height: 24px;" title="Delete comment">
                                <i data-lucide="trash-2" style="width: 13px; height: 13px; color: var(--danger);"></i>
                            </button>
                        </div>
                    </div>

                    ${hasAnchor ? `
                        <div onclick="scrollToAnchorText('${escapeHtml(comment.anchorText)}')" style="cursor: pointer; background: rgba(37,99,235,0.06); border-left: 2px solid var(--accent-primary); padding: 0.35rem 0.55rem; border-radius: 0 4px 4px 0; margin-bottom: 0.5rem; font-size: 0.75rem; color: var(--text-secondary);" title="Click to jump to text in document">
                            <span style="color: var(--accent-primary); font-weight: 600;">"</span>${escapeHtml(comment.anchorText)}<span style="color: var(--accent-primary); font-weight: 600;">"</span>
                        </div>
                    ` : ''}

                    <p style="font-size: 0.82rem; color: var(--text-primary); margin: 0.4rem 0 0.6rem 0; line-height: 1.45;">
                        ${escapeHtml(comment.text)}
                    </p>

                    ${repliesHtml}

                    <!-- Reply Input -->
                    <div style="margin-top: 0.5rem; display: flex; gap: 0.35rem;">
                        <input type="text" id="replyInput-${comment.id}" class="input" placeholder="Reply..." style="font-size: 0.75rem; height: 28px; padding: 0 0.5rem;" onkeydown="if(event.key==='Enter') submitCommentReply(${comment.id})">
                        <button class="btn btn-outline btn-sm" onclick="submitCommentReply(${comment.id})" style="height: 28px; padding: 0 0.5rem; font-size: 0.72rem;">Reply</button>
                    </div>
                </div>
            `;
        }

        function captureSelectionForComment() {
            restoreDocSelection();
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
                selectedAnchorText = sel.toString().trim();
                if (selectedAnchorText.length > 0) {
                    const textEl = document.getElementById('activeAnchorText');
                    if (textEl) textEl.textContent = selectedAnchorText;
                    const previewEl = document.getElementById('activeAnchorPreview');
                    if (previewEl) previewEl.classList.remove('hidden');
                    toast(`Anchored: "${selectedAnchorText.substring(0, 30)}..."`);
                }
            } else {
                toast('Highlight text in the document sheet first to anchor');
            }
        }

        function clearActiveAnchor() {
            selectedAnchorText = '';
            const previewEl = document.getElementById('activeAnchorPreview');
            if (previewEl) previewEl.classList.add('hidden');
        }

        function scrollToAnchorText(text) {
            if (!text) return;
            const sheet = document.getElementById('docPageSheet');
            if (!sheet) return;

            if (window.find && window.find(text, false, false, true, false, false, false)) {
                toast(`Jumped to anchor quote`);
            } else {
                toast(`Anchor: "${text.substring(0, 30)}..."`);
            }
        }

        async function submitDocComment() {
            if (!currentDoc || !currentDoc.id || !token) return;
            const input = document.getElementById('newCommentInput');
            const text = input ? input.value.trim() : '';
            if (!text) {
                toast('Please enter comment text');
                return;
            }

            try {
                const res = await fetch(`/documents/${currentDoc.id}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        text: text,
                        anchorText: selectedAnchorText || null
                    })
                });

                if (res.ok) {
                    if (input) input.value = '';
                    clearActiveAnchor();
                    await loadDocComments(currentDoc.id);
                    toast('✓ Comment posted');
                } else {
                    toast('Failed to post comment');
                }
            } catch (e) {
                toast('Error connecting to comment service');
            }
        }

        async function submitCommentReply(parentId) {
            if (!currentDoc || !currentDoc.id || !token) return;
            const input = document.getElementById(`replyInput-${parentId}`);
            const text = input ? input.value.trim() : '';
            if (!text) return;

            try {
                const res = await fetch(`/documents/${currentDoc.id}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        text: text,
                        parentId: parentId
                    })
                });

                if (res.ok) {
                    if (input) input.value = '';
                    await loadDocComments(currentDoc.id);
                    toast('✓ Reply posted');
                }
            } catch (e) {}
        }

        async function toggleResolveComment(commentId) {
            if (!currentDoc || !currentDoc.id || !token) return;
            try {
                const res = await fetch(`/documents/${currentDoc.id}/comments/${commentId}/resolve`, {
                    method: 'PATCH',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    await loadDocComments(currentDoc.id);
                    toast('✓ Comment status updated');
                }
            } catch (e) {}
        }

        async function deleteDocComment(commentId) {
            if (!currentDoc || !currentDoc.id || !token) return;
            try {
                const res = await fetch(`/documents/${currentDoc.id}/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    await loadDocComments(currentDoc.id);
                    toast('Comment deleted');
                }
            } catch (e) {}
        }

        // =========================================================================
        // ACTIVITY & AUDIT TRAIL ENGINE