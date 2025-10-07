import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ContactsService } from '../../services/contacts.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ContactTag, CreateTagRequest, UpdateTagRequest, TAG_COLORS, MessageTemplate } from '../../models/contact.models';

// ============================================================================
// TAG MANAGEMENT COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-tag-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tag-management.component.html',
  styleUrls: ['./tag-management.component.scss']
})
export class TagManagementComponent implements OnInit, OnDestroy {
  // ============================================================================
  // DEPENDENCIES
  // ============================================================================
  private contactsService = inject(ContactsService);
  public loadingService = inject(LoadingService);
  private errorHandler = inject(ErrorHandlerService);
  private fb = inject(FormBuilder);

  // ============================================================================
  // SIGNALS
  // ============================================================================
  tags = signal<ContactTag[]>([]);
  isLoading = signal<boolean>(false);
  isModalOpen = signal<boolean>(false);
  editingTag = signal<ContactTag | null>(null);
  searchQuery = signal<string>('');
  selectedColor = signal<string>(TAG_COLORS[0]);
  messageTemplates = signal<MessageTemplate[]>([]);
  autoMessageVariables = signal<any[]>([]);
  showAutoMessageConfig = signal<boolean>(false);
  viewMode = signal<'grid' | 'table'>('grid');

  // ============================================================================
  // COMPUTED
  // ============================================================================
  filteredTags = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.tags();
    
