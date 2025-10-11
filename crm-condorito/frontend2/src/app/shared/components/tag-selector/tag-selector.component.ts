import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, computed, inject, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

import { ContactsService } from '../../../features/contacts/services/contacts.service';
import { ContactTag } from '../../../features/contacts/models/contact.models';

// ============================================================================
// TAG SELECTOR COMPONENT - CRM CONDORITO FRONTEND
// ============================================================================

@Component({
  selector: 'app-tag-selector',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tag-selector.component.html',
  styleUrls: ['./tag-selector.component.scss']
})
export class TagSelectorComponent implements OnInit, OnDestroy {
  // ============================================================================
  // DEPENDENCIES
  // ============================================================================
  private contactsService = inject(ContactsService);
  private elementRef = inject(ElementRef);

  // ============================================================================
  // INPUTS & OUTPUTS
  // ============================================================================
  @Input() selectedTags: ContactTag[] = [];
  @Input() disabled: boolean = false;
  @Input() multiple: boolean = true;
  @Input() placeholder: string = 'Seleccionar etiquetas...';
  @Input() maxSelections?: number;
  @Input() allowCreate: boolean = true;

  @Output() tagsChanged = new EventEmitter<ContactTag[]>();
  @Output() tagAdded = new EventEmitter<ContactTag>();
  @Output() tagRemoved = new EventEmitter<ContactTag>();
  @Output() createNewTag = new EventEmitter<{name: string, color: string}>();

  // ============================================================================
  // SIGNALS
  // ============================================================================
  availableTags = signal<ContactTag[]>([]);
  isLoading = signal<boolean>(false);
  showDropdown = signal<boolean>(false);
  searchQuery = signal<string>('');
  newTagColor = signal<string>('#007bff');

  // ============================================================================
  // FORM CONTROLS
  // ============================================================================
  searchControl = new FormControl('');
  newTagNameControl = new FormControl('');

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  TAG_COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#6c757d'];

  // ============================================================================
  // COMPUTED
  // ============================================================================
  filteredTags = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const available = this.availableTags();
    const selected = this.selectedTags;

    console.log('🔍 Filtering tags:', { 
      query, 
      availableCount: available.length, 
      selectedCount: selected.length 
    });

    let filtered = available.filter(tag => 
      !selected.some(selectedTag => selectedTag.id === tag.id)
    );

    if (query) {
      filtered = filtered.filter(tag =>
        tag.name.toLowerCase().includes(query) ||
        (tag.description && tag.description.toLowerCase().includes(query))
      );
    }

    console.log('🔍 Filtered result:', { 
      filteredCount: filtered.length, 
      tags: filtered.map(t => t.name) 
    });

