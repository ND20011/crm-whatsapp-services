import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter, interval, Subscription } from 'rxjs';
import { AuthService } from '../../../features/auth/services/auth.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { DashboardService } from '../../../features/dashboard/services/dashboard.service';
import { WhatsAppRealtimeService, WebSocketConnectionState } from '../../../core/services/websocket.service';
import { MessageStats } from '../../../core/models/api.models';

interface BreadcrumbItem {
  label: string;
  route?: string;
  icon?: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route?: string;
  action?: () => void;
  badge?: string;
  badgeColor?: string;
}

@Component({
  selector: 'app-header-nav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header-nav.component.html',
  styleUrls: ['./header-nav.component.scss']
})
export class HeaderNavComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  public sidebarService = inject(SidebarService); // Público para uso en template
  private dashboardService = inject(DashboardService);
  private whatsappRealtimeService = inject(WhatsAppRealtimeService);

  // ============================================================================
  // SIGNALS
  // ============================================================================

  public currentRoute = signal<string>('');
  public pageTitle = signal<string>('Dashboard');
  public breadcrumbs = signal<BreadcrumbItem[]>([]);
  public userInfo = signal<any>(null);
  public messageStats = signal<MessageStats | null>(null);
  public isUserMenuOpen = signal<boolean>(false);

  // ============================================================================
  // COMPUTED
  // ============================================================================

  public notifications = computed<number>(() => {
    const unreadCountStr = this.messageStats()?.unread_messages || '0';
    return parseInt(unreadCountStr, 10) || 0;
  });

  public quickActions = computed<QuickAction[]>(() => [
    {
      id: 'chat',
      label: 'Chat',
      icon: 'chat',
      route: '/chat',
      badge: this.getUnreadMessagesCount(),
      badgeColor: 'primary'
    },
    {
      id: 'bulk-messages',
      label: 'Envío Masivo',
      icon: 'broadcast',
      route: '/bulk-messages'
    },
    {
      id: 'new-template',
      label: 'Nuevo Template',
      icon: 'add',
      route: '/templates/create'
    },
    {
      id: 'whatsapp-status',
      label: 'WhatsApp',
      icon: 'whatsapp',
      route: '/dashboard',
      badge: 'ON',
      badgeColor: 'success'
    }
  ]);

  public isMobile = this.sidebarService.isMobile;

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  private statsSubscription?: Subscription;
  private statsRefreshSubscription?: Subscription;
  private websocketSubscription?: Subscription;
  private realtimeSubscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    this.loadUserInfo();
    this.setupRouterSubscription();
    this.updatePageInfo(this.router.url);
    this.loadMessageStats();
    this.setupStatsRefresh();
    this.initializeWebSocket();
  }

  ngOnDestroy(): void {
    this.statsSubscription?.unsubscribe();
    this.statsRefreshSubscription?.unsubscribe();
    this.websocketSubscription?.unsubscribe();
    this.realtimeSubscriptions.forEach(sub => sub.unsubscribe());
    
    // Desconectar WebSocket
    this.whatsappRealtimeService.disconnect();
  }

  // ============================================================================
  // SETUP METHODS
  // ============================================================================

  private setupRouterSubscription(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute.set(event.url);
        this.updatePageInfo(event.url);
      });
  }

  private loadUserInfo(): void {
    const user = this.authService.getCurrentUser();
    this.userInfo.set(user);
  }

  /**
   * Cargar estadísticas de mensajes
   */
  private loadMessageStats(): void {
    this.statsSubscription = this.dashboardService.getMessageStats().subscribe({
      next: (response) => {
        if (response.success) {
          this.messageStats.set(response.stats);
        }
      },
      error: (error) => {
        console.error('Error loading message stats in header:', error);
        // En caso de error, mantener el valor actual o null
      }
    });
  }

  /**
   * Configurar actualización automática de estadísticas cada 30 segundos
   */
  private setupStatsRefresh(): void {
    this.statsRefreshSubscription = interval(30000).subscribe(() => {
      this.loadMessageStats();
    });
  }

  /**
   * Obtener cantidad de mensajes sin leer para el badge
   */
  private getUnreadMessagesCount(): string {
    const unreadCountStr = this.messageStats()?.unread_messages || '0';
    const unreadCount = parseInt(unreadCountStr, 10) || 0;
    
    if (unreadCount === 0) {
      return ''; // No mostrar badge si no hay mensajes sin leer
    }
    if (unreadCount > 99) {
      return '99+'; // Mostrar 99+ si hay más de 99 mensajes
    }
    return unreadCount.toString();
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
        console.log('Header WebSocket state:', state);
        
        if (state === WebSocketConnectionState.CONNECTED) {
          console.log('✅ Header WebSocket conectado - Badges en tiempo real activos');
          this.subscribeToRealtimeStats();
        } else if (state === WebSocketConnectionState.DISCONNECTED) {
          console.log('❌ Header WebSocket desconectado - Usando polling como fallback');
        }
      },
      error: (error) => {
        console.error('Error en Header WebSocket:', error);
      }
    });
  }

  /**
   * Suscribirse a eventos de estadísticas en tiempo real
   */
  private subscribeToRealtimeStats(): void {
    // Suscribirse a actualizaciones de estadísticas
    const statsUpdateSub = this.whatsappRealtimeService.onStatsUpdated().subscribe({
      next: (data: any) => {
        console.log('📊 Header - Stats updated via WebSocket:', data);
        this.handleStatsUpdate(data);
      },
      error: (error: any) => {
        console.error('Error procesando actualización de estadísticas en header:', error);
      }
    });

    // Suscribirse a nuevos mensajes para actualizar contador
    const newMessageSub = this.whatsappRealtimeService.onNewMessage().subscribe({
      next: (data: any) => {
        console.log('📨 Header - New message received via WebSocket:', data);
        this.handleNewMessageForStats(data);
      },
      error: (error: any) => {
        console.error('Error procesando nuevo mensaje para estadísticas en header:', error);
      }
    });

    // Almacenar suscripciones para cleanup
    this.realtimeSubscriptions.push(statsUpdateSub, newMessageSub);
  }

  /**
   * Manejar actualización de estadísticas
   */
  private handleStatsUpdate(data: any): void {
    if (data.stats) {
      const updatedStats: MessageStats = data.stats;
      this.messageStats.set(updatedStats);
      console.log('📊 Header badges updated with new stats:', updatedStats.unread_messages);
    }
  }

  /**
   * Manejar nuevo mensaje para actualizar estadísticas
   */
  private handleNewMessageForStats(data: any): void {
    const currentStats = this.messageStats();
    if (currentStats && data.message) {
      // Solo incrementar si el mensaje no es del usuario (from_me === 0)
      if (data.message.from_me === 0) {
        const updatedStats: MessageStats = {
          ...currentStats,
          total_messages: currentStats.total_messages + 1,
          unread_messages: (parseInt(currentStats.unread_messages, 10) + 1).toString(),
          received_messages: (parseInt(currentStats.received_messages, 10) + 1).toString()
        };
        
        this.messageStats.set(updatedStats);
        console.log('📨 Header badges updated - new unread count:', updatedStats.unread_messages);
      }
    }
  }

  private updatePageInfo(url: string): void {
    const { title, breadcrumbs } = this.getPageInfoFromRoute(url);
    this.pageTitle.set(title);
    this.breadcrumbs.set(breadcrumbs);
  }

  private getPageInfoFromRoute(url: string): { title: string; breadcrumbs: BreadcrumbItem[] } {
    // Limpiar query params
    const cleanUrl = url.split('?')[0];
    
    const routeMap: { [key: string]: { title: string; breadcrumbs: BreadcrumbItem[] } } = {
      '/dashboard': {
        title: 'Dashboard',
        breadcrumbs: [
          { label: 'Inicio', icon: 'home' }
        ]
      },
      '/chat': {
        title: 'Chat de WhatsApp',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Chat', icon: 'chat' }
        ]
      },
      '/bulk-messages': {
        title: 'Mensajes Masivos',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Mensajes Masivos', icon: 'broadcast' }
        ]
      },
      '/contacts': {
        title: 'Contactos',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Contactos', icon: 'contacts' }
        ]
      },
      '/contacts/list': {
        title: 'Lista de Contactos',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Contactos', route: '/contacts', icon: 'contacts' },
          { label: 'Lista', icon: 'list' }
        ]
      },
      '/contacts/tags': {
        title: 'Gestionar Etiquetas',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Contactos', route: '/contacts', icon: 'contacts' },
          { label: 'Etiquetas', icon: 'tags' }
        ]
      },
      '/templates': {
        title: 'Templates',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Templates', icon: 'template' }
        ]
      },
      '/templates/list': {
        title: 'Lista de Templates',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Templates', route: '/templates', icon: 'template' },
          { label: 'Lista', icon: 'list' }
        ]
      },
      '/templates/create': {
        title: 'Crear Template',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Templates', route: '/templates', icon: 'template' },
          { label: 'Crear', icon: 'add' }
        ]
      },
      '/profile': {
        title: 'Mi Perfil',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Mi Perfil', icon: 'user' }
        ]
      },
      '/company': {
        title: 'Configuración de Empresa',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Empresa', icon: 'company' }
        ]
      }
    };

    // Buscar coincidencia exacta primero
    if (routeMap[cleanUrl]) {
      return routeMap[cleanUrl];
    }

    // Buscar coincidencia parcial para rutas dinámicas (como /templates/edit/123)
    if (cleanUrl.startsWith('/templates/edit/')) {
      return {
        title: 'Editar Template',
        breadcrumbs: [
          { label: 'Inicio', route: '/dashboard', icon: 'home' },
          { label: 'Templates', route: '/templates', icon: 'template' },
          { label: 'Editar', icon: 'edit' }
        ]
      };
    }

    // Fallback por defecto
    return {
      title: 'Dashboard',
      breadcrumbs: [
        { label: 'Inicio', icon: 'home' }
      ]
    };
  }

  // ============================================================================
  // NAVIGATION METHODS
  // ============================================================================

  /**
   * Alternar sidebar (especialmente útil en móvil)
   */
  toggleSidebar(): void {
    this.sidebarService.toggle();
  }

  /**
   * Navegar a una ruta
   */
  navigateTo(route: string): void {
    if (route) {
      this.router.navigate([route]);
    }
  }

  /**
   * Ejecutar acción rápida
   */
  executeQuickAction(action: QuickAction): void {
    if (action.route) {
      this.navigateTo(action.route);
    } else if (action.action) {
      action.action();
    }
  }

  /**
   * Alternar menú de usuario
   */
  toggleUserMenu(): void {
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }

  /**
   * Cerrar menú de usuario
   */
  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  /**
   * Ir al perfil
   */
  goToProfile(): void {
    this.navigateTo('/profile');
    this.closeUserMenu();
  }

  /**
   * Ir a configuración de empresa
   */
  goToCompany(): void {
    this.navigateTo('/company');
    this.closeUserMenu();
  }

  /**
   * Cerrar sesión
   */
  logout(): void {
    console.log('🚪 Header logout initiated');
    
    // Cerrar el menú de usuario inmediatamente
    this.closeUserMenu();
    
    // Realizar logout
    this.authService.logout().subscribe({
      next: () => {
        console.log('✅ Logout successful from header');
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('❌ Error during logout from header:', error);
        // Incluso si falla, limpiar localmente y redirigir
        this.authService.logoutImmediate();
        this.router.navigate(['/auth/login']);
      }
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Obtener iniciales del usuario
   */
  getUserInitials(): string {
    const user = this.userInfo();
    if (user?.company_name) {
      return user.company_name.substring(0, 2).toUpperCase();
    }
    return 'CR';
  }

  /**
   * Obtener nombre de la empresa
   */
  getCompanyName(): string {
    const user = this.userInfo();
    return user?.company_name || 'CRM Condorito';
  }

  /**
   * Obtener código del cliente
   */
  getClientCode(): string {
    const user = this.userInfo();
    return user?.client_code || 'demo';
  }

  /**
   * Formatear fecha actual
   */
  getCurrentDate(): string {
    return new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Formatear hora actual
   */
  getCurrentTime(): string {
    return new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
