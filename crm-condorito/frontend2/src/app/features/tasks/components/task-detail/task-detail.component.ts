import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskService } from '../../services/task.service';
import { 
  Task, 
  TaskReminder,
  TASK_PRIORITIES, 
  TASK_CATEGORIES, 
  TASK_STATUSES,
  REMINDER_TYPES,
  TaskStatus
} from '../../models/task.models';

// ============================================================================
// TASK DETAIL COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './task-detail.component.html',
  styleUrls: ['./task-detail.component.scss']
})
export class TaskDetailComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private taskService = inject(TaskService);

  // Make Math available in template
  public Math = Math;
  
  // ============================================================================
  // SIGNALS
  // ============================================================================
  
  public task = signal<Task | null>(null);
  public reminders = signal<TaskReminder[]>([]);
  public isLoading = this.taskService.isLoading;
  public error = this.taskService.error;
  public taskId = signal<number | null>(null);
  public isUpdating = signal<boolean>(false);
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  public isOverdue = computed(() => {
    const currentTask = this.task();
    if (!currentTask) return false;
    
    const dueDate = new Date(currentTask.due_date);
    const now = new Date();
    return dueDate < now && currentTask.status !== 'completed' && currentTask.status !== 'cancelled';
  });
  
  public canComplete = computed(() => {
    const currentTask = this.task();
    return currentTask?.status === 'pending' || currentTask?.status === 'in_progress';
  });
  
  public canCancel = computed(() => {
    const currentTask = this.task();
    return currentTask?.status === 'pending' || currentTask?.status === 'in_progress';
  });
  
  public canReopen = computed(() => {
    const currentTask = this.task();
    return currentTask?.status === 'completed' || currentTask?.status === 'cancelled';
  });
  
  public taskProgress = computed(() => {
    const currentTask = this.task();
    return currentTask?.completion_percentage || 0;
  });
  
  public formattedDueDate = computed(() => {
    const currentTask = this.task();
    if (!currentTask?.due_date) return 'No especificada';
    return this.formatDate(currentTask.due_date);
  });
  
  public taskStatusClass = computed(() => {
    const currentTask = this.task();
    if (!currentTask) return '';
    return `task-${currentTask.status}${this.isOverdue() ? ' task-overdue' : ''}`;
  });

  // ============================================================================
  // CONSTANTS FOR TEMPLATES
  // ============================================================================
  
  public readonly TASK_PRIORITIES = TASK_PRIORITIES;
  public readonly TASK_CATEGORIES = TASK_CATEGORIES;
  public readonly TASK_STATUSES = TASK_STATUSES;
  public readonly REMINDER_TYPES = REMINDER_TYPES;
  
  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    this.setupRouteSubscription();
    this.subscribeToTaskUpdates();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // SETUP METHODS
  // ============================================================================

  private setupRouteSubscription(): void {
    const routeSub = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.taskId.set(+id);
        this.loadTaskData(+id);
      } else {
        this.router.navigate(['/tasks/list']);
      }
    });
    
    this.subscriptions.push(routeSub);
  }

  private subscribeToTaskUpdates(): void {
    const taskUpdatedSub = this.taskService.taskUpdated$.subscribe(updatedTask => {
      if (updatedTask && updatedTask.id === this.taskId()) {
        this.task.set(updatedTask);
      }
    });

    const taskDeletedSub = this.taskService.taskDeleted$.subscribe(deletedTaskId => {
      if (deletedTaskId === this.taskId()) {
        this.router.navigate(['/tasks/list']);
      }
    });

    this.subscriptions.push(taskUpdatedSub, taskDeletedSub);
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  private loadTaskData(id: number): void {
    this.taskService.getTaskById(id).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.task.set(response.data);
          this.reminders.set(response.data.reminders || []);
        } else {
          this.router.navigate(['/tasks/list']);
        }
      },
      error: (error) => {
        console.error('Error loading task:', error);
        this.router.navigate(['/tasks/list']);
      }
    });
  }

  // ============================================================================
  // ACTION METHODS
  // ============================================================================

  /**
   * Marcar tarea como completada
   */
  completeTask(): void {
    const currentTask = this.task();
    if (!currentTask?.id || !this.canComplete()) return;
    
    this.isUpdating.set(true);
    
    this.taskService.markTaskComplete(currentTask.id, 100).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.task.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error completing task:', error);
      },
      complete: () => {
        this.isUpdating.set(false);
      }
    });
  }

  /**
   * Cancelar tarea
   */
  cancelTask(): void {
    const currentTask = this.task();
    if (!currentTask?.id) return;
    
    const reason = prompt('¿Motivo de cancelación? (opcional)');
    if (reason === null) return; // User cancelled
    
    this.isUpdating.set(true);
    
    this.taskService.cancelTask(currentTask.id, reason || undefined).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.task.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error cancelling task:', error);
      },
      complete: () => {
        this.isUpdating.set(false);
      }
    });
  }

  /**
   * Eliminar tarea
   */
  deleteTask(): void {
    const currentTask = this.task();
    if (!currentTask?.id) return;
    
    if (confirm(`¿Estás seguro de que quieres eliminar la tarea "${currentTask.title}"?`)) {
      this.isUpdating.set(true);
      
      this.taskService.deleteTask(currentTask.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.router.navigate(['/tasks/list']);
          }
        },
        error: (error) => {
          console.error('Error deleting task:', error);
        },
        complete: () => {
          this.isUpdating.set(false);
        }
      });
    }
  }

  // ============================================================================
  // TEMPLATE HELPER METHODS
  // ============================================================================

  /**
   * Get status label helper
   */
  getStatusLabel(status: string): string {
    const statusObj = TASK_STATUSES.find(s => s.value === status);
    return statusObj?.label || status;
  }

  /**
   * Get priority label helper
   */
  getPriorityLabel(priority: string): string {
    const priorityObj = TASK_PRIORITIES.find(p => p.value === priority);
    return priorityObj?.label || priority;
  }

  /**
   * Get category label helper
   */
  getCategoryLabel(category: string): string {
    const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
    return categoryObj?.label || category;
  }

  /**
   * Get reminder type label helper
   */
  getReminderTypeLabel(type: string): string {
    const typeObj = REMINDER_TYPES.find(t => t.value === type);
    return typeObj?.label || type;
  }

  /**
   * Get status icon for badges
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'fa-hourglass-half';
      case 'in_progress': return 'fa-sync-alt';
      case 'completed': return 'fa-check-circle';
      case 'cancelled': return 'fa-times-circle';
      case 'overdue': return 'fa-exclamation-circle';
      default: return 'fa-question-circle';
    }
  }

  /**
   * Get status badge CSS class
   */
  getStatusBadgeClass(status: string): string {
    return `status-${status}`;
  }

  /**
   * Get priority badge CSS class
   */
  getPriorityBadgeClass(priority: string): string {
    return `priority-${priority}`;
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
    return categoryObj?.icon ? `fa-${categoryObj.icon}` : 'fa-question-circle';
  }

  /**
   * Get reminder icon
   */
  getReminderIcon(type: string): string {
    const typeObj = REMINDER_TYPES.find(t => t.value === type);
    return typeObj?.icon ? `fa-${typeObj.icon}` : 'fa-bell';
  }

  /**
   * Get reminder status CSS class
   */
  getReminderStatusClass(status: string): string {
    return `status-${status}`;
  }

  /**
   * Get reminder status label
   */
  getReminderStatusLabel(status: string): string {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Falló';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  }

  /**
   * Get progress bar class based on percentage
   */
  getProgressBarClass(percentage: number): string {
    if (percentage >= 100) return 'progress-complete';
    if (percentage >= 75) return 'progress-high';
    if (percentage >= 50) return 'progress-medium';
    return 'progress-low';
  }

  /**
   * Get recurrence description
   */
  getRecurrenceDescription(): string {
    const task = this.task();
    if (!task?.recurrence_pattern) return 'Sin información';

    const pattern = task.recurrence_pattern;
    let description = '';

    switch (pattern.type) {
      case 'daily':
        description = pattern.interval === 1 ? 'Diariamente' : `Cada ${pattern.interval} días`;
        break;
      case 'weekly':
        description = pattern.interval === 1 ? 'Semanalmente' : `Cada ${pattern.interval} semanas`;
        break;
      case 'monthly':
        description = pattern.interval === 1 ? 'Mensualmente' : `Cada ${pattern.interval} meses`;
        break;
      case 'yearly':
        description = pattern.interval === 1 ? 'Anualmente' : `Cada ${pattern.interval} años`;
        break;
      default:
        description = 'Recurrencia personalizada';
    }

    if (pattern.end_date) {
      description += ` hasta ${this.formatDate(pattern.end_date)}`;
    } else if (pattern.max_occurrences) {
      description += ` por ${pattern.max_occurrences} veces`;
    }

    return description;
  }

  /**
   * Format date for display - handles undefined values
   */
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Load task data - public method for template
   */
  public loadTask(): void {
    if (!this.taskId()) return;
    this.loadTaskData(this.taskId()!);
  }

  /**
   * Check if task can be marked complete
   */
  canMarkComplete(): boolean {
    return this.canComplete();
  }

  /**
   * Mark task as complete
   */
  markComplete(): void {
    this.completeTask();
  }

  /**
   * Reopen task
   */
  reopenTask(): void {
    const task = this.task();
    if (!task || !this.canReopen()) return;

    if (confirm(`¿Reabrir la tarea "${task.title}"?`)) {
      this.taskService.updateTask(task.id!, { id: task.id!, status: 'pending' }).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.task.set(response.data);
          }
        },
        error: (error) => {
          console.error('Error reopening task:', error);
        }
      });
    }
  }

  /**
   * View recurring series
   */
  viewRecurringSeries(): void {
    const task = this.task();
    if (task?.parent_task_id) {
      this.router.navigate(['/tasks/view', task.parent_task_id]);
    } else if (task?.is_recurring) {
      // Navigate to a filtered list showing all tasks in this series
      this.router.navigate(['/tasks/list'], { 
        queryParams: { parent_task_id: task.id } 
      });
    }
  }

  /**
   * Duplicate task
   */
  duplicateTask(): void {
    const task = this.task();
    if (!task) return;

    if (confirm('¿Quieres crear una copia de esta tarea?')) {
      // Navigate to create form with pre-filled data
      this.router.navigate(['/tasks/create'], { 
        queryParams: { duplicate: task.id } 
      });
    }
  }
}