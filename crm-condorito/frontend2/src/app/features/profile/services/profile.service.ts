import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';
import { APP_CONFIG } from '../../../core/config/app.config';
import { User } from '../../../core/models/api.models';

// ============================================================================
// PROFILE INTERFACES
// ============================================================================

export interface UpdateProfileRequest {
  company_name?: string;
  email?: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ProfileResponse {
  success: boolean;
  message?: string;
  data?: User;
}

export interface PasswordChangeResponse {
  success: boolean;
  message: string;
}

export interface ProfileStats {
  total_contacts: number;
  total_conversations: number;
  total_messages: number;
  bot_messages: number;
  manual_messages: number;
  total_templates: number;
  account_created: string;
  last_login?: string;
  subscription_status?: string;
}

export interface ProfileStatsResponse {
  success: boolean;
  data: ProfileStats;
}

/**
 * Servicio para gestionar el perfil del usuario
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private apiService = inject(ApiService);
  private http = inject(HttpClient);

  /**
   * Obtener datos completos del perfil del usuario
   */
  getProfile(): Observable<ProfileResponse> {
    return this.apiService.get<ProfileResponse>('/api/profile');
  }

  /**
   * Actualizar datos del perfil
   */
  updateProfile(profileData: UpdateProfileRequest): Observable<ProfileResponse> {
    return this.apiService.put<ProfileResponse>('/api/profile', profileData);
  }

  /**
   * Cambiar contraseña del usuario
   */
  changePassword(passwordData: ChangePasswordRequest): Observable<PasswordChangeResponse> {
    return this.apiService.post<PasswordChangeResponse>('/api/profile/change-password', passwordData);
  }

  /**
   * Obtener estadísticas del perfil
   */
  getProfileStats(): Observable<ProfileStatsResponse> {
    return this.apiService.get<ProfileStatsResponse>('/api/profile/stats');
  }

  /**
   * Eliminar cuenta (soft delete)
   */
  deactivateAccount(): Observable<ProfileResponse> {
    return this.apiService.post<ProfileResponse>('/api/profile/deactivate', {});
  }

  /**
   * Exportar datos del usuario (GDPR compliance)
   */
  exportUserData(): Observable<Blob> {
    const token = localStorage.getItem(APP_CONFIG.storage.tokenKey);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
    
    return this.http.get(`${APP_CONFIG.api.baseUrl}/api/profile/export`, {
      headers,
      responseType: 'blob'
    });
  }
}
