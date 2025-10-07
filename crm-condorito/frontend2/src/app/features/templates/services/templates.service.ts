import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app.config';
import { ApiService } from '../../../core/services/api.service';
import {
  MessageTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TemplateUseRequest,
  TemplateUseResponse,
  TemplatesListResponse,
  TemplateResponse,
  TemplateStatsResponse,
  TemplateCategoriesResponse
} from '../../../core/models/template.models';

/**
 * Servicio para gestión de templates de mensajes
 */
@Injectable({
  providedIn: 'root'
})
export class TemplatesService {
  private apiService = inject(ApiService);

  /**
   * Obtener lista de templates con filtros y paginación
   */
  getTemplates(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'ASC' | 'DESC';
  }): Observable<TemplatesListResponse> {
    let httpParams = new HttpParams();
    
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.category) httpParams = httpParams.set('category', params.category);
    if (params?.is_active !== undefined) httpParams = httpParams.set('is_active', params.is_active.toString());
    if (params?.sort_by) httpParams = httpParams.set('sortBy', params.sort_by);
    if (params?.sort_order) httpParams = httpParams.set('sortOrder', params.sort_order);

    return this.apiService.get<TemplatesListResponse>(
      APP_CONFIG.api.endpoints.templates.list,
      { params: httpParams }
    );
  }

  /**
   * Obtener template por ID
   */
  getTemplate(id: number): Observable<TemplateResponse> {
    const endpoint = APP_CONFIG.api.endpoints.templates.get.replace('{id}', id.toString());
    return this.apiService.get<TemplateResponse>(endpoint);
  }

  /**
   * Crear nuevo template
   */
  createTemplate(template: CreateTemplateRequest): Observable<TemplateResponse> {
    return this.apiService.post<TemplateResponse>(
      APP_CONFIG.api.endpoints.templates.create,
      template
    );
  }

  /**
   * Actualizar template existente
   */
  updateTemplate(id: number, template: UpdateTemplateRequest): Observable<TemplateResponse> {
    const endpoint = APP_CONFIG.api.endpoints.templates.update.replace('{id}', id.toString());
    return this.apiService.put<TemplateResponse>(endpoint, template);
  }

  /**
   * Eliminar template
   */
  deleteTemplate(id: number): Observable<{ success: boolean; message: string }> {
    const endpoint = APP_CONFIG.api.endpoints.templates.delete.replace('{id}', id.toString());
    return this.apiService.delete<{ success: boolean; message: string }>(endpoint);
  }

  /**
   * Duplicar template
   */
  duplicateTemplate(id: number, newName?: string): Observable<TemplateResponse> {
    const endpoint = APP_CONFIG.api.endpoints.templates.duplicate.replace('{id}', id.toString());
    const body = newName ? { new_name: newName } : {};
    return this.apiService.post<TemplateResponse>(endpoint, body);
  }

  /**
   * Activar/desactivar template
   */
  toggleTemplate(id: number): Observable<TemplateResponse> {
    const endpoint = APP_CONFIG.api.endpoints.templates.toggle.replace('{id}', id.toString());
    return this.apiService.put<TemplateResponse>(endpoint, {});
  }

  /**
   * Previsualizar template con variables
   */
  previewTemplate(id: number, variables: { [key: string]: string }): Observable<TemplatePreviewResponse> {
    const endpoint = APP_CONFIG.api.endpoints.templates.preview.replace('{id}', id.toString());
    return this.apiService.post<TemplatePreviewResponse>(endpoint, { variables });
  }

  /**
   * Usar template (enviar mensaje)
   */
  useTemplate(id: number, data: TemplateUseRequest): Observable<TemplateUseResponse> {
    const endpoint = APP_CONFIG.api.endpoints.templates.use.replace('{id}', id.toString());
    return this.apiService.post<TemplateUseResponse>(endpoint, data);
  }

  /**
   * Obtener categorías disponibles
   */
  getCategories(): Observable<TemplateCategoriesResponse> {
    return this.apiService.get<TemplateCategoriesResponse>(
      APP_CONFIG.api.endpoints.templates.categories
    );
  }

  /**
   * Obtener estadísticas de templates
   */
  getStats(): Observable<TemplateStatsResponse> {
    return this.apiService.get<TemplateStatsResponse>(
      APP_CONFIG.api.endpoints.templates.stats
    );
  }

  /**
   * Procesar contenido de template con variables
   * Función auxiliar para el frontend
   */
  processTemplateContent(content: string, variables: { [key: string]: string }): string {
    let processedContent = content;
    
    // Reemplazar variables personalizadas {{variable}}
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedContent = processedContent.replace(regex, variables[key] || '');
    });

    // Reemplazar variables del sistema
    const now = new Date();
    const systemVariables = {
      fecha: now.toLocaleDateString('es-ES'),
      hora: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      dia_semana: now.toLocaleDateString('es-ES', { weekday: 'long' }),
      mes: now.toLocaleDateString('es-ES', { month: 'long' }),
      año: now.getFullYear().toString()
    };

    Object.keys(systemVariables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedContent = processedContent.replace(regex, systemVariables[key as keyof typeof systemVariables]);
    });

    return processedContent;
  }

  /**
   * Extraer variables de un contenido de template
   * Función auxiliar para el frontend
   */
  extractVariables(content: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  /**
   * Extraer nombres de variables del contenido del template
   * Alias para compatibilidad
   */
  extractVariablesFromContent(content: string): string[] {
    return this.extractVariables(content);
  }

  /**
   * Validar formato de variables en contenido
   * Función auxiliar para el frontend
   */
  validateTemplateContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Verificar que las llaves estén balanceadas
    const openBraces = (content.match(/\{\{/g) || []).length;
    const closeBraces = (content.match(/\}\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push('Las llaves de variables no están balanceadas');
    }

    // Verificar que no haya variables vacías
    if (content.includes('{{}}')) {
      errors.push('Hay variables vacías en el template');
    }

    // Verificar formato de variables
    const invalidVariables = content.match(/\{\{[^}]*\{|\}[^}]*\}\}/g);
    if (invalidVariables) {
      errors.push('Formato de variables inválido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
