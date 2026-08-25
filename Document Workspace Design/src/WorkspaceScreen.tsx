import { useState } from 'react'

type TreeNode = {
  id: string
  name: string
  count: number
  children?: TreeNode[]
}

type FolderCard = {
  id: string
  name: string
  fileCount: number
  sources: string[]
  docPreviews: string[]
}

type FileRow = {
  id: string
  name: string
  type: 'pdf' | 'doc' | 'sheet' | 'notion'
  added: string
  addedBy: string
  avatarColor: string
}

const TREE: TreeNode[] = [
  {
    id: 'gk', name: 'General Knowledge', count: 10,
    children: [
      {
        id: 'ob', name: 'Onboarding', count: 3,
        children: [
          { id: 'sf1', name: 'Subfolder 1', count: 5 },
          { id: 'sf2', name: 'Subfolder 2', count: 10 },
        ]
      },
      { id: 'int', name: 'Integrations', count: 7 },
      { id: 'docs', name: 'Documents', count: 14 },
    ]
  },
  { id: 'od', name: 'Onboarding Design', count: 22 },
  { id: 'ti', name: 'Team Interviews', count: 8 },
  { id: 'rsch', name: 'Research', count: 17 },
  { id: 'eng', name: 'Engineering', count: 31 },
]

const FOLDER_CARDS: FolderCard[] = [
  { id: 'ob', name: 'Onboarding', fileCount: 15, sources: ['gdrive', 'notion'], docPreviews: ['pdf', 'doc', 'doc'] },
  { id: 'int2', name: 'Integrations', fileCount: 5, sources: ['notion', 'linear', 'gdrive'], docPreviews: ['doc', 'sheet'] },
  { id: 'docs2', name: 'Documents', fileCount: 14, sources: ['gdrive'], docPreviews: ['pdf', 'pdf', 'doc'] },
  { id: 'od2', name: 'Onboarding Design', fileCount: 22, sources: ['notion', 'gdrive'], docPreviews: ['doc', 'sheet', 'pdf'] },
]

const FILES: FileRow[] = [
  { id: 'f1', name: 'Onboarding Guidelines 2026', type: 'pdf', added: 'Aug 11, 2026', addedBy: 'M', avatarColor: '#5b7fa6' },
  { id: 'f2', name: 'Integration Setup Checklist', type: 'notion', added: 'Aug 9, 2026', addedBy: 'J', avatarColor: '#7a6fa6' },
  { id: 'f3', name: 'Team Org Chart — Q3', type: 'sheet', added: 'Aug 7, 2026', addedBy: 'A', avatarColor: '#4a9068' },
  { id: 'f4', name: 'Product Roadmap Draft', type: 'doc', added: 'Aug 5, 2026', addedBy: 'R', avatarColor: '#a06060' },
  { id: 'f5', name: 'Design System Overview', type: 'pdf', added: 'Aug 3, 2026', addedBy: 'T', avatarColor: '#8a7050' },
  { id: 'f6', name: 'API Reference v3', type: 'doc', added: 'Jul 30, 2026', addedBy: 'M', avatarColor: '#5b7fa6' },
]

function FolderIcon({ open = false, className = '' }: { open?: boolean; className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      {open
        ? <path d="M1 4.5C1 3.67 1.67 3 2.5 3H6l1.5 1.5H13.5C14.33 4.5 15 5.17 15 6v6.5C15 13.33 14.33 14 13.5 14h-11C1.67 14 1 13.33 1 12.5V4.5Z" fill="currentColor" opacity=".9"/>
        : <path d="M1 4.5C1 3.67 1.67 3 2.5 3H6l1.5 1.5H13.5C14.33 4.5 15 5.17 15 6v6.5C15 13.33 14.33 14 13.5 14h-11C1.67 14 1 13.33 1 12.5V4.5Z" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      }
    </svg>
  )
}

