/**
 * SyncPad LaTeX Engine & Equation Compiler
 * Provides real-time LaTeX math rendering, seamless borderless display,
 * interactive 2D equation resizing & scaling, drag-and-drop repositioning,
 * and a resizable floating hover editor card on double-click.
 */

class SyncPadLatexEngine {
    constructor() {
        this.activeHoverCardId = null;
        this.templates = [
            { label: 'Fraction', icon: 'a/b', code: '\\frac{a}{b}' },
            { label: 'Square Root', icon: '√x', code: '\\sqrt{x}' },
            { label: 'Integral', icon: '∫', code: '\\int_{a}^{b} f(x) \\, dx' },
            { label: 'Summation', icon: '∑', code: '\\sum_{i=1}^{n} x_i' },
            { label: 'Product', icon: '∏', code: '\\prod_{i=1}^{n} a_i' },
            { label: 'Limit', icon: 'lim', code: '\\lim_{x \\to \\infty} f(x)' },
            { label: 'Matrix', icon: '[M]', code: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}' },
            { label: 'Gaussian', icon: 'N(μ,σ)', code: 'f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}' },
            { label: 'Euler', icon: 'e^(iπ)', code: 'e^{i\\pi} + 1 = 0' },
            { label: 'Calculus', icon: 'dy/dx', code: '\\frac{d}{dx}\\left( x^n \\right) = n x^{n-1}' },
            { label: 'Pythagorean', icon: 'a²+b²', code: 'a^2 + b^2 = c^2' },
            { label: 'Greek', icon: 'α,β,θ', code: '\\alpha + \\beta = \\theta' }
        ];

        // Global outside click & escape listeners for the hover card
        document.addEventListener('mousedown', (e) => {
            const hoverCard = document.getElementById('latexHoverEditorCard');
            if (hoverCard && !hoverCard.classList.contains('hidden')) {
                if (!hoverCard.contains(e.target) && !e.target.closest('.doc-latex-card')) {
                    this.closeHoverEditor();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeHoverEditor();
            }
        });
    }

    /**
     * Compiles raw LaTeX string into HTML
     * @param {string} latexSource 
     * @returns {string} Compiled HTML
     */
    renderToString(latexSource) {
        if (!latexSource || !latexSource.trim()) {
            return '<span class="latex-placeholder-text">Double-click to write LaTeX formula</span>';
        }

        const trimmed = latexSource.trim();

        // 1. If KaTeX is loaded, use it for standard mathematical typography
        if (typeof window.katex !== 'undefined' && typeof window.katex.renderToString === 'function') {
            try {
                return window.katex.renderToString(trimmed, {
                    displayMode: true,
                    throwOnError: true,
                    output: 'htmlAndMathml'
                });
            } catch (e) {
                console.warn('KaTeX strict render failed, falling back to internal math parser:', e.message);
                try {
                    return this.fallbackParseLatex(trimmed);
                } catch (e2) {
                    return `<span class="katex-error" title="${this.escapeAttribute(e.message)}">${this.escapeHtml(trimmed)}</span>`;
                }
            }
        }

        // 2. Built-in zero-dependency robust Math parser fallback
        return this.fallbackParseLatex(trimmed);
    }

    /**
     * Built-in fallback mathematical parser for offline or non-KaTeX environments
     */
    fallbackParseLatex(code) {
        let html = code;

        // Escape raw HTML characters
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Matrices & Environments
        html = html.replace(/\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g, (match, inner) => {
            const rows = inner.split('\\\\').map(row => {
                const cols = row.split('&amp;').map(c => `<td class="math-matrix-cell">${this.fallbackParseLatex(c.trim())}</td>`).join('');
                return `<tr>${cols}</tr>`;
            }).join('');
            return `<span class="math-bracket-left">[</span><table class="math-matrix-table">${rows}</table><span class="math-bracket-right">]</span>`;
        });

        html = html.replace(/\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g, (match, inner) => {
            const rows = inner.split('\\\\').map(row => {
                const cols = row.split('&amp;').map(c => `<td class="math-matrix-cell">${this.fallbackParseLatex(c.trim())}</td>`).join('');
                return `<tr>${cols}</tr>`;
            }).join('');
            return `<span class="math-bracket-left">(</span><table class="math-matrix-table">${rows}</table><span class="math-bracket-right">)</span>`;
        });

        html = html.replace(/\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/g, (match, inner) => {
            const rows = inner.split('\\\\').map(row => {
                const cols = row.split('&amp;').map(c => `<td class="math-matrix-cell">${this.fallbackParseLatex(c.trim())}</td>`).join('');
                return `<tr>${cols}</tr>`;
            }).join('');
            return `<table class="math-matrix-table">${rows}</table>`;
        });

        // Fractions: \frac{num}{den} (supports nested fractions)
        let fracIter = 0;
        while (html.includes('\\frac') && fracIter < 6) {
            html = html.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (match, num, den) => {
                return `<span class="math-fraction"><span class="math-num">${num}</span><span class="math-den">${den}</span></span>`;
            });
            fracIter++;
        }

        // Roots: \sqrt[n]{x} and \sqrt{x}
        html = html.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, (match, root, content) => {
            return `<span class="math-sqrt"><sup class="math-root-idx">${root}</sup><span class="math-radical">&radic;</span><span class="math-radicand">${content}</span></span>`;
        });
        html = html.replace(/\\sqrt\{([^{}]+)\}/g, (match, content) => {
            return `<span class="math-sqrt"><span class="math-radical">&radic;</span><span class="math-radicand">${content}</span></span>`;
        });

