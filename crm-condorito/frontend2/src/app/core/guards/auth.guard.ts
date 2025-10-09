import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';

/**
 * Guard de autenticación
 * Protege rutas que requieren autenticación
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔍 AuthGuard checking authentication for:', state.url);
  console.log('🔍 Is authenticated:', authService.isAuthenticated());

  if (authService.isAuthenticated()) {
    // Verificar si el token ha expirado
    if (authService.isTokenExpired()) {
      console.log('🔒 Token expired, redirecting to login');
      authService.logoutImmediate();
      return false;
    }
    console.log('✅ AuthGuard: User is authenticated, allowing access');
    return true;
  }

  console.log('🔒 User not authenticated, redirecting to login');
  router.navigate(['/auth/login'], { 
    queryParams: { returnUrl: state.url } 
  });
  return false;
};

/**
 * Guard para rutas públicas (como login)
 * Redirige al dashboard si ya está autenticado
 */
export const publicGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && !authService.isTokenExpired()) {
    console.log('✅ User already authenticated, redirecting to dashboard');
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
