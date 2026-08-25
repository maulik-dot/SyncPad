import { useState } from 'react'
import HomeScreen from './HomeScreen'
import WorkspaceScreen from './WorkspaceScreen'

type Screen = { name: 'home' } | { name: 'workspace'; id: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  if (screen.name === 'workspace') {
    return (
      <WorkspaceScreen
        onHome={() => setScreen({ name: 'home' })}
      />
    )
  }

  return (
    <HomeScreen
      onOpenWorkspace={(id) => setScreen({ name: 'workspace', id })}
    />
  )
}
