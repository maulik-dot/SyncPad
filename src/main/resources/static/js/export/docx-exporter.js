/**
 * SyncPad High-Fidelity DOCX (Office OpenXML) Export Engine
 * 
 * Takes the canonical DocumentModel and generates a valid, structured Office OpenXML
 * .docx archive with real paragraphs, text runs, typography, tables, lists, images, and page setups.
 */

class DocxExportRenderer {
    /**
     * Exports a DocumentModel to a .docx blob
     * @param {DocumentModel} model 
     * @returns {Promise<Blob>}
     */
    static async generateDocxBlob(model) {
        if (typeof JSZip === 'undefined') {
            await DocxExportRenderer.loadJSZip();
        }

        const zip = new JSZip();
        const relsMap = [];
        let relIdCounter = 1;
        const mediaFiles = [];

        // 1. Process Images & Hyperlinks in DocumentModel
        let documentXml = await DocxExportRenderer.buildDocumentXml(model, relsMap, mediaFiles);

        // 2. Add Media files (Images) to zip
        for (const media of mediaFiles) {
            zip.file(`word/${media.path}`, media.data, { base64: media.isBase64 });
        }

        // 3. [Content_Types].xml
        zip.file('[Content_Types].xml', DocxExportRenderer.buildContentTypesXml(mediaFiles));

        // 4. _rels/.rels
        zip.file('_rels/.rels', DocxExportRenderer.buildPackageRelsXml());

        // 5. word/_rels/document.xml.rels
        zip.file('word/_rels/document.xml.rels', DocxExportRenderer.buildDocumentRelsXml(relsMap));

        // 6. word/document.xml
        zip.file('word/document.xml', documentXml);

        // 7. word/styles.xml
        zip.file('word/styles.xml', DocxExportRenderer.buildStylesXml());

        // 8. word/numbering.xml
        zip.file('word/numbering.xml', DocxExportRenderer.buildNumberingXml());

        // 9. word/fontTable.xml
        zip.file('word/fontTable.xml', DocxExportRenderer.buildFontTableXml());

        return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }

    /**
     * Builds word/document.xml content
     */
    static async buildDocumentXml(model, relsMap, mediaFiles) {
        let bodyXml = '';

        for (const block of model.blocks) {
            bodyXml += await DocxExportRenderer.renderBlockToXml(block, relsMap, mediaFiles);
        }

        // Section Setup (US Letter 8.5" x 11", 0.75" margins = 1080 dxa)
        const sectPr = `<w:sectPr>
            <w:pgSz w:w="12240" w:h="15840" w:orient="portrait"/>
            <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
            <w:cols w:space="720"/>
            <w:docGrid w:linePitch="360"/>
        </w:sectPr>`;

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
    <w:body>
        ${bodyXml}
        ${sectPr}
    </w:body>
</w:document>`;
    }

    /**
     * Converts a single DocumentModel block to WordprocessingML
     */
    static async renderBlockToXml(block, relsMap, mediaFiles) {
        if (!block) return '';

        switch (block.type) {
            case 'pageBreak':
                return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

            case 'code': {
                const lang = (block.language || 'CODE').toUpperCase();
                const codeLines = (block.codeText || '').split('\n');

                // Header bar inside the code card
                let headerXml = `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:b/><w:sz w:val="15"/><w:color w:val="94A3B8"/></w:rPr><w:t xml:space="preserve">● ● ●  ${lang}</w:t><w:br/></w:r>`;

                let codeRunsXml = headerXml;
                for (let i = 0; i < codeLines.length; i++) {
                    const line = DocxExportRenderer.escapeXml(codeLines[i]);
                    const br = (i < codeLines.length - 1) ? '<w:br/>' : '';
                    codeRunsXml += `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/><w:color w:val="F8FAFC"/></w:rPr><w:t xml:space="preserve">${line}</w:t>${br}</w:r>`;
                }

                return `<w:p>
                    <w:pPr>
                        <w:pBdr>
                            <w:left w:val="single" w:sz="18" w:space="12" w:color="3B82F6"/>
                            <w:top w:val="single" w:sz="4" w:space="8" w:color="1E293B"/>
                            <w:right w:val="single" w:sz="4" w:space="8" w:color="1E293B"/>
                            <w:bottom w:val="single" w:sz="4" w:space="8" w:color="1E293B"/>
                        </w:pBdr>
                        <w:shd w:val="clear" w:color="auto" w:fill="0F172A"/>
                        <w:spacing w:before="160" w:after="160" w:line="240" w:lineRule="auto"/>
                        <w:ind w:left="220" w:right="220"/>
                    </w:pPr>
                    ${codeRunsXml}
                </w:p>`;
            }

            case 'heading': {
                const styleVal = `Heading${block.level || 1}`;
                const jcXml = DocxExportRenderer.getAlignmentXml(block.align);
                const runsXml = DocxExportRenderer.renderRunsToXml(block.runs, relsMap);
                return `<w:p>
                    <w:pPr>
                        <w:pStyle w:val="${styleVal}"/>
                        ${jcXml}
                        <w:spacing w:before="240" w:after="120"/>
                    </w:pPr>
                    ${runsXml}
                </w:p>`;
            }

            case 'paragraph': {
                const jcXml = DocxExportRenderer.getAlignmentXml(block.align);
                const runsXml = DocxExportRenderer.renderRunsToXml(block.runs, relsMap);
                return `<w:p>
                    <w:pPr>
                        ${jcXml}
                        <w:spacing w:before="0" w:after="140" w:line="300" w:lineRule="auto"/>
                    </w:pPr>
                    ${runsXml}
                </w:p>`;
            }

            case 'list': {
                let xml = '';
                const numId = block.listType === 'ordered' ? 2 : 1;
                for (const item of block.items || []) {
                    const isChecked = Boolean(item.isChecked);

                    if (item.isChecklist) {
                        // Render clean checklist row without standard bullet numPr
                        const boxSymbol = isChecked ? '☑ ' : '☐ ';
                        const boxColor = isChecked ? '7C3AED' : '94A3B8';
                        const boxRun = `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol"/><w:b/><w:sz w:val="22"/><w:color w:val="${boxColor}"/></w:rPr><w:t>${boxSymbol}</w:t></w:r>`;

                        const formattedRuns = isChecked
                            ? item.runs.map(r => ({ ...r, strikethrough: true, color: '#94A3B8' }))
                            : item.runs;
                        const runsXml = DocxExportRenderer.renderRunsToXml(formattedRuns, relsMap);

                        xml += `<w:p>
                            <w:pPr>
                                <w:spacing w:before="40" w:after="50"/>
                                <w:ind w:left="420" w:hanging="260"/>
                            </w:pPr>
                            ${boxRun}
                            ${runsXml}
                        </w:p>`;
                    } else {
                        const runsXml = DocxExportRenderer.renderRunsToXml(item.runs, relsMap);
                        xml += `<w:p>
                            <w:pPr>
                                <w:pStyle w:val="ListParagraph"/>
                                <w:numPr>
                                    <w:ilvl w:val="0"/>
                                    <w:numId w:val="${numId}"/>
                                </w:numPr>
                                <w:spacing w:before="0" w:after="80"/>
                            </w:pPr>
                            ${runsXml}
                        </w:p>`;
                    }
                }
                return xml;
            }

            case 'table': {
                let tblXml = `<w:tbl>
                    <w:tblPr>
                        <w:tblW w:w="0" w:type="auto"/>
                        <w:tblBorders>
                            <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                            <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                            <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                        </w:tblBorders>
                        <w:tblCellMar>
                            <w:top w:w="140" w:type="dxa"/>
                            <w:left w:w="180" w:type="dxa"/>
                            <w:bottom w:w="140" w:type="dxa"/>
                            <w:right w:w="180" w:type="dxa"/>
                        </w:tblCellMar>
                    </w:tblPr>`;

                for (const row of block.rows || []) {
                    tblXml += `<w:tr>`;
                    for (const cell of row) {
                        const runsXml = DocxExportRenderer.renderRunsToXml(cell.runs, relsMap);
                        const shdXml = cell.backgroundColor
                            ? `<w:shd w:val="clear" w:color="auto" w:fill="${cell.backgroundColor.replace('#', '')}"/>`
                            : (cell.isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>` : '');
                        
                        tblXml += `<w:tc>
                            <w:tcPr>
                                <w:tcW w:w="0" w:type="auto"/>
                                ${shdXml}
                                <w:vAlign w:val="top"/>
                            </w:tcPr>
                            <w:p>
                                <w:pPr>${DocxExportRenderer.getAlignmentXml(cell.align)}<w:spacing w:before="0" w:after="0"/></w:pPr>
                                ${runsXml}
                            </w:p>
                        </w:tc>`;
                    }
                    tblXml += `</w:tr>`;
                }

                tblXml += `</w:tbl>`;
                return tblXml;
            }

            case 'callout': {
                const borderHex = (block.accentColor || '#3B82F6').replace('#', '');
                const bgHex = (block.backgroundColor || '#EFF6FF').replace('#', '');
                const runsXml = DocxExportRenderer.renderRunsToXml(block.runs, relsMap);
                const iconRun = `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol"/><w:b/><w:sz w:val="22"/><w:color w:val="${borderHex}"/></w:rPr><w:t>ℹ  </w:t></w:r>`;

                return `<w:p>
                    <w:pPr>
                        <w:pBdr>
                            <w:left w:val="single" w:sz="24" w:space="15" w:color="${borderHex}"/>
                        </w:pBdr>
                        <w:shd w:val="clear" w:color="auto" w:fill="${bgHex}"/>
                        <w:spacing w:before="160" w:after="160" w:line="280" w:lineRule="auto"/>
                        <w:ind w:left="280" w:right="180"/>
                    </w:pPr>
                    ${iconRun}
                    ${runsXml}
                </w:p>`;
            }

            case 'blockquote': {
                const formattedRuns = block.runs.map(r => ({ ...r, italic: true, color: r.color || '#475569' }));
                const runsXml = DocxExportRenderer.renderRunsToXml(formattedRuns, relsMap);
                const borderHex = (block.borderLeftColor || '#7C3AED').replace('#', '');

                return `<w:p>
                    <w:pPr>
                        <w:pBdr>
                            <w:left w:val="single" w:sz="20" w:space="15" w:color="${borderHex}"/>
                        </w:pBdr>
                        <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
                        <w:spacing w:before="140" w:after="140" w:line="300" w:lineRule="auto"/>
                        <w:ind w:left="280" w:right="160"/>
                    </w:pPr>
                    ${runsXml}
                </w:p>`;
            }

            case 'latex': {
                const code = block.latexCode || '';
                let formattedMath = code
                    .replace(/\\int/g, '∫')
                    .replace(/\\infty/g, '∞')
                    .replace(/\\hat\{([^}]+)\}/g, '$1̂')
                    .replace(/\\xi/g, 'ξ')
                    .replace(/\\pi/g, 'π')
                    .replace(/\\alpha/g, 'α')
                    .replace(/\\beta/g, 'β')
                    .replace(/\\gamma/g, 'γ')
                    .replace(/\\delta/g, 'δ')
                    .replace(/\\theta/g, 'θ')
                    .replace(/\\lambda/g, 'λ')
                    .replace(/\\mu/g, 'μ')
                    .replace(/\\sigma/g, 'σ')
                    .replace(/\\omega/g, 'ω')
                    .replace(/\\Delta/g, 'Δ')
                    .replace(/\\Sigma/g, 'Σ')
                    .replace(/\\sum/g, '∑')
                    .replace(/\\prod/g, '∏')
                    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
                    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
                    .replace(/\\cdot/g, '·')
                    .replace(/\\times/g, '×')
                    .replace(/\\pm/g, '±')
                    .replace(/\\leq/g, '≤')
                    .replace(/\\geq/g, '≥')
                    .replace(/\\neq/g, '≠')
                    .replace(/\\approx/g, '≈')
                    .replace(/\\to/g, '→')
                    .replace(/\\partial/g, '∂')
                    .replace(/\\nabla/g, '∇')
                    .replace(/\\quad/g, '   ')
                    .replace(/\\,/g, ' ')
                    .replace(/[\\]/g, '');

                const escapedMath = DocxExportRenderer.escapeXml(formattedMath);

                return `<w:p>
                    <w:pPr>
                        <w:jc w:val="center"/>
                        <w:spacing w:before="160" w:after="160" w:line="320" w:lineRule="auto"/>
                    </w:pPr>
                    <w:r>
                        <w:rPr>
                            <w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" w:cs="Cambria Math"/>
                            <w:i/>
                            <w:sz w:val="26"/>
                            <w:color w:val="1E293B"/>
                        </w:rPr>
                        <w:t xml:space="preserve">${escapedMath}</w:t>
                    </w:r>
                </w:p>`;
            }

            case 'image': {
                if (!block.src) return '';
                const imgRelId = `rIdImg${relsMap.length + 1}`;
                const imgFilename = `image${mediaFiles.length + 1}.png`;

                let base64Data = '';
                if (block.src.startsWith('data:image/')) {
                    base64Data = block.src.split(',')[1];
                }

                if (base64Data) {
                    mediaFiles.push({ path: `media/${imgFilename}`, data: base64Data, isBase64: true });
                    relsMap.push({
                        id: imgRelId,
                        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                        target: `media/${imgFilename}`
                    });

                    // 1 pt = 12700 EMUs (English Metric Units)
                    const cx = (block.widthPt || 360) * 12700;
                    const cy = (block.heightPt || 220) * 12700;

                    return `<w:p>
                        <w:pPr><w:jc w:val="center"/><w:spacing w:before="180" w:after="180"/></w:pPr>
                        <w:r>
                            <w:drawing>
                                <wp:inline distT="0" distB="0" distL="0" distR="0">
                                    <wp:extent cx="${cx}" cy="${cy}"/>
                                    <wp:docPr id="${mediaFiles.length}" name="Picture ${mediaFiles.length}"/>
                                    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                                        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                                            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                                                <pic:nvPicPr>
                                                    <pic:cNvPr id="${mediaFiles.length}" name="${imgFilename}"/>
                                                    <pic:cNvPicPr/>
                                                </pic:nvPicPr>
                                                <pic:blipFill>
                                                    <a:blip r:embed="${imgRelId}"/>
                                                    <a:stretch><a:fillRect/></a:stretch>
                                                </pic:blipFill>
                                                <pic:spPr>
                                                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                                                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                                                </pic:spPr>
                                            </pic:pic>
                                        </a:graphicData>
                                    </a:graphic>
                                </wp:inline>
                            </w:drawing>
                        </w:r>
                    </w:p>`;
                }
                return '';
            }

            case 'hr': {
                return `<w:p>
                    <w:pPr>
                        <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="E2E8F0"/></w:pBdr>
                        <w:spacing w:before="180" w:after="180"/>
                    </w:pPr>
                </w:p>`;
            }

            default:
                return '';
        }
    }

    /**
     * Converts TextRuns into WordprocessingML text run (<w:r>) elements
     */
    static renderRunsToXml(runs, relsMap) {
        if (!runs || runs.length === 0) return '';
        let xml = '';

        for (const run of runs) {
            if (run.isLineBreak || run.text === '\n') {
                xml += '<w:r><w:br/></w:r>';
                continue;
            }

            const text = DocxExportRenderer.escapeXml(run.text || '');
            if (!text) continue;

            const boldXml = run.bold ? '<w:b/>' : '';
            const italicXml = run.italic ? '<w:i/>' : '';
            const underlineXml = run.underline ? '<w:u w:val="single"/>' : '';
            const strikeXml = run.strikethrough ? '<w:strike/>' : '';
            const colorHex = (run.color || '#1E293B').replace('#', '');
            const colorXml = `<w:color w:val="${colorHex.toUpperCase()}"/>`;
            const fontName = DocxExportRenderer.cleanFontName(run.font || 'Inter');
            const fontXml = `<w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>`;
            // Word sizes are in half-points (e.g. 11pt = 22)
            const szVal = Math.round((run.sizePt || 11) * 2);
            const szXml = `<w:sz w:val="${szVal}"/><w:szCs w:val="${szVal}"/>`;
            const shdXml = run.highlight ? `<w:shd w:val="clear" w:color="auto" w:fill="${run.highlight.replace('#', '')}"/>` : '';

            const rPr = `<w:rPr>
                ${fontXml}
                ${boldXml}
                ${italicXml}
                ${underlineXml}
                ${strikeXml}
                ${colorXml}
                ${szXml}
                ${shdXml}
            </w:rPr>`;

            const runContent = `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>`;

            if (run.href) {
                const linkRelId = `rIdLink${relsMap.length + 1}`;
                relsMap.push({
                    id: linkRelId,
                    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
                    target: run.href,
                    targetMode: 'External'
                });
                xml += `<w:hyperlink r:id="${linkRelId}" w:history="1">${runContent}</w:hyperlink>`;
            } else {
                xml += runContent;
            }
        }

        return xml;
    }

    static getAlignmentXml(align) {
        switch (align) {
            case 'center': return '<w:jc w:val="center"/>';
            case 'right': return '<w:jc w:val="right"/>';
            case 'justify': return '<w:jc w:val="both"/>';
            default: return '<w:jc w:val="left"/>';
        }
    }

    static cleanFontName(fontStr) {
        if (!fontStr) return 'Inter';
        const first = fontStr.split(',')[0].trim().replace(/['"]/g, '');
        return first || 'Inter';
    }

    static escapeXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    static buildContentTypesXml(mediaFiles) {
        let mediaExtensions = '';
        const hasPng = mediaFiles.some(m => m.path.endsWith('.png'));
        const hasJpg = mediaFiles.some(m => m.path.endsWith('.jpg') || m.path.endsWith('.jpeg'));

        if (hasPng) mediaExtensions += `<Default Extension="png" ContentType="image/png"/>`;
        if (hasJpg) mediaExtensions += `<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="jpg" ContentType="image/jpeg"/>`;

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    ${mediaExtensions}
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
    <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
</Types>`;
    }

    static buildPackageRelsXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    }

    static buildDocumentRelsXml(relsMap) {
        let dynamicRels = '';
        for (const rel of relsMap) {
            const targetModeAttr = rel.targetMode ? ` TargetMode="${rel.targetMode}"` : '';
            dynamicRels += `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"${targetModeAttr}/>`;
        }

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    <Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
    <Relationship Id="rIdFont" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
    ${dynamicRels}
</Relationships>`;
    }

    static buildStylesXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:docDefaults>
        <w:rPrDefault>
            <w:rPr>
                <w:rFonts w:ascii="Inter" w:hAnsi="Inter" w:eastAsia="Inter" w:cs="Inter"/>
                <w:sz w:val="22"/>
                <w:color w:val="1E293B"/>
                <w:lang w:val="en-US"/>
            </w:rPr>
        </w:rPrDefault>
        <w:pPrDefault>
            <w:pPr>
                <w:spacing w:after="140" w:line="280" w:lineRule="auto"/>
            </w:pPr>
        </w:pPrDefault>
    </w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
        <w:name w:val="Normal"/>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading1">
        <w:name w:val="heading 1"/>
        <w:pPr><w:spacing w:before="360" w:after="140"/></w:pPr>
        <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:sz w:val="44"/><w:color w:val="0F172A"/></w:rPr>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading2">
        <w:name w:val="heading 2"/>
        <w:pPr><w:spacing w:before="280" w:after="120"/></w:pPr>
        <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:sz w:val="34"/><w:color w:val="0F172A"/></w:rPr>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading3">
        <w:name w:val="heading 3"/>
        <w:pPr><w:spacing w:before="220" w:after="100"/></w:pPr>
        <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:sz w:val="26"/><w:color w:val="0F172A"/></w:rPr>
    </w:style>
    <w:style w:type="paragraph" w:styleId="ListParagraph">
        <w:name w:val="List Paragraph"/>
        <w:pPr><w:ind w:left="480"/></w:pPr>
    </w:style>
</w:styles>`;
    }

    static buildNumberingXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:abstractNum w:abstractNumId="1">
        <w:lvl w:ilvl="0">
            <w:start w:val="1"/>
            <w:numFmt w:val="bullet"/>
            <w:lvlText w:val="•"/>
            <w:lvlJc w:val="left"/>
            <w:pPr><w:ind w:left="480" w:hanging="240"/></w:pPr>
        </w:lvl>
    </w:abstractNum>
    <w:abstractNum w:abstractNumId="2">
        <w:lvl w:ilvl="0">
            <w:start w:val="1"/>
            <w:numFmt w:val="decimal"/>
            <w:lvlText w:val="%1."/>
            <w:lvlJc w:val="left"/>
            <w:pPr><w:ind w:left="480" w:hanging="240"/></w:pPr>
        </w:lvl>
    </w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
    <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;
    }

    static buildFontTableXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fontTable xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:font w:name="Inter"><w:pitch w:val="variable"/></w:font>
    <w:font w:name="Roboto"><w:pitch w:val="variable"/></w:font>
    <w:font w:name="Merriweather"><w:pitch w:val="variable"/></w:font>
    <w:font w:name="JetBrains Mono"><w:pitch w:val="fixed"/></w:font>
</w:fontTable>`;
    }

    static loadJSZip() {
        return new Promise((resolve, reject) => {
            if (typeof JSZip !== 'undefined') return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Triggers direct browser download of the .docx file
     */
    static async exportToDocx(model) {
        try {
            const blob = await DocxExportRenderer.generateDocxBlob(model);
            const title = (model.metadata.title || 'SyncPad-Document').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `${title}.docx`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            if (typeof toast === 'function') {
                toast(`📄 Document exported to Word (.docx)`);
            }
        } catch (err) {
            console.error('Failed to export DOCX:', err);
            if (typeof toast === 'function') {
                toast(`❌ Failed to export DOCX: ${err.message}`);
            }
        }
    }
}

// Attach to window / globalThis / module.exports
if (typeof window !== 'undefined') {
    window.DocxExportRenderer = DocxExportRenderer;
}
if (typeof globalThis !== 'undefined') {
    globalThis.DocxExportRenderer = DocxExportRenderer;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocxExportRenderer;
}
