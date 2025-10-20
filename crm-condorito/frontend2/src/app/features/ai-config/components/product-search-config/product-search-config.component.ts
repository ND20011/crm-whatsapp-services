import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';
import { 
  AIConfigService, 
  ProductSearchConfiguration, 
  ProductSearchTestResult,
  ProductSearchStats
} from '../../services/ai-config.service';
import { AuthService } from '../../../auth/services/auth.service';
import { StorageService } from '../../../../core/services/storage.service';

/**
 * 🛒 Componente para configurar búsqueda de productos con IA
 */
@Component({
  selector: 'app-product-search-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './product-search-config.component.html',
  styleUrl: './product-search-config.component.scss'
})
export class ProductSearchConfigComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  configForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  isTesting = false;
  isLoadingStats = false;
  isClearingCache = false;
  
  // Estados de UI
  showAdvancedSettings = false;
  showTestSection = false;
  showStatsSection = false;
  showConfigFields = false;
  
  // Test de búsqueda
  testTerm = '';
  testResult: ProductSearchTestResult | null = null;
  
  // Estadísticas
  stats: ProductSearchStats | null = null;
  
  // Mensajes de estado
  successMessage = '';
  errorMessage = '';
  
  // Configuración actual
  currentConfig: ProductSearchConfiguration | null = null;

  // Debug info
  debugInfo = {
    hasToken: false,
    currentUser: null as any,
    isAuthenticated: false
  };

  constructor(
    private fb: FormBuilder,
    private aiConfigService: AIConfigService,
    private authService: AuthService,
    private storageService: StorageService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
    this.updateDebugInfo();
    
    // Inicializar visibilidad de campos basado en el valor del formulario
    this.showConfigFields = this.configForm.get('product_search_enabled')?.value || false;
  }

  ngOnInit(): void {
    console.log('🛒 ProductSearchConfigComponent initialized');
    console.log('🛒 Form initial state:', this.configForm.value);
    console.log('🛒 Form valid:', this.configForm.valid);
    this.loadConfiguration();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Actualizar información de debug
   */
  private updateDebugInfo(): void {
    this.debugInfo = {
      hasToken: !!this.storageService.getAccessToken(),
      currentUser: this.authService.getCurrentUser(),
      isAuthenticated: this.storageService.isAuthenticated()
    };
    console.log('🛒 Debug info updated:', this.debugInfo);
  }

  /**
   * Inicializar formulario reactivo
   */
  private initializeForm(): void {
    console.log('🛒 Initializing form...');
    this.configForm = this.fb.group({
      product_search_enabled: [false],
      product_endpoint_url: ['', [Validators.required]],
      product_endpoint_method: ['GET', Validators.required],
      product_endpoint_body: [''],
      product_endpoint_headers: ['{}'],
      product_search_param_name: ['search', Validators.required],
      product_response_path: ['data', Validators.required],
      product_max_results: [30, [Validators.required, Validators.min(1), Validators.max(100)]],
      product_cache_ttl: [600, [Validators.required, Validators.min(60), Validators.max(3600)]],
      product_timeout: [8000, [Validators.required, Validators.min(1000), Validators.max(30000)]],
      // Campos de links de productos
      product_link_enabled: [false],
      product_link_template: [''],
      product_link_id_field: ['id', Validators.required],
      product_link_text: ['Ver producto', [Validators.required, Validators.maxLength(100)]]
    });

    console.log('🛒 Form created:', this.configForm);
    console.log('🛒 Form controls:', Object.keys(this.configForm.controls));

    // Validaciones condicionales
    this.configForm.get('product_search_enabled')?.valueChanges.subscribe(enabled => {
      console.log('🛒 Search enabled changed:', enabled);
      const urlControl = this.configForm.get('product_endpoint_url');
      if (enabled) {
        urlControl?.setValidators([Validators.required, this.urlValidator]);
      } else {
        urlControl?.clearValidators();
      }
      urlControl?.updateValueAndValidity();
    });

    // Validaciones condicionales para links de productos
    this.configForm.get('product_link_enabled')?.valueChanges.subscribe(enabled => {
      console.log('🔗 Link enabled changed:', enabled);
      const templateControl = this.configForm.get('product_link_template');
      const textControl = this.configForm.get('product_link_text');
      const idFieldControl = this.configForm.get('product_link_id_field');
      
      if (enabled) {
        templateControl?.setValidators([Validators.required, this.linkTemplateValidator]);
        textControl?.setValidators([Validators.required, Validators.maxLength(100)]);
        idFieldControl?.setValidators([Validators.required]);
      } else {
        templateControl?.clearValidators();
        textControl?.setValidators([Validators.maxLength(100)]);
        idFieldControl?.clearValidators();
      }
      
      templateControl?.updateValueAndValidity();
      textControl?.updateValueAndValidity();
      idFieldControl?.updateValueAndValidity();
    });

    // Validación de JSON para headers y body
    this.configForm.get('product_endpoint_headers')?.valueChanges.subscribe(value => {
      if (value && value.trim()) {
        this.validateJson('product_endpoint_headers');
      }
    });

    this.configForm.get('product_endpoint_body')?.valueChanges.subscribe(value => {
      if (value && value.trim()) {
        this.validateJson('product_endpoint_body');
      }
    });
  }

  /**
   * Validador de URL personalizado
   */
  private urlValidator(control: any) {
    if (!control.value) return null;
    try {
      new URL(control.value);
      return null;
    } catch {
      return { invalidUrl: true };
    }
  }

  /**
   * Validador de template de links personalizado
   */
  private linkTemplateValidator(control: any) {
    if (!control.value) return null;
    
    const template = control.value;
    
    // Debe ser una URL válida (sin variables)
    if (!template.includes('{PRODUCT_ID}') && !template.includes('{SEARCH_TERM}')) {
      try {
        new URL(template);
        return null;
      } catch {
        return { invalidLinkTemplate: true };
      }
    }
    
    // Si tiene variables, verificar que sea un formato URL válido
    const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    if (!urlPattern.test(template)) {
      return { invalidLinkTemplate: true };
    }
    
    // Verificar que no tenga variables inválidas
    const validVariables = ['{PRODUCT_ID}', '{SEARCH_TERM}'];
    const variables = template.match(/\{[^}]+\}/g) || [];
    
    for (const variable of variables) {
      if (!validVariables.includes(variable)) {
        return { invalidVariable: { variable } };
      }
    }
    
    return null;
  }

  /**
   * Validar JSON en campos específicos
   */
  private validateJson(fieldName: string): void {
    const control = this.configForm.get(fieldName);
    if (control && control.value && control.value.trim()) {
      try {
        JSON.parse(control.value);
        control.setErrors(null);
      } catch {
        control.setErrors({ invalidJson: true });
      }
    }
  }

  /**
   * Verificar si el paso 1 es válido
   */
  isStep1Valid(): boolean {
    const url = this.configForm.get('product_endpoint_url');
    return !!(url?.valid && url.value);
  }

  /**
   * Verificar si el paso 2 es válido
   */
  isStep2Valid(): boolean {
    const param = this.configForm.get('product_search_param_name');
    const path = this.configForm.get('product_response_path');
    return !!(param?.valid && param.value && path?.valid && path.value);
  }

  /**
   * Manejar cambio del toggle principal
   */
  onToggleChange(event: any): void {
    const isEnabled = event.target.checked;
    console.log('🛒 Toggle changed to:', isEnabled);
    
    // Actualizar el formulario
    this.configForm.patchValue({ product_search_enabled: isEnabled });
    
    // Actualizar la visibilidad de los campos
    this.showConfigFields = isEnabled;
    
    // Si se desactiva, cerrar secciones abiertas
    if (!isEnabled) {
      this.showAdvancedSettings = false;
      this.showTestSection = false;
    }
    
    // Forzar detección de cambios
    this.cdr.detectChanges();
    
    console.log('🛒 showConfigFields updated to:', this.showConfigFields);
  }

  /**
   * Manejar cambios en el toggle de links
   */
  onLinkToggleChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const enabled = checkbox.checked;
    
    console.log('🔗 Link toggle changed:', enabled);
    this.configForm.get('product_link_enabled')?.setValue(enabled);
    this.clearMessages();
  }

  /**
   * Cargar configuración actual
   */
  loadConfiguration(): void {
    console.log('🛒 Loading product search configuration...');
    this.isLoading = true;
    this.clearMessages();
    
    this.aiConfigService.getProductSearchConfig()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
          console.log('🛒 Loading finished, isLoading:', this.isLoading);
        })
      )
      .subscribe({
        next: (response) => {
          console.log('🛒 Configuration loaded successfully:', response);
          if (response.success) {
            this.currentConfig = response.data;
            this.configForm.patchValue(response.data);
            
            // Actualizar visibilidad de campos
            this.showConfigFields = response.data.product_search_enabled || false;
            
            console.log('🛒 Form updated with configuration:', this.configForm.value);
            console.log('🛒 showConfigFields set to:', this.showConfigFields);
          }
        },
        error: (error) => {
          console.log('🛒 No configuration found or error:', error);
          console.log('ℹ️ No existe configuración de productos, mostrando formulario para crear nueva');
          this.currentConfig = null;
          this.errorMessage = '';
        }
      });
  }

  /**
   * Guardar configuración
   */
  onSave(): void {
    if (this.configForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSaving = true;
    this.clearMessages();
    
    const formValue = this.configForm.value;
    
    this.aiConfigService.updateProductSearchConfig(formValue)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.currentConfig = response.data;
            this.successMessage = 'Configuración de búsqueda de productos guardada exitosamente';
            this.scrollToTop();
          }
        },
        error: (error) => {
          console.error('Error saving product search config:', error);
          this.errorMessage = error.message || 'Error al guardar la configuración';
          this.scrollToTop();
        }
      });
  }

  /**
   * Marcar todos los campos del formulario como tocados
   */
  private markFormGroupTouched(): void {
    Object.keys(this.configForm.controls).forEach(key => {
      const control = this.configForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Limpiar mensajes de estado
   */
  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  /**
   * Scroll al top de la página
   */
  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Toggle secciones
   */
  toggleAdvancedSettings(): void {
    this.showAdvancedSettings = !this.showAdvancedSettings;
  }

  toggleTestSection(): void {
    this.showTestSection = !this.showTestSection;
  }

  toggleStatsSection(): void {
    this.showStatsSection = !this.showStatsSection;
    if (this.showStatsSection && !this.stats) {
      this.loadStats();
    }
  }

  /**
   * Probar configuración de búsqueda
   */
  onTestSearch(): void {
    if (!this.testTerm.trim()) {
      this.errorMessage = 'Por favor ingresa un termino de busqueda para probar';
      return;
    }

    this.isTesting = true;
    this.clearMessages();
    this.testResult = null;
    
    const testConfig = this.configForm.valid ? this.configForm.value : undefined;
    
    this.aiConfigService.testProductSearch(this.testTerm, testConfig)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isTesting = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.testResult = response.data;
            this.successMessage = 'Prueba de busqueda completada exitosamente';
          }
        },
        error: (error) => {
          console.error('Error testing product search:', error);
          this.errorMessage = error.message || 'Error al probar la busqueda de productos';
        }
      });
  }

  /**
   * Cargar estadísticas del cache
   */
  loadStats(): void {
    this.isLoadingStats = true;
    this.clearMessages();
    
    this.aiConfigService.getProductSearchStats()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingStats = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.stats = response.data;
          }
        },
        error: (error) => {
          console.error('Error loading stats:', error);
          this.errorMessage = error.message || 'Error al cargar estadisticas';
        }
      });
  }

  /**
   * Limpiar cache de productos
   */
  onClearCache(): void {
    if (!confirm('Estas seguro de que quieres limpiar el cache de busqueda de productos?')) {
      return;
    }

    this.isClearingCache = true;
    this.clearMessages();
    
    this.aiConfigService.clearProductSearchCache()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isClearingCache = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = `Cache limpiado: ${response.data.entriesDeleted} entradas eliminadas`;
            // Recargar estadísticas si están visibles
            if (this.showStatsSection) {
              this.loadStats();
            }
          }
        },
        error: (error) => {
          console.error('Error clearing cache:', error);
          this.errorMessage = error.message || 'Error al limpiar el cache';
        }
      });
  }

  /**
   * Obtener error de un campo específico
   */
  getFieldError(fieldName: string): string {
    const field = this.configForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['invalidUrl']) return 'URL invalida';
      if (field.errors['invalidJson']) return 'JSON invalido';
      if (field.errors['invalidLinkTemplate']) return 'Template de link inválido. Debe ser una URL válida.';
      if (field.errors['invalidVariable']) return `Variable inválida: ${field.errors['invalidVariable'].variable}. Use {PRODUCT_ID} o {SEARCH_TERM}`;
      if (field.errors['min']) return `Valor minimo: ${field.errors['min'].min}`;
      if (field.errors['max']) return `Valor maximo: ${field.errors['max'].max}`;
      if (field.errors['maxlength']) return `Máximo ${field.errors['maxlength'].requiredLength} caracteres`;
    }
    return '';
  }

  /**
   * Verificar si un campo tiene error
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.configForm.get(fieldName);
    return !!(field && field.errors && field.touched);
  }

  /**
   * Obtener nombre del método HTTP con color
   */
  getMethodClass(method: string): string {
    return method === 'GET' ? 'badge-success' : 'badge-primary';
  }

  /**
   * Aplicar configuración de ejemplo
   */
  applyExampleConfig(): void {
    const exampleConfig = {
      product_search_enabled: true,
      product_endpoint_url: 'https://api.ejemplo.com/productos/buscar',
      product_endpoint_method: 'GET',
      product_endpoint_body: '',
      product_endpoint_headers: JSON.stringify({
        "Authorization": "Bearer tu_token_aqui",
        "Content-Type": "application/json"
      }, null, 2),
      product_search_param_name: 'q',
      product_response_path: 'data',
      product_max_results: 30,
      product_cache_ttl: 600,
      product_timeout: 8000
    };

    this.configForm.patchValue(exampleConfig);
    this.showConfigFields = true; // Mostrar campos ya que habilitamos el sistema
    this.successMessage = 'Configuracion de ejemplo aplicada. Personaliza los valores segun tu API.';
    this.scrollToTop();
  }

  /**
   * Limpiar resultados de prueba
   */
  clearTestResults(): void {
    this.testResult = null;
    this.testTerm = '';
  }
}