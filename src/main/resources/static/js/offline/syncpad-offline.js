/**
 * SyncPad Offline IndexedDB & Mutation Sync Engine
 */
class SyncPadOfflineDB {
  constructor() {
    this.dbName = 'SyncPadDB';
    this.dbVersion = 1;
    this.db = null;
    this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        console.warn('IndexedDB not supported on this platform');
        return resolve(null);
      }

      const req = indexedDB.open(this.dbName, this.dbVersion);

      req.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workspaces')) {
          db.createObjectStore('workspaces', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };

      req.onsuccess = event => {
        this.db = event.target.result;
        this.setupNetworkListeners();
        resolve(this.db);
      };

      req.onerror = event => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.updateNetworkBadge(true);
      this.flushSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.updateNetworkBadge(false);
    });

    this.updateNetworkBadge(navigator.onLine);
  }

  updateNetworkBadge(isOnline) {
    const badge = document.getElementById('networkStatusBadge');
    if (!badge) return;
    if (isOnline) {
      badge.className = 'network-badge online';
      badge.innerHTML = '<span class="status-dot online"></span> Online';
    } else {
      badge.className = 'network-badge offline';
      badge.innerHTML = '<span class="status-dot offline"></span> Offline Mode';
    }
  }

  async saveDocumentLocally(doc) {
    if (!this.db || !doc || !doc.id) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('documents', 'readwrite');
      tx.objectStore('documents').put(doc);
      tx.oncomplete = () => resolve(doc);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getDocumentLocally(id) {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('documents', 'readonly');
      const req = tx.objectStore('documents').get(Number(id));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async queueMutation(mutation) {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      tx.objectStore('syncQueue').add({
        ...mutation,
        timestamp: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async flushSyncQueue() {
    if (!this.db || !navigator.onLine) return;
    const tx = this.db.transaction('syncQueue', 'readonly');
    const req = tx.objectStore('syncQueue').getAll();

    req.onsuccess = async () => {
      const queue = req.result || [];
      if (queue.length === 0) return;

      console.log(`Flushing ${queue.length} offline mutations...`);
      for (const item of queue) {
        try {
          await fetch(item.url, {
            method: item.method || 'POST',
            headers: item.headers || { 'Content-Type': 'application/json' },
            body: item.body ? JSON.stringify(item.body) : null
          });
        } catch (err) {
          console.warn('Failed to replay mutation:', item, err);
          return;
        }
      }

      const clearTx = this.db.transaction('syncQueue', 'readwrite');
      clearTx.objectStore('syncQueue').clear();
      console.log('Offline sync queue flushed successfully.');
      if (typeof toast === 'function') {
        toast('Offline changes synced to server');
      }
    };
  }
}

window.syncPadOffline = new SyncPadOfflineDB();
