import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AIConfigService, AIConfiguration, AIMode, AITestResponse } from '../../services/ai-config.service';
import { SoundSettingsProfessionalComponent } from '../../../../shared/components/sound-settings-professional/sound-settings-professional.component';

/**
 * 🧠 Componente para configurar IA personalizada del cliente
 */
@Component({
  selector: 'app-ai-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SoundSettingsProfessionalComponent],
  templateUrl: './ai-config.component.html',
  styleUrl: './ai-config.component.scss'
})
export class AIConfigComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  configForm!: FormGroup;
  availableModes: AIMode | null = null;
  isLoading = false;
  isSaving = false;
  isTesting = false;
  
  // Estados de UI
  showAdvancedSettings = false;
  showTestSection = false;
  
  // Test de IA
  testMessage = '';
  testResponse: AITestResponse | null = null;
  
  // Mensajes de estado
  successMessage = '';
  errorMessage = '';
  
  // Configuración actual
  currentConfig: AIConfiguration | null = null;

  constructor(
    private fb: FormBuilder,
    private aiConfigService: AIConfigService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    // Cargar datos iniciales
    this.loadInitialData();
  }

  /**
   * Cargar datos iniciales
   */
  loadInitialData(): void {
    this.isLoading = true;
    this.clearMessages();

    // Cargar modos disponibles primero
    this.aiConfigService.getModes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (modesResponse) => {
          if (modesResponse?.success) {
            this.availableModes = modesResponse.data;
          }
          
          // Después de cargar modos, cargar configuración
          this.loadConfigurationData();
        },
        error: (error) => {
          console.error('Error loading AI modes:', error);
          this.errorMessage = 'Error al cargar los modos de IA disponibles';
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Cargar datos de configuración
   */
  private loadConfigurationData(): void {
    this.aiConfigService.getConfig()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (configResponse) => {
          if (configResponse?.success) {
            this.currentConfig = configResponse.data;
            this.configForm.patchValue(configResponse.data);
            console.log('✅ Configuración de IA cargada exitosamente');
          }
        },
        error: (error) => {
          console.log('ℹ️ No existe configuración de IA, mostrando formulario para crear nueva');
          // No existe configuración, esto es normal para nuevos clientes
          this.currentConfig = null;
          this.errorMessage = '';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializar formulario reactivo
   */
  private initializeForm(): void {
    this.configForm = this.fb.group({
      enabled: [true],
      ai_mode: ['prompt_only', Validators.required],
      business_prompt: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(8000)]],
      max_tokens: [500, [Validators.required, Validators.min(50), Validators.max(2000)]],
      temperature: [0.7, [Validators.required, Validators.min(0), Validators.max(1)]],
      maxHistoryMessages: [10, [Validators.required, Validators.min(1), Validators.max(50)]],
      responseTimeout: [30000, [Validators.required, Validators.min(5000), Validators.max(60000)]],
      fallbackMessage: ['Disculpa, no pude procesar tu mensaje en este momento.', [Validators.required, Validators.maxLength(500)]],
      workingHours: this.fb.group({
        enabled: [true],
        start: ['00:00', Validators.required],
        end: ['23:59', Validators.required],
        days: [[0, 1, 2, 3, 4, 5, 6], Validators.required]
      })
    });
  }

  /**
   * Recargar configuración actual
   */
  loadConfiguration(): void {
    this.isLoading = true;
    this.clearMessages();
    
    this.aiConfigService.getConfig()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.currentConfig = response.data;
            this.configForm.patchValue(response.data);
            this.successMessage = 'Configuración recargada exitosamente';
          }
        },
        error: (error) => {
          console.error('Error loading AI config:', error);
          this.errorMessage = 'Error al cargar la configuración de IA';
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
    
    this.aiConfigService.updateConfig(formValue)
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
            this.successMessage = 'Configuración guardada exitosamente';
            this.scrollToTop();
          }
        },
        error: (error) => {
          console.error('Error saving AI config:', error);
          this.errorMessage = error.error?.message || 'Error al guardar la configuración';
          this.scrollToTop();
        }
      });
  }

  /**
   * Probar configuración con mensaje
   */
  onTestAI(): void {
    if (!this.testMessage.trim()) {
      this.errorMessage = 'Por favor ingresa un mensaje para probar';
      return;
    }

    this.isTesting = true;
    this.clearMessages();
    this.testResponse = null;
    
    console.log('🔍 Testing AI with message:', this.testMessage);
    
    this.aiConfigService.testConfig(this.testMessage)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isTesting = false;
          console.log('🔍 Testing finished, isTesting:', this.isTesting);
        })
      )
      .subscribe({
        next: (response) => {
          console.log('🔍 AI Test Response received:', response);
          if (response.success && response.data) {
            this.testResponse = response.data;
            this.isTesting = false; // Poner aquí también para asegurar que se actualice
            console.log('✅ Test response set:', this.testResponse);
            this.successMessage = 'Prueba de IA completada exitosamente';
            this.cdr.detectChanges(); // Forzar detección de cambios
          } else {
            this.isTesting = false; // También en caso de error de formato
            this.errorMessage = 'La respuesta de la IA no tiene el formato esperado';
            this.cdr.detectChanges(); // Forzar detección de cambios
          }
        },
        error: (error) => {
          console.error('❌ Error testing AI:', error);
          this.isTesting = false; // También en caso de error
          this.errorMessage = error.error?.message || 'Error al probar la IA';
          this.cdr.detectChanges(); // Forzar detección de cambios
        }
      });
  }

  /**
   * Resetear configuración a valores por defecto
   */
  onReset(): void {
    if (!confirm('¿Estás seguro de que quieres resetear la configuración a los valores por defecto?')) {
      return;
    }

    this.isLoading = true;
    this.clearMessages();
    
    this.aiConfigService.resetConfig()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.currentConfig = response.data;
            this.configForm.patchValue(response.data);
            this.successMessage = 'Configuración reseteada exitosamente';
            this.scrollToTop();
          }
        },
        error: (error) => {
          console.error('Error resetting AI config:', error);
          this.errorMessage = error.error?.message || 'Error al resetear la configuración';
          this.scrollToTop();
        }
      });
  }

  /**
   * Toggle configuraciones avanzadas
   */
  toggleAdvancedSettings(): void {
    this.showAdvancedSettings = !this.showAdvancedSettings;
  }

  /**
   * Toggle sección de pruebas
   */
  toggleTestSection(): void {
    this.showTestSection = !this.showTestSection;
  }

  /**
   * Toggle día de la semana en horarios de trabajo
   */
  toggleWorkingDay(day: number): void {
    const workingDays = this.configForm.get('workingHours.days')?.value || [];
    const index = workingDays.indexOf(day);
    
    if (index > -1) {
      workingDays.splice(index, 1);
    } else {
      workingDays.push(day);
    }
    
    workingDays.sort((a: number, b: number) => a - b);
    this.configForm.get('workingHours.days')?.setValue(workingDays);
  }

  /**
   * Verificar si un día está seleccionado
   */
  isDaySelected(day: number): boolean {
    const workingDays = this.configForm.get('workingHours.days')?.value || [];
    return workingDays.includes(day);
  }

  /**
   * Obtener nombre del día
   */
  getDayName(day: number): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days[day] || '';
  }

  /**
   * Marcar todos los campos del formulario como tocados
   */
  private markFormGroupTouched(): void {
    Object.keys(this.configForm.controls).forEach(key => {
      const control = this.configForm.get(key);
      control?.markAsTouched();
      
      if (control && typeof control.value === 'object' && control.value !== null) {
        this.markFormGroupTouched();
      }
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
   * Obtener error de un campo específico
   */
  getFieldError(fieldName: string): string {
    const field = this.configForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['minlength']) return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['maxlength']) return `Máximo ${field.errors['maxlength'].requiredLength} caracteres`;
      if (field.errors['min']) return `Valor mínimo: ${field.errors['min'].min}`;
      if (field.errors['max']) return `Valor máximo: ${field.errors['max'].max}`;
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
   * Obtener el conteo de caracteres de un campo
   */
  getCharCount(fieldName: string): number {
    const field = this.configForm.get(fieldName);
    return field?.value?.length || 0;
  }
}
