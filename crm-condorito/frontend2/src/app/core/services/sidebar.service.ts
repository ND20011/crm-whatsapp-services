import { Injectable, signal, computed } from '@angular/core';

/**
 * Servicio para manejar el estado global del sidebar
 */
@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // ============================================================================
  // SIGNALS
  // ============================================================================
  
  private _isOpen = signal<boolean>(true); // Iniciamos abierto por defecto para desktop
  private _isMobile = signal<boolean>(false);

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  public readonly isOpen = this._isOpen.asReadonly();
  public readonly isMobile = this._isMobile.asReadonly();
  
  public readonly sidebarWidth = computed(() => {
    return this._isOpen() ? '280px' : '0px';
  });

  public readonly mainContentMargin = computed(() => {
    if (this._isMobile()) {
      return '0px';
    }
    return this._isOpen() ? '280px' : '0px';
  });

  public readonly bodyClass = computed(() => {
    const classes = [];
    
    if (this._isOpen()) {
      classes.push('sidebar-open');
    } else {
      classes.push('sidebar-closed');
    }
    
    if (this._isMobile()) {
      classes.push('sidebar-mobile');
    }
    
    return classes.join(' ');
  });

  // ============================================================================
  // METHODS
  // ============================================================================

  /**
   * Alternar estado del sidebar
   */
  toggle(): void {
    this._isOpen.set(!this._isOpen());
  }

  /**
   * Abrir sidebar
   */
  open(): void {
    this._isOpen.set(true);
  }

  /**
   * Cerrar sidebar
   */
  close(): void {
    this._isOpen.set(false);
  }

  /**
   * Establecer estado móvil
   */
  setMobile(isMobile: boolean): void {
    this._isMobile.set(isMobile);
    
    // En desktop, abrir por defecto (solo la primera vez)
    if (!isMobile) {
      // Si es la primera vez que se inicializa en desktop, abrir
      const hasBeenInitialized = localStorage.getItem('sidebar-initialized');
      if (!hasBeenInitialized) {
        this._isOpen.set(true);
        localStorage.setItem('sidebar-initialized', 'true');
      }
    }
  }

  /**
   * Inicializar el servicio
   */
  initialize(): void {
    this.checkMobileView();
    this.setupResizeListener();
  }

  /**
   * Verificar si es vista móvil
   */
  private checkMobileView(): void {
    if (typeof window !== 'undefined') {
      const isMobileView = window.innerWidth < 768;
      this.setMobile(isMobileView);
    }
  }

  /**
   * Configurar listener de resize
   */
  private setupResizeListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.checkMobileView();
      });
    }
  }
}
