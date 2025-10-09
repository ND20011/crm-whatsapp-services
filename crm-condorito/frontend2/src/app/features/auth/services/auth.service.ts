import { Injectable, inject, signal } from '@angular/core';
import { Observable, BehaviorSubject, tap, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { StorageService } from '../../../core/services/storage.service';
import { APP_CONFIG } from '../../../core/config/app.config';
import { LoginRequest, LoginResponse, User, ApiResponse } from '../../../core/models/api.models';

/**
 * Servicio de autenticación
 * Maneja login, logout, verificación de tokens y estado del usuario
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiService = inject(ApiService);
  private storageService = inject(StorageService);
  private router = inject(Router);

  // Signals para manejo reactivo del estado
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  // Observables públicos
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  // Signals
  public isLoggedIn = signal<boolean>(false);
  public currentUser = signal<User | null>(null);

  constructor() {
    this.initializeAuthState();
  }

  /**
   * Inicializar estado de autenticación al cargar la aplicación
   */
  private initializeAuthState(): void {
    const user = this.storageService.getUser();
    const token = this.storageService.getAccessToken();
    
    if (user && token) {
      this.setAuthenticatedUser(user);
    }
  }

  /**
   * Establecer usuario autenticado
   */
  private setAuthenticatedUser(user: User): void {
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
    this.currentUser.set(user);
    this.isLoggedIn.set(true);
  }

  /**
   * Limpiar estado de autenticación
   */
  private clearAuthenticatedUser(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
  }

  /**
   * Iniciar sesión
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.apiService.post<LoginResponse>(
      APP_CONFIG.api.endpoints.auth.login,
      credentials,
      false // No incluir auth header en login
    ).pipe(
      tap((response: LoginResponse) => {
        console.log('🔍 AuthService received response:', response);
        if (response.success && response.tokens && response.client) {
          console.log('🔍 Saving tokens and user data...');
          // Guardar tokens y usuario
          this.storageService.setAccessToken(response.tokens.accessToken);
          this.storageService.setRefreshToken(response.tokens.refreshToken);
          this.storageService.setUser(response.client);
          
          // Actualizar estado
          this.setAuthenticatedUser(response.client);
          
          console.log('✅ Login successful for:', response.client.client_code);
          console.log('✅ User authenticated state updated');
        } else {
          console.error('❌ Invalid response structure:', response);
        }
      }),
      catchError((error) => {
        console.error('❌ Login failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cerrar sesión
   */
  logout(): Observable<any> {
    return this.apiService.post(APP_CONFIG.api.endpoints.auth.logout, {}).pipe(
      tap(() => {
        this.performLogout();
      }),
      catchError((error) => {
        // Incluso si falla la llamada al servidor, limpiar localmente
        console.warn('Logout API failed, clearing local data:', error);
        this.performLogout();
        return throwError(() => error);
      })
    );
  }

  /**
   * Realizar logout local
   */
  private performLogout(): void {
    this.storageService.clearAuthData();
    this.clearAuthenticatedUser();
    this.router.navigate(['/auth/login']);
    console.log('🚪 User logged out');
  }

  /**
   * Logout inmediato (sin llamada al servidor)
   */
  logoutImmediate(): void {
    this.performLogout();
  }

  /**
   * Verificar token actual
   */
  verifyToken(): Observable<ApiResponse<User>> {
    return this.apiService.get<ApiResponse<User>>(APP_CONFIG.api.endpoints.auth.verify).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.storageService.setUser(response.data);
          this.setAuthenticatedUser(response.data);
        }
      }),
      catchError((error) => {
        console.error('❌ Token verification failed:', error);
        this.logoutImmediate();
        return throwError(() => error);
      })
    );
  }

  /**
   * Refrescar token
   */
  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.storageService.getRefreshToken();
    
    if (!refreshToken) {
      this.logoutImmediate();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.apiService.post<LoginResponse>(
      APP_CONFIG.api.endpoints.auth.refresh,
      { refreshToken },
      false
    ).pipe(
      tap((response: LoginResponse) => {
        if (response.success && response.tokens) {
          this.storageService.setAccessToken(response.tokens.accessToken);
          this.storageService.setRefreshToken(response.tokens.refreshToken);
          
          if (response.client) {
            this.storageService.setUser(response.client);
            this.setAuthenticatedUser(response.client);
          }
        }
      }),
      catchError((error) => {
        console.error('❌ Token refresh failed:', error);
        this.logoutImmediate();
        return throwError(() => error);
      })
    );
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.storageService.isAuthenticated();
  }

  /**
   * Obtener usuario actual
   */
  getCurrentUser(): User | null {
    return this.storageService.getUser();
  }

  /**
   * Obtener token actual
   */
  getToken(): string | null {
    return this.storageService.getAccessToken();
  }

  /**
   * Verificar si el token ha expirado (básico)
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000; // Convertir a milliseconds
      return Date.now() > expiry;
    } catch (error) {
      console.error('Error parsing token:', error);
      return true;
    }
  }

  /**
   * Obtener información del cliente actual
   */
  getClientCode(): string | null {
    const user = this.getCurrentUser();
    return user ? user.client_code : null;
  }

  /**
   * Verificar si el usuario tiene permisos específicos (para futuras expansiones)
   */
  hasPermission(permission: string): boolean {
    // Por ahora, todos los usuarios autenticados tienen todos los permisos
    return this.isAuthenticated();
  }
}
