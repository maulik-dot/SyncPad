/**
 * SyncPad PDF Renderer
 * High-DPI multi-page PDF renderer utilizing Mozilla PDF.js with vector specification
 * fallback for offline/instant architectural documents.
 */
window.PRESET_PDF_LIBRARY = window.PRESET_PDF_LIBRARY || {
    'rfc-7629': {
        name: 'RFC-7629-Architecture.pdf',
        fileName: 'RFC-7629-Architecture.pdf',
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
        fileName: 'Distributed-Systems-OT-Spec.pdf',
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
        fileName: 'PostgreSQL-Storage-Engine.pdf',
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
        fileName: 'Design-System-Specification.pdf',
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
                section: 'Module 3: Motion & Glassmorphic Elevation',
                body: 'Transitions adhere to fluid bezier curves cubic-bezier(0.16, 1, 0.3, 1). Translucent panels utilize backdrop blur filters with ambient radial glows.',
                quote: 'Micro-animations: 150ms hover scale, 220ms drawer slide with zero layout thrashing.',
                diagramType: 'stomp-pipeline',
                diagramTitle: 'Figure 3.1: Elevation Hierarchy & Micro-interaction Timing'
            }
        ]
    }
};

class PDFRenderer {
    constructor(coordSystem) {
        this.coords = coordSystem || new window.PDFCoordinateSystem();
        this.pdfDoc = null;
        this.currentPage = 1;
        this.numPages = 3;
        this.scale = 1.25;
        this.rotation = 0;
        this.activePresetKey = 'rfc-7629';
        this.currentPdfKey = 'rfc-7629';
        this.currentFileName = 'RFC-7629-Architecture.pdf';

        this.renderCanvas = document.getElementById('pdfRenderCanvas');
        this.textLayer = document.getElementById('pdfTextLayer');
    }

    async loadPdfDocument(source, customFileName) {
        let pdfKey = 'rfc-7629';
        let fileName = customFileName || 'RFC-7629-Architecture.pdf';

        try {
            if (typeof source === 'string' && source.startsWith('data:')) {
                // Base64 Data URL
                const binary = atob(source.split(',')[1]);
                const len = binary.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                source = bytes.buffer;
                pdfKey = customFileName ? 'upload_' + customFileName : 'upload_custom.pdf';
                fileName = customFileName || 'Custom Document.pdf';
            }

            if (source instanceof ArrayBuffer) {
                pdfKey = customFileName ? 'upload_' + customFileName : 'upload_custom.pdf';
                fileName = customFileName || 'Custom Document.pdf';
            } else if (typeof source === 'string' && source.startsWith('http')) {
                pdfKey = 'url_' + source.split('/').pop().split('?')[0];
                fileName = customFileName || source.split('/').pop().split('?')[0] || 'Remote-Reference.pdf';
            } else if (typeof source === 'string' && window.PRESET_PDF_LIBRARY && window.PRESET_PDF_LIBRARY[source]) {
                pdfKey = source;
                fileName = window.PRESET_PDF_LIBRARY[source].fileName;
            }

            this.currentPdfKey = pdfKey;
            this.currentFileName = fileName;

            if (window.pdfjsLib && (source instanceof ArrayBuffer || (typeof source === 'string' && source.startsWith('http')))) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const loadingTask = pdfjsLib.getDocument(source instanceof ArrayBuffer ? { data: source } : source);
                this.pdfDoc = await loadingTask.promise;
                this.numPages = this.pdfDoc.numPages;
                this.activePresetKey = null;
                toast(`✓ Loaded PDF "${fileName}" (${this.numPages} pages)`);
            } else if (typeof source === 'string' && window.PRESET_PDF_LIBRARY && window.PRESET_PDF_LIBRARY[source]) {
                this.activePresetKey = source;
                this.pdfDoc = null;
                this.numPages = window.PRESET_PDF_LIBRARY[source].pages.length;
                this.currentFileName = window.PRESET_PDF_LIBRARY[source].fileName;
            }
        } catch (e) {
            console.warn('[PDFRenderer] Loading failed, using vector preset fallback:', e);
            this.activePresetKey = 'rfc-7629';
            this.currentPdfKey = 'rfc-7629';
            this.currentFileName = 'RFC-7629-Architecture.pdf';
            this.pdfDoc = null;
            this.numPages = 3;
        }

