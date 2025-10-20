import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { TaskService } from '../../services/task.service';
import { 
  Task, 
  TaskFilters, 
  TaskListResponse,
  TASK_PRIORITIES, 
  TASK_CATEGORIES, 
  TASK_STATUSES,
  TaskPriority,
  TaskCategory,
  TaskStatus
} from '../../models/task.models';

// ============================================================================
// TASK LIST COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss']
})
export class TaskListComponent implements OnInit, OnDestroy {
  private taskService = inject(TaskService);
  
  // ============================================================================
  // SIGNALS
  // ============================================================================
  
  public tasks = signal<Task[]>([]);
  public isLoading = this.taskService.isLoading;
  public error = this.taskService.error;
  
  // Pagination
  public currentPage = signal<number>(1);
  public totalPages = signal<number>(1);
  public totalItems = signal<number>(0);
  public itemsPerPage = signal<number>(10);
  public hasNext = signal<boolean>(false);
  public hasPrev = signal<boolean>(false);
  
  // Filters
  public searchQuery = signal<string>('');
  public selectedStatuses = signal<TaskStatus[]>([]);
  public selectedPriorities = signal<TaskPriority[]>([]);
  public selectedCategories = signal<TaskCategory[]>([]);
  public selectedTags = signal<string[]>([]);
  public dueDateFrom = signal<string>('');
  public dueDateTo = signal<string>('');
  public sortBy = signal<'due_date' | 'created_at' | 'priority' | 'title'>('due_date');
  public sortOrder = signal<'asc' | 'desc'>('asc');
  
  // UI State
  public showFilters = signal<boolean>(false);
  public selectedTasks = signal<number[]>([]);
  public viewMode = signal<'list' | 'grid'>('list');
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  public filteredTasksCount = computed(() => this.tasks().length);
  
  public hasActiveFilters = computed(() => {
    return this.searchQuery() !== '' ||
           this.selectedStatuses().length > 0 ||
           this.selectedPriorities().length > 0 ||
           this.selectedCategories().length > 0 ||
           this.selectedTags().length > 0 ||
           this.dueDateFrom() !== '' ||
           this.dueDateTo() !== '';
  });
  
