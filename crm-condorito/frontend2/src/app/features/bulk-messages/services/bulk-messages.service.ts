import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';
import { ChatService } from '../../chat/services/chat.service';
import { 
  Conversation, 
  SendMessageRequest,
  SendImageRequest,
  SendDocumentRequest,
  SendMessageResponse,
  ChatFile 
} from '../../../core/models/api.models';

export interface BulkMessageRequest {
  conversations: Conversation[];
  message?: string;
  files?: ChatFile[];
  messageType: 'text' | 'image' | 'document';
}

export interface BulkMessageProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  isComplete: boolean;
}

export interface BulkMessageResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  errors: string[];
}

/**
 * Servicio para el envío de mensajes masivos
 * Maneja el envío secuencial o paralelo de mensajes a múltiples conversaciones
 */
@Injectable({
  providedIn: 'root'
})
export class BulkMessagesService {
  private chatService = inject(ChatService);

  /**
   * Enviar mensajes masivos de forma secuencial
   * Recomendado para evitar sobrecarga del servidor
   */
  sendBulkMessagesSequential(
    request: BulkMessageRequest,
    progressCallback?: (progress: BulkMessageProgress) => void
  ): Observable<BulkMessageResult> {
    return new Observable(observer => {
      const { conversations, message, files, messageType } = request;
      const total = conversations.length;
      let completed = 0;
      let failed = 0;
      const errors: string[] = [];

      const sendNext = (index: number) => {
        if (index >= total) {
          // Completado
          const result: BulkMessageResult = {
            success: failed === 0,
            total,
            successful: completed,
            failed,
            errors
          };
          
          if (progressCallback) {
            progressCallback({
              total,
              completed,
              failed,
              isComplete: true
            });
          }
          
          observer.next(result);
          observer.complete();
          return;
        }

        const conversation = conversations[index];
        
        if (progressCallback) {
          progressCallback({
            total,
            completed,
            failed,
            current: conversation.contact_name || conversation.contact_phone,
            isComplete: false
          });
        }

        // Determinar qué tipo de mensaje enviar
        let sendObservable: Observable<SendMessageResponse>;

        if (messageType === 'text' || !files || files.length === 0) {
          // Enviar mensaje de texto
          const messageData: SendMessageRequest = {
            to: conversation.contact_phone,
            message: message || '',
            isBot: false
          };
          sendObservable = this.chatService.sendMessage(messageData);
        } else if (messageType === 'image' && files.length > 0) {
          // Enviar imagen (primera del array)
          const file = files[0];
          const imageData: SendImageRequest = {
            to: conversation.contact_phone,
            image: file.file,
            caption: (file as any).caption || message || ''
          };
          sendObservable = this.chatService.sendImage(imageData);
        } else if (messageType === 'document' && files.length > 0) {
          // Enviar documento (primera del array)
          const file = files[0];
          const documentData: SendDocumentRequest = {
            to: conversation.contact_phone,
            document: file.file,
            filename: (file as any).caption || file.name
          };
          sendObservable = this.chatService.sendDocument(documentData);
        } else {
          // Tipo no soportado, marcar como error
          failed++;
          errors.push(`Tipo de mensaje no soportado para ${conversation.contact_name || conversation.contact_phone}`);
          sendNext(index + 1);
          return;
        }

        // Enviar el mensaje
        sendObservable.pipe(
          delay(500) // Pequeño delay entre envíos para no sobrecargar
        ).subscribe({
          next: (response) => {
            if (response.success) {
              completed++;
            } else {
              failed++;
              errors.push(`Error en ${conversation.contact_name || conversation.contact_phone}: ${response.message}`);
            }
            sendNext(index + 1);
          },
          error: (error) => {
            failed++;
            errors.push(`Error en ${conversation.contact_name || conversation.contact_phone}: ${error.message || 'Error desconocido'}`);
            sendNext(index + 1);
          }
        });
      };

      // Iniciar el proceso
      sendNext(0);
    });
  }

