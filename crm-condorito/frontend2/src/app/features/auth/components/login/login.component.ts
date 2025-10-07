import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../../../core/models/api.models';
import { APP_CONFIG } from '../../../../core/config/app.config';

/**
 * Componente de Login
 * Maneja la autenticación del usuario con client_code y password
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Signals
  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string>('');
  public showPassword = signal<boolean>(false);

  // Configuration
  public appConfig = APP_CONFIG;

  // Form
  public loginForm: FormGroup;

  constructor() {
    this.loginForm = this.formBuilder.group({
      client_code: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Limpiar error al cambiar campos
    this.loginForm.valueChanges.subscribe(() => {
      if (this.errorMessage()) {
        this.errorMessage.set('');
      }
    });
  }

  /**
   * Verificar si un campo es inválido
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Alternar visibilidad de la contraseña
   */
  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  /**
   * Manejar envío del formulario
   */
  onSubmit(): void {
    if (this.loginForm.valid && !this.isLoading()) {
      this.performLogin();
    } else {
      this.markFormGroupTouched();
    }
  }

  /**
   * Realizar login
   */
  private performLogin(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const credentials: LoginRequest = {
      client_code: this.loginForm.value.client_code.trim(),
      password: this.loginForm.value.password
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        console.log('✅ Login response received:', response);
        console.log('✅ Login successful for:', response.client.client_code);
        
        // Verificar si es administrador y redirigir apropiadamente
        if (response.isAdmin || response.client.company_name === 'Admin') {
          console.log('👑 Admin user detected, redirecting to backoffice...');
          this.router.navigate(['/backoffice']);
        } else {
          console.log('✅ Regular user, navigating to dashboard...');
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error) => {
        console.error('❌ Login failed:', error);
        this.errorMessage.set(
          error.message || 'Error al iniciar sesión. Verifica tus credenciales.'
        );
        this.isLoading.set(false);
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Marcar todos los campos como tocados para mostrar errores
   */
  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }
}
