import { Injectable, inject } from '@angular/core';
import { Observable, Subject, BehaviorSubject, timer, EMPTY } from 'rxjs';
import { 
  switchMap, 
  retry, 
  delay, 
  catchError, 
  takeUntil, 
  tap,
  concatMap,
  mergeMap
} from 'rxjs/operators';
import { ChatService } from '../../chat/services/chat.service';
import { 
  Conversation, 
  SendMessageRequest,
  SendImageRequest,
  SendDocumentRequest,
  SendMessageResponse,
  ChatFile 
} from '../../../core/models/api.models';

export interface OptimizedBulkMessageRequest {
  conversations: Conversation[];
  message?: string;
  files?: ChatFile[];
  messageType: 'text' | 'image' | 'document';
  batchSize?: number;
  delayBetweenBatches?: number;
  delayBetweenMessages?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface BulkMessageProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  currentBatch?: number;
  totalBatches?: number;
  isComplete: boolean;
  estimatedTimeRemaining?: number;
  throughput?: number; // mensajes por segundo
}

export interface BulkMessageResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    conversation: string;
    error: string;
    retryCount: number;
  }>;
  duration: number;
  throughput: number;
}

interface MessageJob {
  conversation: Conversation;
  attempt: number;
  maxRetries: number;
}

/**
 * Servicio optimizado para mensajes masivos
 * Implementa batching inteligente, retry logic, y control de throughput
 */
