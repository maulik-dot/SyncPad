import { useState, useMemo } from 'react'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
  oldLineNumber?: number
  newLineNumber?: number
}

interface VersionDiffViewerProps {
  oldTitle: string
  oldContent: string
  newTitle: string
  newContent: string
  oldLabel: string
  newLabel: string
  onRestore: () => void
  onClose: () => void
}

/**
 * Computes line-by-line difference using Longest Common Subsequence (LCS).
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split('\n') : []
  const newLines = newText ? newText.split('\n') : []

  const n = oldLines.length
  const m = newLines.length

  // LCS DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to construct diff lines
  const result: DiffLine[] = []
  let i = n
  let j = m

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'unchanged',
        text: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        text: newLines[j - 1],
        newLineNumber: j,
      })
      j--
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({
        type: 'removed',
        text: oldLines[i - 1],
        oldLineNumber: i,
      })
      i--
    }
  }

  return result
}

export function VersionDiffViewer({
  oldTitle,
  oldContent,
  newTitle,
  newContent,
  oldLabel,
  newLabel,
  onRestore,
  onClose,
}: VersionDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')

  const diffLines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    diffLines.forEach((l) => {
      if (l.type === 'added') added++
      if (l.type === 'removed') removed++
    })
    return { added, removed }
  }, [diffLines])

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-[#262626] rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-[#181818] shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-white">Visual Version Diff</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
              +{stats.added} / -{stats.removed} lines
            </span>
          </div>
          <p className="text-xs text-[#888] mt-1">
            Comparing <span className="text-amber-400 font-medium">{oldLabel}</span> with{' '}
            <span className="text-green-400 font-medium">{newLabel}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-[#222] p-0.5 border border-[#333]">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === 'unified' ? 'bg-[#333] text-white shadow-sm' : 'text-[#888] hover:text-white'
              }`}
            >
              Unified
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === 'split' ? 'bg-[#333] text-white shadow-sm' : 'text-[#888] hover:text-white'
              }`}
            >
              Split
            </button>
          </div>

          <button
            onClick={onRestore}
            className="h-8 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>↺</span> Restore This Version
          </button>

          <button
            onClick={onClose}
            className="h-8 px-3 border border-[#333] hover:border-[#555] text-xs text-[#888] hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            Close Diff
          </button>
        </div>
      </div>

      {/* Title Diff (if titles differ) */}
      {oldTitle !== newTitle && (
        <div className="px-6 py-2 bg-[#1a1a1a] border-b border-[#262626] flex items-center gap-4 text-xs font-mono">
          <span className="text-[#888] uppercase tracking-wider">Title Change:</span>
          <span className="line-through text-red-400 bg-red-950/30 px-2 py-0.5 rounded">{oldTitle}</span>
          <span className="text-green-400 bg-green-950/30 px-2 py-0.5 rounded">{newTitle}</span>
        </div>
      )}

      {/* Diff Content Body */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-relaxed p-4 bg-[#0d0d0d]">
        {viewMode === 'unified' ? (
          <div className="space-y-0.5">
            {diffLines.map((line, idx) => {
              const isAdded = line.type === 'added'
              const isRemoved = line.type === 'removed'

              return (
                <div
                  key={idx}
                  className={`flex items-start px-3 py-0.5 rounded ${
                    isAdded
                      ? 'bg-green-950/30 text-green-300 border-l-2 border-green-500'
                      : isRemoved
                      ? 'bg-red-950/30 text-red-300 border-l-2 border-red-500 line-through opacity-85'
                      : 'text-[#888] hover:bg-[#161616]'
                  }`}
                >
                  <span className="w-10 text-right pr-3 select-none opacity-40 text-[10px]">
                    {line.oldLineNumber || ''}
                  </span>
                  <span className="w-10 text-right pr-4 select-none opacity-40 text-[10px]">
                    {line.newLineNumber || ''}
                  </span>
                  <span className="w-5 select-none font-bold">
                    {isAdded ? '+' : isRemoved ? '-' : ' '}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all">{line.text || ' '}</span>
                </div>
              )
            })}
          </div>
        ) : (
          /* Split View */
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Old Version */}
            <div className="border border-[#222] rounded-xl p-3 bg-[#111]">
              <div className="text-[11px] font-semibold text-amber-400 mb-2 pb-1 border-b border-[#222]">
                {oldLabel}
              </div>
              <div className="space-y-0.5">
                {diffLines
                  .filter((l) => l.type !== 'added')
                  .map((line, idx) => (
                    <div
                      key={idx}
                      className={`px-2 py-0.5 rounded ${
                        line.type === 'removed'
                          ? 'bg-red-950/30 text-red-300 border-l-2 border-red-500'
                          : 'text-[#888]'
                      }`}
                    >
                      <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Right: New Version */}
            <div className="border border-[#222] rounded-xl p-3 bg-[#111]">
              <div className="text-[11px] font-semibold text-green-400 mb-2 pb-1 border-b border-[#222]">
                {newLabel}
              </div>
              <div className="space-y-0.5">
                {diffLines
                  .filter((l) => l.type !== 'removed')
                  .map((line, idx) => (
                    <div
                      key={idx}
                      className={`px-2 py-0.5 rounded ${
                        line.type === 'added'
                          ? 'bg-green-950/30 text-green-300 border-l-2 border-green-500'
                          : 'text-[#888]'
                      }`}
                    >
                      <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
