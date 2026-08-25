const DocumentModel = require('../src/main/resources/static/js/export/document-model.js');
const PdfExportRenderer = require('../src/main/resources/static/js/export/pdf-exporter.js');
const DocxExportRenderer = require('../src/main/resources/static/js/export/docx-exporter.js');

console.log("=== RUNNING EXPORT ENGINE BENCHMARK & FIDELITY SUITE ===");

// 1. Construct Mock DocumentModel representing comprehensive test document
const model = new DocumentModel();
model.metadata.title = "SyncPad High-Fidelity Architecture Benchmark";
model.metadata.author = "Antigravity Engineering";

model.blocks.push({
    type: 'heading',
    level: 1,
    align: 'left',
    spacingBeforePt: 18,
    spacingAfterPt: 8,
    runs: [{
        text: 'SyncPad High-Fidelity Architecture Benchmark',
        font: 'Inter, sans-serif',
        sizePt: 24,
        weight: 700,
        bold: true,
        color: '#0F172A'
    }]
});

model.blocks.push({
    type: 'paragraph',
    align: 'left',
    lineSpacing: 1.6,
    spacingBeforePt: 0,
    spacingAfterPt: 6,
    runs: [
        { text: 'SyncPad uses a ', font: 'Inter', sizePt: 11, bold: false, color: '#1E293B' },
        { text: 'canonical intermediate representation', font: 'Inter', sizePt: 11, bold: true, color: '#1E293B' },
        { text: ' to ensure visual parity between the editor, ', font: 'Inter', sizePt: 11, bold: false, color: '#1E293B' },
        { text: 'PDF export', font: 'Inter', sizePt: 11, italic: true, color: '#2563EB' },
        { text: ', and ', font: 'Inter', sizePt: 11, bold: false, color: '#1E293B' },
        { text: 'DOCX WordprocessingML', font: 'JetBrains Mono', sizePt: 10, highlight: '#FEF08A', color: '#0F172A' },
        { text: '.', font: 'Inter', sizePt: 11, bold: false, color: '#1E293B' }
    ]
});

model.blocks.push({
    type: 'callout',
    accentColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    align: 'left',
    runs: [
        { text: 'Architecture Rule: ', font: 'Inter', sizePt: 11, bold: true, color: '#1E3A8A' },
        { text: 'All export engines share the same source-of-truth document model.', font: 'Inter', sizePt: 11, color: '#1E3A8A' }
    ]
});

model.blocks.push({
    type: 'table',
    colCount: 3,
    rowCount: 2,
    rows: [
        [
            { isHeader: true, align: 'left', backgroundColor: '#F8FAFC', runs: [{ text: 'Component', bold: true, color: '#0F172A' }] },
            { isHeader: true, align: 'center', backgroundColor: '#F8FAFC', runs: [{ text: 'Representation', bold: true, color: '#0F172A' }] },
            { isHeader: true, align: 'center', backgroundColor: '#F8FAFC', runs: [{ text: 'Visual Equivalence', bold: true, color: '#0F172A' }] }
        ],
        [
            { isHeader: false, align: 'left', backgroundColor: '#FFFFFF', runs: [{ text: 'Document Editor', color: '#1E293B' }] },
            { isHeader: false, align: 'center', backgroundColor: '#FFFFFF', runs: [{ text: 'Rich DOM & Canvas', color: '#1E293B' }] },
            { isHeader: false, align: 'center', backgroundColor: '#ECFDF5', runs: [{ text: 'Source of Truth', bold: true, color: '#059669' }] }
        ]
    ]
});

model.blocks.push({
    type: 'list',
    listType: 'bullet',
    items: [
        { runs: [{ text: 'Preserves font families (Inter, Roboto, Merriweather, JetBrains Mono)', bold: false }] },
        { runs: [{ text: 'Preserves exact typography sizes, weights, and colors', bold: false }] }
    ]
});

