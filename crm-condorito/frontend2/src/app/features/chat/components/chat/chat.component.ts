import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../../auth/services/auth.service';
import { DebounceService } from '../../../../core/services/debounce.service';
import { WhatsAppRealtimeService, WebSocketConnectionState } from '../../../../core/services/websocket.service';
import { FileUploadComponent } from '../../../../shared/components/file-upload/file-upload.component';
import { FilePreviewComponent } from '../../../../shared/components/file-preview/file-preview.component';
import { TagSelectorComponent } from '../../../../shared/components/tag-selector/tag-selector.component';
import { MediaUrlPipe } from '../../../../shared/pipes/media-url.pipe';
import { 
  Conversation, 
  Message, 
  User, 
  SendMessageRequest,
  SendImageRequest,
  SendDocumentRequest,
  ChatFile 
} from '../../../../core/models/api.models';
import { ContactsService } from '../../../contacts/services/contacts.service';
import { ContactTag, Contact } from '../../../contacts/models/contact.models';
import { APP_CONFIG } from '../../../../core/config/app.config';
import { TemplatesService } from '../../../templates/services/templates.service';
import { MessageTemplate } from '../../../../core/models/template.models';

/**
 * Componente principal del Chat
 * Maneja la lista de conversaciones y el chat activo
 */
