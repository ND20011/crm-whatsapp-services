import { Injectable, signal } from '@angular/core';

/**
 * Servicio para gestionar estados de carga globales
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private _isLoading = signal<boolean>(false);
  private _loadingMessage = signal<string>('');
  private _loadingContexts = signal<Map<string, { message: string; id: string }>>(new Map());

  // Signals públicos de solo lectura
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly loadingMessage = this._loadingMessage.asReadonly();

  /**
   * Mostrar indicador de carga
   */
  show(message: string = 'Cargando...'): void {
    this._isLoading.set(true);
    this._loadingMessage.set(message);
  }

  /**
   * Ocultar indicador de carga
   */
  hide(): void {
    this._isLoading.set(false);
    this._loadingMessage.set('');
  }

  /**
   * Alternar estado de carga
   */
  toggle(message?: string): void {
    if (this._isLoading()) {
      this.hide();
    } else {
      this.show(message);
    }
  }

  /**
   * Iniciar carga con contexto específico
   */
  startLoading(context: string, message: string = 'Cargando...'): string {
    const id = `${context}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const contexts = this._loadingContexts();
    contexts.set(context, { message, id });
    this._loadingContexts.set(new Map(contexts));
    return id;
  }

  /**
   * Detener carga por ID
   */
  stopLoading(id: string): void {
    const contexts = this._loadingContexts();
    for (const [context, data] of contexts.entries()) {
      if (data.id === id) {
        contexts.delete(context);
        break;
      }
    }
    this._loadingContexts.set(new Map(contexts));
  }

  /**
   * Verificar si hay carga activa por contexto
   */
  isLoadingByContext(context: string): boolean {
    return this._loadingContexts().has(context);
  }

  /**
   * Obtener mensaje de carga por contexto
   */
  getLoadingMessage(context: string): string {
    return this._loadingContexts().get(context)?.message || '';
  }
}