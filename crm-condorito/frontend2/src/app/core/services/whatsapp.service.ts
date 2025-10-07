import { Injectable, inject, signal } from '@angular/core';
import { Observable, BehaviorSubject, tap, catchError, throwError, map } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from '../../features/auth/services/auth.service';
import { APP_CONFIG } from '../config/app.config';
import { 
  WhatsAppStatusResponse, 
  WhatsAppConnectResponse, 
  WhatsAppQRResponse,
  WhatsAppState,
  WhatsAppConnectionStatus 
} from '../models/api.models';

/**
 * Servicio de WhatsApp
 * Maneja el estado de conexión, QR, y todas las operaciones de WhatsApp
 */
@Injectable({
  providedIn: 'root'
})
export class WhatsAppService {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  // Estado interno de WhatsApp
  private whatsappStateSubject = new BehaviorSubject<WhatsAppState>({
    status: 'not_initialized',
    connected: false,
    lastUpdated: new Date(),
    isLoading: false
  });

  // Observables públicos
  public whatsappState$ = this.whatsappStateSubject.asObservable();

  // Signals para componentes
  public whatsappState = signal<WhatsAppState>({
    status: 'not_initialized',
    connected: false,
    lastUpdated: new Date(),
    isLoading: false
  });

  constructor() {
    // Sincronizar BehaviorSubject con signal
    this.whatsappState$.subscribe(state => {
      this.whatsappState.set(state);
    });
  }

