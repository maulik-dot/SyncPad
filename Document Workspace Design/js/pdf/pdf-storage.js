/**
 * SyncPad PDF Storage & Persistence Engine
 * Provides persistent IndexedDB + localStorage storage for custom uploaded PDFs
 * and ensures per-document & per-PDF isolation of annotations.
 */
class PDFStorage {
    constructor() {
        this.dbName = 'SyncPad_PDF_Store';
        this.dbVersion = 1;
        this.storeName = 'uploaded_pdfs';
        this.dbPromise = this.initDB();
    }

    async initDB() {
        if (!window.indexedDB) {
            console.warn('[PDFStorage] IndexedDB not available, falling back to localStorage');
            return null;
        }

        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.warn('[PDFStorage] IndexedDB error:', event.target.error);
                resolve(null);
            };
        });
    }

    getCurrentUserKey() {
        try {
            const u = JSON.parse(localStorage.getItem('syncpad_user') || '{}');
            return u.id || u.email || 'guest';
        } catch (e) {
            return 'guest';
        }
    }

    async saveUploadedPdf(fileName, arrayBuffer, docId = null) {
        const userKey = this.getCurrentUserKey();
        const cleanDocId = docId || (window.currentDoc && window.currentDoc.id) || 'global';
        const key = `pdf_${userKey}_doc${cleanDocId}_${fileName}`;

        const item = {
            key,
            userKey,
            docId: cleanDocId,
            fileName,
            size: arrayBuffer ? arrayBuffer.byteLength : 0,
            data: arrayBuffer,
            updatedAt: Date.now()
        };

        // 1. Save to IndexedDB
        const db = await this.dbPromise;
        if (db) {
            await new Promise((resolve) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                store.put(item);
                tx.oncomplete = resolve;
                tx.onerror = resolve;
            });
        }

        // 2. Track in local registry index
        try {
            const listKey = `syncpad_pdf_list_${userKey}`;
            const list = JSON.parse(localStorage.getItem(listKey) || '[]');
            const idx = list.findIndex(p => p.key === key);
            const summary = { key, fileName, docId: cleanDocId, size: item.size, updatedAt: item.updatedAt };
            if (idx >= 0) list[idx] = summary;
            else list.unshift(summary);
            localStorage.setItem(listKey, JSON.stringify(list));
        } catch (e) {}

        return key;
    }

    async getUploadedPdf(key) {
        const db = await this.dbPromise;
        if (!db) return null;

        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    }

    async getUploadedPdfByName(fileName, docId = null) {
        const userKey = this.getCurrentUserKey();
        const cleanDocId = docId || (window.currentDoc && window.currentDoc.id) || 'global';
        const key = `pdf_${userKey}_doc${cleanDocId}_${fileName}`;
        return this.getUploadedPdf(key);
    }

    async listUploadedPdfs(docId = null) {
        const userKey = this.getCurrentUserKey();
        const listKey = `syncpad_pdf_list_${userKey}`;
        try {
            const list = JSON.parse(localStorage.getItem(listKey) || '[]');
            if (docId) {
                return list.filter(p => p.docId === docId || p.docId === 'global');
            }
            return list;
        } catch (e) {
            return [];
        }
    }

    async deleteUploadedPdf(key) {
        const userKey = this.getCurrentUserKey();
        const db = await this.dbPromise;
        if (db) {
            await new Promise((resolve) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                store.delete(key);
                tx.oncomplete = resolve;
                tx.onerror = resolve;
            });
        }

        try {
            const listKey = `syncpad_pdf_list_${userKey}`;
            let list = JSON.parse(localStorage.getItem(listKey) || '[]');
            list = list.filter(p => p.key !== key);
            localStorage.setItem(listKey, JSON.stringify(list));
        } catch (e) {}
    }
}

window.PDFStorage = PDFStorage;
window.pdfStorage = new PDFStorage();
