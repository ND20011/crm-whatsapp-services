// ============================================================================
// TASK MODELS - CRM CONDORITO FRONTEND
// ============================================================================

/**
 * Prioridades de tareas
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Categorías de tareas
 */
export type TaskCategory = 'meeting' | 'call' | 'follow_up' | 'reminder' | 'task' | 'other';

/**
 * Estados de tareas
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';

/**
 * Estados de recordatorios
 */
export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

/**
 * Tipos de recordatorios
 */
export type ReminderType = 'whatsapp' | 'email' | 'notification';

/**
 * Patrón de recurrencia para tareas recurrentes
 */
export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // cada cuántos días/semanas/meses/años
  end_date?: string; // fecha de fin de recurrencia (opcional)
  max_occurrences?: number; // máximo número de ocurrencias (opcional)
  days_of_week?: number[]; // para recurrencia semanal (0 = domingo, 1 = lunes, etc.)
  day_of_month?: number; // para recurrencia mensual
  month_of_year?: number; // para recurrencia anual
}

/**
 * Interfaz principal para tareas
 */
export interface Task {
  id?: number;
  client_id: number;
  title: string;
  description?: string;
  priority: TaskPriority;
  category: TaskCategory;
  tags?: string[];
  due_date: string; // ISO string
  reminder_datetime?: string; // ISO string
  estimated_duration?: number; // en minutos
  related_contact_id?: number;
  related_phone?: string;
  status: TaskStatus;
  completion_percentage: number;
  completed_at?: string; // ISO string
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  parent_task_id?: number;
  last_exported_to_google?: string; // ISO string
  google_export_count: number;
  created_at?: string; // ISO string
  updated_at?: string; // ISO string
  
  // Campos calculados/relacionados (del backend)
  contact_name?: string;
  contact_custom_name?: string;
  days_until_due?: number;
  is_overdue?: boolean;
  reminders?: TaskReminder[];
}

/**
 * Interfaz para recordatorios de tareas
 */
export interface TaskReminder {
  id?: number;
  task_id: number;
  reminder_datetime: string; // ISO string
  reminder_type: ReminderType;
  reminder_phone?: string; // Nuevo campo para especificar teléfono
  message?: string;
  status: ReminderStatus;
  sent_at?: string; // ISO string
  error_message?: string;
  created_at?: string; // ISO string
  updated_at?: string; // ISO string
  
  // Campos relacionados (del backend)
  task_title?: string;
  task_description?: string;
  task_due_date?: string;
  task_priority?: TaskPriority;
  task_category?: TaskCategory;
  contact_name?: string;
  contact_custom_name?: string;
}

/**
 * Interfaz para crear/actualizar tareas
 */
export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority: TaskPriority;
  category: TaskCategory;
  tags?: string[];
  due_date: string;
  reminder_datetime?: string;
  estimated_duration?: number;
  related_contact_id?: number;
  related_phone?: string;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  
  // Campos específicos para el servicio
  create_reminder?: boolean;
  auto_reminder_minutes_before?: number;
  reminder_message?: string;
  reminder_type?: ReminderType;
  reminder_phone?: string; // Nuevo campo para especificar teléfono
}

/**
 * Interfaz para actualizar tareas
 */
export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  id: number;
  status?: TaskStatus;
  completion_percentage?: number;
}

/**
 * Interfaz para crear recordatorios
 */
export interface CreateReminderRequest {
  task_id: number;
  reminder_datetime: string;
  reminder_type: ReminderType;
  reminder_phone?: string; // Nuevo campo para especificar teléfono
  message: string;
}

/**
 * Interfaz para filtros de búsqueda
 */
export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  category?: TaskCategory[];
  tags?: string[];
  contact_id?: number;
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'due_date' | 'created_at' | 'priority' | 'title';
  sort_order?: 'asc' | 'desc';
}

/**
 * Interfaz para respuesta de lista de tareas (PRIMERA VERSIÓN - ELIMINAR)
 */
// DEPRECATED - Usar la versión más reciente
/* export interface TaskListResponse {
  success: boolean;
  tasks: Task[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
    has_next: boolean;
    has_prev: boolean;
  };
  filters_applied: TaskFilters;
} */

/**
 * Interfaz para estadísticas del dashboard
 */
export interface TaskDashboardStats {
  success: boolean;
  stats: {
    total_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    
    // Por prioridad
    urgent_tasks: number;
    high_priority_tasks: number;
    medium_priority_tasks: number;
    low_priority_tasks: number;
    
    // Por categoría
    meetings: number;
    calls: number;
    follow_ups: number;
    reminders: number;
    general_tasks: number;
    other_tasks: number;
    
    // Próximas tareas
    tasks_today: number;
    tasks_tomorrow: number;
    tasks_this_week: number;
    tasks_next_week: number;
    
    // Métricas de rendimiento
    completion_rate: number; // porcentaje
    average_completion_time: number; // días
    overdue_rate: number; // porcentaje
  };
}