        // Notify annotation manager of PDF switch to isolate and restore annotations
        if (window.pdfAnnotationManager) {
            const currentDocId = (window.currentDoc && window.currentDoc.id) || 'default';
            window.pdfAnnotationManager.setPdfDocument(this.currentPdfKey, currentDocId);
        }

        if (typeof window.updatePdfUiMetadata === 'function') {
            window.updatePdfUiMetadata(this.currentFileName, 1, this.numPages);
        }
        if (typeof window.updatePdfDropdownSelectionUi === 'function') {
            window.updatePdfDropdownSelectionUi(this.currentPdfKey, this.currentFileName);
        }

        this.currentPage = 1;
        await this.renderPage(1);
    }

    async renderPage(pageNum = this.currentPage) {
        this.currentPage = Math.max(1, Math.min(pageNum, this.numPages));
        this.updatePageUi();

        if (this.pdfDoc) {
            await this.renderPdfJsPage(this.currentPage);
        } else {
            this.renderVectorPage(this.currentPage);
        }

        // Notify annotation and selection managers
        if (window.pdfAnnotationManager) {
            window.pdfAnnotationManager.setPage(this.currentPage);
            window.pdfAnnotationManager.renderActivePage(this.scale, this.rotation);
        }
        if (window.pdfCaptureManager) {
            window.pdfCaptureManager.updateScreenPositions(this.scale, this.rotation);
        }
    }

    async goToPage(pageNum) {
        await this.renderPage(pageNum);
    }

    async setScale(newScale) {
        this.scale = Math.max(0.5, Math.min(newScale, 3.0));
        await this.renderPage(this.currentPage);
    }

    async setRotation(newRotation) {
        this.rotation = (newRotation % 360 + 360) % 360;
        await this.renderPage(this.currentPage);
    }

    async renderPdfJsPage(pageNum) {
        if (!this.pdfDoc || !this.renderCanvas) return;

        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });
        const unrotatedViewport = page.getViewport({ scale: 1.0, rotation: 0 });

        this.coords.setPageDimensions(unrotatedViewport.width, unrotatedViewport.height);
        this.coords.setPdfJsViewport(viewport);

        const dpr = window.devicePixelRatio || 1;
        this.renderCanvas.width = viewport.width * dpr;
        this.renderCanvas.height = viewport.height * dpr;
        this.renderCanvas.style.width = `${viewport.width}px`;
        this.renderCanvas.style.height = `${viewport.height}px`;

        const ctx = this.renderCanvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        // Populate Text Layer
        const textContent = await page.getTextContent();
        this.populatePdfJsTextLayer(textContent, viewport);

        // Sync annot canvas & DOM layer dimensions
        const annotCanvas = document.getElementById('pdfAnnotationCanvas');
        if (annotCanvas) {
            annotCanvas.width = viewport.width * dpr;
            annotCanvas.height = viewport.height * dpr;
            annotCanvas.style.width = `${viewport.width}px`;
            annotCanvas.style.height = `${viewport.height}px`;
        }

        const wrapper = document.getElementById('pdfPageWrapper');
        if (wrapper) {
            wrapper.style.width = `${viewport.width}px`;
            wrapper.style.height = `${viewport.height}px`;
        }
        const tbLayer = document.getElementById('pdfTextBoxesLayer');
        if (tbLayer) {
            tbLayer.style.width = `${viewport.width}px`;
            tbLayer.style.height = `${viewport.height}px`;
        }
        const snLayer = document.getElementById('pdfStickyNotesLayer');
        if (snLayer) {
            snLayer.style.width = `${viewport.width}px`;
            snLayer.style.height = `${viewport.height}px`;
        }
    }

    populatePdfJsTextLayer(textContent, viewport) {
        if (!this.textLayer) return;
        this.textLayer.innerHTML = '';
        this.textLayer.style.width = `${viewport.width}px`;
        this.textLayer.style.height = `${viewport.height}px`;

        textContent.items.forEach(item => {
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - (item.height || 12) * this.scale}px`;
            span.style.fontSize = `${(item.height || 12) * this.scale}px`;
            span.style.fontFamily = item.fontName || 'sans-serif';
            this.textLayer.appendChild(span);
        });
    }

    renderVectorPage(pageNum) {
        if (!this.renderCanvas) return;

        const baseWidth = 595;
        const baseHeight = 842;
        this.coords.setPageDimensions(baseWidth, baseHeight);
        this.coords.setPdfJsViewport(null);

        const dpr = window.devicePixelRatio || 1;
        const rot = (this.rotation % 360 + 360) % 360;
        const isRotated90or270 = (rot === 90 || rot === 270);
        const screenW = (isRotated90or270 ? baseHeight : baseWidth) * this.scale;
        const screenH = (isRotated90or270 ? baseWidth : baseHeight) * this.scale;

        this.renderCanvas.width = screenW * dpr;
        this.renderCanvas.height = screenH * dpr;
        this.renderCanvas.style.width = `${screenW}px`;
        this.renderCanvas.style.height = `${screenH}px`;

        const ctx = this.renderCanvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // Draw crisp PDF page background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, screenW, screenH);

        ctx.save();
        if (rot === 90) {
            ctx.translate(screenW, 0);
            ctx.rotate(90 * Math.PI / 180);
        } else if (rot === 180) {
            ctx.translate(screenW, screenH);
            ctx.rotate(180 * Math.PI / 180);
        } else if (rot === 270) {
            ctx.translate(0, screenH);
            ctx.rotate(270 * Math.PI / 180);
        }

        const unrotatedW = baseWidth * this.scale;
        const unrotatedH = baseHeight * this.scale;

        const preset = (window.PRESET_PDF_LIBRARY && window.PRESET_PDF_LIBRARY[this.activePresetKey]) || (window.PRESET_PDF_LIBRARY && window.PRESET_PDF_LIBRARY['rfc-7629']);
        const pageData = preset ? preset.pages[pageNum - 1] : null;

        if (pageData) {
            this.drawVectorContent(ctx, pageData, unrotatedW, unrotatedH);
        }
        ctx.restore();

        if (pageData) {
            this.populateVectorTextLayer(pageData, screenW, screenH, rot);
        }

        // Sync annot canvas & DOM layer dimensions
        const annotCanvas = document.getElementById('pdfAnnotationCanvas');
        if (annotCanvas) {
            annotCanvas.width = screenW * dpr;
            annotCanvas.height = screenH * dpr;
            annotCanvas.style.width = `${screenW}px`;
            annotCanvas.style.height = `${screenH}px`;
        }

        const wrapper = document.getElementById('pdfPageWrapper');
        if (wrapper) {
            wrapper.style.width = `${screenW}px`;
            wrapper.style.height = `${screenH}px`;
        }
        const tbLayer = document.getElementById('pdfTextBoxesLayer');
        if (tbLayer) {
            tbLayer.style.width = `${screenW}px`;
            tbLayer.style.height = `${screenH}px`;
        }
        const snLayer = document.getElementById('pdfStickyNotesLayer');
        if (snLayer) {
            snLayer.style.width = `${screenW}px`;
            snLayer.style.height = `${screenH}px`;
        }
    }

    drawVectorContent(ctx, pageData, screenW, screenH) {
        ctx.save();
        const s = this.scale;

        // Header
        ctx.fillStyle = '#64748b';
        ctx.font = `500 ${11 * s}px Inter, -apple-system, sans-serif`;
        ctx.fillText(pageData.header, 28 * s, 36 * s);

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.moveTo(28 * s, 46 * s);
        ctx.lineTo(screenW - 28 * s, 46 * s);
        ctx.stroke();

        // Title
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 ${18 * s}px Inter, -apple-system, sans-serif`;
        ctx.fillText(pageData.section, 28 * s, 80 * s);

        // Body Text
        ctx.fillStyle = '#334155';
        ctx.font = `400 ${12 * s}px Inter, -apple-system, sans-serif`;
        this.wrapText(ctx, pageData.body, 28 * s, 110 * s, screenW - 56 * s, 18 * s);

        // Diagram Box
        if (pageData.diagramTitle) {
            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5 * s;
            const diagY = 170 * s;
            const diagH = 175 * s;
            ctx.fillRect(28 * s, diagY, screenW - 56 * s, diagH);
            ctx.strokeRect(28 * s, diagY, screenW - 56 * s, diagH);

            ctx.fillStyle = '#2563eb';
            ctx.font = `700 ${10 * s}px Inter, sans-serif`;
            ctx.fillText(pageData.diagramTitle, 40 * s, diagY + 22 * s);

            // Draw architecture nodes
            this.drawArchitectureNodes(ctx, 40 * s, diagY + 45 * s, (screenW - 80 * s), 100 * s);
        }

        // Quote section
        if (pageData.quote) {
            const qY = 380 * s;
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(28 * s, qY, screenW - 56 * s, 50 * s);
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(28 * s, qY, 3 * s, 50 * s);

            ctx.fillStyle = '#1e293b';
            ctx.font = `italic 500 ${11 * s}px Inter, sans-serif`;
            this.wrapText(ctx, `"${pageData.quote}"`, 40 * s, qY + 22 * s, screenW - 80 * s, 16 * s);
        }

        // Key Metrics
        const mY = 460 * s;
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 ${13 * s}px Inter, sans-serif`;
        ctx.fillText('Specification Key Metrics & Guarantees', 28 * s, mY);

        const bullets = [
            '• Deterministic OT (Operational Transformation) conflict resolution model',
            '• Sub-50ms roundtrip broadcast latency with WebSocket STOMP relays',
            '• Multi-tier transactional persistence with PostgreSQL & Spring Data JPA'
        ];
        ctx.font = `400 ${11 * s}px Inter, sans-serif`;
        ctx.fillStyle = '#475569';
        bullets.forEach((b, idx) => {
            ctx.fillText(b, 34 * s, mY + (24 + idx * 20) * s);
        });

        ctx.restore();
    }

    drawArchitectureNodes(ctx, x, y, w, h) {
        const s = this.scale;
        const nodeW = 85 * s;
        const nodeH = 44 * s;

        // Client A
        ctx.fillStyle = '#eff6ff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5 * s;
        ctx.fillRect(x, y + 10 * s, nodeW, nodeH);
        ctx.strokeRect(x, y + 10 * s, nodeW, nodeH);
        ctx.fillStyle = '#1e40af';
        ctx.font = `700 ${10 * s}px Inter, sans-serif`;
        ctx.fillText('Client A (Alice)', x + 8 * s, y + 26 * s);
        ctx.font = `400 ${8 * s}px Inter, sans-serif`;
        ctx.fillText('Port 8082 WS', x + 8 * s, y + 40 * s);

        // Spring STOMP Server (Center)
        const centerX = x + (w - nodeW * 1.2) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2 * s;
        ctx.fillRect(centerX, y, nodeW * 1.2, nodeH * 1.35);
        ctx.strokeRect(centerX, y, nodeW * 1.2, nodeH * 1.35);
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 ${11 * s}px Inter, sans-serif`;
        ctx.fillText('Spring STOMP', centerX + 12 * s, y + 20 * s);
        ctx.font = `500 ${8 * s}px Inter, sans-serif`;
        ctx.fillStyle = '#64748b';
        ctx.fillText('Broker Relay', centerX + 18 * s, y + 34 * s);
        ctx.fillStyle = '#059669';
        ctx.fillText('OT Conflict Engine', centerX + 8 * s, y + 48 * s);

        // Client B
        const rightX = x + w - nodeW;
        ctx.fillStyle = '#faf5ff';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5 * s;
        ctx.fillRect(rightX, y + 10 * s, nodeW, nodeH);
        ctx.strokeRect(rightX, y + 10 * s, nodeW, nodeH);
        ctx.fillStyle = '#6b21a8';
        ctx.font = `700 ${10 * s}px Inter, sans-serif`;
        ctx.fillText('Client B (Bob)', rightX + 8 * s, y + 26 * s);
        ctx.font = `400 ${8 * s}px Inter, sans-serif`;
        ctx.fillText('Port 8082 WS', rightX + 8 * s, y + 40 * s);

        // Connecting Lines
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(x + nodeW, y + 32 * s);
        ctx.lineTo(centerX, y + 32 * s);
        ctx.stroke();

        ctx.strokeStyle = '#a855f7';
        ctx.beginPath();
        ctx.moveTo(centerX + nodeW * 1.2, y + 32 * s);
        ctx.lineTo(rightX, y + 32 * s);
        ctx.stroke();
    }

    getMeasuredWrappedLines(ctx, text, maxWidth) {
        if (!text) return [];
        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx ? ctx.measureText(testLine) : { width: testLine.length * 7 };
            if (metrics.width > maxWidth && n > 0) {
                lines.push(line.trim());
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        if (line.trim()) lines.push(line.trim());
        return lines;
    }

    getWrappedLines(text, maxChars = 75) {
        if (!text) return [];
        const ctx = this.renderCanvas ? this.renderCanvas.getContext('2d') : null;
        if (ctx) {
            ctx.font = `400 ${12 * this.scale}px Inter, -apple-system, sans-serif`;
            return this.getMeasuredWrappedLines(ctx, text, (this.coords.baseWidth - 56) * this.scale);
        }
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        for (let word of words) {
            if ((currentLine + ' ' + word).trim().length > maxChars) {
                if (currentLine) lines.push(currentLine.trim());
                currentLine = word;
            } else {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        }
        if (currentLine) lines.push(currentLine.trim());
        return lines;
    }

    populateVectorTextLayer(pageData, screenW, screenH) {
        if (!this.textLayer) return;
        this.textLayer.innerHTML = '';
        this.textLayer.style.width = `${screenW}px`;
        this.textLayer.style.height = `${screenH}px`;
        const s = this.scale;
        const ctx = this.renderCanvas ? this.renderCanvas.getContext('2d') : null;

        const addSpan = (text, left, top, size, weight = 'normal', style = 'normal') => {
            if (!text) return;
            const span = document.createElement('span');
            span.textContent = text;
            span.style.left = `${left}px`;
            span.style.top = `${top}px`;
            span.style.fontSize = `${size}px`;
            span.style.fontFamily = 'Inter, -apple-system, sans-serif';
            if (weight) span.style.fontWeight = weight;
            if (style) span.style.fontStyle = style;
            this.textLayer.appendChild(span);
        };

        // 1. Header
        if (pageData.header) {
            addSpan(pageData.header, 28 * s, 21 * s, 11 * s, '500');
        }

        // 2. Section Title
        if (pageData.section) {
            addSpan(pageData.section, 28 * s, 62 * s, 18 * s, '700');
        }

        // 3. Body Text (Wrapped lines matching visual canvas exactly)
        if (pageData.body) {
            let bodyLines;
            if (ctx) {
                ctx.font = `400 ${12 * s}px Inter, -apple-system, sans-serif`;
                bodyLines = this.getMeasuredWrappedLines(ctx, pageData.body, screenW - 56 * s);
            } else {
                bodyLines = this.getWrappedLines(pageData.body, 72);
            }
            bodyLines.forEach((line, idx) => {
                addSpan(line, 28 * s, (96 + idx * 18) * s, 12 * s, '400');
            });
        }

        // 4. Diagram Title & Architecture Nodes
        if (pageData.diagramTitle) {
            const diagY = 170 * s;
            addSpan(pageData.diagramTitle, 40 * s, diagY + 12 * s, 10 * s, '700');

            const nodeW = 85 * s;
            const nodeY = diagY + 45 * s;
            const centerX = 40 * s + ((screenW - 80 * s) - nodeW * 1.2) / 2;
            const rightX = 40 * s + (screenW - 80 * s) - nodeW;

            addSpan('Client A (Alice)', 48 * s, nodeY + 16 * s, 10 * s, '700');
            addSpan('Port 8082 WS', 48 * s, nodeY + 30 * s, 8 * s, '400');

            addSpan('Spring STOMP', centerX + 12 * s, nodeY + 8 * s, 11 * s, '700');
            addSpan('Broker Relay', centerX + 18 * s, nodeY + 22 * s, 8 * s, '500');
            addSpan('OT Conflict Engine', centerX + 8 * s, nodeY + 36 * s, 8 * s, '600');

            addSpan('Client B (Bob)', rightX + 8 * s, nodeY + 16 * s, 10 * s, '700');
            addSpan('Port 8082 WS', rightX + 8 * s, nodeY + 30 * s, 8 * s, '400');
        }

        // 5. Quote (Wrapped lines)
        if (pageData.quote) {
            const qY = 380 * s;
            let quoteLines;
            if (ctx) {
                ctx.font = `italic 500 ${11 * s}px Inter, sans-serif`;
                quoteLines = this.getMeasuredWrappedLines(ctx, `"${pageData.quote}"`, screenW - 80 * s);
            } else {
                quoteLines = this.getWrappedLines(`"${pageData.quote}"`, 70);
            }
            quoteLines.forEach((line, idx) => {
                addSpan(line, 40 * s, qY + (10 + idx * 16) * s, 11 * s, '500', 'italic');
            });
        }

        // 6. Specification Key Metrics & Guarantees
        const mY = 460 * s;
        addSpan('Specification Key Metrics & Guarantees', 28 * s, mY - 13 * s, 13 * s, '700');
        const bullets = [
            '• Deterministic OT (Operational Transformation) conflict resolution model',
            '• Sub-50ms roundtrip broadcast latency with WebSocket STOMP relays',
            '• Multi-tier transactional persistence with PostgreSQL & Spring Data JPA'
        ];
        bullets.forEach((b, idx) => {
            addSpan(b, 34 * s, (460 + 13 + idx * 20) * s, 11 * s, '400');
        });
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const lines = this.getMeasuredWrappedLines(ctx, text, maxWidth);
        lines.forEach((line, idx) => {
            ctx.fillText(line, x, y + idx * lineHeight);
        });
    }

    updatePageUi() {
        const pageInput = document.getElementById('pdfPageInput');
        const pageCountEl = document.getElementById('pdfTotalPages');
        const zoomEl = document.getElementById('pdfZoomLevel');
        const nameLabel = document.getElementById('pdfFileNameLabel');
        const badge = document.getElementById('pdfDocBadge');
        const dimBadge = document.getElementById('pdfCaptureDimensionBadge');

        if (nameLabel && this.currentFileName) {
            nameLabel.textContent = this.currentFileName;
            nameLabel.title = this.currentFileName;
        }
        if (pageInput) pageInput.value = this.currentPage;
        if (pageCountEl) pageCountEl.textContent = this.numPages;
        if (zoomEl) zoomEl.textContent = `${Math.round(this.scale * 100)}%`;
        if (badge && this.currentFileName) badge.textContent = this.currentFileName;
        if (dimBadge && this.currentFileName) dimBadge.textContent = `440 × 180px • ${this.currentFileName} (Page ${this.currentPage})`;

        if (typeof window.updatePdfDropdownSelectionUi === 'function') {
            window.updatePdfDropdownSelectionUi(this.currentPdfKey, this.currentFileName);
        }
    }

    setZoom(scale) {
        this.scale = Math.max(0.5, Math.min(3.0, scale));
        this.renderPage(this.currentPage);
    }

    zoomIn() {
        this.setZoom(this.scale + 0.25);
    }

    zoomOut() {
        this.setZoom(this.scale - 0.25);
    }

    rotate() {
        this.rotation = (this.rotation + 90) % 360;
        this.renderPage(this.currentPage);
        toast(`Rotated PDF to ${this.rotation}°`);
    }

    fitToWidth() {
        const body = document.getElementById('pdfViewerBody');
        if (body) {
            const availableWidth = body.clientWidth - 48;
            this.setZoom(availableWidth / 595);
        }
    }

    fitToPage() {
        const body = document.getElementById('pdfViewerBody');
        if (body) {
            const availableHeight = body.clientHeight - 48;
            this.setZoom(availableHeight / 842);
        }
    }
}

window.PDFRenderer = PDFRenderer;
