import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ChatService } from '../../../chat/services/chat.service';
import { AuthService } from '../../../auth/services/auth.service';
import { WhatsAppRealtimeService, WebSocketConnectionState } from '../../../../core/services/websocket.service';
import { TagSelectorComponent } from '../../../../shared/components/tag-selector/tag-selector.component';
import { FileUploadComponent } from '../../../../shared/components/file-upload/file-upload.component';
import { FilePreviewComponent } from '../../../../shared/components/file-preview/file-preview.component';
import {
  Conversation,
  SendMessageRequest,
  SendImageRequest,
  SendDocumentRequest,
  ChatFile
} from '../../../../core/models/api.models';
import { ContactsService } from '../../../contacts/services/contacts.service';
import { ContactTag, Contact } from '../../../contacts/models/contact.models';
import { TemplatesService } from '../../../templates/services/templates.service';
import { MessageTemplate } from '../../../../core/models/template.models';
import { APP_CONFIG } from '../../../../core/config/app.config';

// ============================================================================
// INTERFACES
// ============================================================================

interface BulkSendingConfig {
  batchSize: number;
  messageDelay: number;
  batchDelay: number;
  hourlyLimit: number;
  dailyLimit: number;
  maxRetries: number;
  retryDelay: number;
}

interface BulkSendingState {
  isActive: boolean;
  isPaused: boolean;
  currentBatch: number;
  totalBatches: number;
  currentInBatch: number;
  totalInBatch: number;
  successful: number;
  failed: number;
  remaining: number;
  errors: string[];
  errorsByType: {
    invalidNumber: number;
    networkError: number;
    rateLimited: number;
    blocked: number;
    other: number;
  };
  skippedContacts: string[];
  tagsAssigned: number;
  startTime: Date | null;
  estimatedCompletion: Date | null;
  canResume: boolean;
}

interface QuotaUsage {
  hourly: {
    used: number;
    limit: number;
    resetTime: Date | null;
  };
  daily: {
    used: number;
    limit: number;
    resetTime: Date | null;
  };
}

interface ContactBatch {
  contacts: Contact[];
  batchNumber: number;
  retryCount: number;
}

/**
 * Componente para envío de mensajes masivos
 * Permite seleccionar múltiples contactos y enviar mensajes, templates, imágenes o documentos
 */
