import { Component, OnInit, OnDestroy, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { LoadingService } from '../../../../core/services/loading.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ScheduledMessagesService } from '../../services/scheduled-messages.service';
import { ContactsService } from '../../../contacts/services/contacts.service';
import { TemplatesService } from '../../../templates/services/templates.service';

import {
  ScheduledMessage,
  CreateScheduledMessageRequest,
  UpdateScheduledMessageRequest,
  TIMEZONE_OPTIONS,
  RECURRENCE_OPTIONS
} from '../../models/scheduled-message.models';
import { Contact, ContactTag } from '../../../contacts/models/contact.models';
import { MessageTemplate } from '../../../../core/models/template.models';

// ============================================================================
// SCHEDULED MESSAGE FORM COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-scheduled-message-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './scheduled-message-form.component.html',
  styleUrls: ['./scheduled-message-form.component.scss']
})
export class ScheduledMessageFormComponent implements OnInit, OnDestroy {
  // ============================================================================
  // DEPENDENCIES
  // ============================================================================
  private scheduledMessagesService = inject(ScheduledMessagesService);
  private contactsService = inject(ContactsService);
  private templatesService = inject(TemplatesService);
  public loadingService = inject(LoadingService);
  public errorHandler = inject(ErrorHandlerService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // ============================================================================
  // SIGNALS
  // ============================================================================
  isEditMode = signal<boolean>(false);
  currentMessage = signal<ScheduledMessage | null>(null);
  contacts = signal<Contact[]>([]);
  allTags = signal<ContactTag[]>([]);
  filteredTags = signal<ContactTag[]>([]);
  templates = signal<MessageTemplate[]>([]);
  selectedTemplate = signal<MessageTemplate | null>(null);
  templatePreview = signal<string>('');
  tagSearchTerm = signal<string>('');

  // ============================================================================
  // COMPUTED
  // ============================================================================
  pageTitle = computed(() => this.isEditMode() ? 'Editar Mensaje Programado' : 'Programar Nuevo Mensaje');
  submitButtonText = computed(() => this.isEditMode() ? 'Actualizar Mensaje' : 'Programar Mensaje');

  // ============================================================================
  // FORM
  // ============================================================================
  messageForm: FormGroup;

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  readonly TIMEZONE_OPTIONS = TIMEZONE_OPTIONS;
  readonly RECURRENCE_OPTIONS = RECURRENCE_OPTIONS;

  readonly SEND_TYPE_OPTIONS = [
    { value: 'individual', label: 'Contacto Individual', description: 'Enviar a un contacto específico' },
    { value: 'bulk_tags', label: 'Por Etiquetas', description: 'Enviar a contactos con etiquetas específicas' },
    { value: 'bulk_all', label: 'Todos los Contactos', description: 'Enviar a todos los contactos activos' }
  ];

  readonly MESSAGE_TYPE_OPTIONS = [
    { value: 'text', label: 'Texto Personalizado', description: 'Escribir mensaje manualmente' },
    { value: 'template', label: 'Usar Template', description: 'Seleccionar template existente' }
  ];

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  constructor() {
    this.messageForm = this.fb.group({
      // Información básica
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      
      // Tipo de envío
      send_type: ['individual', Validators.required],
      
      // Destinatarios
      recipient_contact_id: [null],
      recipient_phone: [''],
      selected_tags: [[]],
      
      // Contenido
      message_type: ['text', Validators.required],
      message_content: [''],
      template_id: [null],
      template_variables: [{}],
      
      // Programación
      scheduled_date: ['', Validators.required],
      scheduled_time: ['', Validators.required],
      timezone: ['America/Argentina/Buenos_Aires'],
      
      // Recurrencia
      is_recurring: [false],
      recurrence_type: [null],
      recurrence_interval: [null],
      recurrence_end_date: [''],
      recurrence_end_time: [''],
      max_executions: [null]
    });
  }

  ngOnInit(): void {
    this.checkEditMode();
    this.loadInitialData();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Verificar si estamos en modo edición
   */
  checkEditMode(): void {
    const messageId = this.route.snapshot.params['id'];
    if (messageId) {
      this.isEditMode.set(true);
      this.loadMessageForEdit(parseInt(messageId));
    }
  }

  /**
   * Cargar datos iniciales
   */
  loadInitialData(): void {
    this.loadContacts();
    this.loadTags();
    this.loadTemplates();
  }

  /**
   * Configurar suscripciones del formulario
   */
  setupFormSubscriptions(): void {
    // Suscripción a cambios en send_type
    const sendTypeSubscription = this.messageForm.get('send_type')?.valueChanges.subscribe(sendType => {
      this.onSendTypeChange(sendType);
    });

    // Suscripción a cambios en message_type
    const messageTypeSubscription = this.messageForm.get('message_type')?.valueChanges.subscribe(messageType => {
      this.onMessageTypeChange(messageType);
    });

    // Suscripción a cambios en template_id
    const templateSubscription = this.messageForm.get('template_id')?.valueChanges.subscribe(templateId => {
      this.onTemplateChange(templateId);
    });

    // Suscripción a cambios en is_recurring
    const recurringSubscription = this.messageForm.get('is_recurring')?.valueChanges.subscribe(isRecurring => {
      this.onRecurringChange(isRecurring);
    });

    if (sendTypeSubscription) this.subscriptions.push(sendTypeSubscription);
    if (messageTypeSubscription) this.subscriptions.push(messageTypeSubscription);
    if (templateSubscription) this.subscriptions.push(templateSubscription);
    if (recurringSubscription) this.subscriptions.push(recurringSubscription);
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Cargar contactos
   */
  loadContacts(): void {
    const subscription = this.contactsService.getContacts({ limit: 100 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.contacts.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error cargando contactos:', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar etiquetas
   */
  loadTags(): void {
    const subscription = this.contactsService.getTags().subscribe({
      next: (response) => {
        if (response.success) {
          this.allTags.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error cargando etiquetas:', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar templates
   */
  loadTemplates(): void {
    const subscription = this.templatesService.getTemplates({ is_active: true }).subscribe({
      next: (response) => {
        if (response.success) {
          this.templates.set(response.templates || []);
        }
      },
      error: (error) => {
        console.error('Error cargando templates:', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar mensaje para edición
   */
  loadMessageForEdit(messageId: number): void {
    const subscription = this.scheduledMessagesService.getScheduledMessage(messageId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentMessage.set(response.data);
          this.populateFormWithMessage(response.data);
        } else {
          this.errorHandler.handleError('Mensaje programado no encontrado');
          this.router.navigate(['/scheduled-messages']);
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error cargando mensaje programado', error);
        this.router.navigate(['/scheduled-messages']);
      }
    });

    this.subscriptions.push(subscription);
  }

  // ============================================================================
  // VALIDATORS
  // ============================================================================

  /**
   * Validador personalizado para selección de etiquetas
   */
  validateTagsSelection = (control: any) => {
    const value = control.value;
    if (!value || !Array.isArray(value) || value.length === 0) {
      return { required: true };
    }
    return null;
  };

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  /**
   * Manejar cambio de tipo de envío
   */
  onSendTypeChange(sendType: string): void {
    // Reset relevant fields
    this.messageForm.patchValue({
      recipient_contact_id: null,
      recipient_phone: '',
      selected_tags: []
    });

    // Update validators based on send type
    const recipientContactControl = this.messageForm.get('recipient_contact_id');
    const recipientPhoneControl = this.messageForm.get('recipient_phone');
    const selectedTagsControl = this.messageForm.get('selected_tags');

    // Clear all validators first
    recipientContactControl?.clearValidators();
    recipientPhoneControl?.clearValidators();
    selectedTagsControl?.clearValidators();

    if (sendType === 'individual') {
      recipientContactControl?.setValidators([Validators.required]);
    } else if (sendType === 'bulk_tags') {
      selectedTagsControl?.setValidators([Validators.required, this.validateTagsSelection]);
    }

    recipientContactControl?.updateValueAndValidity();
    recipientPhoneControl?.updateValueAndValidity();
    selectedTagsControl?.updateValueAndValidity();
  }

  /**
   * Manejar cambio de tipo de mensaje
   */
  onMessageTypeChange(messageType: string): void {
    const messageContentControl = this.messageForm.get('message_content');
    const templateIdControl = this.messageForm.get('template_id');

    if (messageType === 'text') {
      messageContentControl?.setValidators([Validators.required]);
      templateIdControl?.clearValidators();
      this.messageForm.patchValue({ template_id: null });
    } else if (messageType === 'template') {
      templateIdControl?.setValidators([Validators.required]);
      messageContentControl?.clearValidators();
      this.messageForm.patchValue({ message_content: '' });
    }

    messageContentControl?.updateValueAndValidity();
    templateIdControl?.updateValueAndValidity();
  }

  /**
   * Manejar cambio de template
   */
  onTemplateChange(templateId: number): void {
    if (templateId) {
      const template = this.templates().find(t => t.id === templateId);
      if (template) {
        this.selectedTemplate.set(template);
        this.updateTemplatePreview();
      }
    } else {
      this.selectedTemplate.set(null);
      this.templatePreview.set('');
    }
  }

  /**
   * Manejar cambio de recurrencia
   */
  onRecurringChange(isRecurring: boolean): void {
    const recurrenceControls = [
      'recurrence_type',
      'recurrence_interval'
    ];

    if (isRecurring) {
      recurrenceControls.forEach(control => {
        this.messageForm.get(control)?.setValidators([Validators.required]);
      });
    } else {
      recurrenceControls.forEach(control => {
        this.messageForm.get(control)?.clearValidators();
        this.messageForm.get(control)?.setValue(null);
      });
    }

    recurrenceControls.forEach(control => {
      this.messageForm.get(control)?.updateValueAndValidity();
    });
  }

  /**
   * Actualizar preview del template
   */
  updateTemplatePreview(): void {
    const template = this.selectedTemplate();
    if (!template) {
      this.templatePreview.set('');
      return;
    }

    let preview = template.content;
    const variables = this.messageForm.get('template_variables')?.value || {};

    // Reemplazar variables conocidas
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{${key.toUpperCase()}}`, 'g');
      preview = preview.replace(regex, variables[key] || `{${key.toUpperCase()}}`);
    });

    // Mostrar variables del sistema como ejemplo
    preview = preview.replace(/{NOMBRE_CONTACTO}/g, '[Nombre del Contacto]');
    preview = preview.replace(/{TELEFONO}/g, '[Teléfono]');
    preview = preview.replace(/{FECHA}/g, new Date().toLocaleDateString('es-ES'));
    preview = preview.replace(/{HORA}/g, new Date().toLocaleTimeString('es-ES'));

    this.templatePreview.set(preview);
  }

  // ============================================================================
  // FORM POPULATION
  // ============================================================================

  /**
   * Poblar formulario con datos del mensaje a editar
   */
  populateFormWithMessage(message: ScheduledMessage): void {
    const scheduledDate = new Date(message.scheduled_at);
    
    this.messageForm.patchValue({
      name: message.name,
      description: message.description,
      send_type: message.send_type,
      recipient_contact_id: message.recipient_contact_id,
      recipient_phone: message.recipient_phone,
      selected_tags: message.target_tag_ids || [],
      message_type: message.message_type,
      message_content: message.message_content,
      template_id: message.template_id,
      template_variables: message.template_variables || {},
      scheduled_date: scheduledDate.toISOString().split('T')[0],
      scheduled_time: scheduledDate.toTimeString().slice(0, 5),
      timezone: message.timezone,
      is_recurring: message.is_recurring,
      recurrence_type: message.recurrence_type,
      recurrence_interval: message.recurrence_interval,
      recurrence_end_date: message.recurrence_end_date ? 
        new Date(message.recurrence_end_date).toISOString().split('T')[0] : '',
      max_executions: message.max_executions
    });
  }

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  /**
   * Guardar mensaje programado
   */
  onSubmit(): void {
    if (this.messageForm.invalid) {
      this.markFormGroupTouched();
      this.errorHandler.handleError('Por favor completa todos los campos requeridos');
      return;
    }

    if (this.isEditMode()) {
      this.updateMessage();
    } else {
      this.createMessage();
    }
  }

  /**
   * Crear nuevo mensaje
   */
  createMessage(): void {
    const formData = this.prepareFormData() as CreateScheduledMessageRequest;
    const loadingId = this.loadingService.startLoading('create-message', 'Creando mensaje programado...');

    const subscription = this.scheduledMessagesService.createScheduledMessage(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Mensaje programado creado exitosamente', 'success');
          this.router.navigate(['/scheduled-messages']);
        } else {
          this.errorHandler.handleError(response.message || 'Error al crear mensaje programado');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al crear mensaje programado', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Actualizar mensaje existente
   */
  updateMessage(): void {
    const currentMessage = this.currentMessage();
    if (!currentMessage) return;

    const formData = this.prepareFormData() as UpdateScheduledMessageRequest;
    const loadingId = this.loadingService.startLoading('update-message', 'Actualizando mensaje programado...');

    const subscription = this.scheduledMessagesService.updateScheduledMessage(currentMessage.id, formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Mensaje programado actualizado exitosamente', 'success');
          this.router.navigate(['/scheduled-messages']);
        } else {
          this.errorHandler.handleError(response.message || 'Error al actualizar mensaje programado');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al actualizar mensaje programado', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Formatear fecha local sin convertir a UTC
   */
  private formatLocalDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Preparar datos del formulario para envío
   */
  prepareFormData(): CreateScheduledMessageRequest | UpdateScheduledMessageRequest {
    const formValue = this.messageForm.value;
    
    // Combinar fecha y hora
    const scheduledDateTime = new Date(`${formValue.scheduled_date}T${formValue.scheduled_time}`);
    
    const data: any = {
      name: formValue.name,
      description: formValue.description || null,
      send_type: formValue.send_type,
      message_type: formValue.message_type,
      scheduled_at: this.formatLocalDateTime(scheduledDateTime),
      timezone: formValue.timezone,
      is_recurring: formValue.is_recurring || false
    };

    // Destinatarios según tipo
    if (formValue.send_type === 'individual') {
      if (formValue.recipient_contact_id) {
        data.recipient_contact_id = formValue.recipient_contact_id;
      } else if (formValue.recipient_phone) {
        data.recipient_phone = formValue.recipient_phone;
      }
    } else if (formValue.send_type === 'bulk_tags') {
      data.target_tag_ids = formValue.selected_tags;
    }

    // Contenido según tipo
    if (formValue.message_type === 'text') {
      data.message_content = formValue.message_content;
    } else if (formValue.message_type === 'template') {
      data.template_id = formValue.template_id;
      data.template_variables = formValue.template_variables || {};
    }

    // Recurrencia
    if (formValue.is_recurring) {
      data.recurrence_type = formValue.recurrence_type;
      data.recurrence_interval = formValue.recurrence_interval;
      
      if (formValue.recurrence_end_date && formValue.recurrence_end_time) {
        const endDateTime = new Date(`${formValue.recurrence_end_date}T${formValue.recurrence_end_time}`);
        data.recurrence_end_date = this.formatLocalDateTime(endDateTime);
      }
      
      if (formValue.max_executions) {
        data.max_executions = formValue.max_executions;
      }
    }

    // Reactivar mensaje si se cambió la fecha/hora y está en estado completed/error/cancelled
    if (this.isEditMode() && this.currentMessage()) {
      const currentMsg = this.currentMessage()!;
      const newScheduledAt = data.scheduled_at;
      const currentScheduledAt = this.formatLocalDateTime(new Date(currentMsg.scheduled_at));
      
      // Si cambió la fecha/hora y el mensaje no está activo, reactivarlo
      if (newScheduledAt !== currentScheduledAt && 
          ['completed', 'error', 'cancelled'].includes(currentMsg.status)) {
        data.status = 'pending';
        data.is_active = true;
        console.log('🔄 Reactivando mensaje debido a cambio de fecha/hora');
        
        // Mostrar mensaje informativo al usuario
        this.errorHandler.handleError(
          `El mensaje será reactivado automáticamente debido al cambio de fecha/hora`, 
          'info'
        );
      }
    }

    return data;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Marcar todos los campos como touched para mostrar errores
   */
  markFormGroupTouched(): void {
    Object.keys(this.messageForm.controls).forEach(key => {
      this.messageForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Verificar si un campo tiene error
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.messageForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  /**
   * Obtener mensaje de error de un campo
   */
  getFieldError(fieldName: string): string {
    const field = this.messageForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) return 'Este campo es requerido';
    if (field.errors['maxlength']) return `Máximo ${field.errors['maxlength'].requiredLength} caracteres`;
    if (field.errors['min']) return `Valor mínimo: ${field.errors['min'].min}`;
    if (field.errors['max']) return `Valor máximo: ${field.errors['max'].max}`;

    return 'Campo inválido';
  }

  /**
   * Cancelar y volver a la lista
   */
  cancel(): void {
    this.router.navigate(['/scheduled-messages']);
  }

  /**
   * Obtener nombre del contacto
   */
  getContactDisplayName(contact: Contact): string {
    return contact.custom_name || contact.name || contact.phone_number;
  }

  /**
   * Verificar si se puede enviar el formulario
   */
  canSubmit(): boolean {
    return this.messageForm.valid && !this.loadingService.isLoadingByContext('create-message') && !this.loadingService.isLoadingByContext('update-message');
  }

  /**
   * Obtener etiquetas seleccionadas como objetos
   */
  getSelectedTags(): ContactTag[] {
    const selectedIds = this.messageForm.get('selected_tags')?.value || [];
    return this.allTags().filter(tag => selectedIds.includes(tag.id));
  }

  /**
   * Manejar cambio de etiquetas seleccionadas
   */
  onTagsChanged(tags: ContactTag[]): void {
    this.messageForm.patchValue({
      selected_tags: tags.map(tag => tag.id)
    });
  }

  /**
   * Obtener texto de zona horaria
   */
  getTimezoneText(timezone: string): string {
    const option = TIMEZONE_OPTIONS.find(tz => tz.value === timezone);
    return option ? option.label : timezone;
  }

  /**
   * Validar fechas de recurrencia
   */
  validateRecurrenceDates(): boolean {
    const formValue = this.messageForm.value;
    
    if (!formValue.is_recurring) return true;

    const scheduledDate = new Date(`${formValue.scheduled_date}T${formValue.scheduled_time}`);
    
    if (formValue.recurrence_end_date && formValue.recurrence_end_time) {
      const endDate = new Date(`${formValue.recurrence_end_date}T${formValue.recurrence_end_time}`);
      
      if (endDate <= scheduledDate) {
        this.errorHandler.handleError('La fecha de fin debe ser posterior a la fecha programada');
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // TAG MANAGEMENT METHODS
  // ============================================================================

  /**
   * Obtener etiquetas disponibles (filtradas)
   */
  getAvailableTags(): ContactTag[] {
    const searchTerm = this.tagSearchTerm().toLowerCase();
    const tags = searchTerm 
      ? this.allTags().filter(tag => 
          tag.name.toLowerCase().includes(searchTerm) ||
          (tag.description && tag.description.toLowerCase().includes(searchTerm))
        )
      : this.allTags();
    
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Verificar si una etiqueta está seleccionada
   */
  isTagSelected(tag: ContactTag): boolean {
    const selectedIds = this.messageForm.get('selected_tags')?.value || [];
    return selectedIds.includes(tag.id);
  }

  /**
   * Alternar selección de etiqueta
   */
  toggleTag(tag: ContactTag): void {
    const selectedIds = this.messageForm.get('selected_tags')?.value || [];
    const isSelected = selectedIds.includes(tag.id);
    
    if (isSelected) {
      // Remover etiqueta
      const newIds = selectedIds.filter((id: number) => id !== tag.id);
      this.messageForm.patchValue({ selected_tags: newIds });
    } else {
      // Agregar etiqueta
      const newIds = [...selectedIds, tag.id];
      this.messageForm.patchValue({ selected_tags: newIds });
    }
  }

  /**
   * Remover etiqueta específica
   */
  removeTag(tag: ContactTag): void {
    const selectedIds = this.messageForm.get('selected_tags')?.value || [];
    const newIds = selectedIds.filter((id: number) => id !== tag.id);
    this.messageForm.patchValue({ selected_tags: newIds });
  }

  /**
   * Filtrar etiquetas por término de búsqueda
   */
  filterTags(searchTerm: string): void {
    this.tagSearchTerm.set(searchTerm);
  }

  /**
   * Previsualizar contactos que recibirán el mensaje
   */
  previewContacts(): void {
    const selectedTags = this.getSelectedTags();
    if (selectedTags.length === 0) return;

    // TODO: Implementar modal de preview de contactos
    console.log('Preview contacts for tags:', selectedTags.map(t => t.name));
    this.errorHandler.handleError('Funcionalidad de preview en desarrollo');
  }

}
