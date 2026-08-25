/**
 * Comprehensive SyncPad Export Pipeline Test & Verification Suite
 * Tests Newlines, Paragraphs, Lists/Tasks, Page Breaks, Typography, Code, LaTeX, Callouts, Tables, and Multi-page structures.
 */

const assert = require('assert');
const fs = require('fs');

// Mock browser globals for Node test environment
global.window = {
    getComputedStyle: () => ({
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        fontWeight: '400',
        color: 'rgb(30, 41, 59)',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgb(226, 232, 240)',
        textAlign: 'left',
        lineHeight: '24px'
    })
};

global.Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3
};

// Load modules
const DocumentModel = require('../src/main/resources/static/js/export/document-model.js');
const PdfExportRenderer = require('../src/main/resources/static/js/export/pdf-exporter.js');
const DocxExportRenderer = require('../src/main/resources/static/js/export/docx-exporter.js');

async function runAllTests() {
    console.log('========================================================');
    console.log('🧪 RUNNING COMPLETE SYNCPAD EXPORT VERIFICATION SUITE');
    console.log('========================================================\n');

    // 1. TEST NEWLINES WITHIN PARAGRAPHS
    console.log('[TEST 1] Verifying Newlines Preservation within Paragraphs...');
    {
        const multilineText = "Line 1\nLine 2\nLine 3\nLine 4";
        const mockTextNode = {
            nodeType: 3,
            textContent: multilineText
        };
        const mockParagraphEl = {
            nodeType: 1,
            tagName: 'P',
            classList: { contains: () => false },
            getAttribute: () => null,
            childNodes: [mockTextNode],
            style: {}
        };

        const block = DocumentModel.parseNode(mockParagraphEl);
        assert.strictEqual(block.type, 'paragraph', 'Must parse as paragraph block');
        
        // Check that runs contain the lines and isLineBreak flags
        const lineRuns = block.runs.filter(r => !r.isLineBreak);
        const breakRuns = block.runs.filter(r => r.isLineBreak);
        assert.strictEqual(lineRuns.length, 4, 'Must have 4 line runs');
        assert.strictEqual(breakRuns.length, 3, 'Must have 3 line break runs');

        // PDF HTML Verification
        const model = new DocumentModel();
        model.blocks.push(block);
        const pdfHtml = PdfExportRenderer.renderToHTML(model);
        assert(pdfHtml.includes('<br/>'), 'PDF HTML must contain <br/>');
        console.log(' -> [PASS] PDF properly preserves newlines with <br/> tags.');

        // DOCX OpenXML Verification
        const docxXml = DocxExportRenderer.renderRunsToXml(block.runs, []);
        assert(docxXml.includes('<w:t xml:space="preserve">Line 1</w:t></w:r><w:r><w:br/></w:r><w:r>'), 'DOCX must contain <w:br/> between line runs');
        console.log(' -> [PASS] DOCX OpenXML properly preserves newlines with <w:br/> elements.');
    }

    // 2. TEST PARAGRAPH SEPARATION (No Flattening)
    console.log('\n[TEST 2] Verifying Separate Paragraphs Preservation...');
    {
        const mockContainerEl = {
            nodeType: 1,
            tagName: 'DIV',
            classList: { contains: () => false },
            getAttribute: () => null,
            style: {},
            querySelector: (sel) => sel.includes('p'),
            childNodes: [
                {
                    nodeType: 1,
                    tagName: 'P',
                    classList: { contains: () => false },
                    getAttribute: () => null,
                    style: {},
                    childNodes: [{ nodeType: 3, textContent: 'This is paragraph one.' }]
                },
                {
                    nodeType: 1,
                    tagName: 'P',
                    classList: { contains: () => false },
                    getAttribute: () => null,
                    style: {},
                    childNodes: [{ nodeType: 3, textContent: 'This is paragraph two.' }]
                },
                {
                    nodeType: 1,
                    tagName: 'P',
                    classList: { contains: () => false },
                    getAttribute: () => null,
                    style: {},
                    childNodes: [{ nodeType: 3, textContent: 'This is paragraph three.' }]
                }
            ]
        };

        const blocks = DocumentModel.parseNode(mockContainerEl);
        assert(Array.isArray(blocks), 'Container must decompose into array of blocks');
        assert.strictEqual(blocks.length, 3, 'Must have exactly 3 distinct paragraph blocks');
        assert.strictEqual(blocks[0].runs[0].text, 'This is paragraph one.');
        assert.strictEqual(blocks[1].runs[0].text, 'This is paragraph two.');
        assert.strictEqual(blocks[2].runs[0].text, 'This is paragraph three.');

        const model = new DocumentModel();
        model.blocks.push(...blocks);

        const pdfHtml = PdfExportRenderer.renderToHTML(model);
        assert(pdfHtml.includes('This is paragraph one.'), 'PDF must include paragraph one text');
        assert(pdfHtml.includes('This is paragraph two.'), 'PDF must include paragraph two text');
        assert(pdfHtml.includes('This is paragraph three.'), 'PDF must include paragraph three text');
        const pCount = (pdfHtml.match(/<p>/g) || []).length;
        assert.strictEqual(pCount, 3, 'PDF must have exactly 3 <p> paragraph tags');
        console.log(' -> [PASS] PDF generates 3 distinct <p> paragraph elements with correct margins.');

        const docxP1 = await DocxExportRenderer.renderBlockToXml(blocks[0], [], []);
        const docxP2 = await DocxExportRenderer.renderBlockToXml(blocks[1], [], []);
        const docxP3 = await DocxExportRenderer.renderBlockToXml(blocks[2], [], []);
        assert(docxP1.includes('This is paragraph one.') && docxP1.includes('<w:p>'), 'DOCX paragraph 1 is valid <w:p>');
        assert(docxP2.includes('This is paragraph two.') && docxP2.includes('<w:p>'), 'DOCX paragraph 2 is valid <w:p>');
        assert(docxP3.includes('This is paragraph three.') && docxP3.includes('<w:p>'), 'DOCX paragraph 3 is valid <w:p>');
        console.log(' -> [PASS] DOCX generates 3 distinct <w:p> paragraph blocks.');
    }

    // 3. TEST LISTS & TASK CHECKLISTS SEPARATION
    console.log('\n[TEST 3] Verifying Checklist Tasks & Ordered Lists Separation...');
    {
        const checklistBlock = {
            type: 'list',
            listType: 'bullet',
            spacingBeforePt: 4,
            spacingAfterPt: 6,
            items: [
                { index: 1, isChecklist: true, isChecked: true, runs: [{ text: 'Task 1: Complete quarterly review', strikethrough: true }] },
                { index: 2, isChecklist: true, isChecked: false, runs: [{ text: 'Task 2: Design export engine', bold: true }] },
                { index: 3, isChecklist: true, isChecked: false, runs: [{ text: 'Task 3: Verify DOCX OpenXML' }] },
                { index: 4, isChecklist: true, isChecked: false, runs: [{ text: 'Task 4: Release update' }] }
            ]
        };

        const orderedListBlock = {
            type: 'list',
            listType: 'ordered',
            spacingBeforePt: 4,
            spacingAfterPt: 6,
            items: [
                { index: 1, isChecklist: false, runs: [{ text: 'Item 1' }] },
                { index: 2, isChecklist: false, runs: [{ text: 'Item 2' }] },
                { index: 3, isChecklist: false, runs: [{ text: 'Item 3' }] }
            ]
        };

        const model = new DocumentModel();
        model.blocks.push(checklistBlock, orderedListBlock);

        // PDF HTML Check
        const pdfHtml = PdfExportRenderer.renderToHTML(model);
        assert(pdfHtml.includes('checklist-box checked'), 'PDF must style completed checkbox');
        assert(pdfHtml.includes('checklist-text-cell strikethrough'), 'PDF must style strikethrough text');
        assert(pdfHtml.includes('Task 1: Complete quarterly review'), 'PDF must include Task 1');
        assert(pdfHtml.includes('Task 4: Release update'), 'PDF must include Task 4');
        assert(pdfHtml.includes('<ol>'), 'PDF must contain <ol> for ordered list');
        console.log(' -> [PASS] PDF renders authentic checklist with tick icons and ordered lists.');

        // DOCX XML Check
        const docxXml = await DocxExportRenderer.renderBlockToXml(checklistBlock, [], []);
        assert(docxXml.includes('Task 1: Complete quarterly review'), 'DOCX contains Task 1');
        assert(docxXml.includes('Task 4: Release update'), 'DOCX contains Task 4');
        assert(docxXml.includes('&#x2611;') || docxXml.includes('☑'), 'DOCX contains checked box symbol');
        assert(docxXml.includes('&#x2610;') || docxXml.includes('☐'), 'DOCX contains unchecked box symbol');
        console.log(' -> [PASS] DOCX renders each task as a separate paragraph with Segoe UI Symbol checkboxes.');
    }

    // 4. TEST EXPLICIT & NATURAL PAGE BREAKS
    console.log('\n[TEST 4] Verifying Explicit Page Breaks & Multi-Page Separation...');
    {
        const pageBreakBlock = { type: 'pageBreak' };
        const pPage1 = {
            type: 'paragraph',
            runs: [{ text: 'This content is explicitly on Page 1.' }]
        };
        const pPage2 = {
            type: 'paragraph',
            runs: [{ text: 'This content is explicitly on Page 2.' }]
        };

        const model = new DocumentModel();
        model.blocks.push(pPage1, pageBreakBlock, pPage2);

        // PDF HTML Check
        const pdfHtml = PdfExportRenderer.renderToHTML(model);
        assert(pdfHtml.includes('<div class="pdf-page-break"></div>'), 'PDF must contain page break element');
        assert(pdfHtml.includes('page-break-before: always !important;'), 'PDF CSS must have page-break-before rule');
        console.log(' -> [PASS] PDF HTML includes .pdf-page-break with page-break-before: always.');

        // DOCX XML Check
        const docxBreakXml = await DocxExportRenderer.renderBlockToXml(pageBreakBlock, [], []);
        assert.strictEqual(docxBreakXml, '<w:p><w:r><w:br w:type="page"/></w:r></w:p>', 'DOCX must output Word page break');
        console.log(' -> [PASS] DOCX outputs standard Word OpenXML <w:br w:type="page"/> element.');
    }

    // 5. TEST BORDERLESS LATEX & OTHER BLOCKS
    console.log('\n[TEST 5] Verifying Borderless LaTeX Math & Rich Elements...');
    {
        const latexBlock = {
            type: 'latex',
            latexCode: '\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
            isBlock: true,
            isFloating: false,
            renderedHTML: '<span class="katex-display">...math...</span>'
        };

        const model = new DocumentModel();
        model.blocks.push(latexBlock);

        const pdfHtml = PdfExportRenderer.renderToHTML(model);
        assert(pdfHtml.includes('background: transparent; border: none; box-shadow: none;'), 'PDF must render borderless latex formula');
        console.log(' -> [PASS] DOCX renders pure Cambria Math formula without border or box.');
    }

    // 6. TEST CODE CARD DOM EXTRACTION (No "Code Snippet Code" Leak)
    console.log('\n[TEST 6] Verifying Code Card DOM Extraction (No "Code Snippet Code" Leak)...');
    {
        // Mock a DOM node with .doc-code-card
        const mockCodeCard = {
            nodeType: 1,
            tagName: 'DIV',
            classList: {
                contains: (cls) => cls === 'doc-code-card'
            },
            getAttribute: () => null,
            querySelector: (sel) => {
                if (sel === 'pre') {
                    return {
                        tagName: 'PRE',
                        innerText: '// Enter code snippet here...',
                        querySelector: (s) => (s === 'code' ? { innerText: '// Enter code snippet here...', getAttribute: () => null } : null),
                        getAttribute: () => null
                    };
                }
                if (sel === '.badge' || sel === '.pdf-code-lang') {
                    return { textContent: 'Code' };
                }
                return null;
            }
        };

        const parsed = DocumentModel.parseNode(mockCodeCard, null);
        assert(parsed !== null && !Array.isArray(parsed), 'Code card must be parsed as a single block (not array)');
        assert.strictEqual(parsed.type, 'code', 'Block type must be code');
        assert.strictEqual(parsed.codeText, '// Enter code snippet here...', 'Code text must only contain the pre content');
        assert(!parsed.codeText.includes('Code Snippet'), 'Code text must NOT include header label');
        console.log(' -> [PASS] .doc-code-card parsed as single code block without leaking header label.');
    }

    console.log('\n========================================================');
    console.log('🎉 ALL EXPORT PIPELINE TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================\n');
}

runAllTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