        // Integrals, Summations, Products with limits
        html = html.replace(/\\int_\{([^{}]+)\}\^\{([^{}]+)\}/g, '<span class="math-op-lim"><span class="math-symbol">&int;</span><span class="math-limits"><span class="math-upper">$2</span><span class="math-lower">$1</span></span></span>');
        html = html.replace(/\\sum_\{([^{}]+)\}\^\{([^{}]+)\}/g, '<span class="math-op-lim"><span class="math-symbol">&sum;</span><span class="math-limits"><span class="math-upper">$2</span><span class="math-lower">$1</span></span></span>');
        html = html.replace(/\\prod_\{([^{}]+)\}\^\{([^{}]+)\}/g, '<span class="math-op-lim"><span class="math-symbol">&prod;</span><span class="math-limits"><span class="math-upper">$2</span><span class="math-lower">$1</span></span></span>');
        html = html.replace(/\\lim_\{([^{}]+)\}/g, '<span class="math-op-lim"><span class="math-symbol">lim</span><span class="math-limits"><span class="math-lower">$1</span></span></span>');

        // Simple Integrals / Sums
        html = html.replace(/\\int\b/g, '<span class="math-symbol">&int;</span> ');
        html = html.replace(/\\iint\b/g, '<span class="math-symbol">&int;&int;</span> ');
        html = html.replace(/\\oint\b/g, '<span class="math-symbol">&#8750;</span> ');
        html = html.replace(/\\sum\b/g, '<span class="math-symbol">&sum;</span> ');
        html = html.replace(/\\prod\b/g, '<span class="math-symbol">&prod;</span> ');

        // Greek Symbols
        const greekMap = {
            '\\alpha': '&alpha;', '\\beta': '&beta;', '\\gamma': '&gamma;', '\\delta': '&delta;',
            '\\epsilon': '&epsilon;', '\\varepsilon': '&epsilon;', '\\zeta': '&zeta;', '\\eta': '&eta;',
            '\\theta': '&theta;', '\\vartheta': '&theta;', '\\iota': '&iota;', '\\kappa': '&kappa;',
            '\\lambda': '&lambda;', '\\mu': '&mu;', '\\nu': '&nu;', '\\xi': '&xi;',
            '\\pi': '&pi;', '\\varpi': '&pi;', '\\rho': '&rho;', '\\varrho': '&rho;',
            '\\sigma': '&sigma;', '\\varsigma': '&sigma;', '\\tau': '&tau;', '\\upsilon': '&upsilon;',
            '\\phi': '&phi;', '\\varphi': '&phi;', '\\chi': '&chi;', '\\psi': '&psi;', '\\omega': '&omega;',
            '\\Gamma': '&Gamma;', '\\Delta': '&Delta;', '\\Theta': '&Theta;', '\\Lambda': '&Lambda;',
            '\\Xi': '&Xi;', '\\Pi': '&Pi;', '\\Sigma': '&Sigma;', '\\Upsilon': '&Upsilon;',
            '\\Phi': '&Phi;', '\\Psi': '&Psi;', '\\Omega': '&Omega;'
        };
        for (const [tex, entity] of Object.entries(greekMap)) {
            const re = new RegExp(tex.replace('\\', '\\\\') + '\\b', 'g');
            html = html.replace(re, `<span class="math-greek">${entity}</span>`);
        }

