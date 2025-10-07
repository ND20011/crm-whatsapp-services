import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Tipos de error
 */
export type ErrorType = 'network' | 'authentication' | 'whatsapp' | 'validation' | 'server' | 'unknown';

/**
 * Severidad del error
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Interfaz para errores estructurados
 */
export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  title: string;
  message: string;
  details?: string;
  timestamp: Date;
  context?: string;
  retryable: boolean;
  autoHide: boolean;
  duration?: number;
}

/**
 * Servicio centralizado para manejo de errores
 * Proporciona funcionalidades para capturar, procesar y mostrar errores
 */
@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  
  // Estado de errores
  private errorsSubject = new BehaviorSubject<AppError[]>([]);
  public errors$ = this.errorsSubject.asObservable();
  
  // Signals
  public currentErrors = signal<AppError[]>([]);
  public hasErrors = signal<boolean>(false);
  public criticalErrors = signal<AppError[]>([]);

  constructor() {
    // Sincronizar BehaviorSubject con signals
    this.errors$.subscribe(errors => {
      this.currentErrors.set(errors);
      this.hasErrors.set(errors.length > 0);
      this.criticalErrors.set(errors.filter(e => e.severity === 'critical'));
    });
  }

  /**
   * Manejar error genérico
   */
  handleError(error: any, context?: string): AppError {
    const appError = this.createAppError(error, context);
    this.addError(appError);
    return appError;
  }

  /**
   * Manejar error de WhatsApp específico
   */
  handleWhatsAppError(error: any, context?: string): AppError {
    const appError = this.createAppError(error, context, 'whatsapp');
    this.addError(appError);
    return appError;
  }

  /**
   * Manejar error de red
   */
  handleNetworkError(error: any, context?: string): AppError {
    const appError = this.createAppError(error, context, 'network');
    this.addError(appError);
    return appError;
  }

  /**
   * Manejar error de autenticación
   */
  handleAuthError(error: any, context?: string): AppError {
    const appError = this.createAppError(error, context, 'authentication');
    appError.severity = 'high';
    this.addError(appError);
    return appError;
  }

  /**
   * Crear error estructurado
   */
  private createAppError(error: any, context?: string, type?: ErrorType): AppError {
    const errorId = this.generateErrorId();
    const errorType = type || this.determineErrorType(error);
    const severity = this.determineSeverity(error, errorType);
    
    return {
      id: errorId,
      type: errorType,
      severity,
      title: this.getErrorTitle(errorType, error),
      message: this.getErrorMessage(error),
      details: this.getErrorDetails(error),
      timestamp: new Date(),
      context: context || 'Unknown',
      retryable: this.isRetryable(errorType, error),
      autoHide: severity !== 'critical',
      duration: this.getAutoHideDuration(severity)
    };
  }

  /**
   * Agregar error a la lista
   */
  private addError(error: AppError): void {
    const currentErrors = this.errorsSubject.value;
    const updatedErrors = [...currentErrors, error];
    this.errorsSubject.next(updatedErrors);

    // Auto-hide si está configurado
    if (error.autoHide && error.duration) {
      setTimeout(() => {
        this.removeError(error.id);
      }, error.duration);
    }

    // Log del error
    this.logError(error);
  }

  /**
   * Remover error por ID
   */
  removeError(errorId: string): void {
    const currentErrors = this.errorsSubject.value;
    const filteredErrors = currentErrors.filter(e => e.id !== errorId);
    this.errorsSubject.next(filteredErrors);
  }

  /**
   * Limpiar todos los errores
   */
  clearAllErrors(): void {
    this.errorsSubject.next([]);
  }

  /**
   * Limpiar errores por tipo
   */
  clearErrorsByType(type: ErrorType): void {
    const currentErrors = this.errorsSubject.value;
    const filteredErrors = currentErrors.filter(e => e.type !== type);
    this.errorsSubject.next(filteredErrors);
  }

  /**
   * Limpiar errores por contexto
   */
  clearErrorsByContext(context: string): void {
    const currentErrors = this.errorsSubject.value;
    const filteredErrors = currentErrors.filter(e => e.context !== context);
    this.errorsSubject.next(filteredErrors);
  }

  /**
   * Obtener errores por tipo
   */
  getErrorsByType(type: ErrorType): AppError[] {
    return this.currentErrors().filter(e => e.type === type);
  }

  /**
   * Obtener errores por severidad
   */
  getErrorsBySeverity(severity: ErrorSeverity): AppError[] {
    return this.currentErrors().filter(e => e.severity === severity);
  }

  /**
   * Verificar si hay errores críticos
   */
  hasCriticalErrors(): boolean {
    return this.criticalErrors().length > 0;
  }

  /**
   * Determinar tipo de error
   */
  private determineErrorType(error: any): ErrorType {
    if (error?.status === 401 || error?.status === 403) {
      return 'authentication';
    }
    
    if (error?.status >= 500) {
      return 'server';
    }
    
    if (error?.status >= 400 && error?.status < 500) {
      return 'validation';
    }
    
    if (!navigator.onLine || error?.name === 'NetworkError') {
      return 'network';
    }
    
    if (error?.message?.toLowerCase().includes('whatsapp')) {
      return 'whatsapp';
    }
    
    return 'unknown';
  }

  /**
   * Determinar severidad del error
   */
  private determineSeverity(error: any, type: ErrorType): ErrorSeverity {
    if (type === 'authentication') {
      return 'high';
    }
    
    if (type === 'server' || error?.status >= 500) {
      return 'critical';
    }
    
    if (type === 'network') {
      return 'medium';
    }
    
    if (type === 'whatsapp') {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Obtener título del error
   */
  private getErrorTitle(type: ErrorType, error: any): string {
    switch (type) {
      case 'network':
        return 'Error de Conexión';
      case 'authentication':
        return 'Error de Autenticación';
      case 'whatsapp':
        return 'Error de WhatsApp';
      case 'validation':
        return 'Error de Validación';
      case 'server':
        return 'Error del Servidor';
      default:
        return 'Error Inesperado';
    }
  }

  /**
   * Obtener mensaje del error
   */
  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    if (error?.status) {
      return this.getStatusMessage(error.status);
    }
    
    return 'Ha ocurrido un error inesperado';
  }

  /**
   * Obtener detalles del error
   */
  private getErrorDetails(error: any): string | undefined {
    if (error?.error?.details) {
      return error.error.details;
    }
    
    if (error?.stack) {
      return error.stack;
    }
    
    return undefined;
  }

  /**
   * Verificar si el error es reintentable
   */
  private isRetryable(type: ErrorType, error: any): boolean {
    if (type === 'network') {
      return true;
    }
    
    if (type === 'server' && error?.status >= 500) {
      return true;
    }
    
    if (type === 'whatsapp') {
      return true;
    }
    
    return false;
  }

  /**
   * Obtener duración de auto-hide
   */
  private getAutoHideDuration(severity: ErrorSeverity): number {
    switch (severity) {
      case 'low':
        return 3000;
      case 'medium':
        return 5000;
      case 'high':
        return 8000;
      case 'critical':
        return 0; // No auto-hide
      default:
        return 5000;
    }
  }

  /**
   * Obtener mensaje por código de estado
   */
  private getStatusMessage(status: number): string {
    switch (status) {
      case 400:
        return 'Solicitud inválida';
      case 401:
        return 'No autorizado';
      case 403:
        return 'Acceso denegado';
      case 404:
        return 'Recurso no encontrado';
      case 408:
        return 'Tiempo de espera agotado';
      case 429:
        return 'Demasiadas solicitudes';
      case 500:
        return 'Error interno del servidor';
      case 502:
        return 'Servidor no disponible';
      case 503:
        return 'Servicio no disponible';
      default:
        return `Error ${status}`;
    }
  }

  /**
   * Generar ID único para el error
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log del error
   */
  private logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.type.toUpperCase()}] ${error.title}: ${error.message}`;
    
    switch (logLevel) {
      case 'error':
        console.error(logMessage, error);
        break;
      case 'warn':
        console.warn(logMessage, error);
        break;
      case 'info':
        console.info(logMessage, error);
        break;
      default:
        console.log(logMessage, error);
    }
  }

  /**
   * Obtener nivel de log según severidad
   */
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'log';
    }
  }
}
