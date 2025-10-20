import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, BehaviorSubject, timer, NEVER } from 'rxjs';
import { 
  filter, 
  map, 
  retry, 
  retryWhen, 
  delay, 
  takeUntil,
  tap,
  switchMap,
  share
} from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '../config/app.config';
import { AuthService } from '../../features/auth/services/auth.service';
import { SoundSettingsService } from './sound-settings.service';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  id?: string;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  protocols?: string[];
}

export enum WebSocketConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

/**
 * Servicio de WebSocket para actualizaciones en tiempo real
 * Maneja conexión, reconexión automática, y distribución de mensajes
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private authService = inject(AuthService);
  private soundSettingsService = inject(SoundSettingsService);
  
  private socket: Socket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  private connectionStateSubject = new BehaviorSubject<WebSocketConnectionState>(
    WebSocketConnectionState.DISCONNECTED
  );
  private destroySubject = new Subject<void>();
  
  // Signals para estado reactivo
  public connectionState = signal<WebSocketConnectionState>(WebSocketConnectionState.DISCONNECTED);
  public isConnected = signal<boolean>(false);
  public lastMessage = signal<WebSocketMessage | null>(null);
  
  // Configuración
  private config: WebSocketConfig = {
    url: APP_CONFIG.api.baseUrl, // Usar la misma URL base que el resto de la aplicación
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
  };
  
  private reconnectAttempts = 0;
  private heartbeatTimer: any;
  private reconnectTimer: any;

  constructor() {
    // Suscribirse a cambios de estado de conexión
    this.connectionStateSubject.subscribe(state => {
      this.connectionState.set(state);
      this.isConnected.set(state === WebSocketConnectionState.CONNECTED);
    });
    
    // Suscribirse a mensajes para actualizar signal
    this.messageSubject.subscribe(message => {
      this.lastMessage.set(message);
    });
  }

  /**
   * Conectar al WebSocket
   */
  connect(): Observable<WebSocketConnectionState> {
    if (this.socket && this.socket.connected) {
      return this.connectionStateSubject.asObservable();
    }

    this.connectionStateSubject.next(WebSocketConnectionState.CONNECTING);
    
    return new Observable<WebSocketConnectionState>(observer => {
      try {
        const token = this.authService.getToken();
        const user = this.authService.getCurrentUser();
        
        // Crear conexión Socket.io
        this.socket = io("https://crm.condorestudio.com", {
          path: "/backend/socket.io/",
          auth: {
            token: token,
            clientId: user?.id,
            clientCode: user?.client_code
          },
          transports: ['websocket', 'polling']
        });
        
        // Eventos de conexión
        this.socket.on('connect', () => {
          console.log('✅ Socket.io conectado');
          this.connectionStateSubject.next(WebSocketConnectionState.CONNECTED);
          this.reconnectAttempts = 0;
          
          // Unirse al room del cliente
          if (user?.client_code) {
            this.socket?.emit('join_client_room', user.client_code);
          }
          
          observer.next(WebSocketConnectionState.CONNECTED);
        });
        
        this.socket.on('disconnect', (reason) => {
          console.log('🔌 Socket.io desconectado:', reason);
          this.connectionStateSubject.next(WebSocketConnectionState.DISCONNECTED);
          observer.next(WebSocketConnectionState.DISCONNECTED);
        });
        
        this.socket.on('connect_error', (error) => {
          console.error('❌ Error de conexión Socket.io:', error);
          this.connectionStateSubject.next(WebSocketConnectionState.ERROR);
          observer.error(error);
        });
        
        // Escuchar todos los eventos del backend
        this.setupEventListeners();
        
      } catch (error) {
        console.error('Error creating Socket.io connection:', error);
        this.connectionStateSubject.next(WebSocketConnectionState.ERROR);
        observer.error(error);
      }
    }).pipe(
      share<WebSocketConnectionState>()
    );
  }

  /**
   * Configurar listeners para eventos del backend
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Eventos que el backend ya emite
    this.socket.on('message:new', (data) => {
      console.log('🔔 New message received via WebSocket:', data);
      
      // Reproducir sonido de notificación si está habilitado
      if (data && this.shouldPlaySoundForMessage(data)) {
        this.soundSettingsService.playNotificationSound();
        console.log('🔊 Played notification sound for new message');
      }
      
      this.handleMessage({ type: 'new_message', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('whatsapp:qr', (data) => {
      this.handleMessage({ type: 'whatsapp_qr', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('whatsapp:authenticated', (data) => {
      this.handleMessage({ type: 'whatsapp_authenticated', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('whatsapp:ready', (data) => {
      this.handleMessage({ type: 'whatsapp_ready', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('whatsapp:disconnected', (data) => {
      this.handleMessage({ type: 'whatsapp_disconnected', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('whatsapp:status_updated', (data) => {
      this.handleMessage({ type: 'whatsapp_status_updated', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('whatsapp:connection_completed', (data) => {
      this.handleMessage({ type: 'whatsapp_connection_completed', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    // Eventos adicionales que podemos agregar al backend
    this.socket.on('stats:updated', (data) => {
      this.handleMessage({ type: 'stats_updated', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('bot:status_changed', (data) => {
      this.handleMessage({ type: 'bot_status_changed', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('conversation:updated', (data) => {
      this.handleMessage({ type: 'conversation_updated', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('message:status_updated', (data) => {
      this.handleMessage({ type: 'message_status_updated', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('bulk:progress', (data) => {
      this.handleMessage({ type: 'bulk_message_progress', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('bulk:completed', (data) => {
      this.handleMessage({ type: 'bulk_message_completed', data, timestamp: Date.now(), id: this.generateMessageId() });
    });

    this.socket.on('bulk:error', (data) => {
      this.handleMessage({ type: 'bulk_message_error', data, timestamp: Date.now(), id: this.generateMessageId() });
    });
  }

  /**
   * Desconectar Socket.io
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.stopHeartbeat();
    this.stopReconnectTimer();
    this.connectionStateSubject.next(WebSocketConnectionState.DISCONNECTED);
  }

  /**
   * Enviar mensaje
   */
  send(type: string, data: any): boolean {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket.io no está conectado. No se puede enviar mensaje:', type);
      return false;
    }

    try {
      this.socket.emit(type, data);
      console.log('📤 Mensaje enviado via Socket.io:', type, data);
      return true;
    } catch (error) {
      console.error('Error enviando mensaje via Socket.io:', error);
      return false;
    }
  }

  /**
   * Suscribirse a mensajes de un tipo específico
   */
  onMessage<T = any>(messageType: string): Observable<T> {
    return this.messageSubject.pipe(
      filter(message => message.type === messageType),
      map(message => message.data as T)
    );
  }

  /**
   * Suscribirse a todos los mensajes
   */
  onAllMessages(): Observable<WebSocketMessage> {
    return this.messageSubject.asObservable();
  }


  /**
   * Obtener estado de conexión como Observable
   */
  getConnectionState(): Observable<WebSocketConnectionState> {
    return this.connectionStateSubject.asObservable();
  }

  /**
   * Determinar si se debe reproducir sonido para un mensaje
   */
  private shouldPlaySoundForMessage(messageData: any): boolean {
    // No reproducir sonido si las notificaciones sonoras están deshabilitadas
    if (!this.soundSettingsService.isEnabled()) {
      return false;
    }

    // Solo reproducir sonido para mensajes entrantes (no enviados por nosotros)
    if (messageData.message.fromMe === true) {
      return false;
    }

    return true;
  }

  /**
   * Manejar mensaje recibido
   */
  private handleMessage(message: WebSocketMessage): void {
    console.log('📨 WebSocket mensaje recibido:', message.type, message.data);
    
    // Manejar mensajes especiales del sistema
    switch (message.type) {
      case 'ping':
        this.send('pong', { timestamp: Date.now() });
        break;
      case 'pong':
        // Heartbeat response recibido
        break;
      default:
        // Emitir mensaje a suscriptores
        this.messageSubject.next(message);
        break;
    }
  }

  /**
   * Programar reconexión
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Máximo 30 segundos
    );
    
    console.log(`🔄 Reconectando WebSocket en ${delay}ms (intento ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
    this.connectionStateSubject.next(WebSocketConnectionState.RECONNECTING);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().subscribe({
        error: (error) => {
          console.error('Error en reconexión:', error);
          if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        }
      });
    }, delay);
  }

  /**
   * Iniciar heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Detener heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Detener timer de reconexión
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Generar ID único para mensajes
   */
  private generateMessageId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destruir servicio
   */
  destroy(): void {
    this.disconnect();
    this.destroySubject.next();
    this.destroySubject.complete();
    this.messageSubject.complete();
    this.connectionStateSubject.complete();
  }
}

