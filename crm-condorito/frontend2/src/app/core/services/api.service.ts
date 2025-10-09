import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, retry, finalize } from 'rxjs/operators';
import { APP_CONFIG } from '../config/app.config';

/**
 * Servicio base para todas las llamadas a la API
 * Centraliza la configuración HTTP y manejo de errores
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = APP_CONFIG.api.baseUrl;
  
  // Subject para manejar el estado de loading global
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  /**
   * Obtener headers por defecto con token de autenticación
   */
  private getHeaders(includeAuth: boolean = true, includeContentType: boolean = true): HttpHeaders {
    let headers = new HttpHeaders({
      'Accept': 'application/json'
    });

    if (includeContentType) {
      headers = headers.set('Content-Type', 'application/json');
    }

    if (includeAuth) {
      const token = this.getStoredToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  /**
   * Obtener token almacenado en localStorage
   */
  private getStoredToken(): string | null {
    return localStorage.getItem(APP_CONFIG.storage.tokenKey);
  }

  /**
   * Construir URL completa
   */
  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  /**
   * Manejar errores HTTP
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      errorMessage = error.error?.message || `Error ${error.status}: ${error.statusText}`;
      
      // Si es error 401, limpiar tokens y redirigir al login
      if (error.status === 401) {
        this.clearAuthData();
        // Aquí podrías emitir un evento para redirigir al login
      }
    }

    console.error('API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Limpiar datos de autenticación
   */
  private clearAuthData(): void {
    localStorage.removeItem(APP_CONFIG.storage.tokenKey);
    localStorage.removeItem(APP_CONFIG.storage.userKey);
    localStorage.removeItem(APP_CONFIG.storage.refreshTokenKey);
  }

  /**
   * Actualizar estado de loading
   */
  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  /**
   * GET request
   */
  get<T>(endpoint: string, options?: { params?: any, includeAuth?: boolean }): Observable<T> {
    this.setLoading(true);
    
    const { params, includeAuth = true } = options || {};
    
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }

    return this.http.get<T>(this.buildUrl(endpoint), {
      headers: this.getHeaders(includeAuth),
      params: httpParams
    }).pipe(
      retry(1),
      catchError(this.handleError.bind(this)),
      // Finalizar loading en complete o error
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * GET request para blob (imágenes, archivos)
   */
  getBlob(endpoint: string, options?: { params?: any, includeAuth?: boolean }): Observable<Blob> {
    this.setLoading(true);
    
    const { params, includeAuth = true } = options || {};
    
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }

    return this.http.get(this.buildUrl(endpoint), {
      headers: this.getHeaders(includeAuth),
      params: httpParams,
      responseType: 'blob'
    }).pipe(
      retry(1),
      catchError(this.handleError.bind(this)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, data: any, includeAuth: boolean = true): Observable<T> {
    this.setLoading(true);
    
    return this.http.post<T>(this.buildUrl(endpoint), data, {
      headers: this.getHeaders(includeAuth)
    }).pipe(
      catchError(this.handleError.bind(this)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * POST request para FormData (archivos)
   */
  postFormData<T>(endpoint: string, formData: FormData, includeAuth: boolean = true): Observable<T> {
    this.setLoading(true);
    
    // Para FormData, no incluir Content-Type header (el navegador lo establece automáticamente)
    const headers = this.getHeaders(includeAuth, false);
    
    return this.http.post<T>(this.buildUrl(endpoint), formData, {
      headers: headers
    }).pipe(
      catchError(this.handleError.bind(this)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, data: any, includeAuth: boolean = true): Observable<T> {
    this.setLoading(true);
    
    return this.http.put<T>(this.buildUrl(endpoint), data, {
      headers: this.getHeaders(includeAuth)
    }).pipe(
      catchError(this.handleError.bind(this)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, data: any, includeAuth: boolean = true): Observable<T> {
    this.setLoading(true);
    
    return this.http.patch<T>(this.buildUrl(endpoint), data, {
      headers: this.getHeaders(includeAuth)
    }).pipe(
      catchError(this.handleError.bind(this)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string, includeAuth: boolean = true): Observable<T> {
    this.setLoading(true);
    
    return this.http.delete<T>(this.buildUrl(endpoint), {
      headers: this.getHeaders(includeAuth)
    }).pipe(
      catchError(this.handleError.bind(this)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Verificar si hay token válido
   */
  hasValidToken(): boolean {
    return !!this.getStoredToken();
  }

  /**
   * Obtener configuración de la aplicación
   */
  getConfig() {
    return APP_CONFIG;
  }
}

// Operador personalizado para finalizar loading ya importado arriba
