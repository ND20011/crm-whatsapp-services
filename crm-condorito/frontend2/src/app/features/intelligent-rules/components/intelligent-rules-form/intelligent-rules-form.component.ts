import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IntelligentRulesService, IntelligentRule } from '../../../../core/services/intelligent-rules.service';
import { ContactsService } from '../../../contacts/services/contacts.service';

@Component({
  selector: 'app-intelligent-rules-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './intelligent-rules-form.component.html',
  styleUrls: ['./intelligent-rules-form.component.scss']
})
export class IntelligentRulesFormComponent implements OnInit {
  ruleForm!: FormGroup;
  isEditMode = false;
  ruleId: number | null = null;
  loading = false;
  saving = false;
  
  // Opciones disponibles
  actionTypes = [
    { value: 'assign_tags', label: 'Asignar Etiquetas', description: 'Aplica etiquetas automáticamente al contacto' },
    { value: 'escalate_human', label: 'Derivar a Humano', description: 'Transfiere la conversación a un agente humano' },
    { value: 'call_api', label: 'Llamar API / n8n', description: 'Consulta API externa, webhook n8n o cualquier endpoint HTTP' },
    { value: 'ai_response', label: 'Respuesta IA', description: 'Genera respuesta personalizada con IA' },
    { value: 'hybrid', label: 'Híbrido', description: 'Combina múltiples acciones' }
  ];
  
  matchTypes = [
    { value: 'any', label: 'Cualquier palabra', description: 'Coincide si encuentra cualquiera de las palabras clave' },
    { value: 'all', label: 'Todas las palabras', description: 'Coincide solo si encuentra todas las palabras clave' },
    { value: 'exact_phrase', label: 'Frase exacta', description: 'Coincide con frases exactas' }
  ];
  
  availableTags: any[] = [];

