import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { LoadingService } from '../../../../core/services/loading.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ScheduledMessagesService } from '../../services/scheduled-messages.service';
import {
  ScheduledMessage,
  ScheduledMessageExecution,
  ScheduledMessageRecipient,
  STATUS_COLORS,
  SEND_TYPE_ICONS,
  MESSAGE_TYPE_ICONS
} from '../../models/scheduled-message.models';

// ============================================================================
// SCHEDULED MESSAGE DETAIL COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-scheduled-message-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scheduled-message-detail.component.html',
  styleUrls: ['./scheduled-message-detail.component.scss']
})
export class ScheduledMessageDetailComponent implements OnInit, OnDestroy {
  // ============================================================================
  // DEPENDENCIES
  // ============================================================================
  private scheduledMessagesService = inject(ScheduledMessagesService);
  public loadingService = inject(LoadingService);
  public errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // ============================================================================
  // SIGNALS
  // ============================================================================
  message = signal<ScheduledMessage | null>(null);
  executions = signal<ScheduledMessageExecution[]>([]);
  selectedExecution = signal<ScheduledMessageExecution | null>(null);
  executionRecipients = signal<ScheduledMessageRecipient[]>([]);
  currentExecutionsPage = signal<number>(1);
  totalExecutionsPages = signal<number>(1);
  currentRecipientsPage = signal<number>(1);
  totalRecipientsPages = signal<number>(1);

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  readonly PAGE_SIZE = 20;
  readonly STATUS_COLORS = STATUS_COLORS;
  readonly SEND_TYPE_ICONS = SEND_TYPE_ICONS;
  readonly MESSAGE_TYPE_ICONS = MESSAGE_TYPE_ICONS;

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  ngOnInit(): void {
    const messageId = this.route.snapshot.params['id'];
    if (messageId) {
      this.loadMessage(parseInt(messageId));
      this.loadExecutions(parseInt(messageId));
    } else {
      this.router.navigate(['/scheduled-messages']);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Cargar mensaje programado
   */
  loadMessage(messageId: number): void {
    const subscription = this.scheduledMessagesService.getScheduledMessage(messageId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.message.set(response.data);
        } else {
          this.errorHandler.handleError('Mensaje programado no encontrado');
          this.router.navigate(['/scheduled-messages']);
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error cargando mensaje programado', error);
        this.router.navigate(['/scheduled-messages']);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar historial de ejecuciones
   */
  loadExecutions(messageId: number, page: number = 1): void {
    this.currentExecutionsPage.set(page);

    const subscription = this.scheduledMessagesService.getExecutionHistory(messageId, page, this.PAGE_SIZE).subscribe({
      next: (response) => {
        if (response.success) {
          this.executions.set(response.data);
          this.totalExecutionsPages.set(response.pagination.pages);
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error cargando historial de ejecuciones', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar destinatarios de una ejecución específica
   */
  loadExecutionRecipients(executionId: number, page: number = 1): void {
    const message = this.message();
    if (!message) return;

    this.currentRecipientsPage.set(page);

    const subscription = this.scheduledMessagesService.getExecutionRecipients(
      message.id, 
      executionId, 
      page, 
      50
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.executionRecipients.set(response.data);
          this.totalRecipientsPages.set(response.pagination.pages);
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error cargando destinatarios', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Volver a la lista
   */
  goBack(): void {
    this.router.navigate(['/scheduled-messages']);
  }

  /**
   * Editar mensaje
   */
  editMessage(): void {
    const message = this.message();
    if (message) {
      this.router.navigate(['/scheduled-messages/edit', message.id]);
    }
  }

  /**
   * Pausar mensaje
   */
  pauseMessage(): void {
    const message = this.message();
    if (!message) return;

    const loadingId = this.loadingService.startLoading('pause-message', 'Pausando mensaje...');

    const subscription = this.scheduledMessagesService.pauseScheduledMessage(message.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Mensaje pausado exitosamente', 'success');
          this.loadMessage(message.id);
        } else {
          this.errorHandler.handleError(response.message || 'Error al pausar mensaje');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al pausar mensaje', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Reanudar mensaje
   */
  resumeMessage(): void {
    const message = this.message();
    if (!message) return;

    const loadingId = this.loadingService.startLoading('resume-message', 'Reanudando mensaje...');

    const subscription = this.scheduledMessagesService.resumeScheduledMessage(message.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Mensaje reanudado exitosamente', 'success');
          this.loadMessage(message.id);
        } else {
          this.errorHandler.handleError(response.message || 'Error al reanudar mensaje');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al reanudar mensaje', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Ver detalles de una ejecución
   */
  viewExecutionDetails(execution: ScheduledMessageExecution): void {
    this.selectedExecution.set(execution);
    this.loadExecutionRecipients(execution.id);
  }

  /**
   * Cerrar detalles de ejecución
   */
  closeExecutionDetails(): void {
    this.selectedExecution.set(null);
    this.executionRecipients.set([]);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Obtener color del estado
   */
  getStatusColor(status: string): string {
    return this.scheduledMessagesService.getStatusColor(status);
  }

  /**
   * Obtener texto del estado
   */
  getStatusText(status: string): string {
    return this.scheduledMessagesService.getStatusText(status);
  }

  /**
   * Obtener texto del tipo de envío
   */
  getSendTypeText(sendType: string): string {
    return this.scheduledMessagesService.getSendTypeText(sendType);
  }

  /**
   * Obtener texto del tipo de mensaje
   */
  getMessageTypeText(messageType: string): string {
    return this.scheduledMessagesService.getMessageTypeText(messageType);
  }

  /**
   * Formatear fecha
   */
  formatDate(dateString: string): string {
    return this.scheduledMessagesService.formatDate(dateString);
  }

  /**
   * Formatear fecha relativa
   */
  formatRelativeDate(dateString: string): string {
    return this.scheduledMessagesService.formatRelativeDate(dateString);
  }

  /**
   * Obtener texto de recurrencia
   */
  getRecurrenceText(type?: string, interval?: number): string {
    return this.scheduledMessagesService.getRecurrenceText(type, interval);
  }

  /**
   * Calcular progreso de ejecuciones
   */
  calculateProgress(execution_count: number, max_executions?: number): number {
    return this.scheduledMessagesService.calculateProgress(execution_count, max_executions);
  }

  /**
   * Verificar si se puede pausar
   */
  canPause(): boolean {
    const message = this.message();
    return message ? (message.status === 'active' || message.status === 'pending') : false;
  }

  /**
   * Verificar si se puede reanudar
   */
  canResume(): boolean {
    const message = this.message();
    return message ? message.status === 'paused' : false;
  }

  /**
   * Verificar si se puede editar
   */
  canEdit(): boolean {
    const message = this.message();
    return message ? (message.status !== 'completed' && message.status !== 'cancelled') : false;
  }

  /**
   * Obtener nombre del destinatario
   */
  getRecipientName(): string {
    const message = this.message();
    if (!message) return '';

    if (message.send_type === 'individual') {
      return message.contact_name || message.recipient_phone || 'Contacto individual';
    } else if (message.send_type === 'bulk_tags') {
      const tagCount = message.target_tag_ids?.length || 0;
      return `${tagCount} etiqueta${tagCount !== 1 ? 's' : ''}`;
    } else {
      return 'Todos los contactos';
    }
  }

  /**
   * Obtener próxima ejecución formateada
   */
  getNextExecutionText(): string {
    const message = this.message();
    if (!message || !message.next_execution) {
      return message?.status === 'completed' ? 'Completado' : 'Sin programar';
    }

    // Si el mensaje ya se ejecutó, mostrar el estado real
    if (message.status === 'completed') {
      if (message.success_count > 0 && message.error_count === 0) {
        return 'Ejecutado exitosamente';
      } else if (message.error_count > 0 && message.success_count === 0) {
        return 'Ejecutado con errores';
      } else if (message.error_count > 0 && message.success_count > 0) {
        return 'Ejecutado parcialmente';
      } else {
        return 'Completado';
      }
    }

    if (message.status === 'error') {
      return 'Error en ejecución';
    }

    if (message.status === 'cancelled') {
      return 'Cancelado';
    }

    if (message.status === 'paused') {
      return 'Pausado';
    }

    const now = new Date();
    const nextExec = new Date(message.next_execution);
    
    if (nextExec <= now && message.status === 'pending') {
      return 'Listo para ejecutar';
    }

    return this.formatRelativeDate(message.next_execution);
  }

  /**
   * Obtener tasa de éxito
   */
  getSuccessRate(): number {
    const message = this.message();
    if (!message || message.execution_count === 0) return 0;
    return Math.round((message.success_count / message.execution_count) * 100);
  }

  /**
   * Formatear tiempo de ejecución
   */
  formatExecutionTime(timeMs?: number): string {
    if (!timeMs) return 'N/A';
    
    if (timeMs < 1000) {
      return `${timeMs}ms`;
    } else if (timeMs < 60000) {
      return `${(timeMs / 1000).toFixed(1)}s`;
    } else {
      return `${(timeMs / 60000).toFixed(1)}min`;
    }
  }

  /**
   * Track functions para ngFor
   */
  trackByExecutionId(index: number, execution: ScheduledMessageExecution): number {
    return execution.id;
  }

  trackByRecipientId(index: number, recipient: ScheduledMessageRecipient): number {
    return recipient.id;
  }
}