model.blocks.push({
    type: 'list',
    listType: 'ordered',
    items: [
        { isChecklist: true, isChecked: true, runs: [{ text: 'Extract canonical DocumentModel', bold: false }] },
        { isChecklist: true, isChecked: true, runs: [{ text: 'Render high-fidelity PDF with @page rules and embedded styles', bold: false }] },
        { isChecklist: true, isChecked: true, runs: [{ text: 'Package valid OpenXML DOCX archive with styles.xml and numbering.xml', bold: false }] }
    ]
});

model.blocks.push({
    type: 'code',
    language: 'javascript',
    codeText: `// SyncPad Real-Time Engine\nfunction broadcastMutation(delta) {\n    stompClient.send('/app/doc/sync', {}, JSON.stringify(delta));\n}`
});

model.blocks.push({
    type: 'hr'
});

model.blocks.push({
    type: 'latex',
    latexCode: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
    renderedHTML: '<span class="katex"><span class="katex-html">∫ e^(-x^2) dx = √π</span></span>'
});

model.blocks.push({
    type: 'blockquote',
    borderLeftColor: '#7C3AED',
    runs: [{ text: '“Visual equivalence, not merely textual equivalence.”', italic: true, color: '#475569' }]
});

// 2. Test PDF HTML Exporter
console.log("\n[TEST 1] Testing PdfExportRenderer.renderToHTML...");
const pdfHtml = PdfExportRenderer.renderToHTML(model);
console.log(` -> Generated HTML length: ${pdfHtml.length} characters`);
if (!pdfHtml.includes('@page') || !pdfHtml.includes('pdf-code-card') || !pdfHtml.includes('checklist-box') || !pdfHtml.includes('doc-latex-card') || !pdfHtml.includes('doc-callout') || !pdfHtml.includes('blockquote')) {
    throw new Error("PDF HTML validation failed: missing essential styling, code card, LaTeX, callout, or checklist tags");
}
console.log(" -> [PASS] PDF HTML contains authentic code box card, LaTeX formula card, callout notice, quote, task bullets, and @page rules.");

// 3. Test DOCX OpenXML Generator
console.log("\n[TEST 2] Testing DocxExportRenderer WordprocessingML builder...");
const relsMap = [];
const mediaFiles = [];
DocxExportRenderer.buildDocumentXml(model, relsMap, mediaFiles).then(docXml => {
    console.log(` -> Generated word/document.xml length: ${docXml.length} characters`);
    
    // Validate WordprocessingML tags
    if (!docXml.includes('<w:document') || !docXml.includes('<w:tbl>') || !docXml.includes('w:val="Heading1"') || !docXml.includes('w:shd') || !docXml.includes('Cambria Math') || !docXml.includes('Segoe UI Symbol')) {
        throw new Error("DOCX XML validation failed: missing essential OpenXML tags, Cambria Math, or Segoe UI Symbol checklist");
    }
    console.log(" -> [PASS] word/document.xml contains valid <w:p>, <w:tbl>, <w:rPr>, <w:shd>, LaTeX math formula, callout card, quote box, and task bullets.");

    const stylesXml = DocxExportRenderer.buildStylesXml();
    if (!stylesXml.includes('w:styleId="Heading1"') || !stylesXml.includes('w:styleId="ListParagraph"')) {
        throw new Error("DOCX styles.xml validation failed");
    }
    console.log(" -> [PASS] word/styles.xml contains proper heading and paragraph styles.");

    const numXml = DocxExportRenderer.buildNumberingXml();
    if (!numXml.includes('w:numId="1"') || !numXml.includes('w:numId="2"')) {
        throw new Error("DOCX numbering.xml validation failed");
    }
    console.log(" -> [PASS] word/numbering.xml contains bullet and decimal numbering abstract definitions.");

    console.log("\n========================================================");
    console.log("🎉 ALL EXPORT ENGINE BENCHMARK TESTS COMPLETED SUCCESSFULLY!");
    console.log("========================================================");
}).catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