        // Operators & Symbols
        const symbolMap = {
            '\\infty': '&#8734;', '\\nabla': '&#8711;', '\\partial': '&#8706;',
            '\\pm': '&plusmn;', '\\mp': '&#8723;', '\\times': '&times;', '\\div': '&divide;',
            '\\cdot': '&sdot;', '\\approx': '&approx;', '\\neq': '&ne;', '\\ne': '&ne;',
            '\\le': '&le;', '\\leq': '&le;', '\\ge': '&ge;', '\\geq': '&ge;',
            '\\in': '&isin;', '\\notin': '&notin;', '\\subset': '&sub;', '\\subseteq': '&sube;',
            '\\cup': '&cup;', '\\cap': '&cap;', '\\to': '&rarr;', '\\rightarrow': '&rarr;',
            '\\Rightarrow': '&rArr;', '\\leftarrow': '&larr;', '\\Leftarrow': '&lArr;',
            '\\leftrightarrow': '&harr;', '\\forall': '&forall;', '\\exists': '&exist;',
            '\\neg': '&not;', '\\circ': '&compfn;', '\\quad': '&nbsp;&nbsp;', '\\qquad': '&nbsp;&nbsp;&nbsp;&nbsp;'
        };
        for (const [tex, entity] of Object.entries(symbolMap)) {
            const re = new RegExp(tex.replace('\\', '\\\\') + '\\b', 'g');
            html = html.replace(re, `<span class="math-operator">${entity}</span>`);
        }

        // Text & formatting
        html = html.replace(/\\text\{([^{}]+)\}/g, '<span class="math-text">$1</span>');
        html = html.replace(/\\mathbf\{([^{}]+)\}/g, '<strong class="math-bold">$1</strong>');
        html = html.replace(/\\mathit\{([^{}]+)\}/g, '<em class="math-italic">$1</em>');
        html = html.replace(/\\mathrm\{([^{}]+)\}/g, '<span class="math-roman">$1</span>');

        // Delimiters
        html = html.replace(/\\left\(/g, '<span class="math-bracket-left">(</span>');
        html = html.replace(/\\right\)/g, '<span class="math-bracket-right">)</span>');
        html = html.replace(/\\left\[/g, '<span class="math-bracket-left">[</span>');
        html = html.replace(/\\right\]/g, '<span class="math-bracket-right">]</span>');
        html = html.replace(/\\left\\\{/g, '<span class="math-bracket-left">{</span>');
        html = html.replace(/\\right\\\}/g, '<span class="math-bracket-right">}</span>');
        html = html.replace(/\\left\|/g, '<span class="math-bracket-left">|</span>');
        html = html.replace(/\\right\|/g, '<span class="math-bracket-right">|</span>');

        // Superscripts & Subscripts: x^{y} or x^2, x_{y} or x_i
        html = html.replace(/\^\{([^{}]+)\}/g, '<sup class="math-sup">$1</sup>');
        html = html.replace(/\^([0-9a-zA-Z])/g, '<sup class="math-sup">$1</sup>');
        html = html.replace(/_\{([^{}]+)\}/g, '<sub class="math-sub">$1</sub>');
        html = html.replace(/_([0-9a-zA-Z])/g, '<sub class="math-sub">$1</sub>');

