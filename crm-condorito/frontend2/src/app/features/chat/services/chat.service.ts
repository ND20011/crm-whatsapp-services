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
    tagId?: number;
    tagIds?: number[];
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

    // Verificar tipo usando el método mejorado que incluye extensiones
    const fileName = file.name.toLowerCase();
    
    // Verificar por tipo MIME y extensión
    const isImage = APP_CONFIG.files.allowedImageTypes.includes(file.type) || 
                   fileName.match(/\.(jpg|jpeg|png|gif|webp)$/);
                   
    const isVideo = APP_CONFIG.files.allowedVideoTypes.includes(file.type) || 
                   fileName.match(/\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv|m4v|3gp|3gpp)$/);
                   
    const isDocument = APP_CONFIG.files.allowedDocumentTypes.includes(file.type) || 
                      fileName.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)$/);

    if (!isImage && !isVideo && !isDocument) {
      return {
        isValid: false,
        error: 'Tipo de archivo no soportado. Formatos válidos: imágenes (JPG, PNG, GIF, WebP), videos (MP4, MOV, AVI, WebM), documentos (PDF, DOC, XLS, etc.)'
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
  getFileType(file: File): 'image' | 'video' | 'document' {
    // Primero verificar por tipo MIME
    if (APP_CONFIG.files.allowedImageTypes.includes(file.type)) {
      return 'image';
    } else if (APP_CONFIG.files.allowedVideoTypes.includes(file.type)) {
      return 'video';
    }
    
    // Si el tipo MIME no es reconocido, verificar por extensión
    const fileName = file.name.toLowerCase();
    
    // Extensiones de imagen
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return 'image';
    }
    
    // Extensiones de video
    if (fileName.match(/\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv|m4v|3gp|3gpp)$/)) {
      return 'video';
    }
    
    // Por defecto, documento
    return 'document';
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
   * Crear preview de video
   */
  createVideoPreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!APP_CONFIG.files.allowedVideoTypes.includes(file.type)) {
        reject('No es un video válido');
        return;
      }

      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.onloadedmetadata = () => {
        // Establecer tiempo al primer frame
        video.currentTime = 1; // 1 segundo para evitar frame negro
      };
      
      video.onseeked = () => {
        try {
          // Calcular dimensiones manteniendo proporción
          const maxWidth = APP_CONFIG.files.previewMaxWidth;
          const maxHeight = APP_CONFIG.files.previewMaxHeight;
          
          let { videoWidth: width, videoHeight: height } = video;
          
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(video, 0, 0, width, height);
          
          // Agregar overlay de play button
          if (ctx) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, 25, 0, 2 * Math.PI);
            ctx.fill();
            
            // Triángulo de play
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(width / 2 - 8, height / 2 - 12);
            ctx.lineTo(width / 2 - 8, height / 2 + 12);
            ctx.lineTo(width / 2 + 12, height / 2);
            ctx.closePath();
            ctx.fill();
          }
          
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (error) {
          reject('Error al crear preview del video');
        } finally {
          // Limpiar
          video.remove();
        }
      };
      
      video.onerror = () => {
        video.remove();
        reject('Error al cargar el video');
      };
      
      video.src = URL.createObjectURL(file);
      video.load();
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
