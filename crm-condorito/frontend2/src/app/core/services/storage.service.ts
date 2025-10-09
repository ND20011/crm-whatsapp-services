import { Injectable } from '@angular/core';
import { APP_CONFIG } from '../config/app.config';
import { User } from '../models/api.models';

/**
 * Servicio para manejo centralizado del almacenamiento local
 * Proporciona métodos seguros para localStorage con tipado
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {

  /**
   * Guardar token de acceso
   */
  setAccessToken(token: string): void {
    console.log('🔍 Saving access token:', token.substring(0, 20) + '...');
    localStorage.setItem(APP_CONFIG.storage.tokenKey, token);
  }

  /**
   * Obtener token de acceso
   */
  getAccessToken(): string | null {
    return localStorage.getItem(APP_CONFIG.storage.tokenKey);
  }

  /**
   * Guardar refresh token
   */
  setRefreshToken(token: string): void {
    localStorage.setItem(APP_CONFIG.storage.refreshTokenKey, token);
  }

  /**
   * Obtener refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(APP_CONFIG.storage.refreshTokenKey);
  }

  /**
   * Guardar datos del usuario
   */
  setUser(user: User): void {
    console.log('🔍 Saving user data:', user);
    localStorage.setItem(APP_CONFIG.storage.userKey, JSON.stringify(user));
  }

  /**
   * Obtener datos del usuario
   */
  getUser(): User | null {
    const userData = localStorage.getItem(APP_CONFIG.storage.userKey);
    if (userData) {
      try {
        return JSON.parse(userData) as User;
      } catch (error) {
        console.error('Error parsing user data:', error);
        this.removeUser();
        return null;
      }
    }
    return null;
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    const hasToken = !!this.getAccessToken();
    const hasUser = !!this.getUser();
    console.log('🔍 StorageService.isAuthenticated - hasToken:', hasToken, 'hasUser:', hasUser);
    return hasToken && hasUser;
  }

  /**
   * Limpiar todos los datos de autenticación
   */
  clearAuthData(): void {
    console.log('🧹 Clearing all authentication data from localStorage');
    
    // Limpiar tokens y datos de usuario específicos
    localStorage.removeItem(APP_CONFIG.storage.tokenKey);
    localStorage.removeItem(APP_CONFIG.storage.refreshTokenKey);
    localStorage.removeItem(APP_CONFIG.storage.userKey);
    
    // Limpiar cualquier otro dato relacionado con la sesión del usuario
    // (puedes agregar más claves específicas aquí si es necesario)
    const keysToRemove = [
      'crm_user_preferences',
      'crm_chat_state',
      'crm_dashboard_state',
      'crm_sidebar_state'
    ];
    
    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed ${key} from localStorage`);
      }
    });
    
    console.log('✅ Authentication data cleared successfully');
  }

  /**
   * Remover token de acceso
   */
  removeAccessToken(): void {
    localStorage.removeItem(APP_CONFIG.storage.tokenKey);
  }

  /**
   * Remover refresh token
   */
  removeRefreshToken(): void {
    localStorage.removeItem(APP_CONFIG.storage.refreshTokenKey);
  }

  /**
   * Remover datos del usuario
   */
  removeUser(): void {
    localStorage.removeItem(APP_CONFIG.storage.userKey);
  }

  /**
   * Guardar cualquier dato con clave personalizada
   */
  setItem(key: string, value: any): void {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  /**
   * Obtener cualquier dato con clave personalizada
   */
  getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          return JSON.parse(item) as T;
        } catch {
          return item as unknown as T;
        }
      }
      return null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  /**
   * Remover item por clave
   */
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  /**
   * Verificar si existe una clave
   */
  hasItem(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }

  /**
   * Limpiar todo el localStorage (usar con precaución)
   */
  clear(): void {
    localStorage.clear();
  }
}
