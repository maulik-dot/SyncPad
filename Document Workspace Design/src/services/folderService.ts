import { apiFetch } from './api'
import type { Folder, Role } from '../types/api'

export const folderService = {
  async getFolders(workspace?: string): Promise<Folder[]> {
    const query = workspace ? `?workspace=${encodeURIComponent(workspace)}` : ''
    return apiFetch<Folder[]>(`/folders${query}`)
  },

  async getFolder(id: number | string): Promise<Folder> {
    return apiFetch<Folder>(`/folders/${id}`)
  },

  async getSubfolders(id: number | string): Promise<Folder[]> {
    return apiFetch<Folder[]>(`/folders/${id}/subfolders`)
  },

  async createFolder(data: {
    name: string
    workspaceName?: string
    parentFolderId?: number
  }): Promise<Folder> {
    return apiFetch<Folder>('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateFolder(id: number | string, name: string): Promise<Folder> {
    return apiFetch<Folder>(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
  },

  async deleteFolder(id: number | string): Promise<void> {
    return apiFetch<void>(`/folders/${id}`, {
      method: 'DELETE',
    })
  },

  async shareFolder(id: number | string, email: string, role: Role): Promise<any> {
    return apiFetch<any>(`/folders/${id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
  },

  async getPermissions(id: number | string): Promise<any[]> {
    return apiFetch<any[]>(`/folders/${id}/permissions`)
  }
}
