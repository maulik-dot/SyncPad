/**
 * SyncPad Interactive Export Preview Modal Controller
 * 
 * Provides interactive WYSIWYG preview of PDF and DOCX exports before downloading.
 */

class ExportPreviewModal {
    static init() {
        // Modal is loaded into the DOM
    }

    /**
     * Opens the Export Preview modal for the current active document
     * @param {'pdf'|'docx'|'html'} defaultFormat 
     */
    static open(defaultFormat = 'pdf') {
        const sheet = document.getElementById('docPageSheet');
        if (!sheet) return;

        // Parse canonical DocumentModel from DOM
        const model = DocumentModel.fromDOM(sheet, {
            title: document.getElementById('docTitleInput')?.value || 'SyncPad Document'
        });

        window.currentExportModel = model;

        const modal = document.getElementById('exportPreviewModal');
        if (!modal) return;

        modal.classList.remove('hidden');

        // Set active preview tab
        ExportPreviewModal.setFormat(defaultFormat);
        ExportPreviewModal.renderPreview();
        if (typeof refreshIcons === 'function') refreshIcons();
    }

    static close() {
        const modal = document.getElementById('exportPreviewModal');
        if (modal) modal.classList.add('hidden');
    }

    static setFormat(format) {
        window.activeExportFormat = format;
        document.querySelectorAll('.export-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-format') === format);
        });

        const btnLabel = document.getElementById('exportModalDownloadBtnLabel');
        if (btnLabel) {
            if (format === 'pdf') btnLabel.textContent = 'Save / Export PDF';
            else if (format === 'docx') btnLabel.textContent = 'Download Word (.docx)';
            else if (format === 'html') btnLabel.textContent = 'Download Web Page (.html)';
        }

        ExportPreviewModal.renderPreview();
    }

    static renderPreview() {
        const container = document.getElementById('exportPreviewContent');
        if (!container || !window.currentExportModel) return;

        const format = window.activeExportFormat || 'pdf';
        const model = window.currentExportModel;

        if (format === 'pdf' || format === 'html') {
            const html = PdfExportRenderer.renderToHTML(model);
            container.innerHTML = `
                <div class="export-preview-page-container">
                    <iframe id="exportPreviewIframe" class="export-preview-iframe"></iframe>
                </div>
            `;
            const iframe = document.getElementById('exportPreviewIframe');
            if (iframe) {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    doc.open();
                    doc.write(html);
                    doc.close();
                } catch (e) {
                    iframe.srcdoc = html;
                }
            }
        } else if (format === 'docx') {
            // Render DOCX structured visual inspection matching paper layout
            const innerHTML = PdfExportRenderer.renderToHTML(model)
                .replace(/<!DOCTYPE html>[\s\S]*?<div class="[^"]*pdf-export-sheet[^"]*">/, '')
                .replace(/<\/div>\s*<\/body>\s*<\/html>/, '');

            let summaryHTML = `
                <div class="docx-preview-paper">
                    <div class="docx-preview-content">
                        ${innerHTML}
                    </div>
                </div>
            `;
            container.innerHTML = summaryHTML;
        }

        if (typeof refreshIcons === 'function') refreshIcons();
    }

    static downloadActive() {
        const format = window.activeExportFormat || 'pdf';
        const model = window.currentExportModel || DocumentModel.fromDOM(document.getElementById('docPageSheet'));

        if (format === 'pdf') {
            PdfExportRenderer.exportToPdf(model);
        } else if (format === 'docx') {
            DocxExportRenderer.exportToDocx(model);
        } else if (format === 'html') {
            const html = PdfExportRenderer.renderToHTML(model);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const title = (model.metadata.title || 'SyncPad-Document').replace(/[^a-zA-Z0-9_-]/g, '_');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            if (typeof toast === 'function') toast('🌐 Web page (.html) downloaded');
        }

        ExportPreviewModal.close();
    }
}

// Attach to window
if (typeof window !== 'undefined') {
    window.ExportPreviewModal = ExportPreviewModal;
}
