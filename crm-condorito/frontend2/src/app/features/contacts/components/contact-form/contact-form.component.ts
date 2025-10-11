import { Component, inject, signal, OnInit, OnDestroy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ContactsService } from '../../services/contacts.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { Contact, ContactTag, AssignTagsRequest } from '../../models/contact.models';
import { TagSelectorComponent } from '../../../../shared/components/tag-selector/tag-selector.component';

/**
 * Componente para crear/editar contactos
 */
@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TagSelectorComponent],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss'
})
export class ContactFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private contactsService = inject(ContactsService);
  public loadingService = inject(LoadingService);

  // Inputs
  public contact = input<Contact | null>(null);
  public isVisible = input<boolean>(false);

  // Outputs
  public onClose = output<void>();
  public onSaved = output<Contact>();

  // Signals
  public selectedTags = signal<ContactTag[]>([]);
  public errorMessage = signal<string>('');
  public successMessage = signal<string>('');

  // Form
  public contactForm: FormGroup;

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor() {
    this.contactForm = this.fb.group({
      phone_number: ['', [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)]],
      name: [''],
      custom_name: [''],
      comments: [''],
      is_blocked: [false]
    });
  }

  ngOnInit(): void {
    // Si hay un contacto para editar, cargar sus datos
    if (this.contact()) {
      this.loadContactData();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Cargar datos del contacto para edición
   */
  private loadContactData(): void {
    const contact = this.contact();
    if (!contact) return;

    this.contactForm.patchValue({
      phone_number: contact.phone_number,
      name: contact.name || '',
      custom_name: contact.custom_name || '',
      comments: contact.comments || '',
      is_blocked: contact.is_blocked
    });

    this.selectedTags.set(contact.tags || []);
  }

  /**
   * Manejar cambio de etiquetas seleccionadas
   */
  onTagsChanged(tags: ContactTag[]): void {
    this.selectedTags.set(tags);
  }

  /**
   * Validar número de teléfono
   */
  isPhoneValid(): boolean {
    const phoneControl = this.contactForm.get('phone_number');
    return phoneControl ? phoneControl.valid : false;
  }

  /**
   * Obtener mensaje de error del teléfono
   */
  getPhoneError(): string {
    const phoneControl = this.contactForm.get('phone_number');
    if (phoneControl?.errors) {
      if (phoneControl.errors['required']) {
        return 'El número de teléfono es obligatorio';
      }
      if (phoneControl.errors['pattern']) {
        return 'Formato de teléfono inválido (ej: +5491150239962)';
      }
    }
    return '';
  }

  /**
   * Guardar contacto
   */
  saveContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.clearMessages();
    const formData = this.contactForm.value;
    const isEditing = !!this.contact();

    // Preparar datos del contacto
    const contactData: Partial<Contact> = {
      phone_number: formData.phone_number,
      name: formData.name || null,
      custom_name: formData.custom_name || null,
      comments: formData.comments || null,
      is_blocked: formData.is_blocked
    };

    const operation = isEditing 
      ? this.contactsService.updateContact(this.contact()!.id, contactData)
      : this.contactsService.createContact(contactData);

    const loadingId = this.loadingService.startLoading('save-contact', isEditing ? 'Actualizando contacto...' : 'Creando contacto...');

    const subscription = operation.subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.successMessage.set(isEditing ? 'Contacto actualizado exitosamente' : 'Contacto creado exitosamente');
          
          // Si hay etiquetas seleccionadas, asignarlas
          if (this.selectedTags().length > 0) {
            this.assignTagsToContact(response.data);
          } else {
            // Emitir evento de guardado y cerrar
            this.onSaved.emit(response.data);
            setTimeout(() => this.close(), 1500);
          }
        } else {
          this.errorMessage.set(response.message || 'Error al guardar el contacto');
        }
      },
      error: (error) => {
        console.error('Error saving contact:', error);
        this.errorMessage.set('Error al guardar el contacto: ' + (error.message || 'Error desconocido'));
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Asignar etiquetas al contacto después de crearlo/actualizarlo
   */
  private assignTagsToContact(contact: Contact): void {
    const tagIds = this.selectedTags().map(tag => tag.id);
    
    const assignSubscription = this.contactsService.assignTagsToContact(contact.id, tagIds).subscribe({
      next: (response) => {
        if (response.success) {
          // Actualizar el contacto con las etiquetas asignadas
          contact.tags = this.selectedTags();
          this.onSaved.emit(contact);
          setTimeout(() => this.close(), 1500);
        } else {
          this.errorMessage.set('Contacto guardado pero error al asignar etiquetas: ' + response.message);
        }
      },
      error: (error) => {
        console.error('Error assigning tags:', error);
        this.errorMessage.set('Contacto guardado pero error al asignar etiquetas');
        // Aún así emitir el evento porque el contacto se guardó
        this.onSaved.emit(contact);
        setTimeout(() => this.close(), 2000);
      }
    });

    this.subscriptions.push(assignSubscription);
  }

  /**
   * Cerrar modal
   */
  close(): void {
    this.clearMessages();
    this.contactForm.reset();
    this.selectedTags.set([]);
    this.onClose.emit();
  }

  /**
   * Limpiar mensajes
   */
  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  /**
   * Obtener título del modal
   */
  getModalTitle(): string {
    return this.contact() ? 'Editar Contacto' : 'Nuevo Contacto';
  }

  /**
   * Obtener texto del botón de guardar
   */
  getSaveButtonText(): string {
    if (this.loadingService.isLoadingByContext('save-contact')) {
      return this.contact() ? 'Actualizando...' : 'Creando...';
    }
    return this.contact() ? 'Actualizar Contacto' : 'Crear Contacto';
  }
}
