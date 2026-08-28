import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { documentService } from './services/documentService'
import { workspaceService } from './services/workspaceService'
import { AuthModal } from './components/AuthModal'
import type { Document, Workspace as ApiWorkspace, FileType } from './types/api'

type WorkspaceItem = {
  id: string | number
  name: string
  description: string
  members: number
  files: number
  color: string
  initial: string
  updatedAt: string
  role: 'Admin' | 'Member' | 'Viewer'
}

type RecentFile = {
  id: string | number
  name: string
  workspace: string
  type: 'pdf' | 'doc' | 'sheet' | 'notion'
  modifiedAt: string
  modifiedBy: string
  avatarColor: string
  documentObj?: Document
}

const FILE_TYPE_META: Record<RecentFile['type'], { bg: string; label: string; fg: string }> = {
  pdf:    { bg: '#e53e3e', label: 'PDF', fg: '#fff' },
  doc:    { bg: '#3182ce', label: 'DOC', fg: '#fff' },
  sheet:  { bg: '#38a169', label: 'XLS', fg: '#fff' },
  notion: { bg: '#ffffff', label: 'N',   fg: '#111' },
}

function FileChip({ type }: { type: RecentFile['type'] }) {
  const { bg, label, fg } = FILE_TYPE_META[type] || FILE_TYPE_META.doc
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded text-[9px] font-bold shrink-0"
      style={{ background: bg, color: fg }}>{label}</span>
  )
}

function CreateWorkspaceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, desc: string) => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Create Workspace</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-xl transition-colors leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#666] mb-1.5 uppercase tracking-wider">Workspace Name</label>
            <input
              type="text"
              placeholder="e.g. Design Team"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#666] mb-1.5 uppercase tracking-wider">Description <span className="normal-case text-[#444]">(optional)</span></label>
            <input
              type="text"
              placeholder="What's this workspace for?"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444] transition-colors"
            />
          </div>
          <div className="pt-1 flex gap-3">
            <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-[#2a2a2a] text-[#666] text-sm font-medium hover:text-white hover:border-[#444] transition-colors">
              Cancel
            </button>
            <button
              onClick={() => { if (name.trim()) { onCreate(name.trim(), desc.trim()); onClose() } }}
              disabled={!name.trim()}
              className="flex-1 h-10 rounded-lg bg-white text-[#111] text-sm font-semibold hover:bg-[#eee] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateDocumentModal({ workspaces, onClose, onCreate }: { workspaces: WorkspaceItem[]; onClose: () => void; onCreate: (title: string, type: FileType, workspaceName?: string) => void }) {
  const [title, setTitle] = useState('')
  const [fileType, setFileType] = useState<FileType>('DOC')
  const [selectedWs, setSelectedWs] = useState<string>(workspaces[0]?.name || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Create New Document</h2>
          <button onClick={onClose} className="text-[#555] hover:text-white text-xl transition-colors leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#666] mb-1.5 uppercase tracking-wider">Document Title</label>
            <input
              type="text"
              placeholder="e.g. Architecture RFC"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              className="w-full h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#666] mb-1.5 uppercase tracking-wider">Document Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFileType('DOC')}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${fileType === 'DOC' ? 'border-white bg-[#222] text-white' : 'border-[#2a2a2a] text-[#666] hover:text-white'}`}
              >
                Markdown / Doc
              </button>
              <button
                type="button"
                onClick={() => setFileType('PDF')}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${fileType === 'PDF' ? 'border-white bg-[#222] text-white' : 'border-[#2a2a2a] text-[#666] hover:text-white'}`}
              >
                PDF Document
              </button>
            </div>
          </div>
          {workspaces.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#666] mb-1.5 uppercase tracking-wider">Workspace</label>
              <select
                value={selectedWs}
                onChange={e => setSelectedWs(e.target.value)}
                className="w-full h-10 px-3 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm outline-none focus:border-[#444]"
              >
                {workspaces.map(w => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="pt-1 flex gap-3">
            <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-[#2a2a2a] text-[#666] text-sm font-medium hover:text-white hover:border-[#444] transition-colors">
              Cancel
            </button>
            <button
              onClick={() => { if (title.trim()) { onCreate(title.trim(), fileType, selectedWs); onClose() } }}
              disabled={!title.trim()}
              className="flex-1 h-10 rounded-lg bg-white text-[#111] text-sm font-semibold hover:bg-[#eee] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomeScreen({ 
  onOpenWorkspace, 
  onOpenDocument 
}: { 
  onOpenWorkspace: (id: string) => void
  onOpenDocument?: (docId: string | number, workspaceId?: string | number) => void 
}) {
  const { user, isAuthenticated, logout } = useAuth()
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [recentDocs, setRecentDocs] = useState<RecentFile[]>([])
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [showCreateDoc, setShowCreateDoc] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      const [wsList, docList] = await Promise.all([
        workspaceService.getWorkspaces().catch(() => [] as ApiWorkspace[]),
        documentService.getDocuments().catch(() => [] as Document[])
      ])

      const colors = ['#5b7fa6', '#7a6fa6', '#4a9068', '#a06060', '#c8622a', '#5e6ad2']
      const formattedWorkspaces: WorkspaceItem[] = wsList.map((ws, index) => ({
        id: ws.id,
        name: ws.name,
        description: ws.description || 'Organization workspace',
        members: (ws.permissions?.length || 0) + 1,
        files: docList.filter(d => d.workspaceName === ws.name).length,
        color: ws.color || colors[index % colors.length],
        initial: (ws.name?.trim().charAt(0) || 'W').toUpperCase(),
        updatedAt: ws.updatedAt ? new Date(ws.updatedAt).toLocaleDateString() : 'Active',
        role: ws.role === 'OWNER' || ws.currentUserRole === 'OWNER' ? 'Admin' : 'Member',
      }))

      setWorkspaces(formattedWorkspaces)

      const formattedDocs: RecentFile[] = docList.map(doc => {
        let fileType: RecentFile['type'] = 'doc'
        if (doc.fileType === 'PDF') fileType = 'pdf'
        return {
          id: doc.id,
          name: doc.title,
          workspace: doc.workspaceName || 'General',
          type: fileType,
          modifiedAt: doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : 'Recently',
          modifiedBy: (doc.owner?.name?.trim().charAt(0) || 'U').toUpperCase(),
          avatarColor: '#5b7fa6',
          documentObj: doc,
        }
      })

      setRecentDocs(formattedDocs)
    } catch (err) {
      console.error('Failed to load user data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [isAuthenticated])

  const handleCreateWorkspace = async (name: string, desc: string) => {
    try {
      await workspaceService.createWorkspace(name, desc)
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateDocument = async (title: string, fileType: FileType, workspaceName?: string) => {
    try {
      const created = await documentService.createDocument({
        title,
        fileType,
        workspaceName: workspaceName || workspaces[0]?.name || undefined
      })
      if (onOpenDocument) {
        onOpenDocument(created.id, workspaceName)
      } else {
        onOpenWorkspace(String(created.id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col">
      {/* Top nav */}
      <header className="h-14 border-b border-[#1e1e1e] flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
            <span className="text-[#111] text-xs font-black">S</span>
          </div>
          <span className="text-white font-semibold text-sm">SyncPad</span>
        </div>

        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search documents...</span>
          <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-[#2a2a2a] text-[#aaa]">⌘K</kbd>
        </button>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => setShowCreateDoc(true)}
                className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors flex items-center gap-1.5"
              >
                <span>+</span> New Doc
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#888]">{user?.name || user?.email}</span>
                <button
                  onClick={logout}
                  className="h-8 px-2.5 rounded-lg border border-[#2a2a2a] text-[#888] text-xs hover:text-white hover:border-[#444] transition-colors"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="h-8 px-4 rounded-lg bg-white text-[#111] text-xs font-semibold hover:bg-[#eee] transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* Greeting */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {isAuthenticated ? `Welcome back, ${user?.name || 'Collaborator'}` : 'Welcome to SyncPad'}
            </h1>
            <p className="text-[#555] text-sm mt-1">Real-time collaborative document workspace</p>
          </div>
          {!isAuthenticated && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors"
            >
              Get Started
            </button>
          )}
        </div>

        {/* Workspaces section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Workspaces</h2>
            {isAuthenticated && (
              <button
                onClick={() => setShowCreateWorkspace(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#222] text-white border border-[#333] text-xs font-medium hover:bg-[#2a2a2a] transition-colors"
              >
                <span className="text-base leading-none">+</span> New Workspace
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => onOpenWorkspace(String(ws.id))}
                className="bg-[#1a1a1a] border border-[#222] rounded-xl p-4 text-left hover:bg-[#1e1e1e] hover:border-[#2a2a2a] transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: ws.color }}
                  >
                    {ws.initial}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#222] text-[#555] font-medium uppercase tracking-wider">{ws.role}</span>
                </div>
                <p className="text-sm font-semibold text-white group-hover:text-white truncate">{ws.name}</p>
                <p className="text-[11px] text-[#555] mt-0.5 truncate">{ws.description}</p>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#222]">
                  <span className="text-[11px] text-[#444]">{ws.files} files</span>
                  <span className="text-[11px] text-[#444]">{ws.members} members</span>
                  <span className="text-[11px] text-[#333] ml-auto">{ws.updatedAt}</span>
                </div>
              </button>
            ))}

            {isAuthenticated && (
              <button
                onClick={() => setShowCreateWorkspace(true)}
                className="bg-transparent border border-dashed border-[#252525] rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-[#333] hover:bg-[#161616] transition-colors min-h-[140px] group"
              >
                <div className="w-9 h-9 rounded-lg border border-dashed border-[#333] flex items-center justify-center text-[#444] group-hover:text-[#666] text-xl transition-colors">+</div>
                <span className="text-xs text-[#444] group-hover:text-[#666] transition-colors">Create workspace</span>
              </button>
            )}
          </div>
        </section>

        {/* Documents Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Recent Documents</h2>
            {isAuthenticated && (
              <button
                onClick={() => setShowCreateDoc(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white text-[#111] text-xs font-semibold hover:bg-[#eee] transition-colors"
              >
                <span className="text-base leading-none">+</span> Create Document
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[#1e1e1e] overflow-hidden bg-[#161616]">
            <div className="flex items-center px-5 py-3 bg-[#131313] border-b border-[#1e1e1e]">
              <span className="flex-1 text-xs font-medium text-[#555] uppercase tracking-wider">Name</span>
              <span className="w-44 text-xs font-medium text-[#555] uppercase tracking-wider hidden md:block">Workspace</span>
              <span className="w-32 text-xs font-medium text-[#555] uppercase tracking-wider text-right hidden sm:block">Owner</span>
              <span className="w-36 text-xs font-medium text-[#555] uppercase tracking-wider text-right">Modified</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-[#555] text-xs">Loading documents...</div>
            ) : recentDocs.length === 0 ? (
              <div className="p-12 text-center text-[#444] text-sm">
                {isAuthenticated ? 'No documents found in database. Create your first document!' : 'Sign in to see your documents'}
              </div>
            ) : (
              recentDocs.map((file, i) => (
                <div
                  key={file.id}
                  onClick={() => {
                    if (onOpenDocument) onOpenDocument(file.id, file.workspace)
                    else onOpenWorkspace(String(file.id))
                  }}
                  className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#1c1c1c] transition-colors ${
                    i < recentDocs.length - 1 ? 'border-b border-[#1a1a1a]' : ''
                  }`}
                >
                  <FileChip type={file.type} />
                  <span className="flex-1 text-sm text-[#ccc] font-medium truncate">{file.name}</span>
                  <span className="w-44 text-xs text-[#555] hidden md:block truncate">{file.workspace}</span>
                  <div className="w-32 hidden sm:flex items-center justify-end">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                      style={{ background: file.avatarColor }}
                    >
                      {file.modifiedBy}
                    </div>
                  </div>
                  <span className="w-36 text-xs text-[#444] text-right shrink-0">{file.modifiedAt}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={() => { setShowAuthModal(false); loadData() }} />}
      {showCreateWorkspace && (
        <CreateWorkspaceModal onClose={() => setShowCreateWorkspace(false)} onCreate={handleCreateWorkspace} />
      )}
      {showCreateDoc && (
        <CreateDocumentModal workspaces={workspaces} onClose={() => setShowCreateDoc(false)} onCreate={handleCreateDocument} />
      )}
    </div>
  )
}
