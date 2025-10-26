import { Routes } from '@angular/router';

export const intelligentRulesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/intelligent-rules-list/intelligent-rules-list.component')
      .then(m => m.IntelligentRulesListComponent),
    title: 'Reglas Inteligentes'
  },
  {
    path: 'create',
    loadComponent: () => import('./components/intelligent-rules-form/intelligent-rules-form.component')
      .then(m => m.IntelligentRulesFormComponent),
    title: 'Crear Regla Inteligente'
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./components/intelligent-rules-form/intelligent-rules-form.component')
      .then(m => m.IntelligentRulesFormComponent),
    title: 'Editar Regla Inteligente'
  }
];