@Injectable({
  providedIn: 'root'
})
export class OptimizedBulkMessagesService {
  private chatService = inject(ChatService);
  private cancelSubject = new Subject<void>();
  private progressSubject = new BehaviorSubject<BulkMessageProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    isComplete: false
  });

  // Configuración por defecto
  private readonly DEFAULT_CONFIG = {
    batchSize: 5,
    delayBetweenBatches: 2000, // 2 segundos
    delayBetweenMessages: 500,  // 0.5 segundos
    maxRetries: 3,
    retryDelay: 1000 // 1 segundo
  };

  /**
   * Observable del progreso actual
   */
  get progress$(): Observable<BulkMessageProgress> {
    return this.progressSubject.asObservable();
  }

  /**
   * Enviar mensajes masivos con optimizaciones
   */
  sendOptimizedBulkMessages(request: OptimizedBulkMessageRequest): Observable<BulkMessageResult> {
    return new Observable(observer => {
      const config = { ...this.DEFAULT_CONFIG, ...request };
      const startTime = Date.now();
      let completed = 0;
      let failed = 0;
      const errors: Array<{ conversation: string; error: string; retryCount: number }> = [];
      
      // Crear jobs con retry logic
      const jobs: MessageJob[] = request.conversations.map(conv => ({
        conversation: conv,
        attempt: 0,
        maxRetries: config.maxRetries || this.DEFAULT_CONFIG.maxRetries
      }));

      const total = jobs.length;
      const batches = this.createBatches(jobs, config.batchSize || this.DEFAULT_CONFIG.batchSize);
      
      // Inicializar progreso
      this.updateProgress({
        total,
        completed: 0,
        failed: 0,
        isComplete: false,
        totalBatches: batches.length,
        currentBatch: 0
      });

      // Procesar batches secuencialmente
      this.processBatchesSequentially(batches, request, config, 0)
        .pipe(takeUntil(this.cancelSubject))
        .subscribe({
          next: (result) => {
            if (result.success) {
              completed++;
            } else {
              failed++;
              errors.push({
                conversation: result.conversationName,
                error: result.error,
                retryCount: result.retryCount
              });
            }

            // Actualizar progreso
            const progress = this.calculateProgress(total, completed, failed, batches.length, result.batchIndex);
            this.updateProgress(progress);
          },
          complete: () => {
            const duration = Date.now() - startTime;
            const throughput = completed / (duration / 1000);

            const finalResult: BulkMessageResult = {
              success: failed === 0,
              total,
              successful: completed,
              failed,
              errors,
              duration,
              throughput
            };

            this.updateProgress({
              total,
              completed,
              failed,
              isComplete: true,
              throughput
            });

            observer.next(finalResult);
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          }
        });
    });
  }

  /**
   * Procesar batches secuencialmente
   */
  private processBatchesSequentially(
    batches: MessageJob[][],
    request: OptimizedBulkMessageRequest,
    config: any,
    batchIndex: number
  ): Observable<any> {
    if (batchIndex >= batches.length) {
      return EMPTY;
    }

    const batch = batches[batchIndex];
    
    return this.processBatch(batch, request, config, batchIndex).pipe(
      concatMap(() => {
        // Delay entre batches
        return timer(config.delayBetweenBatches || this.DEFAULT_CONFIG.delayBetweenBatches).pipe(
          switchMap(() => this.processBatchesSequentially(batches, request, config, batchIndex + 1))
        );
      })
    );
  }

  /**
   * Procesar un batch de mensajes
   */
  private processBatch(
    batch: MessageJob[],
    request: OptimizedBulkMessageRequest,
    config: any,
    batchIndex: number
  ): Observable<any> {
    return new Observable(observer => {
      let batchCompleted = 0;

      batch.forEach((job, index) => {
        // Delay escalonado dentro del batch
        timer(index * (config.delayBetweenMessages || this.DEFAULT_CONFIG.delayBetweenMessages))
          .pipe(
            switchMap(() => this.sendMessageWithRetry(job, request, config)),
            takeUntil(this.cancelSubject)
          )
          .subscribe({
            next: (result) => {
              observer.next({ ...result, batchIndex });
              batchCompleted++;
              
              if (batchCompleted === batch.length) {
                observer.complete();
              }
            },
            error: (error) => {
              observer.next({
                success: false,
                conversationName: job.conversation.contact_name || job.conversation.contact_phone,
                error: error.message,
                retryCount: job.attempt,
                batchIndex
              });
              batchCompleted++;
              
              if (batchCompleted === batch.length) {
                observer.complete();
              }
            }
          });
      });
    });
  }

  /**
   * Enviar mensaje con retry logic
   */
  private sendMessageWithRetry(
    job: MessageJob,
    request: OptimizedBulkMessageRequest,
    config: any
  ): Observable<any> {
    return this.sendSingleMessage(job.conversation, request).pipe(
      retry({
        count: job.maxRetries,
        delay: (error, retryCount) => {
          job.attempt = retryCount;
          return timer(config.retryDelay * Math.pow(2, retryCount - 1)); // Exponential backoff
        }
      }),
      tap(() => {
        // Éxito
      }),
      catchError((error) => {
        // Falló después de todos los reintentos
        return new Observable(observer => {
          observer.next({
            success: false,
            conversationName: job.conversation.contact_name || job.conversation.contact_phone,
            error: error.message || 'Error desconocido',
            retryCount: job.attempt
          });
          observer.complete();
        });
      }),
      switchMap(() => {
        return new Observable(observer => {
          observer.next({
            success: true,
            conversationName: job.conversation.contact_name || job.conversation.contact_phone,
            retryCount: job.attempt
          });
          observer.complete();
        });
      })
    );
  }

  /**
   * Enviar un mensaje individual
   */
  private sendSingleMessage(
    conversation: Conversation,
    request: OptimizedBulkMessageRequest
  ): Observable<SendMessageResponse> {
    const { message, files, messageType } = request;

    if (messageType === 'text' || !files || files.length === 0) {
      const messageData: SendMessageRequest = {
        to: conversation.contact_phone,
        message: message || '',
        isBot: false
      };
      return this.chatService.sendMessage(messageData);
    } else if (messageType === 'image' && files.length > 0) {
      const file = files[0];
      const imageData: SendImageRequest = {
        to: conversation.contact_phone,
        image: file.file,
        caption: (file as any).caption || message || ''
      };
      return this.chatService.sendImage(imageData);
    } else if (messageType === 'document' && files.length > 0) {
      const file = files[0];
      const documentData: SendDocumentRequest = {
        to: conversation.contact_phone,
        document: file.file,
        filename: (file as any).caption || file.name
      };
      return this.chatService.sendDocument(documentData);
    }

    throw new Error('Tipo de mensaje no soportado');
  }

  /**
   * Crear batches de jobs
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Calcular progreso con estimaciones
   */
  private calculateProgress(
    total: number,
    completed: number,
    failed: number,
    totalBatches: number,
    currentBatch: number
  ): BulkMessageProgress {
    const processed = completed + failed;
    const percentage = processed / total;
    
    // Estimar tiempo restante basado en throughput actual
    const elapsed = Date.now() - (this.progressSubject.value as any).startTime || Date.now();
    const throughput = processed / (elapsed / 1000);
    const remaining = total - processed;
    const estimatedTimeRemaining = throughput > 0 ? (remaining / throughput) * 1000 : undefined;

    return {
      total,
      completed,
      failed,
      currentBatch: currentBatch + 1,
      totalBatches,
      isComplete: processed === total,
      estimatedTimeRemaining,
      throughput
    };
  }

  /**
   * Actualizar progreso
   */
  private updateProgress(progress: Partial<BulkMessageProgress>): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({ ...current, ...progress });
  }

  /**
   * Cancelar envío en progreso
   */
  cancelSending(): void {
    this.cancelSubject.next();
  }

  /**
   * Estimar configuración óptima basada en el número de conversaciones
   */
  getOptimalConfig(conversationCount: number): Partial<OptimizedBulkMessageRequest> {
    if (conversationCount <= 10) {
      return {
        batchSize: 3,
        delayBetweenBatches: 1000,
        delayBetweenMessages: 300
      };
    } else if (conversationCount <= 50) {
      return {
        batchSize: 5,
        delayBetweenBatches: 2000,
        delayBetweenMessages: 500
      };
    } else if (conversationCount <= 100) {
      return {
        batchSize: 8,
        delayBetweenBatches: 3000,
        delayBetweenMessages: 700
      };
    } else {
      return {
        batchSize: 10,
        delayBetweenBatches: 5000,
        delayBetweenMessages: 1000
      };
    }
  }

  /**
   * Validar y optimizar request
   */
  validateAndOptimize(request: OptimizedBulkMessageRequest): {
    isValid: boolean;
    errors: string[];
    optimizedRequest: OptimizedBulkMessageRequest;
  } {
    const errors: string[] = [];
    
    if (!request.conversations || request.conversations.length === 0) {
      errors.push('Debe seleccionar al menos una conversación');
    }

    if (request.messageType === 'text' && (!request.message || request.message.trim().length === 0)) {
      errors.push('El mensaje no puede estar vacío');
    }

    if ((request.messageType === 'image' || request.messageType === 'document') && 
        (!request.files || request.files.length === 0)) {
      errors.push('Debe seleccionar al menos un archivo');
    }

    // Aplicar configuración óptima
    const optimalConfig = this.getOptimalConfig(request.conversations.length);
    const optimizedRequest: OptimizedBulkMessageRequest = {
      ...request,
      ...optimalConfig
    };

    return {
      isValid: errors.length === 0,
      errors,
      optimizedRequest
    };
  }
}