/**
 * Interfaz para estadísticas de recordatorios
 */
export interface ReminderStats {
  success: boolean;
  stats: {
    total_reminders: number;
    pending_reminders: number;
    sent_reminders: number;
    failed_reminders: number;
    cancelled_reminders: number;
    
    // Por tipo
    whatsapp_reminders: number;
    email_reminders: number;
    notification_reminders: number;
    
    // Métricas
    success_rate: number; // porcentaje
    average_delivery_time: number; // minutos
  };
}

/**
 * Interfaz para vista de calendario (PRIMERA VERSIÓN - ELIMINAR)
 */
// DEPRECATED - Usar la versión más reciente
/* export interface CalendarViewResponse {
  success: boolean;
  calendar: {
    year: number;
    month: number;
    days: CalendarDay[];
  };
} */

/**
 * Interfaz para día del calendario
 */
export interface CalendarDay {
  date: string; // YYYY-MM-DD
  day_of_month: number;
  is_current_month: boolean;
  is_today: boolean;
  is_weekend: boolean;
  tasks: Task[]; // Usar Task directamente
  task_count: number;
}

/**
 * Interfaz para tareas en el calendario
 */
export interface CalendarTask {
  id: number;
  title: string;
  priority: TaskPriority;
  category: TaskCategory;
  status: TaskStatus;
  due_time?: string; // HH:MM
  estimated_duration?: number;
  is_overdue: boolean;
}

/**
 * Interfaz para respuestas de API genéricas
 */
export interface TaskApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: { [key: string]: string[] };
}

/**
 * Interfaz para respuesta de búsqueda
 */
// DEPRECATED - Usar la versión más reciente
/* export interface TaskSearchResponse {
  success: boolean;
  results: Task[];
  total_results: number;
  search_query: string;
  suggestions?: string[];
} */

/**
 * Opciones para configuración de componentes
 */
export interface TaskComponentConfig {
  showFilters?: boolean;
  showPagination?: boolean;
  showActions?: boolean;
  showBulkActions?: boolean;
  defaultView?: 'list' | 'grid' | 'calendar';
  itemsPerPage?: number;
  enableRealtime?: boolean;
}

/**
 * Constantes útiles
 */
export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baja', color: 'success' },
  { value: 'medium', label: 'Media', color: 'warning' },
  { value: 'high', label: 'Alta', color: 'danger' },
  { value: 'urgent', label: 'Urgente', color: 'dark' }
];

export const TASK_CATEGORIES: { value: TaskCategory; label: string; icon: string }[] = [
  { value: 'meeting', label: 'Reunión', icon: 'calendar' },
  { value: 'call', label: 'Llamada', icon: 'phone' },
  { value: 'follow_up', label: 'Seguimiento', icon: 'refresh' },
  { value: 'reminder', label: 'Recordatorio', icon: 'bell' },
  { value: 'task', label: 'Tarea', icon: 'check-square' },
  { value: 'other', label: 'Otro', icon: 'more-horizontal' }
];

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pendiente', color: 'secondary' },
  { value: 'in_progress', label: 'En Progreso', color: 'primary' },
  { value: 'completed', label: 'Completada', color: 'success' },
  { value: 'cancelled', label: 'Cancelada', color: 'muted' },
  { value: 'overdue', label: 'Vencida', color: 'danger' }
];

export const REMINDER_TYPES: { value: ReminderType; label: string; icon: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'notification', label: 'Notificación', icon: 'bell' }
];

/**
 * Filtros para búsqueda de tareas
 */
export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  category?: TaskCategory[];
  tags?: string[];
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
  contact_id?: number;
  is_recurring?: boolean;
  is_overdue?: boolean;
}

/**
 * Respuesta de la API para lista de tareas
 */
export interface TaskListResponse {
  success: boolean;
  message: string;
  data: Task[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats?: any;
}

/**
 * Interfaces adicionales para el servicio
 */
export interface CreateTaskRequest extends Partial<Task> {
  title: string;
  due_date: string;
  create_reminder?: boolean;
  auto_reminder_minutes_before?: number;
  reminder_type?: ReminderType;
  reminder_phone?: string; // Nuevo campo para especificar teléfono
  reminder_message?: string;
}

export interface UpdateTaskRequest extends Partial<Task> {
  id: number;
}

// DEPRECATED - Interface duplicada, usar la versión anterior
/* export interface CreateReminderRequest {
  task_id: number;
  reminder_datetime: string;
  reminder_type: ReminderType;
  message: string;
} */

export interface ReminderStats {
  totalReminders: number;
  pendingReminders: number;
  sentReminders: number;
  failedReminders: number;
}

export interface CalendarViewResponse {
  success: boolean;
  message: string;
  data: Task[];
}

// DEPRECATED - Interface duplicada, usar la versión anterior
/* export interface TaskApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
} */

export interface TaskSearchResponse {
  success: boolean;
  message: string;
  data: Task[];
  total: number;
}
