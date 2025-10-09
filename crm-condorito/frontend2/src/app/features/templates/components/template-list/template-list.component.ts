import { Component, OnInit, inject, signal, ChangeDetectionStrategy, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { of, Subject, Subscription } from 'rxjs';

import { TemplatesService } from '../../services/templates.service';
import { 
  MessageTemplate, 
  TemplateCategory, 
  TemplatesListResponse, 
  TemplateStatsResponse 
} from '../../../../core/models/template.models';
import { LoadingService } from '../../../../core/services/loading.service';

/**
 * Componente profesional para la gestión de templates de mensajes
 */
@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterLink
  ],
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateListComponent implements OnInit, OnDestroy {
  private templatesService = inject(TemplatesService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  public loadingService = inject(LoadingService);

  // ============================================================================
  // SIGNALS
  // ============================================================================

  public templates = signal<MessageTemplate[]>([]);
  public categories = signal<TemplateCategory[]>([]);
  public templateStats = signal<TemplateStatsResponse['stats'] | null>(null);
  public isLoading = signal<boolean>(false);
  public totalTemplates = signal<number>(0);
  public currentPage = signal<number>(1);
  public limit = signal<number>(12);
  public totalPages = signal<number>(1);

  // Messages
  public successMessage = signal<string>('');
  public errorMessage = signal<string>('');

  // Modal states
  public selectedTemplate = signal<MessageTemplate | null>(null);
  public showDeleteModal = signal<boolean>(false);
  public showDuplicateModal = signal<boolean>(false);
  public showPreviewModal = signal<boolean>(false);
  public activeDropdown = signal<number | null>(null);

  // View mode
  public viewMode = signal<'grid' | 'table'>('grid');

  // Math for template
  public Math = Math;

  // ============================================================================
  // FORMS
  // ============================================================================

  public filterForm: FormGroup = this.fb.group({
    search: [''],
    category: [''],
    is_active: [''],
    sort_by: ['created_at'],
    sort_order: ['DESC']
  });

  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];

  // Constants
  private readonly STORAGE_KEY = 'templates-view-mode';

  // Removed FontAwesome icons - using CSS icons instead

  constructor() {}

  ngOnInit(): void {
    this.loadViewModeFromStorage();
    this.loadCategories();
    this.loadStats();
    this.setupSearch();
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // HOST LISTENERS
  // ============================================================================

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Close dropdown when clicking outside
    if (this.activeDropdown()) {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown')) {
        this.activeDropdown.set(null);
      }
    }
  }

  // ============================================================================
  // SETUP METHODS
  // ============================================================================

  private setupSearch(): void {
    // Configurar búsqueda con debounce
    this.subscriptions.push(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          this.currentPage.set(1);
          this.loadTemplates();
        })
      ).subscribe()
    );

    // Escuchar cambios en el formulario de filtros
    this.subscriptions.push(
      this.filterForm.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.currentPage.set(1);
        this.loadTemplates();
      })
    );
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  loadTemplates(): void {
    this.isLoading.set(true);
    this.clearMessages();

    const formValue = this.filterForm.value;
    const params = {
      page: this.currentPage(),
      limit: this.limit(),
      search: formValue.search || '',
      category: formValue.category || undefined,
      is_active: formValue.is_active !== '' ? formValue.is_active === 'true' : undefined,
      sort_by: formValue.sort_by || 'created_at',
      sort_order: formValue.sort_order || 'DESC'
    };

    this.subscriptions.push(
      this.templatesService.getTemplates(params).pipe(
        catchError(error => {
          console.error('Error loading templates:', error);
          this.errorMessage.set('Error al cargar los templates');
          return of({ success: false, templates: [], total: 0, page: 1, limit: 12, total_pages: 1 });
        }),
        tap(response => {
          if (response.success) {
            this.templates.set(response.templates);
            this.totalTemplates.set(response.total);
            this.totalPages.set(response.total_pages);
            this.currentPage.set(response.page);
          } else {
            this.errorMessage.set('Error al cargar los templates');
          }
          this.isLoading.set(false);
        })
      ).subscribe()
    );
  }

  private loadCategories(): void {
    this.subscriptions.push(
      this.templatesService.getCategories().subscribe({
        next: (response) => {
          if (response.success) {
            this.categories.set(response.categories);
          }
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        }
      })
    );
  }

  private loadStats(): void {
    this.subscriptions.push(
      this.templatesService.getStats().subscribe({
        next: (response) => {
          if (response.success) {
            this.templateStats.set(response.stats);
          }
        },
        error: (error) => {
          console.error('Error loading template stats:', error);
        }
      })
    );
  }

  // ============================================================================
  // SEARCH & FILTERS
  // ============================================================================

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  clearSearch(): void {
    this.filterForm.patchValue({ search: '' });
  }

  toggleSortDirection(): void {
    const currentOrder = this.filterForm.get('sort_order')?.value;
    this.filterForm.patchValue({ 
      sort_order: currentOrder === 'ASC' ? 'DESC' : 'ASC' 
    });
  }

  hasActiveFilters(): boolean {
    const formValue = this.filterForm.value;
    return !!(formValue.search || formValue.category || formValue.is_active !== '');
  }

  clearAllFilters(): void {
    this.filterForm.reset({
      search: '',
      category: '',
      is_active: '',
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
  }

  // ============================================================================
  // PAGINATION
  // ============================================================================

  onPageChange(page: number): void {
    if (page > 0 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadTemplates();
    }
  }

  getVisiblePages(): (number | string)[] {
    const current = this.currentPage();
    const total = this.totalPages();
    const pages: (number | string)[] = [];

    if (total <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (current > 4) {
        pages.push('...');
      }

      // Show pages around current
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 3) {
        pages.push('...');
      }

      // Always show last page
      if (total > 1) {
        pages.push(total);
      }
    }

    return pages;
  }

  // ============================================================================
  // DROPDOWN ACTIONS
  // ============================================================================

  toggleDropdown(templateId: number): void {
    this.activeDropdown.set(this.activeDropdown() === templateId ? null : templateId);
  }

  // ============================================================================
  // TEMPLATE ACTIONS
  // ============================================================================

  editTemplate(template: MessageTemplate): void {
    this.router.navigate(['/templates/edit', template.id]);
  }

  useTemplate(template: MessageTemplate): void {
    // TODO: Implement use template functionality
    console.log('Using template:', template);
    this.showSuccessMessage('Funcionalidad de usar template en desarrollo');
  }

  openDeleteModal(template: MessageTemplate): void {
    this.selectedTemplate.set(template);
    this.showDeleteModal.set(true);
    this.activeDropdown.set(null);
  }

  confirmDelete(): void {
    const template = this.selectedTemplate();
    if (template) {
      this.isLoading.set(true);
      this.clearMessages();
      
      this.subscriptions.push(
        this.templatesService.deleteTemplate(template.id).subscribe({
          next: (response) => {
            if (response.success) {
              this.showSuccessMessage(response.message || 'Error al procesar la solicitud');
              this.loadTemplates();
              this.loadStats();
            } else {
              this.errorMessage.set(response.message || 'Error al procesar la solicitud');
            }
          },
          error: (error) => {
            console.error('Error deleting template:', error);
            this.errorMessage.set('Error al eliminar el template');
          },
          complete: () => {
            this.isLoading.set(false);
            this.closeDeleteModal();
          }
        })
      );
    }
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.selectedTemplate.set(null);
  }

  openDuplicateModal(template: MessageTemplate): void {
    this.selectedTemplate.set(template);
    this.showDuplicateModal.set(true);
    this.activeDropdown.set(null);
  }

  confirmDuplicate(newName: string): void {
    const template = this.selectedTemplate();
    if (template && newName.trim()) {
      this.isLoading.set(true);
      this.clearMessages();
      
      this.subscriptions.push(
        this.templatesService.duplicateTemplate(template.id, newName.trim()).subscribe({
          next: (response) => {
            if (response.success) {
              this.showSuccessMessage('Template duplicado exitosamente');
              this.loadTemplates();
              this.loadStats();
            } else {
              this.errorMessage.set(response.message || 'Error al procesar la solicitud');
            }
          },
          error: (error) => {
            console.error('Error duplicating template:', error);
            this.errorMessage.set('Error al duplicar el template');
          },
          complete: () => {
            this.isLoading.set(false);
            this.closeDuplicateModal();
          }
        })
      );
    }
  }

  closeDuplicateModal(): void {
    this.showDuplicateModal.set(false);
    this.selectedTemplate.set(null);
  }

  toggleTemplateStatus(template: MessageTemplate): void {
    this.isLoading.set(true);
    this.clearMessages();
    this.activeDropdown.set(null);
    
    this.subscriptions.push(
      this.templatesService.toggleTemplate(template.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccessMessage(
              template.is_active ? 'Template desactivado' : 'Template activado'
            );
            this.loadTemplates();
            this.loadStats();
          } else {
            this.errorMessage.set(response.message || 'Error al procesar la solicitud');
          }
        },
        error: (error) => {
          console.error('Error toggling template status:', error);
          this.errorMessage.set('Error al cambiar el estado del template');
        },
        complete: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  openPreviewModal(template: MessageTemplate): void {
    this.selectedTemplate.set(template);
    this.showPreviewModal.set(true);
    this.activeDropdown.set(null);
  }

  closePreviewModal(): void {
    this.showPreviewModal.set(false);
    this.selectedTemplate.set(null);
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  getCategoryIcon(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'general': 'fas fa-clipboard-list',
      'welcome': 'fas fa-hand-sparkles',
      'farewell': 'fas fa-door-open',
      'promotion': 'fas fa-bullhorn',
      'promocion': 'fas fa-bullhorn',
      'support': 'fas fa-headset',
      'appointment': 'fas fa-calendar-check',
      'follow-up': 'fas fa-user-clock',
      'seguimiento': 'fas fa-user-clock',
      'reminder': 'fas fa-bell',
      'feedback': 'fas fa-comment-dots',
      'holiday': 'fas fa-gift',
      'saludo': 'fas fa-hand-wave',
      'undefined': 'fas fa-question-circle',
      'custom': 'fas fa-star'
    };
    return categoryMap[category] || 'fas fa-clipboard-list';
  }

  formatRelativeDate(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInHours / 24;

    if (diffInHours < 1) {
      return 'hace unos minutos';
    } else if (diffInHours < 24) {
      return `hace ${Math.floor(diffInHours)} horas`;
    } else if (diffInDays < 7) {
      return `hace ${Math.floor(diffInDays)} días`;
    } else {
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  getExtractedVariables(content: string): string[] {
    if (!content) return [];
    return this.templatesService.extractVariablesFromContent(content);
  }

  getPreviewWithSampleData(content: string): string {
    const sampleData: { [key: string]: string } = {
      'nombre': 'Juan Pérez',
      'cliente': 'María González',
      'empresa': 'Mi Empresa',
      'producto': 'Producto Premium',
      'fecha': '15/12/2024',
      'hora': '10:00 AM',
      'descuento': '20',
      'precio': '$1,500',
      'telefono': '+54 9 11 1234-5678',
      'email': 'cliente@email.com'
    };

    return this.templatesService.processTemplateContent(content, sampleData);
  }

  private showSuccessMessage(message: string): void {
    this.successMessage.set(message);
    this.clearMessagesAfterDelay();
  }

  clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  private clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.clearMessages();
    }, 5000);
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