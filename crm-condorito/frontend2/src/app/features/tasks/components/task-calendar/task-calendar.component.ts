import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TaskService } from '../../services/task.service';
import { 
  Task, 
  CalendarDay,
  TASK_PRIORITIES, 
  TASK_CATEGORIES, 
  TASK_STATUSES,
  TaskPriority,
  TaskCategory,
  TaskStatus
} from '../../models/task.models';

// ============================================================================
// TASK CALENDAR COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-task-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './task-calendar.component.html',
  styleUrls: ['./task-calendar.component.scss']
})
export class TaskCalendarComponent implements OnInit, OnDestroy {
  private taskService = inject(TaskService);
  private router = inject(Router);

  // ============================================================================
  // SIGNALS
  // ============================================================================
  
  public isLoading = this.taskService.isLoading;
  public error = this.taskService.error;
  public currentDate = signal<Date>(new Date());
  public calendarDays = signal<CalendarDay[]>([]);
  public selectedDay = signal<CalendarDay | null>(null);
  public viewMode = signal<'month' | 'week'>('month');
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  public currentYear = computed(() => this.currentDate().getFullYear());
  
  public currentMonthName = computed(() => {
    return this.currentDate().toLocaleDateString('es-ES', { 
      month: 'long', 
      year: 'numeric' 
    });
  });
  