  constructor(
    private fb: FormBuilder,
    private intelligentRulesService: IntelligentRulesService,
    private contactsService: ContactsService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.loadAvailableTags();
    
    // Verificar si es modo edición
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.ruleId = +params['id'];
        this.loadRule();
      }
    });
  }

  initForm() {
    this.ruleForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      is_active: [true],
      priority: [1, [Validators.required, Validators.min(1)]],
      trigger_keywords: this.fb.array([this.createKeywordControl()], [Validators.required]),
      match_type: ['any', Validators.required],
      ai_extraction_enabled: [false],
      ai_extraction_prompt: [''],
      expected_data_fields: this.fb.array([]),
      action_type: ['assign_tags', Validators.required],
      action_config: this.fb.group({
        // API Configuration
        api_endpoint: [''],
        method: ['GET'],
        headers: this.fb.group({}),
        response_template: [''],
        
        // Assign Tags Configuration
        auto_response: [''],
        
        // Escalate Human Configuration
        escalation_message: [''],
        priority: ['normal'],
        
        // AI Response Configuration
        ai_response_prompt: [''],
        ai_response_max_tokens: [300],
        ai_response_temperature: ['0.5'],
        
        // Hybrid Configuration
        hybrid_assign_tags: [false],
        hybrid_ai_response: [false],
        hybrid_call_api: [false],
        hybrid_ai_prompt: ['']
      }),
      tags_to_assign: [[]]
    });

    // Watchers para validaciones dinámicas
    this.setupFormWatchers();
  }

  createKeywordControl() {
    return this.fb.control('', [Validators.required]);
  }

  createDataFieldControl() {
    return this.fb.control('', [Validators.required]);
  }

  get keywordsArray() {
    return this.ruleForm.get('trigger_keywords') as FormArray;
  }

  get dataFieldsArray() {
    return this.ruleForm.get('expected_data_fields') as FormArray;
  }

  addKeyword() {
    this.keywordsArray.push(this.createKeywordControl());
  }

  removeKeyword(index: number) {
    if (this.keywordsArray.length > 1) {
      this.keywordsArray.removeAt(index);
    }
  }

  addDataField() {
    this.dataFieldsArray.push(this.createDataFieldControl());
  }

  removeDataField(index: number) {
    this.dataFieldsArray.removeAt(index);
  }

  setupFormWatchers() {
    // Validaciones dinámicas según action_type
    this.ruleForm.get('action_type')?.valueChanges.subscribe(actionType => {
      const actionConfig = this.ruleForm.get('action_config');
      
      // Limpiar validaciones previas
      actionConfig?.get('api_endpoint')?.clearValidators();
      actionConfig?.get('escalation_message')?.clearValidators();
      actionConfig?.get('ai_response_prompt')?.clearValidators();
      this.ruleForm.get('tags_to_assign')?.clearValidators();
      
      // Aplicar validaciones según tipo
      switch (actionType) {
        case 'call_api':
          actionConfig?.get('api_endpoint')?.setValidators([Validators.required]);
          break;
        case 'escalate_human':
          actionConfig?.get('escalation_message')?.setValidators([Validators.required]);
          break;
        case 'ai_response':
          actionConfig?.get('ai_response_prompt')?.setValidators([Validators.required, Validators.minLength(10)]);
          break;
        case 'assign_tags':
          // Para assign_tags, requerir al menos una etiqueta (ya sea automática o en action_config)
          this.ruleForm.get('tags_to_assign')?.setValidators([this.minArrayLengthValidator(1)]);
          break;
      }
      
      // Actualizar validaciones
      actionConfig?.get('api_endpoint')?.updateValueAndValidity();
      actionConfig?.get('escalation_message')?.updateValueAndValidity();
      actionConfig?.get('ai_response_prompt')?.updateValueAndValidity();
      this.ruleForm.get('tags_to_assign')?.updateValueAndValidity();
    });

    // Validaciones para extracción de IA
    this.ruleForm.get('ai_extraction_enabled')?.valueChanges.subscribe(enabled => {
      const promptControl = this.ruleForm.get('ai_extraction_prompt');
      
      if (enabled) {
        promptControl?.setValidators([Validators.required]);
      } else {
        promptControl?.clearValidators();
        // Limpiar campos de datos esperados
        while (this.dataFieldsArray.length > 0) {
          this.dataFieldsArray.removeAt(0);
        }
      }
      
      promptControl?.updateValueAndValidity();
    });
  }

  loadAvailableTags() {
    this.contactsService.getTags().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.availableTags = response.data;
        }
      },
      error: (error: any) => {
        console.error('Error loading tags:', error);
      }
    });
  }

  loadRule() {
    if (!this.ruleId) return;
    
    console.log('🔄 Loading rule ID:', this.ruleId);
    this.loading = true;
    this.intelligentRulesService.getRule(this.ruleId).subscribe({
      next: (response: any) => {
        console.log('📥 Rule response:', response);
        if (response.success) {
          console.log('✅ Rule data:', response.data);
          this.populateForm(response.data);
        } else {
          console.log('❌ Response not successful:', response);
        }
        this.loading = false;
        this.cdr.detectChanges(); // Forzar detección de cambios
        console.log('🏁 Loading finished');
      },
      error: (error: any) => {
        console.error('❌ Error loading rule:', error);
        this.showError('Error al cargar la regla');
        this.loading = false;
        this.cdr.detectChanges(); // Forzar detección de cambios
      }
    });
  }

  populateForm(rule: IntelligentRule) {
    console.log('🔄 Populating form with rule:', rule);
    
    // Limpiar arrays existentes
    while (this.keywordsArray.length > 0) {
      this.keywordsArray.removeAt(0);
    }
    while (this.dataFieldsArray.length > 0) {
      this.dataFieldsArray.removeAt(0);
    }

    // Poblar keywords
    rule.trigger_keywords.forEach(keyword => {
      this.keywordsArray.push(this.fb.control(keyword, [Validators.required]));
    });

    // Poblar data fields si existen
    if (rule.expected_data_fields) {
      rule.expected_data_fields.forEach(field => {
        this.dataFieldsArray.push(this.fb.control(field, [Validators.required]));
      });
    }

    // Poblar el resto del formulario
    this.ruleForm.patchValue({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      priority: rule.priority,
      match_type: rule.match_type,
      ai_extraction_enabled: rule.ai_extraction_enabled,
      ai_extraction_prompt: rule.ai_extraction_prompt || '',
      action_type: rule.action_type,
      action_config: rule.action_config || {},
      tags_to_assign: rule.tags_to_assign || []
    });
    
    console.log('✅ Form populated successfully');
    this.cdr.detectChanges(); // Forzar detección de cambios después de poblar el formulario
  }

  onSubmit() {
    this.markFormGroupTouched();
   

    this.saving = true;
    const formData = this.prepareFormData();

    const operation = this.isEditMode
      ? this.intelligentRulesService.updateRule(this.ruleId!, formData)
      : this.intelligentRulesService.createRule(formData);

    operation.subscribe({
      next: (response: any) => {
        if (response.success) {
          this.showSuccess(response.message || 'Regla guardada exitosamente');
          this.router.navigate(['/intelligent-rules']);
        }
        this.saving = false;
      },
      error: (error: any) => {
        console.error('Error saving rule:', error);
        this.showError('Error al guardar la regla');
        this.saving = false;
      }
    });
  }

  prepareFormData(): Partial<IntelligentRule> {
    const formValue = this.ruleForm.value;
    
    return {
      name: formValue.name,
      description: formValue.description,
      is_active: formValue.is_active,
      priority: formValue.priority,
      trigger_keywords: formValue.trigger_keywords.filter((k: string) => k.trim()),
      match_type: formValue.match_type,
      ai_extraction_enabled: formValue.ai_extraction_enabled,
      ai_extraction_prompt: formValue.ai_extraction_enabled ? formValue.ai_extraction_prompt : null,
      expected_data_fields: formValue.ai_extraction_enabled 
        ? formValue.expected_data_fields.filter((f: string) => f.trim())
        : null,
      action_type: formValue.action_type,
      action_config: this.prepareActionConfig(formValue.action_type, formValue.action_config),
      tags_to_assign: formValue.tags_to_assign
    };
  }

  prepareActionConfig(actionType: string, config: any) {
    switch (actionType) {
      case 'call_api':
        return {
          api_endpoint: config.api_endpoint,
          method: config.method || 'GET',
          headers: config.headers || {},
          response_template: config.response_template || ''
        };
      case 'escalate_human':
        return {
          escalation_message: config.escalation_message,
          priority: config.priority || 'normal'
        };
      case 'assign_tags':
        return {
          auto_response: config.auto_response || '',
          escalate_after_tagging: config.escalate_after_tagging || false
        };
      default:
        return config;
    }
  }

  markFormGroupTouched() {
    Object.keys(this.ruleForm.controls).forEach(key => {
      const control = this.ruleForm.get(key);
      control?.markAsTouched();

      if (control instanceof FormArray) {
        control.controls.forEach(c => c.markAsTouched());
      }
    });
  }

  cancel() {
    this.router.navigate(['/intelligent-rules']);
  }

  /**
   * Obtener etiquetas seleccionadas con información completa
   */
  getSelectedTags() {
    const selectedIds = this.ruleForm.get('tags_to_assign')?.value || [];
    return this.availableTags.filter(tag => selectedIds.includes(tag.id));
  }

  /**
   * Remover una etiqueta específica
   */
  removeTag(tagId: number) {
    const currentTags = this.ruleForm.get('tags_to_assign')?.value || [];
    const updatedTags = currentTags.filter((id: number) => id !== tagId);
    this.ruleForm.get('tags_to_assign')?.setValue(updatedTags);
  }

  /**
   * Validador personalizado para longitud mínima de array
   */
  minArrayLengthValidator(minLength: number) {
    return (control: any) => {
      const value = control.value;
      if (!value || !Array.isArray(value) || value.length < minLength) {
        return { minArrayLength: { requiredLength: minLength, actualLength: value ? value.length : 0 } };
      }
      return null;
    };
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.ruleForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.ruleForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['maxlength']) return 'Texto demasiado largo';
      if (field.errors['min']) return 'El valor debe ser mayor a 0';
      if (field.errors['minArrayLength']) return 'Debe seleccionar al menos una etiqueta';
      if (field.errors['pattern']) {
        if (fieldName.includes('n8n_webhook_url')) return 'Debe ser una URL válida (http:// o https://)';
        return 'Formato inválido';
      }
    }
    return '';
  }

  onTagChange(event: any, tagId: number) {
    const currentTags = this.ruleForm.get('tags_to_assign')?.value || [];
    
    if (event.target.checked) {
      // Agregar tag si no existe
      if (!currentTags.includes(tagId)) {
        this.ruleForm.get('tags_to_assign')?.setValue([...currentTags, tagId]);
      }
    } else {
      // Remover tag
      const updatedTags = currentTags.filter((id: number) => id !== tagId);
      this.ruleForm.get('tags_to_assign')?.setValue(updatedTags);
    }
  }

  /**
   * Mostrar mensaje de éxito
   */
  showSuccess(message: string) {
    console.log('✅ Success:', message);
    // TODO: Implementar notificaciones cuando esté disponible
  }

  /**
   * Mostrar mensaje de error
   */
  showError(message: string) {
    console.error('❌ Error:', message);
    // TODO: Implementar notificaciones cuando esté disponible
  }

  /**
   * Mostrar mensaje de advertencia
   */
  showWarning(message: string) {
    console.warn('⚠️ Warning:', message);
    // TODO: Implementar notificaciones cuando esté disponible
  }
}
