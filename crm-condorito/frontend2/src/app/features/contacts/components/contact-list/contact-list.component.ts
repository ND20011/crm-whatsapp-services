import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

import { ContactsService } from '../../services/contacts.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { TagSelectorComponent } from '../../../../shared/components/tag-selector/tag-selector.component';
import { ContactFormComponent } from '../contact-form/contact-form.component';
import { ContactImportComponent } from '../contact-import/contact-import.component';
// ErrorDisplayComponent removido - usando div simple
import { 
  Contact, 
  ContactTag, 
  ContactFilters,
  CreateTagRequest
} from '../../models/contact.models';

// ============================================================================
// CONTACT LIST COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-contact-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TagSelectorComponent, ContactFormComponent, ContactImportComponent],
  templateUrl: './contact-list.component.html',
  styleUrls: ['./contact-list.component.scss']
})
export class ContactListComponent implements OnInit, OnDestroy {
  // ============================================================================
  // DEPENDENCIES
  // ============================================================================
  private contactsService = inject(ContactsService);
  public loadingService = inject(LoadingService);
  public errorHandler = inject(ErrorHandlerService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // ============================================================================
  // SIGNALS
  // ============================================================================
  contacts = signal<Contact[]>([]);
  allTags = signal<ContactTag[]>([]);
  availableTags = signal<ContactTag[]>([]);
  isLoading = signal<boolean>(false);
  totalContacts = signal<number>(0);
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  selectedContact = signal<Contact | null>(null);
  isTagModalOpen = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  showTagModal = signal<boolean>(false);
  currentContactForTags = signal<Contact | null>(null);
  selectedTagIdsForContact = signal<number[]>([]);
  selectedTagsForFilter = signal<ContactTag[]>([]);
  viewMode = signal<'grid' | 'table'>('grid');

  // Modal states
  showContactForm = signal<boolean>(false);
  showImportModal = signal<boolean>(false);
  editingContact = signal<Contact | null>(null);

  // ============================================================================
  // COMPUTED
  // ============================================================================
  hasContacts = computed(() => this.contacts().length > 0);
  hasFilters = computed(() => {
    const form = this.filterForm.value;
    return !!(
      form.search || 
      form.tagId || 
      (form.selectedTags && form.selectedTags.length > 0) ||
      form.tagAssignedFrom ||
      form.tagAssignedTo ||
      form.isBlocked !== null
    );
  });

  // ============================================================================
  // FORM
  // ============================================================================
  filterForm: FormGroup;

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  readonly PAGE_SIZE = 20;
  readonly STORAGE_KEY = 'contacts-view-mode';

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  constructor() {
    this.filterForm = this.fb.group({
      search: [''],
      tagId: [null],
      selectedTags: [[]],
      tagAssignedFrom: [''],
      tagAssignedTo: [''],
      isBlocked: [null],
      sortBy: ['created_at'],
      sortOrder: ['DESC']
    });
  }

  ngOnInit(): void {
    this.loadViewModeFromStorage();
    this.loadContacts();
    this.loadAvailableTags();
    this.setupFilterSubscription();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Cargar lista de contactos
   */
  loadContacts(page: number = 1): void {
    this.isLoading.set(true);
    this.currentPage.set(page);

    const formValues = this.filterForm.value;
    const filters: ContactFilters = {
      page,
      limit: this.PAGE_SIZE
    };

    // Agregar filtros si tienen valor
    if (formValues.search?.trim()) {
      filters.search = formValues.search.trim();
    }
    
    if (formValues.tagId) {
      filters.tagId = formValues.tagId;
    }
    
    if (formValues.selectedTags && formValues.selectedTags.length > 0) {
      filters.tagIds = formValues.selectedTags.map((tag: ContactTag) => tag.id);
    }
    
    if (formValues.tagAssignedFrom) {
      filters.tagAssignedFrom = formValues.tagAssignedFrom;
    }
    
    if (formValues.tagAssignedTo) {
      filters.tagAssignedTo = formValues.tagAssignedTo;
    }
    
    if (formValues.isBlocked !== null) {
      filters.isBlocked = formValues.isBlocked;
    }
    
    if (formValues.sortBy) {
      filters.sortBy = formValues.sortBy;
    }
    
    if (formValues.sortOrder) {
      filters.sortOrder = formValues.sortOrder;
    }

    const subscription = this.contactsService.getContacts(filters).subscribe({
      next: (response) => {
        if (response.success) {
          this.contacts.set(response.data);
          this.totalContacts.set(response.total);
          this.totalPages.set(response.totalPages);
        } else {
          this.errorHandler.handleError('Error al cargar contactos');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al cargar contactos', error);
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Cargar etiquetas disponibles
   */
  loadAvailableTags(): void {
    const subscription = this.contactsService.getTags({
      sortBy: 'name',
      sortOrder: 'ASC'
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.availableTags.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error loading tags:', error);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Configurar suscripción a cambios de filtros
   */
  private setupFilterSubscription(): void {
    const subscription = this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadContacts(1); // Reset to first page when filters change
    });

    this.subscriptions.push(subscription);
  }

  // ============================================================================
  // PAGINATION
  // ============================================================================

  /**
   * Ir a página específica
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.loadContacts(page);
    }
  }

  /**
   * Página anterior
   */
  previousPage(): void {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  /**
   * Página siguiente
   */
  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  // ============================================================================
  // TAG MANAGEMENT
  // ============================================================================

  /**
   * Abrir modal de etiquetas para un contacto
   */
  openTagModal(contact: Contact): void {
    this.selectedContact.set(contact);
    this.isTagModalOpen.set(true);
  }

  /**
   * Cerrar modal de etiquetas
   */
  closeTagModal(): void {
    this.selectedContact.set(null);
    this.isTagModalOpen.set(false);
  }

  /**
   * Manejar cambio de etiquetas
   */
  onTagsChanged(newTags: ContactTag[]): void {
    const contact = this.selectedContact();
    if (!contact) return;

    const tagIds = newTags.map(tag => tag.id);
    
    const loadingId = this.loadingService.startLoading('assign-tags', 'Asignando etiquetas...');

    const subscription = this.contactsService.assignTagsToContact(contact.id, tagIds).subscribe({
      next: (response) => {
        if (response.success) {
          // Actualizar el contacto en la lista
          this.contacts.update(contacts => 
            contacts.map(c => 
              c.id === contact.id ? { ...c, tags: newTags } : c
            )
          );
          console.log('✅ Etiquetas asignadas exitosamente');
        } else {
          this.errorHandler.handleError('Error al asignar etiquetas');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al asignar etiquetas', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Remover etiqueta específica de un contacto
   */
  removeTagFromContact(contact: Contact, tag: ContactTag): void {
    const loadingId = this.loadingService.startLoading('remove-tag', 'Removiendo etiqueta...');

    const subscription = this.contactsService.removeTagFromContact(contact.id, tag.id).subscribe({
      next: (response) => {
        if (response.success) {
          // Actualizar el contacto en la lista
          this.contacts.update(contacts => 
            contacts.map(c => 
              c.id === contact.id 
                ? { ...c, tags: c.tags.filter(t => t.id !== tag.id) }
                : c
            )
          );
          console.log('✅ Etiqueta removida exitosamente');
        } else {
          this.errorHandler.handleError('Error al remover etiqueta');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al remover etiqueta', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Crear nueva etiqueta desde el selector
   */
  onCreateNewTag(tagName: string): void {
    const tagData: CreateTagRequest = {
      name: tagName,
      color: this.contactsService.generateRandomColor(),
      description: `Etiqueta creada automáticamente: ${tagName}`
    };

    const loadingId = this.loadingService.startLoading('create-tag', 'Creando etiqueta...');

    const subscription = this.contactsService.createTag(tagData).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Agregar la nueva etiqueta a la lista disponible
          this.availableTags.update(tags => [...tags, response.data!]);
          console.log('✅ Etiqueta creada exitosamente');
        } else {
          this.errorHandler.handleError('Error al crear etiqueta');
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

  // ============================================================================
  // FILTERS
  // ============================================================================

  /**
   * Limpiar todos los filtros
   */
  clearFilters(): void {
    this.selectedTagsForFilter.set([]);
    this.filterForm.reset({
      search: '',
      tagId: null,
      selectedTags: [],
      tagAssignedFrom: '',
      tagAssignedTo: '',
      isBlocked: null,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
  }

  /**
   * Filtrar por etiqueta específica
   */
  filterByTag(tag: ContactTag): void {
    this.filterForm.patchValue({ tagId: tag.id });
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  /**
   * Ir a gestión de etiquetas
   */
  goToTagManagement(): void {
    this.router.navigate(['/contacts/tags']);
  }

  /**
   * Ir al dashboard
   */
  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  // Método eliminado - duplicado más abajo

  /**
   * Obtener iniciales del nombre
   */
  getInitials(contact: Contact): string {
    const name = contact.custom_name || contact.name || contact.phone_number;
    return this.contactsService.getInitials(name);
  }

  /**
   * Obtener nombre para mostrar
   */
  getDisplayName(contact: Contact): string {
    return contact.custom_name || contact.name || contact.phone_number;
  }

  /**
   * Formatear fecha de último mensaje
   */
  formatLastMessageDate(dateString?: string): string {
    if (!dateString) return 'Nunca';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `${diffDays} días`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses`;
    
    return `${Math.floor(diffDays / 365)} años`;
  }

  // ============================================================================
  // TRACKBY FUNCTIONS
  // ============================================================================

  /**
   * TrackBy function para contactos
   */
  trackByContactId(index: number, contact: Contact): number {
    return contact.id;
  }

  /**
   * TrackBy function para etiquetas
   */
  trackByTagId(index: number, tag: ContactTag): number {
    return tag.id;
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

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Obtener nombre de visualización del contacto
   */
  getContactDisplayName(contact: Contact): string {
    return contact.custom_name || contact.name || contact.phone_number;
  }

  /**
   * Obtener iniciales del contacto para el avatar
   */
  getContactInitials(contact: Contact): string {
    const name = this.getContactDisplayName(contact);
    const words = name.split(' ').filter(word => word.length > 0);
    
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    
    return '??';
  }

  /**
   * Formatear número de teléfono para visualización
   */
  formatPhoneNumber(phone: string): string {
    // Si es un número de WhatsApp Business o grupo, mostrarlo tal como está
    if (phone.includes('@g.us') || phone.includes('@c.us')) {
      return phone;
    }
    
    // Para números normales, aplicar formato
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 13 && cleaned.startsWith('549')) {
      // Formato argentino: +54 9 11 1234-5678
      return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 3)} ${cleaned.substring(3, 5)} ${cleaned.substring(5, 9)}-${cleaned.substring(9)}`;
    }
    
    return phone;
  }

  /**
   * Obtener clase CSS para el estado del contacto
   */
  getContactStatusClass(contact: Contact): string {
    if (contact.is_blocked) {
      return 'status-blocked';
    }
    
    if (contact.last_message_at) {
      return 'status-active';
    }
    
    return 'status-inactive';
  }

  // ============================================================================
  // PAGINATION METHODS
  // ============================================================================

  /**
   * Obtener array de páginas para paginación
   */
  getTotalPages(): number[] {
    const total = this.totalPages();
    return Array(total).fill(0).map((_, i) => i + 1);
  }

  /**
   * Cambiar página
   */
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadContacts();
    }
  }

  // ============================================================================
  // MODAL METHODS
  // ============================================================================

  /**
   * Abrir modal de asignación de etiquetas
   */
  openAssignTagsModal(contact: Contact): void {
    this.currentContactForTags.set(contact);
    this.selectedTagIdsForContact.set(contact.tags?.map(tag => tag.id) || []);
    this.showTagModal.set(true);
  }

  /**
   * Cerrar modal de asignación de etiquetas
   */
  closeAssignTagsModal(): void {
    this.showTagModal.set(false);
    this.currentContactForTags.set(null);
    this.selectedTagIdsForContact.set([]);
  }

  /**
   * Obtener etiquetas seleccionadas como objetos ContactTag
   */
  getSelectedTagsForContact(): ContactTag[] {
    const contact = this.currentContactForTags();
    return contact?.tags || [];
  }

  /**
   * Manejar cambios en etiquetas seleccionadas
   */
  onSelectedTagsChanged(tags: ContactTag[]): void {
    this.selectedTagIdsForContact.set(tags.map(tag => tag.id));
  }

  /**
   * Manejar cambios en las etiquetas para filtrado
   */
  onFilterTagsChanged(tags: ContactTag[]): void {
    this.selectedTagsForFilter.set(tags);
    this.filterForm.patchValue({ selectedTags: tags });
  }

  /**
   * Guardar etiquetas del contacto
   */
  saveContactTags(): void {
    const contact = this.currentContactForTags();
    if (!contact) return;

    const loadingId = this.loadingService.startLoading('assign-tags', 'Asignando etiquetas...');

    const subscription = this.contactsService.assignTagsToContact(contact.id, this.selectedTagIdsForContact()).subscribe({
      next: (response) => {
        if (response.success) {
          this.errorHandler.handleError('Etiquetas asignadas exitosamente.', 'success');
          this.loadContacts(); // Recargar contactos
          this.closeAssignTagsModal();
        } else {
          this.errorHandler.handleError(response.message || 'Error al asignar etiquetas');
        }
      },
      error: (error) => {
        this.errorHandler.handleError('Error al asignar etiquetas', error);
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Formatear fecha en formato legible
   */
  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  }

  /**
   * Función de debug temporal para verificar datos
   */
  debugCurrentContact(): void {
    const contact = this.currentContactForTags();
    if (contact) {
      console.log('🔍 DEBUG - Contacto actual en modal:', {
        id: contact.id,
        name: contact.name,
        phone: contact.phone_number,
        tagsCount: contact.tags?.length || 0,
        tags: contact.tags?.map(tag => ({
          id: tag.id,
          name: tag.name,
          assigned_at: tag.assigned_at,
          assigned_at_type: typeof tag.assigned_at
        }))
      });
    }
  }

  /**
   * Formatear fecha en formato relativo (hace X días)
   */
  formatDateRelative(dateString: string): string {
    if (!dateString) {
      return '';
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) {
        return 'Hace menos de 1h';
      } else if (diffInHours < 24) {
        return `Hace ${diffInHours}h`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays === 1) {
          return 'Hace 1 día';
        } else if (diffInDays < 30) {
          return `Hace ${diffInDays} días`;
        } else if (diffInDays < 365) {
          const diffInMonths = Math.floor(diffInDays / 30);
          return diffInMonths === 1 ? 'Hace 1 mes' : `Hace ${diffInMonths} meses`;
        } else {
          const diffInYears = Math.floor(diffInDays / 365);
          return diffInYears === 1 ? 'Hace 1 año' : `Hace ${diffInYears} años`;
        }
      }
    } catch (error) {
      return '';
    }
  }

  // ============================================================================
  // CONTACT FORM METHODS
  // ============================================================================

  /**
   * Abrir modal para crear nuevo contacto
   */
  openNewContactModal(): void {
    this.editingContact.set(null);
    this.showContactForm.set(true);
  }

  /**
   * Abrir modal para editar contacto existente
   */
  openEditContactModal(contact: Contact): void {
    this.editingContact.set(contact);
    this.showContactForm.set(true);
  }

  /**
   * Cerrar modal de formulario de contacto
   */
  closeContactForm(): void {
    this.showContactForm.set(false);
    this.editingContact.set(null);
  }

  /**
   * Manejar guardado de contacto (crear/editar)
   */
  onContactSaved(contact: Contact): void {
    console.log('Contact saved:', contact);
    
    // Si es edición, actualizar el contacto en la lista
    if (this.editingContact()) {
      const currentContacts = this.contacts();
      const updatedContacts = currentContacts.map(c => 
        c.id === contact.id ? contact : c
      );
      this.contacts.set(updatedContacts);
    } else {
      // Si es nuevo, agregarlo al inicio de la lista
      const currentContacts = this.contacts();
      this.contacts.set([contact, ...currentContacts]);
      this.totalContacts.set(this.totalContacts() + 1);
    }

    this.closeContactForm();
  }

  // ============================================================================
  // IMPORT METHODS
  // ============================================================================

  /**
   * Abrir modal de importación
   */
  openImportModal(): void {
    this.showImportModal.set(true);
  }

  /**
   * Cerrar modal de importación
   */
  closeImportModal(): void {
    this.showImportModal.set(false);
  }

  /**
   * Manejar resultado de importación
   */
  onImportCompleted(result: { success: boolean; message: string; count?: number }): void {
    console.log('Import completed:', result);
    
    if (result.success && result.count && result.count > 0) {
      // Recargar la lista de contactos para mostrar los nuevos
      this.loadContacts();
    }

    this.closeImportModal();
  }
}
