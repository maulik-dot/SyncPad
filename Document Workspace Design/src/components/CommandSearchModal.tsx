import { useState, useEffect, useRef } from 'react'
import { documentService } from '../services/documentService'
import type { Document } from '../types/api'

interface CommandSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectDocument: (doc: Document) => void
}

export function CommandSearchModal({ isOpen, onClose, onSelectDocument }: CommandSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Debounced search query
  useEffect(() => {
    if (!isOpen) return
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const docs = await documentService.searchDocuments(query)
        setResults(docs)
        setSelectedIndex(0)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timeout)
  }, [query, isOpen])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        onSelectDocument(results[selectedIndex])
        onClose()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-0 outline-none text-slate-900 dark:text-white placeholder-slate-400 text-base"
            placeholder="Search documents, notes, annotations by title or content... (↑↓ to navigate, ↵ to open)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
            ESC
          </span>
        </div>

        {/* Search Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
              <p className="font-medium text-slate-600 dark:text-slate-400">Quick Document Spotlight</p>
              <p className="mt-1 text-xs">Type keywords to search across all your workspaces in sub-milliseconds.</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
              <p className="font-medium text-slate-600 dark:text-slate-400">No documents found</p>
              <p className="mt-1 text-xs">No documents matching "{query}" were found in accessible workspaces.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((doc, idx) => {
                const isSelected = idx === selectedIndex
                return (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/60'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-transparent'
                    }`}
                    onClick={() => {
                      onSelectDocument(doc)
                      onClose()
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                        {doc.fileType === 'PDF' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-medium text-sm truncate flex items-center gap-2">
                          <span>{doc.title || 'Untitled Document'}</span>
                          {doc.workspaceName && (
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {doc.workspaceName}
                            </span>
                          )}
                        </div>
                        {doc.content && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {doc.content.slice(0, 90)}...
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : ''}
                      </span>
                      {isSelected && (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          ↵
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-sans px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">↑↓</kbd> to navigate</span>
            <span><kbd className="font-sans px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">↵</kbd> to select</span>
            <span><kbd className="font-sans px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">esc</kbd> to close</span>
          </div>
          <span>SyncPad Full-Text Search</span>
        </div>
      </div>
    </div>
  )
}
