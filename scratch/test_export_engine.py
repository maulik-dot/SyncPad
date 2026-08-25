import time
import json
import base64
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

def run_test():
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1440,900')

    driver = webdriver.Chrome(options=options)
    try:
        print("[TEST] Navigating to SyncPad login page...")
        driver.get('http://localhost:8082/login')
        time.sleep(2)

        # Login as alex@company.com
        print("[TEST] Logging in...")
        driver.find_element(By.ID, 'loginEmail').send_keys('alex@company.com')
        driver.find_element(By.ID, 'loginPassword').send_keys('password123')
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        time.sleep(3)

        # Open the first document
        print("[TEST] Opening document editor...")
        doc_cards = driver.find_elements(By.CLASS_NAME, 'recent-card')
        if doc_cards:
            doc_cards[0].click()
        else:
            driver.execute_script("if (typeof documentsList !== 'undefined' && documentsList.length > 0) openItemView(documentsList[0]);")
        time.sleep(2)

        # Inject a comprehensive rich test document with all features
        print("[TEST] Injecting comprehensive formatting test document...")
        test_html = """
        <h1 style="color: #0f172a; font-family: 'Inter', sans-serif;">SyncPad High-Fidelity Export Benchmark Document</h1>
        <p style="font-size: 11pt; line-height: 1.6; color: #1e293b;">
            This benchmark document evaluates the visual fidelity of the <strong>DocumentModel</strong>, <em>PDF Exporter</em>, and <span style="color: #2563eb; text-decoration: underline;">DOCX OpenXML Exporter</span>.
        </p>
        <div class="doc-callout" style="border-left: 4px solid #3b82f6; background-color: #eff6ff; padding: 10px 14px; margin: 12px 0;">
            <strong style="color: #1e3a8a;">Architecture Principle:</strong> The rendered editor document is the single source of truth.
        </div>
        <h2 style="color: #1e293b; font-family: 'Inter', sans-serif;">1. Typography & Formatting Matrix</h2>
        <p>
            <span style="font-family: 'Merriweather', serif; font-size: 12pt; color: #b91c1c;">Merriweather Serif Crimson</span> • 
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 10pt; background-color: #f1f5f9; padding: 2px 4px;">JetBrains Mono Code Run</span> • 
            <mark style="background-color: #fef08a;">Yellow Highlighter Mark</mark> • 
            <s>Strikethrough text</s> • 
            <u>Underline text</u> • 
            <a href="https://syncpad.example.com" target="_blank" style="color: #2563eb;">Clickable Hyperlink Target</a>
        </p>
        <h2 style="color: #1e293b; font-family: 'Inter', sans-serif;">2. Structured Tables & Alignment</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
            <thead>
                <tr>
                    <th style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Feature Module</th>
                    <th style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">PDF Renderer</th>
                    <th style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; text-align: right;">DOCX OpenXML</th>
                    <th style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; text-align: center;">Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">Typography & Weights</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">100% Vector</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: right;">w:rFonts & w:sz</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; background-color: #ecfdf5; color: #059669; font-weight: bold;">PASS</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">Multi-Page Pagination</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">CSS Paged Media</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: right;">w:sectPr Letter</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; background-color: #ecfdf5; color: #059669; font-weight: bold;">PASS</td>
                </tr>
            </tbody>
        </table>
        <h2 style="color: #1e293b;">3. Lists & Hierarchies</h2>
        <ul>
            <li>Primary Bullet Item 1</li>
            <li>Primary Bullet Item 2</li>
        </ul>
        <ol>
            <li>Ordered Step One: Parse Document Model</li>
            <li>Ordered Step Two: Dispatch to Target Renderer</li>
        </ol>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <blockquote>
            "Visual fidelity requires capturing exact geometry and typography rather than naive plain text serialization."
        </blockquote>
        """
        driver.execute_script(f"""
            const sheet = document.getElementById('docPageSheet');
            if (sheet) sheet.innerHTML = `{test_html}`;
        """)
        time.sleep(1)

        # 1. Test DocumentModel parsing
        print("[TEST] Validating DocumentModel.fromDOM extraction...")
        model_result = driver.execute_script("""
            const sheet = document.getElementById('docPageSheet');
            const model = DocumentModel.fromDOM(sheet, { title: 'Benchmark Test Doc' });
            return {
                title: model.metadata.title,
                blockCount: model.blocks.length,
                blockTypes: model.blocks.map(b => b.type),
                firstHeading: model.blocks.find(b => b.type === 'heading'),
                tableBlock: model.blocks.find(b => b.type === 'table'),
                calloutBlock: model.blocks.find(b => b.type === 'callout'),
                listBlocks: model.blocks.filter(b => b.type === 'list')
            };
        """)

        print(f" -> Extracted Title: {model_result['title']}")
        print(f" -> Extracted Blocks ({model_result['blockCount']}): {model_result['blockTypes']}")
        assert model_result['blockCount'] >= 6, f"Expected >= 6 blocks, got {model_result['blockCount']}"
        assert 'table' in model_result['blockTypes'], "Missing table block in DocumentModel"
        assert 'callout' in model_result['blockTypes'], "Missing callout block in DocumentModel"
        assert len(model_result['listBlocks']) == 2, f"Expected 2 list blocks, got {len(model_result['listBlocks'])}"

        # 2. Test PDF HTML Renderer
        print("[TEST] Validating PdfExportRenderer.renderToHTML...")
        pdf_html = driver.execute_script("""
            const sheet = document.getElementById('docPageSheet');
            const model = DocumentModel.fromDOM(sheet, { title: 'Benchmark Test Doc' });
            return PdfExportRenderer.renderToHTML(model);
        """)
        assert '<table' in pdf_html, "PDF HTML missing table markup"
        assert 'doc-callout' in pdf_html, "PDF HTML missing callout class"
        assert 'Merriweather' in pdf_html, "PDF HTML missing Merriweather font reference"
        print(" -> PDF HTML generation: SUCCESS")

        # 3. Test DOCX OpenXML Zip Generation
        print("[TEST] Validating DocxExportRenderer.generateDocxBlob...")
        docx_result = driver.execute_async_script("""
            const callback = arguments[arguments.length - 1];
            const sheet = document.getElementById('docPageSheet');
            const model = DocumentModel.fromDOM(sheet, { title: 'Benchmark Test Doc' });
            
            DocxExportRenderer.generateDocxBlob(model).then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    callback({
                        success: true,
                        size: blob.size,
                        type: blob.type,
                        base64Preview: reader.result.substring(0, 100)
                    });
                };
                reader.readAsDataURL(blob);
            }).catch(err => {
                callback({ success: false, error: err.toString() });
            });
        """)
        print(f" -> DOCX Blob Result: {docx_result}")
        assert docx_result['success'], f"DOCX generation failed: {docx_result.get('error')}"
        assert docx_result['size'] > 1000, f"DOCX blob too small: {docx_result['size']} bytes"
        print(f" -> Generated Valid DOCX Archive: {docx_result['size']} bytes!")

        # 4. Test Export Preview Modal Opening
        print("[TEST] Testing ExportPreviewModal open & switch...")
        driver.execute_script("ExportPreviewModal.open('pdf');")
        time.sleep(1)
        modal_visible = driver.execute_script("return !document.getElementById('exportPreviewModal').classList.contains('hidden');")
        assert modal_visible, "Export Preview modal was not visible"
        print(" -> Export Preview Modal opened successfully")

        # Switch to DOCX tab in preview
        driver.execute_script("ExportPreviewModal.setFormat('docx');")
        time.sleep(1)
        docx_preview_rendered = driver.execute_script("return Boolean(document.querySelector('.docx-preview-paper'));")
        assert docx_preview_rendered, "DOCX structure paper preview was not rendered"
        print(" -> DOCX preview rendered successfully")

        print("\n==========================================")
        print("✅ ALL EXPORT ENGINE TESTS PASSED!")
        print("==========================================")

    finally:
        driver.quit()

if __name__ == '__main__':
    run_test()
