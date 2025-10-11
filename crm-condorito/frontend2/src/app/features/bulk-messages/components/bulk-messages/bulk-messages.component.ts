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

  // Subscriptions
  private websocketSubscription?: Subscription;
  private bulkProgressSubscription?: Subscription;

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
  }

  ngOnDestroy(): void {
    this.websocketSubscription?.unsubscribe();
    this.bulkProgressSubscription?.unsubscribe();
    
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
      next: (response) => {
        if (response.success) {
          this.conversations.set(response.conversations);
        } else {
          this.errorMessage.set('Error al cargar conversaciones');
        }
      },
      error: (error) => {
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
  loadContacts(): void {
    this.contactsService.getContacts({ limit: 1000 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.allContacts.set(response.data);
          this.filteredContacts.set(response.data);
        }
      },
      error: (error) => {
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
      next: (response) => {
        if (response.success) {
          this.availableTags.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error loading tags:', error);
      }
    });
  }

  /**
   * Cargar templates disponibles
   */
  loadTemplates(): void {
    this.templatesService.getTemplates({ is_active: true, limit: 100 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.availableTemplates.set(response.templates);
        }
      },
      error: (error) => {
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
      const tagIds = selectedTags.map(tag => tag.id);
      filtered = filtered.filter(contact => 
        contact.tags && contact.tags.some(tag => tagIds.includes(tag.id))
      );
    }
    
    // Filtrar por búsqueda
    const searchTerm = this.filterForm.value.search?.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(contact => 
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
    const allPhones = this.filteredContacts().map(contact => contact.phone_number);
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
  // NEW: ENHANCED BULK SENDING
  // ============================================================================

  /**
   * Enviar mensajes masivos mejorado
   */
  sendBulkMessagesEnhanced(): void {
    const messageType = this.messageForm.value.messageType;
    
    if (messageType === 'files') {
      this.sendBulkFiles();
      return;
    }

    if (!this.canSendEnhanced()) return;

    const selectedPhones = Array.from(this.selectedContacts());
    const selectedContactsData = this.allContacts().filter(contact => 
      selectedPhones.includes(contact.phone_number)
    );
    
    if (selectedContactsData.length === 0) {
      this.errorMessage.set('No hay contactos seleccionados');
      return;
    }

    this.isSending.set(true);
    this.clearMessages();
    this.sendProgress.set({ current: 0, total: selectedContactsData.length });

    const baseMessage = this.messageForm.value.message;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    // Enviar mensajes secuencialmente
    const sendNext = (index: number) => {
      if (index >= selectedContactsData.length) {
        // Completado
        this.isSending.set(false);
        this.sendProgress.set({ current: selectedContactsData.length, total: selectedContactsData.length });
        
        if (failed === 0) {
          this.successMessage.set(`Mensajes enviados exitosamente a ${successful} contactos`);
        } else {
          this.errorMessage.set(`${successful} enviados, ${failed} fallaron`);
        }
        
        this.clearMessagesAfterDelay();
        return;
      }

      const contact = selectedContactsData[index];
      const personalizedMessage = this.processMessageForContact(baseMessage, contact);
      
      this.sendProgress.set({ 
        current: index + 1, 
        total: selectedContactsData.length,
        conversation: contact.name || contact.phone_number
      });

      const messageData: SendMessageRequest = {
        to: contact.phone_number,
        message: personalizedMessage,
        isBot: false
      };

      this.chatService.sendMessage(messageData).subscribe({
        next: (response) => {
          if (response.success) {
            successful++;
          } else {
            failed++;
            errors.push(`${contact.name || contact.phone_number}: ${response.message}`);
          }
        },
        error: (error) => {
          failed++;
          errors.push(`${contact.name || contact.phone_number}: ${error.message}`);
        },
        complete: () => {
          // Pequeña pausa entre mensajes para no sobrecargar
          setTimeout(() => sendNext(index + 1), 500);
        }
      });
    };

    sendNext(0);
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
    const files = this.selectedFiles().map(file => 
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
    const selectedContactsData = this.allContacts().filter(contact => 
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
        next: (response) => {
          if (response.success) {
            // Continuar con el siguiente archivo
            this.sendFilesToContact(contact, fileIndex + 1, onSuccess, onError);
          } else {
            onError(`Error enviando imagen: ${response.message}`);
          }
        },
        error: (error) => {
          onError(`Error enviando imagen: ${error.message}`);
        }
      });
    } else if (isDocument) {
      const documentData: SendDocumentRequest = {
        to: contact.phone_number,
        document: file.file
      };

      this.chatService.sendDocument(documentData).subscribe({
        next: (response) => {
          if (response.success) {
            // Continuar con el siguiente archivo
            this.sendFilesToContact(contact, fileIndex + 1, onSuccess, onError);
          } else {
            onError(`Error enviando documento: ${response.message}`);
          }
        },
        error: (error) => {
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

}