import { Component, OnInit, OnDestroy, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { LoadingService } from '../../../../core/services/loading.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ScheduledMessagesService } from '../../services/scheduled-messages.service';
import {
  ScheduledMessage,
  ScheduledMessageFilters,
  ScheduledMessageStatistics,
  STATUS_COLORS,
  SEND_TYPE_ICONS,
  MESSAGE_TYPE_ICONS
} from '../../models/scheduled-message.models';

// ============================================================================
// SCHEDULED MESSAGE LIST COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-scheduled-message-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './scheduled-message-list.component.html',
  styleUrls: ['./scheduled-message-list.component.scss']
})
export class ScheduledMessageListComponent implements OnInit, OnDestroy {
  // ============================================================================
  // DEPENDENCIES
  // ============================================================================
  private scheduledMessagesService = inject(ScheduledMessagesService);
  public loadingService = inject(LoadingService);
  public errorHandler = inject(ErrorHandlerService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // ============================================================================
  // SIGNALS
  // ============================================================================
  scheduledMessages = signal<ScheduledMessage[]>([]);
  statistics = signal<ScheduledMessageStatistics | null>(null);
  isLoading = signal<boolean>(false);
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  showDeleteModal = signal<boolean>(false);
  messageToDelete = signal<ScheduledMessage | null>(null);
  viewMode = signal<'grid' | 'table'>('grid');

  // ============================================================================
  // COMPUTED
  // ============================================================================
  hasMessages = computed(() => this.scheduledMessages().length > 0);
  hasFilters = computed(() => {
    const form = this.filterForm.value;
    return !!(
      form.search || 
      form.status || 
      form.send_type ||
      form.is_active !== null ||
      form.is_recurring !== null
    );
  });

  // ============================================================================
  // FORM
  // ============================================================================
  filterForm: FormGroup;

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  readonly PAGE_SIZE = 20;
  readonly STATUS_COLORS = STATUS_COLORS;
  readonly SEND_TYPE_ICONS = SEND_TYPE_ICONS;
  readonly MESSAGE_TYPE_ICONS = MESSAGE_TYPE_ICONS;
  readonly STORAGE_KEY = 'scheduled-messages-view-mode';

  // Status options for filters
  readonly STATUS_OPTIONS = [
    { value: null, label: 'Todos los Estados' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'active', label: 'Activos' },
    { value: 'paused', label: 'Pausados' },
    { value: 'completed', label: 'Completados' },
    { value: 'error', label: 'Con Errores' }
  ];

  readonly SEND_TYPE_OPTIONS = [
    { value: null, label: 'Todos los Tipos' },
    { value: 'individual', label: 'Individual' },
    { value: 'bulk_tags', label: 'Por Etiquetas' },
    { value: 'bulk_all', label: 'Todos los Contactos' }
  ];

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  constructor() {
    this.filterForm = this.fb.group({
      search: [''],
      status: [null],
      send_type: [null],
      is_active: [null],
      is_recurring: [null],
      sortBy: ['created_at'],
      sortOrder: ['DESC']
    });
  }

  ngOnInit(): void {
    this.loadViewModeFromStorage();
    this.loadScheduledMessages();
    this.loadStatistics();
    this.setupFilterSubscription();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Cargar lista de mensajes programados
   */
  loadScheduledMessages(page: number = 1): void {
    this.isLoading.set(true);
    this.currentPage.set(page);

    const formValues = this.filterForm.value;
    const filters: ScheduledMessageFilters = {
      page,
      limit: this.PAGE_SIZE
    };

    // Agregar filtros si tienen valor
    if (formValues.search?.trim()) {
      filters.search = formValues.search.trim();
    }
    
    if (formValues.status) {
      filters.status = formValues.status;
    }
    
    if (formValues.send_type) {
      filters.send_type = formValues.send_type;
    }
    
    if (formValues.is_active !== null) {
      filters.is_active = formValues.is_active;
    }
    
    if (formValues.is_recurring !== null) {
      filters.is_recurring = formValues.is_recurring;
    }
    
    if (formValues.sortBy) {
      filters.sortBy = formValues.sortBy;
    }
    
    if (formValues.sortOrder) {
      filters.sortOrder = formValues.sortOrder;
    }

    const subscription = this.scheduledMessagesService.getScheduledMessages(filters).subscribe({
      next: (response) => {
        if (response.success) {
          this.scheduledMessages.set(response.data);
          this.totalPages.set(response.pagination.pages);
        } else {
          this.errorHandler.handleError('Error al cargar mensajes programados');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al cargar mensajes programados', error);
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar estadísticas
   */
  loadStatistics(): void {
    const subscription = this.scheduledMessagesService.getStatistics().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.statistics.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error cargando estadísticas:', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Configurar suscripción a cambios de filtros
   */
  setupFilterSubscription(): void {
    const subscription = this.filterForm.valueChanges.subscribe(() => {
      this.loadScheduledMessages(1);
    });

    this.subscriptions.push(subscription);
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Crear nuevo mensaje programado
   */
  createScheduledMessage(): void {
    this.router.navigate(['/scheduled-messages/create']);
  }

  /**
   * Editar mensaje programado
   */
  editScheduledMessage(message: ScheduledMessage): void {
    this.router.navigate(['/scheduled-messages/edit', message.id]);
  }

  /**
   * Ver detalles del mensaje programado
   */
  viewScheduledMessage(message: ScheduledMessage): void {
    this.router.navigate(['/scheduled-messages/view', message.id]);
  }

  /**
   * Pausar mensaje programado
   */
  pauseScheduledMessage(message: ScheduledMessage): void {
    const loadingId = this.loadingService.startLoading('pause-message', 'Pausando mensaje...');

    const subscription = this.scheduledMessagesService.pauseScheduledMessage(message.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Mensaje pausado exitosamente', 'success');
          this.loadScheduledMessages(this.currentPage());
          this.loadStatistics();
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
   * Reanudar mensaje programado
   */
  resumeScheduledMessage(message: ScheduledMessage): void {
    const loadingId = this.loadingService.startLoading('resume-message', 'Reanudando mensaje...');

    const subscription = this.scheduledMessagesService.resumeScheduledMessage(message.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Mensaje reanudado exitosamente', 'success');
          this.loadScheduledMessages(this.currentPage());
          this.loadStatistics();
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
   * Duplicar mensaje programado
   */
  duplicateScheduledMessage(message: ScheduledMessage): void {
    const newName = `${message.name} (Copia)`;
    const loadingId = this.loadingService.startLoading('duplicate-message', 'Duplicando mensaje...');

    const subscription = this.scheduledMessagesService.duplicateScheduledMessage(message.id, newName).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Mensaje duplicado exitosamente', 'success');
          this.loadScheduledMessages(this.currentPage());
          this.loadStatistics();
        } else {
          this.errorHandler.handleError(response.message || 'Error al duplicar mensaje');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al duplicar mensaje', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Confirmar eliminación
   */
  confirmDelete(message: ScheduledMessage): void {
    this.messageToDelete.set(message);
    this.showDeleteModal.set(true);
  }

  /**
   * Eliminar mensaje programado
   */
  deleteScheduledMessage(): void {
    const message = this.messageToDelete();
    if (!message) return;

    const loadingId = this.loadingService.startLoading('delete-message', 'Eliminando mensaje...');

    const subscription = this.scheduledMessagesService.deleteScheduledMessage(message.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Mensaje eliminado exitosamente', 'success');
          this.loadScheduledMessages(this.currentPage());
          this.loadStatistics();
          this.closeDeleteModal();
        } else {
          this.errorHandler.handleError(response.message || 'Error al eliminar mensaje');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al eliminar mensaje', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cerrar modal de eliminación
   */
  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.messageToDelete.set(null);
  }

  // ============================================================================
  // FILTERS
  // ============================================================================

  /**
   * Limpiar filtros
   */
  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: null,
      send_type: null,
      is_active: null,
      is_recurring: null,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
  }

  // ============================================================================
  // PAGINATION
  // ============================================================================

  /**
   * Ir a página específica
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.loadScheduledMessages(page);
    }
  }

  /**
   * Obtener array de números de página para la paginación
   */
  getTotalPages(): number[] {
    const totalPages = this.totalPages();
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // ============================================================================
  // VIEW MODE METHODS
  // ============================================================================

  /**
   * Cargar modo de vista desde localStorage
   */
  loadViewModeFromStorage(): void {
    const savedViewMode = localStorage.getItem(this.STORAGE_KEY);
    if (savedViewMode === 'grid' || savedViewMode === 'table') {
      this.viewMode.set(savedViewMode);
    }
  }

  /**
   * Cambiar modo de vista
   */
  toggleViewMode(): void {
    const newMode = this.viewMode() === 'grid' ? 'table' : 'grid';
    this.setViewMode(newMode);
  }

  /**
   * Establecer modo de vista específico
   */
  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode.set(mode);
    localStorage.setItem(this.STORAGE_KEY, mode);
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
  canPause(message: ScheduledMessage): boolean {
    return message.status === 'active' || message.status === 'pending';
  }

  /**
   * Verificar si se puede reanudar
   */
  canResume(message: ScheduledMessage): boolean {
    return message.status === 'paused';
  }

  /**
   * Verificar si se puede editar
   */
  canEdit(message: ScheduledMessage): boolean {
    return message.status !== 'completed' && message.status !== 'cancelled';
  }

  /**
   * Verificar si se puede eliminar
   */
  canDelete(message: ScheduledMessage): boolean {
    return message.status !== 'active' && message.status !== 'pending';
  }

  /**
   * Obtener nombre del destinatario
   */
  getRecipientName(message: ScheduledMessage): string {
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
  getNextExecutionText(message: ScheduledMessage): string {
    if (!message.next_execution) {
      return message.status === 'completed' ? 'Completado' : 'Sin programar';
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
      return 'Procesando...';
    }

    return this.formatRelativeDate(message.next_execution);
  }

  /**
   * Track by function para ngFor
   */
  trackByMessageId(index: number, message: ScheduledMessage): number {
    return message.id;
  }
}
