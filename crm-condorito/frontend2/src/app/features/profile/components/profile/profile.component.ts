import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-container">
      <div class="page-header">
        <h1>Mi Perfil</h1>
        <p>Gestiona tu información personal</p>
      </div>
      
      <div class="content-card">
        <h2>🚧 En Construcción</h2>
        <p>Esta sección estará disponible próximamente.</p>
      </div>
    </div>
  `,
  styles: [`
    .profile-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .page-header {
      margin-bottom: 2rem;
      
      h1 {
        margin: 0 0 0.5rem 0;
        color: var(--color-text-primary);
      }
      
      p {
        margin: 0;
        color: var(--color-text-secondary);
      }
    }
    
    .content-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      text-align: center;
      
      h2 {
        color: var(--color-text-primary);
        margin-bottom: 1rem;
      }
      
      p {
        color: var(--color-text-secondary);
      }
    }
  `]
})
export class ProfileComponent {}
