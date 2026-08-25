/**
 * Verify PDF Export Render Output - Structural DOM Audit
 */
const path = require('path');
const fs = require('fs');

const docModelPath = path.join(__dirname, '../src/main/resources/static/js/export/document-model.js');
const pdfExporterPath = path.join(__dirname, '../src/main/resources/static/js/export/pdf-exporter.js');

eval(fs.readFileSync(docModelPath, 'utf-8'));
eval(fs.readFileSync(pdfExporterPath, 'utf-8'));

function assert(condition, message) {
    if (!condition) {
        console.error('   FAIL: ' + message);
        process.exitCode = 1;
    }
}

console.log('================================================================');
console.log('PDF EXPORT STRUCTURAL DOM AUDIT');
console.log('================================================================');

const model = new DocumentModel();

model.blocks.push({
    type: 'callout',
    accentColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    runs: [
        { text: 'Note:', bold: true, color: '#1e3a8a' },
        { text: ' This is an important callout with longer text that should stay on the same line as the icon.', color: '#1e3a8a' }
    ]
});

model.blocks.push({
    type: 'code',
    language: 'javascript',
    codeText: 'function hello() {\n    console.log("Hello World");\n    return true;\n}'
});

model.blocks.push({
    type: 'list',
    listType: 'unordered',
    items: [
        { isChecklist: true, isChecked: true, runs: [{ text: 'Task 1: Complete quarterly review' }] },
        { isChecklist: true, isChecked: false, runs: [{ text: 'Task 2: Prepare slides for Monday' }] },
        { isChecklist: true, isChecked: true, runs: [{ text: 'Task 3: Send out invitations' }] },
        { isChecklist: true, isChecked: false, runs: [{ text: 'Task 4: Review pull requests' }] },
    ]
});

model.blocks.push({
    type: 'paragraph',
    runs: [{ text: 'Normal paragraph text for comparison.' }]
});

const html = PdfExportRenderer.renderToHTML(model);
const outPath = path.join(__dirname, 'pdf_render_output.html');
fs.writeFileSync(outPath, html, 'utf-8');
console.log('\nFull HTML written to: ' + outPath + '\n');

const cssSection = html.split('<style>')[1].split('</style>')[0];
const htmlBody = html.split('<body>')[1] || '';

// TEST 1: CALLOUT
console.log('[TEST 1] Callout Box - Pinned Icon & Padded Text Layout');
assert(html.includes('doc-callout-icon-cell'), 'HTML: Must use .doc-callout-icon-cell');
assert(html.includes('doc-callout-content-cell'), 'HTML: Must use .doc-callout-content-cell');
var calloutStyle = cssSection.split('.doc-callout {')[1].split('}')[0];
assert(calloutStyle.includes('position: relative'), 'CSS: Callout must use position: relative');
assert(calloutStyle.includes('padding: 9pt 14pt 9pt 36pt'), 'CSS: Callout must have left padding for icon');
var iconStyle = cssSection.split('.doc-callout-icon-cell')[1].split('}')[0];
assert(iconStyle.includes('position: absolute'), 'CSS: Callout icon must use position: absolute');
assert(iconStyle.includes('left: 12pt'), 'CSS: Callout icon must be positioned at left: 12pt');
assert(html.includes('This is an important callout'), 'HTML: Callout text must be rendered');
console.log('   PASS - Callout uses pinned icon and padded text layout');

// TEST 2: CODE BLOCK
console.log('\n[TEST 2] Code Block - Print-Safe Layout');
var topbarRule = cssSection.split('.pdf-code-topbar')[1].split('}')[0];
assert(topbarRule.includes('display: table'), 'CSS: topbar must use display: table');
assert(!topbarRule.includes('display: flex'), 'CSS: topbar must NOT use display: flex');
var contentRule = cssSection.split('.pdf-code-content')[1].split('}')[0];
assert(contentRule.includes('word-break: normal'), 'CSS: must use word-break: normal');
assert(!contentRule.includes('word-break: break-all'), 'CSS: must NOT use word-break: break-all');
assert(contentRule.includes('white-space: pre-wrap'), 'CSS: must use white-space: pre-wrap');
assert(html.includes('class="dot red"'), 'HTML: Dot elements must use .dot.red class');
assert(html.includes('JAVASCRIPT'), 'HTML: Language label must be uppercase');
assert(cssSection.includes('print-color-adjust: exact'), 'CSS: Must include print-color-adjust');
console.log('   PASS - Code block uses table-layout topbar');

