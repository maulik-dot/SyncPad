const { spawn } = require('child_process');
const http = require('http');

async function debugExtractor() {
    const port = 9287;
    const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        'http://localhost:8082'
    ]);

    try {
        await new Promise(r => setTimeout(r, 1500));
        const res = await new Promise(resolve => {
            http.get(`http://127.0.0.1:${port}/json/list`, r => {
                let d = '';
                r.on('data', c => d += c);
                r.on('end', () => resolve(JSON.parse(d)));
            });
        });

        const target = res[0];
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);

        let id = 1;
        function send(method, params = {}) {
            return new Promise(resolve => {
                const reqId = id++;
                const handler = (event) => {
                    const msg = JSON.parse(event.data);
                    if (msg.id === reqId) {
                        ws.removeEventListener('message', handler);
                        resolve(msg);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        await send('Page.enable');
        await send('Runtime.enable');

        await send('Runtime.evaluate', {
            expression: `
                document.getElementById('loginEmail').value = 'demo@syncpad.com';
                document.getElementById('loginPassword').value = 'password123';
                handleLogin(new Event('submit'));
            `
        });
        await new Promise(r => setTimeout(r, 1500));

        await send('Runtime.evaluate', {
            expression: `openItemView({ id: 1, title: 'Distributed Systems & Architecture Guide', fileType: 'DOCUMENT' });`
        });
        await new Promise(r => setTimeout(r, 1500));

        const debugInfo = await send('Runtime.evaluate', {
            expression: `({
                presetKey: window.pdfRenderer ? window.pdfRenderer.activePresetKey : null,
                currentPage: window.pdfEngine ? window.pdfEngine.currentPage : null,
                pageData: window.pdfEngine ? window.pdfEngine.getCurrentPageData() : null,
                textLayerSpansCount: document.querySelectorAll('#pdfTextLayer span').length,
                spans: Array.from(document.querySelectorAll('#pdfTextLayer span')).map(s => ({ text: s.textContent, left: s.style.left, top: s.style.top })),
                extractResult: window.pdfCaptureManager ? window.pdfCaptureManager.extractCapturedText() : null,
                currentPdfRect: window.pdfCaptureManager ? window.pdfCaptureManager.currentPdfRect : null
            })`,
            returnByValue: true
        });

        console.log('Debug info:', JSON.stringify(debugInfo.result.result.value, null, 2));

        ws.close();
    } finally {
        chrome.kill();
    }
}

debugExtractor().catch(console.error);