  /**
   * Obtener estado actual de WhatsApp
   */
  getStatus(): Observable<WhatsAppStatusResponse> {
    this.setLoading(true);
    
    return this.apiService.get<WhatsAppStatusResponse>(
      APP_CONFIG.api.endpoints.whatsapp.status
    ).pipe(
      tap((response) => {
        console.log('📱 WhatsApp status response:', response);
        this.updateStateFromStatusResponse(response);
      }),
      catchError((error) => {
        console.error('❌ Error getting WhatsApp status:', error);
        this.setError('Error al obtener el estado de WhatsApp');
        return throwError(() => error);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Conectar WhatsApp
   */
  connect(): Observable<WhatsAppConnectResponse> {
    this.setLoading(true);
    this.setStatus('initializing');
    
    return this.apiService.post<WhatsAppConnectResponse>(
      APP_CONFIG.api.endpoints.whatsapp.connect,
      {}
    ).pipe(
      tap((response) => {
        console.log('🔗 WhatsApp connect response:', response);
        this.updateStateFromConnectResponse(response);
      }),
      catchError((error) => {
        console.error('❌ Error connecting WhatsApp:', error);
        this.setError('Error al conectar WhatsApp');
        this.setStatus('error');
        return throwError(() => error);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Desconectar WhatsApp
   */
  disconnect(): Observable<any> {
    this.setLoading(true);
    
    return this.apiService.post(
      APP_CONFIG.api.endpoints.whatsapp.disconnect,
      {}
    ).pipe(
      tap((response) => {
        console.log('🔌 WhatsApp disconnect response:', response);
        this.setStatus('disconnected');
        this.clearState();
      }),
      catchError((error) => {
        console.error('❌ Error disconnecting WhatsApp:', error);
        this.setError('Error al desconectar WhatsApp');
        return throwError(() => error);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Forzar limpieza completa de la sesión WhatsApp
   */
  forceCleanup(): Observable<any> {
    this.setLoading(true);
    
    return this.apiService.post(
      APP_CONFIG.api.endpoints.whatsapp.forceCleanup,
      {}
    ).pipe(
      tap((response) => {
        console.log('🧹 WhatsApp force cleanup response:', response);
        this.setStatus('not_initialized');
        this.clearState();
      }),
      catchError((error) => {
        console.error('❌ Error in force cleanup WhatsApp:', error);
        this.setError('Error al limpiar la sesión de WhatsApp');
        return throwError(() => error);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Obtener código QR
   */
  getQR(): Observable<WhatsAppQRResponse> {
    const clientCode = this.authService.getClientCode();
    if (!clientCode) {
      return throwError(() => new Error('No se encontró el código de cliente'));
    }

    const qrEndpoint = `${APP_CONFIG.api.endpoints.whatsapp.qr}/${clientCode}`;
    
    return this.apiService.getBlob(qrEndpoint, { includeAuth: true }).pipe(
      map((blob: Blob) => ({
        qrImage: blob,
        timestamp: new Date()
      } as WhatsAppQRResponse)),
      tap(() => {
        console.log('📱 QR code obtained successfully');
      }),
      catchError((error) => {
        console.error('❌ Error getting QR code:', error);
        this.setError('Error al obtener el código QR');
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener imagen QR como URL
   */
  getQRImageUrl(): Observable<string> {
    return this.getQR().pipe(
      map((qrResponse) => {
        return URL.createObjectURL(qrResponse.qrImage);
      })
    );
  }

  /**
   * Verificar si está conectado
   */
  isConnected(): boolean {
    return this.whatsappState().connected;
  }

  /**
   * Obtener estado actual
   */
  getCurrentStatus(): WhatsAppConnectionStatus {
    return this.whatsappState().status;
  }

  /**
   * Obtener número de teléfono conectado
   */
  getConnectedPhoneNumber(): string | undefined {
    return this.whatsappState().phoneNumber;
  }

  /**
   * Obtener estadísticas de WhatsApp
   */
  getWhatsAppStats() {
    return this.whatsappState().stats;
  }

  /**
   * Limpiar estado
   */
  clearState(): void {
    this.updateState({
      status: 'not_initialized',
      connected: false,
      phoneNumber: undefined,
      clientInfo: undefined,
      session: undefined,
      stats: undefined,
      error: undefined
    });
  }

  /**
   * Actualizar estado desde respuesta de status
   */
  private updateStateFromStatusResponse(response: WhatsAppStatusResponse): void {
    this.updateState({
      status: response.status,
      connected: response.connected,
      phoneNumber: response.session?.phone_number,
      session: response.session,
      stats: response.stats,
      error: undefined
    });
  }

  /**
   * Actualizar estado desde respuesta de connect
   */
  private updateStateFromConnectResponse(response: WhatsAppConnectResponse): void {
    this.updateState({
      status: response.status,
      connected: response.status === 'connected',
      phoneNumber: response.phoneNumber || undefined,
      clientInfo: response.clientInfo,
      error: undefined
    });
  }

  /**
   * Actualizar estado interno
   */
  private updateState(partialState: Partial<WhatsAppState>): void {
    const currentState = this.whatsappStateSubject.value;
    const newState: WhatsAppState = {
      ...currentState,
      ...partialState,
      lastUpdated: new Date()
    };
    
    this.whatsappStateSubject.next(newState);
  }

  /**
   * Establecer estado de loading
   */
  private setLoading(loading: boolean): void {
    this.updateState({ isLoading: loading });
  }

  /**
   * Establecer error
   */
  private setError(error: string): void {
    this.updateState({ error, isLoading: false });
  }

  /**
   * Establecer estado de conexión
   */
  private setStatus(status: WhatsAppConnectionStatus): void {
    this.updateState({ 
      status,
      connected: status === 'connected'
    });
  }

  /**
   * Resetear errores
   */
  clearError(): void {
    this.updateState({ error: undefined });
  }

  /**
   * Obtener mensaje de estado user-friendly
   */
  getStatusMessage(): string {
    const state = this.whatsappState();
    
    switch (state.status) {
      case 'connected':
        return `Conectado${state.phoneNumber ? ` - ${state.phoneNumber}` : ''}`;
      case 'connecting':
        return 'Conectando...';
      case 'initializing':
        return 'Inicializando conexión...';
      case 'disconnected':
        return 'Desconectado';
      case 'not_initialized':
        return 'No inicializado';
      case 'error':
        return state.error || 'Error de conexión';
      default:
        return 'Estado desconocido';
    }
  }

  /**
   * Obtener color del estado para UI
   */
  getStatusColor(): string {
    const status = this.getCurrentStatus();
    
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
      case 'initializing':
        return 'warning';
      case 'disconnected':
      case 'not_initialized':
        return 'secondary';
      case 'error':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  /**
   * Verificar si puede conectar
   */
  canConnect(): boolean {
    const status = this.getCurrentStatus();
    return ['not_initialized', 'disconnected', 'error', 'error', 'initializing', 'connecting', 'waiting_qr'].includes(status);
  }

  /**
   * Verificar si puede desconectar
   */
  canDisconnect(): boolean {
    const status = this.getCurrentStatus();
    return ['connected', 'connecting'].includes(status);
  }

  /**
   * Verificar si necesita QR
   */
  needsQR(): boolean {
    const status = this.getCurrentStatus();
    return status === 'initializing';
  }
}
