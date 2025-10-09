import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { APP_CONFIG } from '../../../core/config/app.config';
import { 
  ContactTag, 
  Contact, 
  CreateTagRequest, 
  UpdateTagRequest, 
  AssignTagsRequest,
  TagsResponse, 
  ContactsResponse, 
  ApiResponse,
  ContactFilters,
  TagFilters,
  AutoMessageConfigRequest,
  AutoMessageConfigResponse,
  AutoMessagesResponse,
  MessageTemplate
} from '../models/contact.models';

// ============================================================================
// CONTACTS SERVICE - CRM CONDORITO FRONTEND
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  private apiService = inject(ApiService);

  // ============================================================================
  // GESTIÓN DE ETIQUETAS/TAGS
  // ============================================================================

  /**
   * Obtener todas las etiquetas del cliente
   */
  getTags(filters?: TagFilters): Observable<TagsResponse> {
    const params: any = {};
    
    if (filters?.search) params.search = filters.search;
    if (filters?.sortBy) params.sortBy = filters.sortBy;
    if (filters?.sortOrder) params.sortOrder = filters.sortOrder;

    return this.apiService.get<TagsResponse>(APP_CONFIG.api.endpoints.contacts.tags, { params });
  }

  /**
   * Crear nueva etiqueta
   */
  createTag(tagData: CreateTagRequest): Observable<ApiResponse<ContactTag>> {
    return this.apiService.post<ApiResponse<ContactTag>>(APP_CONFIG.api.endpoints.contacts.createTag, tagData);
  }

  /**
   * Actualizar etiqueta existente
   */
  updateTag(tagId: number, tagData: UpdateTagRequest): Observable<ApiResponse<ContactTag>> {
    const endpoint = APP_CONFIG.api.endpoints.contacts.updateTag.replace('{id}', tagId.toString());
    return this.apiService.put<ApiResponse<ContactTag>>(endpoint, tagData);
  }

  /**
   * Eliminar etiqueta
   */
  deleteTag(tagId: number): Observable<ApiResponse> {
    const endpoint = APP_CONFIG.api.endpoints.contacts.deleteTag.replace('{id}', tagId.toString());
    return this.apiService.delete<ApiResponse>(endpoint);
  }

  /**
   * Obtener contactos de una etiqueta específica
   */
  getTagContacts(tagId: number, filters?: ContactFilters): Observable<ContactsResponse> {
    const params: any = {};
    
    if (filters?.search) params.search = filters.search;
    if (filters?.sortBy) params.sortBy = filters.sortBy;
    if (filters?.sortOrder) params.sortOrder = filters.sortOrder;
    if (filters?.page) params.page = filters.page;
    if (filters?.limit) params.limit = filters.limit;

    const endpoint = APP_CONFIG.api.endpoints.contacts.tagContacts.replace('{id}', tagId.toString());
    return this.apiService.get<ContactsResponse>(endpoint, { params });
  }

  // ============================================================================
  // GESTIÓN DE CONTACTOS
  // ============================================================================

  /**
   * Obtener lista de contactos con filtros
   */
  getContacts(filters?: ContactFilters): Observable<ContactsResponse> {
    const params: any = {};
    
    if (filters?.search) params.search = filters.search;
    if (filters?.tagId) params.tagId = filters.tagId;
    if (filters?.tagIds && filters.tagIds.length > 0) params.tagIds = filters.tagIds.join(',');
    if (filters?.tagAssignedFrom) params.tagAssignedFrom = filters.tagAssignedFrom;
    if (filters?.tagAssignedTo) params.tagAssignedTo = filters.tagAssignedTo;
    if (filters?.untagged) params.untagged = filters.untagged;
    if (filters?.isBlocked !== undefined) params.isBlocked = filters.isBlocked;
    if (filters?.sortBy) params.sortBy = filters.sortBy;
    if (filters?.sortOrder) params.sortOrder = filters.sortOrder;
    if (filters?.page) params.page = filters.page;
    if (filters?.limit) params.limit = filters.limit;

    return this.apiService.get<ContactsResponse>(APP_CONFIG.api.endpoints.contacts.list, { params });
  }

  /**
   * Obtener contacto específico por ID
   */
  getContact(contactId: number): Observable<ApiResponse<Contact>> {
    const endpoint = APP_CONFIG.api.endpoints.contacts.update.replace('{id}', contactId.toString());
    return this.apiService.get<ApiResponse<Contact>>(endpoint);
  }

  /**
   * Crear nuevo contacto
   */
  createContact(contactData: Partial<Contact>): Observable<ApiResponse<Contact>> {
    return this.apiService.post<ApiResponse<Contact>>(APP_CONFIG.api.endpoints.contacts.create, contactData);
  }

  /**
   * Actualizar contacto existente
   */
  updateContact(contactId: number, contactData: Partial<Contact>): Observable<ApiResponse<Contact>> {
    const endpoint = APP_CONFIG.api.endpoints.contacts.update.replace('{id}', contactId.toString());
    return this.apiService.put<ApiResponse<Contact>>(endpoint, contactData);
  }

  /**
   * Eliminar contacto
   */
  deleteContact(contactId: number): Observable<ApiResponse> {
    const endpoint = APP_CONFIG.api.endpoints.contacts.delete.replace('{id}', contactId.toString());
    return this.apiService.delete<ApiResponse>(endpoint);
  }

  // ============================================================================
  // ASIGNACIÓN DE ETIQUETAS
  // ============================================================================

  /**
   * Asignar etiquetas a un contacto
   */
  assignTagsToContact(contactId: number, tagIds: number[]): Observable<ApiResponse> {
    const endpoint = APP_CONFIG.api.endpoints.contacts.assignTags.replace('{id}', contactId.toString());
    return this.apiService.post<ApiResponse>(endpoint, { tagIds });
  }

  /**
   * Remover etiqueta específica de un contacto
   */
  removeTagFromContact(contactId: number, tagId: number): Observable<ApiResponse> {
    const endpoint = APP_CONFIG.api.endpoints.contacts.removeTag
      .replace('{id}', contactId.toString())
      .replace('{tagId}', tagId.toString());
    return this.apiService.delete<ApiResponse>(endpoint);
  }

  // ============================================================================
  // IMPORTACIÓN/EXPORTACIÓN
  // ============================================================================

  /**
   * Importar contactos desde archivo CSV
   */
  importContacts(file: File): Observable<ApiResponse> {
    const formData = new FormData();
    formData.append('csvFile', file);
    
    return this.apiService.postFormData<ApiResponse>('/api/contacts/import', formData);
  }

  /**
   * Previsualizar archivo CSV antes de importar
   */
  previewImport(file: File): Observable<ApiResponse> {
    const formData = new FormData();
    formData.append('csvFile', file);
    
    return this.apiService.postFormData<ApiResponse>('/api/contacts/import/preview', formData);
  }

  /**
   * Exportar contactos a archivo CSV
   */
  exportContacts(filters?: ContactFilters): Observable<Blob> {
    const params: any = {};
    
    if (filters?.search) params.search = filters.search;
    if (filters?.tagId) params.tagId = filters.tagId;
    if (filters?.untagged) params.untagged = filters.untagged;
    if (filters?.isBlocked !== undefined) params.isBlocked = filters.isBlocked;

    return this.apiService.getBlob(APP_CONFIG.api.endpoints.contacts.export, { params });
  }

  /**
   * Descargar plantilla CSV para importación
   */
  downloadTemplate(): Observable<Blob> {
    return this.apiService.getBlob(APP_CONFIG.api.endpoints.contacts.template);
  }

  /**
   * Obtener contactos filtrados por etiquetas (optimizado para chat)
   */
  getContactsByTags(tagIds: number[]): Observable<ApiResponse<{
    contacts: { phone_number: string; name?: string; custom_name?: string }[];
    phoneNumbers: string[];
    tagIds: number[];
    total: number;
  }>> {
    const params = { tagIds: tagIds.join(',') };
    return this.apiService.get<ApiResponse<any>>('/api/contacts/by-tags', { params });
  }

  // ============================================================================
  // UTILIDADES
  // ============================================================================

  /**
   * Validar color hexadecimal
   */
  isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  /**
   * Generar color aleatorio
   */
  generateRandomColor(): string {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffa726',
      '#ab47bc', '#ef5350', '#26a69a', '#42a5f5', '#66bb6a'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Formatear número de teléfono
   */
  formatPhoneNumber(phone: string): string {
    // Remover caracteres no numéricos excepto +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Si empieza con +54 (Argentina)
    if (cleaned.startsWith('+549')) {
      const number = cleaned.substring(4);
      if (number.length === 10) {
        return `+54 9 ${number.substring(0, 4)} ${number.substring(4, 8)} ${number.substring(8)}`;
      }
    }
    
    return cleaned;
  }

  /**
   * Obtener iniciales del nombre
   */
  getInitials(name: string): string {
    if (!name) return '?';
    
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // ============================================================================
  // 🆕 AUTO MESSAGE METHODS
  // ============================================================================

  /**
   * Obtener configuración de mensaje automático de una etiqueta
   */
  getAutoMessageConfig(tagId: number): Observable<AutoMessageConfigResponse> {
    return this.apiService.get<AutoMessageConfigResponse>(
      `${APP_CONFIG.api.endpoints.contacts.tags}/${tagId}/auto-message`
    );
  }

  /**
   * Actualizar configuración de mensaje automático de una etiqueta
   */
  updateAutoMessageConfig(tagId: number, config: AutoMessageConfigRequest): Observable<ApiResponse<ContactTag>> {
    return this.apiService.put<ApiResponse<ContactTag>>(
      `${APP_CONFIG.api.endpoints.contacts.tags}/${tagId}/auto-message`,
      config
    );
  }

  /**
   * Obtener lista de mensajes automáticos generados por una etiqueta
   */
  getAutoMessages(tagId: number): Observable<AutoMessagesResponse> {
    return this.apiService.get<AutoMessagesResponse>(
      `${APP_CONFIG.api.endpoints.contacts.tags}/${tagId}/auto-messages`
    );
  }

  /**
   * Desactivar completamente el mensaje automático de una etiqueta
   */
  disableAutoMessage(tagId: number): Observable<ApiResponse> {
    return this.apiService.delete<ApiResponse>(
      `${APP_CONFIG.api.endpoints.contacts.tags}/${tagId}/auto-message`
    );
  }

  // ============================================================================
  // MESSAGE TEMPLATES
  // ============================================================================

  /**
   * Obtener lista de templates de mensajes
   */
  getMessageTemplates(): Observable<ApiResponse<MessageTemplate[]>> {
    return this.apiService.get<ApiResponse<MessageTemplate[]>>(
      '/api/messages/templates'
    );
  }

  /**
   * Obtener variables disponibles para auto-messages
   */
  getAutoMessageVariables(): Observable<ApiResponse<any[]>> {
    return this.apiService.get<ApiResponse<any[]>>(
      `${APP_CONFIG.api.endpoints.contacts.tags}/auto-message/variables`
    );
  }
}
