import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { IntelligentRulesService, IntelligentRule, RulesStats } from '../../../../core/services/intelligent-rules.service';
import { ContactsService } from '../../../contacts/services/contacts.service';

@Component({
  selector: 'app-intelligent-rules-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './intelligent-rules-list.component.html',
  styleUrls: ['./intelligent-rules-list.component.scss']
})
export class IntelligentRulesListComponent implements OnInit, OnDestroy {
  private intelligentRulesService = inject(IntelligentRulesService);
  private contactsService = inject(ContactsService);
  private router = inject(Router);
  
  // ============================================================================
  // SIGNALS
  // ============================================================================
  
  public rules = signal<IntelligentRule[]>([]);
  public stats = signal<RulesStats | null>(null);
  public loading = signal<boolean>(false);
  public systemEnabled = signal<boolean>(true);
  
  // Filtros
  public searchTerm = signal<string>('');
  public filterActive = signal<boolean | null>(null);
  public filterActionType = signal<string>('');
  
  // Paginación
  public currentPage = signal<number>(1);
  public itemsPerPage = signal<number>(10);
  
  // Modal de prueba
  public showTestModal = signal<boolean>(false);
  public testingRule = signal<IntelligentRule | null>(null);
  public testMessage = signal<string>('');
  public testResult = signal<any>(null);
  public testLoading = signal<boolean>(false);

  // Tags disponibles para mostrar nombres
  public availableTags = signal<any[]>([]);

