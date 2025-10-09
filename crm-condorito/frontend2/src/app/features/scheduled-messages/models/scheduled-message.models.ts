// ============================================================================
// SCHEDULED MESSAGE MODELS - CRM CONDORITO FRONTEND
// ============================================================================

/**
 * Tipos de envío de mensajes programados
 */
export type ScheduledMessageSendType = 'individual' | 'bulk_tags' | 'bulk_all';

/**
 * Tipos de mensaje
 */
export type ScheduledMessageType = 'text' | 'template';

/**
 * Estados de mensajes programados
 */
export type ScheduledMessageStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error';

/**
 * Tipos de recurrencia
 */
export type RecurrenceType = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

/**
 * Estados de ejecución
 */
export type ExecutionStatus = 'success' | 'error' | 'skipped';

/**
 * Estados de destinatarios
 */
export type RecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/**
 * Mensaje Programado
 */
export interface ScheduledMessage {
  id: number;
  client_id: number;
  name: string;
  description?: string;
  send_type: ScheduledMessageSendType;
  recipient_phone?: string;
  recipient_contact_id?: number;
  target_tag_ids?: number[];
  message_type: ScheduledMessageType;
  message_content?: string;
  template_id?: number;
  template_variables?: Record<string, any>;
  scheduled_at: string;
  timezone: string;
  is_recurring: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_end_date?: string;
  max_executions?: number;
  status: ScheduledMessageStatus;
  is_active: boolean;
  next_execution?: string;
  last_execution?: string;
  execution_count: number;
  success_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
  
  // Campos adicionales del join
  contact_name?: string;
  contact_phone?: string;
  template_name?: string;
  template_content?: string;
  total_executions?: number;
}

/**
 * Ejecución de mensaje programado
 */
export interface ScheduledMessageExecution {
  id: number;
  scheduled_message_id: number;
  execution_date: string;
  status: ExecutionStatus;
  messages_sent: number;
  messages_failed: number;
  recipients_processed: number;
  error_message?: string;
  execution_time_ms?: number;
  details?: Record<string, any>;
  created_at: string;
  
  // Campos adicionales
  total_recipients?: number;
  recipients_sent?: number;
  recipients_failed?: number;
}

/**
 * Destinatario de mensaje programado
 */
export interface ScheduledMessageRecipient {
  id: number;
  scheduled_message_id: number;
  execution_id?: number;
  contact_id?: number;
  phone_number: string;
  contact_name?: string;
  status: RecipientStatus;
  sent_at?: string;
  message_id?: string;
  error_message?: string;
  final_message_content?: string;
  created_at: string;
  
  // Campos adicionales
  contact_full_name?: string;
}

/**
 * Estadísticas de mensajes programados
 */
export interface ScheduledMessageStatistics {
  total: number;
  pending: number;
  active: number;
  completed: number;
  paused: number;
  errors: number;
  recurring: number;
  total_executions: number;
  total_success: number;
  total_errors: number;
}

/**
 * Estado del procesador
 */
export interface ProcessorStatus {
  isProcessing: boolean;
  lastProcessTime?: string;
  stats: {
    totalProcessed: number;
    totalSuccess: number;
    totalErrors: number;
    lastReset: string;
  };
  activeCronJobs: string[];
  uptime: number;
  health: {
    status: 'healthy' | 'warning' | 'unhealthy';
    issues: string[];
    lastProcessTime?: string;
    timeSinceLastProcess?: number;
    stats: any;
    activeCronJobs: number;
  };
}

/**
 * Request para crear mensaje programado
 */
export interface CreateScheduledMessageRequest {
  name: string;
  description?: string;
  send_type: ScheduledMessageSendType;
  recipient_phone?: string;
  recipient_contact_id?: number;
  target_tag_ids?: number[];
  message_type: ScheduledMessageType;
  message_content?: string;
  template_id?: number;
  template_variables?: Record<string, any>;
  scheduled_at: string;
  timezone?: string;
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_end_date?: string;
  max_executions?: number;
}

/**
 * Request para actualizar mensaje programado
 */
export interface UpdateScheduledMessageRequest {
  name?: string;
  description?: string;
  scheduled_at?: string;
  message_content?: string;
  template_id?: number;
  template_variables?: Record<string, any>;
  status?: ScheduledMessageStatus;
  is_active?: boolean;
  recurrence_end_date?: string;
  max_executions?: number;
}

/**
 * Filtros para lista de mensajes programados
 */
export interface ScheduledMessageFilters {
  page?: number;
  limit?: number;
  status?: ScheduledMessageStatus;
  send_type?: ScheduledMessageSendType;
  is_active?: boolean;
  is_recurring?: boolean;
  search?: string;
  sortBy?: 'created_at' | 'scheduled_at' | 'next_execution' | 'name' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Response de lista de mensajes programados
 */
export interface ScheduledMessagesResponse {
  success: boolean;
  data: ScheduledMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Response de lista de ejecuciones
 */
export interface ExecutionsResponse {
  success: boolean;
  data: ScheduledMessageExecution[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Response de lista de destinatarios
 */
export interface RecipientsResponse {
  success: boolean;
  data: ScheduledMessageRecipient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
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
 * Opciones de zona horaria
 */
export const TIMEZONE_OPTIONS = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-3)' },
  { value: 'America/Montevideo', label: 'Montevideo (GMT-3)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { value: 'UTC', label: 'UTC (GMT+0)' }
] as const;

/**
 * Opciones de recurrencia
 */
export const RECURRENCE_OPTIONS = [
  { value: 'minutes', label: 'Minutos', maxInterval: 60 },
  { value: 'hours', label: 'Horas', maxInterval: 24 },
  { value: 'days', label: 'Días', maxInterval: 365 },
  { value: 'weeks', label: 'Semanas', maxInterval: 52 },
  { value: 'months', label: 'Meses', maxInterval: 12 }
] as const;

/**
 * Colores para estados
 */
export const STATUS_COLORS = {
  pending: '#6c757d',    // Gris
  active: '#28a745',     // Verde
  paused: '#ffc107',     // Amarillo
  completed: '#17a2b8',  // Azul
  cancelled: '#6f42c1',  // Púrpura
  error: '#dc3545'       // Rojo
} as const;

/**
 * Iconos para tipos de envío
 */
export const SEND_TYPE_ICONS = {
  individual: 'fas fa-user',
  bulk_tags: 'fas fa-tags',
  bulk_all: 'fas fa-users'
} as const;

/**
 * Iconos para tipos de mensaje
 */
export const MESSAGE_TYPE_ICONS = {
  text: 'fas fa-comment',
  template: 'fas fa-file-alt'
} as const;