  public paginationInfo = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage() + 1;
    const end = Math.min(this.currentPage() * this.itemsPerPage(), this.totalItems());
    return `${start}-${end} de ${this.totalItems()}`;
  });
  
  public allTasksSelected = computed(() => {
    const visibleTasks = this.tasks();
    return visibleTasks.length > 0 && 
           visibleTasks.every(task => task.id && this.selectedTasks().includes(task.id));
  });
  
  public someTasksSelected = computed(() => {
    const visibleTasks = this.tasks();
    return visibleTasks.some(task => task.id && this.selectedTasks().includes(task.id));
  });

  // ============================================================================
  // CONSTANTS FOR TEMPLATES
  // ============================================================================
  
  public readonly TASK_PRIORITIES = TASK_PRIORITIES;
  public readonly TASK_CATEGORIES = TASK_CATEGORIES;
  public readonly TASK_STATUSES = TASK_STATUSES;
  
  // ============================================================================
  // SUBJECTS AND SUBSCRIPTIONS
  // ============================================================================
  
  private searchSubject = new Subject<string>();
  private subscriptions = new Subscription();

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    this.setupFilterSubscriptions();
    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Configura las suscripciones para los filtros y la búsqueda.
   */
  setupFilterSubscriptions(): void {
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.applyFilters();
      })
    );

    this.subscriptions.add(
      this.taskService.taskCreated$.subscribe(() => this.loadTasks())
    );
    this.subscriptions.add(
      this.taskService.taskUpdated$.subscribe(() => this.loadTasks())
    );
    this.subscriptions.add(
      this.taskService.taskDeleted$.subscribe(() => this.loadTasks())
    );
  }

  /**
   * Carga la lista de tareas aplicando los filtros y paginación actuales.
   */
  public loadTasks(): void {
    this.taskService.setLoading(true);
    this.taskService.clearError();
    this.selectedTasks.set([]); // Limpiar selección al recargar
    
    const filters: TaskFilters = {
      page: this.currentPage(),
      limit: this.itemsPerPage(),
      sort_by: this.sortBy(),
      sort_order: this.sortOrder()
    };

    if (this.searchQuery()) filters.search = this.searchQuery();
    if (this.selectedStatuses().length > 0) filters.status = this.selectedStatuses();
    if (this.selectedPriorities().length > 0) filters.priority = this.selectedPriorities();
    if (this.selectedCategories().length > 0) filters.category = this.selectedCategories();
    if (this.selectedTags().length > 0) filters.tags = this.selectedTags();
    if (this.dueDateFrom()) filters.due_date_from = this.dueDateFrom();
    if (this.dueDateTo()) filters.due_date_to = this.dueDateTo();

    this.taskService.getTasks(filters).subscribe({
      next: (response: TaskListResponse) => {
        if (response.success) {
          this.tasks.set(response.data);
          this.updatePaginationInfo(response.pagination);
        }
      },
      error: (error) => {
        console.error('Error loading tasks:', error);
      }
    });
  }

  private updatePaginationInfo(pagination: any): void {
    if (pagination) {
      this.currentPage.set(pagination.page || pagination.current_page || 1);
      this.totalPages.set(pagination.totalPages || pagination.total_pages || 1);
      this.totalItems.set(pagination.total || pagination.total_items || 0);
      this.itemsPerPage.set(pagination.limit || pagination.items_per_page || 10);
      this.hasNext.set(pagination.hasNext || pagination.has_next || false);
      this.hasPrev.set(pagination.hasPrev || pagination.has_prev || false);
    }
  }

  // ============================================================================
  // SEARCH AND FILTER METHODS
  // ============================================================================

  /**
   * Handle search input change with debouncing
   */
  onSearchChange(event: any): void {
    const value = typeof event === 'string' ? event : event.target?.value || '';
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  /**
   * Apply current filters and reload tasks
   */
  applyFilters(): void {
    this.currentPage.set(1);
    this.loadTasks();
  }

  /**
   * Limpia todos los filtros y recarga las tareas.
   */
  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedStatuses.set([]);
    this.selectedPriorities.set([]);
    this.selectedCategories.set([]);
    this.selectedTags.set([]);
    this.dueDateFrom.set('');
    this.dueDateTo.set('');
    this.sortBy.set('due_date');
    this.sortOrder.set('asc');
    this.currentPage.set(1);
    this.loadTasks();
  }

  /**
   * Toggle status filter
   */
  toggleStatus(status: TaskStatus): void {
    const current = this.selectedStatuses();
    if (current.includes(status)) {
      this.selectedStatuses.set(current.filter(s => s !== status));
    } else {
      this.selectedStatuses.set([...current, status]);
    }
    this.applyFilters();
  }

  /**
   * Toggle priority filter
   */
  togglePriority(priority: TaskPriority): void {
    const current = this.selectedPriorities();
    if (current.includes(priority)) {
      this.selectedPriorities.set(current.filter(p => p !== priority));
    } else {
      this.selectedPriorities.set([...current, priority]);
    }
    this.applyFilters();
  }

  /**
   * Toggle category filter
   */
  toggleCategory(category: TaskCategory): void {
    const current = this.selectedCategories();
    if (current.includes(category)) {
      this.selectedCategories.set(current.filter(c => c !== category));
    } else {
      this.selectedCategories.set([...current, category]);
    }
    this.applyFilters();
  }

  /**
   * Change sort field and direction
   */
  changeSort(field: 'due_date' | 'created_at' | 'priority' | 'title'): void {
    if (this.sortBy() === field) {
      this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortOrder.set('asc');
    }
    this.loadTasks();
  }

  // ============================================================================
  // PAGINATION METHODS
  // ============================================================================

  goToPage(page: number | string): void {
    if (typeof page === 'string') return; // Skip ellipsis
    
    if (page > 0 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadTasks();
    }
  }

  goToFirstPage(): void {
    this.goToPage(1);
  }

  goToLastPage(): void {
    this.goToPage(this.totalPages());
  }

  goToNextPage(): void {
    if (this.hasNext()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  goToPrevPage(): void {
    if (this.hasPrev()) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  onItemsPerPageChange(newItemsPerPage: number): void {
    this.itemsPerPage.set(newItemsPerPage);
    this.currentPage.set(1); // Reset to first page
    this.loadTasks();
  }

  /**
   * Manejar cambio de select de elementos por página
   */
  handleItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.onItemsPerPageChange(+target.value);
    }
  }

  // ============================================================================
  // TASK ACTION METHODS
  // ============================================================================

  /**
   * Toggle select all tasks
   */
  toggleSelectAll(): void {
    const currentSelectAll = this.allTasksSelected();
    if (!currentSelectAll) {
      this.selectedTasks.set(this.tasks().map(task => task.id!));
    } else {
      this.selectedTasks.set([]);
    }
  }

  /**
   * Maneja la selección/deselección de una tarea individual.
   * @param taskId El ID de la tarea.
   */
  toggleTaskSelection(taskId: number): void {
    const currentSelection = this.selectedTasks();
    if (currentSelection.includes(taskId)) {
      this.selectedTasks.set(currentSelection.filter(id => id !== taskId));
    } else {
      this.selectedTasks.set([...currentSelection, taskId]);
    }
  }

  /**
   * Perform bulk action on selected tasks
   */
  performBulkAction(action: 'complete' | 'cancel' | 'delete'): void {
    const selected = this.selectedTasks();
    if (selected.length === 0) {
      alert('Por favor, selecciona al menos una tarea para realizar esta acción.');
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres ${action} ${selected.length} tarea(s) seleccionada(s)?`)) {
      return;
    }

    // Execute actions for each selected task
    selected.forEach(taskId => {
      if (action === 'complete') {
        this.taskService.markTaskComplete(taskId).subscribe();
      } else if (action === 'cancel') {
        this.taskService.cancelTask(taskId).subscribe();
      } else if (action === 'delete') {
        this.taskService.deleteTask(taskId).subscribe();
      }
    });

    // Clear selection and reload
    this.selectedTasks.set([]);
    setTimeout(() => this.loadTasks(), 500);
  }

  /**
   * Mark task as complete
   */
  markAsComplete(task: Task): void {
    if (confirm(`¿Estás seguro de que quieres marcar la tarea "${task.title}" como completada?`)) {
      this.taskService.markTaskComplete(task.id!).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadTasks();
          }
        },
        error: (err) => {
          console.error('Error marking task complete:', err);
        }
      });
    }
  }

  /**
   * Cancel task
   */
  cancelTask(task: Task): void {
    const reason = prompt(`¿Estás seguro de que quieres cancelar la tarea "${task.title}"? Opcionalmente, introduce un motivo:`);
    if (reason !== null) {
      this.taskService.cancelTask(task.id!, reason || undefined).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadTasks();
          }
        },
        error: (err) => {
          console.error('Error cancelling task:', err);
        }
      });
    }
  }

  /**
   * Delete task - fix signature to accept task ID
   */
  deleteTask(taskId: number): void {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer.')) {
      this.taskService.deleteTask(taskId).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadTasks();
          }
        },
        error: (err) => {
          console.error('Error deleting task:', err);
        }
      });
    }
  }

  // ============================================================================
  // UTILITY METHODS FOR TEMPLATE
  // ============================================================================

  isTaskOverdue(task: Task): boolean {
    const dueDate = new Date(task.due_date);
    const now = new Date();
    return dueDate < now && task.status !== 'completed' && task.status !== 'cancelled';
  }

  isTaskSelected(taskId: number): boolean {
    return this.selectedTasks().includes(taskId);
  }

  getSortIcon(field: string): string {
    if (this.sortBy() !== field) return 'chevron-expand';
    return this.sortOrder() === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  /**
   * Track by function for ngFor performance
   */
  trackByTaskId(index: number, task: Task): number {
    return task.id || index;
  }

  /**
   * Get pagination pages for display
   */
  getPaginationPages(): (number | string)[] {
    const current = this.currentPage();
    const total = this.totalPages();
    const pages: (number | string)[] = [];

    if (total <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (current > 4) {
        pages.push('...');
      }

      // Show pages around current
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 3) {
        pages.push('...');
      }

      // Always show last page
      if (total > 1) {
        pages.push(total);
      }
    }

    return pages;
  }

  /**
   * Get status label helper
   */
  getStatusLabel(status: TaskStatus): string {
    const statusObj = TASK_STATUSES.find(s => s.value === status);
    return statusObj?.label || status;
  }

  /**
   * Get priority label helper
   */
  getPriorityLabel(priority: TaskPriority): string {
    const priorityObj = TASK_PRIORITIES.find(p => p.value === priority);
    return priorityObj?.label || priority;
  }

  /**
   * Get category label helper
   */
  getCategoryLabel(category: TaskCategory): string {
    const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
    return categoryObj?.label || category;
  }

  /**
   * Set view mode
   */
  setViewMode(mode: 'list' | 'grid'): void {
    this.viewMode.set(mode);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
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
   * Toggle filters visibility
   */
  toggleFilters(): void {
    this.showFilters.set(!this.showFilters());
  }
}