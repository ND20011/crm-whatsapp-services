import { Injectable, signal } from '@angular/core';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  type: 'default' | 'subtle';
}

/**
 * Servicio para gestionar configuración de sonidos de notificación
 */
@Injectable({
  providedIn: 'root'
})
export class SoundSettingsService {
  private readonly STORAGE_KEY = 'crm-sound-settings';
  
  // Configuración por defecto
  private readonly DEFAULT_SETTINGS: SoundSettings = {
    enabled: true,  // Activado por defecto
    volume: 0.3,
    type: 'default'
  };

  // Signal reactivo para la configuración
  public settings = signal<SoundSettings>(this.DEFAULT_SETTINGS);

  constructor() {
    this.loadSettings();
    this.initializeSound();
  }

  /**
   * Cargar configuración desde localStorage
   */
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        // Validar que tenga las propiedades necesarias
        const validSettings: SoundSettings = {
          enabled: parsedSettings.enabled ?? this.DEFAULT_SETTINGS.enabled,
          volume: parsedSettings.volume ?? this.DEFAULT_SETTINGS.volume,
          type: parsedSettings.type ?? this.DEFAULT_SETTINGS.type
        };
        this.settings.set(validSettings);
        console.log('🔊 Sound settings loaded:', validSettings);
      } else {
        // Primera vez, guardar configuración por defecto
        this.saveSettings();
        console.log('🔊 Sound settings initialized with defaults');
      }
    } catch (error) {
      console.error('❌ Error loading sound settings:', error);
      this.settings.set(this.DEFAULT_SETTINGS);
    }
  }

  /**
   * Guardar configuración en localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings()));
      console.log('💾 Sound settings saved:', this.settings());
    } catch (error) {
      console.error('❌ Error saving sound settings:', error);
    }
  }

  /**
   * Inicializar el sistema de sonido
   */
  private initializeSound(): void {
    // Verificar si el archivo de sonido está disponible
    if (typeof window !== 'undefined' && (window as any).NotificationSound) {
      console.log('🔊 Notification sound system ready');
    } else {
      console.warn('⚠️ Notification sound system not available');
    }
  }

  /**
   * Actualizar configuración de sonidos habilitados
   */
  setEnabled(enabled: boolean): void {
    const currentSettings = this.settings();
    const newSettings = { ...currentSettings, enabled };
    this.settings.set(newSettings);
    this.saveSettings();
    console.log(`🔊 Sound notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Actualizar volumen
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume)); // Entre 0 y 1
    const currentSettings = this.settings();
    const newSettings = { ...currentSettings, volume: clampedVolume };
    this.settings.set(newSettings);
    this.saveSettings();
    console.log(`🔊 Sound volume set to: ${clampedVolume}`);
  }

  /**
   * Cambiar tipo de sonido
   */
  setSoundType(type: 'default' | 'subtle'): void {
    const currentSettings = this.settings();
    const newSettings = { ...currentSettings, type };
    this.settings.set(newSettings);
    this.saveSettings();
    console.log(`🔊 Sound type set to: ${type}`);
  }

  /**
   * Reproducir sonido de notificación
   */
  playNotificationSound(): void {
    const settings = this.settings();
    
    if (!settings.enabled) {
      console.log('🔇 Sound notifications disabled, skipping sound');
      return;
    }

    try {
      const notificationSound = (window as any).NotificationSound;
      if (notificationSound) {
        if (settings.type === 'subtle') {
          notificationSound.playSubtle();
        } else {
          notificationSound.play();
        }
        console.log('🔊 Notification sound played');
      } else {
        console.warn('⚠️ NotificationSound not available');
      }
    } catch (error) {
      console.error('❌ Error playing notification sound:', error);
    }
  }

  /**
   * Probar sonido (para configuración)
   */
  testSound(): void {
    console.log('🔊 Testing notification sound...');
    this.playNotificationSound();
  }

  /**
   * Resetear configuración a valores por defecto
   */
  resetToDefaults(): void {
    this.settings.set(this.DEFAULT_SETTINGS);
    this.saveSettings();
    console.log('🔄 Sound settings reset to defaults');
  }

  /**
   * Obtener estado actual
   */
  isEnabled(): boolean {
    return this.settings().enabled;
  }

  /**
   * Obtener volumen actual
   */
  getVolume(): number {
    return this.settings().volume;
  }

  /**
   * Obtener tipo de sonido actual
   */
  getSoundType(): 'default' | 'subtle' {
    return this.settings().type;
  }
}
