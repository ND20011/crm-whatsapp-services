import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { DashboardService, BotQuota, DisabledBotConversation } from '../../services/dashboard.service';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { WhatsAppRealtimeService, WebSocketConnectionState } from '../../../../core/services/websocket.service';
import { WhatsAppConnectionModalComponent } from '../../../../shared/components/whatsapp-connection-modal/whatsapp-connection-modal.component';
import { PushNotificationManagerComponent } from '../../../../shared/components/push-notification-manager/push-notification-manager.component';
import { MessageStats, BotStatus, User, WhatsAppState } from '../../../../core/models/api.models';
import { APP_CONFIG } from '../../../../core/config/app.config';

/**
 * Componente principal del Dashboard
 * Muestra estadísticas y permite controlar el bot
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, WhatsAppConnectionModalComponent, PushNotificationManagerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private whatsappService = inject(WhatsAppService);
  private whatsappRealtimeService = inject(WhatsAppRealtimeService);
  private router = inject(Router);

  // Signals
  public isLoading = signal<boolean>(true);
  public isRefreshing = signal<boolean>(false);
  public isUpdatingBot = signal<boolean>(false);
  public messageStats = signal<MessageStats | null>(null);
  public botStatus = signal<BotStatus | null>(null);
  public botQuota = signal<BotQuota | null>(null);
  public whatsappState = signal<WhatsAppState | null>(null);
  public currentUser = signal<User | null>(null);
  public errorMessage = signal<string>('');
  public successMessage = signal<string>('');
  public showWhatsAppModal = signal<boolean>(false);
  public isRefreshingWhatsApp = signal<boolean>(false);
  public botGloballyEnabled = signal<boolean>(false);
  public isTogglingBot = signal<boolean>(false);
  
  // Signals para conversaciones con bot desactivado
  public disabledBotConversations = signal<DisabledBotConversation[]>([]);
  public selectedConversations = signal<Set<number>>(new Set());
  public isLoadingDisabledConversations = signal<boolean>(false);
  public showDisabledConversations = signal<boolean>(false);

  // Signal para controlar el desplegable de push notifications
  public showPushNotifications = signal<boolean>(false);

  // Subscriptions
  private refreshSubscription?: Subscription;
  private websocketSubscription?: Subscription;
  private statsSubscription?: Subscription;
  private whatsappRefreshSubscription?: Subscription;

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    this.loadDashboardData();
    this.loadWhatsAppStatus();
    this.initializeWebSocket();
    this.startAutoRefresh();
    this.startWhatsAppAutoRefresh();
    
    // Suscribirse al estado de WhatsApp
    this.whatsappService.whatsappState$.subscribe(state => {
      this.whatsappState.set(state);
    });

    // Configurar suscripciones WebSocket específicas para WhatsApp
    this.setupWhatsAppWebSocketSubscriptions();
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.whatsappRefreshSubscription?.unsubscribe();
    this.websocketSubscription?.unsubscribe();
    this.statsSubscription?.unsubscribe();
    
    // Desconectar WebSocket
    this.whatsappRealtimeService.disconnect();
  }

  /**
   * Configurar suscripciones WebSocket específicas para WhatsApp
   */
  private setupWhatsAppWebSocketSubscriptions(): void {
    // Suscribirse a conexión completada
    this.whatsappRealtimeService.onWhatsAppConnectionCompleted().subscribe(data => {
      console.log('📊 Dashboard: WhatsApp connection completed', data);
      if (data.success) {
        // Actualizar estado inmediatamente
        this.whatsappState.set({
          status: 'connected',
          connected: true,
          phoneNumber: data.phoneNumber,
          lastUpdated: new Date(),
          isLoading: false
        });
        
        // Recargar datos del dashboard para reflejar el cambio
        this.loadWhatsAppStatus();
        this.loadBotStatus();
        
        // Mostrar mensaje de éxito
        this.successMessage.set('WhatsApp conectado exitosamente');
      }
    });

    // Suscribirse a WhatsApp listo
    this.whatsappRealtimeService.onWhatsAppReady().subscribe(data => {
      console.log('📊 Dashboard: WhatsApp ready', data);
      this.whatsappState.set({
        status: 'connected',
        connected: true,
        phoneNumber: data.phoneNumber,
        lastUpdated: new Date(),
        isLoading: false
      });
      
      // Recargar datos
      this.loadWhatsAppStatus();
      this.loadBotStatus();
    });

    // Suscribirse a actualizaciones de estado
    this.whatsappRealtimeService.onWhatsAppStatusUpdated().subscribe(data => {
      console.log('📊 Dashboard: WhatsApp status updated', data);
      if (data.status === 'connected' && data.connected) {
        this.whatsappState.set({
          status: 'connected',
          connected: true,
          phoneNumber: data.phoneNumber,
          lastUpdated: new Date(),
          isLoading: false
        });
        
        // Recargar bot status para actualizar métricas
        this.loadBotStatus();
      }
    });

    // Suscribirse a desconexión
    this.whatsappRealtimeService.onWhatsAppDisconnected().subscribe(data => {
      console.log('📊 Dashboard: WhatsApp disconnected', data);
      this.whatsappState.set({
        status: 'disconnected',
        connected: false,
        phoneNumber: undefined,
        lastUpdated: new Date(),
        isLoading: false,
        error: data.reason || 'Desconectado'
      });
      
      // Recargar datos
      this.loadWhatsAppStatus();
      this.loadBotStatus();
      
      // Mostrar mensaje de error
      this.errorMessage.set('WhatsApp se ha desconectado');
    });
  }

  /**
   * Cargar datos del dashboard
   */
  loadDashboardData(): void {
    this.isLoading.set(true);
    this.clearMessages();

    // Cargar estadísticas, estado del bot y cuota en paralelo
    Promise.all([
      this.loadMessageStats(),
      this.loadBotStatus(),
      this.loadBotQuota()
    ]).finally(() => {
      this.isLoading.set(false);
    });
  }

  /**
   * Cargar estadísticas de mensajes
   */
  private loadMessageStats(): Promise<void> {
    return new Promise((resolve) => {
      this.dashboardService.getMessageStats().subscribe({
        next: (response) => {
          console.log('📊 Message stats response:', response);
          if (response.success && response.stats) {
            this.messageStats.set(response.stats);
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading message stats:', error);
          resolve();
        }
      });
    });
  }

  /**
   * Cargar estado del bot
   */
  private loadBotStatus(): Promise<void> {
    return new Promise((resolve) => {
      let botStatusLoaded = false;
      let botConfigLoaded = false;

      const checkComplete = () => {
        if (botStatusLoaded && botConfigLoaded) {
          resolve();
        }
      };

      // Cargar estado del bot
      this.dashboardService.getBotStatus().subscribe({
        next: (response) => {
          console.log('🤖 Bot status response:', response);
          if (response.success && response.bot_status) {
            this.botStatus.set(response.bot_status);
          }
          botStatusLoaded = true;
          checkComplete();
        },
        error: (error) => {
          console.error('Error loading bot status:', error);
          botStatusLoaded = true;
          checkComplete();
        }
      });

      // Cargar configuración del bot para obtener el estado global
      this.dashboardService.getBotConfiguration().subscribe({
        next: (response: any) => {
          console.log('🤖 Bot configuration response:', response);
          if (response.success && response.bot_config) {
            this.botGloballyEnabled.set(response.bot_config.is_enabled);
            console.log('🤖 Bot globally enabled set to:', response.bot_config.is_enabled);
          }
          botConfigLoaded = true;
          checkComplete();
        },
        error: (error: any) => {
          console.error('Error loading bot configuration:', error);
          // Por defecto asumimos que está habilitado si hay error
          this.botGloballyEnabled.set(true);
          console.log('🤖 Bot globally enabled set to default: true');
          botConfigLoaded = true;
          checkComplete();
        }
      });
    });
  }

  /**
   * Cargar cuota del bot
   */
  private loadBotQuota(): Promise<void> {
    return new Promise((resolve) => {
      this.dashboardService.getBotQuota().subscribe({
        next: (response) => {
          console.log('📊 Bot quota response:', response);
          if (response.success && response.quota) {
            this.botQuota.set(response.quota);
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading bot quota:', error);
          resolve();
        }
      });
    });
  }

  /**
   * Cargar estado de WhatsApp
   */
  private loadWhatsAppStatus(): void {
    this.whatsappService.getStatus().subscribe({
      next: (response) => {
        console.log('📱 WhatsApp status loaded:', response);
      },
      error: (error) => {
        console.error('❌ Error loading WhatsApp status:', error);
      }
    });
  }

  /**
   * Iniciar auto-refresh cada 30 segundos (SOLO como fallback si WebSocket falla)
   */
  private startAutoRefresh(): void {
    // Solo usar polling como fallback si WebSocket no está conectado
    this.refreshSubscription = interval(30000).subscribe(() => {
      if (!this.isWebSocketConnected()) {
        console.log('🔄 WebSocket desconectado, usando polling como fallback');
        this.refreshData();
      }
    });
  }

  /**
   * Iniciar auto-refresh de WhatsApp cada 10 segundos (SOLO como fallback)
   */
  private startWhatsAppAutoRefresh(): void {
    // Solo usar polling como fallback si WebSocket no está conectado
    this.whatsappRefreshSubscription = interval(10000).subscribe(() => {
      if (!this.isWebSocketConnected()) {
        console.log('🔄 WebSocket desconectado, usando polling de WhatsApp como fallback');
        this.refreshWhatsAppStatusSilently();
      }
    });
  }

  /**
   * Verificar si WebSocket está conectado
   */
  private isWebSocketConnected(): boolean {
    // Aquí puedes verificar el estado de conexión del WebSocket
    // Por ahora retornamos true para usar solo WebSocket
    return true; // Cambiar por this.whatsappRealtimeService.isConnected() cuando esté disponible
  }

  /**
   * Refrescar datos
   */
  refreshData(): void {
    this.isRefreshing.set(true);
    this.loadDashboardData();
    setTimeout(() => this.isRefreshing.set(false), 1000);
  }

  /**
   * Verificar si el bot está activo
   */
  isBotActive(): boolean {
    const status = this.botStatus();
    if (!status) return false;
    
    // Considerar activo si hay al menos una conversación con bot habilitado
    const enabledCount = parseInt(status.bot_enabled_conversations) || 0;
    return enabledCount > 0;
  }

  /**
   * Activar bot para todas las conversaciones
   */
  enableBotForAll(): void {
    this.isUpdatingBot.set(true);
    this.clearMessages();

    this.dashboardService.enableBotForAll().subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('Bot activado para todas las conversaciones');
          this.loadBotStatus();
        } else {
          this.errorMessage.set('Error al activar el bot');
        }
      },
      error: (error) => {
        this.errorMessage.set('Error al activar el bot: ' + error.message);
      },
      complete: () => {
        this.isUpdatingBot.set(false);
        this.clearMessagesAfterDelay();
      }
    });
  }

  /**
   * Desactivar bot para todas las conversaciones
   */
  disableBotForAll(): void {
    this.isUpdatingBot.set(true);
    this.clearMessages();

    this.dashboardService.disableBotForAll().subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('Bot desactivado para todas las conversaciones');
          this.loadBotStatus();
        } else {
          this.errorMessage.set('Error al desactivar el bot');
        }
      },
      error: (error) => {
        this.errorMessage.set('Error al desactivar el bot: ' + error.message);
      },
      complete: () => {
        this.isUpdatingBot.set(false);
        this.clearMessagesAfterDelay();
      }
    });
  }

  /**
   * Cargar conversaciones con bot desactivado
   */
  loadDisabledBotConversations(): void {
    this.isLoadingDisabledConversations.set(true);
    
    this.dashboardService.getDisabledBotConversations({ limit: 50 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.disabledBotConversations.set(response.data);
          this.selectedConversations.set(new Set());
        } else {
          this.errorMessage.set('Error al cargar conversaciones con bot desactivado');
        }
      },
      error: (error) => {
        this.errorMessage.set('Error al cargar conversaciones: ' + error.message);
      },
      complete: () => {
        this.isLoadingDisabledConversations.set(false);
      }
    });
  }

  /**
   * Mostrar/ocultar lista de conversaciones con bot desactivado
   */
  toggleDisabledConversations(): void {
    const currentState = this.showDisabledConversations();
    this.showDisabledConversations.set(!currentState);
    
    if (!currentState) {
      this.loadDisabledBotConversations();
    }
  }

  /**
   * Mostrar/ocultar panel de notificaciones push
   */
  togglePushNotifications(): void {
    const currentState = this.showPushNotifications();
    this.showPushNotifications.set(!currentState);
    console.log('🔔 Push notifications panel toggled:', !currentState);
  }

  /**
   * Seleccionar/deseleccionar conversación
   */
  toggleConversationSelection(conversationId: number): void {
    const selected = this.selectedConversations();
    const newSelected = new Set(selected);
    
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    
    this.selectedConversations.set(newSelected);
  }

  /**
   * Seleccionar/deseleccionar todas las conversaciones
   */
  toggleAllConversations(): void {
    const conversations = this.disabledBotConversations();
    const selected = this.selectedConversations();
    
    if (selected.size === conversations.length) {
      // Deseleccionar todas
      this.selectedConversations.set(new Set());
    } else {
      // Seleccionar todas
      const allIds = new Set(conversations.map(c => c.id));
      this.selectedConversations.set(allIds);
    }
  }

  /**
   * Reactivar bot para conversaciones seleccionadas
   */
  enableBotForSelectedConversations(): void {
    const selectedIds = Array.from(this.selectedConversations());
    
    if (selectedIds.length === 0) {
      this.errorMessage.set('Selecciona al menos una conversación');
      return;
    }

    this.isUpdatingBot.set(true);
    this.clearMessages();

    this.dashboardService.enableBotForConversations(selectedIds).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set(`Bot activado para ${selectedIds.length} conversaciones`);
          this.loadDisabledBotConversations(); // Recargar lista
          this.loadBotStatus(); // Actualizar estadísticas
        } else {
          this.errorMessage.set('Error al activar el bot para las conversaciones seleccionadas');
        }
      },
      error: (error) => {
        this.errorMessage.set('Error al activar el bot: ' + error.message);
      },
      complete: () => {
        this.isUpdatingBot.set(false);
        this.clearMessagesAfterDelay();
      }
    });
  }

  /**
   * Formatear fecha relativa
   */
  formatRelativeDate(dateString: string | null): string {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return `Hace ${Math.floor(diffDays / 30)} meses`;
  }

  /**
   * Ir al chat
   */
  goToChat(): void {
    this.router.navigate(['/chat']);
  }

  /**
   * Ir a mensajes masivos
   */
  goToBulkMessages(): void {
    this.router.navigate(['/bulk-messages']);
  }

  /**
   * Ir a contactos
   */
  goToContacts(): void {
    this.router.navigate(['/contacts']);
  }

  /**
   * Ir a templates
   */
  goToTemplates(): void {
    this.router.navigate(['/templates']);
  }

  /**
   * Conectar WhatsApp - Abrir modal
   */
  connectWhatsApp(): void {
    this.showWhatsAppModal.set(true);
    this.pauseWhatsAppAutoRefresh();
  }

  /**
   * Abrir modal de WhatsApp para escanear QR
   */
  openWhatsAppModal(): void {
    this.showWhatsAppModal.set(true);
    this.pauseWhatsAppAutoRefresh();
  }

  /**
   * Desconectar WhatsApp
   */
  disconnectWhatsApp(): void {
    this.clearMessages();
    this.whatsappService.disconnect().subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('WhatsApp desconectado exitosamente');
        } else {
          this.errorMessage.set('Error al desconectar WhatsApp');
        }
      },
      error: (error) => {
        this.errorMessage.set('Error al desconectar WhatsApp: ' + error.message);
      },
      complete: () => {
        this.clearMessagesAfterDelay();
      }
    });
  }

  /**
   * Forzar limpieza completa de WhatsApp
   */
  forceCleanupWhatsApp(): void {
    this.clearMessages();
    this.whatsappService.forceCleanup().subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage.set('Sesión de WhatsApp limpiada completamente. Ahora puedes reconectar escaneando el QR.');
          // Recargar el estado después de la limpieza
          setTimeout(() => {
            this.loadWhatsAppStatus();
          }, 1000);
        } else {
          this.errorMessage.set('Error al limpiar la sesión de WhatsApp');
        }
      },
      error: (error) => {
        this.errorMessage.set('Error al limpiar la sesión: ' + error.message);
      },
      complete: () => {
        this.clearMessagesAfterDelay();
      }
    });
  }

  /**
   * Alternar estado global del bot
   */
  toggleBotGlobally(): void {
    if (!confirm(`¿Estás seguro de que deseas ${this.botGloballyEnabled() ? 'DESHABILITAR' : 'HABILITAR'} el bot para TODOS los contactos?\n\nEsto afectará a todas las conversaciones existentes y futuras.`)) {
      return;
    }

    this.isTogglingBot.set(true);
    this.clearMessages();
    
    const sub = this.dashboardService.toggleBotGlobally().subscribe({
      next: (response) => {
        if (response.success) {
          const newStatus = response.data.is_enabled;
          this.botGloballyEnabled.set(newStatus);
          this.successMessage.set(response.message || `Bot ${newStatus ? 'habilitado' : 'deshabilitado'} globalmente`);
          
          // Recargar datos para reflejar los cambios
          this.loadBotStatus();
          this.loadMessageStats();
        } else {
          this.errorMessage.set(response.message || 'Error al cambiar el estado del bot');
        }
      },
      error: (error) => {
        this.errorMessage.set('Error al cambiar el estado del bot');
        console.error('Error:', error);
      },
      complete: () => {
        this.isTogglingBot.set(false);
        this.clearMessagesAfterDelay();
      }
    });

    // La suscripción se maneja automáticamente por el observable
  }

  /**
   * Refrescar estado de WhatsApp
   */
  refreshWhatsAppStatus(): void {
    this.loadWhatsAppStatus();
  }

  /**
   * Refrescar estado de WhatsApp silenciosamente (sin mostrar loading)
   */
  private refreshWhatsAppStatusSilently(): void {
    // Solo refrescar si no hay modal abierto y no está en proceso de conexión
    if (!this.showWhatsAppModal() && !this.isWhatsAppConnecting()) {
      this.isRefreshingWhatsApp.set(true);
      
      this.whatsappService.getStatus().subscribe({
        next: (response) => {
          // El estado se actualiza automáticamente via subscription
          console.log('🔄 WhatsApp status refreshed silently');
        },
        error: (error) => {
          console.error('❌ Silent WhatsApp refresh error:', error);
          // No mostrar errores en refresh silencioso
        },
        complete: () => {
          // Ocultar indicador después de un breve delay
          setTimeout(() => {
            this.isRefreshingWhatsApp.set(false);
          }, 500);
        }
      });
    }
  }

  /**
   * Obtener mensaje de estado de WhatsApp
   */
  getWhatsAppStatusMessage(): string {
    return this.whatsappService.getStatusMessage();
  }

  /**
   * Obtener color del estado de WhatsApp
   */
  getWhatsAppStatusColor(): string {
    return this.whatsappService.getStatusColor();
  }

  /**
   * Obtener estadísticas de WhatsApp
   */
  getWhatsAppStats() {
    return this.whatsappState()?.stats;
  }

  /**
   * Obtener total de mensajes del bot (combinando todas las fuentes)
   */
  getTotalBotMessages(): number {
    const regularBotMessages = parseInt(this.messageStats()?.bot_messages || '0') || 0;
    const whatsappBotMessages = parseInt(this.getWhatsAppStats()?.bot_messages || '0') || 0;
    return regularBotMessages + whatsappBotMessages;
  }

  /**
   * Obtener tiempo de última actividad formateado
   */
  getLastActivityTime(): string {
    const lastActivity = this.whatsappState()?.session?.last_activity;
    if (!lastActivity) return '';
    
    const date = new Date(lastActivity);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  }

  /**
   * Obtener tiempo desde conexión formateado
   */
  getConnectedSince(): string {
    const connectedAt = this.whatsappState()?.session?.connected_at;
    if (!connectedAt) return '';
    
    const date = new Date(connectedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} minutos`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} horas`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 día';
    return `${diffDays} días`;
  }

  /**
   * Verificar si puede conectar WhatsApp
   */
  canConnectWhatsApp(): boolean {
    return this.whatsappService.canConnect();
  }

  /**
   * Verificar si puede desconectar WhatsApp
   */
  canDisconnectWhatsApp(): boolean {
    return this.whatsappService.canDisconnect();
  }

  /**
   * Verificar si puede hacer force cleanup de WhatsApp
   * Se muestra cuando el estado es 'error' o 'initializing' con problemas
   */
  canForceCleanupWhatsApp(): boolean {
    const state = this.whatsappState();
    if (!state) return false;
    
    // Mostrar force cleanup cuando:
    // 1. El estado es 'error'
    // 2. El estado es 'initializing' pero no está cargando (stuck)
    // 3. El session status es 'error'
    return state.status === 'error' || 
           state.session?.status === 'error' ||
           (state.status === 'initializing' && !state.isLoading);
  }

  /**
   * Verificar si WhatsApp está conectado
   */
  isWhatsAppConnected(): boolean {
    return this.whatsappService.isConnected();
  }

  /**
   * Verificar si WhatsApp está en proceso de conexión
   */
  private isWhatsAppConnecting(): boolean {
    const status = this.whatsappService.getCurrentStatus();
    return ['initializing', 'connecting'].includes(status);
  }

  /**
   * Cerrar modal de WhatsApp
   */
  closeWhatsAppModal(): void {
    this.showWhatsAppModal.set(false);
    this.resumeWhatsAppAutoRefresh();
  }

  /**
   * Manejar conexión exitosa de WhatsApp
   */
  onWhatsAppConnected(): void {
    this.successMessage.set('¡WhatsApp conectado exitosamente!');
    this.showWhatsAppModal.set(false);
    this.loadWhatsAppStatus();
    this.clearMessagesAfterDelay();
  }

  /**
   * Manejar error de conexión de WhatsApp
   */
  onWhatsAppError(error: string): void {
    this.errorMessage.set('Error de WhatsApp: ' + error);
    this.clearMessagesAfterDelay();
  }

  /**
   * Pausar auto-refresh de WhatsApp
   */
  private pauseWhatsAppAutoRefresh(): void {
    console.log('⏸️ Pausing WhatsApp auto-refresh');
    this.whatsappRefreshSubscription?.unsubscribe();
  }

  /**
   * Reanudar auto-refresh de WhatsApp
   */
  private resumeWhatsAppAutoRefresh(): void {
    console.log('▶️ Resuming WhatsApp auto-refresh');
    this.startWhatsAppAutoRefresh();
  }

  /**
   * Cerrar sesión
   */
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        console.log('✅ Logout successful');
      },
      error: (error) => {
        console.error('❌ Logout error:', error);
        // Incluso si falla, hacer logout local
        this.authService.logoutImmediate();
      }
    });
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
    }, APP_CONFIG.ui.toastDuration);
  }

  // ============================================================================
  // WEBSOCKET METHODS
  // ============================================================================

  /**
   * Inicializar conexión WebSocket para actualizaciones en tiempo real
   */
  private initializeWebSocket(): void {
    this.websocketSubscription = this.whatsappRealtimeService.connect().subscribe({
      next: (state) => {
        console.log('Dashboard WebSocket state:', state);
        
        if (state === WebSocketConnectionState.CONNECTED) {
          console.log('✅ Dashboard WebSocket conectado - Estadísticas en tiempo real activas');
          this.subscribeToRealtimeStats();
        } else if (state === WebSocketConnectionState.DISCONNECTED) {
          console.log('❌ Dashboard WebSocket desconectado - Usando polling como fallback');
        }
      },
      error: (error) => {
        console.error('Error en Dashboard WebSocket:', error);
      }
    });
  }

  /**
   * Suscribirse a actualizaciones de estadísticas en tiempo real
   */
  private subscribeToRealtimeStats(): void {
    // Escuchar actualizaciones de estadísticas de mensajes
    this.statsSubscription = this.whatsappRealtimeService.onMessage('stats_updated').subscribe({
      next: (data: any) => {
        console.log('📊 Estadísticas actualizadas en tiempo real:', data);
        this.handleStatsUpdate(data);
      },
      error: (error: any) => {
        console.error('Error procesando actualización de estadísticas:', error);
      }
    });

    // Escuchar cambios de estado del bot
    this.whatsappRealtimeService.onMessage('bot_status_changed').subscribe({
      next: (data: any) => {
        console.log('🤖 Estado del bot actualizado:', data);
        this.handleBotStatusUpdate(data);
      },
      error: (error: any) => {
        console.error('Error procesando cambio de estado del bot:', error);
      }
    });

    // Escuchar cambios de estado de WhatsApp
    this.whatsappRealtimeService.onMessage('whatsapp_status_changed').subscribe({
      next: (data: any) => {
        console.log('📱 Estado de WhatsApp actualizado:', data);
        this.handleWhatsAppStatusUpdate(data);
      },
      error: (error: any) => {
        console.error('Error procesando cambio de estado de WhatsApp:', error);
      }
    });

    // Escuchar nuevos mensajes para actualizar contadores
    this.whatsappRealtimeService.onMessage('new_message').subscribe({
      next: (data: any) => {
        console.log('📨 Nuevo mensaje - Actualizando estadísticas:', data);
        this.handleNewMessageForStats(data);
      },
      error: (error: any) => {
        console.error('Error procesando nuevo mensaje para estadísticas:', error);
      }
    });
  }

  /**
   * Manejar actualización de estadísticas
   */
  private handleStatsUpdate(data: any): void {
    if (data.stats) {
      const updatedStats: MessageStats = data.stats;
      this.messageStats.set(updatedStats);
      
      // Mostrar notificación visual sutil
      this.showStatsUpdateIndicator();
    }
  }

  /**
   * Manejar actualización de estado del bot
   */
  private handleBotStatusUpdate(data: any): void {
    if (data.botStatus) {
      const updatedBotStatus: BotStatus = data.botStatus;
      this.botStatus.set(updatedBotStatus);
    }
  }

  /**
   * Manejar actualización de estado de WhatsApp
   */
  private handleWhatsAppStatusUpdate(data: any): void {
    if (data.whatsappState) {
      const updatedState: WhatsAppState = data.whatsappState;
      this.whatsappState.set(updatedState);
    }
  }

  /**
   * Manejar nuevo mensaje para actualizar estadísticas
   */
  private handleNewMessageForStats(data: any): void {
    const currentStats = this.messageStats();
    if (currentStats) {
      // Incrementar contadores según el tipo de mensaje
      const isFromBot = data.message?.is_from_bot || data.message?.sender_type === 'bot';
      
      const updatedStats: MessageStats = {
        ...currentStats,
        total_messages: currentStats.total_messages + 1,
        unread_messages: data.message?.from_me === 0 ? currentStats.unread_messages + 1 : currentStats.unread_messages,
        bot_messages: isFromBot ? currentStats.bot_messages + 1 : currentStats.bot_messages,
        // Actualizar otros campos según sea necesario
      };
      
      this.messageStats.set(updatedStats);
      this.showStatsUpdateIndicator();
    }
  }

  /**
   * Mostrar indicador visual de actualización de estadísticas
   */
  private showStatsUpdateIndicator(): void {
    // Agregar clase CSS temporal para mostrar que las estadísticas se actualizaron
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    dashboardCards.forEach(card => {
      card.classList.add('stats-updated');
      setTimeout(() => {
        card.classList.remove('stats-updated');
      }, 1000);
    });
  }

  /**
   * Obtener clase CSS para el estado de la cuota
   */
  getQuotaStatusClass(): string {
    const quota = this.botQuota();
    if (!quota) return 'normal';
    
    if (quota.status === 'exceeded') return 'exceeded';
    if (quota.percentage > 90) return 'critical';
    if (quota.percentage > 75) return 'warning';
    return 'normal';
  }

  /**
   * Obtener clase CSS para el estado de la cuota de tokens
   */
  getTokenQuotaStatusClass(): string {
    const quota = this.botQuota();
    if (!quota) return 'normal';
    
    const tokenPercentage = quota.tokenPercentage || 0;
    const tokensAvailable = quota.limits?.tokens?.available;
    
    if (tokensAvailable === false) return 'exceeded';
    if (tokenPercentage > 90) return 'critical';
    if (tokenPercentage > 75) return 'warning';
    return 'normal';
  }
}
