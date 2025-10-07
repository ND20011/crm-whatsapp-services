/**
 * Modelos para el sistema de templates de mensajes
 */

export interface MessageTemplate {
  id: number;
  client_id: number;
  name: string;
  content: string;
  variables: TemplateVariable[];
  category: string;
  is_active: boolean;
  usage_count: number;
  last_used?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  name: string;
  description?: string;
  default_value?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'date' | 'email' | 'phone';
}

export interface TemplateCategory {
  category: string;
  count: number;
}

export interface CreateTemplateRequest {
  name: string;
  content: string;
  variables?: TemplateVariable[];
  category?: string;
  is_active?: boolean;
}

export interface UpdateTemplateRequest {
  name?: string;
  content?: string;
  variables?: TemplateVariable[];
  category?: string;
  is_active?: boolean;
}

export interface TemplatePreviewRequest {
  variables: { [key: string]: string };
}

export interface TemplatePreviewResponse {
  success: boolean;
  preview: string;
  variables_used: string[];
  variables_missing: string[];
}

export interface TemplateUseRequest {
  variables: { [key: string]: string };
  phone_number?: string;
  conversation_id?: number;
}

export interface TemplateUseResponse {
  success: boolean;
  message: string;
  processed_content: string;
  variables_used: string[];
}

export interface TemplatesListResponse {
  success: boolean;
  templates: MessageTemplate[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface TemplateResponse {
  success: boolean;
  template: MessageTemplate;
  message?: string;
}

export interface TemplateStatsResponse {
  success: boolean;
  stats: {
    total_templates: number;
    active_templates: number;
    inactive_templates: number;
    total_usage: number;
    categories: {
      [category: string]: {
        count: number;
        usage: number;
      };
    };
    most_used: MessageTemplate[];
    recent: MessageTemplate[];
  };
}

export interface TemplateCategoriesResponse {
  success: boolean;
  categories: TemplateCategory[];
}

// Las categorías ahora se obtienen dinámicamente del backend

// Variables del sistema disponibles
export const SYSTEM_VARIABLES = [
  { name: 'fecha', description: 'Fecha actual', type: 'date' as const },
  { name: 'hora', description: 'Hora actual', type: 'text' as const },
  { name: 'dia_semana', description: 'Día de la semana', type: 'text' as const },
  { name: 'mes', description: 'Mes actual', type: 'text' as const },
  { name: 'año', description: 'Año actual', type: 'number' as const },
  { name: 'empresa', description: 'Nombre de la empresa', type: 'text' as const },
  { name: 'cliente', description: 'Nombre del cliente', type: 'text' as const },
  { name: 'telefono', description: 'Número de teléfono', type: 'phone' as const }
];
