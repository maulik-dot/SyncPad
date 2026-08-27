export type Role = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'RESTRICTED'

export type FileType = 'DOC' | 'PDF' | 'CANVAS' | 'WHITEBOARD' | 'MARKDOWN'

export interface User {
  id: number
  email: string
  name: string
  profilePictureUrl?: string
}

export interface AuthResponse {
  token: string
  type: string
  email: string
  name: string
  userId: number
  profilePictureUrl?: string
}

export interface WorkspacePermission {
  id: number
  user: User
  role: Role
  assignedAt: string
}

export interface Workspace {
  id: number
  name: string
  description?: string
  color?: string
  initial?: string
  owner: User
  role?: Role
  currentUserRole?: Role
  permissions?: WorkspacePermission[]
  createdAt: string
  updatedAt?: string
}

export interface FolderPermission {
  id: number
  user: User
  role: Role
}

export interface Folder {
  id: number
  name: string
  workspaceName?: string
  parentFolderId?: number
  owner: User
  currentUserRole?: Role
  createdAt: string
  updatedAt?: string
}

export interface DocumentPermission {
  id: number
  user: User
  role: Role
}

export interface DocumentVersion {
  id: number
  versionNumber: number
  title: string
  content: string
  savedAt: string
  savedBy: string
}

export interface DocumentComment {
  id: number
  documentId: number
  authorId: number
  authorName: string
  authorEmail: string
  text: string
  anchorText?: string
  resolved: boolean
  parentId?: number
  replies: DocumentComment[]
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: number
  title: string
  content: string
  fileType: FileType
  folderId?: number
  folder?: Folder
  workspaceName?: string
  owner: User
  currentUserRole?: Role
  permissions?: DocumentPermission[]
  version?: number
  pdfAttachmentUrl?: string
  createdAt: string
  updatedAt: string
}

export interface DocumentDetailResponse {
  id: number
  title: string
  content: string
  fileType: FileType
  folderId?: number
  folderName?: string
  ownerId?: number
  ownerName?: string
  ownerEmail?: string
  currentUserRole: Role
  versionNumber?: number
  trashed?: boolean
  stats?: DocumentStatsResponse
  createdAt: string
  updatedAt: string
  permissions?: DocumentPermission[]
  versions?: DocumentVersion[]
  comments?: DocumentComment[]
}

export interface DocumentStatsResponse {
  id?: number
  title?: string
  wordCount: number
  characterCount: number
  paragraphCount?: number
  headingCount?: number
  readingTimeMinutes?: number
  versionCount: number
  collaboratorCount: number
  lastEditedBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface DocumentEditMessage {
  documentId: number
  title?: string
  content?: string
  senderEmail?: string
  senderName?: string
  type: 'EDIT' | 'PRESENCE' | 'CURSOR' | 'SAVED' | 'COMMENT'
  cursorPosition?: number
  selectionStart?: number
  selectionEnd?: number
  cursorX?: number
  cursorY?: number
  cursorHeight?: number
  timestamp?: number
}
