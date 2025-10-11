import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ProfileService, UpdateProfileRequest, ChangePasswordRequest, ProfileStats } from '../../services/profile.service';
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../../core/models/api.models';

/**
 * Componente principal del perfil de usuario
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private profileService = inject(ProfileService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  // Signals para estado reactivo
  public currentUser = signal<User | null>(null);
  public profileStats = signal<ProfileStats | null>(null);
  public isLoading = signal<boolean>(true);
  public isUpdatingProfile = signal<boolean>(false);
  public isChangingPassword = signal<boolean>(false);
  public isLoadingStats = signal<boolean>(true);
  
  // Estados de UI
  public showPasswordSection = signal<boolean>(false);
  public showStatsSection = signal<boolean>(true);
  public showDangerZone = signal<boolean>(false);
  
  // Mensajes
  public successMessage = signal<string>('');
  public errorMessage = signal<string>('');
  public passwordSuccessMessage = signal<string>('');
  public passwordErrorMessage = signal<string>('');

  // Formularios
  public profileForm!: FormGroup;
  public passwordForm!: FormGroup;

  // Métodos de validación
  public isProfileFormValid(): boolean {
    return this.profileForm ? this.profileForm.valid : false;
  }
  
  public isPasswordFormValid(): boolean {
    return this.passwordForm ? this.passwordForm.valid : false;
  }
  
  public hasProfileUnsavedChanges(): boolean {
    return this.profileForm ? this.profileForm.dirty : false;
  }

  ngOnInit(): void {
    this.initForms();
    this.loadUserProfile();
    this.loadProfileStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializar formularios
   */
  private initForms(): void {
    // Formulario de perfil
    this.profileForm = this.fb.group({
      company_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.email, Validators.maxLength(100)]],
      phone: ['', [Validators.pattern(/^[\+]?[0-9\s\-\(\)]{10,20}$/), Validators.maxLength(20)]]
    });

    // Formulario de cambio de contraseña
    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required, Validators.minLength(6)]],
      new_password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(50)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  /**
   * Validador personalizado para confirmar contraseña
   */
  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('new_password');
    const confirmPassword = form.get('confirm_password');
    
    if (newPassword && confirmPassword && newPassword.value && confirmPassword.value) {
      if (newPassword.value !== confirmPassword.value) {
        confirmPassword.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        // Si las contraseñas coinciden, limpiar el error de passwordMismatch
        const errors = confirmPassword.errors;
        if (errors && errors['passwordMismatch']) {
          delete errors['passwordMismatch'];
          confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
        }
      }
    }
    
    return null;
  }

  /**
   * Cargar datos del perfil del usuario
   */
  private loadUserProfile(): void {
    this.isLoading.set(true);
    
    // Obtener usuario actual del AuthService
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser.set(user);
      this.populateProfileForm(user);
    }

    // Cargar datos actualizados del servidor
    this.profileService.getProfile().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentUser.set(response.data);
          this.populateProfileForm(response.data);
        } else {
          this.errorMessage.set(response.message || 'Error al cargar el perfil');
          this.clearMessage('error', 5000);
        }
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.errorMessage.set('Error de conexión al cargar el perfil');
        this.clearMessage('error', 5000);
      }
    });
  }

  /**
   * Poblar formulario con datos del usuario
   */
  private populateProfileForm(user: User): void {
    this.profileForm.patchValue({
      company_name: user.company_name || '',
      email: user.email || '',
      phone: user.phone || ''
    });
    this.profileForm.markAsPristine();
  }

  /**
   * Cargar estadísticas del perfil
   */
  private loadProfileStats(): void {
    this.isLoadingStats.set(true);
    
    this.profileService.getProfileStats().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoadingStats.set(false))
    ).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.profileStats.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error loading profile stats:', error);
      }
    });
  }

  /**
   * Guardar cambios del perfil
   */
  saveProfile(): void {
    if (!this.profileForm.valid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isUpdatingProfile.set(true);
    const profileData: UpdateProfileRequest = this.profileForm.value;

    this.profileService.updateProfile(profileData).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isUpdatingProfile.set(false))
    ).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentUser.set(response.data);
          this.profileForm.markAsPristine();
          this.successMessage.set('Perfil actualizado correctamente');
          this.clearMessage('success', 3000);
          
          // Actualizar usuario en AuthService
          this.authService.updateCurrentUser(response.data);
        } else {
          this.errorMessage.set(response.message || 'Error al actualizar el perfil');
          this.clearMessage('error', 5000);
        }
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        this.errorMessage.set('Error de conexión al actualizar el perfil');
        this.clearMessage('error', 5000);
      }
    });
  }

  /**
   * Cambiar contraseña
   */
  changePassword(): void {
    console.log('🔐 Change password called');
    console.log('🔐 Form valid:', this.passwordForm.valid);
    console.log('🔐 Form errors:', this.passwordForm.errors);
    console.log('🔐 Form values:', this.passwordForm.value);
    
    // Mostrar errores de cada campo
    Object.keys(this.passwordForm.controls).forEach(key => {
      const control = this.passwordForm.get(key);
      if (control && control.errors) {
        console.log(`🔐 Field ${key} errors:`, control.errors);
      }
    });
    
    if (!this.passwordForm.valid) {
      this.passwordForm.markAllAsTouched();
      console.log('🔐 Form is invalid, marking all as touched');
      return;
    }

    this.isChangingPassword.set(true);
    const passwordData: ChangePasswordRequest = this.passwordForm.value;

    this.profileService.changePassword(passwordData).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isChangingPassword.set(false))
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.passwordForm.reset();
          this.passwordSuccessMessage.set('Contraseña cambiada correctamente');
          this.clearMessage('passwordSuccess', 3000);
          this.showPasswordSection.set(false);
        } else {
          this.passwordErrorMessage.set(response.message || 'Error al cambiar la contraseña');
          this.clearMessage('passwordError', 5000);
        }
      },
      error: (error) => {
        console.error('Error changing password:', error);
        this.passwordErrorMessage.set('Error de conexión al cambiar la contraseña');
        this.clearMessage('passwordError', 5000);
      }
    });
  }

  /**
   * Descartar cambios del perfil
   */
  discardChanges(): void {
    const user = this.currentUser();
    if (user) {
      this.populateProfileForm(user);
    }
  }

  /**
   * Alternar sección de contraseña
   */
  togglePasswordSection(): void {
    const isVisible = this.showPasswordSection();
    this.showPasswordSection.set(!isVisible);
    
    if (!isVisible) {
      // Limpiar formulario al abrir
      this.passwordForm.reset();
      this.passwordErrorMessage.set('');
      this.passwordSuccessMessage.set('');
    }
  }

  /**
   * Alternar sección de estadísticas
   */
  toggleStatsSection(): void {
    this.showStatsSection.update(val => !val);
  }

  /**
   * Alternar zona peligrosa
   */
  toggleDangerZone(): void {
    this.showDangerZone.update(val => !val);
  }

  /**
   * Exportar datos del usuario
   */
  exportUserData(): void {
    this.profileService.exportUserData().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `crm-condorito-user-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        this.successMessage.set('Datos exportados correctamente');
        this.clearMessage('success', 3000);
      },
      error: (error) => {
        console.error('Error exporting user data:', error);
        this.errorMessage.set('Error al exportar los datos');
        this.clearMessage('error', 5000);
      }
    });
  }

  /**
   * Limpiar mensajes después de un tiempo
   */
  private clearMessage(type: 'success' | 'error' | 'passwordSuccess' | 'passwordError', delay: number): void {
    setTimeout(() => {
      switch (type) {
        case 'success':
          this.successMessage.set('');
          break;
        case 'error':
          this.errorMessage.set('');
          break;
        case 'passwordSuccess':
          this.passwordSuccessMessage.set('');
          break;
        case 'passwordError':
          this.passwordErrorMessage.set('');
          break;
      }
    }, delay);
  }

  /**
   * Formatear fecha para mostrar
   */
  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha no disponible';
    }
  }

  /**
   * Formatear número con separadores de miles
   */
  formatNumber(num: number): string {
    return num.toLocaleString('es-ES');
  }

  /**
   * Obtener inicial del nombre de la empresa
   */
  getCompanyInitial(): string {
    const user = this.currentUser();
    if (user?.company_name) {
      return user.company_name.charAt(0).toUpperCase();
    }
    return user?.client_code?.charAt(0).toUpperCase() || 'U';
  }

  /**
   * Verificar si el campo tiene errores
   */
  hasFieldError(formGroup: FormGroup, fieldName: string): boolean {
    const field = formGroup.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getFieldError(formGroup: FormGroup, fieldName: string): string {
    const field = formGroup.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;
    
    if (errors['required']) return `${this.getFieldLabel(fieldName)} es requerido`;
    if (errors['email']) return 'Email inválido';
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['pattern']) return 'Formato inválido';
    if (errors['passwordMismatch']) return 'Las contraseñas no coinciden';

    return 'Campo inválido';
  }

  /**
   * Obtener etiqueta del campo
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      company_name: 'Nombre de empresa',
      email: 'Email',
      phone: 'Teléfono',
      current_password: 'Contraseña actual',
      new_password: 'Nueva contraseña',
      confirm_password: 'Confirmar contraseña'
    };
    return labels[fieldName] || fieldName;
  }
}