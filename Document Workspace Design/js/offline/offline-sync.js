        // =========================================================================
        // LOCAL-FIRST OFFLINE EDITING & RECONNECT SYNC (INDEXEDDB)
        // =========================================================================
        const OFFLINE_DB_NAME = 'syncpad_local_store';
        const OFFLINE_DB_VERSION = 1;
        let offlineDb = null;

        function initOfflineDb() {
            return new Promise((resolve) => {
                if (!window.indexedDB) {
                    resolve(null);
                    return;
                }
                const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('documents')) {
                        db.createObjectStore('documents', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('sync_queue')) {
                        db.createObjectStore('sync_queue', { keyPath: 'queueId', autoIncrement: true });
                    }
                };
                req.onsuccess = (e) => {
                    offlineDb = e.target.result;
                    updateNetworkBadge();
                    resolve(offlineDb);
                };
                req.onerror = () => resolve(null);
            });
        }

        async function cacheDocumentLocally(doc) {
            if (!offlineDb || !doc || !doc.id) return;
            try {
                const tx = offlineDb.transaction('documents', 'readwrite');
                tx.objectStore('documents').put({
                    id: doc.id,
                    title: doc.title,
                    content: doc.content,
                    updatedAt: new Date().toISOString()
                });
            } catch (e) {
                console.warn('Failed to cache doc locally', e);
            }
        }

        async function queueOfflineDocEdit(docId, title, content) {
            if (!offlineDb) return;
            try {
                const tx = offlineDb.transaction('sync_queue', 'readwrite');
                tx.objectStore('sync_queue').add({
                    docId,
                    title,
                    content,
                    timestamp: Date.now()
                });
                updateNetworkBadge();
            } catch (e) {
                console.warn('Failed to queue offline edit', e);
            }
        }

        async function flushOfflineSyncQueue() {
            if (!offlineDb || !navigator.onLine || !token) return;
            try {
                const tx = offlineDb.transaction('sync_queue', 'readonly');
                const store = tx.objectStore('sync_queue');
                const allReq = store.getAll();
                allReq.onsuccess = async () => {
                    const queue = allReq.result;
                    if (!queue || queue.length === 0) return;

                    const latestByDoc = {};
                    queue.forEach(item => {
                        latestByDoc[item.docId] = item;
                    });

                    toast(`🔄 Syncing ${Object.keys(latestByDoc).length} offline edits to server...`);

                    for (const docId in latestByDoc) {
                        const item = latestByDoc[docId];
                        try {
                            await fetch(`/documents/${docId}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + token
                                },
                                body: JSON.stringify({ title: item.title, content: item.content })
                            });
                        } catch (err) {
                            console.warn('Sync failed for doc', docId, err);
                        }
                    }

                    const clearTx = offlineDb.transaction('sync_queue', 'readwrite');
                    clearTx.objectStore('sync_queue').clear();
                    clearTx.oncomplete = () => {
                        toast('✅ All offline edits synced with server!');
                        updateNetworkBadge();
                    };
                };
            } catch (e) {
                console.warn('Error syncing offline queue', e);
            }
        }

        function updateNetworkBadge() {
            const badge = document.getElementById('offlineStatusBadge');
            if (!badge) return;
            if (navigator.onLine) {
                badge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span> Online';
                badge.style.background = 'rgba(16, 185, 129, 0.1)';
                badge.style.color = '#10b981';
                badge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            } else {
                badge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#f59e0b;"></span> ⚡ Offline (Local)';
                badge.style.background = 'rgba(245, 158, 11, 0.1)';
                badge.style.color = '#f59e0b';
                badge.style.borderColor = 'rgba(245, 158, 11, 0.2)';
            }
        }

        window.addEventListener('online', () => {
            updateNetworkBadge();
            flushOfflineSyncQueue();
        });

        window.addEventListener('offline', () => {
            updateNetworkBadge();
            toast('⚡ You are currently offline. Changes are saved to IndexedDB and will sync once reconnected.', 'info');
        });

        // Initialize IndexedDB on DOM ready
        initOfflineDb();
