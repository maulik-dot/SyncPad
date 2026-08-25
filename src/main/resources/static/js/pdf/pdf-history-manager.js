/**
 * SyncPad PDF History Manager
 * Manages dedicated Undo / Redo history stacks for PDF annotations
 * without reloading the base PDF document.
 */
class PDFHistoryManager {
    constructor(annotationManager) {
        this.annotManager = annotationManager;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.isApplyingHistory = false;

        this.initKeyboardShortcuts();
        setTimeout(() => this.updateUiButtons(), 100);
    }

    pushState() {
        if (this.isApplyingHistory) return;

        // Clone current annotations deeply
        const snapshot = JSON.parse(JSON.stringify(this.annotManager.annotations));
        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        // Clear redo stack on new user action
        this.redoStack = [];
        this.updateUiButtons();
    }

    undo() {
        if (this.undoStack.length === 0) {
            toast('Nothing to undo in PDF');
            return false;
        }

        this.isApplyingHistory = true;
        // 1. Push current state to redo stack
        const currentState = JSON.parse(JSON.stringify(this.annotManager.annotations));
        this.redoStack.push(currentState);

        // 2. Pop the current state snapshot from undo stack
        this.undoStack.pop();

        // 3. Target state is either the previous snapshot or empty array
        const targetState = this.undoStack.length > 0 ?
            JSON.parse(JSON.stringify(this.undoStack[this.undoStack.length - 1])) :
            [];

        this.annotManager.annotations = targetState;
        const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
        this.annotManager.renderActivePage(scale);
        this.annotManager.notifyChange('UNDO');
        this.isApplyingHistory = false;

        this.updateUiButtons();
        toast('↺ Undid PDF action');
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) {
            toast('Nothing to redo in PDF');
            return false;
        }

        this.isApplyingHistory = true;
        // 1. Current state goes onto undo stack
        const currentState = JSON.parse(JSON.stringify(this.annotManager.annotations));
        this.undoStack.push(currentState);

        // 2. Pop next state from redo stack
        const nextState = this.redoStack.pop();
        this.annotManager.annotations = JSON.parse(JSON.stringify(nextState));
        const scale = window.pdfEngine ? window.pdfEngine.currentScale : 1.0;
        this.annotManager.renderActivePage(scale);
        this.annotManager.notifyChange('REDO');
        this.isApplyingHistory = false;

        this.updateUiButtons();
        toast('↻ Redid PDF action');
        return true;
    }

    updateUiButtons() {
        const undoBtn = document.getElementById('pdfToolUndo');
        const redoBtn = document.getElementById('pdfToolRedo');

        const canUndo = this.undoStack.length > 0;
        const canRedo = this.redoStack.length > 0;

        if (undoBtn) {
            undoBtn.classList.toggle('disabled', !canUndo);
            undoBtn.style.opacity = canUndo ? '1' : '0.4';
            undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
            undoBtn.disabled = !canUndo;
        }
        if (redoBtn) {
            redoBtn.classList.toggle('disabled', !canRedo);
            redoBtn.style.opacity = canRedo ? '1' : '0.4';
            redoBtn.style.cursor = canRedo ? 'pointer' : 'not-allowed';
            redoBtn.disabled = !canRedo;
        }
    }

    initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // If focus is inside document editor or text inputs, don't hijack
            if (document.activeElement && (document.activeElement.id === 'docPageSheet' || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isMod = isMac ? e.metaKey : e.ctrlKey;

            if (isMod && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    this.redo();
                } else {
                    e.preventDefault();
                    this.undo();
                }
            } else if (isMod && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.redo();
            }
        });
    }
}

window.PDFHistoryManager = PDFHistoryManager;
