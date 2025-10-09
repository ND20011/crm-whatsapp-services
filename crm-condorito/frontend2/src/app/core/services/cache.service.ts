import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { tap, shareReplay, map } from 'rxjs/operators';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface CacheConfig {
  ttl: number;
  maxSize?: number;
}

/**
 * Servicio de caché para optimizar llamadas API
 * Implementa estrategias de caché con TTL y invalidación
 */
@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private cacheSubjects = new Map<string, BehaviorSubject<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Obtener datos del caché o ejecutar la función si no existe/expiró
   */
  get<T>(
    key: string, 
    dataFactory: () => Observable<T>, 
    config: Partial<CacheConfig> = {}
  ): Observable<T> {
    const ttl = config.ttl || this.DEFAULT_TTL;
    const entry = this.cache.get(key);
    
    // Verificar si existe y no ha expirado
    if (entry && (Date.now() - entry.timestamp) < entry.ttl) {
      return of(entry.data);
    }

    // Si ya hay una request en progreso, compartir el resultado
    if (this.cacheSubjects.has(key)) {
      return this.cacheSubjects.get(key)!.asObservable();
    }

    // Crear nuevo subject para compartir la request
    const subject = new BehaviorSubject<T | null>(null);
    this.cacheSubjects.set(key, subject);

    // Ejecutar la función y cachear el resultado
    return dataFactory().pipe(
      tap(data => {
        this.set(key, data, { ttl });
        subject.next(data);
        subject.complete();
        this.cacheSubjects.delete(key);
      }),
      shareReplay(1)
    );
  }

  /**
   * Establecer un valor en el caché
   */
  set<T>(key: string, data: T, config: Partial<CacheConfig> = {}): void {
    const ttl = config.ttl || this.DEFAULT_TTL;
    
    // Limpiar caché si excede el tamaño máximo
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanupExpired();
      
      // Si aún está lleno, eliminar las entradas más antiguas
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = Array.from(this.cache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Obtener un valor del caché sin verificar expiración
   */
  getRaw<T>(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }

  /**
   * Verificar si una clave existe y no ha expirado
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if ((Date.now() - entry.timestamp) >= entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Invalidar una clave específica
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    
    // También invalidar el subject si existe
    if (this.cacheSubjects.has(key)) {
      this.cacheSubjects.get(key)!.complete();
      this.cacheSubjects.delete(key);
    }
  }

  /**
   * Invalidar múltiples claves que coincidan con un patrón
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.invalidate(key);
      }
    }
  }

  /**
   * Limpiar todas las entradas expiradas
   */
  cleanupExpired(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) >= entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar todo el caché
   */
  clear(): void {
    this.cache.clear();
    
    // Completar todos los subjects activos
    for (const subject of this.cacheSubjects.values()) {
      subject.complete();
    }
    this.cacheSubjects.clear();
  }

  /**
   * Obtener estadísticas del caché
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl
    }));

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      entries
    };
  }

  /**
   * Generar clave de caché para conversaciones
   */
  static conversationsKey(params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `conversations_${paramStr}`;
  }

  /**
   * Generar clave de caché para mensajes de conversación
   */
  static messagesKey(conversationId: number, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `messages_${conversationId}_${paramStr}`;
  }

  /**
   * Generar clave de caché para estadísticas
   */
  static statsKey(): string {
    return 'dashboard_stats';
  }

  /**
   * Generar clave de caché para estado del bot
   */
  static botStatusKey(): string {
    return 'bot_status';
  }

  /**
   * Generar clave de caché para estado de WhatsApp
   */
  static whatsappStatusKey(): string {
    return 'whatsapp_status';
  }
}
