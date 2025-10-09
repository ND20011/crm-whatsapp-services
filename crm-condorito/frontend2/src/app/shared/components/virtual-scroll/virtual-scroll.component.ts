import { 
  Component, 
  input, 
  output, 
  signal, 
  computed,
  ViewChild, 
  ElementRef, 
  OnInit, 
  OnDestroy,
  ChangeDetectionStrategy,
  TemplateRef,
  contentChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { fromEvent, Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  buffer?: number; // Número de elementos extra a renderizar fuera del viewport
  threshold?: number; // Threshold para scroll infinito
}

/**
 * Componente de Virtual Scrolling optimizado
 * Renderiza solo los elementos visibles para mejorar el rendimiento
 */
@Component({
  selector: 'app-virtual-scroll',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      #scrollContainer
      class="virtual-scroll-container"
      [style.height.px]="config().containerHeight"
      (scroll)="onScroll($event)"
    >
      <!-- Spacer superior -->
      <div 
        class="virtual-scroll-spacer"
        [style.height.px]="topSpacerHeight()"
      ></div>
      
      <!-- Elementos visibles -->
      <div class="virtual-scroll-content">
        @for (item of visibleItems(); track item; let i = $index) {
          <div 
            class="virtual-scroll-item"
            [style.height.px]="config().itemHeight"
          >
            <ng-container 
              [ngTemplateOutlet]="itemTemplate()"
              [ngTemplateOutletContext]="{ $implicit: item, index: getActualIndex(i) }"
            ></ng-container>
          </div>
        }
      </div>
      
      <!-- Spacer inferior -->
      <div 
        class="virtual-scroll-spacer"
        [style.height.px]="bottomSpacerHeight()"
      ></div>
      
      <!-- Loading indicator para scroll infinito -->
      @if (isLoadingMore()) {
        <div class="virtual-scroll-loading">
          <div class="spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <span class="ms-2">Cargando más elementos...</span>
        </div>
      }
    </div>
  `,
  styleUrl: './virtual-scroll.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualScrollComponent<T> implements OnInit, OnDestroy {
  @ViewChild('scrollContainer', { static: true }) scrollContainer!: ElementRef<HTMLDivElement>;
  
  // Inputs
  public items = input.required<T[]>();
  public config = input.required<VirtualScrollConfig>();
  public trackByFn = input<(index: number, item: T) => any>((index, item) => index);
  public itemTemplate = contentChild.required(TemplateRef);
  
  // Outputs
  public onScrollEnd = output<void>(); // Para scroll infinito
  public onItemsChange = output<{ startIndex: number; endIndex: number; visibleItems: T[] }>();

  // Signals
  public scrollTop = signal<number>(0);
  public isLoadingMore = signal<boolean>(false);
  
  // Computed values
  public startIndex = computed(() => {
    const buffer = this.config().buffer || 5;
    const index = Math.floor(this.scrollTop() / this.config().itemHeight) - buffer;
    return Math.max(0, index);
  });

  public endIndex = computed(() => {
    const buffer = this.config().buffer || 5;
    const visibleCount = Math.ceil(this.config().containerHeight / this.config().itemHeight);
    const index = this.startIndex() + visibleCount + (buffer * 2);
    return Math.min(this.items().length, index);
  });

  public visibleItems = computed(() => {
    return this.items().slice(this.startIndex(), this.endIndex());
  });

  public topSpacerHeight = computed(() => {
    return this.startIndex() * this.config().itemHeight;
  });

  public bottomSpacerHeight = computed(() => {
    const totalHeight = this.items().length * this.config().itemHeight;
    const visibleHeight = this.endIndex() * this.config().itemHeight;
    return Math.max(0, totalHeight - visibleHeight);
  });

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.setupScrollListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Configurar listener de scroll con debounce
   */
  private setupScrollListener(): void {
    fromEvent(this.scrollContainer.nativeElement, 'scroll')
      .pipe(
        debounceTime(16), // ~60fps
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.handleScroll();
      });
  }

  /**
   * Manejar evento de scroll
   */
  onScroll(event: Event): void {
    // Este método se llama inmediatamente, sin debounce
    // para actualizaciones críticas de UI
    const target = event.target as HTMLDivElement;
    this.scrollTop.set(target.scrollTop);
  }

  /**
   * Manejar scroll con lógica adicional
   */
  private handleScroll(): void {
    const container = this.scrollContainer.nativeElement;
    const threshold = this.config().threshold || 100;
    
    // Verificar si estamos cerca del final para scroll infinito
    const isNearEnd = (container.scrollTop + container.clientHeight) >= 
                     (container.scrollHeight - threshold);
    
    if (isNearEnd && !this.isLoadingMore()) {
      this.onScrollEnd.emit();
    }

    // Emitir cambios de elementos visibles
    this.onItemsChange.emit({
      startIndex: this.startIndex(),
      endIndex: this.endIndex(),
      visibleItems: this.visibleItems()
    });
  }

  /**
   * Obtener el índice real del elemento en la lista completa
   */
  getActualIndex(visibleIndex: number): number {
    return this.startIndex() + visibleIndex;
  }

  /**
   * Scroll a un elemento específico
   */
  scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth'): void {
    const scrollTop = index * this.config().itemHeight;
    this.scrollContainer.nativeElement.scrollTo({
      top: scrollTop,
      behavior
    });
  }

  /**
   * Scroll al inicio
   */
  scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
    this.scrollToIndex(0, behavior);
  }

  /**
   * Scroll al final
   */
  scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    this.scrollToIndex(this.items().length - 1, behavior);
  }

  /**
   * Establecer estado de carga
   */
  setLoadingMore(loading: boolean): void {
    this.isLoadingMore.set(loading);
  }

  /**
   * Obtener información del viewport actual
   */
  getViewportInfo(): {
    startIndex: number;
    endIndex: number;
    visibleCount: number;
    totalCount: number;
    scrollPercentage: number;
  } {
    const container = this.scrollContainer.nativeElement;
    const scrollPercentage = container.scrollHeight > 0 ? 
      (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100 : 0;

    return {
      startIndex: this.startIndex(),
      endIndex: this.endIndex(),
      visibleCount: this.visibleItems().length,
      totalCount: this.items().length,
      scrollPercentage: Math.min(100, Math.max(0, scrollPercentage))
    };
  }

  /**
   * Actualizar configuración dinámicamente
   */
  updateConfig(newConfig: Partial<VirtualScrollConfig>): void {
    // Nota: En Angular con signals, esto requeriría un signal writable
    // Para esta implementación, asumimos que config es actualizado externamente
    console.warn('updateConfig: La configuración debe actualizarse desde el componente padre');
  }

  /**
   * Optimizar el renderizado forzando una actualización
   */
  forceUpdate(): void {
    // Forzar recálculo de elementos visibles
    this.handleScroll();
  }
}
