import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { APP_CONFIG } from '../../../core/config/app.config';
import {
  ScheduledMessage,
  ScheduledMessageExecution,
  ScheduledMessageRecipient,
  ScheduledMessageStatistics,
  ProcessorStatus,
  CreateScheduledMessageRequest,
  UpdateScheduledMessageRequest,
  ScheduledMessageFilters,
  ScheduledMessagesResponse,
  ExecutionsResponse,
  RecipientsResponse,
  ApiResponse
} from '../models/scheduled-message.models';

// ============================================================================
// SCHEDULED MESSAGES SERVICE - CRM CONDORITO FRONTEND
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class ScheduledMessagesService {
  private apiService = inject(ApiService);

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Obtener lista de mensajes programados
   */
  getScheduledMessages(filters?: ScheduledMessageFilters): Observable<ScheduledMessagesResponse> {
    const params: any = {};
    
    if (filters?.page) params.page = filters.page;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.status) params.status = filters.status;
    if (filters?.send_type) params.send_type = filters.send_type;
    if (filters?.is_active !== undefined) params.is_active = filters.is_active;
    if (filters?.is_recurring !== undefined) params.is_recurring = filters.is_recurring;
    if (filters?.search) params.search = filters.search;
    if (filters?.sortBy) params.sortBy = filters.sortBy;
    if (filters?.sortOrder) params.sortOrder = filters.sortOrder;

    return this.apiService.get<ScheduledMessagesResponse>('/api/scheduled-messages', { params });
  }

  /**
   * Obtener mensaje programado específico
   */
  getScheduledMessage(id: number): Observable<ApiResponse<ScheduledMessage>> {
    return this.apiService.get<ApiResponse<ScheduledMessage>>(`/api/scheduled-messages/${id}`);
  }

  /**
   * Crear nuevo mensaje programado
   */
  createScheduledMessage(data: CreateScheduledMessageRequest): Observable<ApiResponse<ScheduledMessage>> {
    return this.apiService.post<ApiResponse<ScheduledMessage>>('/api/scheduled-messages', data);
  }

  /**
   * Actualizar mensaje programado
   */
  updateScheduledMessage(id: number, data: UpdateScheduledMessageRequest): Observable<ApiResponse<ScheduledMessage>> {
    return this.apiService.put<ApiResponse<ScheduledMessage>>(`/api/scheduled-messages/${id}`, data);
  }

  /**
   * Eliminar mensaje programado
   */
  deleteScheduledMessage(id: number): Observable<ApiResponse> {
    return this.apiService.delete<ApiResponse>(`/api/scheduled-messages/${id}`);
  }

  // ============================================================================
  // CONTROL OPERATIONS
  // ============================================================================

  /**
   * Pausar mensaje programado
   */
  pauseScheduledMessage(id: number): Observable<ApiResponse<ScheduledMessage>> {
    return this.apiService.post<ApiResponse<ScheduledMessage>>(`/api/scheduled-messages/${id}/pause`, {});
  }

  /**
   * Reanudar mensaje programado
   */
  resumeScheduledMessage(id: number): Observable<ApiResponse<ScheduledMessage>> {
    return this.apiService.post<ApiResponse<ScheduledMessage>>(`/api/scheduled-messages/${id}/resume`, {});
  }

  /**
   * Duplicar mensaje programado
   */
  duplicateScheduledMessage(id: number, name?: string): Observable<ApiResponse<ScheduledMessage>> {
    return this.apiService.post<ApiResponse<ScheduledMessage>>(`/api/scheduled-messages/${id}/duplicate`, { name });
  }

  // ============================================================================
  // HISTORY OPERATIONS
  // ============================================================================

  /**
   * Obtener historial de ejecuciones
   */
  getExecutionHistory(id: number, page = 1, limit = 20): Observable<ExecutionsResponse> {
    const params = { page, limit };
    return this.apiService.get<ExecutionsResponse>(`/api/scheduled-messages/${id}/executions`, { params });
  }

  /**
   * Obtener destinatarios de una ejecución específica
   */
  getExecutionRecipients(
    id: number, 
    executionId: number, 
    page = 1, 
    limit = 50, 
    status?: string
  ): Observable<RecipientsResponse> {
    const params: any = { page, limit };
    if (status) params.status = status;
    
    return this.apiService.get<RecipientsResponse>(
      `/api/scheduled-messages/${id}/recipients/${executionId}`,
      { params }
    );
  }

  // ============================================================================
  // STATISTICS AND MONITORING
  // ============================================================================

  /**
   * Obtener estadísticas de mensajes programados
   */
  getStatistics(): Observable<ApiResponse<ScheduledMessageStatistics>> {
    return this.apiService.get<ApiResponse<ScheduledMessageStatistics>>('/api/scheduled-messages/statistics');
  }

  /**
   * Obtener estado del procesador
   */
  getProcessorStatus(): Observable<ApiResponse<ProcessorStatus>> {
    return this.apiService.get<ApiResponse<ProcessorStatus>>('/api/scheduled-messages/processor/status');
  }

  /**
   * Reiniciar procesador
   */
  restartProcessor(): Observable<ApiResponse> {
    return this.apiService.post<ApiResponse>('/api/scheduled-messages/processor/restart', {});
  }

  /**
   * Procesar mensajes manualmente (para testing)
   */
  processMessagesManually(): Observable<ApiResponse> {
    return this.apiService.post<ApiResponse>('/api/scheduled-messages/process', {});
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Validar fecha programada
   */
  validateScheduledDate(dateString: string): { valid: boolean; error?: string } {
    const scheduledDate = new Date(dateString);
    const now = new Date();

    if (isNaN(scheduledDate.getTime())) {
      return { valid: false, error: 'Fecha inválida' };
    }

    if (scheduledDate <= now) {
      return { valid: false, error: 'La fecha debe ser en el futuro' };
    }

    // Verificar que no sea más de 1 año en el futuro
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    if (scheduledDate > oneYearFromNow) {
      return { valid: false, error: 'La fecha no puede ser más de 1 año en el futuro' };
    }

    return { valid: true };
  }

  /**
   * Formatear fecha para visualización
   */
  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Formatear fecha relativa
   */
  formatRelativeDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 0) {
        const absDiff = Math.abs(diffInHours);
        if (absDiff < 24) {
          return `Hace ${absDiff}h`;
        } else {
          const days = Math.floor(absDiff / 24);
          return `Hace ${days} día${days > 1 ? 's' : ''}`;
        }
      } else {
        if (diffInHours < 24) {
          return `En ${diffInHours}h`;
        } else {
          const days = Math.floor(diffInHours / 24);
          return `En ${days} día${days > 1 ? 's' : ''}`;
        }
      }
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Obtener color del estado
   */
  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      pending: '#6c757d',
      active: '#28a745',
      paused: '#ffc107',
      completed: '#17a2b8',
      cancelled: '#6f42c1',
      error: '#dc3545'
    };
    return colors[status] || '#6c757d';
  }

  /**
   * Obtener texto del estado
   */
  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      pending: 'Pendiente',
      active: 'Activo',
      paused: 'Pausado',
      completed: 'Completado',
      cancelled: 'Cancelado',
      error: 'Error'
    };
    return texts[status] || status;
  }

  /**
   * Obtener texto del tipo de envío
   */
  getSendTypeText(sendType: string): string {
    const texts: { [key: string]: string } = {
      individual: 'Individual',
      bulk_tags: 'Por Etiquetas',
      bulk_all: 'Todos los Contactos'
    };
    return texts[sendType] || sendType;
  }

  /**
   * Obtener texto del tipo de mensaje
   */
  getMessageTypeText(messageType: string): string {
    const texts: { [key: string]: string } = {
      text: 'Texto',
      template: 'Template'
    };
    return texts[messageType] || messageType;
  }

  /**
   * Obtener texto de recurrencia
   */
  getRecurrenceText(type?: string, interval?: number): string {
    if (!type || !interval) return 'No recurrente';

    const texts: { [key: string]: string } = {
      minutes: interval === 1 ? 'minuto' : 'minutos',
      hours: interval === 1 ? 'hora' : 'horas',
      days: interval === 1 ? 'día' : 'días',
      weeks: interval === 1 ? 'semana' : 'semanas',
      months: interval === 1 ? 'mes' : 'meses'
    };

    return `Cada ${interval} ${texts[type] || type}`;
  }

  /**
   * Calcular progreso de ejecuciones
   */
  calculateProgress(execution_count: number, max_executions?: number): number {
    if (!max_executions || max_executions === 0) return 0;
    return Math.min(100, (execution_count / max_executions) * 100);
  }

  /**
   * Validar configuración de recurrencia
   */
  validateRecurrence(
    isRecurring: boolean,
    type?: string,
    interval?: number,
    endDate?: string,
    maxExecutions?: number
  ): { valid: boolean; error?: string } {
    if (!isRecurring) return { valid: true };

    if (!type) {
      return { valid: false, error: 'Tipo de recurrencia es requerido' };
    }

    if (!interval || interval <= 0) {
      return { valid: false, error: 'Intervalo de recurrencia debe ser positivo' };
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      const now = new Date();
      
      if (endDateTime <= now) {
        return { valid: false, error: 'Fecha de fin debe ser en el futuro' };
      }
    }

    if (maxExecutions && maxExecutions <= 0) {
      return { valid: false, error: 'Máximo de ejecuciones debe ser positivo' };
    }

    if (!endDate && !maxExecutions) {
      return { valid: false, error: 'Debe especificar fecha de fin o máximo de ejecuciones' };
    }

    return { valid: true };
  }
}
