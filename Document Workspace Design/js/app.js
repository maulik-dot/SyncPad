// ==========================================
// SYNCPAD APP BOOTSTRAPPER & EVENT DISPATCHER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
    if (typeof checkAuthSession === 'function') {
        checkAuthSession();
    }
    if (typeof initGoogleSignIn === 'function') {
        initGoogleSignIn();
    }
    if (typeof checkIncomingShareLink === 'function') {
        checkIncomingShareLink();
    }

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (typeof openGlobalSearch === 'function') {
                openGlobalSearch();
            }
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
            const editor = document.getElementById('editorView');
            if (editor && !editor.classList.contains('hidden')) {
                e.preventDefault();
                if (typeof selectTextStyle === 'function') {
                    selectTextStyle('latex', 'LaTeX Equation');
                }
            }
        }
    });
});