  /**
   * Enviar mensajes masivos de forma paralela
   * Más rápido pero puede sobrecargar el servidor
   */
  sendBulkMessagesParallel(
    request: BulkMessageRequest,
    batchSize: number = 5
  ): Observable<BulkMessageResult> {
    const { conversations, message, files, messageType } = request;
    const total = conversations.length;
    
    // Dividir en lotes
    const batches: Conversation[][] = [];
    for (let i = 0; i < conversations.length; i += batchSize) {
      batches.push(conversations.slice(i, i + batchSize));
    }

    return new Observable(observer => {
      let completed = 0;
      let failed = 0;
      const errors: string[] = [];

      const processBatch = (batchIndex: number) => {
        if (batchIndex >= batches.length) {
          // Completado
          const result: BulkMessageResult = {
            success: failed === 0,
            total,
            successful: completed,
            failed,
            errors
          };
          observer.next(result);
          observer.complete();
          return;
        }

        const batch = batches[batchIndex];
        const batchObservables = batch.map(conversation => {
          let sendObservable: Observable<SendMessageResponse>;

          if (messageType === 'text' || !files || files.length === 0) {
            const messageData: SendMessageRequest = {
              to: conversation.contact_phone,
              message: message || '',
              isBot: false
            };
            sendObservable = this.chatService.sendMessage(messageData);
          } else if (messageType === 'image' && files.length > 0) {
            const file = files[0];
            const imageData: SendImageRequest = {
              to: conversation.contact_phone,
              image: file.file,
              caption: (file as any).caption || message || ''
            };
            sendObservable = this.chatService.sendImage(imageData);
          } else if (messageType === 'document' && files.length > 0) {
            const file = files[0];
            const documentData: SendDocumentRequest = {
              to: conversation.contact_phone,
              document: file.file,
              filename: (file as any).caption || file.name
            };
            sendObservable = this.chatService.sendDocument(documentData);
          } else {
            return of({ success: false, message: 'Tipo no soportado' });
          }

          return sendObservable.pipe(
            catchError(error => of({ 
              success: false, 
              message: error.message || 'Error desconocido' 
            }))
          );
        });

        // Ejecutar lote en paralelo
        forkJoin(batchObservables).subscribe({
          next: (responses) => {
            responses.forEach((response, index) => {
              if (response.success) {
                completed++;
              } else {
                failed++;
                const conversation = batch[index];
                errors.push(`Error en ${conversation.contact_name || conversation.contact_phone}: ${response.message}`);
              }
            });

            // Procesar siguiente lote después de un delay
            setTimeout(() => processBatch(batchIndex + 1), 1000);
          },
          error: (error) => {
            // Error en todo el lote
            batch.forEach(conversation => {
              failed++;
              errors.push(`Error en ${conversation.contact_name || conversation.contact_phone}: ${error.message || 'Error de lote'}`);
            });
            setTimeout(() => processBatch(batchIndex + 1), 1000);
          }
        });
      };

      processBatch(0);
    });
  }

  /**
   * Validar request de mensaje masivo
   */
  validateBulkMessageRequest(request: BulkMessageRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.conversations || request.conversations.length === 0) {
      errors.push('Debe seleccionar al menos una conversación');
    }

    if (request.messageType === 'text') {
      if (!request.message || request.message.trim().length === 0) {
        errors.push('El mensaje no puede estar vacío');
      }
    } else if (request.messageType === 'image' || request.messageType === 'document') {
      if (!request.files || request.files.length === 0) {
        errors.push('Debe seleccionar al menos un archivo');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Estimar tiempo de envío
   */
  estimateSendTime(conversationCount: number, messageType: 'text' | 'image' | 'document'): number {
    // Estimaciones en segundos
    const baseTime = messageType === 'text' ? 1 : 3; // Archivos toman más tiempo
    const delayBetweenMessages = 0.5;
    
    return (baseTime + delayBetweenMessages) * conversationCount;
  }

  /**
   * Formatear tiempo estimado
   */
  formatEstimatedTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.ceil(seconds)} segundos`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.ceil((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
}
