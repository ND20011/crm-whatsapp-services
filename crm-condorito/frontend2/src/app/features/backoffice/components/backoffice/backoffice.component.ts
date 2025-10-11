import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { BackofficeService, BackofficeClient, SystemStats, SystemStatsResponse, BackofficeClientsResponse, WhatsAppReconnectResponse, WhatsAppStatusResponse } from '../../services/backoffice.service';
import { ApiResponse } from '../../../../core/models/api.models';

/**
 * Componente principal del Backoffice
 * Administración de usuarios y cuotas del sistema
 */
@Component({
  selector: 'app-backoffice',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './backoffice.component.html',
  styleUrl: './backoffice.component.scss'
})
export class BackofficeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private backofficeService = inject(BackofficeService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  // Signals
  public isLoading = signal<boolean>(true);
  public isLoadingClients = signal<boolean>(false);
  public systemStats = signal<SystemStats | null>(null);
  public clients = signal<BackofficeClient[]>([]);
  public currentPage = signal<number>(1);
  public totalPages = signal<number>(1);
  public totalClients = signal<number>(0);
  public searchQuery = signal<string>('');
  public statusFilter = signal<string>('');
  public errorMessage = signal<string>('');
  public successMessage = signal<string>('');
  
  // Modal states
  public showCreateModal = signal<boolean>(false);
  public showEditModal = signal<boolean>(false);
  public showQuotaModal = signal<boolean>(false);
  public showDeleteModal = signal<boolean>(false);
  public showReportsModal = signal<boolean>(false);
  public showConfigModal = signal<boolean>(false);
  public showWhatsAppModal = signal<boolean>(false);
  public selectedClient = signal<BackofficeClient | null>(null);
  public isSubmitting = signal<boolean>(false);
  
  // WhatsApp management
  public whatsappStatus = signal<WhatsAppStatusResponse | null>(null);
  public whatsappReconnectResult = signal<WhatsAppReconnectResponse | null>(null);
  public isReconnectingWhatsApp = signal<boolean>(false);
  
  // Advanced features
  public realTimeMetrics = signal<any>(null);
  public systemConfig = signal<any>(null);
  public reports = signal<any>(null);
  public autoRefresh = signal<boolean>(true);
  private refreshInterval: any;
  
  // Forms
  public createForm: FormGroup;
  public editForm: FormGroup;

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor() {
    // Inicializar formularios
    this.createForm = this.formBuilder.group({
      client_code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      company_name: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.email]],
      phone: [''],
      monthly_bot_limit: [2500, [Validators.required, Validators.min(0)]],
      monthly_token_limit: [100000, [Validators.required, Validators.min(0)]]
    });

    this.editForm = this.formBuilder.group({
      company_name: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.email]],
      phone: [''],
      status: ['', [Validators.required]],
      monthly_bot_limit: [0, [Validators.required, Validators.min(0)]],
      monthly_token_limit: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    // Verificar que el usuario sea administrador
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || currentUser.company_name !== 'Admin') {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Cargar preferencia de vista desde localStorage
    const savedViewMode = localStorage.getItem('backoffice-view-mode') as 'grid' | 'table';
    if (savedViewMode) {
      this.viewMode.set(savedViewMode);
    }

    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  /**
   * Cargar datos iniciales
   */
  private loadInitialData(): void {
    this.loadSystemStats();
    this.loadClients();
    this.loadSystemConfig();
    this.setupAutoRefresh();
  }

  /**
   * Cargar estadísticas del sistema
   */
  loadSystemStats(): void {
    const sub = this.backofficeService.getSystemStats().subscribe({
      next: (response: SystemStatsResponse) => {
        if (response.success) {
          this.systemStats.set(response.stats);
        } else {
          this.errorMessage.set('Error al cargar estadísticas del sistema');
        }
      },
      error: (error: any) => {
        this.errorMessage.set('Error al cargar estadísticas: ' + error.message);
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Cargar lista de clientes
   */
  loadClients(page: number = 1): void {
    this.isLoadingClients.set(true);
    this.currentPage.set(page);
    
    const params = {
      page,
      limit: 20,
      ...(this.searchQuery() && { search: this.searchQuery() }),
      ...(this.statusFilter() && { status: this.statusFilter() })
    };

    const sub = this.backofficeService.getClients(params).subscribe({
      next: (response: BackofficeClientsResponse) => {
        if (response.success) {
          this.clients.set(response.data);
          this.totalPages.set(response.pagination.totalPages);
          this.totalClients.set(response.pagination.total);
        } else {
          this.errorMessage.set('Error al cargar clientes');
        }
      },
      error: (error: any) => {
        this.errorMessage.set('Error al cargar clientes: ' + error.message);
      },
      complete: () => {
        this.isLoadingClients.set(false);
        this.isLoading.set(false);
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Buscar clientes
   */
  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.loadClients(1);
  }

  /**
   * Filtrar por estado
   */
  onStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.loadClients(1);
  }

  /**
   * Abrir modal de crear cliente
   */
  openCreateModal(): void {
    this.createForm.reset({
      client_code: '',
      password: '',
      company_name: '',
      email: '',
      phone: '',
      monthly_bot_limit: 1000,
      monthly_token_limit: 10000
    });
    this.showCreateModal.set(true);
  }

  /**
   * Abrir modal de editar cliente
   */
  openEditModal(client: BackofficeClient): void {
    this.selectedClient.set(client);
    this.editForm.patchValue({
      company_name: client.company_name,
      email: client.email,
      phone: client.phone,
      status: client.status,
      monthly_bot_limit: client.monthly_bot_limit,
      monthly_token_limit: client.monthly_token_limit
    });
    this.showEditModal.set(true);
  }

  /**
   * Abrir modal de gestión de cuotas
   */
  openQuotaModal(client: BackofficeClient): void {
    this.selectedClient.set(client);
    this.showQuotaModal.set(true);
  }

  /**
   * Crear nuevo cliente
   */
  createClient(): void {
    if (this.createForm.invalid) {
      this.markFormGroupTouched(this.createForm);
      return;
    }

    this.isSubmitting.set(true);
    
    const sub = this.backofficeService.createClient(this.createForm.value).subscribe({
      next: (response: ApiResponse<any>) => {
        if (response.success) {
          this.successMessage.set('Cliente creado exitosamente');
          this.showCreateModal.set(false);
          this.loadClients(this.currentPage());
          this.loadSystemStats();
        } else {
          this.errorMessage.set(response.message || 'Error al crear cliente');
        }
      },
      error: (error: any) => {
        this.errorMessage.set('Error al crear cliente: ' + error.message);
      },
      complete: () => {
        this.isSubmitting.set(false);
        this.clearMessagesAfterDelay();
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Actualizar cliente
   */
  updateClient(): void {
    if (this.editForm.invalid || !this.selectedClient()) {
      this.markFormGroupTouched(this.editForm);
      return;
    }

    this.isSubmitting.set(true);
    
    const sub = this.backofficeService.updateClient(
      this.selectedClient()!.id,
      this.editForm.value
    ).subscribe({
      next: (response: ApiResponse<any>) => {
        if (response.success) {
          this.successMessage.set('Cliente actualizado exitosamente');
          this.showEditModal.set(false);
          this.loadClients(this.currentPage());
          this.loadSystemStats();
        } else {
          this.errorMessage.set(response.message || 'Error al actualizar cliente');
        }
      },
      error: (error: any) => {
        this.errorMessage.set('Error al actualizar cliente: ' + error.message);
      },
      complete: () => {
        this.isSubmitting.set(false);
        this.clearMessagesAfterDelay();
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Resetear cuotas de cliente
   */
  resetQuota(type: 'bot' | 'token' | 'both'): void {
    if (!this.selectedClient()) return;

    this.isSubmitting.set(true);
    
    const sub = this.backofficeService.resetClientQuota(
      this.selectedClient()!.id,
      type
    ).subscribe({
      next: (response: ApiResponse<any>) => {
        if (response.success) {
          this.successMessage.set(`Cuota ${type === 'both' ? 'de bot y tokens' : type === 'bot' ? 'de bot' : 'de tokens'} reseteada exitosamente`);
          this.showQuotaModal.set(false);
          this.loadClients(this.currentPage());
          this.loadSystemStats();
        } else {
          this.errorMessage.set(response.message || 'Error al resetear cuota');
        }
      },
      error: (error: any) => {
        this.errorMessage.set('Error al resetear cuota: ' + error.message);
      },
      complete: () => {
        this.isSubmitting.set(false);
        this.clearMessagesAfterDelay();
      }
    });
    
    this.subscriptions.push(sub);
  }


  /**
   * Obtener clase CSS para el estado del cliente
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'badge bg-success';
      case 'inactive': return 'badge bg-secondary';
      case 'suspended': return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  }

  /**
   * Obtener clase CSS para el porcentaje de uso
   */
  getUsageClass(percentage: number): string {
    if (percentage >= 90) return 'text-danger fw-bold';
    if (percentage >= 75) return 'text-warning fw-bold';
    return 'text-success';
  }

  /**
   * Formatear fecha
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-AR');
  }

  /**
   * Obtener fecha relativa (hace X días)
   */
  getRelativeDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Hace 1 día';
    if (diffDays < 30) return `Hace ${diffDays} días`;
    if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
    return `Hace ${Math.floor(diffDays / 365)} años`;
  }

  /**
   * Obtener icono para el estado
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'active': return 'fa-check-circle';
      case 'inactive': return 'fa-pause-circle';
      case 'suspended': return 'fa-ban';
      default: return 'fa-question-circle';
    }
  }

  /**
   * Obtener texto para el estado
   */
  getStatusText(status: string): string {
    switch (status) {
      case 'active': return 'Activo';
      case 'inactive': return 'Inactivo';
      case 'suspended': return 'Suspendido';
      default: return 'Desconocido';
    }
  }

  /**
   * Obtener clase para la barra de progreso
   */
  getProgressBarClass(percentage: number): string {
    if (percentage >= 95) return 'progress-bar bg-danger';
    if (percentage >= 80) return 'progress-bar bg-warning';
    if (percentage >= 60) return 'progress-bar bg-info';
    return 'progress-bar bg-success';
  }

  /**
   * Ordenar tabla por columna
   */
  sortBy(column: string): void {
    // Implementar lógica de ordenamiento
    console.log('Sorting by:', column);
    // Por ahora solo log, se puede implementar la lógica completa después
  }

  /**
   * Ver detalles del cliente
   */
  viewClientDetails(client: any): void {
    // Abrir modal con detalles completos del cliente
    console.log('Viewing client details:', client);
    // Se puede implementar un modal de detalles después
  }

  // ============================================================================
  // VIEW MODE METHODS (siguiendo el patrón de contact-list)
  // ============================================================================

  /**
   * Signal para el modo de vista (grid/table)
   */
  public viewMode = signal<'grid' | 'table'>('table');

  /**
   * Establecer modo de vista
   */
  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode.set(mode);
    // Guardar preferencia en localStorage
    localStorage.setItem('backoffice-view-mode', mode);
  }

  /**
   * Limpiar filtros
   */
  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('');
    this.loadClients(1);
  }

  /**
   * Obtener iniciales del cliente
   */
  getClientInitials(client: any): string {
    if (client.client_code) {
      return client.client_code.substring(0, 2).toUpperCase();
    }
    if (client.company_name) {
      const words = client.company_name.split(' ');
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      return client.company_name.substring(0, 2).toUpperCase();
    }
    return 'CL';
  }


  /**
   * Ir al dashboard normal
   */
  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Logout
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Limpiar mensajes
   */
  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  /**
   * Limpiar mensajes después de un delay
   */
  private clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.clearMessages();
    }, 5000);
  }

  /**
   * Marcar todos los campos del formulario como touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  // ============================================================================
  // ADVANCED FEATURES
  // ============================================================================

  /**
   * Configurar actualización automática
   */
  private setupAutoRefresh(): void {
    if (this.autoRefresh()) {
      this.refreshInterval = setInterval(() => {
        this.loadSystemStats();
        this.loadRealTimeMetrics();
      }, 30000); // Actualizar cada 30 segundos
    }
  }

  /**
   * Alternar actualización automática
   */
  toggleAutoRefresh(): void {
    this.autoRefresh.set(!this.autoRefresh());
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    if (this.autoRefresh()) {
      this.setupAutoRefresh();
    }
  }

  /**
   * Cargar métricas en tiempo real
   */
  loadRealTimeMetrics(): void {
    const sub = this.backofficeService.getRealTimeMetrics().subscribe({
      next: (response) => {
        if (response.success) {
          this.realTimeMetrics.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error loading real-time metrics:', error);
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Cargar configuración del sistema
   */
  loadSystemConfig(): void {
    const sub = this.backofficeService.getSystemConfig().subscribe({
      next: (response) => {
        if (response.success) {
          this.systemConfig.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error loading system config:', error);
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Abrir modal de eliminación
   */
  openDeleteModal(client: BackofficeClient): void {
    this.selectedClient.set(client);
    this.showDeleteModal.set(true);
  }

  /**
   * Eliminar cliente
   */
  deleteClient(): void {
    if (!this.selectedClient()) return;

    this.isSubmitting.set(true);
    
    const sub = this.backofficeService.deleteClient(this.selectedClient()!.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('Cliente eliminado exitosamente');
          this.showDeleteModal.set(false);
          this.loadClients(this.currentPage());
          this.loadSystemStats();
        } else {
          this.errorMessage.set(response.message || 'Error al eliminar cliente');
        }
      },
      error: (error) => {
        this.errorMessage.set('Error al eliminar cliente: ' + error.message);
      },
      complete: () => {
        this.isSubmitting.set(false);
        this.clearMessagesAfterDelay();
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Abrir modal de reportes
   */
  openReportsModal(): void {
    this.showReportsModal.set(true);
    this.loadReports();
  }

  /**
   * Cargar reportes
   */
  loadReports(): void {
    const sub = this.backofficeService.getSystemReports().subscribe({
      next: (response) => {
        if (response.success) {
          this.reports.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error loading reports:', error);
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Exportar clientes
   */
  exportClients(format: 'csv' | 'excel' = 'csv'): void {
    const sub = this.backofficeService.exportClients(format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `clientes_${new Date().toISOString().split('T')[0]}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        this.successMessage.set(`Clientes exportados exitosamente en formato ${format.toUpperCase()}`);
        this.clearMessagesAfterDelay();
      },
      error: (error) => {
        this.errorMessage.set('Error al exportar clientes: ' + error.message);
        this.clearMessagesAfterDelay();
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Ejecutar mantenimiento del sistema
   */
  runMaintenance(type: 'cleanup' | 'optimize' | 'backup'): void {
    this.isSubmitting.set(true);
    
    const sub = this.backofficeService.runSystemMaintenance(type).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set(`Mantenimiento ${type} ejecutado exitosamente`);
          this.loadSystemStats();
        } else {
          this.errorMessage.set(response.message || `Error al ejecutar mantenimiento ${type}`);
        }
      },
      error: (error) => {
        this.errorMessage.set(`Error al ejecutar mantenimiento: ${error.message}`);
      },
      complete: () => {
        this.isSubmitting.set(false);
        this.clearMessagesAfterDelay();
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Resetear cuotas mensuales de todos los clientes
   */
  resetMonthlyQuotas(): void {
    if (!confirm('¿Estás seguro de que deseas resetear las cuotas mensuales de TODOS los clientes?\n\nEsta acción:\n• Pondrá en 0 el uso actual de bot y tokens\n• Actualizará la fecha de reset\n• Afectará a todos los clientes activos\n\nEsta acción no se puede deshacer.')) {
      return;
    }

    this.isSubmitting.set(true);
    
    const sub = this.backofficeService.resetMonthlyQuotas().subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set(response.message || 'Cuotas mensuales reseteadas correctamente');
          // Recargar datos para mostrar los cambios
          this.loadSystemStats();
          this.loadClients();
        } else {
          this.errorMessage.set(response.message || 'Error al resetear las cuotas mensuales');
        }
      },
      error: (error) => {
        this.errorMessage.set(`Error al resetear cuotas mensuales: ${error.message}`);
      },
      complete: () => {
        this.isSubmitting.set(false);
        this.clearMessagesAfterDelay();
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Obtener clase CSS para el estado del sistema
   */
  getSystemHealthClass(): string {
    const stats = this.systemStats();
    if (!stats) return 'text-secondary';
    
    const totalUsage = stats.bot_usage.avg_bot_usage_percentage + stats.token_usage.avg_token_usage_percentage;
    
    if (totalUsage < 100) return 'text-success';
    if (totalUsage < 150) return 'text-warning';
    return 'text-danger';
  }

  /**
   * Obtener estado del sistema
   */
  getSystemHealthStatus(): string {
    const stats = this.systemStats();
    if (!stats) return 'Cargando...';
    
    const totalUsage = stats.bot_usage.avg_bot_usage_percentage + stats.token_usage.avg_token_usage_percentage;
    
    if (totalUsage < 100) return 'Óptimo';
    if (totalUsage < 150) return 'Moderado';
    return 'Crítico';
  }

  /**
   * Cerrar todos los modales
   */
  closeModals(): void {
    this.showCreateModal.set(false);
    this.showEditModal.set(false);
    this.showQuotaModal.set(false);
    this.showDeleteModal.set(false);
    this.showReportsModal.set(false);
    this.showConfigModal.set(false);
    this.showWhatsAppModal.set(false);
    this.selectedClient.set(null);
  }

  // ============================================================================
  // WHATSAPP MANAGEMENT METHODS
  // ============================================================================

  /**
   * Abrir modal de gestión de WhatsApp
   */
  openWhatsAppModal(): void {
    this.showWhatsAppModal.set(true);
    this.loadWhatsAppStatus();
  }

  /**
   * Cargar estado de WhatsApp de todos los clientes
   */
  loadWhatsAppStatus(): void {
    const sub = this.backofficeService.getAllWhatsAppStatus().subscribe({
      next: (response) => {
        this.whatsappStatus.set(response);
      },
      error: (error) => {
        console.error('Error loading WhatsApp status:', error);
        this.errorMessage.set('Error al cargar estado de WhatsApp');
        this.clearMessagesAfterDelay();
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Reconectar todas las sesiones de WhatsApp
   */
  reconnectAllWhatsApp(): void {
    if (!confirm(
      '¿Estás seguro de que deseas reconectar TODAS las sesiones de WhatsApp?\n\n' +
      'Esta operación:\n' +
      '• Intentará conectar todos los clientes activos\n' +
      '• Puede tardar 30-60 segundos en completarse\n' +
      '• Procesará los clientes uno por uno\n\n' +
      'Se recomienda usar después de reiniciar el servidor.'
    )) {
      return;
    }

    this.isReconnectingWhatsApp.set(true);
    this.whatsappReconnectResult.set(null);

    const sub = this.backofficeService.reconnectAllWhatsApp().subscribe({
      next: (response) => {
        this.whatsappReconnectResult.set(response);
        
        if (response.success) {
          const { successful, failed, skipped, total_clients } = response.summary;
          this.successMessage.set(
            `Reconexión completada: ${successful} exitosos, ${failed} fallidos, ${skipped} omitidos de ${total_clients} clientes`
          );
          
          // Recargar estado de WhatsApp
          this.loadWhatsAppStatus();
        } else {
          this.errorMessage.set(response.message || 'Error durante la reconexión');
        }
      },
      error: (error) => {
        console.error('Error reconnecting WhatsApp:', error);
        this.errorMessage.set(`Error durante la reconexión: ${error.message}`);
      },
      complete: () => {
        this.isReconnectingWhatsApp.set(false);
        this.clearMessagesAfterDelay();
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Desconectar todas las sesiones de WhatsApp
   */
  disconnectAllWhatsApp(): void {
    if (!confirm(
      '¿Estás seguro de que deseas desconectar TODAS las sesiones de WhatsApp?\n\n' +
      'Esta operación:\n' +
      '• Desconectará todos los clientes inmediatamente\n' +
      '• Los usuarios tendrán que volver a conectar manualmente\n' +
      '• Es útil para mantenimiento del sistema\n\n' +
      'Esta acción afectará a todos los clientes.'
    )) {
      return;
    }

    this.isSubmitting.set(true);

    const sub = this.backofficeService.disconnectAllWhatsApp().subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('Todas las sesiones de WhatsApp han sido desconectadas');
          this.loadWhatsAppStatus(); // Recargar estado
        } else {
          this.errorMessage.set(response.message || 'Error al desconectar sesiones');
        }
      },
      error: (error) => {
        console.error('Error disconnecting WhatsApp:', error);
        this.errorMessage.set(`Error al desconectar: ${error.message}`);
      },
      complete: () => {
        this.isSubmitting.set(false);
        this.clearMessagesAfterDelay();
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Obtener clase CSS para el estado de WhatsApp
   */
  getWhatsAppStatusClass(connected: boolean): string {
    return connected ? 'text-success' : 'text-danger';
  }

  /**
   * Obtener texto del estado de WhatsApp
   */
  getWhatsAppStatusText(connected: boolean): string {
    return connected ? 'Conectado' : 'Desconectado';
  }

  /**
   * Obtener clase CSS para el resultado de reconexión
   */
  getReconnectStatusClass(status: string): string {
    switch (status) {
      case 'success': return 'text-success';
      case 'failed': return 'text-danger';
      case 'skipped': return 'text-warning';
      default: return 'text-muted';
    }
  }
}
