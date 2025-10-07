import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription, filter, interval } from 'rxjs';
import { AuthService } from '../../../features/auth/services/auth.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { DashboardService } from '../../../features/dashboard/services/dashboard.service';
import { WhatsAppRealtimeService, WebSocketConnectionState } from '../../../core/services/websocket.service';
import { MessageStats } from '../../../core/models/api.models';

// ============================================================================
// SIDEBAR NAVIGATION COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  children?: NavItem[];
  badge?: string;
  badgeColor?: string;
  separator?: boolean;
}

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-nav.component.html',
  styleUrls: ['./sidebar-nav.component.scss']
})
export class SidebarNavComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private sidebarService = inject(SidebarService);
  private dashboardService = inject(DashboardService);
  private whatsappRealtimeService = inject(WhatsAppRealtimeService);

  // ============================================================================
  // SIGNALS
  // ============================================================================
  
  public isOpen = this.sidebarService.isOpen;
  public isMobile = this.sidebarService.isMobile;
  public currentRoute = signal<string>('');
  public expandedGroups = signal<Set<string>>(new Set());
  public userInfo = signal<any>(null);
  public messageStats = signal<MessageStats | null>(null);

  // ============================================================================
  // COMPUTED
  // ============================================================================

  public navItems = computed<NavItem[]>(() => [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/dashboard'
    },
    {
      id: 'separator-1',
      label: '',
      icon: '',
      separator: true
    },
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
      label: 'Mensajes Masivos',
      icon: 'broadcast',
      route: '/bulk-messages'
    },
    {
      id: 'scheduled-messages-list',
      label: 'Mensajes Programados',
      icon: 'schedule',
      route: '/scheduled-messages/list'
    },
    {
      id: 'scheduled-messages-create',
      label: 'Programar Mensaje',
      icon: 'add_alarm',
      route: '/scheduled-messages/create'
    },
    {
      id: 'separator-2',
      label: '',
      icon: '',
      separator: true
    },
    {
      id: 'contacts',
      label: 'Contactos',
      icon: 'contacts',
      children: [
        {
          id: 'contacts-list',
          label: 'Lista de Contactos',
          icon: 'list',
          route: '/contacts'
        },
        {
          id: 'contacts-tags',
          label: 'Gestionar Etiquetas',
          icon: 'tags',
          route: '/contacts/tags'
        }
      ]
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: 'template',
      children: [
        {
          id: 'templates-list',
          label: 'Lista de Templates',
          icon: 'list',
          route: '/templates/list'
        },
        {
          id: 'templates-create',
          label: 'Crear Template',
          icon: 'add',
          route: '/templates/create'
        }
      ]
    },
    {
      id: 'separator-3',
      label: '',
      icon: '',
      separator: true
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: 'whatsapp',
      children: [
        {
          id: 'whatsapp-status',
          label: 'Estado de Conexión',
          icon: 'status',
          route: '/dashboard' // Redirige al dashboard donde está el estado
        },
        {
          id: 'whatsapp-qr',
          label: 'Código QR',
          icon: 'qr',
          route: '/dashboard' // Redirige al dashboard donde está el QR
        }
      ]
    },
    {
      id: 'separator-4',
      label: '',
      icon: '',
      separator: true
    },
    {
      id: 'settings',
      label: 'Configuración',
      icon: 'settings',
      children: [
        {
          id: 'ai-config',
          label: 'Asistente IA',
          icon: 'brain',
          route: '/ai-config'
        },
        {
          id: 'profile',
          label: 'Mi Perfil',
          icon: 'user',
          route: '/profile'
        },
        {
          id: 'company',
          label: 'Empresa',
          icon: 'company',
          route: '/company'
        }
      ]
    }
  ]);

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  private routerSubscription?: Subscription;
  private statsSubscription?: Subscription;
  private statsRefreshSubscription?: Subscription;
  private websocketSubscription?: Subscription;
  private realtimeSubscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    this.setupRouterSubscription();
    this.loadUserInfo();
    this.loadMessageStats();
    this.setupStatsRefresh();
    this.initializeWebSocket();
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
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
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute.set(event.url);
        
        // Cerrar sidebar en móvil después de navegar
        if (this.isMobile()) {
          this.close();
        }
      });
  }


  private loadUserInfo(): void {
    // Obtener información del usuario desde el AuthService
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
        console.error('Error loading message stats in sidebar:', error);
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
        console.log('Sidebar WebSocket state:', state);
        
        if (state === WebSocketConnectionState.CONNECTED) {
          console.log('✅ Sidebar WebSocket conectado - Badge en tiempo real activo');
          this.subscribeToRealtimeStats();
        } else if (state === WebSocketConnectionState.DISCONNECTED) {
          console.log('❌ Sidebar WebSocket desconectado - Usando polling como fallback');
        }
      },
      error: (error) => {
        console.error('Error en Sidebar WebSocket:', error);
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
        console.log('📊 Sidebar - Stats updated via WebSocket:', data);
        this.handleStatsUpdate(data);
      },
      error: (error: any) => {
        console.error('Error procesando actualización de estadísticas en sidebar:', error);
      }
    });

    // Suscribirse a nuevos mensajes para actualizar contador
    const newMessageSub = this.whatsappRealtimeService.onNewMessage().subscribe({
      next: (data: any) => {
        console.log('📨 Sidebar - New message received via WebSocket:', data);
        this.handleNewMessageForStats(data);
      },
      error: (error: any) => {
        console.error('Error procesando nuevo mensaje para estadísticas en sidebar:', error);
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
      console.log('📊 Sidebar badge updated with new stats:', updatedStats.unread_messages);
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
        console.log('📨 Sidebar badge updated - new unread count:', updatedStats.unread_messages);
      }
    }
  }

  // ============================================================================
  // NAVIGATION METHODS
  // ============================================================================

  /**
   * Alternar sidebar
   */
  toggle(): void {
    this.sidebarService.toggle();
  }

  /**
   * Abrir sidebar
   */
  open(): void {
    this.sidebarService.open();
  }

  /**
   * Cerrar sidebar
   */
  close(): void {
    this.sidebarService.close();
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
   * Alternar grupo expandido
   */
  toggleGroup(groupId: string): void {
    const expanded = new Set(this.expandedGroups());
    
    if (expanded.has(groupId)) {
      expanded.delete(groupId);
    } else {
      expanded.add(groupId);
    }
    
    this.expandedGroups.set(expanded);
  }

  /**
   * Verificar si un grupo está expandido
   */
  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroups().has(groupId);
  }

  /**
   * Verificar si una ruta está activa
   */
  isRouteActive(route: string): boolean {
    if (!route) return false;
    
    const currentRoute = this.currentRoute();
    return currentRoute === route || currentRoute.startsWith(route + '/');
  }

  /**
   * Verificar si un grupo tiene rutas activas
   */
  isGroupActive(item: NavItem): boolean {
    if (!item.children) return false;
    
    return item.children.some(child => 
      child.route && this.isRouteActive(child.route)
    );
  }

  /**
   * Cerrar sesión
   */
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('Error during logout:', error);
        this.router.navigate(['/auth/login']);
      }
    });
  }

  /**
   * Manejar click en overlay (móvil)
   */
  onOverlayClick(): void {
    if (this.isMobile()) {
      this.close();
    }
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
    return user?.company_name || '';
  }

  /**
   * Obtener código del cliente
   */
  getClientCode(): string {
    const user = this.userInfo();
    return user?.client_code || '';
  }
}
