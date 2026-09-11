/**
 * SyncPad PDF STOMP Collaborator
 * Synchronizes PDF annotations across all active users in real-time
 * via Spring Boot WebSocket STOMP broker.
 */
class PDFCollaborator {
    constructor(annotationManager) {
        this.annotManager = annotationManager;
        this.currentDocId = null;
        this.subscription = null;
        this.slashSubscription = null;
        this.isProcessingRemote = false;

        this.initAutoSync();
    }

    getStompClient() {
        if (window.stompClient && window.stompClient.connected) return window.stompClient;
        return null;
    }

    getCurrentUserEmail() {
        if (window.currentUser && window.currentUser.email) return window.currentUser.email;
        try {
            const raw = localStorage.getItem('syncpad_user');
            if (raw) {
                const u = JSON.parse(raw);
                if (u && u.email) return u.email;
            }
        } catch (e) {}
        return 'user@syncpad.com';
    }

    setDocumentId(docId) {
        if (this.currentDocId === docId) {
            this.resubscribe();
            return;
        }
        this.currentDocId = docId;
        this.subscribe();
    }

    resubscribe() {
        this.subscribe();
    }

    subscribe() {
        const client = this.getStompClient();
        if (!client || !this.currentDocId) {
            // STOMP not ready yet — retry shortly (doc opened before WS connect)
            try {
                if (this._retry) clearTimeout(this._retry);
                this._retry = setTimeout(() => this.subscribe(), 800);
            } catch (e) {}
            return;
        }

        if (this.subscription) {
            try { this.subscription.unsubscribe(); } catch (e) {}
            this.subscription = null;
        }
        if (this.slashSubscription) {
            try { this.slashSubscription.unsubscribe(); } catch (e) {}
            this.slashSubscription = null;
        }

        const onMessage = (message) => {
            try {
                const payload = JSON.parse(message.body);
                // Dedup: backend dual-broadcasts dot + slash
                const key = (payload.senderEmail || '') + '|' + (payload.actionType || '') + '|' + (payload.timestamp || '') + '|' + (payload.annotationId || (payload.annotation && payload.annotation.id) || '');
                const now = Date.now();
                if (!this._seen) this._seen = new Map();
                const last = this._seen.get(key);
                if (last && (now - last) < 2000) return;
                this._seen.set(key, now);
                if (this._seen.size > 200) {
                    const first = this._seen.keys().next().value;
                    this._seen.delete(first);
                }
                this.handleRemoteMessage(payload);
            } catch (e) {
                console.error('[PDFCollaborator] Message parse error:', e);
            }
        };

        // Dot-style topic only — RabbitMQ STOMP relay rejects '/' in topic names
        this.subscription = client.subscribe(`/topic/documents.${this.currentDocId}.pdf-annotations`, onMessage);
        this.slashSubscription = null;
    }

    handleRemoteMessage(payload) {
        if (!payload || !payload.actionType) return;
        // Ignore self broadcasts if sender matches current user
        const currentUser = this.getCurrentUserEmail();
        if (payload.senderEmail && currentUser && payload.senderEmail === currentUser) {
            return;
        }

        this.isProcessingRemote = true;

        try {
            if (payload.actionType === 'ADD' && payload.annotation) {
                const exists = this.annotManager.getAnnotationById(payload.annotation.id);
                if (!exists) {
                    this.annotManager.addAnnotation(payload.annotation, false);
                }
            } else if (payload.actionType === 'UPDATE' && payload.annotation) {
                this.annotManager.updateAnnotation(payload.annotation.id, payload.annotation, false);
            } else if (payload.actionType === 'DELETE' && payload.annotationId) {
                this.annotManager.deleteAnnotation(payload.annotationId, false);
            } else if (payload.actionType === 'CLEAR') {
                this.annotManager.clearPageAnnotations(payload.page, false);
            } else if (payload.actionType === 'SYNC_ALL' && Array.isArray(payload.annotations)) {
                this.annotManager.annotations = payload.annotations;
                this.annotManager.renderActivePage();
            }
        } finally {
            this.isProcessingRemote = false;
        }
    }

    broadcast(actionType, data = {}) {
        if (this.isProcessingRemote) return;
        const client = this.getStompClient();
        if (!client || !this.currentDocId) return;

        const payload = {
            actionType,
            documentId: this.currentDocId,
            senderEmail: this.getCurrentUserEmail(),
            timestamp: Date.now(),
            ...data
        };

        try {
            client.send(
                `/app/documents/${this.currentDocId}/pdf-annotation`,
                {},
                JSON.stringify(payload)
            );
        } catch (e) {
            console.warn('[PDFCollaborator] Broadcast error:', e);
        }
    }

    initAutoSync() {
        this.annotManager.setOnChange((event) => {
            if (this.isProcessingRemote) return;

            if (event.actionType === 'ADD' && event.annotations.length > 0) {
                const latest = event.annotations[event.annotations.length - 1];
                this.broadcast('ADD', { annotation: latest });
            } else if (event.actionType === 'UPDATE' || event.actionType === 'MOVE_OBJECT' || event.actionType === 'RESIZE_OBJECT' || event.actionType === 'EDIT_TEXT') {
                this.broadcast('SYNC_ALL', { annotations: this.annotManager.annotations });
            } else if (event.actionType === 'DELETE') {
                this.broadcast('SYNC_ALL', { annotations: this.annotManager.annotations });
            } else if (event.actionType === 'CLEAR') {
                this.broadcast('CLEAR', { page: this.annotManager.activePage });
            }
        });
    }
}

window.PDFCollaborator = PDFCollaborator;
