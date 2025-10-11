import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ApiResponse } from '../../../core/models/api.models';

/**
 * Interfaz para la respuesta de reconexión de WhatsApp
 */
export interface WhatsAppReconnectResponse {
  success: boolean;
  message: string;
  summary: {
    total_clients: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    execution_time_ms: number;
  };
  details: Array<{
    client_id: number;
    client_code: string;
    company_name: string;
    status: 'success' | 'failed' | 'skipped';
    message: string;
    execution_time_ms: number;
    error: string | null;
  }>;
}

/**
 * Interfaz para el estado de WhatsApp
 */
export interface WhatsAppStatusResponse {
  success: boolean;
  message: string;
  summary: {
    total_clients: number;
    connected: number;
    disconnected: number;
  };
  clients: Array<{
    client_id: number;
    client_code: string;
    company_name: string;
    whatsapp_connected: boolean;
    whatsapp_status: string;
    phone_number: string | null;
    last_activity: string | null;
    has_qr: boolean;
  }>;
}

/**
 * Interfaz para Cliente en el backoffice
 */
export interface BackofficeClient {
  id: number;
  client_code: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'inactive' | 'suspended';
  monthly_bot_limit: number;
  current_bot_usage: number;
  bot_usage_reset_date: string;
  monthly_token_limit: number;
  current_token_usage: number;
  token_usage_reset_date: string;
  created_at: string;
  updated_at: string;
  // Campos calculados
  bot_usage_percentage: number;
  token_usage_percentage: number;
  bot_remaining: number;
  token_remaining: number;
}

/**
 * Interfaz para crear/actualizar cliente
 */
export interface CreateClientRequest {
  client_code: string;
  password: string;
  company_name: string;
  email?: string;
  phone?: string;
  monthly_bot_limit?: number;
  monthly_token_limit?: number;
}

export interface UpdateClientRequest {
  company_name?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
  monthly_bot_limit?: number;
  monthly_token_limit?: number;
}

/**
 * Interfaz para estadísticas del sistema
 */
export interface SystemStats {
  clients: {
    total_clients: number;
    active_clients: number;
    inactive_clients: number;
    suspended_clients: number;
  };
  bot_usage: {
    total_bot_limit: number;
    total_bot_usage: number;
    avg_bot_usage_percentage: number;
  };
  token_usage: {
    total_token_limit: number;
    total_token_usage: number;
    avg_token_usage_percentage: number;
  };
  quota_exceeded: number;
}

/**
 * Respuesta de la API para clientes
 */
