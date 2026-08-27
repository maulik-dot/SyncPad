import { useState, useEffect, useRef } from 'react'
import { useAuth } from './context/AuthContext'
import { documentService } from './services/documentService'
import { folderService } from './services/folderService'
import { workspaceService } from './services/workspaceService'
import { wsService } from './services/websocketService'
import { VersionDiffViewer } from './components/VersionDiffViewer'
import { exportToMarkdown, exportToHtml, exportToPrintPdf } from './utils/exportUtils'
import type { Document, Folder, Workspace, DocumentVersion, DocumentComment, DocumentEditMessage, FileType, Role } from './types/api'

interface WorkspaceScreenProps {
  workspaceId?: string | number
  documentId?: string | number
  onHome: () => void
}

export default function WorkspaceScreen({ workspaceId, documentId: initialDocId, onHome }: WorkspaceScreenProps) {
  const { user } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeDoc, setActiveDoc] = useState<Document | null>(null)

  // Document Editor states
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [selectedDiffVersion, setSelectedDiffVersion] = useState<DocumentVersion | null>(null)
  const [comments, setComments] = useState<DocumentComment[]>([])
  const [newCommentText, setNewCommentText] = useState('')
  const [replyParentId, setReplyParentId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'editor' | 'versions' | 'comments'>('editor')
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Unsaved changes'>('Saved')
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([])
  
  // Modals
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<Role>('EDITOR')
  const [showShareModal, setShowShareModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('EDITOR')
  const [newFolderName, setNewFolderName] = useState('')
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocType, setNewDocType] = useState<FileType>('DOC')
  const [loading, setLoading] = useState(true)

  const isLocalUpdate = useRef(false)
  const saveTimeout = useRef<any>(null)
  const titleTimeout = useRef<any>(null)

  // 1. Initial Load: Workspaces, Folders, and Documents
  const loadWorkspaceData = async () => {
    setLoading(true)
    try {
      const wsList = await workspaceService.getWorkspaces().catch(() => [] as Workspace[])
      setWorkspaces(wsList)

      let targetWs: Workspace | null = null
      if (workspaceId) {
        targetWs = wsList.find(w => String(w.id) === String(workspaceId) || w.name === String(workspaceId)) || null
      }
      if (!targetWs && wsList.length > 0) {
        targetWs = wsList[0]
      }
      setCurrentWorkspace(targetWs)

      const wsName = targetWs ? targetWs.name : undefined
      const [folderList, docList] = await Promise.all([
        folderService.getFolders(wsName).catch(() => [] as Folder[]),
        documentService.getDocuments({ workspace: wsName }).catch(() => [] as Document[])
      ])

      setFolders(folderList)
      setDocuments(docList)

      if (initialDocId) {
        const found = docList.find(d => String(d.id) === String(initialDocId))
        if (found) {
          await selectDocument(found.id)
        } else {
          await selectDocument(initialDocId)
        }
      } else if (docList.length > 0) {
        await selectDocument(docList[0].id)
      }
    } catch (err) {
      console.error('Failed to load workspace data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkspaceData()
  }, [workspaceId, initialDocId])

  // 2. Select and Load Document Details
  const selectDocument = async (id: number | string) => {
    try {
      const detail = await documentService.getDocumentDetail(id)
      const docObj: Document = {
        id: detail.id,
        title: detail.title,
        content: detail.content,
        fileType: detail.fileType,
        folderId: detail.folderId,
        owner: {
          id: detail.ownerId || 0,
          name: detail.ownerName || 'Unknown',
          email: detail.ownerEmail || 'unknown@syncpad.com'
        },
        currentUserRole: detail.currentUserRole,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      }
      setActiveDoc(docObj)
      setTitle(detail.title)
      setContent(detail.content || '')
      setVersions(detail.versions || [])
      setComments(detail.comments || [])
      setShareLinkUrl(null)
    } catch (e) {
      console.error('Failed to load document details', e)
    }
  }

  // 3. Connect to STOMP WebSocket for real-time collaboration
  useEffect(() => {
    if (!activeDoc?.id) return
    const numId = Number(activeDoc.id)
    if (isNaN(numId)) return

    wsService.connect(
      numId,
      (msg: DocumentEditMessage) => {
        if (msg.senderEmail && msg.senderEmail === user?.email) {
          return
        }

        if (msg.type === 'EDIT') {
          if (msg.content !== undefined) {
            isLocalUpdate.current = true
            setContent(msg.content)
          }
          if (msg.title !== undefined) {
            setTitle(msg.title)
          }
        } else if (msg.type === 'SAVED') {
          setSaveStatus('Saved')
          documentService.getVersions(numId).then(setVersions).catch(() => {})
        } else if (msg.type === 'PRESENCE') {
          if (msg.senderName && !activeCollaborators.includes(msg.senderName)) {
            setActiveCollaborators(prev => [...new Set([...prev, msg.senderName!])])
          }
        }
      }
    )

    return () => {
      wsService.disconnect()
    }
  }, [activeDoc?.id, user?.email])

  // 4. Handle Content Changes (Debounced Autosave + WebSocket Broadcast)
  const handleContentChange = (newText: string) => {
    setContent(newText)
    setSaveStatus('Saving...')

    if (!activeDoc?.id) return
    const numId = Number(activeDoc.id)

    wsService.sendEdit(title, newText, user?.name || user?.email)

    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        if (!isNaN(numId)) {
          wsService.sendSave(title, newText, user?.name || user?.email)
        }
        // Always confirm persistence via REST endpoint for guaranteed durability
        await documentService.updateDocument(activeDoc.id, { title, content: newText })
        setSaveStatus('Saved')
      } catch (err) {
        console.error('Save failed', err)
        setSaveStatus('Unsaved changes')
      }
    }, 1500)
  }

  // Debounced Title Changes
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    if (!activeDoc?.id) return
    wsService.sendEdit(newTitle, content, user?.name || user?.email)

    if (titleTimeout.current) clearTimeout(titleTimeout.current)
    titleTimeout.current = setTimeout(async () => {
      try {
        await documentService.renameDocument(activeDoc.id, newTitle)
        setDocuments(prev => prev.map(d => d.id === activeDoc.id ? { ...d, title: newTitle } : d))
      } catch (e) {
        console.error(e)
      }
    }, 800)
  }

  // 5. Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    try {
      const folder = await folderService.createFolder({
        name: newFolderName.trim(),
        workspaceName: currentWorkspace?.name || undefined,
        parentFolderId: selectedFolder?.id
      })
      setFolders(prev => [...prev, folder])
      setNewFolderName('')
      setShowNewFolderModal(false)
    } catch (err: any) {
      alert(err.message || 'Failed to create folder')
    }
  }

  // 6. Create Document / File
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDocTitle.trim()) return
    try {
      const created = await documentService.createDocument({
        title: newDocTitle.trim(),
        fileType: newDocType,
        folderId: selectedFolder?.id,
        workspaceName: currentWorkspace?.name || undefined
      })
      setDocuments(prev => [created, ...prev])
      setNewDocTitle('')
      setShowNewDocModal(false)
      await selectDocument(created.id)
    } catch (err: any) {
      alert(err.message || 'Failed to create document')
    }
  }

  // 7. Delete Document
  const handleDeleteDocument = async () => {
    if (!activeDoc?.id) return
    if (!confirm(`Are you sure you want to delete '${activeDoc.title}'?`)) return
    try {
      await documentService.deleteDocument(activeDoc.id)
      setDocuments(prev => prev.filter(d => d.id !== activeDoc.id))
      setActiveDoc(null)
    } catch (e: any) {
      alert(e.message || 'Failed to delete document')
    }
  }

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!activeDoc?.id) return
    try {
      setLoading(true)
      const restored = await documentService.restoreVersion(activeDoc.id, versionNumber)
      setContent(restored.content || '')
      setTitle(restored.title)
      wsService.sendEdit(restored.title, restored.content || '', user?.name || user?.email)
      const newVers = await documentService.getVersions(activeDoc.id)
      setVersions(newVers)
      setActiveTab('editor')
    } catch (e) {
      console.error('Restore failed', e)
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim() || !activeDoc?.id) return
    try {
      const added = await documentService.addComment(
        activeDoc.id, 
        newCommentText.trim(),
        undefined,
        replyParentId || undefined
      )
      setComments(prev => [added, ...prev])
      setNewCommentText('')
      setReplyParentId(null)
    } catch (e: any) {
      alert(e.message || 'Failed to add comment')
    }
  }

  const handleResolveComment = async (commentId: number) => {
    if (!activeDoc?.id) return
    try {
      const updated = await documentService.resolveComment(activeDoc.id, commentId)
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, resolved: updated.resolved } : c))
    } catch (e: any) {
      alert(e.message || 'Failed to update comment')
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!activeDoc?.id) return
    try {
      await documentService.deleteComment(activeDoc.id, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (e: any) {
      alert(e.message || 'Failed to delete comment')
    }
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareEmail.trim() || !activeDoc?.id) return
    try {
      await documentService.shareDocument(activeDoc.id, shareEmail.trim(), shareRole)
      alert(`Shared document with ${shareEmail} as ${shareRole}`)
      setShareEmail('')
    } catch (err: any) {
      alert(err.message || 'Share failed')
    }
  }

  const handleGenerateShareLink = async () => {
    if (!activeDoc?.id) return
    try {
      const res = await documentService.generateShareLink(activeDoc.id, 'VIEWER', 7)
      setShareLinkUrl(window.location.origin + res.url)
    } catch (err: any) {
      alert(err.message || 'Failed to generate link')
    }
  }

  const handleOpenMembers = async () => {
    if (!currentWorkspace?.id) return
    try {
      const mList = await workspaceService.getMembers(currentWorkspace.id)
      setMembers(mList)
      setShowMembersModal(true)
    } catch (e) {
      console.error(e)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !currentWorkspace?.id) return
    try {
      await workspaceService.inviteMember(currentWorkspace.id, inviteEmail.trim(), inviteRole)
      alert(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      const mList = await workspaceService.getMembers(currentWorkspace.id)
      setMembers(mList)
    } catch (err: any) {
      alert(err.message || 'Invite failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center text-white text-sm">
        Loading workspace...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#111] flex flex-col text-white">
      {/* Top Navbar */}
      <header className="h-14 border-b border-[#222] flex items-center justify-between px-6 bg-[#161616] shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onHome}
            className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors"
          >
            ← Home
          </button>
          <div className="h-4 w-[1px] bg-[#333]" />
          <div className="flex items-center gap-2">
            <span 
              onClick={handleOpenMembers}
              className="text-xs font-semibold px-2 py-0.5 rounded bg-[#252525] text-blue-400 cursor-pointer hover:bg-[#303030] transition-colors"
              title="Click to view workspace members"
            >
              {currentWorkspace?.name || 'Workspace'} 👥
            </span>
            {activeDoc && (
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="bg-transparent text-sm font-semibold text-white outline-none border-b border-transparent focus:border-[#444] px-1 transition-colors"
                placeholder="Untitled Document"
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#202020] hover:bg-[#282828] border border-[#2e2e2e] text-[11px] text-[#888] hover:text-white transition-colors cursor-pointer"
            title="Search documents (Cmd+K)"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search</span>
            <kbd className="font-mono text-[9px] px-1 py-0.2 rounded bg-[#333] text-[#aaa]">⌘K</kbd>
          </button>

          {activeDoc && <span className="text-[11px] text-[#666]">{saveStatus}</span>}

          {activeCollaborators.length > 0 && (
            <div className="flex items-center gap-1">
              {activeCollaborators.map((c, i) => (
                <div
                  key={i}
                  title={`Collaborator: ${c}`}
                  className="w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#111]"
                >
                  {c[0].toUpperCase()}
                </div>
              ))}
            </div>
          )}

          {activeDoc && (
            <div className="flex bg-[#222] rounded-lg p-0.5 border border-[#333]">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'editor' ? 'bg-[#333] text-white' : 'text-[#888] hover:text-white'
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => setActiveTab('versions')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'versions' ? 'bg-[#333] text-white' : 'text-[#888] hover:text-white'
                }`}
              >
                History ({versions.length})
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'comments' ? 'bg-[#333] text-white' : 'text-[#888] hover:text-white'
                }`}
              >
                Comments ({comments.length})
              </button>
            </div>
          )}

          {activeDoc && (
            <>
              <button
                onClick={() => setShowShareModal(true)}
                className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Share
              </button>

              {/* Export Suite Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(prev => !prev)}
                  className="h-8 px-2.5 rounded-lg border border-[#333] hover:border-[#555] text-[#ccc] hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer bg-[#1c1c1c]"
                  title="Export Document (Markdown, HTML, PDF)"
                >
                  <span>⤓</span>
                  <span>Export</span>
                </button>

                {showExportMenu && (
                  <div 
                    className="absolute right-0 mt-1.5 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                    onClick={() => setShowExportMenu(false)}
                  >
                    <button
                      onClick={() => exportToMarkdown(title, content, currentWorkspace?.name, activeDoc?.version)}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#ddd] hover:bg-[#252525] hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <span className="text-blue-400 font-mono font-bold text-[10px] bg-blue-950/40 px-1.5 py-0.5 rounded">.MD</span>
                      <span>Markdown (.md)</span>
                    </button>
                    <button
                      onClick={() => exportToHtml(title, content, currentWorkspace?.name)}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#ddd] hover:bg-[#252525] hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <span className="text-amber-400 font-mono font-bold text-[10px] bg-amber-950/40 px-1.5 py-0.5 rounded">.HTML</span>
                      <span>HTML Document (.html)</span>
                    </button>
                    <button
                      onClick={() => exportToPrintPdf(title, content, currentWorkspace?.name)}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#ddd] hover:bg-[#252525] hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <span className="text-red-400 font-mono font-bold text-[10px] bg-red-950/40 px-1.5 py-0.5 rounded">.PDF</span>
                      <span>Print to PDF (.pdf)</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleDeleteDocument}
                className="h-8 px-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors"
                title="Delete Document"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Layout: Sidebar & Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Folders and Documents */}
        <aside className="w-64 bg-[#141414] border-r border-[#222] flex flex-col shrink-0">
          {/* Folders header */}
          <div className="p-3 border-b border-[#222] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#666] uppercase tracking-wider">Folders</span>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="text-xs text-[#888] hover:text-white px-2 py-0.5 rounded bg-[#222] transition-colors"
              title="Create new folder"
            >
              + Folder
            </button>
          </div>

          {/* Folders List */}
          <div className="p-2 space-y-1 overflow-y-auto max-h-48 border-b border-[#222]">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                selectedFolder === null ? 'bg-[#252525] text-white font-medium' : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              <span>📁</span>
              <span className="truncate">All Files & Documents</span>
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFolder(f)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                  selectedFolder?.id === f.id ? 'bg-[#252525] text-white font-medium' : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <span>📂</span>
                <span className="truncate">{f.name}</span>
              </button>
            ))}
            {folders.length === 0 && (
              <p className="text-[11px] text-[#555] px-2 py-1">No folders yet</p>
            )}
          </div>

          {/* Documents Header */}
          <div className="p-3 border-b border-[#222] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#666] uppercase tracking-wider">
              {selectedFolder ? `${selectedFolder.name} Files` : 'Documents'}
            </span>
            <button
              onClick={() => setShowNewDocModal(true)}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
            >
              + New
            </button>
          </div>

          {/* Documents List */}
          <div className="flex-1 p-2 space-y-1 overflow-y-auto">
            {documents
              .filter(d => !selectedFolder || d.folderId === selectedFolder.id)
              .map(docItem => (
                <button
                  key={docItem.id}
                  onClick={() => selectDocument(docItem.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                    activeDoc?.id === docItem.id
                      ? 'bg-[#252525] text-white font-medium border border-[#333]'
                      : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${docItem.fileType === 'PDF' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <span className="truncate flex-1">{docItem.title}</span>
                </button>
              ))}
            {documents.length === 0 && (
              <p className="text-[11px] text-[#555] px-2 py-3 text-center">No documents found</p>
            )}
          </div>
        </aside>

        {/* Right Editor / Workspace Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#111]">
          {activeDoc ? (
            <>
              {activeTab === 'editor' && (
                <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-8">
                  <textarea
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Start typing your collaborative document in markdown..."
                    className="flex-1 w-full bg-transparent resize-none outline-none font-mono text-sm leading-relaxed text-[#ddd] placeholder:text-[#444]"
                  />
                </div>
              )}

              {activeTab === 'versions' && (
                <div className="flex-1 max-w-4xl mx-auto w-full p-8 overflow-y-auto">
                  {selectedDiffVersion ? (
                    <VersionDiffViewer
                      oldTitle={selectedDiffVersion.title}
                      oldContent={selectedDiffVersion.content || ''}
                      newTitle={title}
                      newContent={content}
                      oldLabel={`v${selectedDiffVersion.versionNumber} (${selectedDiffVersion.savedBy || 'Snapshot'})`}
                      newLabel="Current Editor Version"
                      onRestore={() => {
                        handleRestoreVersion(selectedDiffVersion.versionNumber)
                        setSelectedDiffVersion(null)
                      }}
                      onClose={() => setSelectedDiffVersion(null)}
                    />
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-lg font-bold">Version History Snapshots</h2>
                          <p className="text-xs text-[#777] mt-0.5">
                            Select "Compare Diff" to preview line additions and deletions before restoring.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {versions.map((ver) => (
                          <div
                            key={ver.id}
                            className="bg-[#1a1a1a] hover:bg-[#1e1e1e] border border-[#262626] rounded-xl p-4 flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-blue-400">v{ver.versionNumber}</span>
                                <span className="text-xs text-[#555]">•</span>
                                <span className="text-xs text-[#777]">
                                  {ver.savedAt ? new Date(ver.savedAt).toLocaleString() : 'recently'}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-white mt-1">{ver.title}</p>
                              <p className="text-[11px] text-[#666] mt-0.5">Saved by {ver.savedBy || 'Collaborator'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedDiffVersion(ver)}
                                className="h-8 px-3 rounded-lg bg-[#252525] hover:bg-[#303030] text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>⇄</span> Compare Diff
                              </button>
                              <button
                                onClick={() => handleRestoreVersion(ver.versionNumber)}
                                className="h-8 px-3 rounded-lg border border-[#333] hover:border-white text-xs text-[#ccc] hover:text-white transition-colors cursor-pointer"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        ))}
                        {versions.length === 0 && (
                          <p className="text-xs text-[#555]">No previous version snapshots found.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="flex-1 max-w-2xl mx-auto w-full p-8 flex flex-col">
                  <h2 className="text-lg font-bold mb-4">Document Comments & Discussions</h2>
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {comments.map((com) => (
                      <div key={com.id} className={`border rounded-xl p-4 transition-colors ${com.resolved ? 'bg-[#151515] border-[#222] opacity-60' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{com.authorName || 'User'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#555]">
                              {com.createdAt ? new Date(com.createdAt).toLocaleString() : 'recently'}
                            </span>
                            <button
                              onClick={() => handleResolveComment(com.id)}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${com.resolved ? 'border-green-600/30 text-green-400' : 'border-[#333] text-[#888] hover:text-white'}`}
                            >
                              {com.resolved ? '✓ Resolved' : 'Resolve'}
                            </button>
                            <button
                              onClick={() => handleDeleteComment(com.id)}
                              className="text-[10px] text-red-400 hover:text-red-300"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-[#ccc] leading-relaxed">{com.text}</p>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-xs text-[#555]">No comments yet.</p>
                    )}
                  </div>

                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 h-10 px-3.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-xs placeholder:text-[#555] outline-none focus:border-[#444]"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentText.trim()}
                      className="h-10 px-4 bg-white text-[#111] font-semibold text-xs rounded-lg hover:bg-[#eee] disabled:opacity-40 transition-colors"
                    >
                      Post
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <p className="text-[#666] text-sm mb-3">No document selected</p>
              <button
                onClick={() => setShowNewDocModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                Create Document
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modal: New Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNewFolderModal(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Create Folder</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#777] uppercase tracking-wider mb-1.5">Folder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Specifications"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  autoFocus
                  className="w-full h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="flex-1 h-10 rounded-lg border border-[#2a2a2a] text-[#888] text-sm hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="flex-1 h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Document */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNewDocModal(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Create Document</h3>
            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#777] uppercase tracking-wider mb-1.5">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architecture Overview"
                  value={newDocTitle}
                  onChange={e => setNewDocTitle(e.target.value)}
                  autoFocus
                  className="w-full h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#777] uppercase tracking-wider mb-1.5">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDocType('DOC')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border ${newDocType === 'DOC' ? 'bg-[#252525] border-white text-white' : 'border-[#2a2a2a] text-[#777]'}`}
                  >
                    Markdown / Doc
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDocType('PDF')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border ${newDocType === 'PDF' ? 'bg-[#252525] border-white text-white' : 'border-[#2a2a2a] text-[#777]'}`}
                  >
                    PDF Document
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewDocModal(false)}
                  className="flex-1 h-10 rounded-lg border border-[#2a2a2a] text-[#888] text-sm hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDocTitle.trim()}
                  className="flex-1 h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
                >
                  Create Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Share Document */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Share Document</h3>
            
            <form onSubmit={handleShare} className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-[#777] uppercase tracking-wider mb-1.5">Collaborator Email</label>
                <input
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#777] uppercase tracking-wider mb-1.5">Permission Role</label>
                <select
                  value={shareRole}
                  onChange={e => setShareRole(e.target.value as Role)}
                  className="w-full h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm outline-none focus:border-[#444]"
                >
                  <option value="EDITOR">Editor (Can edit)</option>
                  <option value="VIEWER">Viewer (Read-only)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
              >
                Share
              </button>
            </form>

            <div className="border-t border-[#222] pt-4">
              <label className="block text-xs font-medium text-[#777] uppercase tracking-wider mb-2">Public Share Link</label>
              {shareLinkUrl ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareLinkUrl}
                    className="flex-1 h-9 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-xs text-white"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareLinkUrl)
                      alert('Copied link!')
                    }}
                    className="h-9 px-3 bg-white text-[#111] text-xs font-semibold rounded-lg hover:bg-[#eee]"
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateShareLink}
                  className="w-full h-9 rounded-lg border border-[#333] hover:border-[#444] text-xs text-[#ccc] hover:text-white"
                >
                  Generate Shareable Link
                </button>
              )}
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full mt-4 h-9 rounded-lg border border-[#2a2a2a] text-[#888] text-xs hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modal: Workspace Members & Invites */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowMembersModal(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{currentWorkspace?.name} — Members</h3>

            <form onSubmit={handleInviteMember} className="flex gap-2 mb-6">
              <input
                type="email"
                required
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1 h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-xs placeholder:text-[#555] outline-none focus:border-[#444]"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
                className="h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-xs"
              >
                <option value="EDITOR">Editor</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button
                type="submit"
                className="h-10 px-4 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-500"
              >
                Invite
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-[#111] rounded-lg border border-[#222]">
                  <div>
                    <p className="text-xs font-semibold text-white">{m.user?.name || 'Member'}</p>
                    <p className="text-[11px] text-[#666]">{m.user?.email}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#252525] text-blue-400">
                    {m.role}
                  </span>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-xs text-[#555]">No other members yet.</p>
              )}
            </div>

            <button
              onClick={() => setShowMembersModal(false)}
              className="w-full h-9 rounded-lg border border-[#2a2a2a] text-[#888] text-xs hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