  // Helper para template
  public Array = Array;

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  public filteredRules = computed(() => {
    let filtered = this.rules();
    console.log('🔍 Filtrando reglas. Total rules:', filtered.length);
    
    // Filtro por búsqueda
    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(rule => 
        rule.name.toLowerCase().includes(term) ||
        rule.description?.toLowerCase().includes(term) ||
        rule.trigger_keywords.some(keyword => keyword.toLowerCase().includes(term))
      );
      console.log('🔍 Después de filtro búsqueda:', filtered.length);
    }

    // Filtro por estado activo
    if (this.filterActive() !== null) {
      filtered = filtered.filter(rule => rule.is_active === this.filterActive());
      console.log('🔍 Después de filtro activo:', filtered.length);
    }

    // Filtro por tipo de acción
    if (this.filterActionType()) {
      filtered = filtered.filter(rule => rule.action_type === this.filterActionType());
      console.log('🔍 Después de filtro acción:', filtered.length);
    }

    console.log('🔍 Reglas filtradas finales:', filtered.length);
    return filtered;
  });

  public paginatedRules = computed(() => {
    const filtered = this.filteredRules();
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    const end = start + this.itemsPerPage();
    return filtered.slice(start, end);
  });

  public totalPages = computed(() => {
    return Math.ceil(this.filteredRules().length / this.itemsPerPage());
  });

  public paginationInfo = computed(() => {
    const filtered = this.filteredRules();
    const start = (this.currentPage() - 1) * this.itemsPerPage() + 1;
    const end = Math.min(this.currentPage() * this.itemsPerPage(), filtered.length);
    return { start, end, total: filtered.length };
  });

  public hasActiveFilters = computed(() => {
    return this.searchTerm() !== '' ||
           this.filterActive() !== null ||
           this.filterActionType() !== '';
  });

  // ============================================================================
  // SUBJECTS AND SUBSCRIPTIONS
  // ============================================================================
  
  private searchSubject = new Subject<string>();
  private subscriptions = new Subscription();

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    this.setupFilterSubscriptions();
    this.loadRules();
    this.loadStats();
    this.loadConfig();
    this.loadAvailableTags();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Configura las suscripciones para los filtros y la búsqueda.
   */
  setupFilterSubscriptions(): void {
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.currentPage.set(1); // Reset to first page when searching
      })
    );
  }

  // ============================================================================
  // DATA LOADING METHODS
  // ============================================================================

  /**
   * Cargar todas las reglas
   */
  loadRules(): void {
    console.log('🔄 Iniciando carga de reglas...');
    this.loading.set(true);
    this.intelligentRulesService.getRules().subscribe({
      next: (response: any) => {
        console.log('📥 Respuesta del servidor:', response);
        if (response.success) {
          console.log('✅ Reglas cargadas:', response.data);
          this.rules.set(response.data);
        } else {
          console.log('❌ Error en respuesta:', response);
        }
        this.loading.set(false);
        console.log('🏁 Loading finalizado. Rules count:', this.rules().length);
      },
      error: (error: any) => {
        console.error('❌ Error loading rules:', error);
        this.showError('Error al cargar las reglas inteligentes');
        this.loading.set(false);
      }
    });
  }

  /**
   * Cargar estadísticas
   */
  loadStats(): void {
    this.intelligentRulesService.getStats().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.stats.set(response.data);
        }
      },
      error: (error: any) => {
        console.error('Error loading stats:', error);
      }
    });
  }

  /**
   * Cargar configuración del sistema
   */
  loadConfig(): void {
    this.intelligentRulesService.getConfig().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.systemEnabled.set(response.data.intelligent_rules_enabled);
        }
      },
      error: (error: any) => {
        console.error('Error loading config:', error);
      }
    });
  }

  /**
   * Cargar etiquetas disponibles
   */
  loadAvailableTags(): void {
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

  // ============================================================================
  // SEARCH AND FILTER METHODS
  // ============================================================================

  /**
   * Handle search input change with debouncing
   */
  onSearchChange(event: any): void {
    const value = typeof event === 'string' ? event : event.target?.value || '';
    this.searchTerm.set(value);
    this.searchSubject.next(value);
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.searchTerm.set('');
    this.filterActive.set(null);
    this.filterActionType.set('');
    this.currentPage.set(1);
  }

  /**
   * Set active filter
   */
  setActiveFilter(active: boolean | null): void {
    this.filterActive.set(active);
    this.currentPage.set(1);
  }

  /**
   * Set action type filter
   */
  setActionTypeFilter(actionType: string): void {
    this.filterActionType.set(actionType);
    this.currentPage.set(1);
  }

  // ============================================================================
  // PAGINATION METHODS
  // ============================================================================

  goToPage(page: number): void {
    if (page > 0 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  goToFirstPage(): void {
    this.goToPage(1);
  }

  goToLastPage(): void {
    this.goToPage(this.totalPages());
  }

  goToNextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  goToPrevPage(): void {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  onItemsPerPageChange(newItemsPerPage: number): void {
    this.itemsPerPage.set(newItemsPerPage);
    this.currentPage.set(1); // Reset to first page
  }

  // ============================================================================
  // SYSTEM CONFIGURATION METHODS
  // ============================================================================

  /**
   * Toggle system enabled/disabled
   */
  toggleSystem(): void {
    const newState = !this.systemEnabled();
    this.intelligentRulesService.updateConfig({ intelligent_rules_enabled: newState }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.systemEnabled.set(newState);
          this.showSuccess(`Sistema ${newState ? 'habilitado' : 'deshabilitado'} exitosamente`);
        }
      },
      error: (error: any) => {
        console.error('Error updating system config:', error);
        this.showError('Error al cambiar la configuración del sistema');
      }
    });
  }

  // ============================================================================
  // RULE ACTION METHODS
  // ============================================================================

  /**
   * Crear nueva regla
   */
  createRule(): void {
    this.router.navigate(['/intelligent-rules/new']);
  }

  /**
   * Editar regla
   */
  editRule(rule: IntelligentRule): void {
    this.router.navigate(['/intelligent-rules/edit', rule.id]);
  }

  /**
   * Eliminar regla
   */
  deleteRule(rule: IntelligentRule): void {
    if (confirm(`¿Estás seguro de que quieres eliminar la regla "${rule.name}"?`)) {
      this.intelligentRulesService.deleteRule(rule.id!).subscribe({
        next: (response: any) => {
          if (response.success) {
            this.showSuccess('Regla eliminada exitosamente');
            this.loadRules();
          }
        },
        error: (error: any) => {
          console.error('Error deleting rule:', error);
          this.showError('Error al eliminar la regla');
        }
      });
    }
  }

  /**
   * Duplicar regla
   */
  duplicateRule(rule: IntelligentRule): void {
    this.intelligentRulesService.duplicateRule(rule.id!).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.showSuccess('Regla duplicada exitosamente');
          this.loadRules();
        }
      },
      error: (error: any) => {
        console.error('Error duplicating rule:', error);
        this.showError('Error al duplicar la regla');
      }
    });
  }

  /**
   * Cambiar estado de regla
   */
  toggleRuleStatus(rule: IntelligentRule): void {
    const updatedRule = { ...rule, is_active: !rule.is_active };
    this.intelligentRulesService.updateRule(rule.id!, updatedRule).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.showSuccess(`Regla ${updatedRule.is_active ? 'activada' : 'desactivada'} exitosamente`);
          this.loadRules();
        }
      },
      error: (error: any) => {
        console.error('Error updating rule status:', error);
        this.showError('Error al cambiar el estado de la regla');
      }
    });
  }

  /**
   * Toggle rule active (alias for template)
   */
  toggleRuleActive(rule: IntelligentRule): void {
    this.toggleRuleStatus(rule);
  }

  // ============================================================================
  // TEST MODAL METHODS
  // ============================================================================

  /**
   * Abrir modal de prueba
   */
  openTestModal(rule: IntelligentRule): void {
    this.testingRule.set(rule);
    this.testMessage.set('');
    this.testResult.set(null);
    this.showTestModal.set(true);
  }

  /**
   * Cerrar modal de prueba
   */
  closeTestModal(): void {
    this.showTestModal.set(false);
    this.testingRule.set(null);
    this.testMessage.set('');
    this.testResult.set(null);
  }

  /**
   * Probar regla
   */
  testRule(): void {
    const rule = this.testingRule();
    const message = this.testMessage();
    
    if (!rule || !message.trim()) {
      this.showError('Por favor, ingresa un mensaje de prueba');
      return;
    }

    this.testLoading.set(true);
    this.intelligentRulesService.testRule(rule.id!, message).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.testResult.set(response.data);
        }
        this.testLoading.set(false);
      },
      error: (error: any) => {
        console.error('Error testing rule:', error);
        this.showError('Error al probar la regla');
        this.testLoading.set(false);
      }
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Obtener nombre de etiqueta por ID
   */
  getTagName(tagId: number): string {
    const tag = this.availableTags().find(t => t.id === tagId);
    return tag ? tag.name : `Tag ${tagId}`;
  }

  /**
   * Obtener etiqueta de acción
   */
  getActionTypeLabel(actionType: string): string {
    const labels: { [key: string]: string } = {
      'assign_tags': 'Asignar Etiquetas',
      'escalate_human': 'Derivar a Humano',
      'call_api': 'Llamar API',
      'ai_response': 'Respuesta IA',
      'hybrid': 'Híbrido'
    };
    return labels[actionType] || actionType;
  }

  /**
   * Obtener texto de tipo de acción (alias para template)
   */
  getActionTypeText(actionType: string): string {
    return this.getActionTypeLabel(actionType);
  }

  /**
   * Obtener texto de tipo de coincidencia
   */
  getMatchTypeText(matchType: string): string {
    const labels: { [key: string]: string } = {
      'any': 'Cualquier palabra',
      'all': 'Todas las palabras',
      'exact_phrase': 'Frase exacta'
    };
    return labels[matchType] || matchType;
  }

  /**
   * Obtener clase CSS para tipo de acción
   */
  getActionTypeClass(actionType: string): string {
    const classes: { [key: string]: string } = {
      'assign_tags': 'badge-primary',
      'escalate_human': 'badge-warning',
      'call_api': 'badge-info',
      'ai_response': 'badge-success',
      'hybrid': 'badge-secondary'
    };
    return classes[actionType] || 'badge-light';
  }

  /**
   * Obtener color de etiqueta
   */
  getTagColor(tagId: number): string {
    const tag = this.availableTags().find(t => t.id === tagId);
    return tag?.color || '#6c757d';
  }

  /**
   * Formatear fecha para mostrar
   */
  formatDate(dateString: string | null): string {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Cambiar página (alias para goToPage)
   */
  changePage(page: number): void {
    this.goToPage(page);
  }

  /**
   * Mostrar mensaje de éxito
   */
  showSuccess(message: string): void {
    // Implementar notificación de éxito
    console.log('SUCCESS:', message);
  }

  /**
   * Mostrar mensaje de error
   */
  showError(message: string): void {
    // Implementar notificación de error
    console.error('ERROR:', message);
  }

  /**
   * Track by function for ngFor performance
   */
  trackByRuleId(index: number, rule: IntelligentRule): number {
    return rule.id || index;
  }
}
