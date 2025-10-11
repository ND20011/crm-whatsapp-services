import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Ruta por defecto - redirigir al dashboard si está autenticado, sino al login
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  
  // Rutas de autenticación (sin layout)
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        canActivate: [publicGuard],
        loadComponent: () => import('./features/auth/components/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },
  
  // Rutas protegidas con layout principal
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/components/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'chat',
        loadComponent: () => import('./features/chat/components/chat/chat.component').then(m => m.ChatComponent)
      },
      {
        path: 'bulk-messages',
        loadComponent: () => import('./features/bulk-messages/components/bulk-messages/bulk-messages.component').then(m => m.BulkMessagesComponent)
      },
      {
        path: 'contacts',
        children: [
          {
            path: 'list',
            loadComponent: () => import('./features/contacts/components/contact-list/contact-list.component').then(m => m.ContactListComponent)
          },
          {
            path: 'tags',
            loadComponent: () => import('./features/contacts/components/tag-management/tag-management.component').then(m => m.TagManagementComponent)
          },
          {
            path: '',
            redirectTo: 'list',
            pathMatch: 'full'
          }
        ]
      },
      {
        path: 'templates',
        children: [
          {
            path: 'list',
            loadComponent: () => import('./features/templates/components/template-list/template-list.component').then(m => m.TemplateListComponent)
          },
          {
            path: 'create',
            loadComponent: () => import('./features/templates/components/template-form/template-form.component').then(m => m.TemplateFormComponent)
          },
          {
            path: 'edit/:id',
            loadComponent: () => import('./features/templates/components/template-form/template-form.component').then(m => m.TemplateFormComponent)
          },
          {
            path: '',
            redirectTo: 'list',
            pathMatch: 'full'
          }
        ]
      },
      {
        path: 'scheduled-messages',
        children: [
          {
            path: 'list',
            loadComponent: () => import('./features/scheduled-messages/components/scheduled-message-list/scheduled-message-list.component').then(m => m.ScheduledMessageListComponent)
          },
          {
            path: 'create',
            loadComponent: () => import('./features/scheduled-messages/components/scheduled-message-form/scheduled-message-form.component').then(m => m.ScheduledMessageFormComponent)
          },
          {
            path: 'edit/:id',
            loadComponent: () => import('./features/scheduled-messages/components/scheduled-message-form/scheduled-message-form.component').then(m => m.ScheduledMessageFormComponent)
          },
          {
            path: 'view/:id',
            loadComponent: () => import('./features/scheduled-messages/components/scheduled-message-detail/scheduled-message-detail.component').then(m => m.ScheduledMessageDetailComponent)
          },
          {
            path: '',
            redirectTo: 'list',
            pathMatch: 'full'
          }
        ]
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/components/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'company',
        loadComponent: () => import('./features/company/components/company/company.component').then(m => m.CompanyComponent)
      },
      {
        path: 'ai-config',
        loadComponent: () => import('./features/ai-config/components/ai-config/ai-config.component').then(m => m.AIConfigComponent)
      }
    ]
  },
  
  // Backoffice (sin layout principal)
  {
    path: 'backoffice',
    canActivate: [authGuard],
    loadComponent: () => import('./features/backoffice/components/backoffice/backoffice.component').then(m => m.BackofficeComponent)
  },
  
  // Ruta 404
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
