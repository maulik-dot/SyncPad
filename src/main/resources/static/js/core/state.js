        // State Management
        let currentUser = null;
        let token = localStorage.getItem('syncpad_token') || null;
        
        let workspacesList = [];
        let activeWorkspace = null;

        let foldersList = [];
        let documentsList = [];
        let currentDoc = null;
        let isAnnotationActive = false;
        // Recently opened files (click-tracked, includes folder + workspace docs)
        let recentFilesList = [];
        function getRecentStorageKey() {
            const email = (currentUser && currentUser.email) || 'anon';
            return 'syncpad_recent_' + email;
        }
        function loadRecentFilesFromStorage() {
            try {
                const raw = localStorage.getItem(getRecentStorageKey());
                recentFilesList = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(recentFilesList)) recentFilesList = [];
            } catch (e) { recentFilesList = []; }
        }
        function isRootDoc(d) {
            if (!d) return true;
            if (d.folderId !== undefined && d.folderId !== null) return false;
            if (d.folder !== undefined && d.folder !== null) return false;
            return true;
        }
        function trackRecentFile(item) {
            if (!item || item.id == null) return;
            loadRecentFilesFromStorage();
            const entry = {
                id: item.id,
                title: item.title || 'Untitled',
                fileType: item.fileType || 'DOC',
                workspaceName: item.workspaceName || (activeWorkspace ? activeWorkspace.name : null),
                folderId: (item.folderId !== undefined ? item.folderId : (item.folder && item.folder.id ? item.folder.id : null)),
                folder: item.folder || null,
                updatedAt: item.updatedAt || new Date().toISOString(),
                lastOpened: new Date().toISOString()
            };
            recentFilesList = recentFilesList.filter(r => r.id !== entry.id);
            recentFilesList.unshift(entry);
            recentFilesList = recentFilesList.slice(0, 20);
            try { localStorage.setItem(getRecentStorageKey(), JSON.stringify(recentFilesList)); } catch (e) {}
        }

        // Active Folder state
        let activeFolder = null;
        let folderDocumentsList = [];
        let currentFolderFilter = 'all';
        let previousView = 'home'; // 'home' | 'dashboard'
        let createFolderItemType = 'DOC';
        let folderViewMode = 'grid'; // 'grid' | 'list'
        let folderSearchQuery = '';

        // Rename modal state
        let renameTarget = null; // { type: 'workspace'|'folder'|'doc', id: 101, name: 'Title' }

        // MOCK FALLBACK DATA (EMPTY FOR CLEAN PRODUCTION / USER CREATED DATA)
        const MOCK_WORKSPACES = [];
        const MOCK_FOLDERS = [];
        const MOCK_DOCS = [];
