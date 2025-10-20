import { Injectable, inject, signal } from '@angular/core';
import { Observable, BehaviorSubject, map, tap, catchError, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  Task,
  TaskReminder,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateReminderRequest,
  TaskFilters,
  TaskListResponse,
  TaskDashboardStats,
  ReminderStats,
  CalendarViewResponse,
  TaskApiResponse,
  TaskSearchResponse
} from '../models/task.models';

// ============================================================================
// TASK SERVICE - CRM CONDORITO FRONTEND
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiService = inject(ApiService);
  
  // ============================================================================
  // SIGNALS PARA ESTADO REACTIVO
  // ============================================================================
  
  public tasks = signal<Task[]>([]);
  public currentTask = signal<Task | null>(null);
  public dashboardStats = signal<TaskDashboardStats | null>(null);
  public reminderStats = signal<ReminderStats | null>(null);
  public isLoading = signal<boolean>(false);
  public error = signal<string | null>(null);
  
  // ============================================================================
  // SUBJECTS PARA ACTUALIZACIONES EN TIEMPO REAL
  // ============================================================================
  
  private tasksUpdatedSubject = new BehaviorSubject<Task[]>([]);
  public tasksUpdated$ = this.tasksUpdatedSubject.asObservable();
  
  private taskCreatedSubject = new BehaviorSubject<Task | null>(null);
  public taskCreated$ = this.taskCreatedSubject.asObservable();
  
  private taskUpdatedSubject = new BehaviorSubject<Task | null>(null);
  public taskUpdated$ = this.taskUpdatedSubject.asObservable();
  
  private taskDeletedSubject = new BehaviorSubject<number | null>(null);
  public taskDeleted$ = this.taskDeletedSubject.asObservable();

  // ============================================================================
  // MÉTODOS CRUD PARA TAREAS
  // ============================================================================

  /**
   * Obtener lista de tareas con filtros
   */
  getTasks(filters?: TaskFilters): Observable<TaskListResponse> {
    this.setLoading(true);
    this.clearError();
    
    return this.apiService.get<TaskListResponse>('/api/tasks', { params: filters })
      .pipe(
        tap(response => {
          if (response.success) {
            this.tasks.set(response.data);
            this.tasksUpdatedSubject.next(response.data);
          }
        }),
        catchError(error => {
          this.setError('Error al cargar las tareas');
          return of({ 
            success: false, 
            message: 'No se encontraron tareas',
            data: [],
            pagination: {
              total: 0,
              page: 1,
              limit: 10,
              totalPages: 1,
              hasNext: false,
              hasPrev: false
            }
          } as TaskListResponse);
        }),
        tap(() => this.setLoading(false))
      );
  }

  /**
   * Obtener tarea por ID
   */
  getTaskById(id: number): Observable<TaskApiResponse<Task>> {
    this.setLoading(true);
    this.clearError();
    
    return this.apiService.get<TaskApiResponse<Task>>(`/api/tasks/${id}`)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentTask.set(response.data);
          }
        }),
        catchError(error => {
          this.setError('Error al cargar la tarea');
          return of({ success: false, error: error.message });
        }),
        tap(() => this.setLoading(false))
      );
  }

  /**
   * Crear nueva tarea
   */
  createTask(taskData: CreateTaskRequest): Observable<TaskApiResponse<Task>> {
    this.setLoading(true);
    this.clearError();
    
    return this.apiService.post<TaskApiResponse<Task>>('/api/tasks', taskData)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            // Actualizar lista local
            const currentTasks = this.tasks();
            this.tasks.set([response.data, ...currentTasks]);
            this.tasksUpdatedSubject.next(this.tasks());
            this.taskCreatedSubject.next(response.data);
            
            // Actualizar estadísticas si están cargadas
            this.refreshDashboardStats();
          }
        }),
        catchError(error => {
          this.setError('Error al crear la tarea');
          return of({ success: false, error: error.message });
        }),
        tap(() => this.setLoading(false))
      );
  }

  /**
   * Actualizar tarea existente
   */
  updateTask(id: number, taskData: UpdateTaskRequest): Observable<TaskApiResponse<Task>> {
    this.setLoading(true);
    this.clearError();
    
    return this.apiService.put<TaskApiResponse<Task>>(`/api/tasks/${id}`, taskData)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            // Actualizar lista local
            const currentTasks = this.tasks();
            const updatedTasks = currentTasks.map(task => 
              task.id === id ? response.data! : task
            );
            this.tasks.set(updatedTasks);
            this.tasksUpdatedSubject.next(updatedTasks);
            this.taskUpdatedSubject.next(response.data);
            
            // Actualizar tarea actual si es la misma
            if (this.currentTask()?.id === id) {
              this.currentTask.set(response.data);
            }
            
            // Actualizar estadísticas
            this.refreshDashboardStats();
          }
        }),
        catchError(error => {
          this.setError('Error al actualizar la tarea');
          return of({ success: false, error: error.message });
        }),
        tap(() => this.setLoading(false))
      );
  }

  /**
   * Eliminar tarea
   */
  deleteTask(id: number): Observable<TaskApiResponse> {
    this.setLoading(true);
    this.clearError();
    
    return this.apiService.delete<TaskApiResponse>(`/api/tasks/${id}`)
      .pipe(
        tap(response => {
          if (response.success) {
            // Remover de lista local
            const currentTasks = this.tasks();
            const filteredTasks = currentTasks.filter(task => task.id !== id);
            this.tasks.set(filteredTasks);
            this.tasksUpdatedSubject.next(filteredTasks);
            this.taskDeletedSubject.next(id);
            
            // Limpiar tarea actual si es la misma
            if (this.currentTask()?.id === id) {
              this.currentTask.set(null);
            }
            
            // Actualizar estadísticas
            this.refreshDashboardStats();
          }
        }),
        catchError(error => {
          this.setError('Error al eliminar la tarea');
          return of({ success: false, error: error.message });
        }),
        tap(() => this.setLoading(false))
      );
  }

  // ============================================================================
  // MÉTODOS DE ESTADO DE TAREAS
  // ============================================================================

  /**
   * Marcar tarea como completada
   */
  markTaskComplete(id: number, completionPercentage: number = 100): Observable<TaskApiResponse<Task>> {
    return this.apiService.post<TaskApiResponse<Task>>(`/api/tasks/${id}/complete`, {
      completion_percentage: completionPercentage
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateTaskInList(response.data);
          this.taskUpdatedSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Cancelar tarea
   */
  cancelTask(id: number, reason?: string): Observable<TaskApiResponse<Task>> {
    return this.apiService.post<TaskApiResponse<Task>>(`/api/tasks/${id}/cancel`, {
      reason: reason
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateTaskInList(response.data);
          this.taskUpdatedSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Actualizar progreso de tarea
   */
  updateTaskProgress(id: number, percentage: number): Observable<TaskApiResponse<Task>> {
    return this.updateTask(id, { 
      id, 
      completion_percentage: percentage,
      status: percentage === 100 ? 'completed' : 'in_progress'
    });
  }

  // ============================================================================
  // MÉTODOS PARA RECORDATORIOS
  // ============================================================================

  /**
   * Crear recordatorio para tarea
   */
  createReminder(reminderData: CreateReminderRequest): Observable<TaskApiResponse<TaskReminder>> {
    return this.apiService.post<TaskApiResponse<TaskReminder>>(`/api/tasks/${reminderData.task_id}/reminders`, reminderData)
      .pipe(
        tap(response => {
          if (response.success) {
            // Recargar tarea actual para incluir el nuevo recordatorio
            const currentTask = this.currentTask();
            if (currentTask && currentTask.id === reminderData.task_id) {
              this.getTaskById(currentTask.id).subscribe();
            }
          }
        })
      );
  }

  /**
   * Obtener recordatorios de una tarea
   */
  getTaskReminders(taskId: number): Observable<TaskApiResponse<TaskReminder[]>> {
    return this.apiService.get<TaskApiResponse<TaskReminder[]>>(`/api/tasks/${taskId}/reminders`);
  }

  // ============================================================================
  // MÉTODOS DE ESTADÍSTICAS Y DASHBOARD
  // ============================================================================

  /**
   * Obtener estadísticas del dashboard
   */
  getDashboardStats(): Observable<TaskDashboardStats> {
    return this.apiService.get<TaskDashboardStats>('/api/tasks/dashboard')
      .pipe(
        tap(response => {
          if (response.success) {
            this.dashboardStats.set(response);
          }
        }),
        catchError(error => {
          this.setError('Error al cargar estadísticas del dashboard');
          return of({ success: false, stats: {} as any });
        })
      );
  }

  /**
   * Obtener estadísticas de recordatorios
   */
  getReminderStats(): Observable<ReminderStats> {
    return this.apiService.get<ReminderStats>('/api/tasks/stats')
      .pipe(
        tap(response => {
          if (response.success) {
            this.reminderStats.set(response);
          }
        }),
        catchError(error => {
          this.setError('Error al cargar estadísticas de recordatorios');
          return of({ 
            totalReminders: 0,
            pendingReminders: 0,
            sentReminders: 0,
            failedReminders: 0
          } as ReminderStats);
        })
      );
  }

  /**
   * Refrescar estadísticas del dashboard
   */
  refreshDashboardStats(): void {
    this.getDashboardStats().subscribe();
    this.getReminderStats().subscribe();
  }

  // ============================================================================
  // MÉTODOS DE CALENDARIO
  // ============================================================================

  /**
   * Obtener vista de calendario
   */
  getCalendarView(year: number, month: number): Observable<CalendarViewResponse> {
    return this.apiService.get<CalendarViewResponse>(`/api/tasks/calendar/${year}/${month}`)
      .pipe(
        catchError(error => {
          this.setError('Error al cargar vista de calendario');
          return of({ 
            success: false,
            message: 'Error al cargar calendario',
            data: []
          } as CalendarViewResponse);
        })
      );
  }

  // ============================================================================
  // MÉTODOS DE BÚSQUEDA
  // ============================================================================

  /**
   * Buscar tareas
   */
  searchTasks(query: string, filters?: TaskFilters): Observable<TaskSearchResponse> {
    const searchParams = { 
      q: query,  // Backend usa 'q' como parámetro de búsqueda
      ...filters 
    };
    
    return this.apiService.get<TaskSearchResponse>('/api/tasks/search', { 
      params: searchParams 
    }).pipe(
      catchError(error => {
        this.setError('Error en la búsqueda');
        return of({
          success: false,
          message: 'Error en la búsqueda',
          data: [],
          total: 0
        } as TaskSearchResponse);
      })
    );
  }

  // ============================================================================
  // MÉTODOS DE UTILIDAD
  // ============================================================================

  /**
   * Limpiar estado
   */
  clearState(): void {
    this.tasks.set([]);
    this.currentTask.set(null);
    this.dashboardStats.set(null);
    this.reminderStats.set(null);
    this.clearError();
    this.setLoading(false);
  }

  /**
   * Actualizar tarea en la lista local
   */
  private updateTaskInList(updatedTask: Task): void {
    const currentTasks = this.tasks();
    const updatedTasks = currentTasks.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    );
    this.tasks.set(updatedTasks);
    this.tasksUpdatedSubject.next(updatedTasks);
    
    // Actualizar tarea actual si es la misma
    if (this.currentTask()?.id === updatedTask.id) {
      this.currentTask.set(updatedTask);
    }
  }

  /**
   * Establecer estado de carga
   */
  public setLoading(loading: boolean): void {
    this.isLoading.set(loading);
  }

  /**
   * Establecer error
   */
  private setError(error: string): void {
    this.error.set(error);
  }

  /**
   * Limpiar error
   */
  public clearError(): void {
    this.error.set(null);
  }

  // ============================================================================
  // MÉTODOS PARA INTEGRACIÓN CON WEBSOCKET (FUTURO)
  // ============================================================================

  /**
   * Manejar actualización de tarea vía WebSocket
   */
  handleTaskUpdatedViaWebSocket(task: Task): void {
    this.updateTaskInList(task);
    this.taskUpdatedSubject.next(task);
  }

  /**
   * Manejar nueva tarea vía WebSocket
   */
  handleTaskCreatedViaWebSocket(task: Task): void {
    const currentTasks = this.tasks();
    this.tasks.set([task, ...currentTasks]);
    this.tasksUpdatedSubject.next(this.tasks());
    this.taskCreatedSubject.next(task);
  }

  /**
   * Manejar tarea eliminada vía WebSocket
   */
  handleTaskDeletedViaWebSocket(taskId: number): void {
    const currentTasks = this.tasks();
    const filteredTasks = currentTasks.filter(task => task.id !== taskId);
    this.tasks.set(filteredTasks);
    this.tasksUpdatedSubject.next(filteredTasks);
    this.taskDeletedSubject.next(taskId);
    
    if (this.currentTask()?.id === taskId) {
      this.currentTask.set(null);
    }
  }

  // ============================================================================
  // MÉTODOS ADICIONALES
  // ============================================================================

  /**
   * Manejo de errores
   */
  private handleError(message: string, error: any): void {
    console.error(message, error);
    this.setError(message);
  }
}