function FileTypeIcon({ type }: { type: FileRow['type'] }) {
  const map: Record<FileRow['type'], { bg: string; label: string }> = {
    pdf:    { bg: '#e53e3e', label: 'PDF' },
    doc:    { bg: '#3182ce', label: 'DOC' },
    sheet:  { bg: '#38a169', label: 'XLS' },
    notion: { bg: '#ffffff', label: 'N' },
  }
  const { bg, label } = map[type]
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded text-[9px] font-bold shrink-0"
      style={{ background: bg, color: type === 'notion' ? '#111' : '#fff' }}>
      {label}
    </span>
  )
}

function SourceBadge({ src }: { src: string }) {
  if (src === 'gdrive') return (
    <span className="w-6 h-6 rounded-full bg-[#2a2a2a] border border-[#333] inline-flex items-center justify-center text-[10px]" title="Google Drive">🔵</span>
  )
  if (src === 'notion') return (
    <span className="w-6 h-6 rounded-full bg-white border border-[#333] inline-flex items-center justify-center text-[10px] font-bold text-black" title="Notion">N</span>
  )
  if (src === 'linear') return (
    <span className="w-6 h-6 rounded-full bg-[#5e6ad2] border border-[#333] inline-flex items-center justify-center text-[10px] text-white font-bold" title="Linear">L</span>
  )
  return null
}

