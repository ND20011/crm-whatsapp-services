import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SoundSettingsService } from '../../../core/services/sound-settings.service';

@Component({
  selector: 'app-sound-settings-professional',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sound-settings-professional.component.html',
  styleUrl: './sound-settings-professional.component.scss'
})
export class SoundSettingsProfessionalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  protected soundService = inject(SoundSettingsService);
  
  // Estados de UI
  public isTestingSound = signal<boolean>(false);
  public showAdvanced = signal<boolean>(false);
  public isInitializing = signal<boolean>(true);
  public animationState = signal<'idle' | 'testing' | 'saving'>('idle');

  // Configuraciones predefinidas
  public presets = [
    {
      id: 'silent',
      name: 'Silencioso',
      description: 'Sin notificaciones sonoras',
      icon: 'fa-volume-mute',
      config: { enabled: false, volume: 0, type: 'default' as const }
    },
    {
      id: 'subtle',
      name: 'Discreto',
      description: 'Sonido suave y breve',
      icon: 'fa-volume-down',
      config: { enabled: true, volume: 0.2, type: 'subtle' as const }
    },
    {
      id: 'normal',
      name: 'Normal',
      description: 'Sonido equilibrado',
      icon: 'fa-volume-up',
      config: { enabled: true, volume: 0.5, type: 'default' as const }
    },
    {
      id: 'prominent',
      name: 'Prominente',
      description: 'Sonido fuerte y claro',
      icon: 'fa-volume-up',
      config: { enabled: true, volume: 0.8, type: 'default' as const }
    }
  ];

  ngOnInit(): void {
    // Simular inicialización
    setTimeout(() => {
      this.isInitializing.set(false);
    }, 500);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Aplicar preset de configuración
   */
  applyPreset(presetId: string): void {
    const preset = this.presets.find(p => p.id === presetId);
    if (!preset) return;

    this.animationState.set('saving');
    
    // Aplicar configuración
    this.soundService.setEnabled(preset.config.enabled);
    this.soundService.setVolume(preset.config.volume);
    this.soundService.setSoundType(preset.config.type);

    // Reproducir sonido de confirmación si está habilitado
    if (preset.config.enabled) {
      setTimeout(() => {
        this.soundService.testSound();
      }, 300);
    }

    // Reset animación
    setTimeout(() => {
      this.animationState.set('idle');
    }, 800);
  }

  /**
   * Alternar notificaciones sonoras
   */
  toggleSoundEnabled(): void {
    const currentEnabled = this.soundService.isEnabled();
    this.soundService.setEnabled(!currentEnabled);
    
    // Si se habilita, reproducir sonido de confirmación
    if (!currentEnabled) {
      setTimeout(() => {
        this.soundService.testSound();
      }, 300);
    }
  }

  /**
   * Cambiar volumen con animación
   */
  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    this.soundService.setVolume(volume);
  }

  /**
   * Cambiar tipo de sonido
   */
  onSoundTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const type = target.value as 'default' | 'subtle';
    this.soundService.setSoundType(type);
  }

  /**
   * Probar sonido con animación
   */
  testSound(): void {
    if (this.isTestingSound()) return;
    
    this.isTestingSound.set(true);
    this.animationState.set('testing');
    
    this.soundService.testSound();
    
    // Reset después de la animación
    setTimeout(() => {
      this.isTestingSound.set(false);
      this.animationState.set('idle');
    }, 1200);
  }

  /**
   * Resetear a configuración por defecto
   */
  resetToDefaults(): void {
    this.animationState.set('saving');
    this.soundService.resetToDefaults();
    
    // Reproducir sonido de confirmación
    setTimeout(() => {
      this.soundService.testSound();
      this.animationState.set('idle');
    }, 500);
  }

  /**
   * Alternar configuración avanzada
   */
  toggleAdvanced(): void {
    this.showAdvanced.set(!this.showAdvanced());
  }

  /**
   * Obtener el preset activo actual
   */
  getActivePreset(): string | null {
    const settings = this.soundService.settings();
    
    for (const preset of this.presets) {
      const config = preset.config;
      if (
        settings.enabled === config.enabled &&
        Math.abs(settings.volume - config.volume) < 0.1 &&
        settings.type === config.type
      ) {
        return preset.id;
      }
    }
    
    return null; // Configuración personalizada
  }

  /**
   * Verificar si un preset está activo
   */
  isPresetActive(presetId: string): boolean {
    return this.getActivePreset() === presetId;
  }

  /**
   * Obtener texto del estado actual
   */
  getStatusText(): string {
    const settings = this.soundService.settings();
    if (!settings.enabled) {
      return 'Notificaciones silenciadas';
    }
    
    const volumePercent = Math.round(settings.volume * 100);
    const typeText = settings.type === 'default' ? 'Normal' : 'Discreto';
    return `${typeText} • ${volumePercent}% volumen`;
  }

  /**
   * Obtener porcentaje de volumen
   */
  getVolumePercentage(): number {
    return Math.round(this.soundService.getVolume() * 100);
  }

  /**
   * Obtener clase CSS para el estado de animación
   */
  getAnimationClass(): string {
    const state = this.animationState();
    return `animation-${state}`;
  }

  /**
   * Verificar si el sistema de audio está disponible
   */
  isAudioAvailable(): boolean {
    return typeof window !== 'undefined' && 
           'AudioContext' in window && 
           (window as any).NotificationSound;
  }
}
