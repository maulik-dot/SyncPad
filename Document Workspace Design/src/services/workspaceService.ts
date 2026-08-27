import { apiFetch } from './api'
import type { Workspace, Role, Document } from '../types/api'

export const workspaceService = {
  async getWorkspaces(): Promise<Workspace[]> {
    return apiFetch<Workspace[]>('/workspaces')
  },

  async createWorkspace(name: string, description?: string, color?: string): Promise<Workspace> {
    return apiFetch<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description, color })
    })
  },

  async updateWorkspace(id: number | string, data: { name?: string; description?: string; color?: string }): Promise<Workspace> {
    return apiFetch<Workspace>(`/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  async deleteWorkspace(id: number | string): Promise<void> {
    return apiFetch<void>(`/workspaces/${id}`, {
      method: 'DELETE'
    })
  },

  async shareWorkspace(id: number | string, email: string, role: Role): Promise<any> {
    return apiFetch<any>(`/workspaces/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    })
  },

  async inviteMember(id: number | string, email: string, role: Role): Promise<any> {
    return apiFetch<any>(`/workspaces/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    })
  },

  async getMembers(id: number | string): Promise<any[]> {
    return apiFetch<any[]>(`/workspaces/${id}/members`)
  },

  async updateMemberRole(id: number | string, userId: number | string, role: Role): Promise<any> {
    return apiFetch<any>(`/workspaces/${id}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    })
  },

  async removeMember(id: number | string, userId: number | string): Promise<void> {
    return apiFetch<void>(`/workspaces/${id}/members/${userId}`, {
      method: 'DELETE'
    })
  },

  async getRecentFiles(id: number | string): Promise<Document[]> {
    return apiFetch<Document[]>(`/workspaces/${id}/recent-files`)
  }
}
