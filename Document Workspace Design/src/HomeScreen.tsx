import { useState } from 'react'

type Workspace = {
  id: string
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
  id: string
  name: string
  workspace: string
  type: 'pdf' | 'doc' | 'sheet' | 'notion'
  modifiedAt: string
  modifiedBy: string
  avatarColor: string
}

type Draft = {
  id: string
  name: string
  workspace: string
  savedAt: string
}

const WORKSPACES: Workspace[] = [
  { id: 'ws1', name: 'Wintermute Studio', description: 'Main product & design org', members: 5, files: 128, color: '#5b7fa6', initial: 'W', updatedAt: 'Today', role: 'Admin' },
  { id: 'ws2', name: 'Research Lab', description: 'User research & insights', members: 3, files: 54, color: '#7a6fa6', initial: 'R', updatedAt: 'Yesterday', role: 'Member' },
  { id: 'ws3', name: 'Engineering', description: 'Specs, RFCs, runbooks', members: 8, files: 210, color: '#4a9068', initial: 'E', updatedAt: 'Aug 9', role: 'Admin' },
  { id: 'ws4', name: 'Marketing', description: 'Campaigns and brand assets', members: 4, files: 76, color: '#a06060', initial: 'M', updatedAt: 'Aug 7', role: 'Member' },
]

const RECENT_FILES: RecentFile[] = [
  { id: 'r1', name: 'Q3 Strategy Overview', workspace: 'Wintermute Studio', type: 'doc', modifiedAt: 'Today, 9:41 AM', modifiedBy: 'M', avatarColor: '#5b7fa6' },
  { id: 'r2', name: 'Design System v2 — Motion Tokens', workspace: 'Wintermute Studio', type: 'notion', modifiedAt: 'Today, 8:15 AM', modifiedBy: 'A', avatarColor: '#7a6fa6' },
  { id: 'r3', name: 'User Research Synthesis — June', workspace: 'Research Lab', type: 'pdf', modifiedAt: 'Yesterday, 3:00 PM', modifiedBy: 'J', avatarColor: '#4a9068' },
  { id: 'r4', name: 'API Versioning Spec v3', workspace: 'Engineering', type: 'doc', modifiedAt: 'Aug 9', modifiedBy: 'R', avatarColor: '#a06060' },
  { id: 'r5', name: 'Competitive Landscape 2026', workspace: 'Wintermute Studio', type: 'sheet', modifiedAt: 'Aug 8', modifiedBy: 'T', avatarColor: '#8a7050' },
  { id: 'r6', name: 'Onboarding Flow Redesign', workspace: 'Marketing', type: 'doc', modifiedAt: 'Aug 7', modifiedBy: 'M', avatarColor: '#5b7fa6' },
]

const DRAFTS: Draft[] = [
  { id: 'd1', name: 'Brand Voice Guidelines (draft)', workspace: 'Marketing', savedAt: 'Today, 11:02 AM' },
  { id: 'd2', name: 'Incident Report — Aug 11', workspace: 'Engineering', savedAt: 'Today, 7:45 AM' },
  { id: 'd3', name: 'Sprint Retrospective Notes', workspace: 'Wintermute Studio', savedAt: 'Yesterday' },
]

const FILE_TYPE_META: Record<RecentFile['type'], { bg: string; label: string; fg: string }> = {
  pdf:    { bg: '#e53e3e', label: 'PDF', fg: '#fff' },
  doc:    { bg: '#3182ce', label: 'DOC', fg: '#fff' },
  sheet:  { bg: '#38a169', label: 'XLS', fg: '#fff' },
  notion: { bg: '#ffffff', label: 'N',   fg: '#111' },
}