@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FileUploadComponent, FilePreviewComponent, TagSelectorComponent, MediaUrlPipe],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private debounceService = inject(DebounceService);
  private whatsappRealtimeService = inject(WhatsAppRealtimeService);
  private contactsService = inject(ContactsService);
  private templatesService = inject(TemplatesService);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // Signals
  public isLoading = signal<boolean>(true);
  public isLoadingMessages = signal<boolean>(false);
  public isSendingMessage = signal<boolean>(false);
  public conversations = signal<Conversation[]>([]);
  public filteredConversations = signal<Conversation[]>([]);
  public messages = signal<Message[]>([]);
  public activeConversation = signal<Conversation | null>(null);
  public currentUser = signal<User | null>(null);
  public searchQuery = signal<string>('');
  public errorMessage = signal<string>('');
  public successMessage = signal<string>('');
  
  // File handling signals
  public selectedFiles = signal<ChatFile[]>([]);
  public showFileUpload = signal<boolean>(false);
  public isSendingFile = signal<boolean>(false);
  public isGeneratingAI = signal<boolean>(false);

  // WebSocket signals
  public connectionState = signal<WebSocketConnectionState>(WebSocketConnectionState.DISCONNECTED);
  public isConnectedToWebSocket = signal<boolean>(false);

  // Contact and Tags functionality
  public availableTags = signal<ContactTag[]>([]);
  public selectedTagFilter = signal<ContactTag | null>(null);
  public filteredPhoneNumbers = signal<string[]>([]);

  // Templates functionality
  public showTemplateModal = signal<boolean>(false);
  public showVariablesModal = signal<boolean>(false);
  public isLoadingTemplates = signal<boolean>(false);
  public availableTemplates = signal<MessageTemplate[]>([]);
  public filteredTemplates = signal<MessageTemplate[]>([]);
  public selectedTemplate = signal<MessageTemplate | null>(null);
  public templateVariables = signal<string[]>([]);
  public templatePreview = signal<string>('');
  public templateSearchQuery = '';
  public templateVariablesForm: FormGroup = this.formBuilder.group({});

  // Números de teléfono que coinciden con el filtro de etiquetas
  public isTagFilterExpanded = signal<boolean>(false); // Controla si la sección de filtros está expandida
  public conversationTags = signal<Map<string, ContactTag[]>>(new Map()); // Cache de etiquetas por conversación
  public showContactMenu = signal<string | null>(null); // phone number of conversation with open menu
  public showTagModal = signal<boolean>(false);
  public showDescriptionModal = signal<boolean>(false);
  public showEditContactNameModal = signal<boolean>(false);
  public showDeleteConfirmModal = signal<boolean>(false);
  public currentContactForAction = signal<Conversation | null>(null);
  public currentContact = signal<Contact | null>(null);
  
  // Image modal signals
  public showImageModal = signal<boolean>(false);
  public selectedImageMessage = signal<Message | null>(null);

  // Mobile responsive signals
  public isMobile = signal<boolean>(false);
  public showSidebar = signal<boolean>(false);

  // Chat analysis signals
  public showChatAnalysisModal = signal<boolean>(false);
  public currentConversationForAnalysis = signal<Conversation | null>(null);
  public isAnalyzing = signal<boolean>(false);
  public analysisResult = signal<string>('');
  public analysisTimestamp = signal<Date | null>(null);

  // Expose enum to template
  public WebSocketConnectionState = WebSocketConnectionState;

  // Form
  public messageForm: FormGroup;
  public searchForm: FormGroup;
  public descriptionForm: FormGroup;
  public editContactNameForm: FormGroup;
  public analysisForm: FormGroup;

  // Subscriptions
  private refreshSubscription?: Subscription;
  private websocketSubscription?: Subscription;
  private messageSubscription?: Subscription;
  private conversationSubscription?: Subscription;
  
  // Debounced search
  private searchDebouncer = this.debounceService.createSearchDebouncer(
    (query: string) => this.chatService.searchConversations(query, {
      limit: APP_CONFIG.ui.itemsPerPage
    }),
    APP_CONFIG.ui.debounceTime
  );
  private searchSubscription?: Subscription;
  private shouldScrollToBottom = false;
  
  // Nuevas propiedades para gestión inteligente del scroll
  private isUserScrolledUp = false;
  private scrollThreshold = 100; // pixels desde el final para considerar "al final"
  public hasUnreadMessages = signal<boolean>(false);
  public unreadMessagesCount = signal<number>(0);
  public isAtBottom = signal<boolean>(true);

  constructor() {
    this.messageForm = this.formBuilder.group({
      message: ['', [Validators.required, Validators.minLength(1)]]
    });

    this.searchForm = this.formBuilder.group({
      search: ['']
    });

    this.descriptionForm = this.formBuilder.group({
      description: ['', [Validators.maxLength(500)]]
    });

    this.editContactNameForm = this.formBuilder.group({
      contactName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]]
    });

    this.analysisForm = this.formBuilder.group({
      customQuestion: ['', [Validators.required, Validators.minLength(10)]]
    });

    // Setup search with debounce
    this.searchSubscription = this.searchForm.get('search')?.valueChanges
      .pipe(
        debounceTime(APP_CONFIG.ui.debounceTime),
        distinctUntilChanged()
      )
      .subscribe(query => {
        this.searchQuery.set(query);
        this.applyFilters(); // Usar filtros locales en lugar de llamada al servidor
      });
  }

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    this.loadConversations();
    this.loadAvailableTags();
    this.initializeWebSocket();
    this.startAutoRefresh();
    this.checkMobileView();
    this.setupResizeListener();
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    this.websocketSubscription?.unsubscribe();
    this.messageSubscription?.unsubscribe();
    this.conversationSubscription?.unsubscribe();

    // Cancelar operaciones de debounce
    this.searchDebouncer.cancel();
    

    // Desconectar WebSocket
    this.whatsappRealtimeService.disconnect();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      // Usar setTimeout para asegurar que el DOM esté completamente renderizado
      setTimeout(() => {
        this.scrollToBottom();
        this.shouldScrollToBottom = false;
      }, 100);
    }
  }

  /**
   * Cargar lista de conversaciones
   */
  loadConversations(): void {
    this.isLoading.set(true);
    this.clearMessages();

    this.chatService.getConversations({
      limit: APP_CONFIG.ui.itemsPerPage,
      offset: 0,
      archived: false
    }).subscribe({
      next: (response) => {
        if (response.success && response.conversations) {
          this.conversations.set(response.conversations);
          this.applyFilters(); // Aplicar filtros después de cargar
          this.loadConversationTags(); // Cargar etiquetas para las conversaciones
        }
      },
      error: (error) => {
        console.error('Error loading conversations:', error);
        this.errorMessage.set('Error al cargar las conversaciones');
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Buscar conversaciones (con debouncing)
   */
  searchConversations(query: string): void {
    if (!query.trim()) {
      this.loadConversations();
      return;
    }

    // Cancelar búsqueda anterior si existe
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }

    // Usar debounced search
    this.searchSubscription = this.searchDebouncer.search(query).subscribe({
      next: (response) => {
        if (response.success && response.conversations) {
          this.conversations.set(response.conversations);
        }
      },
      error: (error) => {
        console.error('Error searching conversations:', error);
        this.errorMessage.set('Error al buscar conversaciones');
      }
    });
  }

  /**
   * Seleccionar conversación activa
   */
  selectConversation(conversation: Conversation): void {
    this.activeConversation.set(conversation);
    
    // Resetear estados de scroll y mensajes no leídos
    this.hasUnreadMessages.set(false);
    this.unreadMessagesCount.set(0);
    this.isUserScrolledUp = false;
    this.isAtBottom.set(true);
    
    this.loadMessages(conversation.id);
    this.markAsRead(conversation.id);
    
    // Forzar scroll al final después de un delay (backup)
    setTimeout(() => {
      this.shouldScrollToBottom = true;
    }, 200);
  }

  /**
   * Cargar mensajes de la conversación activa (últimos 50 mensajes)
   * SIEMPRE carga desde servidor (sin caché) para obtener mensajes más recientes
   */
  loadMessages(conversationId: number): void {
    this.isLoadingMessages.set(true);
    this.messages.set([]);

    // Cargar últimos 50 mensajes sin caché
    this.chatService.getMessages(conversationId, {
      limit: 50,
      offset: 0,
      orderBy: 'sent_at',
      orderDirection: 'ASC' // Orden cronológico: más antiguos primero, más recientes al final
    }, false).subscribe({
      next: (response) => {
        if (response.success && response.messages) {
          console.log(`📨 Mensajes cargados para conversación ${conversationId}:`, response.messages.length);
          
          // Log específico para mensajes de imagen
          const imageMessages = response.messages.filter(m => m.message_type === 'image');
          if (imageMessages.length > 0) {
            console.log('🖼️ Mensajes de imagen encontrados:', imageMessages.map(m => ({
              id: m.id,
              media_url: m.media_url,
              file_name: m.file_name,
              message_type: m.message_type
            })));
          }
          
          // Los mensajes ya vienen en orden cronológico correcto (ASC)
          this.messages.set(response.messages);
          this.shouldScrollToBottom = true;
        }
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.errorMessage.set('Error al cargar los mensajes');
      },
      complete: () => {
        this.isLoadingMessages.set(false);
      }
    });
  }


  /**
   * Enviar mensaje
   */
  sendMessage(): void {
    if (this.messageForm.valid && !this.isSendingMessage() && this.activeConversation()) {
      const messageText = this.messageForm.value.message.trim();
      const conversation = this.activeConversation()!;

      this.isSendingMessage.set(true);
      this.clearMessages();

      const messageData: SendMessageRequest = {
        to: conversation.contact_phone,
        message: messageText,
        isBot: false
      };

      this.chatService.sendMessage(messageData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageForm.reset();
            // ✅ Sin mensaje de éxito molesto - el usuario ve el mensaje en el chat
            
            // NO recargar mensajes - el WebSocket se encargará de mostrar el nuevo mensaje
            // this.loadMessages(conversation.id); // ❌ ELIMINADO - causaba scroll jump
            
            // Actualizar la conversación en la lista
            this.updateConversationInList(conversation.id);
          } else {
            this.errorMessage.set('Error al enviar el mensaje');
          }
        },
        error: (error) => {
          console.error('Error sending message:', error);
          this.errorMessage.set('Error al enviar el mensaje: ' + error.message);
        },
        complete: () => {
          this.isSendingMessage.set(false);
        }
      });
    }
  }

  /**
   * Marcar conversación como leída
   */
  markAsRead(conversationId: number): void {
    this.chatService.markConversationAsRead(conversationId).subscribe({
      next: () => {
        // Actualizar el contador de no leídos en la lista
        this.updateConversationInList(conversationId);
      },
      error: (error) => {
        console.error('Error marking as read:', error);
      }
    });
  }

  /**
   * Actualizar conversación en la lista
   */
  private updateConversationInList(conversationId: number): void {
    const conversations = this.conversations();
    const updatedConversations = conversations.map(conv => 
      conv.id === conversationId 
        ? { ...conv, unread_count: 0, last_message_at: new Date().toISOString() }
        : conv
    );
    this.conversations.set(updatedConversations);
  }

  /**
   * Marcar conversación como leída
   */
  markConversationAsRead(conversationId: number): void {
    this.chatService.markConversationAsRead(conversationId).subscribe({
      next: (response) => {
        if (response.success) {
          // Actualizar el contador de no leídos en la conversación activa
          const currentConversations = this.conversations();
          const updatedConversations = currentConversations.map(conv =>
            conv.id === conversationId ? { ...conv, unread_count: 0, unread_messages: '0' } : conv
          );
          this.conversations.set(updatedConversations);

          // Actualizar la conversación activa si es la misma
          if (this.activeConversation()?.id === conversationId) {
            this.activeConversation.update(conv => conv ? { ...conv, unread_count: 0, unread_messages: '0' } : null);
          }
        }
      },
      error: (error) => {
        console.error('Error marking conversation as read:', error);
      }
    });
  }

  /**
   * Alternar bot para conversación activa
   */
  toggleBotForActiveConversation(): void {
    const conversation = this.activeConversation();
    if (!conversation) return;

    const action = this.isBotEnabled(conversation)
      ? this.chatService.disableBotForConversation(conversation.id)
      : this.chatService.enableBotForConversation(conversation.id);

    action.subscribe({
      next: (response) => {
        if (response.success) {
          // Actualizar el estado del bot en la conversación activa
          const updatedConversation = { 
            ...conversation, 
            bot_enabled: this.isBotEnabled(conversation) ? 0 : 1
          };
          this.activeConversation.set(updatedConversation);
          
          // Actualizar también en la lista
          const conversations = this.conversations();
          const updatedConversations = conversations.map(conv => 
            conv.id === conversation.id ? updatedConversation : conv
          );
          this.conversations.set(updatedConversations);

          const status = this.isBotEnabled(conversation) ? 'desactivado' : 'activado';
          this.successMessage.set(`Bot ${status} para esta conversación`);
        }
      },
      error: (error) => {
        console.error('Error toggling bot:', error);
        this.errorMessage.set('Error al cambiar el estado del bot');
      },
      complete: () => {
        this.clearMessagesAfterDelay();
      }
    });
  }

  /**
   * Iniciar auto-refresh cada 10 segundos (SOLO como fallback si WebSocket falla)
   */
  private startAutoRefresh(): void {
    this.refreshSubscription = interval(10000).subscribe(() => {
      // Solo usar polling como fallback si WebSocket no está conectado
      if (!this.isConnectedToWebSocket() && !this.isSendingMessage()) {
        console.log('🔄 WebSocket desconectado, usando polling como fallback para chat');
        this.refreshActiveConversation();
      }
    });
  }

  /**
   * Refrescar conversación activa
   */
  private refreshActiveConversation(): void {
    const activeConv = this.activeConversation();
    if (activeConv) {
      this.loadMessages(activeConv.id);
    }
  }

  /**
   * Verificar si el usuario está cerca del final del scroll
   */
  private shouldAutoScroll(): boolean {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return true;
    
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= this.scrollThreshold;
  }

  /**
   * Actualizar el estado de scroll y mensajes no leídos
   */
  private updateScrollState(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;
    
    const isAtBottom = this.shouldAutoScroll();
    this.isAtBottom.set(isAtBottom);
    this.isUserScrolledUp = !isAtBottom;
    
    // Si el usuario vuelve al final, marcar mensajes como leídos
    if (isAtBottom && this.hasUnreadMessages()) {
      this.hasUnreadMessages.set(false);
      this.unreadMessagesCount.set(0);
    }
  }

  /**
   * Scroll suave al final de los mensajes
   */
  private smoothScrollToBottom(force: boolean = false): void {
    if (!force && !this.shouldAutoScroll()) {
      return;
    }
    
    requestAnimationFrame(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
        
        // Actualizar estado después del scroll
        setTimeout(() => {
          this.updateScrollState();
        }, 300);
      }
    });
  }

  /**
   * Scroll al final de los mensajes (método original mejorado)
   */
  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        
        // Usar setTimeout para asegurar que el DOM se haya renderizado
        setTimeout(() => {
          element.scrollTo({
            top: element.scrollHeight,
            behavior: 'smooth'
          });
          console.log(`📍 Scroll automático al final - scrollTop: ${element.scrollTop}, scrollHeight: ${element.scrollHeight}`);
          
          // Actualizar estado después del scroll
          setTimeout(() => {
            this.updateScrollState();
          }, 300);
        }, 50);
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  /**
   * Forzar scroll al final (para botón de nuevos mensajes)
   */
  public scrollToBottomForced(): void {
    this.smoothScrollToBottom(true);
    this.hasUnreadMessages.set(false);
    this.unreadMessagesCount.set(0);
  }

  /**
   * Listener para el scroll del contenedor de mensajes
   */
  public onMessagesScroll(): void {
    this.updateScrollState();
  }

  /**
   * Ir al dashboard
   */
  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Cerrar sesión
   */
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        console.log('✅ Logout successful');
      },
      error: (error) => {
        console.error('❌ Logout error:', error);
        this.authService.logoutImmediate();
      }
    });
  }

  /**
   * Formatear fecha para mostrar
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
  }

  /**
   * Obtener iniciales del contacto
   */
  getContactInitials(conversation: Conversation): string {
    const name = conversation.contact_name || conversation.contact_phone;
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Verificar si el mensaje es del usuario actual
   */
  isMyMessage(message: Message): boolean {
    return message.from_me === 1 || message.sender_type === 'client';
  }

  /**
   * Verificar si el bot está activado para una conversación
   */
  isBotEnabled(conversation: Conversation): boolean {
    return conversation.bot_enabled === 1;
  }

  /**
   * Obtener icono para tipo de mensaje
   */
  getMessageTypeIcon(messageType: string): string {
    const iconMap: { [key: string]: string } = {
      'image': 'fa-image',
      'document': 'fa-file',
      'audio': 'fa-microphone',
      'video': 'fa-video'
    };
    return iconMap[messageType] || 'fa-file';
  }

  /**
   * Limpiar mensajes
   */
  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  /**
   * Manejar tecla Enter en el textarea
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      this.sendMessageOrFiles();
    }
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
  // FILE HANDLING METHODS
  // ============================================================================

  /**
   * Mostrar/ocultar área de upload de archivos
   */
  toggleFileUpload(): void {
    this.showFileUpload.set(!this.showFileUpload());
    if (!this.showFileUpload()) {
      this.clearSelectedFiles();
    }
  }

  /**
   * Manejar archivo seleccionado
   */
  onFileSelected(file: ChatFile): void {
    const files = this.selectedFiles();
    this.selectedFiles.set([...files, file]);
    this.showFileUpload.set(false);
  }

  /**
   * Manejar múltiples archivos seleccionados
   */
  onFilesSelected(files: ChatFile[]): void {
    const existingFiles = this.selectedFiles();
    this.selectedFiles.set([...existingFiles, ...files]);
    this.showFileUpload.set(false);
  }

  /**
   * Manejar error de archivo
   */
  onFileError(error: string): void {
    this.errorMessage.set(error);
    this.clearMessagesAfterDelay();
  }

  /**
   * Remover archivo seleccionado
   */
  removeSelectedFile(file: ChatFile): void {
    const files = this.selectedFiles();
    const updatedFiles = files.filter(f => f !== file);
    this.selectedFiles.set(updatedFiles);
  }

  /**
   * Limpiar archivos seleccionados
   */
  clearSelectedFiles(): void {
    this.selectedFiles.set([]);
  }

  /**
   * Manejar cambio de caption
   */
  onCaptionChange(data: { file: ChatFile; caption: string }): void {
    const files = this.selectedFiles();
    const updatedFiles = files.map(f => 
      f === data.file ? { ...f, caption: data.caption } : f
    );
    this.selectedFiles.set(updatedFiles);
  }

  /**
   * Enviar archivos seleccionados
   */
  sendSelectedFiles(): void {
    const files = this.selectedFiles();
    const conversation = this.activeConversation();

    if (files.length === 0 || !conversation) return;

    this.isSendingFile.set(true);
    this.clearMessages();

    // Enviar archivos uno por uno
    this.sendFilesSequentially(files, conversation, 0);
  }

  /**
   * Enviar archivos secuencialmente
   */
  private sendFilesSequentially(files: ChatFile[], conversation: Conversation, index: number): void {
    if (index >= files.length) {
      // Todos los archivos enviados
      this.isSendingFile.set(false);
      this.clearSelectedFiles();
      // ✅ Sin mensaje de éxito molesto - el usuario ve los archivos en el chat
      
      // NO recargar mensajes - el WebSocket se encargará de mostrar los nuevos mensajes
      // this.loadMessages(conversation.id); // ❌ ELIMINADO - causaba scroll jump
      this.updateConversationInList(conversation.id);
      return;
    }

    const file = files[index];
    const phone = conversation.contact_phone;

    if (file.type === 'image') {
      const imageData: SendImageRequest = {
        to: phone,
        image: file.file,
        caption: (file as any).caption || ''
      };

      this.chatService.sendImage(imageData).subscribe({
        next: (response) => {
          if (response.success) {
            // Continuar con el siguiente archivo
            this.sendFilesSequentially(files, conversation, index + 1);
          } else {
            this.handleFileSendError('Error al enviar imagen');
          }
        },
        error: (error) => {
          this.handleFileSendError('Error al enviar imagen: ' + error.message);
        }
      });
    } else {
      const documentData: SendDocumentRequest = {
        to: phone,
        document: file.file,
        filename: (file as any).caption || file.name
      };

      this.chatService.sendDocument(documentData).subscribe({
        next: (response) => {
          if (response.success) {
            // Continuar con el siguiente archivo
            this.sendFilesSequentially(files, conversation, index + 1);
          } else {
            this.handleFileSendError('Error al enviar documento');
          }
        },
        error: (error) => {
          this.handleFileSendError('Error al enviar documento: ' + error.message);
        }
      });
    }
  }

  /**
   * Manejar error al enviar archivo
   */
  private handleFileSendError(error: string): void {
    this.isSendingFile.set(false);
    this.errorMessage.set(error);
    this.clearMessagesAfterDelay();
  }

  /**
   * Verificar si hay archivos seleccionados
   */
  hasSelectedFiles(): boolean {
    return this.selectedFiles().length > 0;
  }

  /**
   * Verificar si se puede enviar (mensaje o archivos)
   */
  canSend(): boolean {
    const hasMessage = this.messageForm.valid && this.messageForm.value.message?.trim();
    const hasFiles = this.hasSelectedFiles();
    return (hasMessage || hasFiles) && !this.isSendingMessage() && !this.isSendingFile();
  }

  /**
   * Enviar mensaje o archivos
   */
  sendMessageOrFiles(): void {
    if (this.hasSelectedFiles()) {
      this.sendSelectedFiles();
    } else {
      this.sendMessage();
    }
  }


  // ============================================================================
  // WEBSOCKET METHODS
  // ============================================================================

  /**
   * Inicializar conexión WebSocket
   */
  private initializeWebSocket(): void {
    // Conectar al WebSocket
    this.websocketSubscription = this.whatsappRealtimeService.connect().subscribe({
      next: (state) => {
        this.connectionState.set(state);
        this.isConnectedToWebSocket.set(state === WebSocketConnectionState.CONNECTED);
        
        if (state === WebSocketConnectionState.CONNECTED) {
          console.log('✅ WebSocket conectado - Chat en tiempo real activo');
          this.subscribeToRealtimeEvents();
        } else if (state === WebSocketConnectionState.DISCONNECTED) {
          console.log('❌ WebSocket desconectado - Usando polling como fallback');
        }
      },
      error: (error) => {
        console.error('Error en WebSocket:', error);
        this.connectionState.set(WebSocketConnectionState.ERROR);
        this.isConnectedToWebSocket.set(false);
      }
    });
  }

  /**
   * Suscribirse a eventos en tiempo real
   */
  private subscribeToRealtimeEvents(): void {
    // Escuchar mensajes nuevos
    this.messageSubscription = this.whatsappRealtimeService.onMessage('new_message').subscribe({
      next: (data: any) => {
        console.log('📨 Nuevo mensaje recibido:', data);
        this.handleNewMessage(data);
      },
      error: (error: any) => {
        console.error('Error procesando mensaje nuevo:', error);
      }
    });

    // Escuchar actualizaciones de conversaciones
    this.conversationSubscription = this.whatsappRealtimeService.onMessage('conversation_updated').subscribe({
      next: (data: any) => {
        console.log('🔄 Conversación actualizada:', data);
        this.handleConversationUpdate(data);
      },
      error: (error: any) => {
        console.error('Error procesando actualización de conversación:', error);
      }
    });

    // Escuchar cambios de estado de mensajes (leído, entregado)
    this.whatsappRealtimeService.onMessage('message_status_updated').subscribe({
      next: (data: any) => {
        console.log('✅ Estado de mensaje actualizado:', data);
        this.handleMessageStatusUpdate(data);
      },
      error: (error: any) => {
        console.error('Error procesando actualización de estado:', error);
      }
    });

    // Escuchar eliminación de conversaciones
    this.whatsappRealtimeService.onMessage('conversation:deleted').subscribe({
      next: (data: any) => {
        console.log('🗑️ Conversación eliminada:', data);
        this.handleConversationDeleted(data);
      },
      error: (error: any) => {
        console.error('Error procesando eliminación de conversación:', error);
      }
    });
  }

  /**
   * Manejar nuevo mensaje recibido
   */
  private handleNewMessage(data: any): void {
    const newMessage: Message = data.message;
    const conversationId = newMessage.conversation_id;
    const isMyMessage = newMessage.sender_type === 'client';

    // Si es la conversación activa, agregar el mensaje
    if (this.activeConversation()?.id === conversationId) {
      const currentMessages = this.messages();
      this.messages.set([...currentMessages, newMessage]);
      
      // Lógica inteligente de scroll
      if (isMyMessage) {
        // Siempre hacer scroll para mensajes propios
        this.shouldScrollToBottom = true;
        this.smoothScrollToBottom(true);
      } else {
        // Para mensajes recibidos, solo hacer scroll si el usuario está al final
        if (this.shouldAutoScroll()) {
          this.shouldScrollToBottom = true;
          this.smoothScrollToBottom(true);
        } else {
          // Si el usuario está scrolleado hacia arriba, incrementar contador de no leídos
          this.unreadMessagesCount.update(count => count + 1);
          this.hasUnreadMessages.set(true);
        }
      }
      
      // Marcar como leído automáticamente si la conversación está activa y el usuario está al final
      if (this.shouldAutoScroll()) {
        this.markConversationAsRead(conversationId);
      }
    }

    // Actualizar la lista de conversaciones
    this.updateConversationFromWebSocket(data.conversation);
  }

  /**
   * Manejar actualización de conversación
   */
  private handleConversationUpdate(data: any): void {
    this.updateConversationFromWebSocket(data.conversation);
  }

  /**
   * Actualizar conversación desde WebSocket
   */
  private updateConversationFromWebSocket(updatedConversation: Conversation): void {
    const currentConversations = this.conversations();
    const updatedConversations = currentConversations.map(conv =>
      conv.id === updatedConversation.id ? updatedConversation : conv
    );

    // Si es una conversación nueva, agregarla al inicio
    if (!currentConversations.find(conv => conv.id === updatedConversation.id)) {
      updatedConversations.unshift(updatedConversation);
    }

    // Ordenar por último mensaje
    updatedConversations.sort((a, b) => 
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );

    this.conversations.set(updatedConversations);

    // CRÍTICO: Aplicar filtros para actualizar la lista filtrada en tiempo real
    this.applyFilters();

    // Actualizar conversación activa si es la misma
    if (this.activeConversation()?.id === updatedConversation.id) {
      this.activeConversation.set(updatedConversation);
    }
  }

  /**
   * Manejar actualización de estado de mensaje
   */
  private handleMessageStatusUpdate(data: any): void {
    const messageId = data.message_id;
    const newStatus = data.status;
    const conversationId = data.conversation_id;

    // Solo actualizar si es la conversación activa
    if (this.activeConversation()?.id === conversationId) {
      const currentMessages = this.messages();
      const updatedMessages = currentMessages.map(message => {
        if (message.message_id === messageId) {
          return {
            ...message,
            is_read: newStatus === 'read' ? 1 : message.is_read,
            read_at: newStatus === 'read' ? new Date().toISOString() : message.read_at,
            delivered_at: newStatus === 'delivered' ? new Date().toISOString() : message.delivered_at
          };
        }
        return message;
      });
      this.messages.set(updatedMessages);
    }
  }

  /**
   * Manejar eliminación de conversación
   */
  private handleConversationDeleted(data: any): void {
    const deletedConversationId = data.conversationId;
    
    console.log('🗑️ Procesando eliminación de conversación:', deletedConversationId);
    
    // Actualizar la lista de conversaciones
    const conversations = this.conversations();
    const updatedConversations = conversations.filter(conv => conv.id !== deletedConversationId);
    
    this.conversations.set(updatedConversations);
    this.applyFilters();
    
    // Si era la conversación activa, limpiar
    if (this.activeConversation()?.id === deletedConversationId) {
      this.activeConversation.set(null);
      this.messages.set([]);
      console.log('🧹 Conversación activa eliminada, limpiando vista');
    }
    
    // Mostrar mensaje informativo
    this.successMessage.set('Conversación eliminada');
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  /**
   * Obtener estado de conexión WebSocket para mostrar en UI
   */
  getConnectionStatusText(): string {
    switch (this.connectionState()) {
      case WebSocketConnectionState.CONNECTING:
        return 'Conectando...';
      case WebSocketConnectionState.CONNECTED:
        return 'Tiempo Real Activo';
      case WebSocketConnectionState.DISCONNECTED:
        return 'Desconectado';
      case WebSocketConnectionState.ERROR:
        return 'Error de Conexión';
      default:
        return 'Desconocido';
    }
  }

  /**
   * Obtener clase CSS para el estado de conexión
   */
  getConnectionStatusClass(): string {
    switch (this.connectionState()) {
      case WebSocketConnectionState.CONNECTING:
        return 'text-warning';
      case WebSocketConnectionState.CONNECTED:
        return 'text-success';
      case WebSocketConnectionState.DISCONNECTED:
        return 'text-secondary';
      case WebSocketConnectionState.ERROR:
        return 'text-danger';
      default:
        return 'text-muted';
    }
  }

  // ============================================================================
  // CONTACT AND TAGS METHODS
  // ============================================================================

  /**
   * Cargar etiquetas disponibles
   */
  loadAvailableTags(): void {
    this.contactsService.getTags().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.availableTags.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error loading tags:', error);
      }
    });
  }

  /**
   * Filtrar conversaciones por etiqueta
   */
  filterByTag(tag: ContactTag | null): void {
    this.selectedTagFilter.set(tag);
    
    if (tag) {
      // Cargar números de teléfono que tienen esta etiqueta
      this.contactsService.getContactsByTags([tag.id]).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.filteredPhoneNumbers.set(response.data.phoneNumbers);
            this.applyFilters();
          }
        },
        error: (error) => {
          console.error('Error loading contacts by tag:', error);
          this.filteredPhoneNumbers.set([]);
          this.applyFilters();
        }
      });
    } else {
      this.filteredPhoneNumbers.set([]);
      this.applyFilters();
    }
  }

  /**
   * Limpiar filtro de etiquetas
   */
  clearTagFilter(): void {
    this.selectedTagFilter.set(null);
    this.filteredPhoneNumbers.set([]);
    this.applyFilters();
  }

  /**
   * Limpiar búsqueda
   */
  clearSearch(): void {
    this.searchForm.get('search')?.setValue('');
    this.searchQuery.set('');
    this.applyFilters();
  }

  /**
   * Verificar si el texto de búsqueda es un número de teléfono válido
   */
  isValidPhoneNumber(query: string): boolean {
    if (!query || query.trim().length < 8) return false;
    
    // Limpiar el número de espacios, guiones, paréntesis, etc.
    const cleanQuery = query.replace(/[\s\-\(\)\+]/g, '');
    
    // Verificar que contenga solo números (y opcionalmente + al inicio)
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    return phoneRegex.test(cleanQuery);
  }

  /**
   * Obtener número limpio para crear conversación
   */
  getCleanPhoneNumber(query: string): string {
    let cleanNumber = query.replace(/[\s\-\(\)]/g, '');
    
    // Si no empieza con +, agregar +54 (Argentina) por defecto
    if (!cleanNumber.startsWith('+')) {
      // Si empieza con 54, agregar solo el +
      if (cleanNumber.startsWith('54')) {
        cleanNumber = '+' + cleanNumber;
      } else {
        // Si no, agregar +54
        cleanNumber = '+54' + cleanNumber;
      }
    }
    
    return cleanNumber;
  }

  /**
   * Verificar si un número ya existe en las conversaciones
   */
  phoneExistsInConversations(phoneNumber: string): boolean {
    const conversations = this.conversations();
    const cleanSearchPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    
    return conversations.some(conv => {
      const cleanConvPhone = conv.contact_phone.replace(/[\s\-\(\)\+]/g, '');
      return cleanConvPhone.includes(cleanSearchPhone) || cleanSearchPhone.includes(cleanConvPhone);
    });
  }

  /**
   * Crear nueva conversación con el número buscado
   */
  createNewConversation(): void {
    const query = this.searchQuery().trim();
    if (!this.isValidPhoneNumber(query)) return;
    
    const phoneNumber = this.getCleanPhoneNumber(query);
    
    // Crear conversación temporal
    const newConversation: Conversation = {
      id: 0, // Temporal
      client_id: 0, // Temporal
      contact_phone: phoneNumber,
      contact_name: undefined,
      last_message: null,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      is_archived: false,
      is_pinned: false,
      bot_enabled: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_messages: 0,
      unread_messages: '0'
    };
    
    // Seleccionar la conversación (esto creará la conversación en el backend cuando se envíe el primer mensaje)
    this.selectConversation(newConversation);
    
    // Limpiar búsqueda
    this.clearSearch();
    
    // Cerrar sidebar en móvil
    if (this.isMobile()) {
      this.closeSidebar();
    }
    
    // Mostrar mensaje informativo
    this.successMessage.set(`Nueva conversación iniciada con ${phoneNumber}`);
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  /**
   * Verificar si debemos mostrar la opción de crear nueva conversación
   */
  shouldShowCreateConversation(): boolean {
    const query = this.searchQuery().trim();
    
    // Debe ser un número válido
    if (!this.isValidPhoneNumber(query)) return false;
    
    // No debe existir ya en las conversaciones
    if (this.phoneExistsInConversations(query)) return false;
    
    // No debe haber resultados de búsqueda (o muy pocos)
    return this.filteredConversations().length === 0;
  }

  /**
   * Obtener el número formateado para mostrar en la UI
   */
  getFormattedPhoneForDisplay(): string {
    const query = this.searchQuery().trim();
    if (!this.isValidPhoneNumber(query)) return '';
    
    return this.getCleanPhoneNumber(query);
  }

  /**
   * Alternar expansión de la sección de filtros por etiquetas
   */
  toggleTagFilterSection(): void {
    this.isTagFilterExpanded.set(!this.isTagFilterExpanded());
  }

  /**
   * Cargar etiquetas para las conversaciones visibles
   */
  loadConversationTags(): void {
    const conversations = this.conversations();
    if (conversations.length === 0) return;

    // Obtener números de teléfono únicos
    const phoneNumbers = [...new Set(conversations.map(c => c.contact_phone))];
    
    // Cargar etiquetas para estos contactos
    this.contactsService.getContacts({ 
      search: '', 
      limit: phoneNumbers.length * 2 // Buffer para asegurar que encontremos todos
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const tagsMap = new Map<string, ContactTag[]>();
          
          // Crear mapa de teléfono -> etiquetas
          response.data.forEach(contact => {
            if (phoneNumbers.includes(contact.phone_number)) {
              tagsMap.set(contact.phone_number, contact.tags || []);
            }
          });
          
          this.conversationTags.set(tagsMap);
        }
      },
      error: (error) => {
        console.error('Error loading conversation tags:', error);
      }
    });
  }

  /**
   * Obtener etiquetas para una conversación específica
   */
  getTagsForConversation(phoneNumber: string): ContactTag[] {
    return this.conversationTags().get(phoneNumber) || [];
  }

  /**
   * Aplicar filtros a las conversaciones
   */
  private applyFilters(): void {
    const allConversations = this.conversations();
    const selectedTag = this.selectedTagFilter();
    const searchQuery = this.searchQuery().toLowerCase().trim();
    const tagFilteredPhones = this.filteredPhoneNumbers();

    let filtered = allConversations;

    // Filtrar por etiqueta si hay una seleccionada
    if (selectedTag && tagFilteredPhones.length > 0) {
      filtered = filtered.filter(conversation => {
        return tagFilteredPhones.includes(conversation.contact_phone);
      });
    }

    // Filtrar por búsqueda si hay una query
    if (searchQuery) {
      filtered = filtered.filter(conversation => {
        // Búsqueda en nombre del contacto
        const nameMatch = conversation.contact_name?.toLowerCase().includes(searchQuery) || false;
        
        // Búsqueda en número de teléfono (sin espacios ni caracteres especiales)
        const cleanPhone = conversation.contact_phone.replace(/[\s\-\(\)\+]/g, '');
        const cleanQuery = searchQuery.replace(/[\s\-\(\)\+]/g, '');
        const phoneMatch = cleanPhone.includes(cleanQuery);
        
        // Búsqueda en el último mensaje
        const lastMessageMatch = conversation.last_message?.toLowerCase().includes(searchQuery) || false;
        
        return nameMatch || phoneMatch || lastMessageMatch;
      });
    }

    this.filteredConversations.set(filtered);
  }

  /**
   * Alternar menú de contacto
   */
  toggleContactMenu(phoneNumber: string): void {
    const currentOpen = this.showContactMenu();
    this.showContactMenu.set(currentOpen === phoneNumber ? null : phoneNumber);
  }

  /**
   * Cerrar menú de contacto
   */
  closeContactMenu(): void {
    this.showContactMenu.set(null);
  }

  /**
   * Abrir modal para asignar etiquetas
   */
  openTagModal(conversation: Conversation): void {
    this.currentContactForAction.set(conversation);
    this.loadContactByPhone(conversation.contact_phone);
    this.showTagModal.set(true);
    this.closeContactMenu();
  }

  /**
   * Cerrar modal de etiquetas
   */
  closeTagModal(): void {
    this.showTagModal.set(false);
    this.currentContactForAction.set(null);
    this.currentContact.set(null);
  }

  /**
   * Abrir modal para descripción/observación
   */
  openDescriptionModal(conversation: Conversation): void {
    this.currentContactForAction.set(conversation);
    this.loadContactByPhone(conversation.contact_phone);
    this.showDescriptionModal.set(true);
    this.closeContactMenu();
  }

  /**
   * Cerrar modal de descripción
   */
  closeDescriptionModal(): void {
    this.showDescriptionModal.set(false);
    this.currentContactForAction.set(null);
    this.currentContact.set(null);
    this.descriptionForm.reset();
  }

  /**
   * Cargar contacto por número de teléfono
   */
  loadContactByPhone(phoneNumber: string): void {
    console.log('🔍 Buscando contacto por teléfono:', phoneNumber);
    
    // Primero intentamos obtener el contacto existente
    this.contactsService.getContacts({ search: phoneNumber, limit: 50 }).subscribe({
      next: (response) => {
        console.log('📞 Respuesta de búsqueda de contactos:', response);
        
        if (response.success && response.data && response.data.length > 0) {
          // Buscar coincidencia exacta por número de teléfono
          const contact = response.data.find(c => {
            const cleanContactPhone = c.phone_number.replace(/[\s\-\(\)\+]/g, '');
            const cleanSearchPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
            return cleanContactPhone === cleanSearchPhone || 
                   cleanContactPhone.includes(cleanSearchPhone) ||
                   cleanSearchPhone.includes(cleanContactPhone);
          });
          
          if (contact) {
            console.log('✅ Contacto encontrado:', contact);
            this.currentContact.set(contact);
            
            // Pre-llenar formularios según el modal activo
            if (this.showDescriptionModal()) {
              this.descriptionForm.patchValue({
                description: contact.comments || ''
              });
            }
            
            if (this.showEditContactNameModal()) {
              this.editContactNameForm.patchValue({
                contactName: contact.name || ''
              });
            }
          } else {
            console.log('⚠️ No se encontró contacto exacto, creando temporal');
            this.createTemporaryContact(phoneNumber);
          }
        } else {
          console.log('⚠️ No se encontraron contactos, creando temporal');
          this.createTemporaryContact(phoneNumber);
        }
      },
      error: (error) => {
        console.error('❌ Error buscando contacto:', error);
        this.createTemporaryContact(phoneNumber);
      }
    });
  }

  /**
   * Crear contacto temporal cuando no existe
   */
  private createTemporaryContact(phoneNumber: string): void {
    const tempContact: Contact = {
      id: 0, // ID temporal
      client_id: this.currentUser()?.id || 0,
      phone_number: phoneNumber,
      name: undefined,
      custom_name: undefined,
      profile_pic_url: undefined,
      comments: undefined,
      is_blocked: false,
      last_message_at: undefined,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('📝 Contacto temporal creado:', tempContact);
    this.currentContact.set(tempContact);
  }

  /**
   * Guardar etiquetas del contacto
   */
  saveContactTags(selectedTags: ContactTag[]): void {
    const contact = this.currentContact();
    if (!contact) return;

    const tagIds = selectedTags.map(tag => tag.id);

    if (contact.id === 0) {
      // Crear nuevo contacto
      this.contactsService.createContact({
        phone_number: contact.phone_number,
        comments: contact.comments
      }).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Asignar etiquetas al nuevo contacto
            this.contactsService.assignTagsToContact(response.data.id, tagIds).subscribe({
              next: () => {
                console.log('✅ Etiquetas asignadas exitosamente');
                // No cerrar modal automáticamente para permitir más cambios
                this.loadConversations();
              },
              error: (error) => {
                console.error('Error assigning tags:', error);
              }
            });
          }
        },
        error: (error) => {
          console.error('Error creating contact:', error);
        }
      });
    } else {
      // Actualizar contacto existente
      this.contactsService.assignTagsToContact(contact.id, tagIds).subscribe({
        next: () => {
          console.log('✅ Etiquetas actualizadas exitosamente');
          // No cerrar modal automáticamente para permitir más cambios
          this.loadConversations();
        },
        error: (error) => {
          console.error('Error updating tags:', error);
        }
      });
    }
  }

  /**
   * Crear nueva etiqueta y asignarla al contacto actual
   */
  createNewTag(tagData: {name: string, color: string}): void {
    console.log('🏷️ Creating new tag:', tagData);
    
    const contact = this.currentContact();
    if (!contact) {
      console.error('❌ No contact selected for tag creation');
      return;
    }

    // Crear la etiqueta
    this.contactsService.createTag({
      name: tagData.name.trim(),
      color: tagData.color,
      description: `Etiqueta creada automáticamente para ${contact.name || contact.phone_number}`
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          console.log('✅ Nueva etiqueta creada:', response.data);
          
          // Agregar la nueva etiqueta a las etiquetas actuales del contacto
          const currentTags = contact.tags || [];
          const updatedTags = [...currentTags, response.data];
          
          // Guardar las etiquetas actualizadas (incluyendo la nueva)
          this.saveContactTags(updatedTags);
          
          // Recargar las etiquetas disponibles para que aparezca en la lista
          this.loadAvailableTags();
          
          // Cerrar el modal ya que la etiqueta fue creada y asignada exitosamente
          this.closeTagModal();
          
          console.log('✅ Nueva etiqueta asignada al contacto y modal cerrado');
        } else {
          console.error('❌ Error en la respuesta al crear etiqueta:', response.message);
        }
      },
      error: (error) => {
        console.error('❌ Error creating new tag:', error);
        // Mostrar mensaje de error al usuario si es necesario
      }
    });
  }

  /**
   * Remover una etiqueta específica del contacto
   */
  removeTag(tagToRemove: ContactTag): void {
    const contact = this.currentContact();
    if (!contact || !contact.tags) return;

    const updatedTags = contact.tags.filter(tag => tag.id !== tagToRemove.id);
    this.saveContactTags(updatedTags);
  }

  /**
   * Guardar descripción del contacto
   */
  saveContactDescription(): void {
    const contact = this.currentContact();
    const description = this.descriptionForm.value.description?.trim();
    
    if (!contact) return;

    if (contact.id === 0) {
      // Crear nuevo contacto
      this.contactsService.createContact({
        phone_number: contact.phone_number,
        comments: description
      }).subscribe({
        next: (response) => {
          if (response.success) {
            console.log('✅ Contacto creado con descripción');
            this.closeDescriptionModal();
          }
        },
        error: (error) => {
          console.error('Error creating contact:', error);
        }
      });
    } else {
      // Actualizar contacto existente
      this.contactsService.updateContact(contact.id, {
        comments: description
      }).subscribe({
        next: (response) => {
          if (response.success) {
            console.log('✅ Descripción actualizada exitosamente');
            this.closeDescriptionModal();
          }
        },
        error: (error) => {
          console.error('Error updating description:', error);
        }
      });
    }
  }

  /**
   * Abrir modal para editar nombre del contacto
   */
  openEditContactNameModal(conversation: Conversation): void {
    this.currentContactForAction.set(conversation);
    this.loadContactByPhone(conversation.contact_phone);
    
    // Pre-llenar el formulario con el nombre actual
    const currentName = conversation.contact_name || '';
    this.editContactNameForm.patchValue({
      contactName: currentName
    });
    
    this.showEditContactNameModal.set(true);
    this.closeContactMenu();
  }

  /**
   * Cerrar modal de editar nombre
   */
  closeEditContactNameModal(): void {
    this.showEditContactNameModal.set(false);
    this.currentContactForAction.set(null);
    this.currentContact.set(null);
    this.editContactNameForm.reset();
  }

  /**
   * Guardar nuevo nombre del contacto
   */
  saveContactName(): void {
    if (!this.editContactNameForm.valid) {
      console.log('❌ Formulario inválido');
      return;
    }
    
    const conversation = this.currentContactForAction();
    const contact = this.currentContact();
    const newName = this.editContactNameForm.value.contactName.trim();
    
    console.log('💾 Guardando nombre del contacto:', {
      conversation: conversation?.contact_phone,
      contact: contact?.id,
      newName
    });
    
    if (!conversation) {
      console.log('❌ No hay conversación seleccionada');
      return;
    }

    if (!contact || contact.id === 0) {
      // Crear nuevo contacto con el nombre
      console.log('📝 Creando nuevo contacto con nombre');
      this.contactsService.createContact({
        phone_number: conversation.contact_phone,
        name: newName,
        comments: ''
      }).subscribe({
        next: (response) => {
          console.log('✅ Respuesta crear contacto:', response);
          if (response.success) {
            console.log('✅ Contacto creado con nombre exitosamente');
            this.updateConversationName(conversation.contact_phone, newName);
            this.closeEditContactNameModal();
            this.successMessage.set('Nombre del contacto actualizado');
            setTimeout(() => this.successMessage.set(''), 3000);
          } else {
            console.log('❌ Error en respuesta crear contacto:', response.message);
            this.errorMessage.set(response.message || 'Error al crear el contacto');
            setTimeout(() => this.errorMessage.set(''), 3000);
          }
        },
        error: (error) => {
          console.error('❌ Error creating contact:', error);
          this.errorMessage.set('Error al crear el contacto: ' + (error.error?.message || error.message));
          setTimeout(() => this.errorMessage.set(''), 3000);
        }
      });
    } else {
      // Actualizar contacto existente
      console.log('📝 Actualizando contacto existente con ID:', contact.id);
      this.contactsService.updateContact(contact.id, {
        name: newName
      }).subscribe({
        next: (response) => {
          console.log('✅ Respuesta actualizar contacto:', response);
          if (response.success) {
            console.log('✅ Nombre actualizado exitosamente');
            this.updateConversationName(conversation.contact_phone, newName);
            this.closeEditContactNameModal();
            this.successMessage.set('Nombre del contacto actualizado');
            setTimeout(() => this.successMessage.set(''), 3000);
          } else {
            console.log('❌ Error en respuesta actualizar contacto:', response.message);
            this.errorMessage.set(response.message || 'Error al actualizar el nombre');
            setTimeout(() => this.errorMessage.set(''), 3000);
          }
        },
        error: (error) => {
          console.error('❌ Error updating name:', error);
          this.errorMessage.set('Error al actualizar el nombre: ' + (error.error?.message || error.message));
          setTimeout(() => this.errorMessage.set(''), 3000);
        }
      });
    }
  }

  /**
   * Actualizar el nombre en la lista de conversaciones
   */
  private updateConversationName(phoneNumber: string, newName: string): void {
    const conversations = this.conversations();
    const updatedConversations = conversations.map(conv => {
      if (conv.contact_phone === phoneNumber) {
        return { ...conv, contact_name: newName };
      }
      return conv;
    });
    
    this.conversations.set(updatedConversations);
    this.applyFilters();
    
    // Actualizar conversación activa si es la misma
    const activeConv = this.activeConversation();
    if (activeConv && activeConv.contact_phone === phoneNumber) {
      this.activeConversation.set({ ...activeConv, contact_name: newName });
    }
  }

  /**
   * Confirmar eliminación de conversación
   */
  confirmDeleteConversation(conversation: Conversation): void {
    this.currentContactForAction.set(conversation);
    this.showDeleteConfirmModal.set(true);
    this.closeContactMenu();
  }

  /**
   * Cerrar modal de confirmación de eliminación
   */
  closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal.set(false);
    this.currentContactForAction.set(null);
  }

  /**
   * Eliminar conversación
   */
  deleteConversation(): void {
    const conversation = this.currentContactForAction();
    if (!conversation) {
      console.log('❌ No hay conversación seleccionada para eliminar');
      return;
    }

    console.log('🗑️ Eliminando conversación:', conversation.id, conversation.contact_phone);

    // Llamar al backend para eliminar la conversación
    this.chatService.deleteConversation(conversation.id).subscribe({
      next: (response) => {
        console.log('✅ Respuesta eliminar conversación:', response);
        if (response.success) {
          console.log('✅ Conversación eliminada exitosamente del backend');
          
          // Actualizar el frontend
          const conversations = this.conversations();
          const updatedConversations = conversations.filter(conv => conv.id !== conversation.id);
          
          this.conversations.set(updatedConversations);
          this.applyFilters();
          
          // Si era la conversación activa, limpiar
          if (this.activeConversation()?.id === conversation.id) {
            this.activeConversation.set(null);
            this.messages.set([]);
          }
          
          this.closeDeleteConfirmModal();
          this.successMessage.set('Conversación eliminada exitosamente');
          setTimeout(() => this.successMessage.set(''), 3000);
        } else {
          console.log('❌ Error en respuesta eliminar conversación:', response.message);
          this.errorMessage.set(response.message || 'Error al eliminar la conversación');
          setTimeout(() => this.errorMessage.set(''), 3000);
        }
      },
      error: (error) => {
        console.error('❌ Error deleting conversation:', error);
        this.errorMessage.set('Error al eliminar la conversación: ' + (error.error?.message || error.message));
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  // ============================================================================
  // IMAGE HANDLING METHODS
  // ============================================================================

  /**
   * Abrir modal para ver imagen en tamaño completo
   */
  openImageModal(message: Message): void {
    this.selectedImageMessage.set(message);
    this.showImageModal.set(true);
    console.log('🖼️ Abriendo modal de imagen:', message.file_name);
  }

  /**
   * Cerrar modal de imagen
   */
  closeImageModal(): void {
    this.showImageModal.set(false);
    this.selectedImageMessage.set(null);
  }

  /**
   * Manejar carga exitosa de imagen
   */
  onImageLoad(event: Event, message: any): void {
    const img = event.target as HTMLImageElement;
    console.log('✅ Imagen cargada exitosamente:', {
      messageId: message.id,
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      fileName: message.file_name
    });
  }

  /**
   * Manejar error de carga de imagen
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    console.error('❌ Error cargando imagen:', {
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      error: event
    });
    
    // Opcional: Reemplazar con imagen de placeholder
    // img.src = 'assets/images/image-error-placeholder.png';
  }

  /**
   * Formatear tamaño de archivo
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Obtener icono para documento según extensión
   */
  getDocumentIcon(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    
    const iconMap: { [key: string]: string } = {
      'pdf': 'fas fa-file-pdf',
      'doc': 'fas fa-file-word',
      'docx': 'fas fa-file-word',
      'xls': 'fas fa-file-excel',
      'xlsx': 'fas fa-file-excel',
      'ppt': 'fas fa-file-powerpoint',
      'pptx': 'fas fa-file-powerpoint',
      'txt': 'fas fa-file-alt',
      'csv': 'fas fa-file-csv',
      'zip': 'fas fa-file-archive',
      'rar': 'fas fa-file-archive',
      '7z': 'fas fa-file-archive',
      'json': 'fas fa-file-code',
      'xml': 'fas fa-file-code',
      'html': 'fas fa-file-code',
      'css': 'fas fa-file-code',
      'js': 'fas fa-file-code',
      'ts': 'fas fa-file-code'
    };
    
    return iconMap[extension] || 'fas fa-file';
  }

  /**
   * Obtener etiqueta legible para tipo MIME
   */
  getFileTypeLabel(mimetype: string): string {
    const typeMap: { [key: string]: string } = {
      'application/pdf': 'PDF',
      'application/msword': 'Word',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
      'application/vnd.ms-excel': 'Excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
      'text/plain': 'Texto',
      'text/csv': 'CSV',
      'application/zip': 'ZIP',
      'application/json': 'JSON',
      'image/jpeg': 'JPEG',
      'image/png': 'PNG',
      'image/gif': 'GIF'
    };
    
    return typeMap[mimetype] || mimetype.split('/')[1]?.toUpperCase() || 'Archivo';
  }

  /**
   * Obtener poster para video (placeholder por ahora)
   */
  getVideoPoster(message: any): string | null {
    // Por ahora retornamos null, pero se podría implementar
    // generación de thumbnails en el backend
    return null;
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
   * TrackBy function para mensajes
   */
  trackByMessageId(index: number, message: Message): number {
    return message.id;
  }

  /**
   * TrackBy function para archivos seleccionados
   */
  trackByFileName(index: number, file: ChatFile): string {
    return file.file.name + file.file.size + file.file.lastModified;
  }

  // ============================================================================
  // TEMPLATES FUNCTIONALITY
  // ============================================================================

  /**
   * Abrir modal de selección de templates
   */
  openTemplateModal(): void {
    this.showTemplateModal.set(true);
    this.loadTemplates();
  }

  /**
   * Cerrar modal de templates
   */
  closeTemplateModal(): void {
    this.showTemplateModal.set(false);
    this.templateSearchQuery = '';
    this.filteredTemplates.set([]);
  }

  /**
   * Cargar templates disponibles
   */
  private loadTemplates(): void {
    this.isLoadingTemplates.set(true);
    
    this.templatesService.getTemplates({ is_active: true, limit: 50 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.availableTemplates.set(response.templates);
          this.filteredTemplates.set(response.templates);
        } else {
          this.errorMessage.set('Error al cargar templates');
        }
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        this.errorMessage.set('Error al cargar templates');
      },
      complete: () => {
        this.isLoadingTemplates.set(false);
      }
    });
  }

  /**
   * Filtrar templates por búsqueda
   */
  filterTemplates(): void {
    const query = this.templateSearchQuery.toLowerCase();
    const filtered = this.availableTemplates().filter(template => 
      template.name.toLowerCase().includes(query) ||
      template.content.toLowerCase().includes(query) ||
      template.category.toLowerCase().includes(query)
    );
    this.filteredTemplates.set(filtered);
  }

  /**
   * Seleccionar un template
   */
  selectTemplate(template: MessageTemplate): void {
    this.selectedTemplate.set(template);
    const variables = this.getTemplateVariables(template.content);
    this.templateVariables.set(variables);
    
    if (variables.length > 0) {
      // Crear formulario para variables
      const formControls: { [key: string]: any } = {};
      variables.forEach(variable => {
        formControls[variable] = [''];  // Sin validación requerida
      });
      this.templateVariablesForm = this.formBuilder.group(formControls);
      
      // Escuchar cambios para actualizar preview
      this.templateVariablesForm.valueChanges.subscribe(() => {
        this.updateTemplatePreview();
      });
      
      // Inicializar preview
      this.updateTemplatePreview();
      
      this.closeTemplateModal();
      this.showVariablesModal.set(true);
    } else {
      // Template sin variables, mostrar modal de confirmación
      this.templatePreview.set(template.content);
      this.closeTemplateModal();
      this.showVariablesModal.set(true);
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
    this.templateVariablesForm = this.formBuilder.group({});
  }

  /**
   * Actualizar preview del template
   */
  private updateTemplatePreview(): void {
    const template = this.selectedTemplate();
    if (template) {
      let content = template.content;
      const variables = this.templateVariablesForm.value;
      
      // Procesar variables manualmente
      Object.keys(variables).forEach(key => {
        const value = variables[key] || '';  // Si está vacío, usar cadena vacía
        // Reemplazar tanto {variable} como {{variable}}
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
      
      // Si no hay variables en el formulario, procesar las variables detectadas
      if (Object.keys(variables).length === 0) {
        const detectedVariables = this.getTemplateVariables(content);
        detectedVariables.forEach(variable => {
          // Para variables sin valor, mostrar placeholder
          content = content.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), `[${variable}]`);
          content = content.replace(new RegExp(`\\{${variable}\\}`, 'g'), `[${variable}]`);
        });
      }
      
      this.templatePreview.set(content);
    }
  }

  /**
   * Verificar si se puede enviar el template
   */
  canSendTemplate(): boolean {
    return this.templatePreview().length > 0 && !this.isSendingMessage();
  }

  /**
   * Enviar mensaje con template
   */
  sendTemplateMessage(): void {
    const conversation = this.activeConversation();
    const template = this.selectedTemplate();
    
    if (!conversation || !template) return;

    const finalMessage = this.templatePreview() || template.content;
    
    this.isSendingMessage.set(true);
    this.clearMessages();

    const messageData: SendMessageRequest = {
      to: conversation.contact_phone,
      message: finalMessage,
      isBot: false
    };

    this.chatService.sendMessage(messageData).subscribe({
      next: (response) => {
        if (response.success) {
          // ✅ Sin mensaje de éxito molesto - el usuario ve el template en el chat
          
          // Incrementar uso del template
          this.templatesService.useTemplate(template.id, {
            phone_number: conversation.contact_phone,
            variables: this.templateVariablesForm.value
          }).subscribe();
          
          // NO recargar mensajes - el WebSocket se encargará de mostrar el nuevo mensaje
          // this.loadMessages(conversation.id); // ❌ ELIMINADO - causaba scroll jump
          this.updateConversationInList(conversation.id);
          
          // Cerrar modales
          this.closeVariablesModal();
        } else {
          this.errorMessage.set(response.message || 'Error al enviar el template');
        }
      },
      error: (error) => {
        console.error('Error sending template:', error);
        let errorMsg = 'Error al enviar el template';
        
        if (error.error?.message) {
          errorMsg = error.error.message;
        } else if (error.status === 400) {
          errorMsg = 'WhatsApp no está conectado. Conecta WhatsApp desde el Dashboard.';
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        this.errorMessage.set(errorMsg);
      },
      complete: () => {
        this.isSendingMessage.set(false);
        this.clearMessagesAfterDelay();
      }
    });
  }

  /**
   * Extraer variables de un template
   */
  getTemplateVariables(content: string): string[] {
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
   * Navegar a la sección de templates
   */
  goToTemplates(): void {
    this.router.navigate(['/templates/list']);
  }

  /**
   * Verificar si se puede generar sugerencia de IA
   */
  canGenerateAISuggestion(): boolean {
    const conversation = this.activeConversation();
    const messages = this.messages();
    
    // Debe haber una conversación activa y al menos un mensaje
    return !!(conversation && messages.length > 0);
  }

  /**
   * Generar sugerencia de respuesta usando IA
   */
  generateAISuggestion(): void {
    if (!this.canGenerateAISuggestion() || this.isGeneratingAI()) {
      return;
    }

    const conversation = this.activeConversation();
    const messages = this.messages();
    
    if (!conversation || messages.length === 0) {
      this.errorMessage.set('No hay conversación activa o mensajes para generar una sugerencia');
      return;
    }

    this.isGeneratingAI.set(true);
    this.clearMessages();

    // Preparar el historial de conversación para la IA
    const conversationHistory = messages.slice(-10).map(msg => ({
      content: msg.content,
      sender_type: msg.sender_type
    }));

    // Obtener el último mensaje (normalmente del cliente/contacto)
    const lastMessage = messages[messages.length - 1]?.content || '';

    console.log('🧠 Generando sugerencia de IA para conversación:', conversation.id);
    console.log('🧠 Último mensaje:', lastMessage.substring(0, 100) + '...');
    console.log('🧠 Historial de mensajes:', conversationHistory.length);

    this.chatService.suggestResponse(conversationHistory, lastMessage).subscribe({
      next: (response) => {
        if (response.success && response.data?.suggestedResponse) {
          // Colocar la respuesta sugerida en el textarea
          this.messageForm.patchValue({
            message: response.data.suggestedResponse
          });
          
          this.successMessage.set('Respuesta generada por IA. Revísala antes de enviar.');
          console.log('✅ Respuesta IA generada:', response.data.suggestedResponse.substring(0, 100) + '...');
        } else {
          this.errorMessage.set(response.message || 'No se pudo generar una respuesta sugerida');
        }
      },
      error: (error) => {
        console.error('❌ Error generating AI suggestion:', error);
        let errorMsg = 'Error al generar respuesta sugerida';
        
        if (error.error?.message) {
          errorMsg = error.error.message;
        } else if (error.status === 400) {
          errorMsg = 'La IA no está habilitada para este cliente';
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        this.errorMessage.set(errorMsg);
      },
      complete: () => {
        this.isGeneratingAI.set(false);
        this.clearMessagesAfterDelay();
      }
    });
  }

  /**
   * Verificar si estamos en vista móvil
   */
  checkMobileView(): void {
    const isMobileView = window.innerWidth <= 768;
    this.isMobile.set(isMobileView);
    
    // En móvil, el sidebar está cerrado por defecto
    if (isMobileView) {
      this.showSidebar.set(false);
    } else {
      this.showSidebar.set(true);
    }
  }

  /**
   * Configurar listener para cambios de tamaño de ventana
   */
  setupResizeListener(): void {
    window.addEventListener('resize', () => {
      this.checkMobileView();
    });
  }

  /**
   * Alternar visibilidad del sidebar (para móvil)
   */
  toggleSidebar(): void {
    this.showSidebar.set(!this.showSidebar());
  }

  /**
   * Cerrar sidebar (útil cuando se selecciona una conversación en móvil)
   */
  closeSidebar(): void {
    if (this.isMobile()) {
      this.showSidebar.set(false);
    }
  }

  /**
   * Seleccionar conversación y cerrar sidebar en móvil
   */
  selectConversationMobile(conversation: Conversation): void {
    this.selectConversation(conversation);
    this.closeSidebar();
  }

  /**
   * Exportar chat a PDF
   */
  exportChatToPDF(conversation: Conversation): void {
    this.showContactMenu.set(null); // Cerrar menú
    console.log('🔄 Exportando chat a PDF para:', conversation.contact_name || conversation.contact_phone);
    
    // TODO: Implementar exportación a PDF
    // Por ahora mostrar mensaje
    alert('Funcionalidad de exportar PDF en desarrollo...');
  }

  /**
   * Abrir modal de análisis de chat
   */
  openChatAnalysisModal(conversation: Conversation): void {
    this.showContactMenu.set(null); // Cerrar menú
    this.currentConversationForAnalysis.set(conversation);
    this.showChatAnalysisModal.set(true);
    this.analysisResult.set('');
    this.analysisTimestamp.set(null);
    this.analysisForm.reset();
  }

  /**
   * Cerrar modal de análisis de chat
   */
  closeChatAnalysisModal(): void {
    this.showChatAnalysisModal.set(false);
    this.currentConversationForAnalysis.set(null);
    this.isAnalyzing.set(false);
    this.analysisResult.set('');
    this.analysisTimestamp.set(null);
  }

  /**
   * Ejecutar análisis predefinido
   */
  runAnalysis(type: 'sentiment' | 'summary' | 'topics' | 'intent'): void {
    const conversation = this.currentConversationForAnalysis();
    if (!conversation) return;

    let question = '';
    switch (type) {
      case 'sentiment':
        question = 'Analiza el sentimiento general de esta conversación. ¿El cliente está satisfecho, frustrado, neutral? Explica los indicadores que encuentras.';
        break;
      case 'summary':
        question = 'Haz un resumen conciso de esta conversación, destacando los puntos principales y el estado actual de la interacción.';
        break;
      case 'topics':
        question = 'Identifica los temas principales que se discuten en esta conversación y organízalos por importancia.';
        break;
      case 'intent':
        question = 'Analiza la intención principal del cliente en esta conversación. ¿Qué busca lograr? ¿Cuáles son sus necesidades?';
        break;
    }

    this.performAnalysis(question);
  }

  /**
   * Hacer pregunta personalizada
   */
  askCustomQuestion(): void {
    if (!this.analysisForm.valid) return;
    
    const question = this.analysisForm.get('customQuestion')?.value;
    this.performAnalysis(question);
  }

  /**
   * Realizar análisis con IA
   */
  private performAnalysis(question: string): void {
    const conversation = this.currentConversationForAnalysis();
    if (!conversation) return;

    this.isAnalyzing.set(true);
    this.analysisResult.set('');

    // Obtener mensajes de la conversación
    this.chatService.getMessages(conversation.id).subscribe({
      next: (response) => {
        if (response.success && response.messages) {
          const messages = response.messages;
          
          // Preparar historial para análisis
          const conversationHistory = messages.map((msg: any) => ({
            content: msg.content,
            sender_type: msg.sender_type,
            sent_at: msg.sent_at
          }));

          // Llamar al servicio de análisis
          this.chatService.analyzeConversation(conversationHistory, question).subscribe({
            next: (analysisResponse) => {
              if (analysisResponse.success && analysisResponse.data?.analysis) {
                this.analysisResult.set(analysisResponse.data.analysis);
                this.analysisTimestamp.set(new Date());
                this.analysisForm.reset();
              } else {
                this.analysisResult.set('Error: No se pudo completar el análisis. ' + (analysisResponse.message || ''));
              }
            },
            error: (error) => {
              console.error('❌ Error in analysis:', error);
              let errorMsg = 'Error al analizar la conversación';
              
              if (error.error?.message) {
                errorMsg = error.error.message;
              } else if (error.status === 400) {
                errorMsg = 'La IA no está habilitada para este cliente o se agotó la cuota';
              }
              
              this.analysisResult.set(errorMsg);
            },
            complete: () => {
              this.isAnalyzing.set(false);
            }
          });
        }
      },
      error: (error) => {
        console.error('❌ Error loading messages for analysis:', error);
        this.analysisResult.set('Error al cargar los mensajes para análisis');
        this.isAnalyzing.set(false);
      }
    });
  }
}