// TEST 3: CHECKLIST
console.log('\n[TEST 3] Checklist / Task Bullets - Absolute Pinned Layout');
var checklistItemRule = cssSection.split('li.checklist-item')[1].split('}')[0];
assert(checklistItemRule.includes('position: relative'), 'CSS: li.checklist-item must use position: relative');
assert(checklistItemRule.includes('padding-left: 20pt'), 'CSS: li.checklist-item must use padding-left: 20pt');
assert(!checklistItemRule.includes('display: flex'), 'CSS: li.checklist-item must NOT use flex');
assert(cssSection.includes('.checklist-box-cell'), 'CSS: .checklist-box-cell must exist');
var boxCellRule = cssSection.split('.checklist-box-cell')[1].split('}')[0];
assert(boxCellRule.includes('position: absolute'), 'CSS: .checklist-box-cell must use position: absolute');
assert(boxCellRule.includes('left: 0'), 'CSS: .checklist-box-cell must use left: 0');
assert(cssSection.includes('.checklist-text-cell'), 'CSS: .checklist-text-cell must exist');
assert(htmlBody.includes('checklist-box-cell'), 'HTML: Must use .checklist-box-cell');
assert(htmlBody.includes('checklist-text-cell'), 'HTML: Must use .checklist-text-cell');
assert(htmlBody.includes('checklist-text-cell strikethrough'), 'HTML: Checked items must have strikethrough');
assert(htmlBody.includes('stroke="#ffffff"'), 'HTML: SVG checkmark must use #ffffff stroke');
assert(htmlBody.includes('checklist-list'), 'HTML: Must use .checklist-list class');
assert(htmlBody.includes('Task 1: Complete quarterly review'), 'Task 1 rendered');
assert(htmlBody.includes('Task 4: Review pull requests'), 'Task 4 rendered');
console.log('   PASS - Checklist uses absolute pinned box and padded text layout');

// TEST 4: NO LEGACY FLEX
console.log('\n[TEST 4] No Legacy Flex Layout');
var calloutRule = cssSection.split('.doc-callout {')[1];
if (calloutRule) {
    var calloutBlock = calloutRule.split('}')[0];
    assert(!calloutBlock.includes('display: flex'), 'CSS: .doc-callout must NOT use flex');
    assert(!calloutBlock.includes('gap:'), 'CSS: .doc-callout must NOT use gap');
}
console.log('   PASS - No flex layout on critical elements');

// TEST 5: SANITY
console.log('\n[TEST 5] Full HTML Sanity');
var body = html.split('<body>')[1].split('</body>')[0];
var calloutCount = (body.match(/class="doc-callout"/g) || []).length;
var codeCardCount = (body.match(/class="pdf-code-card"/g) || []).length;
var checklistItemCount = (body.match(/class="checklist-item"/g) || []).length;
assert(calloutCount === 1, 'Must have 1 callout (got ' + calloutCount + ')');
assert(codeCardCount === 1, 'Must have 1 code card (got ' + codeCardCount + ')');
assert(checklistItemCount === 4, 'Must have 4 checklist items (got ' + checklistItemCount + ')');
console.log('   PASS - ' + calloutCount + ' callout, ' + codeCardCount + ' code, ' + checklistItemCount + ' tasks');

console.log('\n================================================================');
if (process.exitCode === 1) {
    console.log('SOME TESTS FAILED');
} else {
    console.log('ALL STRUCTURAL DOM AUDITS PASSED!');
}
console.log('================================================================');
console.log('\nOpen ' + outPath + ' in browser to visually inspect.\n');