        return `<div class="math-fallback-render">${html}</div>`;
    }

    /**
     * Builds a clean, borderless compiled equation block with draggable & resizable capabilities
     * @param {string} initialSource 
     * @param {string} initialSize 
     * @returns {string} HTML string
     */
    generateCardHtml(initialSource = '', initialSize = '1.2rem') {
        const id = 'latex_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const defaultFormula = initialSource || 'f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi) e^{2\\pi i \\xi x} d\\xi';
        const compiledHtml = this.renderToString(defaultFormula);

        return `
            <div class="doc-latex-card is-compiled" id="${id}" data-latex-card="true" data-latex-source="${this.escapeAttribute(defaultFormula)}" data-latex-compiled="true" data-latex-size="${initialSize}" draggable="true" contenteditable="false" ondblclick="window.latexEngine.openHoverEditor('${id}', event)" title="Double click to edit LaTeX equation • Drag to reposition • Drag handle to resize">
                <!-- Draggable Grip Handle -->
                <div class="latex-drag-handle" title="Drag to move equation">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="5" r="1"></circle>
                        <circle cx="9" cy="12" r="1"></circle>
                        <circle cx="9" cy="19" r="1"></circle>
                        <circle cx="15" cy="5" r="1"></circle>
                        <circle cx="15" cy="12" r="1"></circle>
                        <circle cx="15" cy="19" r="1"></circle>
                    </svg>
                </div>

                <!-- Floating Quick Edit Pill on Hover -->
                <div class="latex-quick-edit-pill" onclick="window.latexEngine.openHoverEditor('${id}', event)" title="Click to edit LaTeX formula">
                    <span class="latex-logo-mini">L<sup>A</sup>T<sub>E</sub>X</span>
                    <span>Edit ✎</span>
                </div>

                <!-- Pure Rendered Math (No card borders or boxes) -->
                <div class="doc-latex-rendered-wrap">
                    <div class="latex-rendered-math" style="font-size: ${initialSize};">${compiledHtml}</div>
                </div>

                <!-- Interactive 2D Equation Size Resizer Handle -->
                <div class="latex-equation-resize-handle" title="Click and drag to scale equation size">
                    <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="21 15 21 21 15 21"></polyline>
                        <line x1="21" y1="21" x2="14" y2="14"></line>
                    </svg>
                </div>
            </div><p></p>
        `;
    }

    /**
     * Ensures the global floating hover editor card exists in DOM
     */
    ensureHoverCardElement() {
        let hoverCard = document.getElementById('latexHoverEditorCard');
        if (hoverCard) return hoverCard;

        const templateButtons = this.templates.map(t => 
            `<button type="button" class="latex-pill-btn" onclick="window.latexEngine.insertHoverTemplate('${t.code.replace(/\\/g, '\\\\')}')" title="${t.label}">
                <span>${t.icon}</span>
             </button>`
        ).join('');

        const html = `
            <div id="latexHoverEditorCard" class="doc-latex-hover-card hidden" contenteditable="false">
                <div class="doc-latex-header">
                    <div class="latex-header-left">
                        <div class="latex-brand-tag">
                            <span class="latex-logo-txt">L<sup>A</sup>T<sub>E</sub>X</span>
                            <span class="latex-title-txt">Edit Formula</span>
                        </div>
                        
                        <!-- Equation Scale & Size Controls -->
                        <div class="latex-size-controls">
                            <button type="button" class="latex-size-step-btn" onclick="window.latexEngine.stepActiveCardSize(-0.15)" title="Decrease equation size">A−</button>
                            <span id="latexHoverSizeBadge" class="latex-size-badge" title="Current equation font size">1.2rem</span>
                            <button type="button" class="latex-size-step-btn" onclick="window.latexEngine.stepActiveCardSize(0.15)" title="Increase equation size">A+</button>
                            
                            <div class="latex-size-presets">
                                <button type="button" class="latex-size-btn" onclick="window.latexEngine.setActiveCardSize('0.9rem')" title="Small (0.9rem)">S</button>
                                <button type="button" class="latex-size-btn" onclick="window.latexEngine.setActiveCardSize('1.2rem')" title="Medium (1.2rem)">M</button>
                                <button type="button" class="latex-size-btn" onclick="window.latexEngine.setActiveCardSize('1.6rem')" title="Large (1.6rem)">L</button>
                                <button type="button" class="latex-size-btn" onclick="window.latexEngine.setActiveCardSize('2.2rem')" title="Extra Large (2.2rem)">XL</button>
                            </div>
                        </div>
                    </div>

                    <div class="latex-template-pills">
                        ${templateButtons}
                    </div>

                    <div class="latex-header-actions">
                        <button type="button" class="btn-latex-compile" onclick="window.latexEngine.compileHoverCard()" title="Compile and update equation (Ctrl+Enter)">
                            <i data-lucide="play" style="width: 12px; height: 12px;"></i>
                            <span>Compile</span>
                        </button>
                        <button type="button" class="btn-latex-copy" onclick="window.latexEngine.copyHoverSource()" title="Copy LaTeX">
                            <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                        </button>
                        <button type="button" class="btn-latex-delete" onclick="window.latexEngine.deleteHoverCard()" title="Delete Equation">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                        <button type="button" class="btn-latex-close" onclick="window.latexEngine.closeHoverEditor()" title="Close (Esc)">
                            <i data-lucide="x" style="width: 13px; height: 13px;"></i>
                        </button>
                    </div>
                </div>

                <div class="doc-latex-editor-wrap">
                    <textarea id="latexHoverSourceInput" class="latex-source-input" placeholder="e.g. \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}" spellcheck="false" oninput="window.latexEngine.updateHoverPreview()" onkeydown="window.latexEngine.handleHoverKeyDown(event)"></textarea>
                    <div class="latex-editor-hint">
                        <span>💡 Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> or <kbd>⌘</kbd>+<kbd>Enter</kbd> to compile. Drag bottom-right corner to resize card.</span>
                        <span style="color: #8b5cf6; font-weight: 600; font-size: 0.7rem;">Live Math Preview</span>
                    </div>
                </div>

                <div class="latex-hover-preview-wrap">
                    <div id="latexHoverLivePreviewMath" class="latex-rendered-math"></div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstElementChild);

        if (window.lucide) window.lucide.createIcons();
        return document.getElementById('latexHoverEditorCard');
    }

    /**
     * Sets active card equation font size / scale
     */
    setActiveCardSize(sizeStr) {
        if (!this.activeHoverCardId) return;
        const card = document.getElementById(this.activeHoverCardId);
        if (!card) return;

        const rendered = card.querySelector('.latex-rendered-math');
        const preview = document.getElementById('latexHoverLivePreviewMath');
        const badge = document.getElementById('latexHoverSizeBadge');

        card.setAttribute('data-latex-size', sizeStr);
        if (rendered) rendered.style.fontSize = sizeStr;
        if (preview) preview.style.fontSize = sizeStr;
        if (badge) badge.textContent = sizeStr;

        if (typeof window.onDocChange === 'function') {
            window.onDocChange();
        }
    }

    /**
     * Steps active card equation font size up or down
     */
    stepActiveCardSize(deltaRem) {
        if (!this.activeHoverCardId) return;
        const card = document.getElementById(this.activeHoverCardId);
        if (!card) return;

        const current = parseFloat(card.getAttribute('data-latex-size') || '1.2') || 1.2;
        const next = Math.max(0.75, Math.min(3.5, current + deltaRem)).toFixed(2);
        this.setActiveCardSize(`${next}rem`);
    }

    /**
     * Opens the floating hover editor card anchored over/under the target equation
     */
    openHoverEditor(cardOrId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const card = typeof cardOrId === 'string' ? document.getElementById(cardOrId) : cardOrId;
        if (!card) return;

        this.activeHoverCardId = card.id;
        const source = card.getAttribute('data-latex-source') || '';
        const currentSize = card.getAttribute('data-latex-size') || '1.2rem';

        const hoverCard = this.ensureHoverCardElement();
        const input = document.getElementById('latexHoverSourceInput');
        const preview = document.getElementById('latexHoverLivePreviewMath');
        const badge = document.getElementById('latexHoverSizeBadge');

        if (input) {
            input.value = source;
        }
        if (preview) {
            preview.innerHTML = this.renderToString(source);
            preview.style.fontSize = currentSize;
        }
        if (badge) {
            badge.textContent = currentSize;
        }

        hoverCard.classList.remove('hidden');

        // Calculate positioning anchored to the equation card
        const rect = card.getBoundingClientRect();
        const cardW = 580;
        const cardH = 270;

        let top = rect.top - cardH - 12;
        if (top < 70) {
            top = rect.bottom + 12;
        }
        let left = rect.left + (rect.width / 2) - (cardW / 2);
        if (left < 16) left = 16;
        if (left + cardW > window.innerWidth - 16) {
            left = window.innerWidth - cardW - 16;
        }

        hoverCard.style.top = `${Math.max(60, top)}px`;
        hoverCard.style.left = `${Math.max(16, left)}px`;

        if (input) {
            input.focus();
            const len = input.value.length;
            input.setSelectionRange(len, len);
        }

        if (window.lucide) window.lucide.createIcons();
    }

    /**
     * Closes the floating hover editor
     */
    closeHoverEditor() {
        const hoverCard = document.getElementById('latexHoverEditorCard');
        if (hoverCard) {
            hoverCard.classList.add('hidden');
        }
        this.activeHoverCardId = null;
    }

    /**
     * Updates the live math preview inside the hover card while typing
     */
    updateHoverPreview() {
        const input = document.getElementById('latexHoverSourceInput');
        const preview = document.getElementById('latexHoverLivePreviewMath');
        if (input && preview) {
            preview.innerHTML = this.renderToString(input.value);
        }
    }

    /**
     * Handles keyboard shortcuts inside the hover textarea
     */
    handleHoverKeyDown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.compileHoverCard();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.closeHoverEditor();
        }
    }

    /**
     * Inserts a template snippet into the hover card textarea
     */
    insertHoverTemplate(snippet) {
        const input = document.getElementById('latexHoverSourceInput');
        if (!input) return;

        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        input.value = text.substring(0, start) + snippet + text.substring(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + snippet.length;
        this.updateHoverPreview();
    }

    /**
     * Compiles and applies changes from the hover editor to the target document equation
     */
    compileHoverCard() {
        if (!this.activeHoverCardId) return;
        const card = document.getElementById(this.activeHoverCardId);
        const input = document.getElementById('latexHoverSourceInput');
        if (!card || !input) return;

        const newSource = input.value.trim();
        card.setAttribute('data-latex-source', newSource);
        card.setAttribute('data-latex-compiled', 'true');
        card.classList.remove('is-draft');
        card.classList.add('is-compiled');

        const currentSize = card.getAttribute('data-latex-size') || '1.2rem';
        const renderedWrap = card.querySelector('.latex-rendered-math');
        if (renderedWrap) {
            renderedWrap.innerHTML = this.renderToString(newSource);
            renderedWrap.style.fontSize = currentSize;
        }

        this.closeHoverEditor();

        if (typeof window.onDocChange === 'function') {
            window.onDocChange();
        }
        if (typeof window.updateDocStats === 'function') {
            window.updateDocStats();
        }
        if (typeof window.showToastNotification === 'function') {
            window.showToastNotification('LaTeX equation compiled successfully!', 'success');
        }
    }

    /**
     * Copies LaTeX source from the hover card
     */
    copyHoverSource() {
        const input = document.getElementById('latexHoverSourceInput');
        if (!input) return;

        navigator.clipboard.writeText(input.value).then(() => {
            if (typeof window.showToastNotification === 'function') {
                window.showToastNotification('Copied LaTeX formula to clipboard!', 'success');
            }
        });
    }

    /**
     * Deletes the currently edited equation
     */
    deleteHoverCard() {
        if (!this.activeHoverCardId) return;
        const card = document.getElementById(this.activeHoverCardId);
        if (card) card.remove();
        this.closeHoverEditor();

        if (typeof window.onDocChange === 'function') {
            window.onDocChange();
        }
        if (typeof window.updateDocStats === 'function') {
            window.updateDocStats();
        }
    }

    /**
     * Scans document and initializes draggable & resizable capabilities
     */
    initAllCards(container = document.getElementById('docPageSheet')) {
        if (!container) return;

        const cards = container.querySelectorAll('.doc-latex-card');
        cards.forEach(card => {
            const source = card.getAttribute('data-latex-source');
            const size = card.getAttribute('data-latex-size') || '1.2rem';
            const posX = card.getAttribute('data-latex-x');
            const posY = card.getAttribute('data-latex-y');
            const isFloating = card.getAttribute('data-latex-floating') === 'true' || card.classList.contains('is-floating') || (card.style.position === 'absolute' && card.style.left);
            const renderedWrap = card.querySelector('.latex-rendered-math');

            if (source && renderedWrap) {
                renderedWrap.innerHTML = this.renderToString(source);
                renderedWrap.style.fontSize = size;
                card.classList.remove('is-draft');
                card.classList.add('is-compiled');
            }

            if (isFloating && posX !== null && posY !== null) {
                card.style.position = 'absolute';
                card.style.left = `${posX}px`;
                card.style.top = `${posY}px`;
                card.style.zIndex = '25';
                card.style.margin = '0';
                card.classList.add('is-floating');
            }

            this.setupCardDragAndDrop(card);
            this.setupCardResizer(card);
        });
    }

    /**
     * Sets up interactive 2D sizing handle on the document equation
     */
    setupCardResizer(card) {
        if (card.__resizeSetup) return;
        card.__resizeSetup = true;

        const handle = card.querySelector('.latex-equation-resize-handle');
        if (!handle) return;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const renderedMath = card.querySelector('.latex-rendered-math');
            if (!renderedMath) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const startRem = parseFloat(card.getAttribute('data-latex-size') || '1.2') || 1.2;
            let currentRem = startRem;

            let tooltip = document.getElementById('latexResizeTooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'latexResizeTooltip';
                tooltip.className = 'latex-resize-tooltip';
                document.body.appendChild(tooltip);
            }

            card.classList.add('is-resizing');

            const onMouseMove = (moveEv) => {
                const deltaX = moveEv.clientX - startX;
                const deltaY = moveEv.clientY - startY;
                const delta = (deltaX + deltaY) / 2;
                
                // Scale smoothly between 0.6rem and 5.0rem
                currentRem = Math.max(0.6, Math.min(5.0, startRem + (delta * 0.015))).toFixed(2);

                renderedMath.style.fontSize = `${currentRem}rem`;
                card.setAttribute('data-latex-size', `${currentRem}rem`);

                const percent = Math.round((currentRem / 1.2) * 100);
                tooltip.textContent = `Scale: ${percent}% • ${currentRem}rem`;
                tooltip.style.left = `${moveEv.clientX + 14}px`;
                tooltip.style.top = `${moveEv.clientY - 28}px`;
                tooltip.style.display = 'block';
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                card.classList.remove('is-resizing');
                if (tooltip) tooltip.style.display = 'none';

                if (typeof window.onDocChange === 'function') {
                    window.onDocChange();
                }
                if (typeof window.updateDocStats === 'function') {
                    window.updateDocStats();
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    /**
     * Sets up direct pixel drag-and-drop to place equation anywhere on page without affecting text
     */
    setupCardDragAndDrop(card) {
        if (card.__dragSetup) return;
        card.__dragSetup = true;

        const dragGrip = card.querySelector('.latex-drag-handle') || card;

        dragGrip.addEventListener('mousedown', (e) => {
            if (e.target.closest('.latex-equation-resize-handle') || e.target.closest('.latex-quick-edit-pill') || e.target.closest('button')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();

            const sheet = card.closest('.doc-page-sheet') || document.getElementById('docPageSheet');
            if (!sheet) return;

            const sheetRect = sheet.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();

            // Calculate starting offset of mouse relative to card's top-left
            const offsetX = e.clientX - cardRect.left;
            const offsetY = e.clientY - cardRect.top;

            // Ensure card is floating with absolute position inside the sheet
            const initialLeft = Math.round(cardRect.left - sheetRect.left + sheet.scrollLeft);
            const initialTop = Math.round(cardRect.top - sheetRect.top + sheet.scrollTop);

            card.style.position = 'absolute';
            card.style.left = `${initialLeft}px`;
            card.style.top = `${initialTop}px`;
            card.style.zIndex = '40';
            card.style.margin = '0';
            card.classList.add('is-floating', 'is-dragging');
            card.setAttribute('data-latex-floating', 'true');
            card.setAttribute('data-latex-x', initialLeft);
            card.setAttribute('data-latex-y', initialTop);

            // Move card directly to sheet container if not already direct child so it floats cleanly
            if (card.parentElement !== sheet) {
                sheet.appendChild(card);
            }

            const onMouseMove = (moveEv) => {
                const curSheetRect = sheet.getBoundingClientRect();
                const curLeft = Math.round(moveEv.clientX - curSheetRect.left + sheet.scrollLeft - offsetX);
                const curTop = Math.round(moveEv.clientY - curSheetRect.top + sheet.scrollTop - offsetY);

                const boundedLeft = Math.max(0, Math.min(sheet.clientWidth - 40, curLeft));
                const boundedTop = Math.max(0, curTop);

                card.style.left = `${boundedLeft}px`;
                card.style.top = `${boundedTop}px`;
                card.setAttribute('data-latex-x', boundedLeft);
                card.setAttribute('data-latex-y', boundedTop);
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                card.classList.remove('is-dragging');
                card.style.zIndex = '25';

                if (typeof window.onDocChange === 'function') {
                    window.onDocChange();
                }
                if (typeof window.updateDocStats === 'function') {
                    window.updateDocStats();
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    escapeAttribute(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}

// Global Singleton
window.latexEngine = new SyncPadLatexEngine();
