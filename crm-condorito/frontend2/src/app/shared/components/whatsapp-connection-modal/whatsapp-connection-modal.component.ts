import { Component, inject, signal, OnInit, OnDestroy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { WhatsAppService } from '../../../core/services/whatsapp.service';
import { WhatsAppRealtimeService } from '../../../core/services/websocket.service';
import { QrCodeComponent } from '../qr-code/qr-code.component';
import { WhatsAppState, WhatsAppConnectionStatus } from '../../../core/models/api.models';

/**
 * Modal de conexión WhatsApp
 * Maneja el proceso de conexión con QR y estados en tiempo real
 */
@Component({
  selector: 'app-whatsapp-connection-modal',
  standalone: true,
  imports: [CommonModule, QrCodeComponent],
  templateUrl: './whatsapp-connection-modal.component.html',
  styleUrl: './whatsapp-connection-modal.component.scss'
})
export class WhatsAppConnectionModalComponent implements OnInit, OnDestroy {
  private whatsappService = inject(WhatsAppService);
  private whatsappRealtimeService = inject(WhatsAppRealtimeService);

  // Inputs
  public isVisible = input<boolean>(false);
  
  // Outputs
  public onClose = output<void>();
  public onConnected = output<void>();
  public onError = output<string>();

  // Signals
  public whatsappState = signal<WhatsAppState | null>(null);
  public qrImageUrl = signal<string | null>(null);
  public isConnecting = signal<boolean>(false);
  public connectionStep = signal<'initializing' | 'qr' | 'connecting' | 'connected' | 'error'>('initializing');
  public errorMessage = signal<string>('');
  public statusMessage = signal<string>('Iniciando conexión...');

  // Subscriptions
  private whatsappStateSubscription?: Subscription;
  private qrRefreshSubscription?: Subscription;
  private statusCheckSubscription?: Subscription;
  private websocketSubscriptions: Subscription[] = [];

  // Configuración
  private readonly QR_REFRESH_INTERVAL = 30000; // 30 segundos
  private readonly STATUS_CHECK_INTERVAL = 3000; // 3 segundos

  ngOnInit(): void {
    // Suscribirse al estado de WhatsApp
    this.whatsappStateSubscription = this.whatsappService.whatsappState$.subscribe(state => {
      this.whatsappState.set(state);
      this.updateConnectionStep(state);
    });

    // Configurar suscripciones WebSocket
    this.setupWebSocketSubscriptions();

    // Si el modal está visible, iniciar conexión
    if (this.isVisible()) {
      this.startConnection();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Configurar suscripciones WebSocket
   */
  private setupWebSocketSubscriptions(): void {
    // Suscribirse a QR codes
    const qrSub = this.whatsappRealtimeService.onWhatsAppQR().subscribe(data => {
      console.log('📱 WebSocket QR received:', data);
      if (data.qr) {
        this.qrImageUrl.set(data.qr);
        this.connectionStep.set('qr');
        this.statusMessage.set('Escanea el código QR con WhatsApp');
      }
    });

    // Suscribirse a autenticación exitosa
    const authSub = this.whatsappRealtimeService.onWhatsAppAuthenticated().subscribe(data => {
      console.log('🔐 WebSocket authenticated:', data);
      this.connectionStep.set('connecting');
      this.statusMessage.set('Autenticando... Por favor espera');
      this.clearQRImage();
    });

    // Suscribirse a conexión completada (evento más específico)
    const connectionCompletedSub = this.whatsappRealtimeService.onWhatsAppConnectionCompleted().subscribe(data => {
      console.log('✅ WebSocket connection completed:', data);
      if (data.success) {
        this.handleConnectionSuccess(data.phoneNumber);
      }
    });

    // Suscribirse a WhatsApp listo (fallback)
    const readySub = this.whatsappRealtimeService.onWhatsAppReady().subscribe(data => {
      console.log('🚀 WebSocket ready:', data);
      this.handleConnectionSuccess(data.phoneNumber);
    });

    // Suscribirse a actualizaciones de estado
    const statusSub = this.whatsappRealtimeService.onWhatsAppStatusUpdated().subscribe(data => {
      console.log('📊 WebSocket status updated:', data);
      if (data.status === 'connected' && data.connected) {
        this.handleConnectionSuccess(data.phoneNumber);
      }
    });

    // Suscribirse a desconexión
    const disconnectedSub = this.whatsappRealtimeService.onWhatsAppDisconnected().subscribe(data => {
      console.log('📴 WebSocket disconnected:', data);
      if (this.isConnecting()) {
        this.handleConnectionError('Conexión perdida durante el proceso');
      }
    });

    // Almacenar suscripciones para cleanup
    this.websocketSubscriptions.push(
      qrSub, 
      authSub, 
      connectionCompletedSub, 
      readySub, 
      statusSub, 
      disconnectedSub
    );
  }

  /**
   * Iniciar proceso de conexión
   */
  startConnection(): void {
    console.log('🔄 Starting WhatsApp connection process...');
    this.isConnecting.set(true);
    this.connectionStep.set('initializing');
    this.statusMessage.set('Iniciando conexión...');
    this.errorMessage.set('');

    // Limpiar QR anterior
    this.clearQRImage();

    // Timeout de seguridad para evitar carga infinita
    const connectionTimeout = setTimeout(() => {
      if (this.connectionStep() === 'initializing') {
        console.warn('⚠️ Connection timeout reached, forcing QR process');
        this.startQRProcess();
      }
    }, 10000); // 10 segundos timeout

    // Iniciar conexión
    this.whatsappService.connect().subscribe({
      next: (response) => {
        clearTimeout(connectionTimeout);
        console.log('🔗 Connection response received:', response);
        
        if (response.success) {
          // Verificar el estado específico de la respuesta
          if (response.status === 'connected') {
            console.log('✅ Already connected, closing modal');
            this.handleConnectionSuccess();
          } else if (response.status === 'initializing' || response.status === 'connecting') {
            console.log('📱 Need QR code, starting QR process');
            this.startQRProcess();
          } else {
            console.log('🔄 Connection in progress, starting QR process');
            this.startQRProcess();
          }
        } else {
          console.error('❌ Connection failed:', response.message);
          this.handleConnectionError(response.message || 'Error al iniciar la conexión');
        }
      },
      error: (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ Connection error:', error);
        this.handleConnectionError(error.message || 'Error al conectar WhatsApp');
      }
    });

    // Iniciar verificación de estado inmediatamente
    setTimeout(() => {
      if (this.connectionStep() === 'initializing') {
        console.log('🔍 Checking status after connection attempt...');
        this.checkConnectionStatus();
      }
    }, 2000);
  }

  /**
   * Verificar estado de conexión
   */
  private checkConnectionStatus(): void {
    this.whatsappService.getStatus().subscribe({
      next: (response) => {
        console.log('📊 Status check response:', response);
        if (response.success) {
          if (response.connected) {
            this.handleConnectionSuccess();
          } else if (response.hasQR || response.status === 'connecting') {
            this.startQRProcess();
          } else {
            // Si no hay QR y no está conectado, forzar proceso QR
            this.startQRProcess();
          }
        } else {
          this.startQRProcess();
        }
      },
      error: (error) => {
        console.error('❌ Status check error:', error);
        this.startQRProcess();
      }
    });
  }

  /**
   * Iniciar proceso de QR
   */
  private startQRProcess(): void {
    this.connectionStep.set('qr');
    this.statusMessage.set('Generando código QR...');
    
    // Obtener QR inicial
    this.loadQRCode();
    
    // Configurar refresh automático del QR
    this.startQRRefresh();
    
    // Configurar verificación de estado
    this.startStatusCheck();
  }

  /**
   * Cargar código QR
   */
  loadQRCode(): void {
    console.log('📱 Loading QR code...');
    this.whatsappService.getQRImageUrl().subscribe({
      next: (imageUrl) => {
        if (imageUrl) {
          this.qrImageUrl.set(imageUrl);
          this.statusMessage.set('Escanea el código QR con WhatsApp');
          console.log('📱 QR code loaded successfully');
        } else {
          console.log('⚠️ No QR code available, checking status...');
          // Si no hay QR, verificar el estado actual
          this.checkConnectionStatus();
        }
      },
      error: (error) => {
        console.error('❌ QR load error:', error);
        // En lugar de mostrar error inmediatamente, intentar verificar estado
        setTimeout(() => {
          this.checkConnectionStatus();
        }, 1000);
      }
    });
  }

  /**
   * Iniciar refresh automático del QR
   */
  private startQRRefresh(): void {
    this.qrRefreshSubscription = interval(this.QR_REFRESH_INTERVAL).subscribe(() => {
      if (this.connectionStep() === 'qr') {
        console.log('🔄 Refreshing QR code...');
        this.loadQRCode();
      }
    });
  }

  /**
   * Iniciar verificación de estado
   */
  private startStatusCheck(): void {
    this.statusCheckSubscription = interval(this.STATUS_CHECK_INTERVAL).subscribe(() => {
      if (this.connectionStep() === 'qr' || this.connectionStep() === 'connecting') {
        this.whatsappService.getStatus().subscribe({
          next: (response) => {
            // El estado se actualiza automáticamente via subscription
          },
          error: (error) => {
            console.error('❌ Status check error:', error);
          }
        });
      }
    });
  }

  /**
   * Actualizar paso de conexión basado en el estado
   */
  private updateConnectionStep(state: WhatsAppState): void {
    if (!state || !this.isConnecting()) return;

    switch (state.status) {
      case 'initializing':
        this.connectionStep.set('initializing');
        this.statusMessage.set('Inicializando WhatsApp...');
        break;

      case 'connecting':
        if (this.connectionStep() !== 'connecting') {
          this.connectionStep.set('connecting');
          this.statusMessage.set('Conectando... Por favor espera');
        }
        break;

      case 'connected':
        this.handleConnectionSuccess();
        break;

      case 'error':
        this.handleConnectionError(state.error || 'Error de conexión');
        break;

      case 'disconnected':
        if (this.connectionStep() !== 'qr') {
          this.handleConnectionError('Conexión perdida');
        }
        break;
    }
  }

  /**
   * Manejar conexión exitosa
   */
  private handleConnectionSuccess(phoneNumber?: string): void {
    this.connectionStep.set('connected');
    const message = phoneNumber 
      ? `¡WhatsApp conectado exitosamente! (${phoneNumber})`
      : '¡WhatsApp conectado exitosamente!';
    this.statusMessage.set(message);
    this.isConnecting.set(false);
    this.cleanup();

    // Emitir evento de conexión exitosa
    this.onConnected.emit();

    console.log('✅ Connection success handled, closing modal in 1.5 seconds');

    // Cerrar modal después de un breve delay (reducido para mejor UX)
    setTimeout(() => {
      this.closeModal();
    }, 1500);
  }

  /**
   * Manejar error de conexión
   */
  private handleConnectionError(message: string): void {
    this.connectionStep.set('error');
    this.errorMessage.set(message);
    this.statusMessage.set('Error de conexión');
    this.isConnecting.set(false);
    this.cleanup();

    // Emitir evento de error
    this.onError.emit(message);
  }

  /**
   * Refrescar código QR manualmente
   */
  refreshQRCode(): void {
    console.log('🔄 Manual QR refresh requested');
    this.statusMessage.set('Actualizando código QR...');
    
    // Limpiar QR actual
    this.clearQRImage();
    
    // Forzar nueva conexión para generar nuevo QR
    this.whatsappService.connect().subscribe({
      next: (response) => {
        console.log('🔗 QR refresh connection response:', response);
        if (response.success) {
          // Cargar el nuevo QR
          setTimeout(() => {
            this.loadQRCode();
          }, 1000);
        } else {
          this.handleConnectionError('Error al actualizar el código QR');
        }
      },
      error: (error) => {
        console.error('❌ QR refresh error:', error);
        this.handleConnectionError('Error al actualizar el código QR');
      }
    });
  }

  /**
   * Reintentar conexión
   */
  retryConnection(): void {
    this.startConnection();
  }

  /**
   * Cancelar conexión
   */
  cancelConnection(): void {
    this.isConnecting.set(false);
    this.cleanup();
    
    // Intentar desconectar si está en proceso
    if (this.whatsappState()?.status === 'connecting' || this.whatsappState()?.status === 'initializing') {
      this.whatsappService.disconnect().subscribe({
        next: () => console.log('🔌 Connection cancelled'),
        error: (error) => console.error('❌ Cancel error:', error)
      });
    }
    
    this.closeModal();
  }

  /**
   * Cerrar modal
   */
  closeModal(): void {
    this.cleanup();
    this.onClose.emit();
  }

  /**
   * Limpiar recursos
   */
  private cleanup(): void {
    // Limpiar subscriptions
    this.whatsappStateSubscription?.unsubscribe();
    this.qrRefreshSubscription?.unsubscribe();
    this.statusCheckSubscription?.unsubscribe();

    // Limpiar suscripciones WebSocket
    this.websocketSubscriptions.forEach(sub => sub.unsubscribe());
    this.websocketSubscriptions = [];

    // Limpiar QR image URL
    this.clearQRImage();
  }

  /**
   * Limpiar imagen QR
   */
  private clearQRImage(): void {
    const currentUrl = this.qrImageUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      this.qrImageUrl.set(null);
    }
  }

  /**
   * Obtener icono del paso actual
   */
  getStepIcon(): string {
    switch (this.connectionStep()) {
      case 'initializing':
        return 'fas fa-cog fa-spin';
      case 'qr':
        return 'fas fa-qrcode';
      case 'connecting':
        return 'fas fa-spinner fa-spin';
      case 'connected':
        return 'fas fa-check-circle';
      case 'error':
        return 'fas fa-exclamation-triangle';
      default:
        return 'fas fa-question';
    }
  }

  /**
   * Obtener color del paso actual
   */
  getStepColor(): string {
    switch (this.connectionStep()) {
      case 'initializing':
      case 'connecting':
        return 'text-warning';
      case 'qr':
        return 'text-info';
      case 'connected':
        return 'text-success';
      case 'error':
        return 'text-danger';
      default:
        return 'text-secondary';
    }
  }

  /**
   * Verificar si puede reintentar
   */
  canRetry(): boolean {
    return this.connectionStep() === 'error' && !this.isConnecting();
  }

  /**
   * Verificar si puede cancelar
   */
  canCancel(): boolean {
    return this.connectionStep() !== 'connected' && this.connectionStep() !== 'error';
  }

  /**
   * Manejar QR cargado
   */
  onQrLoaded(imageUrl: string): void {
    console.log('📱 QR loaded in modal:', imageUrl);
  }

  /**
   * Manejar error de QR
   */
  onQrError(error: string): void {
    console.error('❌ QR error in modal:', error);
    this.handleConnectionError(error);
  }

  /**
   * Manejar refresh de QR
   */
  onQrRefresh(): void {
    console.log('🔄 QR refresh requested in modal');
  }

  /**
   * Manejar click en backdrop
   */
  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      if (!this.isConnecting()) {
        this.closeModal();
      }
    }
  }
}
