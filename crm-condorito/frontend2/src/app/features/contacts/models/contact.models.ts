// ============================================================================
// CONTACT MODELS - CRM CONDORITO FRONTEND
// ============================================================================

/**
 * Template de mensaje
 */
export interface MessageTemplate {
  id: number;
  client_id: number;
  name: string;
  content: string;
  category?: string;
  variables?: any;
  created_at: string;
  updated_at: string;
}

/**
 * Etiqueta/Tag de contacto
 */
export interface ContactTag {
  id: number;
  client_id: number;
  name: string;
  color: string;
  description?: string;
  contact_count?: number;
  assigned_at?: string; // Fecha cuando fue asignada esta etiqueta al contacto
  created_at: string;
  updated_at: string;
  
  // 🆕 Campos para mensajes automáticos
  has_auto_message?: boolean;
  auto_message_template_id?: number;
  auto_message_delay_hours?: number;
  auto_message_content?: string;
  is_active_auto?: boolean;
  
  // 🆕 Campos populados cuando se cargan con templates
  template_name?: string;
  template_content?: string;
  template_variables?: any;
}

/**
 * Contacto
 */
export interface Contact {
  id: number;
  client_id: number;
  phone_number: string;
  name?: string;
  custom_name?: string;
  profile_pic_url?: string;
  comments?: string;
  is_blocked: boolean;
  last_message_at?: string;
  tags: ContactTag[];
  created_at: string;
  updated_at: string;
}

/**
 * Request para crear etiqueta
 */
export interface CreateTagRequest {
  name: string;
  color: string;
  description?: string;
}

/**
 * Request para actualizar etiqueta
 */
export interface UpdateTagRequest {
  name?: string;
  color?: string;
  description?: string;
  // 🆕 Campos para mensajes automáticos
  has_auto_message?: boolean;
  auto_message_template_id?: number;
  auto_message_delay_hours?: number;
  auto_message_content?: string;
  is_active_auto?: boolean;
}

/**
 * Request para asignar etiquetas a contacto
 */
export interface AssignTagsRequest {
  tagIds: number[];
}

/**
 * Response de lista de etiquetas
 */
export interface TagsResponse {
  success: boolean;
  data: ContactTag[];
  total: number;
}

/**
 * Response de lista de contactos
 */
export interface ContactsResponse {
  success: boolean;
  data: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Response genérica de API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Filtros para lista de contactos
 */
export interface ContactFilters {
  search?: string;
  tagId?: number;
  tagIds?: number[]; // Filtro por múltiples etiquetas
  untagged?: boolean;
  isBlocked?: boolean;
  sortBy?: 'name' | 'phone_number' | 'created_at' | 'last_message_at';
  sortOrder?: 'ASC' | 'DESC';
  tagAssignedFrom?: string; // Fecha de inicio para filtro de asignación de etiquetas
  tagAssignedTo?: string; // Fecha de fin para filtro de asignación de etiquetas
  page?: number;
  limit?: number;
}

/**
 * Filtros para lista de etiquetas
 */
export interface TagFilters {
  search?: string;
  sortBy?: 'name' | 'created_at' | 'updated_at';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Colores predefinidos para etiquetas
 */
export const TAG_COLORS = [
  '#ff6b6b', // Rojo
  '#4ecdc4', // Turquesa
  '#45b7d1', // Azul
  '#96ceb4', // Verde
  '#ffa726', // Naranja
  '#ab47bc', // Púrpura
  '#ef5350', // Rojo claro
  '#26a69a', // Verde azulado
  '#42a5f5', // Azul claro
  '#66bb6a', // Verde claro
  '#ff7043', // Naranja rojizo
  '#8e24aa', // Púrpura oscuro
  '#ec407a', // Rosa
  '#29b6f6', // Azul cielo
  '#9ccc65', // Verde lima
  '#ffa726', // Ámbar
] as const;

/**
 * Iconos para diferentes tipos de etiquetas
 */
export const TAG_ICONS = {
  vip: '👑',
  client: '👤',
  prospect: '🎯',
  support: '🛠️',
  sales: '💰',
  marketing: '📢',
  location: '📍',
  priority: '⭐',
  status: '📊',
  category: '📁',
} as const;

export type TagIconType = keyof typeof TAG_ICONS;

// ============================================================================
// 🆕 AUTO MESSAGE INTERFACES
// ============================================================================

/**
 * Request para configurar mensaje automático de etiqueta
 */
export interface AutoMessageConfigRequest {
  has_auto_message: boolean;
  auto_message_template_id?: number;
  auto_message_delay_hours?: number;
  auto_message_content?: string;
  is_active_auto?: boolean;
}

/**
 * Response de configuración de mensaje automático
 */
export interface AutoMessageConfigResponse {
  success: boolean;
  data: {
    config: ContactTag;
    stats: AutoMessageStats;
  };
}

/**
 * Estadísticas de mensajes automáticos por etiqueta
 */
export interface AutoMessageStats {
  total_messages: number;
  pending_count: number;
  active_count: number;
  completed_count: number;
  cancelled_count: number;
  error_count: number;
}

/**
 * Mensaje automático generado
 */
export interface AutoMessage {
  id: number;
  client_id: number;
  name: string;
  description: string;
  scheduled_at: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'error';
  message_type: 'text' | 'template';
  template_id?: number;
  message_content?: string;
  auto_generated: boolean;
  source_tag_id: number;
  source_contact_id: number;
  contact_name?: string;
  contact_phone?: string;
  tag_name?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Response de lista de mensajes automáticos
 */
export interface AutoMessagesResponse {
  success: boolean;
  data: {
    messages: AutoMessage[];
    stats: AutoMessageStats;
  };
}
