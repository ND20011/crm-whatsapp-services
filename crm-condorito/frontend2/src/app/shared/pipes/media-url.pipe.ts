import { Pipe, PipeTransform } from '@angular/core';
import { APP_CONFIG } from '../../core/config/app.config';

/**
 * Pipe para transformar URLs de media usando la configuración del backend
 * Convierte URLs relativas a absolutas usando APP_CONFIG.api.baseUrl
 */
@Pipe({
  name: 'mediaUrl',
  standalone: true
})
export class MediaUrlPipe implements PipeTransform {

  transform(url: string | null): string | null {
    if (!url) {
      return null;
    }

    const backendBaseUrl = APP_CONFIG.api.baseUrl;

    // Si la URL ya es relativa, convertirla a absoluta apuntando al backend
    if (!url.startsWith('http')) {
      return `${backendBaseUrl}${url}`;
    }

    // Si la URL ya es absoluta y apunta al backend, mantenerla
    if (url.startsWith(`${backendBaseUrl}/`)) {
      return url;
    }

    // Para cualquier otra URL, mantenerla tal como está
    return url;
  }
}