export interface BackofficeClientsResponse {
  success: boolean;
  data: BackofficeClient[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Respuesta de la API para estadísticas
 */
export interface SystemStatsResponse {
  success: boolean;
  stats: SystemStats;
}

/**
 * Servicio del Backoffice
 * Maneja la administración de usuarios y cuotas
 */
@Injectable({
  providedIn: 'root'
})
export class BackofficeService {
  private apiService = inject(ApiService);

  /**
   * Obtener estadísticas del sistema
   */
  getSystemStats(): Observable<SystemStatsResponse> {
    return this.apiService.get<SystemStatsResponse>('/api/backoffice/stats');
  }

  /**
   * Obtener lista de clientes con filtros y paginación
   */
  getClients(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Observable<BackofficeClientsResponse> {
    return this.apiService.get<BackofficeClientsResponse>(
      '/api/backoffice/clients',
      { params }
    );
  }

  /**
   * Crear nuevo cliente
   */
  createClient(clientData: CreateClientRequest): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      '/api/backoffice/clients',
      clientData
    );
  }

  /**
   * Actualizar cliente existente
   */
  updateClient(clientId: number, clientData: UpdateClientRequest): Observable<ApiResponse<any>> {
    return this.apiService.put<ApiResponse<any>>(
      `/api/backoffice/clients/${clientId}`,
      clientData
    );
  }

  /**
   * Resetear cuotas de un cliente
   */
  resetClientQuota(clientId: number, type: 'bot' | 'token' | 'both' = 'both'): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      `/api/backoffice/clients/${clientId}/reset-quota`,
      { type }
    );
  }

  /**
   * Eliminar cliente
   */
  deleteClient(clientId: number): Observable<ApiResponse<any>> {
    return this.apiService.delete<ApiResponse<any>>(
      `/api/backoffice/clients/${clientId}`
    );
  }

  /**
   * Obtener detalles de un cliente específico
   */
  getClientDetails(clientId: number): Observable<ApiResponse<BackofficeClient>> {
    return this.apiService.get<ApiResponse<BackofficeClient>>(
      `/api/backoffice/clients/${clientId}`
    );
  }

  /**
   * Obtener reportes del sistema
   */
  getSystemReports(params?: {
    startDate?: string;
    endDate?: string;
    type?: 'usage' | 'clients' | 'messages';
  }): Observable<ApiResponse<any>> {
    return this.apiService.get<ApiResponse<any>>(
      '/api/backoffice/reports',
      { params }
    );
  }

  /**
   * Exportar datos de clientes
   */
  exportClients(format: 'csv' | 'excel' = 'csv'): Observable<Blob> {
    return this.apiService.getBlob(
      `/api/backoffice/clients/export?format=${format}`
    );
  }

  /**
   * Obtener logs del sistema
   */
  getSystemLogs(params?: {
    page?: number;
    limit?: number;
    level?: 'error' | 'warn' | 'info' | 'debug';
    startDate?: string;
    endDate?: string;
  }): Observable<ApiResponse<any>> {
    return this.apiService.get<ApiResponse<any>>(
      '/api/backoffice/logs',
      { params }
    );
  }

  /**
   * Obtener configuración del sistema
   */
  getSystemConfig(): Observable<ApiResponse<any>> {
    return this.apiService.get<ApiResponse<any>>(
      '/api/backoffice/config'
    );
  }

  /**
   * Actualizar configuración del sistema
   */
  updateSystemConfig(config: any): Observable<ApiResponse<any>> {
    return this.apiService.put<ApiResponse<any>>(
      '/api/backoffice/config',
      config
    );
  }

  /**
   * Obtener métricas en tiempo real
   */
  getRealTimeMetrics(): Observable<ApiResponse<any>> {
    return this.apiService.get<ApiResponse<any>>(
      '/api/backoffice/metrics/realtime'
    );
  }

  /**
   * Ejecutar mantenimiento del sistema
   */
  runSystemMaintenance(type: 'cleanup' | 'optimize' | 'backup'): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      '/api/backoffice/maintenance',
      { type }
    );
  }

  /**
   * Resetear cuotas mensuales de todos los clientes
   */
  resetMonthlyQuotas(): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      '/api/backoffice/reset-monthly-quotas',
      {}
    );
  }

  // ============================================================================
  // MÉTODOS DE ADMINISTRACIÓN DE WHATSAPP
  // ============================================================================

  /**
   * Reconectar todas las sesiones de WhatsApp
   */
  reconnectAllWhatsApp(): Observable<WhatsAppReconnectResponse> {
    return this.apiService.post<WhatsAppReconnectResponse>(
      '/api/admin/reconnect-all-whatsapp',
      {}
    );
  }

  /**
   * Obtener estado de todas las conexiones de WhatsApp
   */
  getAllWhatsAppStatus(): Observable<WhatsAppStatusResponse> {
    return this.apiService.get<WhatsAppStatusResponse>(
      '/api/admin/whatsapp-status'
    );
  }

  /**
   * Desconectar todas las sesiones de WhatsApp
   */
  disconnectAllWhatsApp(): Observable<ApiResponse<any>> {
    return this.apiService.post<ApiResponse<any>>(
      '/api/admin/disconnect-all-whatsapp',
      {}
    );
  }

  /**
   * Obtener estadísticas del sistema (admin)
   */
  getAdminSystemStats(): Observable<ApiResponse<any>> {
    return this.apiService.get<ApiResponse<any>>(
      '/api/admin/system-stats'
    );
  }
}