    return this.tags().filter(tag => 
      tag.name.toLowerCase().includes(query) ||
      (tag.description && tag.description.toLowerCase().includes(query))
    );
  });

  totalContacts = computed(() => {
    return this.tags().reduce((sum, tag) => sum + (tag.contact_count || 0), 0);
  });

  isEditing = computed(() => this.editingTag() !== null);

  modalTitle = computed(() => 
    this.isEditing() ? 'Editar Etiqueta' : 'Nueva Etiqueta'
  );

  // ============================================================================
  // FORM
  // ============================================================================
  tagForm: FormGroup;

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  readonly TAG_COLORS = TAG_COLORS;
  readonly STORAGE_KEY = 'tags-view-mode';

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  constructor() {
    this.tagForm = this.fb.group({
      name: ['', [
        Validators.required, 
        Validators.minLength(2), 
        Validators.maxLength(100),
        this.uniqueNameValidator.bind(this)
      ]],
      color: [TAG_COLORS[0], [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
      description: ['', [Validators.maxLength(500)]],
      // Campos de auto-message
      has_auto_message: [false],
      auto_message_template_id: [null],
      auto_message_delay_hours: [24, [Validators.min(0.1), Validators.max(168)]], // 6 minutos a 7 días
      auto_message_content: ['', [Validators.maxLength(1000)]],
      is_active_auto: [true]
    });
  }

  ngOnInit(): void {
    this.loadViewModeFromStorage();
    this.loadTags();
    this.loadMessageTemplates();
    this.loadAutoMessageVariables();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Cargar lista de etiquetas
   */
  loadTags(): void {
    this.isLoading.set(true);
    
    const subscription = this.contactsService.getTags({
      sortBy: 'name',
      sortOrder: 'ASC'
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.tags.set(response.data);
        } else {
          this.errorHandler.handleError('Error al cargar etiquetas');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al cargar etiquetas', error);
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar lista de templates de mensajes
   */
  loadMessageTemplates(): void {
    const subscription = this.contactsService.getMessageTemplates().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.messageTemplates.set(response.data);
        }
      },
      error: (error) => {
        console.warn('Error al cargar templates:', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar variables disponibles para auto-messages
   */
  loadAutoMessageVariables(): void {
    const subscription = this.contactsService.getAutoMessageVariables().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.autoMessageVariables.set(response.data);
        }
      },
      error: (error) => {
        console.warn('Error al cargar variables de auto-message:', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Refrescar lista de etiquetas
   */
  refreshTags(): void {
    this.loadTags();
  }

  // ============================================================================
  // MODAL MANAGEMENT
  // ============================================================================

  /**
   * Abrir modal para crear nueva etiqueta
   */
  openCreateModal(): void {
    this.editingTag.set(null);
    this.selectedColor.set(TAG_COLORS[0]);
    this.showAutoMessageConfig.set(false);
    this.tagForm.reset({
      name: '',
      color: TAG_COLORS[0],
      description: '',
      has_auto_message: false,
      auto_message_template_id: null,
      auto_message_delay_hours: 24,
      auto_message_content: '',
      is_active_auto: true
    });
    this.isModalOpen.set(true);
  }

  /**
   * Abrir modal para editar etiqueta
   */
  openEditModal(tag: ContactTag): void {
    this.editingTag.set(tag);
    this.selectedColor.set(tag.color);
    this.showAutoMessageConfig.set(tag.has_auto_message || false);
    this.tagForm.patchValue({
      name: tag.name,
      color: tag.color,
      description: tag.description || '',
      has_auto_message: tag.has_auto_message || false,
      auto_message_template_id: tag.auto_message_template_id || null,
      auto_message_delay_hours: tag.auto_message_delay_hours || 24,
      auto_message_content: tag.auto_message_content || '',
      is_active_auto: tag.is_active_auto !== false
    });
    this.isModalOpen.set(true);
  }

  /**
   * Cerrar modal
   */
  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingTag.set(null);
    this.showAutoMessageConfig.set(false);
    this.tagForm.reset();
  }

  // ============================================================================
  // COLOR SELECTION
  // ============================================================================

  /**
   * Seleccionar color
   */
  selectColor(color: string): void {
    this.selectedColor.set(color);
    this.tagForm.patchValue({ color });
  }

  /**
   * Manejar cambio de color personalizado
   */
  onCustomColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const color = input.value;
    this.selectedColor.set(color);
    this.tagForm.patchValue({ color });
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Guardar etiqueta (crear o actualizar)
   */
  saveTag(): void {
    if (this.tagForm.invalid) {
      this.tagForm.markAllAsTouched();
      return;
    }

    const formValue = this.tagForm.value;
    const tagData = {
      name: formValue.name.trim(),
      color: formValue.color,
      description: formValue.description?.trim() || undefined,
      // Campos de auto-message
      has_auto_message: formValue.has_auto_message || false,
      auto_message_template_id: formValue.auto_message_template_id || null,
      auto_message_delay_hours: formValue.auto_message_delay_hours || 24,
      auto_message_content: formValue.auto_message_content?.trim() || null,
      is_active_auto: formValue.is_active_auto !== false
    };

    if (this.isEditing()) {
      this.updateTag(this.editingTag()!.id, tagData);
    } else {
      this.createTag(tagData);
    }
  }

  /**
   * Crear nueva etiqueta
   */
  private createTag(tagData: CreateTagRequest): void {
    const loadingId = this.loadingService.startLoading('create-tag', 'Creando etiqueta...');

    const subscription = this.contactsService.createTag(tagData).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.tags.update(tags => [...tags, response.data!]);
          this.closeModal();
          console.log(`✅ Etiqueta "${response.data!.name}" creada exitosamente`);
        } else {
          this.errorHandler.handleError('Error al crear etiqueta: ' + (response.message || 'Error desconocido'));
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al crear etiqueta', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Actualizar etiqueta existente
   */
  private updateTag(tagId: number, tagData: UpdateTagRequest): void {
    const loadingId = this.loadingService.startLoading('update-tag', 'Actualizando etiqueta...');

    const subscription = this.contactsService.updateTag(tagId, tagData).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.tags.update(tags => 
            tags.map(tag => tag.id === tagId ? response.data! : tag)
          );
          this.closeModal();
          console.log(`✅ Etiqueta "${response.data!.name}" actualizada exitosamente`);
        } else {
          this.errorHandler.handleError('Error al actualizar etiqueta: ' + (response.message || 'Error desconocido'));
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al actualizar etiqueta', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Eliminar etiqueta
   */
  deleteTag(tag: ContactTag): void {
    // Verificar si la etiqueta tiene contactos asociados
    if ((tag.contact_count || 0) > 0) {
      this.errorHandler.handleError(
        `No se puede eliminar la etiqueta "${tag.name}" porque tiene ${tag.contact_count} contactos asociados. Primero remueve la etiqueta de todos los contactos.`
      );
      return;
    }

    // Confirmación más elegante
    const confirmMessage = `¿Estás seguro de que quieres eliminar la etiqueta "${tag.name}"?\n\nEsta acción no se puede deshacer.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    const loadingId = this.loadingService.startLoading('delete-tag', 'Eliminando etiqueta...');

    const subscription = this.contactsService.deleteTag(tag.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.tags.update(tags => tags.filter(t => t.id !== tag.id));
          console.log(`✅ Etiqueta "${tag.name}" eliminada exitosamente`);
        } else {
          this.errorHandler.handleError('Error al eliminar etiqueta: ' + (response.message || 'Error desconocido'));
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al eliminar etiqueta', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  // ============================================================================
  // SEARCH
  // ============================================================================

  /**
   * Manejar búsqueda
   */
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  /**
   * Limpiar búsqueda
   */
  clearSearch(): void {
    this.searchQuery.set('');
  }

  // ============================================================================
  // FORM VALIDATION HELPERS
  // ============================================================================

  /**
   * Validador personalizado para nombres únicos
   */
  private uniqueNameValidator(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value) return null;
    
    const name = control.value.trim().toLowerCase();
    const editingTagId = this.editingTag()?.id;
    
    const isDuplicate = this.tags().some(tag => 
      tag.name.toLowerCase() === name && tag.id !== editingTagId
    );
    
    return isDuplicate ? { uniqueName: { value: control.value } } : null;
  }

  /**
   * Verificar si un campo tiene error
   */
  hasError(fieldName: string): boolean {
    const field = this.tagForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getErrorMessage(fieldName: string): string {
    const field = this.tagForm.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;
    
    if (errors['required']) return `${fieldName} es requerido`;
    if (errors['minlength']) return `${fieldName} debe tener al menos ${errors['minlength'].requiredLength} caracteres`;
    if (errors['maxlength']) return `${fieldName} no puede tener más de ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['pattern']) return `${fieldName} debe ser un color válido`;
    if (errors['uniqueName']) return `Ya existe una etiqueta con este nombre`;

    return 'Campo inválido';
  }

  // ============================================================================
  // TRACKBY FUNCTIONS
  // ============================================================================

  /**
   * TrackBy function para lista de etiquetas
   */
  trackByTagId(index: number, tag: ContactTag): number {
    return tag.id;
  }

  /**
   * TrackBy function para colores
   */
  trackByColor(index: number, color: string): string {
    return color;
  }

  // ============================================================================
  // AUTO-MESSAGE MANAGEMENT
  // ============================================================================

  /**
   * Toggle configuración de auto-message
   */
  toggleAutoMessageConfig(): void {
    const currentValue = this.tagForm.get('has_auto_message')?.value;
    this.showAutoMessageConfig.set(!currentValue ? false : true);
    
    if (!currentValue) {
      // Si se desactiva, limpiar campos
      this.tagForm.patchValue({
        auto_message_template_id: null,
        auto_message_content: '',
        auto_message_delay_hours: 24
      });
    }
  }

  /**
   * Cambiar template seleccionado
   */
  onTemplateChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const templateId = target.value ? +target.value : null;
    
    if (templateId) {
      const template = this.messageTemplates().find(t => t.id === templateId);
      if (template) {
        this.tagForm.patchValue({
          auto_message_content: template.content
        });
      }
    }
  }

  /**
   * Validar configuración de auto-message
   */
  validateAutoMessageConfig(): boolean {
    if (!this.tagForm.get('has_auto_message')?.value) {
      return true; // No hay validación si está desactivado
    }

    const templateId = this.tagForm.get('auto_message_template_id')?.value;
    const content = this.tagForm.get('auto_message_content')?.value;
    const delay = this.tagForm.get('auto_message_delay_hours')?.value;

    // Debe tener template O contenido personalizado
    const hasMessage = templateId || (content && content.trim());
    const validDelay = delay && delay >= 1 && delay <= 168;

    return !!(hasMessage && validDelay);
  }

  /**
   * Obtener template seleccionado
   */
  getSelectedTemplate(): MessageTemplate | null {
    const templateId = this.tagForm.get('auto_message_template_id')?.value;
    if (!templateId) return null;
    return this.messageTemplates().find(t => t.id === templateId) || null;
  }

  /**
   * TrackBy function para templates
   */
  trackByTemplateId(index: number, template: MessageTemplate): number {
    return template.id;
  }

  /**
   * Insertar variable en el contenido del mensaje
   */
  insertVariable(variableName: string): void {
    const currentContent = this.tagForm.get('auto_message_content')?.value || '';
    const newContent = currentContent + `{${variableName}}`;
    this.tagForm.patchValue({
      auto_message_content: newContent
    });
  }

  /**
   * Obtener tiempo legible desde horas
   */
  getReadableTime(hours: number): string {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minutos`;
    } else if (hours < 24) {
      return `${hours} horas`;
    } else {
      const days = Math.round(hours / 24);
      return `${days} días`;
    }
  }

  /**
   * TrackBy function para variables
   */
  trackByVariableName(index: number, variable: any): string {
    return variable.name;
  }

  // ============================================================================
  // VIEW MODE METHODS
  // ============================================================================

  /**
   * Cargar modo de vista desde localStorage
   */
  loadViewModeFromStorage(): void {
    const savedViewMode = localStorage.getItem(this.STORAGE_KEY);
    if (savedViewMode === 'grid' || savedViewMode === 'table') {
      this.viewMode.set(savedViewMode);
    }
  }

  /**
   * Cambiar modo de vista
   */
  toggleViewMode(): void {
    const newMode = this.viewMode() === 'grid' ? 'table' : 'grid';
    this.setViewMode(newMode);
  }

  /**
   * Establecer modo de vista específico
   */
  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode.set(mode);
    localStorage.setItem(this.STORAGE_KEY, mode);
  }
}
