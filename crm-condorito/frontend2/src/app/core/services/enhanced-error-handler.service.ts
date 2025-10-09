import { Injectable, inject } from '@angular/core';
import { Observable, throwError, timer, EMPTY } from 'rxjs';
import { 
  retry, 
  retryWhen, 
  delay, 
  take, 
  concat, 
  catchError,
  tap,
  switchMap
} from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

export interface RetryConfig {
  maxRetries: number;
  delayMs: number;
  exponentialBackoff?: boolean;
  retryCondition?: (error: any) => boolean;
}

export interface ErrorContext {
  operation: string;
  timestamp: Date;
  userAgent: string;
  url?: string;
  userId?: string;
}

export interface ErrorReport {
  error: any;
  context: ErrorContext;
  retryCount: number;
  resolved: boolean;
}

/**
 * Servicio mejorado de manejo de errores
 * Incluye retry logic, logging, y recuperación automática
 */
@Injectable({
  providedIn: 'root'
})
export class EnhancedErrorHandlerService {
  private errorReports: ErrorReport[] = [];
  private readonly MAX_ERROR_REPORTS = 100;

  // Configuraciones por defecto para diferentes tipos de operaciones
  private readonly DEFAULT_CONFIGS = {
    api: {
      maxRetries: 3,
      delayMs: 1000,
      exponentialBackoff: true,
      retryCondition: (error: any) => this.isRetryableError(error)
    },
    upload: {
      maxRetries: 2,
      delayMs: 2000,
      exponentialBackoff: true,
      retryCondition: (error: any) => this.isNetworkError(error)
    },
    critical: {
      maxRetries: 5,
      delayMs: 500,
      exponentialBackoff: true,
      retryCondition: () => true
    }
  };

  /**
   * Wrapper para operaciones con retry automático
   */
  withRetry<T>(
    operation: () => Observable<T>,
    context: Partial<ErrorContext>,
    configType: keyof typeof this.DEFAULT_CONFIGS = 'api'
  ): Observable<T> {
    const config = this.DEFAULT_CONFIGS[configType];
    const fullContext: ErrorContext = {
      operation: context.operation || 'unknown',
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      ...context
    };

    let retryCount = 0;

    return operation().pipe(
      retryWhen(errors => 
        errors.pipe(
          tap(error => {
            retryCount++;
            this.logError(error, fullContext, retryCount);
          }),
          switchMap(error => {
            // Verificar si debemos reintentar
            if (retryCount >= config.maxRetries || !config.retryCondition!(error)) {
              return throwError(() => error);
            }

            // Calcular delay
            const delayTime = config.exponentialBackoff 
              ? config.delayMs * Math.pow(2, retryCount - 1)
              : config.delayMs;

            console.warn(`Reintentando operación "${fullContext.operation}" en ${delayTime}ms (intento ${retryCount}/${config.maxRetries})`);
            
            return timer(delayTime);
          }),
          take(config.maxRetries)
        )
      ),
      tap(() => {
        // Operación exitosa después de reintentos
        if (retryCount > 0) {
          console.info(`Operación "${fullContext.operation}" exitosa después de ${retryCount} reintentos`);
          this.markErrorAsResolved(fullContext, retryCount);
        }
      }),
      catchError(error => {
        // Error final después de todos los reintentos
        this.handleFinalError(error, fullContext, retryCount);
        return throwError(() => error);
      })
    );
  }

