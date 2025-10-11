import { Component, inject, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarNavComponent } from '../../components/sidebar-nav/sidebar-nav.component';
import { HeaderNavComponent } from '../../components/header-nav/header-nav.component';
import { SidebarService } from '../../../core/services/sidebar.service';

/**
 * Layout principal de la aplicación con sidebar
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarNavComponent, HeaderNavComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private sidebarService = inject(SidebarService);

  // ============================================================================
  // SIGNALS
  // ============================================================================

  public sidebarOpen = this.sidebarService.isOpen;
  public isMobile = this.sidebarService.isMobile;
  public mainContentMargin = this.sidebarService.mainContentMargin;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  constructor() {
    // Effect para aplicar clases al body
    effect(() => {
      if (typeof document !== 'undefined') {
        const bodyClass = this.sidebarService.bodyClass();
        document.body.className = bodyClass;
      }
    });
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  ngOnInit(): void {
    this.sidebarService.initialize();
  }

  ngOnDestroy(): void {
    // Limpiar clases del body
    if (typeof document !== 'undefined') {
      document.body.className = '';
    }
  }

  // ============================================================================
  // METHODS
  // ============================================================================

  /**
   * Alternar sidebar
   */
  toggleSidebar(): void {
    this.sidebarService.toggle();
  }
}