/**
 * Servicio específico para eventos de WhatsApp en tiempo real
 */
@Injectable({
  providedIn: 'root'
})
export class WhatsAppRealtimeService {
  private wsService = inject(WebSocketService);

  /**
   * Suscribirse a nuevos mensajes
   */
  onNewMessage(): Observable<any> {
    return this.wsService.onMessage('new_message');
  }

  /**
   * Suscribirse a actualizaciones de estadísticas
   */
  onStatsUpdated(): Observable<any> {
    return this.wsService.onMessage('stats_updated');
  }

  /**
   * Suscribirse a cambios de estado de conversaciones
   */
  onConversationUpdate(): Observable<any> {
    return this.wsService.onMessage('conversation_update');
  }

  /**
   * Suscribirse a cambios de estado de WhatsApp
   */
  onWhatsAppStatusChange(): Observable<any> {
    return this.wsService.onMessage('whatsapp_status_change');
  }

  /**
   * Suscribirse a cuando WhatsApp está listo (conectado)
   */
  onWhatsAppReady(): Observable<any> {
    return this.wsService.onMessage('whatsapp_ready');
  }

  /**
   * Suscribirse a actualizaciones de estado de WhatsApp
   */
  onWhatsAppStatusUpdated(): Observable<any> {
    return this.wsService.onMessage('whatsapp_status_updated');
  }

