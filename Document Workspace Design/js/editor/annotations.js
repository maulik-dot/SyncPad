        // =========================================================================
        let isDocAnnotActive = false;
        let docAnnotTool = 'pen'; // 'pen', 'highlighter', 'eraser'
        let docAnnotColor = '#2563eb';
        let docAnnotSize = 4;
        let docAnnotStrokes = [];
        let docAnnotUndoStack = [];
        let isDocDrawing = false;
        let currentDocStroke = null;
        let docCanvas = null;
        let docCtx = null;
        let docCanvasInitialized = false;

        function initDocAnnotationCanvas() {
            docCanvas = document.getElementById('docAnnotationCanvas');
            if (!docCanvas) return;
            docCtx = docCanvas.getContext('2d');

            if (!docCanvasInitialized) {
                docCanvas.addEventListener('pointerdown', handleDocPointerDown);
                window.addEventListener('pointermove', handleDocPointerMove);
                window.addEventListener('pointerup', handleDocPointerUp);
                window.addEventListener('pointercancel', handleDocPointerUp);
                window.addEventListener('resize', () => {
                    if (isDocAnnotActive || (docAnnotStrokes && docAnnotStrokes.length > 0)) {
                        resizeDocAnnotationCanvas();
                    }
                });

                // Auto-resize canvas when document content mutates/expands
                const sheet = document.getElementById('docPageSheet');
                if (sheet && window.ResizeObserver) {
                    const ro = new ResizeObserver(() => {
                        resizeDocAnnotationCanvas();
                    });
                    ro.observe(sheet);
                }

                docCanvasInitialized = true;
            }

            resizeDocAnnotationCanvas();
        }

        function resizeDocAnnotationCanvas() {
            if (!docCanvas) docCanvas = document.getElementById('docAnnotationCanvas');
            const sheet = document.getElementById('docPageSheet');
            if (!docCanvas || !sheet) return;

            const rect = sheet.getBoundingClientRect();
            const width = sheet.offsetWidth || rect.width || 816;
            const height = sheet.offsetHeight || rect.height || 1056;
            const dpr = window.devicePixelRatio || 1;

            if (docCanvas.width !== Math.floor(width * dpr) || docCanvas.height !== Math.floor(height * dpr)) {
                docCanvas.width = Math.floor(width * dpr);
                docCanvas.height = Math.floor(height * dpr);
                docCanvas.style.width = width + 'px';
                docCanvas.style.height = height + 'px';
            }

            redrawDocAnnotationCanvas();
        }

        function toggleAnnotationMode(forceState) {
            if (forceState !== undefined) {
                isDocAnnotActive = Boolean(forceState);
            } else {
                isDocAnnotActive = !isDocAnnotActive;
            }

            const dock = document.getElementById('docAnnotationDock');
            const btn = document.getElementById('annotationToggleBtn');
            const text = document.getElementById('annotationBtnText');

            if (isDocAnnotActive) {
                document.body.classList.add('doc-annotation-mode-active');
                if (dock) dock.classList.add('visible');
                if (btn) {
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                }
                if (text) text.textContent = 'Annotating...';
                initDocAnnotationCanvas();
                toast('Annotation mode active: Draw or erase directly on document');
            } else {
                document.body.classList.remove('doc-annotation-mode-active');
                if (dock) dock.classList.remove('visible');
                const colorMenu = document.getElementById('docAnnotColorMenu');
                if (colorMenu) colorMenu.classList.add('hidden');
                if (btn) {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
                if (text) text.textContent = 'Annotate';
            }
            refreshIcons();
        }

        function setDocAnnotTool(tool) {
            docAnnotTool = tool;
            
            const penBtn = document.getElementById('annotPenToolBtn');
            const highBtn = document.getElementById('annotHighlighterToolBtn');
            const eraserBtn = document.getElementById('annotEraserToolBtn');

            if (penBtn) penBtn.classList.toggle('active', tool === 'pen');
            if (highBtn) highBtn.classList.toggle('active', tool === 'highlighter');
            if (eraserBtn) eraserBtn.classList.toggle('active', tool === 'eraser');

            const colorMenu = document.getElementById('docAnnotColorMenu');
            if (colorMenu) colorMenu.classList.add('hidden');

            refreshIcons();
        }

        function toggleDocAnnotColorMenu(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('docAnnotColorMenu');
            if (menu) {
                menu.classList.toggle('hidden');
            }
            refreshIcons();
        }

        function selectDocAnnotColor(hexColor) {
            docAnnotColor = hexColor;
            setDocAnnotTool('pen');

            // Update preview indicators
            const dot = document.getElementById('annotPenColorIndicator');
            const preview = document.getElementById('annotActiveColorPreview');
            if (dot) dot.style.backgroundColor = hexColor;
            if (preview) preview.style.backgroundColor = hexColor;

            // Update active state in palette
            document.querySelectorAll('.doc-color-circle').forEach(circle => {
                const bg = circle.style.background || circle.style.backgroundColor;
                const isMatch = bg.toLowerCase().includes(hexColor.toLowerCase()) || circle.getAttribute('onclick').includes(hexColor);
                circle.classList.toggle('active', isMatch);
            });

            const menu = document.getElementById('docAnnotColorMenu');
            if (menu) menu.classList.add('hidden');
            refreshIcons();
        }

        function selectDocAnnotSize(px) {
            docAnnotSize = Number(px);
            document.querySelectorAll('.doc-size-btn').forEach(btn => {
                const isMatch = btn.id === `annotSizeBtn${px}`;
                btn.classList.toggle('active', isMatch);
            });
            const menu = document.getElementById('docAnnotColorMenu');
            if (menu) menu.classList.add('hidden');
        }

        function getCanvasRelativeCoords(e) {
            if (!docCanvas) docCanvas = document.getElementById('docAnnotationCanvas');
            if (!docCanvas) return { x: 0, y: 0 };
            const rect = docCanvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const x = (e.clientX - rect.left) * (docCanvas.width / (rect.width * dpr));
            const y = (e.clientY - rect.top) * (docCanvas.height / (rect.height * dpr));
            return { x, y };
        }

        function handleDocPointerDown(e) {
            if (!isDocAnnotActive) return;
            e.preventDefault();
            isDocDrawing = true;

            const { x, y } = getCanvasRelativeCoords(e);

            if (docAnnotTool === 'eraser') {
                eraseDocStrokeAt(x, y);
                return;
            }

            const strokeColor = (docAnnotTool === 'highlighter') ? 'rgba(254, 240, 138, 0.48)' : docAnnotColor;
            const strokeWidth = (docAnnotTool === 'highlighter') ? 20 : docAnnotSize;

            currentDocStroke = {
                id: 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                tool: docAnnotTool,
                color: strokeColor,
                size: strokeWidth,
                points: [{ x, y }]
            };

            docCtx = docCanvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            docCtx.save();
            docCtx.scale(dpr, dpr);
            docCtx.beginPath();
            docCtx.arc(x, y, (strokeWidth / 2), 0, Math.PI * 2);
            docCtx.fillStyle = strokeColor;
            docCtx.fill();
            docCtx.restore();
        }

        function handleDocPointerMove(e) {
            if (!isDocDrawing || !isDocAnnotActive) return;
            e.preventDefault();
            const { x, y } = getCanvasRelativeCoords(e);

            if (docAnnotTool === 'eraser') {
                eraseDocStrokeAt(x, y);
                return;
            }

            if (!currentDocStroke) return;
            currentDocStroke.points.push({ x, y });

            const pts = currentDocStroke.points;
            if (pts.length >= 2) {
                const p1 = pts[pts.length - 2];
                const p2 = pts[pts.length - 1];
                const dpr = window.devicePixelRatio || 1;

                docCtx.save();
                docCtx.scale(dpr, dpr);
                docCtx.beginPath();
                docCtx.moveTo(p1.x, p1.y);
                docCtx.lineTo(p2.x, p2.y);
                docCtx.strokeStyle = currentDocStroke.color;
                docCtx.lineWidth = currentDocStroke.size;
                docCtx.lineCap = 'round';
                docCtx.lineJoin = 'round';
                if (currentDocStroke.tool === 'highlighter') {
                    docCtx.globalCompositeOperation = 'multiply';
                }
                docCtx.stroke();
                docCtx.restore();
            }
        }

        function handleDocPointerUp(e) {
            if (!isDocDrawing) return;
            isDocDrawing = false;

            if (currentDocStroke && currentDocStroke.points.length > 0) {
                docAnnotStrokes.push(currentDocStroke);
                docAnnotUndoStack = [];
                currentDocStroke = null;
                saveDocAnnotationsToStorage();
                redrawDocAnnotationCanvas();
            }
        }

        function eraseDocStrokeAt(x, y, radius = 18) {
            let hitIndex = -1;
            for (let i = docAnnotStrokes.length - 1; i >= 0; i--) {
                const stroke = docAnnotStrokes[i];
                for (const pt of stroke.points) {
                    const dist = Math.hypot(pt.x - x, pt.y - y);
                    if (dist <= (radius + (stroke.size / 2))) {
                        hitIndex = i;
                        break;
                    }
                }
                if (hitIndex !== -1) break;
            }

            if (hitIndex !== -1) {
                const removed = docAnnotStrokes.splice(hitIndex, 1)[0];
                docAnnotUndoStack.push({ type: 'erase', stroke: removed, index: hitIndex });
                saveDocAnnotationsToStorage();
                redrawDocAnnotationCanvas();
            }
        }

        function undoDocAnnotation() {
            if (docAnnotStrokes.length === 0) return;
            const undone = docAnnotStrokes.pop();
            docAnnotUndoStack.push({ type: 'draw', stroke: undone });
            saveDocAnnotationsToStorage();
            redrawDocAnnotationCanvas();
            toast('Undid stroke');
        }

        function redoDocAnnotation() {
            if (docAnnotUndoStack.length === 0) return;
            const action = docAnnotUndoStack.pop();
            if (action.type === 'draw') {
                docAnnotStrokes.push(action.stroke);
            } else if (action.type === 'erase') {
                docAnnotStrokes.splice(action.index, 0, action.stroke);
            }
            saveDocAnnotationsToStorage();
            redrawDocAnnotationCanvas();
            toast('Redid stroke');
        }

        function clearDocAnnotations() {
            if (docAnnotStrokes.length === 0) return;
            if (!confirm('Clear all drawings and annotations from this document?')) return;
            docAnnotUndoStack.push({ type: 'clear', strokes: [...docAnnotStrokes] });
            docAnnotStrokes = [];
            saveDocAnnotationsToStorage();
            redrawDocAnnotationCanvas();
            toast('Annotations cleared');
        }

        function redrawDocAnnotationCanvas() {
            if (!docCanvas) docCanvas = document.getElementById('docAnnotationCanvas');
            if (!docCanvas) return;
            docCtx = docCanvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            docCtx.clearRect(0, 0, docCanvas.width, docCanvas.height);

            docCtx.save();
            docCtx.scale(dpr, dpr);

            for (const stroke of docAnnotStrokes) {
                if (!stroke.points || stroke.points.length === 0) continue;
                const pts = stroke.points;

                docCtx.beginPath();
                docCtx.strokeStyle = stroke.color;
                docCtx.lineWidth = stroke.size;
                docCtx.lineCap = 'round';
                docCtx.lineJoin = 'round';
                if (stroke.tool === 'highlighter') {
                    docCtx.globalCompositeOperation = 'multiply';
                } else {
                    docCtx.globalCompositeOperation = 'source-over';
                }

                if (pts.length === 1) {
                    docCtx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
                    docCtx.fillStyle = stroke.color;
                    docCtx.fill();
                } else if (pts.length === 2) {
                    docCtx.moveTo(pts[0].x, pts[0].y);
                    docCtx.lineTo(pts[1].x, pts[1].y);
                    docCtx.stroke();
                } else {
                    // Smooth Quadratic Bezier Curves through midpoints
                    docCtx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length - 1; i++) {
                        const midX = (pts[i].x + pts[i + 1].x) / 2;
                        const midY = (pts[i].y + pts[i + 1].y) / 2;
                        docCtx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
                    }
                    docCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                    docCtx.stroke();
                }
            }

            docCtx.restore();
        }

        function saveDocAnnotationsToStorage() {
            if (!currentDoc || !currentDoc.id) return;
            try {
                localStorage.setItem(`syncpad_doc_annot_${currentDoc.id}`, JSON.stringify(docAnnotStrokes));
            } catch (e) {}
        }

        function loadDocAnnotationsFromStorage(docId) {
            const id = docId || (currentDoc ? currentDoc.id : null);
            if (!id) {
                docAnnotStrokes = [];
                redrawDocAnnotationCanvas();
                return;
            }
            try {
                const saved = localStorage.getItem(`syncpad_doc_annot_${id}`);
                docAnnotStrokes = saved ? JSON.parse(saved) : [];
            } catch (e) {
                docAnnotStrokes = [];
            }
            redrawDocAnnotationCanvas();
        }


        function openGlobalSearch() {
            document.getElementById('searchModal').classList.remove('hidden');
            document.getElementById('globalSearchInput').focus();
            handleGlobalSearch('');
            refreshIcons();
        }

        function handleGlobalSearch(query) {
            const container = document.getElementById('searchResultsList');
            container.innerHTML = '';
            const filtered = documentsList.filter(d => d.title.toLowerCase().includes(query.toLowerCase()));

            if (filtered.length === 0) {
                container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No search results found</div>`;
                return;
            }

            filtered.forEach(item => {
                const el = document.createElement('div');
                el.className = 'sidebar-item';
                el.onclick = () => { closeGlobalSearchModal(); openItemView(item); };
                el.innerHTML = `
                    <i data-lucide="${item.fileType === 'WHITEBOARD' ? 'presentation' : 'file-text'}" style="width:16px;height:16px;"></i>
                    <span>${item.title}</span>
                    <span style="margin-left: auto; font-size: 0.72rem; color: var(--text-muted);">${item.fileType}</span>
                `;
                container.appendChild(el);
            });
            refreshIcons();
        }

        function closeGlobalSearchModal() {
            document.getElementById('searchModal').classList.add('hidden');
        }

        function toggleTheme() {
            const html = document.documentElement;
            const current = html.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            setTheme(next);
        }

        function setTheme(t) {
            document.documentElement.setAttribute('data-theme', t);
            const icon = document.getElementById('themeIcon');
            if (icon) {
                icon.setAttribute('data-lucide', t === 'dark' ? 'moon' : 'sun');
            }
            refreshIcons();
            toast(`Theme set to ${t}`);
        }

        function switchDashboardTab(tab, element) {
            if (element) {
                document.querySelectorAll('.sidebar-nav .sidebar-item').forEach(i => i.classList.remove('active'));
                element.classList.add('active');
            }
            if (tab === 'trash') {
                showTrashView(element);
                return;
            }
            if (tab === 'starred') {
                showStarredView(element);
                return;
            }
            showWorkspaceDashboardView(null);
        }

        let googleAuthInitialized = false;