import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { APP_CONFIG } from '../../../core/config/app.config';
import { MessageStats, BotStatus, MessageStatsResponse, BotStatusResponse, ApiResponse } from '../../../core/models/api.models';

/**
 * Interfaz para la cuota del bot (mensajes y tokens)
 */
export interface BotQuota {
  // Información de mensajes
  usage: number;
  limit: number;
  remaining: number;
  percentage: number;
  // Información de tokens
  tokenUsage: number;
  tokenLimit: number;
  tokensRemaining: number;
  tokenPercentage: number;
  // Información general
  resetDate?: string;
  status: 'active' | 'exceeded';
  allowed: boolean;
  limits?: {
    messages: {
      current: number;
      limit: number;
      remaining: number;
      percentage: number;
      available: boolean;
    };
    tokens: {
      current: number;
      limit: number;
      remaining: number;
      percentage: number;
      available: boolean;
    };
  };
}

/**
 * Respuesta de la API para la cuota del bot
 */
export interface BotQuotaResponse {
  success: boolean;
  quota: BotQuota;
  message: string;
}

/**
 * Interfaz para conversación con bot desactivado
 */
export interface DisabledBotConversation {
  id: number;
  contact_phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  bot_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Respuesta de la API para conversaciones con bot desactivado
 */
export interface DisabledBotConversationsResponse {
  success: boolean;
  data: DisabledBotConversation[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Servicio del Dashboard
 * Maneja las estadísticas y control del bot
 */
@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiService = inject(ApiService);

  /**
   * Obtener estadísticas de mensajes
   */
  getMessageStats(): Observable<MessageStatsResponse> {
    return this.apiService.get<MessageStatsResponse>(
      APP_CONFIG.api.endpoints.messages.stats
    );
  }

  /**
   * Obtener estado del bot
   */
  getBotStatus(): Observable<BotStatusResponse> {
    return this.apiService.get<BotStatusResponse>(
      APP_CONFIG.api.endpoints.messages.botStatus
    );
  }

  /**
   * Obtener cuota del bot
   */
  getBotQuota(): Observable<BotQuotaResponse> {
    return this.apiService.get<BotQuotaResponse>('/api/messages/bot/quota');
  }

  /**
   * Activar bot para todas las conversaciones
   */
  enableBotForAll(): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      APP_CONFIG.api.endpoints.messages.botEnableAll,
      {}
    );
  }

  /**
   * Desactivar bot para todas las conversaciones
   */
  disableBotForAll(): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      APP_CONFIG.api.endpoints.messages.botDisableAll,
      {}
    );
  }

  /**
   * Activar bot para una conversación específica
   */
  enableBotForConversation(conversationId: number): Observable<ApiResponse<any>> {
    const endpoint = APP_CONFIG.api.endpoints.messages.botEnableConversation
      .replace('{id}', conversationId.toString());
    
    return this.apiService.post<ApiResponse<any>>(endpoint, {});
  }

  /**
   * Desactivar bot para una conversación específica
   */
  disableBotForConversation(conversationId: number): Observable<ApiResponse<any>> {
    const endpoint = APP_CONFIG.api.endpoints.messages.botDisableConversation
      .replace('{id}', conversationId.toString());
    
    return this.apiService.post<ApiResponse<any>>(endpoint, {});
  }

  /**
   * Obtener conversaciones con bot desactivado
   */
  getDisabledBotConversations(params?: { limit?: number; offset?: number }): Observable<DisabledBotConversationsResponse> {
    return this.apiService.get<DisabledBotConversationsResponse>(
      '/api/messages/bot/disabled-conversations',
      { params }
    );
  }

  /**
   * Activar bot para conversaciones específicas
   */
  enableBotForConversations(conversationIds: number[]): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      '/api/messages/bot/enable-conversations',
      { conversation_ids: conversationIds }
    );
  }

  /**
   * Alternar estado global del bot (habilitar/deshabilitar completamente)
   */
  toggleBotGlobally(): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      APP_CONFIG.api.endpoints.messages.botToggle,
      {}
    );
  }

  /**
   * Obtener configuración del bot
   */
  getBotConfiguration(): Observable<ApiResponse<any>> {
    return this.apiService.get<ApiResponse<any>>('/api/messages/bot/config');
  }
}