function FileChip({ type }: { type: RecentFile['type'] }) {
  const { bg, label, fg } = FILE_TYPE_META[type]
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

function ProfilePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="ml-auto w-80 h-full bg-[#161616] border-l border-[#222] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 pt-6 pb-5 border-b border-[#222]">
          <div className="flex items-start justify-between mb-4">
            <div className="w-14 h-14 rounded-full bg-[#5b7fa6] flex items-center justify-center text-white text-xl font-bold">M</div>
            <button onClick={onClose} className="text-[#555] hover:text-white transition-colors text-xl leading-none">×</button>
          </div>
          <h3 className="text-base font-bold text-white">Mara Jensen</h3>
          <p className="text-sm text-[#555] mt-0.5">mara@wintermute.io</p>
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-[#222] text-[#666] font-medium uppercase tracking-wider">Admin</span>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-3">
          {[
            { icon: '👤', label: 'Edit Profile' },
            { icon: '🔔', label: 'Notifications' },
            { icon: '🔑', label: 'Security & Password' },
            { icon: '🎨', label: 'Appearance' },
            { icon: '⌨️', label: 'Keyboard Shortcuts' },
          ].map(item => (
            <button key={item.label} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#888] hover:text-white hover:bg-[#1e1e1e] transition-colors text-sm text-left">
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className="border-t border-[#222] mt-3 pt-3">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#e53e3e] hover:bg-[#1e1e1e] transition-colors text-sm text-left">
              <span className="text-base">🚪</span>
              Sign Out
            </button>
          </div>
        </nav>

        {/* Plan */}
        <div className="px-5 py-4 border-t border-[#222]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white">Pro Plan</p>
              <p className="text-[10px] text-[#444] mt-0.5">Renews Sep 1, 2026</p>
            </div>
            <button className="text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#444] transition-colors">Manage</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState(true)
  const [darkMode] = useState(true)
  const [compact, setCompact] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="ml-auto w-80 h-full bg-[#161616] border-l border-[#222] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-6 pb-5 border-b border-[#222] flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Settings</h3>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <div>
            <p className="text-[10px] font-medium text-[#444] uppercase tracking-widest mb-3">Preferences</p>
            {[
              { label: 'Email Notifications', sub: 'Get notified about activity', val: notifications, set: setNotifications },
              { label: 'Dark Mode', sub: 'Always use dark theme', val: darkMode, set: () => {} },
              { label: 'Compact View', sub: 'Reduce spacing in lists', val: compact, set: setCompact },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-3 border-b border-[#1e1e1e]">
                <div>
                  <p className="text-sm text-white font-medium">{row.label}</p>
                  <p className="text-[11px] text-[#555] mt-0.5">{row.sub}</p>
                </div>
                <button
                  onClick={() => row.set(!row.val)}
                  className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${row.val ? 'bg-white' : 'bg-[#2a2a2a]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${row.val ? 'translate-x-5 bg-[#111]' : 'translate-x-0.5 bg-[#555]'}`} />
                </button>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-medium text-[#444] uppercase tracking-widest mb-3">Account</p>
            {['Change Password', 'Two-Factor Auth', 'Connected Apps', 'Export Data'].map(item => (
              <button key={item} className="w-full flex items-center justify-between py-3 border-b border-[#1e1e1e] text-sm text-[#888] hover:text-white transition-colors text-left">
                {item}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomeScreen({ onOpenWorkspace }: { onOpenWorkspace: (id: string) => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(WORKSPACES)
  const [showCreate, setShowCreate] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'recent' | 'drafts'>('recent')

  const handleCreate = (name: string, desc: string) => {
    const colors = ['#c8622a', '#5e6ad2', '#e6a817', '#2eb88a']
    const newWs: Workspace = {
      id: `ws${Date.now()}`,
      name,
      description: desc || 'No description',
      members: 1,
      files: 0,
      color: colors[workspaces.length % colors.length],
      initial: name[0].toUpperCase(),
      updatedAt: 'Just now',
      role: 'Admin',
    }
    setWorkspaces(prev => [newWs, ...prev])
  }

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col">

      {/* Top nav */}
      <header className="h-14 border-b border-[#1e1e1e] flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
            <span className="text-[#111] text-xs font-black">D</span>
          </div>
          <span className="text-white font-semibold text-sm">DocSpace</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSettings(true); setShowProfile(false) }}
            className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${showSettings ? 'bg-[#2a2a2a] text-white' : 'text-[#666] hover:text-white hover:bg-[#1e1e1e]'}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.5 2.5l1 1M10.5 10.5l1 1M11.5 2.5l-1 1M3.5 10.5l-1 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Settings
          </button>

          <button
            onClick={() => { setShowProfile(true); setShowSettings(false) }}
            className="w-8 h-8 rounded-full bg-[#5b7fa6] flex items-center justify-center text-white text-xs font-bold hover:ring-2 hover:ring-[#3a5a80] transition-all"
          >
            M
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">

        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Good morning, Mara</h1>
          <p className="text-[#555] text-sm mt-1">Tuesday, August 12, 2026</p>
        </div>

        {/* Workspaces section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Workspaces</h2>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white text-[#111] text-xs font-semibold hover:bg-[#eee] transition-colors"
            >
              <span className="text-base leading-none">+</span> New Workspace
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => onOpenWorkspace(ws.id)}
                className="bg-[#1a1a1a] border border-[#222] rounded-xl p-4 text-left hover:bg-[#1e1e1e] hover:border-[#2a2a2a] transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: ws.color }}>
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

            {/* Create new card */}
            <button
              onClick={() => setShowCreate(true)}
              className="bg-transparent border border-dashed border-[#252525] rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-[#333] hover:bg-[#161616] transition-colors min-h-[140px] group"
            >
              <div className="w-9 h-9 rounded-lg border border-dashed border-[#333] flex items-center justify-center text-[#444] group-hover:text-[#666] text-xl transition-colors">+</div>
              <span className="text-xs text-[#444] group-hover:text-[#666] transition-colors">Create workspace</span>
            </button>
          </div>
        </section>

        {/* Recent / Drafts tabs */}
        <section>
          <div className="flex items-center gap-1 mb-5">
            {(['recent', 'drafts'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`h-8 px-4 rounded-lg text-sm font-medium capitalize transition-colors ${
                  activeTab === tab ? 'bg-[#1e1e1e] text-white' : 'text-[#555] hover:text-[#999]'
                }`}
              >
                {tab === 'recent' ? 'Recent Files' : `Drafts`}
                {tab === 'drafts' && (
                  <span className="ml-2 text-[10px] bg-[#2a2a2a] text-[#666] px-1.5 py-0.5 rounded font-medium">{DRAFTS.length}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'recent' && (
            <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
              <div className="flex items-center px-5 py-3 bg-[#161616] border-b border-[#1e1e1e]">
                <span className="flex-1 text-xs font-medium text-[#444] uppercase tracking-wider">Name</span>
                <span className="w-44 text-xs font-medium text-[#444] uppercase tracking-wider hidden md:block">Workspace</span>
                <span className="w-32 text-xs font-medium text-[#444] uppercase tracking-wider text-right hidden sm:block">Modified by</span>
                <span className="w-36 text-xs font-medium text-[#444] uppercase tracking-wider text-right">Last modified</span>
              </div>
              {RECENT_FILES.map((file, i) => (
                <div key={file.id} className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#181818] transition-colors ${i < RECENT_FILES.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                  <FileChip type={file.type} />
                  <span className="flex-1 text-sm text-[#ccc] font-medium truncate">{file.name}</span>
                  <span className="w-44 text-xs text-[#555] hidden md:block truncate">{file.workspace}</span>
                  <div className="w-32 hidden sm:flex items-center justify-end">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ background: file.avatarColor }}>{file.modifiedBy}</div>
                  </div>
                  <span className="w-36 text-xs text-[#444] text-right shrink-0">{file.modifiedAt}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'drafts' && (
            <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
              <div className="flex items-center px-5 py-3 bg-[#161616] border-b border-[#1e1e1e]">
                <span className="flex-1 text-xs font-medium text-[#444] uppercase tracking-wider">Name</span>
                <span className="w-44 text-xs font-medium text-[#444] uppercase tracking-wider hidden md:block">Workspace</span>
                <span className="w-36 text-xs font-medium text-[#444] uppercase tracking-wider text-right">Last saved</span>
              </div>
              {DRAFTS.map((draft, i) => (
                <div key={draft.id} className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#181818] transition-colors group ${i < DRAFTS.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-[#252525] text-[#555] text-xs font-bold shrink-0">✎</span>
                  <span className="flex-1 text-sm text-[#ccc] font-medium truncate">{draft.name}</span>
                  <span className="w-44 text-xs text-[#555] hidden md:block truncate">{draft.workspace}</span>
                  <span className="w-36 text-xs text-[#444] text-right shrink-0">{draft.savedAt}</span>
                </div>
              ))}
              {DRAFTS.length === 0 && (
                <div className="flex items-center justify-center py-12 text-[#333] text-sm">No drafts yet</div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modals / panels */}
      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}
