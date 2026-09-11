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
            { label: 'Greek', icon: 'α,β,θ', code: '\\alpha + \\beta = \\theta' },
            { label: 'Aligned Definitions', icon: '{x=text}', code: '\\begin{array}{rll}\n  T & = \\text{Temperature field} & (\\text{K}\\text{ or }^{\\circ}\\text{C}) \\\\\n  t & = \\text{Time} & (\\text{s}) \\\\\n  \\rho & = \\text{Density of the medium} & (\\text{kg/m}^3) \\\\\n  c_p & = \\text{Specific heat capacity at constant pressure} & (\\text{J/kg}\\cdot\\text{K}) \\\\\n  k & = \\text{Thermal conductivity} & (\\text{W/m}\\cdot\\text{K}) \\\\\n  \\dot{q} & = \\text{Volumetric internal heat generation rate} & (\\text{W/m}^3)\n\\end{array}' }
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
    renderToString(latexSource, displayMode = true) {
        if (!latexSource || !latexSource.trim()) {
            return '<span class="latex-placeholder-text">Double-click to write LaTeX formula</span>';
        }

        let trimmed = latexSource.trim();

        // 1. If text is a bullet list of variable definitions (e.g. * $T$ = Temperature field (K)),
        // auto-convert to aligned system LaTeX so equations and text are formatted in correct positions together!
        const alignedLatex = this.convertBulletMathToAlignedLatex(trimmed);
        if (alignedLatex) {
            trimmed = alignedLatex;
        } else if (this.isMixedTextAndMath(trimmed)) {
            return this.renderMixedTextAndMath(trimmed);
        }

        // 2. If KaTeX is loaded, use it for standard mathematical typography
        if (typeof window.katex !== 'undefined' && typeof window.katex.renderToString === 'function') {
            try {
                return window.katex.renderToString(trimmed, {
                    displayMode: !!displayMode,
                    throwOnError: false,
                    output: 'htmlAndMathml'
                });
            } catch (e) {
                console.warn('KaTeX render warning, falling back to internal math parser:', e.message);
                try {
                    return this.fallbackParseLatex(trimmed);
                } catch (e2) {
                    return `<span class="katex-error" title="${this.escapeAttribute(e.message)}">${this.escapeHtml(trimmed)}</span>`;
                }
            }
        }

        // 3. Built-in zero-dependency robust Math parser fallback
        return this.fallbackParseLatex(trimmed);
    }

    /**
     * Converts a bullet list of equations/variable definitions into an aligned LaTeX array
     * so that the equations and text descriptions are formatted with correct position together
     */
    convertBulletMathToAlignedLatex(text) {
        if (!text) return null;
        const lines = text.trim().split(/\r?\n/);
        const parsedRows = [];

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            // Matches: * $T$ = Temperature field ($K$ or $^{\circ}C$) OR $T$ = Temperature field ...
            const match = line.match(/^[ \t]*[-*]?\s*\$?([^\$=]+?)\$?\s*=\s*(.+)$/);
            if (match) {
                let sym = match[1].trim();
                let rest = match[2].trim();
                const unitMatch = rest.match(/\(([^()]+)\)$/);
                let unit = '';
                let desc = rest;
                if (unitMatch) {
                    unit = this.formatLatexUnit(unitMatch[0].trim());
                    desc = rest.substring(0, rest.length - unitMatch[0].length).trim();
                }
                parsedRows.push({ sym, desc, unit });
            }
        }

        if (parsedRows.length >= 2) {
            const body = parsedRows.map(r => {
                const u = r.unit ? ` & ${r.unit}` : ' &';
                return `  ${r.sym} & = \\text{${r.desc}} ${u}`;
            }).join(' \\\\\n');
            return `\\begin{array}{rll}\n${body}\n\\end{array}`;
        }
        return null;
    }

    /**
     * Formats units for aligned LaTeX array with math mode typography
     */
    formatLatexUnit(unitStr) {
        if (!unitStr) return '';
        let u = unitStr.trim();
        let hasParens = false;
        if (u.startsWith('(') && u.endsWith(')')) {
            hasParens = true;
            u = u.substring(1, u.length - 1).trim();
        }
        u = u.replace(/\$/g, '').trim();

        if (u.includes('\\text')) {
            return hasParens ? `(${u})` : u;
        }

        u = u.replace(/\bor\b/g, '\\text{or}');

        const knownLatex = new Set(['cdot', 'circ', 'times', 'prime', 'text', 'partial', 'alpha', 'beta', 'mu', 'sigma', 'omega', 'or']);
        u = u.replace(/\b([A-Za-z]+)\b/g, (match, word, offset, string) => {
            if (offset > 0 && string[offset - 1] === '\\') return word;
            if (knownLatex.has(word)) return word;
            return `\\text{${word}}`;
        });

        u = u.replace(/\\text\{or\}/g, '\\text{ or }');

        return hasParens ? `(${u})` : u;
    }

    /**
     * Detects if content contains mixed prose and formulas (e.g. Where: * $T$ = ...)
     */
    isMixedTextAndMath(source) {
        if (!source || typeof source !== 'string') return false;
        return (source.includes('\n') || source.length > 50) && /\$[^$]+\$/.test(source);
    }

    /**
     * Renders mixed prose and math equations into styled HTML with KaTeX inline
     */
    renderMixedTextAndMath(source) {
        if (!source) return '';
        const lines = source.split('\n');
        let html = '<div class="latex-mixed-content" style="text-align: left; font-size: 0.95rem; line-height: 1.6;">';

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            let isBullet = false;
            if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
                isBullet = true;
                line = line.substring(2).trim();
            }

            const formattedLine = line.replace(/\$([^$]+)\$/g, (match, formula) => {
                const trimmed = formula.trim();
                if (typeof window.katex !== 'undefined' && typeof window.katex.renderToString === 'function') {
                    try {
                        return window.katex.renderToString(trimmed, { displayMode: false, throwOnError: false });
                    } catch (e) {
                        return `<code class="math-code-fallback">${this.escapeHtml(trimmed)}</code>`;
                    }
                }
                return `<span class="math-fallback-inline">${this.fallbackParseLatex(trimmed)}</span>`;
            });

            if (isBullet) {
                html += `<div style="display: flex; gap: 0.5rem; margin: 0.3rem 0; align-items: baseline;"><span style="color: #8b5cf6;">•</span><div>${formattedLine}</div></div>`;
            } else {
                html += `<div style="margin: 0.35rem 0; font-weight: 500;">${formattedLine}</div>`;
            }
        }

        html += '</div>';
        return html;
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
    compileHoverCard(keepOpen = false) {
        const input = document.getElementById('latexHoverSourceInput');
        if (!input) return;

        let newSource = input.value.trim();
        const autoConverted = this.convertBulletMathToAlignedLatex(newSource);
        if (autoConverted) {
            newSource = autoConverted;
            input.value = newSource;
        }

        // Handle inline equation update
        if (this.activeInlineEl) {
            const inline = this.activeInlineEl;
            inline.setAttribute('data-latex-source', newSource);
            const size = inline.getAttribute('data-latex-size') || '1rem';
            inline.innerHTML = this.renderToString(newSource, false);
            inline.style.fontSize = size;

            if (typeof window.onDocChange === 'function') window.onDocChange();
            if (typeof window.updateDocStats === 'function') window.updateDocStats();
            if (typeof window.toast === 'function') window.toast('Inline LaTeX equation updated!');
            if (!keepOpen) this.closeHoverEditor();
            return;
        }

        // Handle block equation card update
        if (this.activeHoverCardId) {
            const card = document.getElementById(this.activeHoverCardId);
            if (!card) return;

            card.setAttribute('data-latex-source', newSource);
            card.setAttribute('data-latex-compiled', 'true');
            card.classList.remove('is-draft');
            card.classList.add('is-compiled');

            const currentSize = card.getAttribute('data-latex-size') || '1.2rem';
            let renderedWrap = card.querySelector('.latex-rendered-math');
            if (!renderedWrap) {
                const wrap = card.querySelector('.doc-latex-rendered-wrap') || card;
                renderedWrap = document.createElement('div');
                renderedWrap.className = 'latex-rendered-math';
                wrap.appendChild(renderedWrap);
            }

            renderedWrap.innerHTML = this.renderToString(newSource, true);
            renderedWrap.style.fontSize = currentSize;

            if (typeof window.onDocChange === 'function') window.onDocChange();
            if (typeof window.updateDocStats === 'function') window.updateDocStats();
            if (typeof window.toast === 'function') window.toast('LaTeX equation compiled!');
            if (!keepOpen) this.closeHoverEditor();
        }
    }

    /**
     * Converts an inline math equation into a full draggable equation box
     */
    convertInlineToCard() {
        if (!this.activeInlineEl) return;
        const inline = this.activeInlineEl;
        const source = inline.getAttribute('data-latex-source') || inline.textContent.trim();

        const sheet = document.getElementById('docPageSheet');
        const cardHtml = this.generateCardHtml(source, '1.2rem');

        const temp = document.createElement('div');
        temp.innerHTML = cardHtml;
        const newCard = temp.firstElementChild;

        inline.parentNode.replaceChild(newCard, inline);
        this.activeInlineEl = null;

        if (sheet) {
            this.initAllCards(sheet);
        }

        this.openHoverEditor(newCard);
        if (typeof window.toast === 'function') window.toast('Converted to full LaTeX equation card!');
    }

    /**
     * Opens the AI palette with current LaTeX formula for generation or fixes
     */
    promptAiForEquation() {
        const input = document.getElementById('latexHoverSourceInput');
        const formula = input ? input.value.trim() : '';

        window._codeLatexContext = {
            type: 'latex',
            selectedText: formula,
            element: this.activeInlineEl || (this.activeHoverCardId ? document.getElementById(this.activeHoverCardId) : null)
        };

        if (typeof window.openAiPalette === 'function') {
            window.openAiPalette();
        } else if (typeof window.toast === 'function') {
            window.toast('AI Assistant opened');
        }
    }

    openInlineEditor(inlineEl, event) {
        this.openHoverEditor(inlineEl, event);
    }

    /**
     * Copies LaTeX source from the hover card
     */
    copyHoverSource() {
        const input = document.getElementById('latexHoverSourceInput');
        if (!input) return;

        navigator.clipboard.writeText(input.value).then(() => {
            if (typeof window.toast === 'function') {
                window.toast('Copied LaTeX formula to clipboard!');
            }
        });
    }

    /**
     * Deletes the currently edited equation
     */
    deleteHoverCard() {
        if (this.activeInlineEl) {
            this.activeInlineEl.remove();
            this.activeInlineEl = null;
            this.closeHoverEditor();
            if (typeof window.onDocChange === 'function') window.onDocChange();
            return;
        }

        if (this.activeHoverCardId) {
            const card = document.getElementById(this.activeHoverCardId);
            if (card) card.remove();
            this.closeHoverEditor();
            if (typeof window.onDocChange === 'function') window.onDocChange();
            if (typeof window.updateDocStats === 'function') window.updateDocStats();
        }
    }

    /**
     * Scans document sheet and compiles all uncompiled $$block$$ and $inline$ formulas
     */
    compileAllMathInDocument(container = null) {
        const root = container || document.getElementById('docPageSheet');
        if (!root) return 0;

        let compiledCount = 0;

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (!node.nodeValue || !node.nodeValue.includes('$')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    let parent = node.parentElement;
                    while (parent && parent !== root) {
                        if (
                            parent.classList.contains('doc-latex-card') ||
                            parent.classList.contains('doc-latex-inline') ||
                            parent.classList.contains('doc-latex-hover-card') ||
                            ['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)
                        ) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        parent = parent.parentElement;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodesToProcess = [];
        let currentNode;
        while ((currentNode = walker.nextNode())) {
            nodesToProcess.push(currentNode);
        }

        for (const textNode of nodesToProcess) {
            const raw = textNode.nodeValue;
            if (!raw || !raw.includes('$')) continue;

            const regex = /(\$\$[\s\S]+?\$\$|\$(?!\$)[^\$\n]+?\$)/g;
            if (!regex.test(raw)) continue;

            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;
            regex.lastIndex = 0;

            while ((match = regex.exec(raw)) !== null) {
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(raw.substring(lastIndex, match.index)));
                }

                const token = match[0];
                const isBlock = token.startsWith('$$') && token.endsWith('$$');
                const formula = isBlock ? token.slice(2, -2).trim() : token.slice(1, -1).trim();

                if (isBlock) {
                    const cardWrapper = document.createElement('div');
                    cardWrapper.innerHTML = this.generateCardHtml(formula, '1.2rem');
                    while (cardWrapper.firstChild) {
                        fragment.appendChild(cardWrapper.firstChild);
                    }
                    compiledCount++;
                } else {
                    const inlineEl = document.createElement('span');
                    inlineEl.className = 'doc-latex-inline';
                    inlineEl.setAttribute('data-latex-source', formula);
                    inlineEl.setAttribute('data-latex-size', '1rem');
                    inlineEl.title = 'Click to edit formula ($' + formula + '$)';
                    inlineEl.innerHTML = this.renderToString(formula, false);
                    inlineEl.onclick = (e) => this.openInlineEditor(inlineEl, e);
                    fragment.appendChild(inlineEl);
                    compiledCount++;
                }

                lastIndex = regex.lastIndex;
            }

            if (lastIndex < raw.length) {
                fragment.appendChild(document.createTextNode(raw.substring(lastIndex)));
            }

            if (textNode.parentNode) {
                textNode.parentNode.replaceChild(fragment, textNode);
            }
        }

        this.initAllCards(root);

        if (typeof window.onDocChange === 'function') window.onDocChange();
        if (typeof window.updateDocStats === 'function') window.updateDocStats();

        if (typeof window.toast === 'function') {
            window.toast(`∑ Formatted ${compiledCount} math formula${compiledCount === 1 ? '' : 's'} in document`);
        }

        return compiledCount;
    }

    /**
     * Initializes all .doc-latex-card elements in container
     */
    initAllCards(container = document.getElementById('docPageSheet')) {
        if (!container) return;

        const cards = container.querySelectorAll('.doc-latex-card');
        cards.forEach(card => {
            if (!card.id) {
                card.id = 'latex_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            }

            const source = card.getAttribute('data-latex-source') || '';
            const size = card.getAttribute('data-latex-size') || '1.2rem';
            const posX = card.getAttribute('data-latex-x');
            const posY = card.getAttribute('data-latex-y');
            const isFloating = card.getAttribute('data-latex-floating') === 'true' || card.classList.contains('is-floating') || (card.style.position === 'absolute' && card.style.left);
            
            let renderedWrap = card.querySelector('.latex-rendered-math');
            if (!renderedWrap) {
                const wrap = card.querySelector('.doc-latex-rendered-wrap') || card;
                renderedWrap = document.createElement('div');
                renderedWrap.className = 'latex-rendered-math';
                wrap.appendChild(renderedWrap);
            }

            if (source) {
                renderedWrap.innerHTML = this.renderToString(source, true);
                renderedWrap.style.fontSize = size;
                card.classList.remove('is-draft');
                card.classList.add('is-compiled');
            }

            // Ensure Drag Handle
            if (!card.querySelector('.latex-drag-handle')) {
                const handle = document.createElement('div');
                handle.className = 'latex-drag-handle';
                handle.title = 'Drag to reposition equation';
                handle.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle>
                        <circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle>
                    </svg>
                `;
                card.prepend(handle);
            }

            // Ensure Quick Edit Pill
            let editPill = card.querySelector('.latex-quick-edit-pill');
            if (!editPill) {
                editPill = document.createElement('div');
                editPill.className = 'latex-quick-edit-pill';
                editPill.title = 'Click to edit LaTeX formula';
                editPill.innerHTML = `
                    <span class="latex-logo-mini">L<sup>A</sup>T<sub>E</sub>X</span>
                    <span>Edit ✎</span>
                `;
                card.appendChild(editPill);
            }
            editPill.onclick = (e) => this.openHoverEditor(card, e);

            // Ensure Resize Handle
            if (!card.querySelector('.latex-equation-resize-handle')) {
                const resizer = document.createElement('div');
                resizer.className = 'latex-equation-resize-handle';
                resizer.title = 'Drag to scale equation font size';
                resizer.innerHTML = `
                    <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="21 15 21 21 15 21"></polyline>
                        <line x1="21" y1="21" x2="14" y2="14"></line>
                    </svg>
                `;
                card.appendChild(resizer);
            }

            // Bind click & double click to open hover editor
            card.onclick = (e) => {
                if (e.target.closest('.latex-drag-handle') || e.target.closest('.latex-equation-resize-handle')) {
                    return;
                }
                this.openHoverEditor(card, e);
            };
            card.ondblclick = (e) => this.openHoverEditor(card, e);

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

        const inlines = container.querySelectorAll('.doc-latex-inline');
        inlines.forEach(inline => {
            inline.onclick = (e) => this.openInlineEditor(inline, e);
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

    setupCardDragAndDrop(card) {
        if (card.__dragSetup) return;
        card.__dragSetup = true;

        const dragGrip = card.querySelector('.latex-drag-handle');
        if (!dragGrip) return;

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
console.log('[ latex-compiler ] SyncPadLatexEngine initialized', !!window.latexEngine, 'katex:', typeof window.katex);
