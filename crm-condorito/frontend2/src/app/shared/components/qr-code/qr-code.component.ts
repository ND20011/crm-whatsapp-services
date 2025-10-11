import { Component, inject, signal, OnInit, OnDestroy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { WhatsAppService } from '../../../core/services/whatsapp.service';

/**
 * Componente QR Code para WhatsApp
 * Maneja la visualización, auto-refresh y recarga manual del código QR
 */
@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss'
})
export class QrCodeComponent implements OnInit, OnDestroy {
  private whatsappService = inject(WhatsAppService);

  // Inputs
  public autoRefresh = input<boolean>(true);
  public refreshInterval = input<number>(30000); // 30 segundos por defecto
  public showRefreshButton = input<boolean>(true);
  public showInstructions = input<boolean>(true);
  public size = input<'small' | 'medium' | 'large'>('medium');
  
  // Outputs
  public onQrLoaded = output<string>();
  public onQrError = output<string>();
  public onQrRefresh = output<void>();

  // Signals
  public qrImageUrl = signal<string | null>(null);
  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string>('');
  public lastRefresh = signal<Date | null>(null);
  public timeUntilRefresh = signal<number>(0);

  // Subscriptions
  private autoRefreshSubscription?: Subscription;
  private countdownSubscription?: Subscription;

  ngOnInit(): void {
    this.loadQRCode();
    
    if (this.autoRefresh()) {
      this.startAutoRefresh();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Cargar código QR
   */
  loadQRCode(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.whatsappService.getQRImageUrl().subscribe({
      next: (imageUrl) => {
        this.clearCurrentQR();
        this.qrImageUrl.set(imageUrl);
        this.lastRefresh.set(new Date());
        this.isLoading.set(false);
        this.onQrLoaded.emit(imageUrl);
        
        if (this.autoRefresh()) {
          this.startCountdown();
        }
        
        console.log('📱 QR code loaded successfully');
      },
      error: (error) => {
        console.error('❌ QR load error:', error);
        const errorMsg = error.message || 'Error al cargar el código QR';
        this.errorMessage.set(errorMsg);
        this.isLoading.set(false);
        this.onQrError.emit(errorMsg);
      }
    });
  }

  /**
   * Refrescar QR manualmente
   */
  refreshQR(): void {
    this.onQrRefresh.emit();
    this.loadQRCode();
  }

  /**
   * Iniciar auto-refresh
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    
    this.autoRefreshSubscription = interval(this.refreshInterval()).subscribe(() => {
      console.log('🔄 Auto-refreshing QR code...');
      this.loadQRCode();
    });
  }

  /**
   * Detener auto-refresh
   */
  private stopAutoRefresh(): void {
    this.autoRefreshSubscription?.unsubscribe();
    this.stopCountdown();
  }

  /**
   * Iniciar countdown hasta próximo refresh
   */
  private startCountdown(): void {
    this.stopCountdown();
    
    const refreshTime = this.refreshInterval() / 1000; // Convertir a segundos
    this.timeUntilRefresh.set(refreshTime);
    
    this.countdownSubscription = interval(1000).subscribe(() => {
      const currentTime = this.timeUntilRefresh();
      if (currentTime > 0) {
        this.timeUntilRefresh.set(currentTime - 1);
      } else {
        this.stopCountdown();
      }
    });
  }

  /**
   * Detener countdown
   */
  private stopCountdown(): void {
    this.countdownSubscription?.unsubscribe();
    this.timeUntilRefresh.set(0);
  }

  /**
   * Limpiar QR actual
   */
  private clearCurrentQR(): void {
    const currentUrl = this.qrImageUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      this.qrImageUrl.set(null);
    }
  }

  /**
   * Limpiar recursos
   */
  private cleanup(): void {
    this.stopAutoRefresh();
    this.clearCurrentQR();
  }

  /**
   * Obtener clases CSS según el tamaño
   */
  getSizeClass(): string {
    switch (this.size()) {
      case 'small':
        return 'qr-small';
      case 'large':
        return 'qr-large';
      default:
        return 'qr-medium';
    }
  }

  /**
   * Formatear tiempo restante
   */
  getFormattedTimeUntilRefresh(): string {
    const seconds = this.timeUntilRefresh();
    if (seconds <= 0) return '';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  }

  /**
   * Obtener tiempo desde última actualización
   */
  getTimeSinceRefresh(): string {
    const lastRefresh = this.lastRefresh();
    if (!lastRefresh) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - lastRefresh.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s`;
    
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h`;
  }

  /**
   * Verificar si el QR está próximo a expirar
   */
  isQRExpiringSoon(): boolean {
    const timeLeft = this.timeUntilRefresh();
    return timeLeft > 0 && timeLeft <= 10; // Últimos 10 segundos
  }

  /**
   * Pausar auto-refresh
   */
  pauseAutoRefresh(): void {
    this.stopAutoRefresh();
  }

  /**
   * Reanudar auto-refresh
   */
  resumeAutoRefresh(): void {
    if (this.autoRefresh()) {
      this.startAutoRefresh();
    }
  }

  /**
   * Verificar si hay error
   */
  hasError(): boolean {
    return !!this.errorMessage();
  }

  /**
   * Verificar si está cargando
   */
  isLoadingQR(): boolean {
    return this.isLoading();
  }

  /**
   * Verificar si tiene QR válido
   */
  hasValidQR(): boolean {
    return !!this.qrImageUrl() && !this.hasError();
  }
}
