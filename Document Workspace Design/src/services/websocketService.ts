import { Client, IMessage, StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getAuthToken } from './api'
import type { DocumentEditMessage } from '../types/api'

export interface PresenceMessage {
  type: 'CURSOR' | 'JOIN' | 'LEAVE'
  userEmail: string
  userName: string
  color: string
  cursor?: { line: number; ch: number }
  timestamp: number
}

class DocumentWebSocketService {
  private client: Client | null = null
  private subscription: StompSubscription | null = null
  private annotationSubscription: StompSubscription | null = null
  private presenceSubscription: StompSubscription | null = null
  private isConnected = false
  private documentId: number | string | null = null

  connect(
    documentId: number | string,
    onMessageReceived: (message: DocumentEditMessage) => void,
    onAnnotationReceived?: (annotation: any) => void,
    onPresenceReceived?: (presence: PresenceMessage) => void
  ) {
    this.disconnect()
    this.documentId = documentId
    const token = getAuthToken()
    const wsUrl = (import.meta.env.VITE_API_URL ?? '') + '/ws'

    this.client = new Client({
      webSocketFactory: () => new SockJS(wsUrl) as WebSocket,
      connectHeaders: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {},
    })

    this.client.onConnect = () => {
      this.isConnected = true

      // 1. Subscribe to document delta edits
      this.subscription = this.client!.subscribe(`/topic/documents.${documentId}`, (message: IMessage) => {
        try {
          const payload: DocumentEditMessage = JSON.parse(message.body)
          onMessageReceived(payload)
        } catch (e) {
          console.error('Failed to parse WebSocket message', e)
        }
      })

      // 2. Subscribe to PDF annotations
      if (onAnnotationReceived) {
        this.annotationSubscription = this.client!.subscribe(
          `/topic/documents.${documentId}.pdf-annotations`,
          (message: IMessage) => {
            try {
              const payload = JSON.parse(message.body)
              onAnnotationReceived(payload)
            } catch (e) {
              console.error('Failed to parse PDF annotation message', e)
            }
          }
        )
      }

      // 3. Subscribe to real-time collaborator presence & cursors
      if (onPresenceReceived) {
        this.presenceSubscription = this.client!.subscribe(
          `/topic/documents.${documentId}.presence`,
          (message: IMessage) => {
            try {
              const payload: PresenceMessage = JSON.parse(message.body)
              onPresenceReceived(payload)
            } catch (e) {
              console.error('Failed to parse Presence message', e)
            }
          }
        )
      }
    }

    this.client.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message'])
    }

    this.client.activate()
  }

  sendEdit(title: string, content: string, senderName?: string) {
    if (!this.client || !this.isConnected || !this.documentId) return

    const payload: Partial<DocumentEditMessage> = {
      documentId: this.documentId,
      title,
      content,
      senderName,
      type: 'EDIT',
      timestamp: Date.now(),
    }

    this.client.publish({
      destination: `/app/documents/${this.documentId}/edit`,
      body: JSON.stringify(payload),
    })
  }

  sendSave(title: string, content: string, senderName?: string) {
    if (!this.client || !this.isConnected || !this.documentId) return

    const payload: Partial<DocumentEditMessage> = {
      documentId: this.documentId,
      title,
      content,
      senderName,
      type: 'SAVED',
      timestamp: Date.now(),
    }

    this.client.publish({
      destination: `/app/documents/${this.documentId}/save`,
      body: JSON.stringify(payload),
    })
  }

  sendCursor(cursor: { line: number; ch: number }, userName?: string, color?: string) {
    if (!this.client || !this.isConnected || !this.documentId) return

    const payload = {
      type: 'CURSOR',
      userName: userName || 'Collaborator',
      color: color || '#3B82F6',
      cursor,
    }

    this.client.publish({
      destination: `/app/documents/${this.documentId}/presence`,
      body: JSON.stringify(payload),
    })
  }

  sendJoin(userName?: string, color?: string) {
    if (!this.client || !this.isConnected || !this.documentId) return

    const payload = {
      type: 'JOIN',
      userName: userName || 'Collaborator',
      color: color || '#3B82F6',
    }

    this.client.publish({
      destination: `/app/documents/${this.documentId}/presence`,
      body: JSON.stringify(payload),
    })
  }

  sendPdfAnnotation(annotationData: any) {
    if (!this.client || !this.isConnected || !this.documentId) return

    this.client.publish({
      destination: `/app/documents/${this.documentId}/pdf-annotation`,
      body: JSON.stringify(annotationData),
    })
  }

  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = null
    }
    if (this.annotationSubscription) {
      this.annotationSubscription.unsubscribe()
      this.annotationSubscription = null
    }
    if (this.presenceSubscription) {
      this.presenceSubscription.unsubscribe()
      this.presenceSubscription = null
    }
    if (this.client) {
      this.client.deactivate()
      this.client = null
    }
    this.isConnected = false
    this.documentId = null
  }
}

export const wsService = new DocumentWebSocketService()
