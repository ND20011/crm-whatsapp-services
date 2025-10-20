import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { Task, TaskDashboardStats } from '../../models/task.models';
import { TASK_STATUSES, TASK_PRIORITIES, TASK_CATEGORIES } from '../../models/task.models';

@Component({
  selector: 'app-task-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './task-dashboard.component.html',
  styleUrls: ['./task-dashboard.component.scss']
})
export class TaskDashboardComponent implements OnInit {
  
  // Signals para el estado del componente
  public isLoading = signal<boolean>(false);
  public error = signal<string | null>(null);
  public dashboardStats = signal<TaskDashboardStats | null>(null);
  public upcomingTasks = signal<Task[]>([]);
  public recentTasks = signal<Task[]>([]);
  public todayTasks = signal<Task[]>([]);

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  public loadDashboardData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // Cargar tareas del día (desde hoy 00:00 hasta 23:59)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Obtener tareas del día
    this.taskService.getTasks({
      due_date_from: startOfDay.toISOString().split('T')[0],
      due_date_to: endOfDay.toISOString().split('T')[0],
      limit: 100,
      sort_by: 'due_date',
      sort_order: 'asc'
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.todayTasks.set(response.data || []);
        }
        this.loadUpcomingTasks();
      },
      error: (error) => {
        console.error('Error cargando tareas del día:', error);
        this.error.set('Error al cargar las tareas del día');
        this.isLoading.set(false);
      }
    });
  }

  private loadUpcomingTasks(): void {
    // Cargar próximas tareas (próximos 7 días, excluyendo hoy)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    this.taskService.getTasks({
      status: ['pending', 'in_progress'],
      due_date_from: tomorrow.toISOString().split('T')[0],
      due_date_to: nextWeek.toISOString().split('T')[0],
      limit: 5,
      sort_by: 'due_date',
      sort_order: 'asc'
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.upcomingTasks.set(response.data || []);
        }
        this.loadRecentTasks();
      },
      error: (error) => {
        console.error('Error cargando próximas tareas:', error);
        this.loadRecentTasks();
      }
    });
  }

  private loadRecentTasks(): void {
    // Cargar tareas completadas recientemente (últimos 7 días)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    this.taskService.getTasks({
      status: ['completed'],
      limit: 5,
      sort_by: 'created_at',
      sort_order: 'desc'
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.recentTasks.set(response.data || []);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error cargando tareas recientes:', error);
        this.isLoading.set(false);
      }
    });
  }

  // ============================================================================
  // COMPUTED PROPERTIES PARA TAREAS DEL DÍA
  // ============================================================================

  public getTodayPendingTasks = computed(() => {
    return this.todayTasks().filter(task => task.status === 'pending');
  });

  public getTodayInProgressTasks = computed(() => {
    return this.todayTasks().filter(task => task.status === 'in_progress');
  });

  public getTodayCompletedTasks = computed(() => {
    return this.todayTasks().filter(task => task.status === 'completed');
  });

  public getTodayActiveTasks = computed(() => {
    return this.todayTasks().filter(task => 
      task.status === 'pending' || task.status === 'in_progress' || task.status === 'overdue'
    ).sort((a, b) => {
      // Ordenar por prioridad (urgent -> high -> medium -> low) y luego por fecha de vencimiento
      const priorityOrder: { [key: string]: number } = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      
      return 0;
    });
  });

  public getTotalTodayTasks(): number {
    return this.todayTasks().length;
  }

  // ============================================================================
  // MÉTODOS DE ACCIÓN PARA TAREAS
  // ============================================================================

  public startTask(task: Task): void {
    this.taskService.updateTask(task.id!, { 
      id: task.id!, 
      status: 'in_progress' 
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadDashboardData(); // Recargar datos
        }
      },
      error: (error) => {
        console.error('Error iniciando tarea:', error);
      }
    });
  }

  public completeTask(task: Task): void {
    this.taskService.markTaskComplete(task.id!).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadDashboardData(); // Recargar datos
        }
      },
      error: (error) => {
        console.error('Error completando tarea:', error);
      }
    });
  }

  public cancelTask(task: Task): void {
    // Solicitar confirmación antes de cancelar
    const confirmCancel = confirm(`¿Estás seguro de que quieres cancelar la tarea "${task.title}"?`);
    if (!confirmCancel) return;

    this.taskService.cancelTask(task.id!, 'Cancelada desde el dashboard').subscribe({
      next: (response) => {
        if (response.success) {
          this.loadDashboardData(); // Recargar datos
        }
      },
      error: (error) => {
        console.error('Error cancelando tarea:', error);
      }
    });
  }

  public reopenTask(task: Task): void {
    this.taskService.updateTask(task.id!, { 
      id: task.id!, 
      status: 'pending' 
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadDashboardData(); // Recargar datos
        }
      },
      error: (error) => {
        console.error('Error reabriendo tarea:', error);
      }
    });
  }

  public exportCompletedTasks(): void {
    const completedTasks = this.getTodayCompletedTasks();
    const csvContent = this.generateCSV(completedTasks);
    this.downloadCSV(csvContent, `tareas-completadas-${this.getCurrentDate()}.csv`);
  }

  // ============================================================================
  // MÉTODOS DE UTILIDAD Y FORMATEO
  // ============================================================================

  public getCurrentDate(): string {
    const today = new Date();
    return today.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  public formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  public formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Sin fecha';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  public calculateDuration(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      return `${days}d ${hours}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }

  public isTaskOverdue(task: Task): boolean {
    if (!task.due_date) return false;
    const now = new Date();
    const dueDate = new Date(task.due_date);
    return dueDate < now && task.status !== 'completed';
  }

  public isTaskDueToday(task: Task): boolean {
    if (!task.due_date) return false;
    const today = new Date();
    const dueDate = new Date(task.due_date);
    return (
      dueDate.getDate() === today.getDate() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getFullYear() === today.getFullYear()
    );
  }

  // ============================================================================
  // MÉTODOS DE ETIQUETAS Y BADGES
  // ============================================================================

  public getStatusLabel(status: string): string {
    const statusObj = TASK_STATUSES.find(s => s.value === status);
    return statusObj ? statusObj.label : status;
  }

  public getPriorityLabel(priority: string): string {
    const priorityObj = TASK_PRIORITIES.find(p => p.value === priority);
    return priorityObj ? priorityObj.label : priority;
  }

  public getCategoryLabel(category: string): string {
    const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
    return categoryObj ? categoryObj.label : category;
  }

  public getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'pending': 'fa-clock',
      'in_progress': 'fa-play',
      'completed': 'fa-check',
      'cancelled': 'fa-times'
    };
    return icons[status] || 'fa-question';
  }

  public getPriorityIcon(priority: string): string {
    const icons: { [key: string]: string } = {
      'low': 'fa-arrow-down',
      'medium': 'fa-minus',
      'high': 'fa-arrow-up'
    };
    return icons[priority] || 'fa-minus';
  }

  public getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'task': 'fa-tasks',
      'meeting': 'fa-users',
      'call': 'fa-phone',
      'email': 'fa-envelope',
      'reminder': 'fa-bell',
      'follow_up': 'fa-redo'
    };
    return icons[category] || 'fa-tag';
  }

  // ============================================================================
  // MÉTODOS PRIVADOS DE UTILIDAD
  // ============================================================================

  private generateCSV(tasks: Task[]): string {
    const headers = ['Título', 'Descripción', 'Categoría', 'Prioridad', 'Completada', 'Duración'];
    const rows = tasks.map(task => [
      task.title,
      task.description || '',
      this.getCategoryLabel(task.category),
      this.getPriorityLabel(task.priority),
      this.formatTime(task.completed_at || ''),
      task.created_at && task.completed_at ? 
        this.calculateDuration(task.created_at, task.completed_at) : ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}