  /**
   * Suscribirse a cuando se completa la conexión de WhatsApp
   */
  onWhatsAppConnectionCompleted(): Observable<any> {
    return this.wsService.onMessage('whatsapp_connection_completed');
  }

  /**
   * Suscribirse a QR codes de WhatsApp
   */
  onWhatsAppQR(): Observable<any> {
    return this.wsService.onMessage('whatsapp_qr');
  }

  /**
   * Suscribirse a autenticación de WhatsApp
   */
  onWhatsAppAuthenticated(): Observable<any> {
    return this.wsService.onMessage('whatsapp_authenticated');
  }

  /**
   * Suscribirse a desconexión de WhatsApp
   */
  onWhatsAppDisconnected(): Observable<any> {
    return this.wsService.onMessage('whatsapp_disconnected');
  }

  /**
   * Suscribirse a actualizaciones de mensajes masivos
   */
  onBulkMessageProgress(): Observable<any> {
    return this.wsService.onMessage('bulk_message_progress');
  }

  /**
   * Método genérico para escuchar cualquier tipo de mensaje
   */
  onMessage(eventType: string): Observable<any> {
    return this.wsService.onMessage(eventType);
  }

  /**
   * Conectar al servicio de tiempo real
   */
  connect(): Observable<WebSocketConnectionState> {
    return this.wsService.connect();
  }

  /**
   * Desconectar del servicio
   */
  disconnect(): void {
    this.wsService.disconnect();
  }

  /**
   * Obtener estado de conexión
   */
  getConnectionState(): Observable<WebSocketConnectionState> {
    return this.wsService.getConnectionState();
  }
}
