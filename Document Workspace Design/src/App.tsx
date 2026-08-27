import { useState, useEffect } from 'react'
import HomeScreen from './HomeScreen'
import WorkspaceScreen from './WorkspaceScreen'
import { AuthProvider } from './context/AuthContext'
import { CommandSearchModal } from './components/CommandSearchModal'
import type { Document } from './types/api'

type Screen = 
  | { name: 'home' } 
  | { name: 'workspace'; workspaceId?: string | number; documentId?: string | number }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelectDocument = (doc: Document) => {
    setScreen({
      name: 'workspace',
      workspaceId: doc.workspaceName,
      documentId: doc.id
    })
  }

  return (
    <AuthProvider>
      {screen.name === 'workspace' ? (
        <WorkspaceScreen
          workspaceId={screen.workspaceId}
          documentId={screen.documentId}
          onHome={() => setScreen({ name: 'home' })}
        />
      ) : (
        <HomeScreen
          onOpenWorkspace={(wsId) => setScreen({ name: 'workspace', workspaceId: wsId })}
          onOpenDocument={(docId, wsId) => setScreen({ name: 'workspace', documentId: docId, workspaceId: wsId })}
        />
      )}

      <CommandSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectDocument={handleSelectDocument}
      />
    </AuthProvider>
  )
}
