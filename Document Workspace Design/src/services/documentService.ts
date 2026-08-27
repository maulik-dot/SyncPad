import { apiFetch } from './api'
import type { 
  Document, 
  DocumentDetailResponse, 
  DocumentStatsResponse, 
  DocumentVersion, 
  DocumentComment,
  FileType,
  Role 
} from '../types/api'

export const documentService = {
  async getDocuments(params?: { type?: string; folderId?: number; workspace?: string }): Promise<Document[]> {
    const query = new URLSearchParams()
    if (params?.type) query.append('type', params.type)
    if (params?.folderId) query.append('folderId', params.folderId.toString())
    if (params?.workspace) query.append('workspace', params.workspace)
    const queryString = query.toString() ? `?${query.toString()}` : ''
    return apiFetch<Document[]>(`/documents${queryString}`)
  },

  async searchDocuments(query: string): Promise<Document[]> {
    if (!query || !query.trim()) return []
    return apiFetch<Document[]>(`/documents/search?q=${encodeURIComponent(query.trim())}`)
  },

  async getDocument(id: number | string): Promise<Document> {
    return apiFetch<Document>(`/documents/${id}`)
  },

  async getDocumentDetail(id: number | string): Promise<DocumentDetailResponse> {
    return apiFetch<DocumentDetailResponse>(`/documents/${id}/detail`)
  },

  async getDocumentStats(id: number | string): Promise<DocumentStatsResponse> {
    return apiFetch<DocumentStatsResponse>(`/documents/${id}/stats`)
  },

  async createDocument(data: {
    title: string
    content?: string
    fileType?: FileType
    folderId?: number
    workspaceName?: string
  }): Promise<Document> {
    return apiFetch<Document>('/documents', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        content: data.content || '',
        fileType: data.fileType || 'DOC',
        folderId: data.folderId,
        workspaceName: data.workspaceName
      })
    })
  },

  async updateDocument(id: number | string, data: { title?: string; content?: string }): Promise<Document> {
    return apiFetch<Document>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  async renameDocument(id: number | string, title: string): Promise<Document> {
    return apiFetch<Document>(`/documents/${id}/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    })
  },

  async deleteDocument(id: number | string): Promise<void> {
    return apiFetch<void>(`/documents/${id}`, {
      method: 'DELETE'
    })
  },

  async shareDocument(id: number | string, email: string, role: Role): Promise<any> {
    return apiFetch<any>(`/documents/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    })
  },

  async generateShareLink(id: number | string, role: Role, expiresInDays?: number): Promise<any> {
    return apiFetch<any>(`/documents/${id}/share-link`, {
      method: 'POST',
      body: JSON.stringify({ role, expiresInDays })
    })
  },

  async getVersions(id: number | string): Promise<DocumentVersion[]> {
    return apiFetch<DocumentVersion[]>(`/documents/${id}/versions`)
  },

  async restoreVersion(id: number | string, versionNumber: number): Promise<Document> {
    return apiFetch<Document>(`/documents/${id}/restore/${versionNumber}`, {
      method: 'POST'
    })
  },

  async getComments(id: number | string): Promise<DocumentComment[]> {
    return apiFetch<DocumentComment[]>(`/documents/${id}/comments`)
  },

  async addComment(id: number | string, text: string, anchorText?: string, parentId?: number): Promise<DocumentComment> {
    return apiFetch<DocumentComment>(`/documents/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        anchorText,
        parentId
      })
    })
  },

  async resolveComment(id: number | string, commentId: number | string): Promise<DocumentComment> {
    return apiFetch<DocumentComment>(`/documents/${id}/comments/${commentId}/resolve`, {
      method: 'PATCH'
    })
  },

  async deleteComment(id: number | string, commentId: number | string): Promise<void> {
    return apiFetch<void>(`/documents/${id}/comments/${commentId}`, {
      method: 'DELETE'
    })
  }
}