function TreeItem({ node, depth, activeId, onSelect, expanded, onToggle }: {
  node: TreeNode; depth: number; activeId: string
  onSelect: (id: string) => void; expanded: Set<string>; onToggle: (id: string) => void
}) {
  const isOpen = expanded.has(node.id)
  const isActive = activeId === node.id
  const hasChildren = (node.children?.length ?? 0) > 0

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer select-none group transition-colors ${isActive ? 'bg-[#2a2a2a]' : 'hover:bg-[#1e1e1e]'}`}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onClick={() => { onSelect(node.id); if (hasChildren) onToggle(node.id) }}
      >
        <FolderIcon open={isOpen && hasChildren} className={isActive ? 'text-white' : 'text-[#666]'} />
        <span className={`flex-1 text-sm truncate ${isActive ? 'text-white font-medium' : 'text-[#999] group-hover:text-white'}`}>{node.name}</span>
        <span className="text-[11px] text-[#555] bg-[#222] px-1.5 py-0.5 rounded font-medium shrink-0">{node.count}</span>
      </div>
      {isOpen && node.children && (
        <div className="relative">
          <div className="absolute top-0 bottom-0 border-l border-[#2a2a2a]" style={{ left: `${8 + depth * 20 + 7}px` }} />
          {node.children.map(child => (
            <TreeItem key={child.id} node={child} depth={depth + 1} activeId={activeId} onSelect={onSelect} expanded={expanded} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderCardItem({ card }: { card: FolderCard }) {
  return (
    <div className="bg-[#1e1e1e] rounded-xl overflow-hidden cursor-pointer hover:bg-[#252525] transition-colors group border border-[#2a2a2a] hover:border-[#333]">
      <div className="h-36 bg-[#262626] relative flex items-end px-4 pb-3 overflow-hidden">
        <div className="flex items-end gap-1.5 absolute bottom-4 left-4">
          {card.docPreviews.map((type, i) => (
            <div key={i} className="rounded-md bg-[#333] border border-[#3a3a3a] flex items-center justify-center"
              style={{ width: i === 0 ? 44 : 36, height: i === 0 ? 56 : 46, transform: `rotate(${(i - 1) * 4}deg)`, zIndex: card.docPreviews.length - i, position: 'relative' }}>
              {type === 'pdf' && <span className="text-[8px] font-bold text-[#e53e3e]">PDF</span>}
              {type === 'doc' && <span className="text-[8px] font-bold text-[#3182ce]">DOC</span>}
              {type === 'sheet' && <span className="text-[8px] font-bold text-[#38a169]">XLS</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#2a2a2a]">
        {card.sources.map((src, i) => <SourceBadge key={i} src={src} />)}
      </div>
      <div className="px-4 py-3">
        <p className="text-[15px] font-semibold text-white">{card.name}</p>
        <p className="text-xs text-[#555] mt-0.5">{card.fileCount} Files</p>
      </div>
    </div>
  )
}

export default function WorkspaceScreen({ onHome }: { onHome: () => void }) {
  const [activeId, setActiveId] = useState('gk')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['gk', 'ob']))
  const [search, setSearch] = useState('')

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const filteredFiles = FILES.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex h-screen overflow-hidden bg-[#111111]">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 flex flex-col bg-[#111111] border-r border-[#1e1e1e] overflow-hidden">
        <div className="px-4 pt-4 pb-4 border-b border-[#1e1e1e]">
          {/* Back to Home */}
          <button
            onClick={onHome}
            className="flex items-center gap-1.5 text-[#555] hover:text-white transition-colors mb-3 group"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium">Home</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#2a2a2a] border border-[#333] flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">W</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">Wintermute Studio</p>
              <p className="text-[10px] text-[#444] truncate">5 members</p>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#444] shrink-0">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#444]" width="12" height="12" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-7 pr-3 text-xs bg-[#1a1a1a] border border-[#252525] rounded-lg text-white placeholder:text-[#444] outline-none focus:border-[#333] transition-colors" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-4">
          {TREE.map(node => (
            <TreeItem key={node.id} node={node} depth={0} activeId={activeId} onSelect={setActiveId} expanded={expanded} onToggle={toggleExpand} />
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-[#1e1e1e] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#5b7fa6] flex items-center justify-center text-white text-xs font-semibold shrink-0">M</div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-white truncate">Mara Jensen</p>
            <p className="text-[10px] text-[#444] truncate">Admin</p>
          </div>
          <button className="text-[#444] hover:text-[#888] transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="2.5" r="1" fill="currentColor"/>
              <circle cx="7" cy="7" r="1" fill="currentColor"/>
              <circle cx="7" cy="11.5" r="1" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#111111]">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">General Knowledge</h1>
              <p className="text-sm text-[#555] mt-0.5">10 items · Last updated Aug 11</p>
            </div>
            <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-[#111] text-sm font-semibold hover:bg-[#eee] transition-colors">
              <span className="text-lg leading-none">+</span> Add files
            </button>
          </div>

          <section className="mb-10">
            <h2 className="text-lg font-bold text-white mb-4">Folders</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {FOLDER_CARDS.map(card => <FolderCardItem key={card.id} card={card} />)}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Files</h2>
              <div className="flex gap-2">
                <button className="h-8 px-3 rounded-lg border border-[#252525] bg-[#1a1a1a] text-[#666] text-xs hover:text-white hover:border-[#333] transition-colors">Sort</button>
                <button className="h-8 px-3 rounded-lg border border-[#252525] bg-[#1a1a1a] text-[#666] text-xs hover:text-white hover:border-[#333] transition-colors">Filter</button>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-[#1e1e1e]">
              <div className="flex items-center px-5 py-3 bg-[#161616] border-b border-[#1e1e1e]">
                <span className="flex-1 text-xs font-medium text-[#444] uppercase tracking-wider">Name</span>
                <span className="w-36 text-xs font-medium text-[#444] uppercase tracking-wider text-right hidden sm:block">Added by</span>
                <span className="w-36 text-xs font-medium text-[#444] uppercase tracking-wider text-right">Added</span>
              </div>
              {filteredFiles.map((file, i) => (
                <div key={file.id} className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#181818] transition-colors ${i < filteredFiles.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                  <FileTypeIcon type={file.type} />
                  <span className="flex-1 text-sm text-[#ccc] font-medium truncate hover:text-white transition-colors">{file.name}</span>
                  <div className="w-36 hidden sm:flex items-center justify-end gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0" style={{ background: file.avatarColor }}>{file.addedBy}</div>
                  </div>
                  <span className="w-36 text-xs text-[#444] text-right shrink-0">{file.added}</span>
                </div>
              ))}
              {filteredFiles.length === 0 && (
                <div className="flex items-center justify-center py-12 text-[#333] text-sm">No files match your search</div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
