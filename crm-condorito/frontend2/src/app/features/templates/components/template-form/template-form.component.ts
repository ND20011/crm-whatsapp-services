import { Component, OnInit, inject, signal, ChangeDetectionStrategy, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { of, Subject, Subscription } from 'rxjs';

import { TemplatesService } from '../../services/templates.service';
import { 
  MessageTemplate, 
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateVariable,
  TemplateCategory
} from '../../../../core/models/template.models';
import { LoadingService } from '../../../../core/services/loading.service';

/**
 * Componente profesional para crear y editar templates de mensajes
 */
@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule
  ],
  templateUrl: './template-form.component.html',
  styleUrl: './template-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateFormComponent implements OnInit, OnDestroy {
  private templatesService = inject(TemplatesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  public loadingService = inject(LoadingService);

  @ViewChild('contentTextarea', { static: false }) contentTextarea!: ElementRef<HTMLTextAreaElement>;

  // ============================================================================
  // SIGNALS
  // ============================================================================

  public template = signal<MessageTemplate | null>(null);
  public categories = signal<TemplateCategory[]>([]);
  public isLoading = signal<boolean>(false);
  public isEditMode = signal<boolean>(false);
  public templateId = signal<number | null>(null);
  
  // Preview
  public previewContent = signal<string>('');
  public showPreview = signal<boolean>(false);
  public extractedVariables = signal<string[]>([]);

  // Messages
  public successMessage = signal<string>('');
  public errorMessage = signal<string>('');

  // Common variables for suggestions (variables reales del sistema)
  public commonVariables = [
    'NOMBRE_CONTACTO', 'TELEFONO', 'FECHA', 'HORA', 'FECHA_HORA'
  ];

  // Sample data for preview (valores reales del sistema)
  private sampleData: { [key: string]: string } = {
    'NOMBRE_CONTACTO': 'Juan Pérez',
    'TELEFONO': '5491150239962',
    'FECHA': '03/10/2025',
    'HORA': '14:30:25',
    'FECHA_HORA': '03/10/2025, 14:30:25'
  };

  // ============================================================================
  // FORMS
  // ============================================================================

  public templateForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
    content: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    category: ['general', Validators.required],
    is_active: [true],
    variables: this.fb.array([])
  });

  private contentChangeSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];

  // Removed FontAwesome icons - using CSS icons instead

  constructor() {}

  ngOnInit(): void {
    this.loadCategories();
    this.setupContentWatcher();
    this.setupFormWatchers();
    
    // Check if we're in edit mode
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        if (params['id']) {
          this.isEditMode.set(true);
          this.templateId.set(+params['id']);
          this.loadTemplate(+params['id']);
        } else {
          this.isEditMode.set(false);
          this.setupNewTemplate();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  get variablesArray(): FormArray {
    return this.templateForm.get('variables') as FormArray;
  }

  getFieldError(controlName: string): string | null {
    const control = this.templateForm.get(controlName);
    if (control?.invalid && (control?.dirty || control?.touched)) {
      if (control.errors?.['required']) {
        return 'Este campo es requerido.';
      }
      if (control.errors?.['minlength']) {
        return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
      }
      if (control.errors?.['maxlength']) {
        return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
      }
      if (control.errors?.['pattern']) {
        return 'Formato inválido.';
      }
    }
    return null;
  }

  getVariableFieldError(index: number, fieldName: string): string | null {
    const control = this.variablesArray.at(index).get(fieldName);
    if (control?.invalid && (control?.dirty || control?.touched)) {
      if (control.errors?.['required']) {
        return 'Este campo es requerido.';
      }
      if (control.errors?.['minlength']) {
        return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
      }
      if (control.errors?.['maxlength']) {
        return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
      }
    }
    return null;
  }

  // ============================================================================
  // SETUP METHODS
  // ============================================================================

  private setupContentWatcher(): void {
    this.subscriptions.push(
      this.contentChangeSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(content => {
          const extracted = this.templatesService.extractVariablesFromContent(content);
          this.extractedVariables.set(extracted);
          this.syncVariablesFormArray(extracted);
          this.updatePreview();
        })
      ).subscribe()
    );
  }

  private setupFormWatchers(): void {
    // Watch for form changes to update preview
    this.subscriptions.push(
      this.templateForm.valueChanges.pipe(
        debounceTime(300),
        tap(() => this.updatePreview())
      ).subscribe()
    );
  }

  private setupNewTemplate(): void {
    this.templateForm.reset({
      name: '',
      content: '',
      category: 'general',
      is_active: true
    });
    this.clearVariablesArray();
    this.extractedVariables.set([]);
    this.previewContent.set('');
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  private loadCategories(): void {
    console.log('🔍 Cargando categorías...');
    
    // Categorías por defecto en caso de error
    const defaultCategories = [
      { category: 'general', count: 0 },
      { category: 'saludo', count: 0 },
      { category: 'despedida', count: 0 },
      { category: 'promocion', count: 0 },
      { category: 'seguimiento', count: 0 },
      { category: 'soporte', count: 0 }
    ];
    
    this.subscriptions.push(
      this.templatesService.getCategories().subscribe({
        next: (response) => {
          console.log('📦 Respuesta de categorías:', response);
          if (response.success && response.categories && response.categories.length > 0) {
            console.log('✅ Categorías cargadas desde backend:', response.categories);
            this.categories.set(response.categories);
          } else {
            console.log('⚠️ No hay categorías en backend, usando por defecto');
            this.categories.set(defaultCategories);
          }
        },
        error: (error) => {
          console.error('❌ Error loading categories:', error);
          console.log('🔄 Usando categorías por defecto');
          this.categories.set(defaultCategories);
        }
      })
    );
  }

  private loadTemplate(id: number): void {
    this.isLoading.set(true);
    this.clearMessages();
    
    this.subscriptions.push(
      this.templatesService.getTemplate(id).subscribe({
        next: (response) => {
          if (response.success && response.template) {
            const template = response.template;
            this.template.set(template);
            
            this.templateForm.patchValue({
              name: template.name,
              content: template.content,
              category: template.category,
              is_active: template.is_active
            });
            
            // Trigger content change to extract variables
            this.contentChangeSubject.next(template.content);
            
            // Sync variables if they exist
            if (template.variables && Array.isArray(template.variables)) {
              this.syncVariablesFormArray(
                this.templatesService.extractVariablesFromContent(template.content),
                template.variables
              );
            }
          } else {
            this.errorMessage.set('Template no encontrado');
            this.router.navigate(['/templates/list']);
          }
        },
        error: (error) => {
          console.error('Error loading template:', error);
          this.errorMessage.set('Error al cargar el template');
          this.router.navigate(['/templates/list']);
        },
        complete: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  // ============================================================================
  // FORM MANAGEMENT
  // ============================================================================

  onContentChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.contentChangeSubject.next(textarea.value);
  }

  private syncVariablesFormArray(extracted: string[], existingVariables: TemplateVariable[] = []): void {
    // Clear current variables
    this.clearVariablesArray();
    
    // Add form groups for each extracted variable
    extracted.forEach(varName => {
      const existing = existingVariables.find(v => v.name === varName);
      this.variablesArray.push(this.fb.group({
        name: [varName, Validators.required],
        description: [existing?.description || '', Validators.maxLength(255)],
        type: [existing?.type || 'text', Validators.required],
        default_value: [existing?.default_value || '', Validators.maxLength(255)],
        is_required: [existing?.required || false]
      }));
    });
  }

  private clearVariablesArray(): void {
    while (this.variablesArray.length !== 0) {
      this.variablesArray.removeAt(0);
    }
  }

  insertVariable(variable: string): void {
    const textarea = this.contentTextarea?.nativeElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = this.templateForm.get('content')?.value || '';
      const variableText = `{${variable}}`;
      
      const newValue = currentValue.substring(0, start) + variableText + currentValue.substring(end);
      
      this.templateForm.patchValue({ content: newValue });
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableText.length, start + variableText.length);
      }, 0);
      
      this.contentChangeSubject.next(newValue);
    }
  }

  removeVariableFromContent(variable: string): void {
    const currentContent = this.templateForm.get('content')?.value || '';
    const regex = new RegExp(`\\{\\s*${variable}\\s*\\}`, 'g');
    const newContent = currentContent.replace(regex, '');
    
    this.templateForm.patchValue({ content: newContent });
    this.contentChangeSubject.next(newContent);
  }

  // ============================================================================
  // PREVIEW FUNCTIONALITY
  // ============================================================================

  togglePreview(): void {
    this.showPreview.set(!this.showPreview());
    if (this.showPreview()) {
      this.updatePreview();
    }
  }

  private updatePreview(): void {
    const content = this.templateForm.get('content')?.value || '';
    if (content) {
      const processed = this.templatesService.processTemplateContent(content, this.sampleData);
      this.previewContent.set(processed);
    } else {
      this.previewContent.set('');
    }
  }

  getSampleValue(variable: string): string {
    return this.sampleData[variable] || `[${variable}]`;
  }

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  onSubmit(): void {
    if (this.templateForm.valid) {
      this.isLoading.set(true);
      this.clearMessages();

      const formValue = this.templateForm.value;
      const templateData = {
        name: formValue.name.trim(),
        content: formValue.content.trim(),
        category: formValue.category,
        is_active: formValue.is_active,
        variables: formValue.variables || []
      };

      const operation = this.isEditMode() 
        ? this.templatesService.updateTemplate(this.templateId()!, templateData)
        : this.templatesService.createTemplate(templateData);

      this.subscriptions.push(
        operation.subscribe({
          next: (response) => {
            if (response.success) {
              this.successMessage.set(
                this.isEditMode() 
                  ? 'Template actualizado exitosamente' 
                  : 'Template creado exitosamente'
              );
              
              setTimeout(() => {
                this.router.navigate(['/templates/list']);
              }, 1500);
            } else {
              this.errorMessage.set(response.message || 'Error al procesar el template');
            }
          },
          error: (error) => {
            console.error('Error saving template:', error);
            this.errorMessage.set('Error al guardar el template');
          },
          complete: () => {
            this.isLoading.set(false);
          }
        })
      );
    } else {
      // Mark all fields as touched to show validation errors
      this.templateForm.markAllAsTouched();
      this.errorMessage.set('Por favor, corrige los errores en el formulario');
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  cancel(): void {
    if (this.templateForm.dirty) {
      if (confirm('¿Estás seguro de que quieres salir? Los cambios no guardados se perderán.')) {
        this.router.navigate(['/templates/list']);
      }
    } else {
      this.router.navigate(['/templates/list']);
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  private clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.clearMessages();
    }, 5000);
  }
}