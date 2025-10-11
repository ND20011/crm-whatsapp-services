import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { APP_CONFIG } from '../../../core/config/app.config';

/**
 * Componente para gestionar las notificaciones push en la UI.
 * Muestra el estado de soporte, permisos y suscripción, y permite al usuario
 * activar/desactivar las notificaciones.
 */
@Component({
  selector: 'app-push-notification-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './push-notification-manager.component.html',
  styleUrl: './push-notification-manager.component.scss'
})
export class PushNotificationManagerComponent implements OnInit, OnDestroy {
  private pushService = inject(PushNotificationService);
  private subscriptions: Subscription[] = [];

  // Signals para el estado de la UI
  public isSupported = this.pushService.isSupported;
  public isSubscribed = this.pushService.isSubscribed;
  public permission = this.pushService.permission;
  public isLoading = signal<boolean>(false);
  public statusMessage = signal<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  ngOnInit(): void {
    // No es necesario hacer nada aquí ya que el servicio se inicializa en el constructor
    // y los signals se actualizan automáticamente.
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Suscribirse a notificaciones
   */
  subscribeToNotifications(): void {
    this.isLoading.set(true);
    this.clearStatus();

    const subscription = this.pushService.subscribeToNotifications().subscribe({
      next: (success) => {
        this.isLoading.set(false);
        if (success) {
          this.showStatus('¡Notificaciones push activadas correctamente!', 'success');
        } else {
          this.showStatus('Error al activar las notificaciones push', 'error');
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Error subscribing to notifications:', error);
        this.showStatus('Error al activar las notificaciones push', 'error');
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Desuscribirse de notificaciones
   */
  unsubscribeFromNotifications(): void {
    this.isLoading.set(true);
    this.clearStatus();

    const subscription = this.pushService.unsubscribeFromNotifications().subscribe({
      next: (success) => {
        this.isLoading.set(false);
        if (success) {
          this.showStatus('Notificaciones push desactivadas correctamente.', 'info');
        } else {
          this.showStatus('Error al desactivar las notificaciones push', 'error');
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Error unsubscribing from notifications:', error);
        this.showStatus('Error al desactivar las notificaciones push', 'error');
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Enviar notificación de prueba
   */
  sendTestNotification(): void {
    this.isLoading.set(true);
    this.clearStatus();

    const token = this.pushService['authService'].getToken();
    if (!token) {
      this.showStatus('No hay token de autenticación para enviar notificación de prueba.', 'error');
      this.isLoading.set(false);
      return;
    }

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const testData = {
      title: 'Notificacion de Prueba',
      body: 'Esta es una notificacion de prueba desde el CRM Condorito!'
    };

    console.log('🔔 Sending test notification to backend...');

    this.pushService['http'].post<any>(
      `${APP_CONFIG.api.baseUrl}/api/push-notifications/test`,
      testData,
      { headers }
    ).pipe(
      tap(response => {
        this.isLoading.set(false);
        console.log('🔔 Test notification response:', response);
        if (response.success) {
          this.showStatus('Notificacion de prueba enviada correctamente al backend.', 'success');
          
          // También mostrar una notificación local como feedback
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Prueba Exitosa', {
              body: 'El backend procesó la notificación correctamente',
              icon: '/icon-192x192.png'
            });
          }
        } else {
          this.showStatus('Error al enviar notificacion de prueba: ' + response.message, 'error');
        }
      }),
      catchError(error => {
        this.isLoading.set(false);
        console.error('❌ Error sending test notification:', error);
        this.showStatus('Error al enviar notificacion de prueba al backend', 'error');
        return of(false);
      })
    ).subscribe();
  }

  /**
   * Muestra un mensaje de estado en la UI.
   * @param message El mensaje a mostrar.
   * @param type El tipo de mensaje (success, error, info).
   */
  private showStatus(message: string, type: 'success' | 'error' | 'info'): void {
    this.statusMessage.set({ message, type });
    setTimeout(() => this.statusMessage.set(null), 5000); // Ocultar después de 5 segundos
  }

  /**
   * Limpia el mensaje de estado.
   */
  private clearStatus(): void {
    this.statusMessage.set(null);
  }
}