  /**
   * Manejo específico para errores de API
   */
  handleApiError<T>(
    operation: () => Observable<T>,
    operationName: string,
    fallbackValue?: T
  ): Observable<T> {
    return this.withRetry(
      operation,
      { operation: operationName },
      'api'
    ).pipe(
      catchError(error => {
        if (fallbackValue !== undefined) {
          console.warn(`Usando valor fallback para operación "${operationName}"`);
          return new Observable<T>(observer => {
            observer.next(fallbackValue);
            observer.complete();
          });
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Manejo específico para uploads de archivos
   */
  handleFileUpload<T>(
    uploadOperation: () => Observable<T>,
    fileName: string
  ): Observable<T> {
    return this.withRetry(
      uploadOperation,
      { 
        operation: `upload_${fileName}`,
        url: fileName 
      },
      'upload'
    );
  }

  /**
   * Verificar si un error es reintentable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof HttpErrorResponse) {
      // Errores de red o servidor temporal
      return error.status >= 500 || 
             error.status === 0 || 
             error.status === 408 || 
             error.status === 429;
    }
    
    // Errores de red
    return this.isNetworkError(error);
  }

  /**
   * Verificar si es un error de red
   */
  private isNetworkError(error: any): boolean {
    return error instanceof TypeError ||
           error.message?.includes('Network') ||
           error.message?.includes('fetch') ||
           error.name === 'NetworkError';
  }

  /**
   * Logging de errores
   */
  private logError(error: any, context: ErrorContext, retryCount: number): void {
    const errorReport: ErrorReport = {
      error: this.serializeError(error),
      context,
      retryCount,
      resolved: false
    };

    this.errorReports.push(errorReport);
    
    // Mantener solo los últimos errores
    if (this.errorReports.length > this.MAX_ERROR_REPORTS) {
      this.errorReports.shift();
    }

    // Log detallado en desarrollo
    if (!environment.production) {
      console.group(`🔄 Error en operación: ${context.operation} (Intento ${retryCount})`);
      console.error('Error:', error);
      console.info('Contexto:', context);
      console.groupEnd();
    }
  }

  /**
   * Manejo de error final
   */
  private handleFinalError(error: any, context: ErrorContext, retryCount: number): void {
    console.group(`❌ Error final en operación: ${context.operation}`);
    console.error('Error después de', retryCount, 'reintentos:', error);
    console.info('Contexto:', context);
    console.groupEnd();

    // Aquí se podría enviar a un servicio de logging externo
    this.sendErrorToLoggingService(error, context, retryCount);
  }

  /**
   * Marcar error como resuelto
   */
  private markErrorAsResolved(context: ErrorContext, retryCount: number): void {
    const report = this.errorReports
      .reverse()
      .find(r => r.context.operation === context.operation && !r.resolved);
    
    if (report) {
      report.resolved = true;
    }
  }

  /**
   * Serializar error para logging
   */
  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    
    if (error instanceof HttpErrorResponse) {
      return {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        url: error.url
      };
    }
    
    return error;
  }

  /**
   * Enviar error a servicio de logging (placeholder)
   */
  private sendErrorToLoggingService(error: any, context: ErrorContext, retryCount: number): void {
    // Implementar integración con servicio de logging externo
    // Por ejemplo: Sentry, LogRocket, etc.
    console.info('📊 Error enviado a servicio de logging:', {
      error: this.serializeError(error),
      context,
      retryCount
    });
  }

  /**
   * Obtener estadísticas de errores
   */
  getErrorStats(): {
    totalErrors: number;
    resolvedErrors: number;
    unresolvedErrors: number;
    mostCommonOperations: Array<{ operation: string; count: number }>;
    recentErrors: ErrorReport[];
  } {
    const totalErrors = this.errorReports.length;
    const resolvedErrors = this.errorReports.filter(r => r.resolved).length;
    const unresolvedErrors = totalErrors - resolvedErrors;
    
    // Contar operaciones más comunes
    const operationCounts = new Map<string, number>();
    this.errorReports.forEach(report => {
      const operation = report.context.operation;
      operationCounts.set(operation, (operationCounts.get(operation) || 0) + 1);
    });
    
    const mostCommonOperations = Array.from(operationCounts.entries())
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentErrors = this.errorReports
      .slice(-10)
      .reverse();

    return {
      totalErrors,
      resolvedErrors,
      unresolvedErrors,
      mostCommonOperations,
      recentErrors
    };
  }

  /**
   * Limpiar historial de errores
   */
  clearErrorHistory(): void {
    this.errorReports.length = 0;
  }

  /**
   * Crear un handler específico para una operación
   */
  createOperationHandler<T>(
    operationName: string,
    config?: Partial<RetryConfig>
  ): {
    execute: (operation: () => Observable<T>) => Observable<T>;
    getStats: () => { attempts: number; successes: number; failures: number };
  } {
    let attempts = 0;
    let successes = 0;
    let failures = 0;

    const customConfig = config ? { ...this.DEFAULT_CONFIGS.api, ...config } : this.DEFAULT_CONFIGS.api;

    return {
      execute: (operation: () => Observable<T>) => {
        attempts++;
        return this.withRetry(
          operation,
          { operation: operationName },
          'api'
        ).pipe(
          tap(() => successes++),
          catchError(error => {
            failures++;
            return throwError(() => error);
          })
        );
      },
      getStats: () => ({ attempts, successes, failures })
    };
  }
}

// Placeholder para environment (debería importarse desde el archivo de environment real)
const environment = { production: false };
