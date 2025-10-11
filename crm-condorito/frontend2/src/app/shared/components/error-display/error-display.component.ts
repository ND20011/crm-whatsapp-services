import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente para mostrar errores de forma consistente
 */
@Component({
  selector: 'app-error-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (error) {
      <div class="error-display" [class]="cssClass">
        <div class="error-content">
          <i class="fas fa-exclamation-triangle error-icon"></i>
          <div class="error-text">
            <h4 class="error-title">{{ title }}</h4>
            <p class="error-message">{{ error }}</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .error-display {
      background: var(--color-danger-light, #fee);
      border: 1px solid var(--color-danger, #dc3545);
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
    }

    .error-content {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .error-icon {
      color: var(--color-danger, #dc3545);
      font-size: 1.25rem;
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    .error-text {
      flex: 1;
    }

    .error-title {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-danger-dark, #721c24);
    }

    .error-message {
      margin: 0;
      font-size: 0.9rem;
      color: var(--color-danger-dark, #721c24);
      line-height: 1.4;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorDisplayComponent {
  @Input() error: string | null = null;
  @Input() title: string = 'Error';
  @Input() cssClass: string = '';
}