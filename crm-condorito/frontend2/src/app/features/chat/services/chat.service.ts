import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { CacheService } from '../../../core/services/cache.service';
import { APP_CONFIG } from '../../../core/config/app.config';
import { 
  Conversation, 
  Message, 
  SendMessageRequest, 
  SendMessageResponse,
  SendImageRequest,
  SendDocumentRequest,
  ConversationsResponse,
  MessagesResponse,
  SearchMessagesResponse,
  MarkAsReadResponse,
  ApiResponse 
} from '../../../core/models/api.models';

/**
 * Servicio del Chat
 * Maneja conversaciones, mensajes y envío de mensajes
 */
@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiService = inject(ApiService);
  private cacheService = inject(CacheService);

  /**
   * Obtener lista de conversaciones (con caché)
   */
  getConversations(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    archived?: boolean;
  }, useCache: boolean = true): Observable<ConversationsResponse> {
    if (!useCache) {
      return this.apiService.get<ConversationsResponse>(
        APP_CONFIG.api.endpoints.messages.conversations,
        { params }
      );
    }

    const cacheKey = CacheService.conversationsKey(params);
    return this.cacheService.get(
      cacheKey,
      () => this.apiService.get<ConversationsResponse>(
        APP_CONFIG.api.endpoints.messages.conversations,
        { params }
      ),
      { ttl: 30000 } // 30 segundos para conversaciones
    );
  }

  /**
   * Obtener mensajes de una conversación (con caché)
   */
  getMessages(conversationId: number, params?: {
    limit?: number;
    offset?: number;
    messageType?: string;
    senderType?: string;
    orderBy?: string;
    orderDirection?: string;
  }, useCache: boolean = true): Observable<MessagesResponse> {
    const endpoint = APP_CONFIG.api.endpoints.messages.conversation.replace('{id}', conversationId.toString());
    
    if (!useCache) {
      return this.apiService.get<MessagesResponse>(endpoint, { params });
    }

    const cacheKey = CacheService.messagesKey(conversationId, params);
    return this.cacheService.get(
      cacheKey,
      () => this.apiService.get<MessagesResponse>(endpoint, { params }),
      { ttl: 15000 } // 15 segundos para mensajes
    );
  }

  /**
   * Enviar mensaje (invalida caché)
   */
  sendMessage(messageData: SendMessageRequest): Observable<SendMessageResponse> {
    return this.apiService.post<SendMessageResponse>(
      APP_CONFIG.api.endpoints.whatsapp.sendMessage,
      messageData
    ).pipe(
      tap(response => {
        if (response.success) {
          // Invalidar caché de conversaciones y mensajes
          this.cacheService.invalidatePattern('conversations_');
          this.cacheService.invalidatePattern('messages_');
        }
      })
    );
  }

  /**
   * Marcar conversación como leída
   */
  markConversationAsRead(conversationId: number): Observable<MarkAsReadResponse> {
    const endpoint = APP_CONFIG.api.endpoints.messages.markAsRead
      .replace('{id}', conversationId.toString());
    return this.apiService.post<MarkAsReadResponse>(endpoint, {});
  }

  /**
   * Eliminar conversación completa
   */
  deleteConversation(conversationId: number): Observable<ApiResponse<any>> {
    const endpoint = APP_CONFIG.api.endpoints.messages.conversation.replace('{id}', conversationId.toString());
    return this.apiService.delete<ApiResponse<any>>(endpoint).pipe(
      tap(response => {
        if (response.success) {
          // Invalidar caché de conversaciones y mensajes
          this.cacheService.invalidatePattern('conversations_');
          this.cacheService.invalidatePattern('messages_');
        }
      })
    );
  }

  /**
   * Buscar conversaciones
   */
  searchConversations(query: string, params?: {
    limit?: number;
    offset?: number;
  }): Observable<ConversationsResponse> {
    return this.apiService.get<ConversationsResponse>(
      APP_CONFIG.api.endpoints.messages.conversations,
      { params: { ...params, search: query } }
    );
  }

  /**
   * Buscar mensajes
   */
  searchMessages(query: string, params?: {
    limit?: number;
    offset?: number;
  }): Observable<SearchMessagesResponse> {
    return this.apiService.get<SearchMessagesResponse>(
      APP_CONFIG.api.endpoints.messages.search,
      { params: { ...params, q: query } }
    );
  }

  /**
   * Obtener estado del bot para una conversación
   */
  getBotStatusForConversation(conversationId: number): Observable<ApiResponse<any>> {
    const endpoint = APP_CONFIG.api.endpoints.messages.conversation.replace('{id}', conversationId.toString()) + '/bot/status';
    return this.apiService.get<ApiResponse<any>>(endpoint);
  }

  /**
   * Activar bot para una conversación
   */
  enableBotForConversation(conversationId: number): Observable<ApiResponse<any>> {
    const endpoint = APP_CONFIG.api.endpoints.messages.botEnableConversation
      .replace('{id}', conversationId.toString());
    return this.apiService.post<ApiResponse<any>>(endpoint, {});
  }

  /**
   * Desactivar bot para una conversación
   */
  disableBotForConversation(conversationId: number): Observable<ApiResponse<any>> {
    const endpoint = APP_CONFIG.api.endpoints.messages.botDisableConversation
      .replace('{id}', conversationId.toString());
    return this.apiService.post<ApiResponse<any>>(endpoint, {});
  }

  /**
   * Enviar imagen (invalida caché)
   */
  sendImage(imageData: SendImageRequest): Observable<SendMessageResponse> {
    const formData = new FormData();
    formData.append('to', imageData.to);
    formData.append('image', imageData.image);
    if (imageData.caption) {
      formData.append('caption', imageData.caption);
    }

    return this.apiService.postFormData<SendMessageResponse>(
      APP_CONFIG.api.endpoints.whatsapp.sendImage,
      formData
    ).pipe(
      tap(response => {
        if (response.success) {
          // Invalidar caché de conversaciones y mensajes
          this.cacheService.invalidatePattern('conversations_');
          this.cacheService.invalidatePattern('messages_');
        }
      })
    );
  }

  /**
   * Enviar documento (invalida caché)
   */
  sendDocument(documentData: SendDocumentRequest): Observable<SendMessageResponse> {
    const formData = new FormData();
    formData.append('to', documentData.to);
    formData.append('document', documentData.document);
    if (documentData.filename) {
      formData.append('filename', documentData.filename);
    }

    return this.apiService.postFormData<SendMessageResponse>(
      APP_CONFIG.api.endpoints.whatsapp.sendDocument,
      formData
    ).pipe(
      tap(response => {
        if (response.success) {
          // Invalidar caché de conversaciones y mensajes
          this.cacheService.invalidatePattern('conversations_');
          this.cacheService.invalidatePattern('messages_');
        }
      })
    );
  }

  /**
   * Validar archivo
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    // Verificar tamaño
    if (file.size > APP_CONFIG.files.maxSize) {
      return {
        isValid: false,
        error: `El archivo es demasiado grande. Máximo ${this.formatFileSize(APP_CONFIG.files.maxSize)}`
      };
    }

    // Verificar tipo
    const isImage = APP_CONFIG.files.allowedImageTypes.includes(file.type);
    const isDocument = APP_CONFIG.files.allowedDocumentTypes.includes(file.type);

    if (!isImage && !isDocument) {
      return {
        isValid: false,
        error: 'Tipo de archivo no soportado'
      };
    }

    return { isValid: true };
  }

  /**
   * Formatear tamaño de archivo
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Determinar tipo de archivo
   */
  getFileType(file: File): 'image' | 'document' {
    return APP_CONFIG.files.allowedImageTypes.includes(file.type) ? 'image' : 'document';
  }

  /**
   * Crear preview de imagen
   */
  createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!APP_CONFIG.files.allowedImageTypes.includes(file.type)) {
        reject('No es una imagen válida');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => {
        reject('Error al leer el archivo');
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Generar respuesta sugerida usando IA
   */
  suggestResponse(conversationHistory: any[], lastMessage: string): Observable<{
    success: boolean;
    data?: {
      suggestedResponse: string;
      timestamp: string;
    };
    message?: string;
  }> {
    return this.apiService.post<{
      success: boolean;
      data?: {
        suggestedResponse: string;
        timestamp: string;
      };
      message?: string;
    }>('/api/ai/suggest-response', {
      conversationHistory,
      lastMessage
    });
  }

  /**
   * Analizar conversación con IA
   */
  analyzeConversation(conversationHistory: any[], question: string): Observable<{
    success: boolean;
    data?: {
      analysis: string;
      timestamp: string;
    };
    message?: string;
  }> {
    return this.apiService.post<{
      success: boolean;
      data?: {
        analysis: string;
        timestamp: string;
      };
      message?: string;
    }>('/api/ai/analyze-conversation', {
      conversationHistory,
      question
    });
  }
}
