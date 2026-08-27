import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getAuthToken } from './api'
import type { DocumentEditMessage } from '../types/api'

export class DocumentWebSocketService {
  private client: Client | null = null
  private subscription: StompSubscription | null = null
  private annotationSubscription: StompSubscription | null = null
  private documentId: number | null = null
  private isConnected = false

  connect(
    documentId: number,
    onMessageReceived: (message: DocumentEditMessage) => void,
    onAnnotationReceived?: (annotation: any) => void
  ) {
    this.documentId = documentId
    const token = getAuthToken()
    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8082') + '/ws'

    this.client = new Client({
      webSocketFactory: () => new SockJS(wsUrl) as WebSocket,
      connectHeaders: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
      debug: () => {},
      reconnectDelay: 4000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    })

    this.client.onConnect = () => {
      this.isConnected = true

      this.subscription = this.client!.subscribe(`/topic/documents/${documentId}`, (message: IMessage) => {
        try {
          const payload: DocumentEditMessage = JSON.parse(message.body)
          onMessageReceived(payload)
        } catch (e) {
          console.error('Failed to parse WebSocket message', e)
        }
      })

      if (onAnnotationReceived) {
        this.annotationSubscription = this.client!.subscribe(
          `/topic/documents/${documentId}/pdf-annotations`,
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

      this.sendPresence()
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

  sendPresence(senderName?: string) {
    if (!this.client || !this.isConnected || !this.documentId) return

    const payload: Partial<DocumentEditMessage> = {
      documentId: this.documentId,
      senderName,
      type: 'PRESENCE',
      timestamp: Date.now(),
    }

    this.client.publish({
      destination: `/app/documents/${this.documentId}/edit`,
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
    if (this.client) {
      this.client.deactivate()
      this.client = null
    }
    this.isConnected = false
    this.documentId = null
  }
}

export const wsService = new DocumentWebSocketService()
