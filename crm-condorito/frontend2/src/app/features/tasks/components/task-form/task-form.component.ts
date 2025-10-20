import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { TaskService } from '../../services/task.service';
import { ContactsService } from '../../../contacts/services/contacts.service';
import { 
  Task, 
  CreateTaskRequest, 
  UpdateTaskRequest,
  TASK_PRIORITIES, 
  TASK_CATEGORIES, 
  TASK_STATUSES,
  REMINDER_TYPES,
  TaskPriority,
  TaskCategory,
  TaskStatus,
  ReminderType,
  RecurrencePattern
} from '../../models/task.models';
import { Contact } from '../../../contacts/models/contact.models';

// ============================================================================
// TASK FORM COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.scss']
})
export class TaskFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private taskService = inject(TaskService);
  private contactsService = inject(ContactsService);
  
  // ============================================================================
  // SIGNALS
  // ============================================================================
  
  public isLoading = this.taskService.isLoading;
  public error = this.taskService.error;
  public isEditMode = signal<boolean>(false);
  public taskId = signal<number | null>(null);
  public currentTask = signal<Task | null>(null);
  public isSubmitting = signal<boolean>(false);
  public showRecurrence = signal<boolean>(false);
  public showReminder = signal<boolean>(false);
  public availableContacts = signal<Contact[]>([]);
  public filteredContacts = signal<Contact[]>([]);
  public contactSearchTerm = signal<string>('');
  public showContactDropdown = signal<boolean>(false);
  public selectedContact = signal<Contact | null>(null);
  public availableTags = signal<string[]>([]);
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  public pageTitle = computed(() => 
    this.isEditMode() ? 'Editar Tarea' : 'Nueva Tarea'
  );
  
  public submitButtonText = computed(() => 
    this.isSubmitting() 
      ? (this.isEditMode() ? 'Actualizando...' : 'Creando...') 
      : (this.isEditMode() ? 'Actualizar Tarea' : 'Crear Tarea')
  );

  // ============================================================================
  // CONSTANTS FOR TEMPLATES
  // ============================================================================
  
  public readonly TASK_PRIORITIES = TASK_PRIORITIES;
  public readonly TASK_CATEGORIES = TASK_CATEGORIES;
  public readonly TASK_STATUSES = TASK_STATUSES;
  public readonly REMINDER_TYPES = REMINDER_TYPES;
  
  // ============================================================================
  // FORM
  // ============================================================================
  
  public taskForm: FormGroup;
  
  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor() {
    this.taskForm = this.createForm();
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    this.setupRouteSubscription();
    this.setupFormSubscriptions();
    this.loadFormData();
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
        this.isEditMode.set(true);
        this.taskId.set(+id);
        this.loadTask(); // Call the public method without parameters
      } else {
        this.isEditMode.set(false);
        this.taskId.set(null);
        this.setDefaultValues();
      }
    });
    
    this.subscriptions.push(routeSub);
  }

  private setupFormSubscriptions(): void {
    // Watch for recurring checkbox changes
    const recurringChanges = this.taskForm.get('is_recurring')?.valueChanges.subscribe(value => {
      this.showRecurrence.set(value);
      if (!value) {
        this.taskForm.patchValue({
          recurrence_type: '',
          recurrence_interval: 1,
          recurrence_end_date: '',
          recurrence_max_occurrences: null
        });
      }
    });

    // Watch for reminder checkbox changes
    const reminderChanges = this.taskForm.get('create_reminder')?.valueChanges.subscribe(value => {
      this.showReminder.set(value);
      if (!value) {
        this.taskForm.patchValue({
          reminder_datetime: '',
          auto_reminder_minutes_before: null,
          reminder_type: 'whatsapp',
          reminder_phone: '', // Resetear también el teléfono
          reminder_message: ''
        });
      }
    });

    // Watch for contact search changes
    const contactSearchChanges = this.taskForm.get('contact_search')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(searchTerm => {
        this.contactSearchTerm.set(searchTerm || '');
        this.filterContacts(searchTerm || '');
        this.showContactDropdown.set(!!searchTerm && searchTerm.length > 0);
      });

    if (recurringChanges) this.subscriptions.push(recurringChanges);
    if (reminderChanges) this.subscriptions.push(reminderChanges);
    if (contactSearchChanges) this.subscriptions.push(contactSearchChanges);
  }

  private loadFormData(): void {
    // Load contacts for dropdown
    this.loadContacts();
    
    // Load available tags (if needed in the future)
    // this.loadTags();
  }

  // ============================================================================
  // FORM CREATION
  // ============================================================================

  private createForm(): FormGroup {
    return this.fb.group({
      // Basic task info
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      priority: ['medium' as TaskPriority, Validators.required],
      category: ['task' as TaskCategory, Validators.required],
      status: ['pending' as TaskStatus],
      due_date: ['', Validators.required],
      estimated_duration: [null, [Validators.min(1), Validators.max(1440)]], // max 24 hours
      
      // Contact relation
      related_contact_id: [null],
      contact_search: [''], // Campo de búsqueda de contactos
      related_phone: [''],
      
      // Tags
      tags: [[]],
      new_tag: [''], // For adding new tags
      
      // Recurrence
      is_recurring: [false],
      recurrence_type: [''],
      recurrence_interval: [1, [Validators.min(1), Validators.max(365)]],
      recurrence_end_date: [''],
      recurrence_max_occurrences: [null, [Validators.min(1), Validators.max(1000)]],
      
      // Reminder
      create_reminder: [false],
      reminder_datetime: [''],
      auto_reminder_minutes_before: [null, [Validators.min(1), Validators.max(10080)]], // max 1 week
      reminder_type: ['whatsapp' as ReminderType],
      reminder_phone: [''], // Nuevo campo para teléfono de recordatorio
      reminder_message: ['']
    });
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  private populateForm(task: Task): void {
    // Format dates for form inputs
    const dueDate = task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '';
    const reminderDate = task.reminder_datetime ? new Date(task.reminder_datetime).toISOString().slice(0, 16) : '';
    
    this.taskForm.patchValue({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      category: task.category,
      status: task.status,
      due_date: dueDate,
      estimated_duration: task.estimated_duration,
      related_contact_id: task.related_contact_id,
      related_phone: task.related_phone || '',
      tags: task.tags || [],
      is_recurring: task.is_recurring || false,
      create_reminder: !!task.reminder_datetime,
      reminder_datetime: reminderDate,
      reminder_type: 'whatsapp' // Default, as we don't store this in task
    });

    // Handle recurrence pattern
    if (task.recurrence_pattern) {
      this.taskForm.patchValue({
        recurrence_type: task.recurrence_pattern.type,
        recurrence_interval: task.recurrence_pattern.interval,
        recurrence_end_date: task.recurrence_pattern.end_date || '',
        recurrence_max_occurrences: task.recurrence_pattern.max_occurrences
      });
    }

    // Update UI state
    this.showRecurrence.set(task.is_recurring || false);
    this.showReminder.set(!!task.reminder_datetime);
  }

  private setDefaultValues(): void {
    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM
    
    this.taskForm.patchValue({
      due_date: tomorrow.toISOString().slice(0, 16),
      priority: 'medium',
      category: 'task',
      status: 'pending',
      reminder_type: 'whatsapp'
    });
  }

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  onSubmit(): void {
    if (this.taskForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      
      const formData = this.prepareFormData();
      
      if (this.isEditMode()) {
        this.updateTask(formData as UpdateTaskRequest);
      } else {
        this.createTask(formData as CreateTaskRequest);
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private prepareFormData(): CreateTaskRequest | UpdateTaskRequest {
    const formValue = this.taskForm.value;
    
    // Prepare base data
    const data: any = {
      title: formValue.title,
      description: formValue.description || undefined,
      priority: formValue.priority,
      category: formValue.category,
      due_date: new Date(formValue.due_date).toISOString(),
      estimated_duration: formValue.estimated_duration || undefined,
      related_contact_id: formValue.related_contact_id || undefined,
      related_phone: formValue.related_phone || undefined,
      tags: formValue.tags && formValue.tags.length > 0 ? formValue.tags : undefined
    };

    // Add status for updates
    if (this.isEditMode()) {
      data.id = this.taskId()!;
      data.status = formValue.status;
    }

    // Handle recurrence
    if (formValue.is_recurring && formValue.recurrence_type) {
      data.is_recurring = true;
      data.recurrence_pattern = {
        type: formValue.recurrence_type,
        interval: formValue.recurrence_interval,
        end_date: formValue.recurrence_end_date || undefined,
        max_occurrences: formValue.recurrence_max_occurrences || undefined
      } as RecurrencePattern;
    }

    // Handle reminder
    if (formValue.create_reminder) {
      if (formValue.reminder_datetime) {
        data.reminder_datetime = new Date(formValue.reminder_datetime).toISOString();
      } else if (formValue.auto_reminder_minutes_before) {
        data.auto_reminder_minutes_before = formValue.auto_reminder_minutes_before;
      }
      
      data.create_reminder = true;
      data.reminder_type = formValue.reminder_type;
      data.reminder_message = formValue.reminder_message || undefined;
    }

    return data;
  }

  private createTask(data: CreateTaskRequest): void {
    this.taskService.createTask(data).subscribe({
      next: (response) => {
        if (response.success) {
          this.router.navigate(['/tasks/list'], {
            queryParams: { created: 'true' }
          });
        }
      },
      error: (error) => {
        console.error('Error creating task:', error);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  private updateTask(data: UpdateTaskRequest): void {
    const taskId = this.taskId()!;
    
    this.taskService.updateTask(taskId, data).subscribe({
      next: (response) => {
        if (response.success) {
          this.router.navigate(['/tasks/view', taskId], {
            queryParams: { updated: 'true' }
          });
        }
      },
      error: (error) => {
        console.error('Error updating task:', error);
      },
      complete: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  // ============================================================================
  // FORM HELPERS
  // ============================================================================

  private markFormGroupTouched(): void {
    Object.keys(this.taskForm.controls).forEach(key => {
      const control = this.taskForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.taskForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.taskForm.get(fieldName);
    if (field && field.errors && (field.dirty || field.touched)) {
      if (field.errors['required']) return `${fieldName} es requerido`;
      if (field.errors['maxlength']) return `${fieldName} es demasiado largo`;
      if (field.errors['min']) return `Valor mínimo: ${field.errors['min'].min}`;
      if (field.errors['max']) return `Valor máximo: ${field.errors['max'].max}`;
    }
    return '';
  }

  // ============================================================================
  // TAG MANAGEMENT
  // ============================================================================

  addTag(): void {
    const newTagControl = this.taskForm.get('new_tag');
    const tagsControl = this.taskForm.get('tags');
    
    if (newTagControl?.value && tagsControl) {
      const newTag = newTagControl.value.trim();
      const currentTags = tagsControl.value || [];
      
      if (newTag && !currentTags.includes(newTag)) {
        tagsControl.setValue([...currentTags, newTag]);
        newTagControl.setValue('');
      }
    }
  }

  removeTag(tag: string): void {
    const tagsControl = this.taskForm.get('tags');
    if (tagsControl) {
      const currentTags = tagsControl.value || [];
      tagsControl.setValue(currentTags.filter((t: string) => t !== tag));
    }
  }

  onTagKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTag();
    }
  }

  // ============================================================================
  // DATE HELPERS
  // ============================================================================

  setDueDateToday(): void {
    const today = new Date();
    today.setHours(23, 59, 0, 0); // End of today
    this.taskForm.patchValue({
      due_date: today.toISOString().slice(0, 16)
    });
  }

  setDueDateTomorrow(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    this.taskForm.patchValue({
      due_date: tomorrow.toISOString().slice(0, 16)
    });
  }

  setDueDateNextWeek(): void {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(9, 0, 0, 0); // 9 AM next week
    this.taskForm.patchValue({
      due_date: nextWeek.toISOString().slice(0, 16)
    });
  }

  // ============================================================================
  // REMINDER HELPERS
  // ============================================================================

  setReminderBefore(minutes: number): void {
    const dueDate = this.taskForm.get('due_date')?.value;
    if (dueDate) {
      const reminderDate = new Date(dueDate);
      reminderDate.setMinutes(reminderDate.getMinutes() - minutes);
      
      this.taskForm.patchValue({
        reminder_datetime: reminderDate.toISOString().slice(0, 16),
        auto_reminder_minutes_before: null // Clear auto reminder
      });
    }
  }

  setAutoReminder(minutes: number): void {
    this.taskForm.patchValue({
      auto_reminder_minutes_before: minutes,
      reminder_datetime: '' // Clear specific datetime
    });
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  cancel(): void {
    if (this.isEditMode()) {
      this.router.navigate(['/tasks/view', this.taskId()]);
    } else {
      this.router.navigate(['/tasks/list']);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getPriorityColor(priority: string): string {
    const priorityObj = TASK_PRIORITIES.find(p => p.value === priority);
    return priorityObj?.color || 'secondary';
  }

  getCategoryIcon(category: string): string {
    const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
    return categoryObj?.icon || 'circle';
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

  // ============================================================================
  // TEMPLATE METHODS
  // ============================================================================

  /**
   * Handle create reminder checkbox change
   */
  onCreateReminderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.showReminder.set(target.checked);
    
    if (target.checked) {
      // Set default reminder values
      this.taskForm.patchValue({
        auto_reminder_minutes_before: 30,
        reminder_type: 'whatsapp',
        reminder_message: 'Recordatorio: tienes pendiente la tarea "' + (this.taskForm.get('title')?.value || '') + '"'
      });
    } else {
      // Clear reminder values
      this.taskForm.patchValue({
        auto_reminder_minutes_before: null,
        reminder_type: '',
        reminder_message: ''
      });
    }
  }

  /**
   * Handle recurrence checkbox change
   */
  onRecurrenceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.showRecurrence.set(target.checked);
    
    if (target.checked) {
      // Set default recurrence values
      this.taskForm.patchValue({
        recurrence_type: 'weekly',
        recurrence_interval: 1
      });
    } else {
      // Clear recurrence values
      this.taskForm.patchValue({
        recurrence_type: '',
        recurrence_interval: 1,
        recurrence_end_date: '',
        recurrence_max_occurrences: null
      });
    }
  }

  /**
   * Get recurrence interval label based on type
   */
  getRecurrenceIntervalLabel(): string {
    const type = this.taskForm.get('recurrence_type')?.value;
    switch (type) {
      case 'daily': return 'días';
      case 'weekly': return 'semanas';
      case 'monthly': return 'meses';
      case 'yearly': return 'años';
      default: return 'períodos';
    }
  }

  /**
   * Delete task (only in edit mode)
   */
  deleteTask(): void {
    if (!this.isEditMode() || !this.taskId()) return;
    
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer.')) {
      this.taskService.deleteTask(this.taskId()!).subscribe({
        next: (response) => {
          if (response.success) {
            this.router.navigate(['/tasks/list']);
          } else {
            console.error('Error al eliminar la tarea:', response.message);
          }
        },
        error: (error) => {
          console.error('Error deleting task:', error);
        }
      });
    }
  }

  // ============================================================================
  // CONTACT MANAGEMENT METHODS
  // ============================================================================

  /**
   * Load contacts from the API
   */
  private loadContacts(): void {
    const subscription = this.contactsService.getContacts({ limit: 500 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.availableContacts.set(response.data);
          this.filteredContacts.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error loading contacts:', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Filter contacts based on search term
   */
  private filterContacts(searchTerm: string): void {
    const allContacts = this.availableContacts();
    if (!searchTerm.trim()) {
      this.filteredContacts.set(allContacts);
      return;
    }

    const filtered = allContacts.filter(contact => {
      const searchLower = searchTerm.toLowerCase();
      return (
        contact.name?.toLowerCase().includes(searchLower) ||
        contact.custom_name?.toLowerCase().includes(searchLower) ||
        contact.phone_number?.includes(searchTerm)
      );
    });

    this.filteredContacts.set(filtered);
  }

  /**
   * Select a contact from the dropdown
   */
  public selectContact(contact: Contact): void {
    this.selectedContact.set(contact);
    this.taskForm.patchValue({
      related_contact_id: contact.id,
      contact_search: contact.custom_name || contact.name || contact.phone_number,
      related_phone: contact.phone_number || ''
    });
    this.showContactDropdown.set(false);
    
    // Add success visual feedback
    this.addContactSearchState('success');
  }

  /**
   * Clear selected contact
   */
  public clearContact(): void {
    this.selectedContact.set(null);
    this.taskForm.patchValue({
      related_contact_id: null,
      contact_search: '',
      related_phone: ''
    });
    this.showContactDropdown.set(false);
    this.removeContactSearchState();
  }

  /**
   * Handle contact search input focus
   */
  public onContactSearchFocus(): void {
    const searchTerm = this.taskForm.get('contact_search')?.value || '';
    if (searchTerm.length > 0) {
      this.showContactDropdown.set(true);
    }
  }

  /**
   * Handle contact search input blur (with delay to allow click on dropdown)
   */
  public onContactSearchBlur(): void {
    setTimeout(() => {
      this.showContactDropdown.set(false);
    }, 200);
  }

  /**
   * Get display name for a contact
   */
  public getContactDisplayName(contact: Contact): string {
    return contact.custom_name || contact.name || contact.phone_number || 'Sin nombre';
  }

  /**
   * Add CSS class to contact search container for visual feedback
   */
  private addContactSearchState(state: 'success' | 'error' | 'loading'): void {
    const container = document.querySelector('.contact-search-container');
    if (container) {
      container.classList.remove('success', 'error', 'loading');
      container.classList.add(state);
      
      // Remove state after animation
      if (state === 'success') {
        setTimeout(() => {
          container.classList.remove(state);
        }, 2000);
      }
    }
  }

  /**
   * Remove all state classes from contact search container
   */
  private removeContactSearchState(): void {
    const container = document.querySelector('.contact-search-container');
    if (container) {
      container.classList.remove('success', 'error', 'loading');
    }
  }

  /**
   * Load task for editing - public method for template
   */
  public loadTask(): void {
    if (!this.taskId()) return;
    
    this.taskService.getTaskById(this.taskId()!).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentTask.set(response.data);
          this.populateForm(response.data);
        } else {
          console.error('Tarea no encontrada:', response.message);
        }
      },
      error: (error) => {
        console.error('Error loading task:', error);
      }
    });
  }
}
