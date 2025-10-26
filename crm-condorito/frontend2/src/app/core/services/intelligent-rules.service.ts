import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { APP_CONFIG } from '../config/app.config';

export interface IntelligentRule {
  id?: number;
  name: string;
  description?: string;
  is_active: boolean; // Normalizado a boolean
  priority: number;
  trigger_keywords: string[]; // Normalizado a array (nunca null después de normalización)
  match_type: 'any' | 'all' | 'exact_phrase';
  ai_extraction_enabled: boolean; // Normalizado a boolean
  ai_extraction_prompt?: string;
  expected_data_fields?: string[] | null; // Puede ser null
  action_type: 'assign_tags' | 'escalate_human' | 'call_api' | 'ai_response' | 'hybrid';
  action_config?: any | null; // Puede ser null
  tags_to_assign: number[]; // Normalizado a array (nunca null después de normalización)
  times_triggered?: number;
  last_triggered_at?: string | null;
  success_rate: number; // Normalizado a number
  created_at?: string;
  updated_at?: string;
}

export interface IntelligentRulesConfig {
  intelligent_rules_enabled: boolean; // Normalizado a boolean
  available_action_types: Array<{
    value: string;
    label: string;
    description: string;
  }>;
  available_match_types: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

export interface RulesStats {
  general: {
    total_rules: number;
    active_rules: number;
    inactive_rules: number;
    total_triggers: number; // Normalizado a number
    avg_success_rate: number; // Normalizado a number
    last_activity: string | null;
  };
  top_rules: Array<{
    id: number;
    name: string;
    times_triggered: number;
    success_rate: number;
    last_triggered_at: string;
  }>;
  action_distribution: Array<{
    action_type: string;
    count: number;
    avg_success_rate: number; // Normalizado a number
  }>;
}

export interface TestRuleResult {
  ruleId: number;
  ruleName: string;
  testMessage: string;
  matches: boolean;
  matchedKeywords: string[];
  matchType: string;
  actionType: string;
  isActive: boolean;
  wouldTrigger: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class IntelligentRulesService {
  private apiService = inject(ApiService);
  private endpoints = APP_CONFIG.api.endpoints.intelligentRules;

  /**
   * Normalizar regla del backend para el frontend
   */
  private normalizeRule(rule: any): IntelligentRule {
    return {
      ...rule,
      is_active: Boolean(rule.is_active),
      ai_extraction_enabled: Boolean(rule.ai_extraction_enabled),
      trigger_keywords: rule.trigger_keywords || [],
      tags_to_assign: rule.tags_to_assign || [],
      expected_data_fields: rule.expected_data_fields || null,
      action_config: rule.action_config || null,
      success_rate: parseFloat(rule.success_rate) || 0
    };
  }

  /**
   * Normalizar configuración del backend para el frontend
   */
  private normalizeConfig(config: any): IntelligentRulesConfig {
    return {
      ...config,
      intelligent_rules_enabled: Boolean(config.intelligent_rules_enabled)
    };
  }

  /**
   * Normalizar estadísticas del backend para el frontend
   */
  private normalizeStats(stats: any): RulesStats {
    return {
      general: {
        ...stats.general,
        total_triggers: parseInt(stats.general.total_triggers) || 0,
        avg_success_rate: parseFloat(stats.general.avg_success_rate) || 0
      },
      top_rules: stats.top_rules || [],
      action_distribution: (stats.action_distribution || []).map((item: any) => ({
        ...item,
        avg_success_rate: parseFloat(item.avg_success_rate) || 0
      }))
    };
  }


  /**
   * Obtener todas las reglas
   */
  getRules(): Observable<{ success: boolean; data: IntelligentRule[]; total: number }> {
    return this.apiService.get<{ success: boolean; data: any[]; total: number }>(this.endpoints.list)
      .pipe(
        map(response => ({
          ...response,
          data: response.data.map(rule => this.normalizeRule(rule))
        }))
      );
  }

  /**
   * Obtener una regla específica
   */
  getRule(id: number): Observable<{ success: boolean; data: IntelligentRule }> {
    const url = this.endpoints.get.replace('{id}', id.toString());
    return this.apiService.get<{ success: boolean; data: any }>(url)
      .pipe(
        map(response => ({
          ...response,
          data: this.normalizeRule(response.data)
        }))
      );
  }

  /**
   * Crear nueva regla
   */
  createRule(rule: Partial<IntelligentRule>): Observable<{ success: boolean; message: string; data: any }> {
    return this.apiService.post<{ success: boolean; message: string; data: any }>(this.endpoints.create, rule);
  }

  /**
   * Actualizar regla existente
   */
  updateRule(id: number, rule: Partial<IntelligentRule>): Observable<{ success: boolean; message: string }> {
    const url = this.endpoints.update.replace('{id}', id.toString());
    return this.apiService.put<{ success: boolean; message: string }>(url, rule);
  }

  /**
   * Eliminar regla
   */
  deleteRule(id: number): Observable<{ success: boolean; message: string }> {
    const url = this.endpoints.delete.replace('{id}', id.toString());
    return this.apiService.delete<{ success: boolean; message: string }>(url);
  }

  /**
   * Duplicar regla
   */
  duplicateRule(id: number): Observable<{ success: boolean; message: string; data: any }> {
    const url = this.endpoints.duplicate.replace('{id}', id.toString());
    return this.apiService.post<{ success: boolean; message: string; data: any }>(url, {});
  }

  /**
   * Obtener estadísticas
   */
  getStats(): Observable<{ success: boolean; data: RulesStats }> {
    return this.apiService.get<{ success: boolean; data: any }>(this.endpoints.stats)
      .pipe(
        map(response => ({
          ...response,
          data: this.normalizeStats(response.data)
        }))
      );
  }

  /**
   * Probar regla con mensaje
   */
  testRule(id: number, testMessage: string): Observable<{ success: boolean; data: TestRuleResult }> {
    const url = this.endpoints.test.replace('{id}', id.toString());
    return this.apiService.post<{ success: boolean; data: TestRuleResult }>(url, { testMessage });
  }

  /**
   * Obtener configuración del sistema
   */
  getConfig(): Observable<{ success: boolean; data: IntelligentRulesConfig }> {
    return this.apiService.get<{ success: boolean; data: any }>(this.endpoints.config)
      .pipe(
        map(response => ({
          ...response,
          data: this.normalizeConfig(response.data)
        }))
      );
  }

  /**
   * Actualizar configuración del sistema
   */
  updateConfig(config: { intelligent_rules_enabled: boolean }): Observable<{ success: boolean; message: string }> {
    return this.apiService.put<{ success: boolean; message: string }>(this.endpoints.updateConfig, config);
  }
}
