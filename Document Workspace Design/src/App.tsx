import { useState } from 'react'
import HomeScreen from './HomeScreen'
import WorkspaceScreen from './WorkspaceScreen'
import { AuthProvider } from './context/AuthContext'

type Screen = 
  | { name: 'home' } 
  | { name: 'workspace'; workspaceId?: string | number; documentId?: string | number }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

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
    </AuthProvider>
  )
}