  public monthStats = computed(() => {
    const days = this.calendarDays();
    const tasks = days.flatMap(day => day.tasks);
    
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => this.isTaskOverdue(t)).length
    };
  });
  
  public completionRate = computed(() => {
    const stats = this.monthStats();
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  });

  // ============================================================================
  // CONSTANTS FOR TEMPLATES
  // ============================================================================
  
  public readonly TASK_PRIORITIES = TASK_PRIORITIES;
  public readonly TASK_CATEGORIES = TASK_CATEGORIES;
  public readonly TASK_STATUSES = TASK_STATUSES;
  public readonly weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    console.log('🚀 Iniciando TaskCalendarComponent');
    this.loadCalendarData();
    this.subscribeToTaskUpdates();
  }

  ngOnDestroy(): void {
    console.log('🛑 Destruyendo TaskCalendarComponent');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // SETUP METHODS
  // ============================================================================

  private subscribeToTaskUpdates(): void {
    const taskUpdatedSub = this.taskService.taskCreated$.subscribe(() => {
      this.loadCalendarData();
    });

    const taskDeletedSub = this.taskService.taskUpdated$.subscribe(() => {
      this.loadCalendarData();
    });

    const taskCreatedSub = this.taskService.taskDeleted$.subscribe(() => {
      this.loadCalendarData();
    });

    this.subscriptions.push(taskUpdatedSub, taskDeletedSub, taskCreatedSub);
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  public loadCalendarData(): void {
    console.log('🔄 Cargando datos del calendario...');
    const year = this.currentYear();
    const month = this.currentDate().getMonth() + 1; // JavaScript months are 0-based
    
    console.log(`📅 Solicitando calendario para: ${year}/${month}`);
    
    // Usar getCalendarView que ahora devuelve las tareas directamente
    this.taskService.getCalendarView(year, month).subscribe({
      next: (response) => {
        console.log('📋 Respuesta del calendario:', response);
        if (response.success && response.data) {
          console.log(`✅ Tareas recibidas: ${response.data.length}`);
          this.generateCalendarDays(response.data);
        } else {
          console.warn('⚠️ Respuesta sin datos o error:', response);
          this.generateCalendarDays([]);
        }
      },
      error: (error) => {
        console.error('❌ Error loading calendar data:', error);
        this.generateCalendarDays([]);
      }
    });
  }

  private generateCalendarDays(tasks: Task[]): void {
    console.log('🗓️ Generando días del calendario con tareas:', tasks);
    const currentDate = this.currentDate();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and how many days in month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get first day of week (0 = Sunday)
    const firstDayOfWeek = firstDay.getDay();
    
    // Calculate days from previous month to show
    const daysFromPrevMonth = firstDayOfWeek;
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const calendarDays: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Add days from previous month
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      const dayDate = new Date(year, month - 1, daysInPrevMonth - i);
      const dayTasks = this.getTasksForDate(tasks, dayDate);
      
      calendarDays.push({
        date: dayDate.toISOString().split('T')[0],
        day_of_month: dayDate.getDate(),
        is_current_month: false,
        is_today: dayDate.getTime() === today.getTime(),
        is_weekend: dayDate.getDay() === 0 || dayDate.getDay() === 6,
        tasks: dayTasks,
        task_count: dayTasks.length
      });
    }
    
    // Add days from current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const dayTasks = this.getTasksForDate(tasks, dayDate);
      
      calendarDays.push({
        date: dayDate.toISOString().split('T')[0],
        day_of_month: day,
        is_current_month: true,
        is_today: dayDate.getTime() === today.getTime(),
        is_weekend: dayDate.getDay() === 0 || dayDate.getDay() === 6,
        tasks: dayTasks,
        task_count: dayTasks.length
      });
    }
    
    // Add days from next month to complete the grid (6 weeks = 42 days)
    const totalDays = calendarDays.length;
    const remainingDays = 42 - totalDays;
    
    for (let day = 1; day <= remainingDays; day++) {
      const dayDate = new Date(year, month + 1, day);
      const dayTasks = this.getTasksForDate(tasks, dayDate);
      
      calendarDays.push({
        date: dayDate.toISOString().split('T')[0],
        day_of_month: day,
        is_current_month: false,
        is_today: dayDate.getTime() === today.getTime(),
        is_weekend: dayDate.getDay() === 0 || dayDate.getDay() === 6,
        tasks: dayTasks,
        task_count: dayTasks.length
      });
    }
    
    console.log('📅 Días generados:', calendarDays.length);
    console.log('📋 Días con tareas:', calendarDays.filter(d => d.task_count > 0).length);
    
    this.calendarDays.set(calendarDays);
  }

  private getTasksForDate(tasks: Task[], date: Date): Task[] {
    const dateStr = date.toISOString().split('T')[0];
    console.log(`🔍 Buscando tareas para fecha: ${dateStr}`);
    
    const dayTasks = tasks.filter(task => {
      if (!task.due_date) {
        console.log(`⚠️ Tarea sin due_date:`, task);
        return false;
      }
      
      // Normalizar la fecha de la tarea a solo la fecha (sin hora)
      const taskDateStr = new Date(task.due_date).toISOString().split('T')[0];
      const matches = taskDateStr === dateStr;
      
      if (matches) {
        console.log(`✅ Tarea encontrada para ${dateStr}:`, task.title, taskDateStr);
      }
      
      return matches;
    });
    
    // Sort tasks by due time
    dayTasks.sort((a, b) => {
      const timeA = new Date(a.due_date).getTime();
      const timeB = new Date(b.due_date).getTime();
      return timeA - timeB;
    });
    
    console.log(`📋 Total tareas para ${dateStr}: ${dayTasks.length}`);
    return dayTasks;
  }

  // ============================================================================
  // NAVIGATION METHODS
  // ============================================================================

  previousMonth(): void {
    const current = this.currentDate();
    const newDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.currentDate.set(newDate);
    this.loadCalendarData();
  }

  nextMonth(): void {
    const current = this.currentDate();
    const newDate = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.currentDate.set(newDate);
    this.loadCalendarData();
  }

  goToToday(): void {
    this.currentDate.set(new Date());
    this.loadCalendarData();
  }

  setViewMode(mode: 'month' | 'week'): void {
    this.viewMode.set(mode);
    // Reload data when changing view mode
    this.loadCalendarData();
  }

  /**
   * Refresh calendar data manually
   */
  refreshCalendar(): void {
    console.log('🔄 Refrescando calendario manualmente');
    this.loadCalendarData();
  }

  // ============================================================================
  // DAY INTERACTION METHODS
  // ============================================================================

  selectDay(day: CalendarDay): void {
    this.selectedDay.set(day);
  }

  closeDayModal(): void {
    this.selectedDay.set(null);
  }

  showDayTasks(day: CalendarDay, event: Event): void {
    event.stopPropagation();
    this.selectedDay.set(day);
  }

  openTaskDetail(task: Task, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/tasks/view', task.id]);
  }

  createTaskForDay(): void {
    const day = this.selectedDay();
    if (day) {
      const dueDate = new Date(day.date);
      this.router.navigate(['/tasks/create'], {
        queryParams: { 
          due_date: dueDate.toISOString().split('T')[0] 
        }
      });
      this.closeDayModal();
    }
  }

  markTaskComplete(task: Task): void {
    if (task.id) {
      this.taskService.markTaskComplete(task.id).subscribe({
        next: () => {
          this.loadCalendarData();
        },
        error: (error) => {
          console.error('Error marking task complete:', error);
        }
      });
    }
  }

  // ============================================================================
  // TEMPLATE HELPER METHODS
  // ============================================================================

  formatSelectedDayTitle(): string {
    const day = this.selectedDay();
    if (!day) return '';
    
    const date = new Date(day.date);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getTaskTime(dueDateString: string): string {
    if (!dueDateString) return 'Sin hora';
    
    const date = new Date(dueDateString);
    
    // Check if the time is set to 00:00 (likely just a date without specific time)
    if (date.getHours() === 0 && date.getMinutes() === 0) {
      return 'Todo el día';
    }
    
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTaskPreviewClass(task: Task): string {
    const classes = [`priority-${task.priority}`];
    
    if (task.status === 'completed') {
      classes.push('status-completed');
    } else if (this.isTaskOverdue(task)) {
      classes.push('status-overdue');
    }
    
    return classes.join(' ');
  }

  getTaskStatusClass(status: TaskStatus): string {
    return `status-${status}`;
  }

  isTaskOverdue(task: Task): boolean {
    const dueDate = new Date(task.due_date);
    const now = new Date();
    return dueDate < now && task.status !== 'completed' && task.status !== 'cancelled';
  }

  getCompletionRateClass(): string {
    const rate = this.completionRate();
    if (rate >= 90) return 'rate-excellent';
    if (rate >= 70) return 'rate-good';
    if (rate >= 50) return 'rate-average';
    return 'rate-poor';
  }

  // Helper methods for labels
  getStatusLabel(status: TaskStatus): string {
    const statusObj = TASK_STATUSES.find(s => s.value === status);
    return statusObj?.label || status;
  }

  getPriorityLabel(priority: TaskPriority): string {
    const priorityObj = TASK_PRIORITIES.find(p => p.value === priority);
    return priorityObj?.label || priority;
  }

  getCategoryLabel(category: TaskCategory): string {
    const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
    return categoryObj?.label || category;
  }

  getCategoryIcon(category: TaskCategory): string {
    const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
    return categoryObj?.icon ? `fa-${categoryObj.icon}` : 'fa-circle';
  }

  getStatusBadgeClass(status: TaskStatus): string {
    return `status-${status}`;
  }

  getPriorityBadgeClass(priority: TaskPriority): string {
    return `priority-${priority}`;
  }
}