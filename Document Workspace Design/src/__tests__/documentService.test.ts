import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documentService } from '../services/documentService'
import { setAuthToken } from '../services/api'

describe('DocumentService Frontend Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setAuthToken('valid-mock-jwt')
  })

  it('should fetch documents and return formatted DTOs', async () => {
    const mockDocs = [
      { id: 1, title: 'Test Document', content: 'Hello World', fileType: 'DOCUMENT', version: 1 },
      { id: 2, title: 'Whiteboard', content: '{}', fileType: 'CANVAS', version: 1 }
    ]

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDocs,
    } as Response)

    const docs = await documentService.getAllDocuments()
    expect(docs).toHaveLength(2)
    expect(docs[0].title).toBe('Test Document')
    expect(docs[1].fileType).toBe('CANVAS')
  })

  it('should rename document and return updated DTO', async () => {
    const updatedDoc = { id: 1, title: 'New Name', content: 'Hello World', fileType: 'DOCUMENT', version: 2 }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => updatedDoc,
    } as Response)

    const doc = await documentService.renameDocument(1, 'New Name')
    expect(doc.title).toBe('New Name')
    expect(doc.version).toBe(2)
  })
})
