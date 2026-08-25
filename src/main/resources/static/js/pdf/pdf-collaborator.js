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
        this.isProcessingRemote = false;

        this.initAutoSync();
    }

    setDocumentId(docId) {
        if (this.currentDocId === docId) return;
        this.currentDocId = docId;
        this.subscribe();
    }

    subscribe() {
        if (!window.stompClient || !window.stompClient.connected || !this.currentDocId) return;

        if (this.subscription) {
            try { this.subscription.unsubscribe(); } catch (e) {}
            this.subscription = null;
        }

        const topic = `/topic/documents/${this.currentDocId}/pdf-annotations`;
        this.subscription = window.stompClient.subscribe(topic, (message) => {
            try {
                const payload = JSON.parse(message.body);
                this.handleRemoteMessage(payload);
            } catch (e) {
                console.error('[PDFCollaborator] Message parse error:', e);
            }
        });
    }

    handleRemoteMessage(payload) {
        if (!payload || !payload.actionType) return;
        // Ignore self broadcasts if sender matches current user
        const currentUser = window.currentUser ? window.currentUser.email : null;
        if (payload.senderEmail && currentUser && payload.senderEmail === currentUser) {
            return;
        }

        this.isProcessingRemote = true;

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

        this.isProcessingRemote = false;
    }

    broadcast(actionType, data = {}) {
        if (this.isProcessingRemote) return;
        if (!window.stompClient || !window.stompClient.connected || !this.currentDocId) return;

        const payload = {
            actionType,
            documentId: this.currentDocId,
            senderEmail: window.currentUser ? window.currentUser.email : 'user@syncpad.com',
            timestamp: Date.now(),
            ...data
        };

        try {
            window.stompClient.send(
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