    return filtered;
  });

  selectedTagsCount = computed(() => this.selectedTags.length);

  canAddMore = computed(() => {
    if (!this.maxSelections) return true;
    return this.selectedTagsCount() < this.maxSelections;
  });

  hasSearchResults = computed(() => this.filteredTags().length > 0);

  showCreateOption = computed(() => {
    const query = this.searchQuery().trim();
    return this.allowCreate && 
           query.length > 0 && 
           !this.filteredTags().some(tag => 
             tag.name.toLowerCase() === query.toLowerCase()
           );
  });

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  private subscriptions: Subscription[] = [];

  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  ngOnInit(): void {
    this.loadAvailableTags();
    this.setupSearchSubscription();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Cargar etiquetas disponibles
   */
  loadAvailableTags(): void {
    this.isLoading.set(true);

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
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Configurar suscripción de búsqueda
   */
  private setupSearchSubscription(): void {
    const subscription = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      console.log('🔍 Tag search value changed:', value);
      this.searchQuery.set(value || '');
      
      // Si no hay resultados filtrados y se permite crear, pre-llenar el campo de nueva etiqueta
      if (value && value.trim() && this.filteredTags().length === 0 && this.allowCreate) {
        this.newTagNameControl.setValue(value.trim());
      }
    });

    this.subscriptions.push(subscription);
  }

  // ============================================================================
  // DROPDOWN MANAGEMENT
  // ============================================================================

  /**
   * Abrir dropdown
   */
  openDropdown(): void {
    if (!this.disabled) {
      this.showDropdown.set(true);
    }
  }

  /**
   * Alternar dropdown
   */
  toggleDropdown(): void {
    if (!this.disabled) {
      this.showDropdown.set(!this.showDropdown());
    }
  }

  /**
   * Cerrar dropdown
   */
  closeDropdown(): void {
    this.showDropdown.set(false);
    this.searchControl.setValue('');
  }

  // ============================================================================
  // TAG SELECTION
  // ============================================================================

  /**
   * Seleccionar etiqueta
   */
  selectTag(tag: ContactTag): void {
    if (this.disabled || !this.canAddMore()) return;

    const newSelectedTags = this.multiple 
      ? [...this.selectedTags, tag]
      : [tag];

    this.selectedTags = newSelectedTags;
    this.tagsChanged.emit(newSelectedTags);
    this.tagAdded.emit(tag);

    if (!this.multiple) {
      this.closeDropdown();
    }

    // Limpiar búsqueda después de seleccionar
    this.searchControl.setValue('');
  }

  /**
   * Remover etiqueta
   */
  removeTag(tag: ContactTag): void {
    if (this.disabled) return;

    const newSelectedTags = this.selectedTags.filter(t => t.id !== tag.id);
    this.selectedTags = newSelectedTags;
    this.tagsChanged.emit(newSelectedTags);
    this.tagRemoved.emit(tag);
  }

  /**
   * Alternar selección de etiqueta
   */
  toggleTag(tag: ContactTag): void {
    if (this.isTagSelected(tag)) {
      this.removeTag(tag);
    } else {
      this.selectTag(tag);
    }
  }

  /**
   * Limpiar todas las etiquetas
   */
  clearAllTags(): void {
    if (this.disabled) return;

    this.selectedTags = [];
    this.tagsChanged.emit([]);
  }

  // ============================================================================
  // CREATE NEW TAG
  // ============================================================================

  /**
   * Crear nueva etiqueta
   */
  onCreateNewTag(): void {
    const tagName = this.newTagNameControl.value?.trim();
    if (tagName) {
      this.createNewTag.emit({
        name: tagName,
        color: this.newTagColor()
      });
      this.newTagNameControl.reset();
      this.closeDropdown();
    }
  }

  /**
   * Seleccionar color para nueva etiqueta
   */
  selectNewTagColor(color: string): void {
    this.newTagColor.set(color);
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Manejar click fuera del componente
   */
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    const component = target.closest('.tag-selector');
    
    if (!component) {
      this.closeDropdown();
    }
  }

  /**
   * Manejar teclas
   */
  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.closeDropdown();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.showCreateOption()) {
          this.onCreateNewTag();
        } else if (this.filteredTags().length === 1) {
          this.selectTag(this.filteredTags()[0]);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.openDropdown();
        break;
    }
  }

  // ============================================================================
  // TRACKBY FUNCTIONS
  // ============================================================================

  /**
   * TrackBy function para etiquetas seleccionadas
   */
  trackBySelectedTag(index: number, tag: ContactTag): number {
    return tag.id;
  }

  /**
   * TrackBy function para etiquetas filtradas
   */
  trackByFilteredTag(index: number, tag: ContactTag): number {
    return tag.id;
  }

  /**
   * TrackBy function para colores
   */
  trackByColor(index: number, color: string): string {
    return color;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Obtener texto del placeholder dinámico
   */
  getPlaceholderText(): string {
    if (this.selectedTagsCount() === 0) {
      return this.placeholder;
    }
    
    if (this.multiple) {
      return `${this.selectedTagsCount()} etiqueta${this.selectedTagsCount() > 1 ? 's' : ''} seleccionada${this.selectedTagsCount() > 1 ? 's' : ''}`;
    }
    
    return this.selectedTags[0]?.name || this.placeholder;
  }

  /**
   * Verificar si una etiqueta está seleccionada
   */
  isTagSelected(tag: ContactTag): boolean {
    return this.selectedTags.some(selectedTag => selectedTag.id === tag.id);
  }

  // ============================================================================
  // HOST LISTENERS
  // ============================================================================

  /**
   * Detectar clicks fuera del componente para cerrar el dropdown
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.showDropdown() && event.target && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  /**
   * Detectar tecla Escape para cerrar el dropdown
   */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showDropdown()) {
      this.closeDropdown();
    }
  }

}