@Component({
  selector: 'app-bulk-messages',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TagSelectorComponent, FileUploadComponent, FilePreviewComponent],
  templateUrl: './bulk-messages.component.html',
  styleUrl: './bulk-messages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkMessagesComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private whatsappRealtimeService = inject(WhatsAppRealtimeService);
  private contactsService = inject(ContactsService);
  private templatesService = inject(TemplatesService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // ============================================================================
  // SIGNALS
  // ============================================================================

  public conversations = signal<Conversation[]>([]);
  public selectedConversations = signal<Set<number>>(new Set());
  public isLoading = signal<boolean>(false);
  public isSending = signal<boolean>(false);
  public sendProgress = signal<{ current: number; total: number; conversation?: string }>({ current: 0, total: 0 });

  // Messages
  public successMessage = signal<string>('');
  public errorMessage = signal<string>('');

  // WebSocket signals
  public connectionState = signal<WebSocketConnectionState>(WebSocketConnectionState.DISCONNECTED);
  public isConnectedToWebSocket = signal<boolean>(false);

  // New: Contacts and Tags functionality
  public allContacts = signal<Contact[]>([]);
  public filteredContacts = signal<Contact[]>([]);
  public selectedContacts = signal<Set<string>>(new Set()); // Using phone_number as IDs
  public availableTags = signal<ContactTag[]>([]);
  public selectedTags = signal<ContactTag[]>([]);

  // New: Templates functionality
  public availableTemplates = signal<MessageTemplate[]>([]);
  public selectedTemplate = signal<MessageTemplate | null>(null);
  public templateVariables = signal<string[]>([]);
  public showTemplateModal = signal<boolean>(false);
  public showVariablesModal = signal<boolean>(false);
  public templateVariablesForm: FormGroup = this.fb.group({});
  public templatePreview = signal<string>('');

  // New: Files functionality
  public selectedFiles = signal<ChatFile[]>([]);
  public showFileUpload = signal<boolean>(false);

  // New: Auto-tagging functionality
  public autoTaggingEnabled = signal<boolean>(false);
  public selectedAutoTag = signal<ContactTag | null>(null);
  public showAutoTagModal = signal<boolean>(false);
  
  // Advanced configuration visibility
  public showAdvancedConfig = signal<boolean>(false);

  // New: Bulk sending configuration and state
  public bulkConfig = signal<BulkSendingConfig>({
    batchSize: 10,
    messageDelay: 2000,      // 2 segundos entre mensajes
    batchDelay: 60000,       // 1 minuto entre lotes
    hourlyLimit: 300,        // 100 mensajes por hora
    dailyLimit: 5000,        // 1000 mensajes por día
    maxRetries: 3,
    retryDelay: 5000
  });

  public bulkState = signal<BulkSendingState>({
    isActive: false,
    isPaused: false,
    currentBatch: 0,
    totalBatches: 0,
    currentInBatch: 0,
    totalInBatch: 0,
    successful: 0,
    failed: 0,
    remaining: 0,
    errors: [],
    errorsByType: {
      invalidNumber: 0,
      networkError: 0,
      rateLimited: 0,
      blocked: 0,
      other: 0
    },
    skippedContacts: [],
    tagsAssigned: 0,
    startTime: null,
    estimatedCompletion: null,
    canResume: false
  });

  public quotaUsage = signal<QuotaUsage>({
    hourly: { used: 0, limit: 100, resetTime: null },
    daily: { used: 0, limit: 1000, resetTime: null }
  });

  // Subscriptions
  private websocketSubscription?: Subscription;
  private bulkProgressSubscription?: Subscription;
  private bulkSendingTimer?: any;

  // ============================================================================
  // FORMS
  // ============================================================================

  public messageForm: FormGroup = this.fb.group({
    message: ['', [Validators.required, Validators.minLength(1)]],
    messageType: ['text', Validators.required], // 'text', 'template', 'files'
    useTemplate: [false],
    selectedTemplateId: [null]
  });

  public filterForm: FormGroup = this.fb.group({
    search: [''],
    selectedTags: [[]],
    botEnabled: ['all'], // 'all', 'enabled', 'disabled'
    hasUnread: [false]
  });

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    this.loadConversations();
    this.loadContacts();
    this.loadTags();
    this.loadTemplates();
    this.setupFormSubscriptions();
    this.initializeWebSocket();
    this.initializeQuotaSystem();
    this.loadBulkState();
  }

  ngOnDestroy(): void {
    this.websocketSubscription?.unsubscribe();
    this.bulkProgressSubscription?.unsubscribe();

    // Limpiar timer de envío masivo
    if (this.bulkSendingTimer) {
      clearTimeout(this.bulkSendingTimer);
    }

    // Guardar estado antes de destruir
    this.saveBulkState();

    // Desconectar WebSocket
    this.whatsappRealtimeService.disconnect();
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Cargar conversaciones
   */
  loadConversations(): void {
    this.isLoading.set(true);
    this.clearMessages();

    this.chatService.getConversations({
      limit: 100,
      offset: 0,
      archived: false
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.conversations.set(response.conversations);
        } else {
          this.errorMessage.set('Error al cargar conversaciones');
        }
      },
      error: (error: any) => {
        console.error('Error loading conversations:', error);
        this.errorMessage.set('Error al cargar conversaciones');
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Configurar suscripciones a formularios
   */
  private setupFormSubscriptions(): void {
    // Filtrar conversaciones cuando cambie el filtro
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
      this.filterContacts();
    });
  }

  // ============================================================================
  // FILTERING
  // ============================================================================

  /**
   * Aplicar filtros a las conversaciones
   */
  applyFilters(): void {
    // Implementar lógica de filtrado si es necesario
    // Por ahora mantenemos todas las conversaciones
  }

  /**
   * Obtener conversaciones filtradas
   */
  getFilteredConversations(): Conversation[] {
    return this.conversations();
  }

  // ============================================================================
  // WEBSOCKET
  // ============================================================================

  /**
   * Inicializar conexión WebSocket
   */
  private initializeWebSocket(): void {
    this.websocketSubscription = this.whatsappRealtimeService.getConnectionState().subscribe(
      (state: WebSocketConnectionState) => this.connectionState.set(state)
    );

    this.whatsappRealtimeService.connect();
    this.isConnectedToWebSocket.set(true);
  }

  // ============================================================================
  // CONVERSATION SELECTION
  // ============================================================================

  /**
   * Seleccionar/deseleccionar conversación
   */
  toggleConversationSelection(conversationId: number): void {
    const selected = new Set(this.selectedConversations());

    if (selected.has(conversationId)) {
      selected.delete(conversationId);
    } else {
      selected.add(conversationId);
    }

    this.selectedConversations.set(selected);
  }

  /**
   * Verificar si una conversación está seleccionada
   */
  isConversationSelected(conversationId: number): boolean {
    return this.selectedConversations().has(conversationId);
  }

  /**
   * Seleccionar todas las conversaciones
   */
  selectAllConversations(): void {
    const allIds = this.getFilteredConversations().map(conv => conv.id);
    this.selectedConversations.set(new Set(allIds));
  }

  /**
   * Deseleccionar todas las conversaciones
   */
  deselectAllConversations(): void {
    this.selectedConversations.set(new Set());
  }

  /**
   * Obtener número de conversaciones seleccionadas
   */
  getSelectedCount(): number {
    return this.selectedConversations().size;
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  /**
   * Navegar al dashboard
   */
  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Navegar al chat
   */
  goToChat(): void {
    this.router.navigate(['/chat']);
  }

  /**
   * Cerrar sesión
   */
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('Error during logout:', error);
        // Forzar navegación al login incluso si hay error
        this.router.navigate(['/auth/login']);
      }
    });
  }

  // ============================================================================
  // PERFORMANCE OPTIMIZATION METHODS
  // ============================================================================

  /**
   * TrackBy function para conversaciones
   */
  trackByConversationId(index: number, conversation: Conversation): number {
    return conversation.id;
  }

  /**
   * TrackBy function para archivos seleccionados
   */
  trackByFileName(index: number, file: ChatFile): string {
    return file.file.name + file.file.size + file.file.lastModified;
  }

  // ============================================================================
  // NEW: CONTACTS AND TAGS FUNCTIONALITY
  // ============================================================================

  /**
   * Cargar contactos
   */
  loadContacts(page: number = 1): void {
    this.contactsService.getContacts({
      search: '', page: page, limit: 100
      // Usar límite estándar 
    }).subscribe({
      next: (response: any) => {

        if (page == 1) {
          this.allContacts.set([]);
          this.filteredContacts.set([]);
        }

        if (response.success) {
          const currentAll = this.allContacts();
          const currentFiltered = this.filteredContacts();

          // Concatenar los nuevos resultados
          const updatedAll = [...currentAll, ...response.data];
          const updatedFiltered = [...currentFiltered, ...response.data];

          // Actualizar los signals
          this.allContacts.set(updatedAll);
          this.filteredContacts.set(updatedFiltered);
        }

        if (response.pagination.pages && page < response.pagination.pages) {
          // Cargar siguiente página
          this.loadContacts(page + 1);
        }
      },
      error: (error: any) => {
        console.error('Error loading contacts:', error);
        this.errorMessage.set('Error al cargar contactos');
      }
    });
  }

  /**
   * Cargar tags disponibles
   */
  loadTags(): void {
    this.contactsService.getTags().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.availableTags.set(response.data);
        }
      },
      error: (error: any) => {
        console.error('Error loading tags:', error);
      }
    });
  }

  /**
   * Cargar templates disponibles
   */
  loadTemplates(): void {
    this.templatesService.getTemplates({ is_active: true, limit: 100 }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.availableTemplates.set(response.templates);
        }
      },
      error: (error: any) => {
        console.error('Error loading templates:', error);
      }
    });
  }

  /**
   * Filtrar contactos por tags seleccionados
   */
  onTagsChanged(selectedTags: ContactTag[]): void {
    this.selectedTags.set(selectedTags);
    this.filterContacts();
  }

  /**
   * Filtrar contactos
   */
  private filterContacts(): void {
    let filtered = this.allContacts();

    // Filtrar por tags
    const selectedTags = this.selectedTags();
    if (selectedTags.length > 0) {
      const tagIds = selectedTags.map((tag: any) => tag.id);
      filtered = filtered.filter((contact: any) =>
        contact.tags && contact.tags.some((tag: any) => tagIds.includes(tag.id))
      );
    }

    // Filtrar por búsqueda
    const searchTerm = this.filterForm.value.search?.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter((contact: any) =>
        contact.name?.toLowerCase().includes(searchTerm) ||
        contact.phone_number.includes(searchTerm)
      );
    }

    this.filteredContacts.set(filtered);
  }

  /**
   * Seleccionar/deseleccionar contacto
   */
  toggleContactSelection(contact: Contact): void {
    const selected = new Set(this.selectedContacts());

    if (selected.has(contact.phone_number)) {
      selected.delete(contact.phone_number);
    } else {
      selected.add(contact.phone_number);
    }

    this.selectedContacts.set(selected);
  }

  /**
   * Seleccionar todos los contactos filtrados
   */
  selectAllContacts(): void {
    const allPhones = this.filteredContacts().map((contact: any) => contact.phone_number);
    this.selectedContacts.set(new Set(allPhones));
  }

  /**
   * Deseleccionar todos los contactos
   */
  deselectAllContacts(): void {
    this.selectedContacts.set(new Set());
  }

  /**
   * Verificar si un contacto está seleccionado
   */
  isContactSelected(contact: Contact): boolean {
    return this.selectedContacts().has(contact.phone_number);
  }

  // ============================================================================
  // NEW: AUTO-TAGGING FUNCTIONALITY
  // ============================================================================

  /**
   * Abrir modal de selección de etiqueta automática
   */
  openAutoTagModal(): void {
    this.showAutoTagModal.set(true);
  }

  /**
   * Cerrar modal de etiqueta automática
   */
  closeAutoTagModal(): void {
    this.showAutoTagModal.set(false);
  }

  /**
   * Seleccionar etiqueta para asignación automática
   */
  selectAutoTag(tag: ContactTag): void {
    this.selectedAutoTag.set(tag);
    this.autoTaggingEnabled.set(true);
    this.closeAutoTagModal();
  }

  /**
   * Remover etiqueta automática
   */
  removeAutoTag(): void {
    this.selectedAutoTag.set(null);
    this.autoTaggingEnabled.set(false);
  }

  /**
   * Asignar etiqueta a un contacto específico
   */
  private assignTagToContact(contact: Contact): void {
    const tag = this.selectedAutoTag();
    if (!tag || !this.autoTaggingEnabled()) return;

    // Buscar el contacto completo con ID
    const fullContact = this.allContacts().find(c => c.phone_number === contact.phone_number);
    if (!fullContact || !fullContact.id) {
      console.warn(`No se pudo encontrar el ID del contacto: ${contact.phone_number}`);
      return;
    }

    // Verificar si el contacto ya tiene esta etiqueta
    const hasTag = fullContact.tags?.some(existingTag => existingTag.id === tag.id);
    if (hasTag) {
      console.log(`El contacto ${contact.phone_number} ya tiene la etiqueta ${tag.name}`);
      return;
    }

    // IMPORTANTE: Incluir TODAS las etiquetas existentes + la nueva
    const existingTagIds = fullContact.tags?.map(t => t.id) || [];
    const allTagIds = [...existingTagIds, tag.id];

    // Asignar TODAS las etiquetas (existentes + nueva)
    this.contactsService.assignTagsToContact(fullContact.id, allTagIds).subscribe({
      next: (response: any) => {
        if (response.success) {
          console.log(`✅ Etiqueta "${tag.name}" AGREGADA a ${contact.name || contact.phone_number} (manteniendo ${existingTagIds.length} etiquetas existentes)`);
          
          // Actualizar el contacto en la lista local
          this.updateContactTags(fullContact, tag);
          
          // Incrementar contador de etiquetas asignadas
          this.bulkState.update((s: any) => ({
            ...s,
            tagsAssigned: s.tagsAssigned + 1
          }));
        } else {
          console.error(`Error asignando etiqueta a ${contact.phone_number}:`, response.message);
        }
      },
      error: (error: any) => {
        console.error(`Error asignando etiqueta a ${contact.phone_number}:`, error);
      }
    });
  }

  /**
   * Actualizar etiquetas de contacto en la lista local
   */
  private updateContactTags(contact: Contact, newTag: ContactTag): void {
    const allContacts = this.allContacts();
    const filteredContacts = this.filteredContacts();

    // Actualizar en allContacts
    const updatedAllContacts = allContacts.map(c => {
      if (c.phone_number === contact.phone_number) {
        const existingTags = c.tags || [];
        const hasTag = existingTags.some(tag => tag.id === newTag.id);
        if (!hasTag) {
          return { ...c, tags: [...existingTags, newTag] };
        }
      }
      return c;
    });

    // Actualizar en filteredContacts
    const updatedFilteredContacts = filteredContacts.map(c => {
      if (c.phone_number === contact.phone_number) {
        const existingTags = c.tags || [];
        const hasTag = existingTags.some(tag => tag.id === newTag.id);
        if (!hasTag) {
          return { ...c, tags: [...existingTags, newTag] };
        }
      }
      return c;
    });

    this.allContacts.set(updatedAllContacts);
    this.filteredContacts.set(updatedFilteredContacts);
  }

  // ============================================================================
  // NEW: TEMPLATES FUNCTIONALITY
  // ============================================================================

  /**
   * Abrir modal de selección de templates
   */
  openTemplateModal(): void {
    this.showTemplateModal.set(true);
  }

  /**
   * Cerrar modal de templates
   */
  closeTemplateModal(): void {
    this.showTemplateModal.set(false);
  }

  /**
   * Seleccionar template
   */
  selectTemplate(template: MessageTemplate): void {
    this.selectedTemplate.set(template);
    const variables = this.getTemplateVariables(template.content);
    this.templateVariables.set(variables);

    // Configurar formulario
    this.messageForm.patchValue({
      useTemplate: true,
      selectedTemplateId: template.id,
      messageType: 'template'
    });

    if (variables.length > 0) {
      // Crear formulario para variables
      const formControls: { [key: string]: any } = {};
      variables.forEach(variable => {
        // Valor por defecto para variables comunes
        let defaultValue = '';
        if (variable === 'nombre' || variable === 'name') {
          defaultValue = '{NOMBRE_CONTACTO}'; // Placeholder que se reemplazará automáticamente
        }
        formControls[variable] = [defaultValue];
      });
      this.templateVariablesForm = this.fb.group(formControls);

      // Escuchar cambios para actualizar preview
      this.templateVariablesForm.valueChanges.subscribe(() => {
        this.updateTemplatePreview();
      });

      this.updateTemplatePreview();
      this.closeTemplateModal();
      this.showVariablesModal.set(true);
    } else {
      // Template sin variables
      this.templatePreview.set(template.content);
      this.messageForm.patchValue({ message: template.content });
      this.closeTemplateModal();
    }
  }

  /**
   * Cerrar modal de variables
   */
  closeVariablesModal(): void {
    this.showVariablesModal.set(false);
    this.selectedTemplate.set(null);
    this.templateVariables.set([]);
    this.templatePreview.set('');
  }

  /**
   * Actualizar preview del template
   */
  private updateTemplatePreview(): void {
    const template = this.selectedTemplate();
    if (template) {
      let content = template.content;
      const variables = this.templateVariablesForm.value;

      // Procesar variables
      Object.keys(variables).forEach(key => {
        const value = variables[key] || '';
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });

      this.templatePreview.set(content);
      this.messageForm.patchValue({ message: content });
    }
  }

  /**
   * Confirmar uso del template
   */
  confirmTemplate(): void {
    const preview = this.templatePreview();
    this.messageForm.patchValue({ message: preview });
    this.closeVariablesModal();
  }

  /**
   * Extraer variables de un template
   */
  private getTemplateVariables(content: string): string[] {
    const variables = new Set<string>();

    // Buscar variables con formato {variable}
    const singleBraceMatches = content.match(/\{([^{}]+)\}/g);
    if (singleBraceMatches) {
      singleBraceMatches.forEach(match => {
        const variable = match.replace(/[{}]/g, '');
        variables.add(variable);
      });
    }

    // Buscar variables con formato {{variable}}
    const doubleBraceMatches = content.match(/\{\{([^{}]+)\}\}/g);
    if (doubleBraceMatches) {
      doubleBraceMatches.forEach(match => {
        const variable = match.replace(/[{}]/g, '');
        variables.add(variable);
      });
    }

    return Array.from(variables);
  }

  /**
   * Procesar mensaje con variables automáticas para un contacto específico
   */
  private processMessageForContact(message: string, contact: Contact): string {
    let processedMessage = message;

    // Reemplazar variables automáticas
    processedMessage = processedMessage.replace(/\{NOMBRE_CONTACTO\}/g, contact.name || contact.phone_number);
    processedMessage = processedMessage.replace(/\{TELEFONO_CONTACTO\}/g, contact.phone_number);

    return processedMessage;
  }

  // ============================================================================
  // NEW: QUOTA AND BATCH SYSTEM
  // ============================================================================

  /**
   * Inicializar sistema de cuotas
   */
  private initializeQuotaSystem(): void {
    const now = new Date();
    const hourReset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
    const dayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

    // Cargar uso actual desde localStorage
    const savedQuota = localStorage.getItem('bulk_quota_usage');
    if (savedQuota) {
      try {
        const parsed = JSON.parse(savedQuota);
        this.quotaUsage.set({
          hourly: {
            used: parsed.hourly?.used || 0,
            limit: this.bulkConfig().hourlyLimit,
            resetTime: new Date(parsed.hourly?.resetTime || hourReset)
          },
          daily: {
            used: parsed.daily?.used || 0,
            limit: this.bulkConfig().dailyLimit,
            resetTime: new Date(parsed.daily?.resetTime || dayReset)
          }
        });
      } catch (e) {
        this.resetQuotaUsage();
      }
    } else {
      this.resetQuotaUsage();
    }

    // Verificar si necesita reset
    this.checkQuotaReset();
  }

  /**
   * Resetear uso de cuotas
   */
  private resetQuotaUsage(): void {
    const now = new Date();
    const hourReset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
    const dayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

    this.quotaUsage.set({
      hourly: {
        used: 0,
        limit: this.bulkConfig().hourlyLimit,
        resetTime: hourReset
      },
      daily: {
        used: 0,
        limit: this.bulkConfig().dailyLimit,
        resetTime: dayReset
      }
    });

    this.saveQuotaUsage();
  }

  /**
   * Verificar si las cuotas necesitan reset
   */
  private checkQuotaReset(): void {
    const now = new Date();
    const quota = this.quotaUsage();
    let needsUpdate = false;

    // Reset horario
    if (quota.hourly.resetTime && now >= quota.hourly.resetTime) {
      quota.hourly.used = 0;
      quota.hourly.resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
      needsUpdate = true;
    }

    // Reset diario
    if (quota.daily.resetTime && now >= quota.daily.resetTime) {
      quota.daily.used = 0;
      quota.daily.resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.quotaUsage.set({ ...quota });
      this.saveQuotaUsage();
    }
  }

  /**
   * Verificar si se puede enviar más mensajes
   */
  private canSendMore(): { canSend: boolean; reason?: string } {
    this.checkQuotaReset();
    const quota = this.quotaUsage();

    if (quota.hourly.used >= quota.hourly.limit) {
      return {
        canSend: false,
        reason: `Límite horario alcanzado (${quota.hourly.used}/${quota.hourly.limit}). Reset: ${quota.hourly.resetTime?.toLocaleTimeString()}`
      };
    }

    if (quota.daily.used >= quota.daily.limit) {
      return {
        canSend: false,
        reason: `Límite diario alcanzado (${quota.daily.used}/${quota.daily.limit}). Reset: ${quota.daily.resetTime?.toLocaleDateString()}`
      };
    }

    return { canSend: true };
  }

  /**
   * Incrementar contador de uso
   */
  private incrementQuotaUsage(): void {
    const quota = this.quotaUsage();
    quota.hourly.used++;
    quota.daily.used++;
    this.quotaUsage.set({ ...quota });
    this.saveQuotaUsage();
  }

  /**
   * Guardar uso de cuotas en localStorage
   */
  private saveQuotaUsage(): void {
    localStorage.setItem('bulk_quota_usage', JSON.stringify(this.quotaUsage()));
  }

  /**
   * Cargar estado de envío masivo
   */
  private loadBulkState(): void {
    const saved = localStorage.getItem('bulk_sending_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.isActive || parsed.canResume) {
          this.bulkState.set({
            ...parsed,
            startTime: parsed.startTime ? new Date(parsed.startTime) : null,
            estimatedCompletion: parsed.estimatedCompletion ? new Date(parsed.estimatedCompletion) : null
          });
        }
      } catch (e) {
        console.error('Error loading bulk state:', e);
      }
    }
  }

  /**
   * Guardar estado de envío masivo
   */
  private saveBulkState(): void {
    const state = this.bulkState();
    if (state.isActive || state.canResume) {
      localStorage.setItem('bulk_sending_state', JSON.stringify(state));
    } else {
      localStorage.removeItem('bulk_sending_state');
    }
  }

  /**
   * Dividir contactos en lotes
   */
  private createBatches(contacts: Contact[]): ContactBatch[] {
    const batchSize = this.bulkConfig().batchSize;
    const batches: ContactBatch[] = [];

    for (let i = 0; i < contacts.length; i += batchSize) {
      batches.push({
        contacts: contacts.slice(i, i + batchSize),
        batchNumber: Math.floor(i / batchSize) + 1,
        retryCount: 0
      });
    }

    return batches;
  }

  /**
   * Calcular tiempo estimado de finalización
   */
  private calculateEstimatedCompletion(totalContacts: number, currentIndex: number): Date {
    const config = this.bulkConfig();
    const remaining = totalContacts - currentIndex;
    const batchesRemaining = Math.ceil(remaining / config.batchSize);
    
    // Tiempo por mensaje + tiempo entre lotes
    const timePerMessage = config.messageDelay;
    const timeForBatches = batchesRemaining * config.batchDelay;
    const timeForMessages = remaining * timePerMessage;
    
    const totalTimeMs = timeForBatches + timeForMessages;
    
    return new Date(Date.now() + totalTimeMs);
  }

  /**
   * Clasificar tipo de error basado en el mensaje
   */
  private classifyError(error: any, response?: any): 'invalidNumber' | 'networkError' | 'rateLimited' | 'blocked' | 'other' {
    const errorMessage = error?.message?.toLowerCase() || response?.message?.toLowerCase() || '';
    const statusCode = error?.status || response?.status;

    // Números inválidos
    if (errorMessage.includes('invalid number') || 
        errorMessage.includes('invalid phone') ||
        errorMessage.includes('número inválido') ||
        errorMessage.includes('not a whatsapp number') ||
        statusCode === 400) {
      return 'invalidNumber';
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('quota exceeded') ||
        statusCode === 429) {
      return 'rateLimited';
    }

    // Bloqueado
    if (errorMessage.includes('blocked') ||
        errorMessage.includes('banned') ||
        errorMessage.includes('suspended') ||
        statusCode === 403) {
      return 'blocked';
    }

    // Errores de red
    if (errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        statusCode >= 500) {
      return 'networkError';
    }

    return 'other';
  }

  /**
   * Manejar error de envío con clasificación
   */
  private handleSendingError(contact: Contact, error: any, response?: any): void {
    const errorType = this.classifyError(error, response);
    const errorMessage = error?.message || response?.message || 'Error desconocido';
    
    // Actualizar estadísticas
    this.bulkState.update((s: any) => ({
      ...s,
      failed: s.failed + 1,
      remaining: s.remaining - 1,
      errors: [...s.errors, `${contact.name || contact.phone_number}: ${errorMessage}`],
      errorsByType: {
        ...s.errorsByType,
        [errorType]: s.errorsByType[errorType] + 1
      }
    }));

    // Acciones específicas por tipo de error
    switch (errorType) {
      case 'invalidNumber':
        console.warn(`Número inválido detectado: ${contact.phone_number}`);
        // Los números inválidos se saltan automáticamente
        break;

      case 'rateLimited':
        console.warn('Rate limit detectado, pausando envío');
        this.pauseBulkSending();
        this.errorMessage.set('Envío pausado: límite de velocidad alcanzado. Reanudar en unos minutos.');
        break;

      case 'blocked':
        console.error('Cuenta bloqueada detectada');
        this.pauseBulkSending();
        this.errorMessage.set('Envío pausado: posible bloqueo de cuenta. Revisar configuración.');
        break;

      case 'networkError':
        console.warn(`Error de red: ${errorMessage}`);
        // Los errores de red pueden ser temporales, continuar
        break;

      default:
        console.error(`Error no clasificado: ${errorMessage}`);
        break;
    }
  }

  /**
   * Verificar si debe pausar por errores críticos
   */
  private shouldPauseForErrors(): boolean {
    const state = this.bulkState();
    const errors = state.errorsByType;
    
    // Pausar si hay muchos errores de rate limiting
    if (errors.rateLimited >= 3) {
      return true;
    }

    // Pausar si hay errores de bloqueo
    if (errors.blocked >= 1) {
      return true;
    }

    // Pausar si hay muchos errores consecutivos (lógica existente mejorada)
    const recentErrors = state.errors.slice(-5);
    if (recentErrors.length >= 5) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // NEW: ENHANCED BULK SENDING
  // ============================================================================

  /**
   * Enviar mensajes masivos con sistema inteligente de lotes
   */
  sendBulkMessagesEnhanced(): void {
    const messageType = this.messageForm.value.messageType;

    if (messageType === 'files') {
      this.sendBulkFiles();
      return;
    }

    if (!this.canSendEnhanced()) return;

    // Verificar cuotas antes de empezar
    const quotaCheck = this.canSendMore();
    if (!quotaCheck.canSend) {
      this.errorMessage.set(quotaCheck.reason || 'Límite de envío alcanzado');
      return;
    }

    const selectedPhones = Array.from(this.selectedContacts());
    const selectedContactsData = this.allContacts().filter((contact: any) =>
      selectedPhones.includes(contact.phone_number)
    );

    if (selectedContactsData.length === 0) {
      this.errorMessage.set('No hay contactos seleccionados');
      return;
    }

    // Inicializar estado de envío
    const batches = this.createBatches(selectedContactsData);
    const now = new Date();

    this.bulkState.set({
      isActive: true,
      isPaused: false,
      currentBatch: 0,
      totalBatches: batches.length,
      currentInBatch: 0,
      totalInBatch: 0,
      successful: 0,
      failed: 0,
      remaining: selectedContactsData.length,
      errors: [],
      errorsByType: {
        invalidNumber: 0,
        networkError: 0,
        rateLimited: 0,
        blocked: 0,
        other: 0
      },
      skippedContacts: [],
      tagsAssigned: 0,
      startTime: now,
      estimatedCompletion: this.calculateEstimatedCompletion(selectedContactsData.length, 0),
      canResume: true
    });

    this.isSending.set(true);
    this.clearMessages();
    this.saveBulkState();

    // Iniciar procesamiento por lotes
    this.processBatches(batches, selectedContactsData);
  }

  /**
   * Procesar lotes de contactos
   */
  private processBatches(batches: ContactBatch[], allContacts: Contact[]): void {
    const state = this.bulkState();
    
    if (state.currentBatch >= batches.length) {
      this.completeBulkSending();
      return;
    }

    const currentBatch = batches[state.currentBatch];
    
    // Actualizar estado del lote actual
    this.bulkState.update((s: any) => ({
      ...s,
      totalInBatch: currentBatch.contacts.length,
      currentInBatch: 0
    }));

    console.log(`Procesando lote ${currentBatch.batchNumber}/${batches.length} con ${currentBatch.contacts.length} contactos`);

    // Procesar contactos del lote actual
    this.processContactsInBatch(currentBatch, () => {
      // Lote completado, pasar al siguiente
      this.bulkState.update((s: any) => ({
        ...s,
        currentBatch: s.currentBatch + 1
      }));

      this.saveBulkState();

      // Esperar antes del siguiente lote (solo si no es el último)
      if (state.currentBatch + 1 < batches.length) {
        const batchDelay = this.bulkConfig().batchDelay;
        console.log(`Esperando ${batchDelay/1000} segundos antes del siguiente lote...`);
        
        this.bulkSendingTimer = setTimeout(() => {
          this.processBatches(batches, allContacts);
        }, batchDelay);
      } else {
        // Era el último lote
        this.processBatches(batches, allContacts);
      }
    });
  }

  /**
   * Procesar contactos dentro de un lote
   */
  private processContactsInBatch(batch: ContactBatch, onBatchComplete: () => void): void {
    const baseMessage = this.messageForm.value.message;
    let contactIndex = 0;

    const sendToNextContact = () => {
      // Verificar si el envío fue pausado
      if (this.bulkState().isPaused) {
        console.log('Envío pausado por el usuario');
        return;
      }

      // Verificar cuotas antes de cada mensaje
      const quotaCheck = this.canSendMore();
      if (!quotaCheck.canSend) {
        this.pauseBulkSending();
        this.errorMessage.set(`Envío pausado: ${quotaCheck.reason}`);
        return;
      }

      if (contactIndex >= batch.contacts.length) {
        onBatchComplete();
        return;
      }

      const contact = batch.contacts[contactIndex];
      const personalizedMessage = this.processMessageForContact(baseMessage, contact);

      // Actualizar progreso
      this.bulkState.update((s: any) => ({
        ...s,
        currentInBatch: contactIndex + 1,
        estimatedCompletion: this.calculateEstimatedCompletion(
          s.remaining, 
          s.successful + s.failed
        )
      }));

      console.log(`Enviando mensaje ${contactIndex + 1}/${batch.contacts.length} del lote ${batch.batchNumber} a ${contact.name || contact.phone_number}`);

      const messageData: SendMessageRequest = {
        to: contact.phone_number,
        message: personalizedMessage,
        isBot: false
      };

      this.chatService.sendMessage(messageData).subscribe({
        next: (response: any) => {
          if (response.success) {
            this.bulkState.update((s: any) => ({
              ...s,
              successful: s.successful + 1,
              remaining: s.remaining - 1
            }));
            this.incrementQuotaUsage();
            
            // Asignar etiqueta automáticamente si está habilitado
            if (this.autoTaggingEnabled()) {
              this.assignTagToContact(contact);
            }
          } else {
            // Manejar error de respuesta (no exitosa)
            this.handleSendingError(contact, null, response);
            
            // Verificar si debe pausar por errores críticos
            if (this.shouldPauseForErrors()) {
              return; // El método handleSendingError ya pausó si es necesario
            }
          }
        },
        error: (error: any) => {
          // Manejar error de red/conexión
          this.handleSendingError(contact, error);
          
          // Verificar si debe pausar por errores críticos
          if (this.shouldPauseForErrors()) {
            return; // El método handleSendingError ya pausó si es necesario
          }
        },
        complete: () => {
          contactIndex++;
          this.saveBulkState();

          // Esperar antes del siguiente mensaje
          const messageDelay = this.bulkConfig().messageDelay;
          this.bulkSendingTimer = setTimeout(() => {
            sendToNextContact();
          }, messageDelay);
        }
      });
    };

    // Iniciar envío del primer contacto
    sendToNextContact();
  }

  /**
   * Completar envío masivo
   */
  private completeBulkSending(): void {
    const state = this.bulkState();
    
    this.isSending.set(false);
    
    // Actualizar estado final
    this.bulkState.update((s: any) => ({
      ...s,
      isActive: false,
      canResume: false,
      estimatedCompletion: new Date()
    }));

    // Limpiar estado guardado
    localStorage.removeItem('bulk_sending_state');

    // Mostrar resultado final
    let message = '';
    if (state.failed === 0) {
      message = `✅ Envío completado: ${state.successful} mensajes enviados exitosamente`;
    } else {
      message = `⚠️ Envío completado: ${state.successful} exitosos, ${state.failed} fallaron`;
    }

    // Agregar información de etiquetas si está habilitado
    if (this.autoTaggingEnabled() && this.selectedAutoTag() && state.tagsAssigned > 0) {
      message += `. 🏷️ ${state.tagsAssigned} etiquetas "${this.selectedAutoTag()!.name}" asignadas`;
    }

    if (state.failed === 0) {
      this.successMessage.set(message);
    } else {
      this.errorMessage.set(message);
    }

    console.log('Envío masivo completado:', {
      successful: state.successful,
      failed: state.failed,
      errors: state.errors
    });

    this.clearMessagesAfterDelay();
  }

  /**
   * Pausar envío masivo
   */
  pauseBulkSending(): void {
    this.bulkState.update((s: any) => ({
      ...s,
      isPaused: true,
      canResume: true
    }));

    if (this.bulkSendingTimer) {
      clearTimeout(this.bulkSendingTimer);
    }

    this.isSending.set(false);
    this.saveBulkState();
    
    console.log('Envío masivo pausado');
  }

  /**
   * Reanudar envío masivo
   */
  resumeBulkSending(): void {
    const state = this.bulkState();
    
    if (!state.canResume) {
      this.errorMessage.set('No hay envío para reanudar');
      return;
    }

    // Verificar cuotas antes de reanudar
    const quotaCheck = this.canSendMore();
    if (!quotaCheck.canSend) {
      this.errorMessage.set(quotaCheck.reason || 'No se puede reanudar: límite alcanzado');
      return;
    }

    this.bulkState.update((s: any) => ({
      ...s,
      isPaused: false
    }));

    this.isSending.set(true);
    this.clearMessages();

    // Recrear lotes desde el estado actual
    const selectedPhones = Array.from(this.selectedContacts());
    const selectedContactsData = this.allContacts().filter((contact: any) =>
      selectedPhones.includes(contact.phone_number)
    );

    const batches = this.createBatches(selectedContactsData);
    
    console.log('Reanudando envío masivo desde lote', state.currentBatch + 1);
    this.processBatches(batches, selectedContactsData);
  }

  /**
   * Cancelar envío masivo
   */
  cancelBulkSending(): void {
    if (this.bulkSendingTimer) {
      clearTimeout(this.bulkSendingTimer);
    }

    this.bulkState.set({
      isActive: false,
      isPaused: false,
      currentBatch: 0,
      totalBatches: 0,
      currentInBatch: 0,
      totalInBatch: 0,
      successful: 0,
      failed: 0,
      remaining: 0,
      errors: [],
      errorsByType: {
        invalidNumber: 0,
        networkError: 0,
        rateLimited: 0,
        blocked: 0,
        other: 0
      },
      skippedContacts: [],
      tagsAssigned: 0,
      startTime: null,
      estimatedCompletion: null,
      canResume: false
    });

    this.isSending.set(false);
    localStorage.removeItem('bulk_sending_state');
    
    this.successMessage.set('Envío masivo cancelado');
    this.clearMessagesAfterDelay();
    
    console.log('Envío masivo cancelado');
  }

  /**
   * Verificar si se puede enviar (versión mejorada)
   */
  canSendEnhanced(): boolean {
    const messageType = this.messageForm.value.messageType;

    if (!this.isSending() && this.selectedContacts().size > 0) {
      if (messageType === 'files') {
        return this.selectedFiles().length > 0;
      } else {
        return this.messageForm.valid && this.messageForm.value.message?.trim();
      }
    }

    return false;
  }

  // ============================================================================
  // NEW: FILES FUNCTIONALITY
  // ============================================================================

  /**
   * Mostrar/ocultar selector de archivos
   */
  toggleFileUpload(): void {
    this.showFileUpload.set(!this.showFileUpload());
  }

  /**
   * Manejar archivos seleccionados
   */
  onFilesSelected(files: ChatFile[]): void {
    this.selectedFiles.set(files);

    // Si hay archivos, cambiar el tipo de mensaje
    if (files.length > 0) {
      this.messageForm.patchValue({
        messageType: 'files'
      });
    }
  }

  /**
   * Eliminar archivo seleccionado
   */
  removeFile(index: number): void {
    const currentFiles = [...this.selectedFiles()];
    currentFiles.splice(index, 1);
    this.selectedFiles.set(currentFiles);

    // Si no quedan archivos, volver a texto
    if (currentFiles.length === 0) {
      this.messageForm.patchValue({
        messageType: 'text'
      });
    }
  }

  /**
   * Actualizar caption de archivo
   */
  onCaptionChange(data: { file: ChatFile; caption: string }): void {
    const files = this.selectedFiles().map((file: any) =>
      file === data.file ? { ...file, caption: data.caption } : file
    );
    this.selectedFiles.set(files);
  }

  /**
   * Verificar si hay archivos seleccionados
   */
  hasSelectedFiles(): boolean {
    return this.selectedFiles().length > 0;
  }

  /**
   * Limpiar archivos seleccionados
   */
  clearSelectedFiles(): void {
    this.selectedFiles.set([]);
    this.showFileUpload.set(false);

    if (this.messageForm.value.messageType === 'files') {
      this.messageForm.patchValue({
        messageType: 'text'
      });
    }
  }

  /**
   * Enviar archivos masivamente
   */
  sendBulkFiles(): void {
    if (!this.canSendEnhanced()) return;

    const selectedPhones = Array.from(this.selectedContacts());
    const selectedContactsData = this.allContacts().filter((contact: any) =>
      selectedPhones.includes(contact.phone_number)
    );

    if (selectedContactsData.length === 0) {
      this.errorMessage.set('No hay contactos seleccionados');
      return;
    }

    if (this.selectedFiles().length === 0) {
      this.errorMessage.set('No hay archivos seleccionados');
      return;
    }

    this.isSending.set(true);
    this.clearMessages();
    this.sendProgress.set({ current: 0, total: selectedContactsData.length });

    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    // Enviar archivos secuencialmente
    const sendNext = (contactIndex: number) => {
      if (contactIndex >= selectedContactsData.length) {
        // Completado
        this.isSending.set(false);
        this.sendProgress.set({ current: selectedContactsData.length, total: selectedContactsData.length });

        if (failed === 0) {
          this.successMessage.set(`Archivos enviados exitosamente a ${successful} contactos`);
        } else {
          this.errorMessage.set(`${successful} enviados, ${failed} fallaron`);
        }

        this.clearMessagesAfterDelay();
        return;
      }

      const contact = selectedContactsData[contactIndex];

      this.sendProgress.set({
        current: contactIndex + 1,
        total: selectedContactsData.length,
        conversation: contact.name || contact.phone_number
      });

      // Enviar cada archivo del contacto actual
      this.sendFilesToContact(contact, 0, () => {
        successful++;
        setTimeout(() => sendNext(contactIndex + 1), 500);
      }, (error: string) => {
        failed++;
        errors.push(`${contact.name || contact.phone_number}: ${error}`);
        setTimeout(() => sendNext(contactIndex + 1), 500);
      });
    };

    sendNext(0);
  }

  /**
   * Enviar archivos a un contacto específico
   */
  private sendFilesToContact(
    contact: Contact,
    fileIndex: number,
    onSuccess: () => void,
    onError: (error: string) => void
  ): void {
    const files = this.selectedFiles();

    if (fileIndex >= files.length) {
      onSuccess();
      return;
    }

    const file = files[fileIndex];
    const isImage = file.type.startsWith('image/');
    const isDocument = !isImage;

    if (isImage) {
      const imageData: SendImageRequest = {
        to: contact.phone_number,
        image: file.file
      };

      this.chatService.sendImage(imageData).subscribe({
        next: (response: any) => {
          if (response.success) {
            // Continuar con el siguiente archivo
            this.sendFilesToContact(contact, fileIndex + 1, onSuccess, onError);
          } else {
            onError(`Error enviando imagen: ${response.message}`);
          }
        },
        error: (error: any) => {
          onError(`Error enviando imagen: ${error.message}`);
        }
      });
    } else if (isDocument) {
      const documentData: SendDocumentRequest = {
        to: contact.phone_number,
        document: file.file
      };

      this.chatService.sendDocument(documentData).subscribe({
        next: (response: any) => {
          if (response.success) {
            // Continuar con el siguiente archivo
            this.sendFilesToContact(contact, fileIndex + 1, onSuccess, onError);
          } else {
            onError(`Error enviando documento: ${response.message}`);
          }
        },
        error: (error: any) => {
          onError(`Error enviando documento: ${error.message}`);
        }
      });
    }
  }

  /**
   * Limpiar mensajes
   */
  private clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  /**
   * Limpiar mensajes después de un delay
   */
  private clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.clearMessages();
    }, APP_CONFIG.ui.toastDuration);
  }

  // ============================================================================
  // NEW: BULK SENDING UTILITY METHODS
  // ============================================================================

  /**
   * Obtener información del estado actual de envío
   */
  getBulkSendingInfo(): string {
    const state = this.bulkState();
    const quota = this.quotaUsage();

    if (state.isActive) {
      return `Enviando lote ${state.currentBatch + 1}/${state.totalBatches} - ${state.successful} enviados, ${state.failed} fallaron`;
    }

    if (state.canResume) {
      return `Envío pausado - ${state.successful} enviados, ${state.remaining} pendientes`;
    }

    return `Cuota: ${quota.hourly.used}/${quota.hourly.limit} por hora, ${quota.daily.used}/${quota.daily.limit} por día`;
  }

  /**
   * Obtener progreso como porcentaje
   */
  getBulkProgress(): number {
    const state = this.bulkState();
    if (state.remaining === 0) return 100;
    
    const total = state.successful + state.failed + state.remaining;
    const completed = state.successful + state.failed;
    
    return Math.round((completed / total) * 100);
  }

  /**
   * Verificar si hay un envío activo o pausado
   */
  hasBulkSendingInProgress(): boolean {
    const state = this.bulkState();
    return state.isActive || state.canResume;
  }

  /**
   * Obtener tiempo restante estimado
   */
  getEstimatedTimeRemaining(): string {
    const state = this.bulkState();
    
    if (!state.estimatedCompletion || !state.startTime) {
      return 'Calculando...';
    }

    const now = new Date();
    const remaining = state.estimatedCompletion.getTime() - now.getTime();
    
    if (remaining <= 0) {
      return 'Finalizando...';
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Configurar límites de envío
   */
  updateBulkConfig(config: Partial<BulkSendingConfig>): void {
    this.bulkConfig.update((current: any) => ({
      ...current,
      ...config
    }));

    // Actualizar límites en cuotas
    this.quotaUsage.update((quota: any) => ({
      ...quota,
      hourly: { ...quota.hourly, limit: config.hourlyLimit || quota.hourly.limit },
      daily: { ...quota.daily, limit: config.dailyLimit || quota.daily.limit }
    }));

    console.log('Configuración de envío masivo actualizada:', this.bulkConfig());
  }

  /**
   * Obtener tiempo estimado de envío en minutos
   */
  getEstimatedSendingTime(): number {
    const contacts = this.selectedContacts().size;
    if (contacts === 0) return 0;
    
    const config = this.bulkConfig();
    const batches = Math.ceil(contacts / config.batchSize);
    
    // Tiempo por mensaje + tiempo entre lotes
    const timePerMessage = config.messageDelay / 1000; // convertir a segundos
    const timeBetweenBatches = config.batchDelay / 1000; // convertir a segundos
    
    const totalTimeSeconds = (contacts * timePerMessage) + ((batches - 1) * timeBetweenBatches);
    
    return Math.ceil(totalTimeSeconds / 60); // convertir a minutos
  }

  /**
   * Obtener número estimado de lotes
   */
  getEstimatedBatches(): number {
    const contacts = this.selectedContacts().size;
    if (contacts === 0) return 0;
    
    return Math.ceil(contacts / this.bulkConfig().batchSize);
  }

  /**
   * Obtener resumen de errores por tipo
   */
  getErrorSummary(): string {
    const errors = this.bulkState().errorsByType;
    const parts: string[] = [];

    if (errors.invalidNumber > 0) {
      parts.push(`${errors.invalidNumber} números inválidos`);
    }
    if (errors.rateLimited > 0) {
      parts.push(`${errors.rateLimited} límites de velocidad`);
    }
    if (errors.blocked > 0) {
      parts.push(`${errors.blocked} bloqueos`);
    }
    if (errors.networkError > 0) {
      parts.push(`${errors.networkError} errores de red`);
    }
    if (errors.other > 0) {
      parts.push(`${errors.other} otros errores`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Sin errores específicos';
  }

  /**
   * Verificar si hay errores críticos
   */
  hasCriticalErrors(): boolean {
    const errors = this.bulkState().errorsByType;
    return errors.blocked > 0 || errors.rateLimited > 0;
  }

  /**
   * Obtener recomendación basada en errores
   */
  getErrorRecommendation(): string {
    const errors = this.bulkState().errorsByType;

    if (errors.blocked > 0) {
      return '⚠️ Cuenta posiblemente bloqueada. Contactar soporte de WhatsApp.';
    }

    if (errors.rateLimited > 0) {
      return '🐌 Muchos límites de velocidad. Usar configuración "Muy Seguro".';
    }

    if (errors.invalidNumber > 5) {
      return '📱 Muchos números inválidos. Revisar base de datos de contactos.';
    }

    if (errors.networkError > 3) {
      return '🌐 Problemas de conexión. Verificar internet y reanudar.';
    }

    return '✅ Sin problemas críticos detectados.';
  }

  // ============================================================================
  // ADVANCED CONFIGURATION METHODS
  // ============================================================================

  /**
   * Toggle the visibility of advanced configuration panel
   */
  toggleAdvancedConfig(): void {
    this.showAdvancedConfig.update(show => !show);
  }

}