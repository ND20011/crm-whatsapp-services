import { Injectable, inject, signal } from '@angular/core';
import { SwPush, SwUpdate } from '@angular/service-worker';
import { Observable, BehaviorSubject, from, EMPTY, of, timer, race, throwError } from 'rxjs';
import { map, catchError, tap, switchMap, filter } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG } from '../config/app.config';
import { AuthService } from '../../features/auth/services/auth.service';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  client_code: string;
  user_id: number;
}

export interface PushNotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

/**
 * Servicio para gestionar notificaciones push en la PWA
 * Maneja suscripciones, permisos y notificaciones push
 */
@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private swPush = inject(SwPush);
  private swUpdate = inject(SwUpdate);

  // VAPID public key - debe coincidir con el backend
  private readonly VAPID_PUBLIC_KEY = 'BDSbebZd-j-TMgkUCtUWgvZ9OwURp7jho4DWGhUOZmFSg30UsmrccyxmDw3JytUcT9E_5NCrbWE39l7mWegGV0Y';

  // Signals para estado reactivo
  public isSupported = signal<boolean>(false);
  public isSubscribed = signal<boolean>(false);
  public permission = signal<PushNotificationPermission>({
    granted: false,
    denied: false,
    default: true
  });

  // Subjects para eventos
  private notificationSubject = new BehaviorSubject<any>(null);
  private subscriptionSubject = new BehaviorSubject<PushSubscription | null>(null);

  constructor() {
    this.initializeService();
  }

  /**
   * Inicializar el servicio
   */
  private initializeService(): void {
    // Verificar soporte para notificaciones push
    const isSupported = this.swPush.isEnabled && 'Notification' in window;
    this.isSupported.set(isSupported);

    if (!isSupported) {
      console.warn('🚫 Push notifications not supported');
      return;
    }

    // Verificar permisos actuales
    this.checkPermissions();

    // Verificar suscripción existente
    this.checkExistingSubscription();

    // Escuchar mensajes push
    this.listenToPushMessages();

    // Escuchar clicks en notificaciones
    this.listenToNotificationClicks();
  }

  /**
   * Verificar permisos de notificaciones
   */
  private checkPermissions(): void {
    if (!('Notification' in window)) return;

    const permission = Notification.permission;
    this.permission.set({
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default'
    });
  }

  /**
   * Verificar suscripción existente
   */
  private checkExistingSubscription(): void {
    if (!this.swPush.isEnabled) return;

    this.swPush.subscription.subscribe(subscription => {
      this.isSubscribed.set(!!subscription);
      this.subscriptionSubject.next(subscription);
    });
  }

  /**
   * Escuchar mensajes push
   */
  private listenToPushMessages(): void {
    if (!this.swPush.isEnabled) return;

    this.swPush.messages.subscribe(message => {
      console.log('📨 Push message received:', message);
      this.notificationSubject.next(message);
    });
  }

  /**
   * Escuchar clicks en notificaciones
   */
  private listenToNotificationClicks(): void {
    if (!this.swPush.isEnabled) return;

    this.swPush.notificationClicks.subscribe(click => {
      console.log('👆 Notification clicked:', click);
      // Aquí puedes manejar la navegación o acciones específicas
      if (click.notification.data?.url) {
        window.open(click.notification.data.url, '_blank');
      }
    });
  }

  /**
   * Solicitar permisos para notificaciones
   */
  requestPermission(): Observable<boolean> {
    if (!('Notification' in window)) {
      console.warn('🚫 Notifications not supported');
      return of(false);
    }

    if (Notification.permission === 'granted') {
      this.checkPermissions();
      return of(true);
    }

    return from(Notification.requestPermission()).pipe(
      map(permission => {
        this.checkPermissions();
        return permission === 'granted';
      }),
      catchError(error => {
        console.error('❌ Error requesting notification permission:', error);
        return of(false);
      })
    );
  }

  /**
   * Suscribirse a notificaciones push
   */
  subscribeToNotifications(): Observable<boolean> {
    console.log('🔔 Starting push notification subscription...');
    
    if (!this.swPush.isEnabled) {
      console.warn('🚫 Service Worker not enabled');
      return of(false);
    }

    console.log('🔔 Service Worker is enabled, requesting permission...');
    
    return this.requestPermission().pipe(
      tap(hasPermission => {
        console.log('🔔 Permission result:', hasPermission);
      }),
      switchMap(hasPermission => {
        if (!hasPermission) {
          console.error('🚫 Permission denied for push notifications');
          throw new Error('Permission denied');
        }

        console.log('🔔 Requesting subscription from browser...');
        return this.swPush.requestSubscription({
          serverPublicKey: this.VAPID_PUBLIC_KEY
        });
      }),
      tap(subscription => {
        console.log('🔔 Browser subscription received:', subscription);
      }),
      switchMap(subscription => {
        console.log('🔔 Sending subscription to server...');
        return this.sendSubscriptionToServer(subscription);
      }),
      tap(success => {
        if (success) {
          this.isSubscribed.set(true);
          console.log('✅ Successfully subscribed to push notifications');
        } else {
          console.error('❌ Failed to subscribe to push notifications');
        }
      }),
      catchError(error => {
        console.error('❌ Error subscribing to push notifications:', error);
        return of(false);
      })
    );
  }

  /**
   * Desuscribirse de notificaciones push
   */
  unsubscribeFromNotifications(): Observable<boolean> {
    if (!this.swPush.isEnabled) {
      return of(false);
    }

    return from(this.swPush.unsubscribe()).pipe(
      switchMap((success:any) => {
        if (success) {
          return this.removeSubscriptionFromServer();
        }
        return of(false);
      }),
      tap(success => {
        if (success) {
          this.isSubscribed.set(false);
          console.log('✅ Successfully unsubscribed from push notifications');
        }
      }),
      catchError(error => {
        console.error('❌ Error unsubscribing from push notifications:', error);
        return of(false);
      })
    );
  }

  /**
   * Enviar suscripción al servidor
   */
  private sendSubscriptionToServer(subscription: PushSubscription): Observable<boolean> {
    console.log('🔔 Preparing subscription data for server...');
    
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log('🔔 User authenticated:', user.client_code);

    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
      },
      client_code: user.client_code,
      user_id: user.id
    };

    console.log('🔔 Sending subscription to server:', {
      endpoint: subscriptionData.endpoint.substring(0, 50) + '...',
      client_code: subscriptionData.client_code,
      user_id: subscriptionData.user_id
    });

    return this.http.post<any>(`${APP_CONFIG.api.baseUrl}/api/push-notifications/subscribe`, subscriptionData).pipe(
      tap(response => {
        console.log('🔔 Server response:', response);
      }),
      map(response => response.success),
      catchError(error => {
        console.error('❌ Error sending subscription to server:', error);
        return of(false);
      })
    );
  }

  /**
   * Remover suscripción del servidor
   */
  private removeSubscriptionFromServer(): Observable<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return of(false);
    }

    return this.http.delete<any>(`${APP_CONFIG.api.baseUrl}/api/push-notifications/unsubscribe/${user.client_code}`).pipe(
      map(response => response.success),
      catchError(error => {
        console.error('❌ Error removing subscription from server:', error);
        return of(false);
      })
    );
  }

  /**
   * Obtener observable de mensajes push
   */
  getPushMessages(): Observable<any> {
    return this.notificationSubject.asObservable().pipe(
      filter(message => message !== null)
    );
  }

  /**
   * Obtener observable de suscripción
   */
  getSubscription(): Observable<PushSubscription | null> {
    return this.subscriptionSubject.asObservable();
  }

  /**
   * Mostrar notificación local (fallback)
   */
  showLocalNotification(title: string, options?: NotificationOptions): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('🚫 Cannot show local notification');
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/icon-192x192.png',
      badge: '/favicon.ico',
      tag: 'crm-notification',
      requireInteraction: true,
      ...options
    };

    new Notification(title, defaultOptions);
  }

  /**
   * Verificar y actualizar service worker
   */
  checkForUpdates(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe(event => {
      switch (event.type) {
        case 'VERSION_DETECTED':
          console.log('🔄 New version detected');
          break;
        case 'VERSION_READY':
          console.log('✅ New version ready');
          if (confirm('Nueva versión disponible. ¿Desea actualizar?')) {
            this.swUpdate.activateUpdate().then(() => {
              window.location.reload();
            });
          }
          break;
        case 'VERSION_INSTALLATION_FAILED':
          console.error('❌ Version installation failed');
          break;
      }
    });

    // Verificar actualizaciones cada 6 horas
    setInterval(() => {
      this.swUpdate.checkForUpdate();
    }, 6 * 60 * 60 * 1000);
  }
}
