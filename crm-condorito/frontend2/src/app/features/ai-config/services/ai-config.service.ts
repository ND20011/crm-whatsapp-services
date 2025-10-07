import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, retry } from 'rxjs/operators';
import { APP_CONFIG } from '../../../core/config/app.config';

/**
 * 🧠 Servicio para gestionar configuraciones de IA
 */

export interface AIConfiguration {
  enabled: boolean;
  ai_mode: 'prompt_only' | 'database_search';
  business_prompt: string;
  max_tokens: number;
  temperature: number;
  maxHistoryMessages: number;
  responseTimeout: number;
  fallbackMessage: string;
  workingHours: {
    enabled: boolean;
    start: string;
    end: string;
    days: number[];
  };
}

export interface AIMode {
  modes: {
    PROMPT_ONLY: string;
    DATABASE_SEARCH: string;
  };
  descriptions: {
    [key: string]: string;
  };
}

export interface AITestResponse {
  input_message: string;
  ai_response: string;
  timestamp: string;
  quotaUsed: number;
  quotaLimit: number;
  quotaRemaining: number;
  tokensUsed: number;
  tokenLimit: number;
  tokensRemaining: number;
  tokenDetails: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIHealthCheck {
  status: string;
  service: string;
  url: string;
  model: string;
  timestamp: string;
  available: boolean;
}

export interface AIStats {
  total_ai_messages: number;
  avg_message_length: number;
  conversations_with_ai: number;
  first_ai_message: string | null;
  last_ai_message: string | null;
  period_hours: number;
  client_code: string;
}

@Injectable({
  providedIn: 'root'
})
export class AIConfigService {
  private configSubject = new BehaviorSubject<AIConfiguration | null>(null);
  public config$ = this.configSubject.asObservable();
  private readonly baseUrl = APP_CONFIG.api.baseUrl;

  constructor(
    private http: HttpClient
  ) {}

  /**
   * Obtener headers con autenticación
   */
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem(APP_CONFIG.storage.tokenKey);
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  /**
   * Manejar errores HTTP
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ha ocurrido un error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      if (error.status === 401) {
        errorMessage = 'No autorizado. Por favor inicia sesión nuevamente.';
      } else if (error.status === 403) {
        errorMessage = 'No tienes permisos para realizar esta acción.';
      } else if (error.status === 404) {
        errorMessage = 'El recurso solicitado no fue encontrado.';
      } else if (error.status === 500) {
        errorMessage = 'Error interno del servidor. Por favor intenta más tarde.';
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = `Error del servidor: ${error.status} - ${error.statusText}`;
      }
    }
    
    console.error('AIConfigService Error:', error);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Obtener configuración actual de IA
   */
  getConfig(): Observable<{ success: boolean; data: AIConfiguration }> {
    return this.http.get<{ success: boolean; data: AIConfiguration }>(`${this.baseUrl}/api/ai/config`, {
      headers: this.getHeaders()
    }).pipe(
      retry(1),
      tap(response => {
        if (response.success) {
          this.configSubject.next(response.data);
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Actualizar configuración de IA
   */
  updateConfig(config: Partial<AIConfiguration>): Observable<{ success: boolean; message: string; data: AIConfiguration }> {
    return this.http.put<{ success: boolean; message: string; data: AIConfiguration }>(
      `${this.baseUrl}/api/ai/config`,
      config,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.configSubject.next(response.data);
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Probar configuración con un mensaje
   */
  testConfig(message: string): Observable<{ success: boolean; data: AITestResponse }> {
    console.log('🔍 AIConfigService.testConfig called with:', message);
    return this.http.post<{ success: boolean; data: AITestResponse }>(
      `${this.baseUrl}/api/ai/test`,
      { message },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => console.log('🔍 AIConfigService.testConfig response:', response)),
      catchError(error => {
        console.error('❌ AIConfigService.testConfig error:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Obtener modos de IA disponibles
   */
  getModes(): Observable<{ success: boolean; data: AIMode }> {
    return this.http.get<{ success: boolean; data: AIMode }>(`${this.baseUrl}/api/ai/modes`, {
      headers: this.getHeaders()
    }).pipe(
      retry(1),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Health check del servicio de IA
   */
  healthCheck(): Observable<{ success: boolean; data: AIHealthCheck }> {
    return this.http.get<{ success: boolean; data: AIHealthCheck }>(`${this.baseUrl}/api/ai/health`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Obtener estadísticas de uso de IA
   */
  getStats(hours: number = 24): Observable<{ success: boolean; data: AIStats }> {
    return this.http.get<{ success: boolean; data: AIStats }>(`${this.baseUrl}/api/ai/stats?hours=${hours}`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Resetear configuración a valores por defecto
   */
  resetConfig(): Observable<{ success: boolean; message: string; data: AIConfiguration }> {
    return this.http.post<{ success: boolean; message: string; data: AIConfiguration }>(
      `${this.baseUrl}/api/ai/reset`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.configSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Obtener configuración actual del cache
   */
  getCurrentConfig(): AIConfiguration | null {
    return this.configSubject.value;
  }

  /**
   * Limpiar cache de configuración
   */
  clearCache(): void {
    this.configSubject.next(null);
  }
}
