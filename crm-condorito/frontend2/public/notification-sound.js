// Generar un tono de notificación usando Web Audio API
// Este archivo crea un sonido sintético para evitar dependencias externas

class NotificationSound {
  constructor() {
    this.audioContext = null;
    this.isPlaying = false;
  }

  // Inicializar el contexto de audio
  initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Reproducir sonido de notificación
  play() {
    if (this.isPlaying) return;
    
    try {
      const audioContext = this.initAudioContext();
      
      // Crear oscilador para el tono
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Configurar el sonido (tono agradable)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frecuencia inicial
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1); // Bajada de tono
      
      // Configurar volumen con fade
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);
      
      // Conectar nodos
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Reproducir
      this.isPlaying = true;
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      
      oscillator.onended = () => {
        this.isPlaying = false;
      };
      
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir el sonido de notificación:', error);
      this.isPlaying = false;
    }
  }

  // Reproducir sonido de notificación más suave
  playSubtle() {
    if (this.isPlaying) return;
    
    try {
      const audioContext = this.initAudioContext();
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Sonido más suave y corto
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(650, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      this.isPlaying = true;
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      
      oscillator.onended = () => {
        this.isPlaying = false;
      };
      
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir el sonido sutil:', error);
      this.isPlaying = false;
    }
  }
}

// Exportar instancia única
window.NotificationSound = new NotificationSound();
