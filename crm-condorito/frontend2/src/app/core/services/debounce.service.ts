import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, share } from 'rxjs/operators';

export interface DebounceConfig {
  debounceTime: number;
  distinctUntilChanged?: boolean;
  leading?: boolean; // Ejecutar inmediatamente la primera vez
  trailing?: boolean; // Ejecutar al final del debounce (default: true)
}

/**
 * Servicio para debouncing de operaciones
 * Optimiza llamadas API y operaciones costosas
 */
@Injectable({
  providedIn: 'root'
})
export class DebounceService {
  private debouncedOperations = new Map<string, Subject<any>>();
  private activeOperations = new Map<string, Observable<any>>();

  /**
   * Crear una operación debounced
   */
  debounce<T, R>(
    key: string,
    operation: (value: T) => Observable<R>,
    config: DebounceConfig = { debounceTime: 300 }
  ): {
    execute: (value: T) => Observable<R>;
    cancel: () => void;
    isActive: () => boolean;
  } {
    // Crear subject si no existe
    if (!this.debouncedOperations.has(key)) {
      const subject = new Subject<T>();
      this.debouncedOperations.set(key, subject);

      // Configurar el pipeline de debounce
      const debouncedStream = subject.pipe(
        config.debounceTime > 0 ? debounceTime(config.debounceTime) : (source => source),
        config.distinctUntilChanged !== false ? distinctUntilChanged() : (source => source),
        switchMap(value => operation(value)),
        share()
      );

      this.activeOperations.set(key, debouncedStream);
    }

    const subject = this.debouncedOperations.get(key)!;
    const stream = this.activeOperations.get(key)! as Observable<R>;

    return {
      execute: (value: T) => {
        subject.next(value);
        return stream;
      },
      cancel: () => {
        this.cancel(key);
      },
      isActive: () => {
        return this.debouncedOperations.has(key);
      }
    };
  }

  /**
   * Cancelar una operación debounced
   */
  cancel(key: string): void {
    const subject = this.debouncedOperations.get(key);
    if (subject) {
      subject.complete();
      this.debouncedOperations.delete(key);
      this.activeOperations.delete(key);
    }
  }

  /**
   * Cancelar todas las operaciones
   */
  cancelAll(): void {
    for (const [key] of this.debouncedOperations) {
      this.cancel(key);
    }
  }

  /**
   * Obtener estadísticas de operaciones activas
   */
  getStats(): {
    activeOperations: number;
    operationKeys: string[];
  } {
    return {
      activeOperations: this.debouncedOperations.size,
      operationKeys: Array.from(this.debouncedOperations.keys())
    };
  }

  /**
   * Crear un debouncer específico para búsquedas
   */
  createSearchDebouncer<T>(
    searchFn: (query: string) => Observable<T>,
    debounceMs: number = 300
  ): {
    search: (query: string) => Observable<T>;
    cancel: () => void;
  } {
    const key = `search_${Date.now()}_${Math.random()}`;
    const debouncer = this.debounce(key, searchFn, {
      debounceTime: debounceMs,
      distinctUntilChanged: true
    });

    return {
      search: debouncer.execute,
      cancel: debouncer.cancel
    };
  }

  /**
   * Crear un debouncer para validaciones
   */
  createValidationDebouncer<T>(
    validationFn: (value: any) => Observable<T>,
    debounceMs: number = 500
  ): {
    validate: (value: any) => Observable<T>;
    cancel: () => void;
  } {
    const key = `validation_${Date.now()}_${Math.random()}`;
    const debouncer = this.debounce(key, validationFn, {
      debounceTime: debounceMs,
      distinctUntilChanged: true
    });

    return {
      validate: debouncer.execute,
      cancel: debouncer.cancel
    };
  }

  /**
   * Crear un throttler (limitar frecuencia máxima)
   */
  throttle<T, R>(
    key: string,
    operation: (value: T) => Observable<R>,
    intervalMs: number = 1000
  ): {
    execute: (value: T) => Observable<R>;
    cancel: () => void;
  } {
    let lastExecution = 0;
    let pendingValue: T | null = null;
    let pendingTimeout: any = null;

    const executeOperation = (value: T): Observable<R> => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecution;

      if (timeSinceLastExecution >= intervalMs) {
        // Ejecutar inmediatamente
        lastExecution = now;
        return operation(value);
      } else {
        // Programar ejecución
        return new Observable<R>(observer => {
          pendingValue = value;
          
          if (pendingTimeout) {
            clearTimeout(pendingTimeout);
          }

          pendingTimeout = setTimeout(() => {
            if (pendingValue !== null) {
              lastExecution = Date.now();
              operation(pendingValue!).subscribe(observer);
              pendingValue = null;
              pendingTimeout = null;
            }
          }, intervalMs - timeSinceLastExecution);
        });
      }
    };

    return {
      execute: executeOperation,
      cancel: () => {
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
          pendingValue = null;
        }
      }
    };
  }
}

/**
 * Decorator para métodos que necesitan debouncing
 */
export function Debounced(debounceMs: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let timeoutId: any;

    descriptor.value = function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        originalMethod.apply(this, args);
      }, debounceMs);
    };

    return descriptor;
  };
}

/**
 * Decorator para métodos que necesitan throttling
 */
export function Throttled(intervalMs: number = 1000) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let lastExecution = 0;

    descriptor.value = function (...args: any[]) {
      const now = Date.now();
      if (now - lastExecution >= intervalMs) {
        lastExecution = now;
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}
