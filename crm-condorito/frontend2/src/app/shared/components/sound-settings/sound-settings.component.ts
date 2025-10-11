import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoundSettingsService } from '../../../core/services/sound-settings.service';

@Component({
  selector: 'app-sound-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sound-settings.component.html',
  styleUrl: './sound-settings.component.scss'
})
export class SoundSettingsComponent {
  protected soundService = inject(SoundSettingsService);
  
  public isTestingSound = signal<boolean>(false);
  public showAdvanced = signal<boolean>(false);

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
   * Cambiar volumen
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
   * Probar sonido
   */
  testSound(): void {
    if (this.isTestingSound()) return;
    
    this.isTestingSound.set(true);
    this.soundService.testSound();
    
    // Reset después de un breve delay
    setTimeout(() => {
      this.isTestingSound.set(false);
    }, 1000);
  }

  /**
   * Resetear a configuración por defecto
   */
  resetToDefaults(): void {
    this.soundService.resetToDefaults();
    // Reproducir sonido de confirmación
    setTimeout(() => {
      this.soundService.testSound();
    }, 300);
  }

  /**
   * Alternar configuración avanzada
   */
  toggleAdvanced(): void {
    this.showAdvanced.set(!this.showAdvanced());
  }

  /**
   * Obtener texto del estado actual
   */
  getStatusText(): string {
    const settings = this.soundService.settings();
    if (!settings.enabled) {
      return 'Desactivado';
    }
    return `Activado - ${settings.type === 'default' ? 'Normal' : 'Sutil'} (${Math.round(settings.volume * 100)}%)`;
  }

  /**
   * Obtener porcentaje de volumen
   */
  getVolumePercentage(): number {
    return Math.round(this.soundService.getVolume() * 100);
  }
}
