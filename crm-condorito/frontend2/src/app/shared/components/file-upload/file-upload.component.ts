import { Component, inject, input, output, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../../features/chat/services/chat.service';
import { ChatFile } from '../../../core/models/api.models';
import { APP_CONFIG } from '../../../core/config/app.config';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss'
})
export class FileUploadComponent {
  private chatService = inject(ChatService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Inputs
  public disabled = input<boolean>(false);
  public multiple = input<boolean>(false);
  public acceptImages = input<boolean>(true);
  public acceptDocuments = input<boolean>(true);

  // Outputs
  public onFileSelected = output<ChatFile>();
  public onFilesSelected = output<ChatFile[]>();
  public onError = output<string>();

  // Signals
  public isDragOver = signal<boolean>(false);
  public isProcessing = signal<boolean>(false);

  /**
   * Obtener tipos de archivo aceptados
   */
  get acceptedTypes(): string {
    const types: string[] = [];
    
    if (this.acceptImages()) {
      types.push(...APP_CONFIG.files.allowedImageTypes);
    }
    
    if (this.acceptDocuments()) {
      types.push(...APP_CONFIG.files.allowedDocumentTypes);
    }
    
    return types.join(',');
  }

  /**
   * Abrir selector de archivos
   */
  openFileSelector(): void {
    if (!this.disabled()) {
      this.fileInput.nativeElement.click();
    }
  }

  /**
   * Manejar selección de archivos
   */
  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    input.value = '';
  }

  /**
   * Manejar drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.disabled()) {
      this.isDragOver.set(true);
    }
  }

  /**
   * Manejar drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  /**
   * Manejar drop
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (this.disabled()) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFiles(Array.from(files));
    }
  }

  /**
   * Procesar archivos seleccionados
   */
  private async processFiles(files: File[]): Promise<void> {
    if (this.disabled()) return;

    this.isProcessing.set(true);
    const processedFiles: ChatFile[] = [];

    try {
      for (const file of files) {
        const validation = this.chatService.validateFile(file);
        
        if (!validation.isValid) {
          this.onError.emit(validation.error || 'Archivo no válido');
          continue;
        }

        const fileType = this.chatService.getFileType(file);
        
        // Verificar si el tipo está permitido
        if (fileType === 'image' && !this.acceptImages()) {
          this.onError.emit('Las imágenes no están permitidas');
          continue;
        }
        
        if (fileType === 'document' && !this.acceptDocuments()) {
          this.onError.emit('Los documentos no están permitidos');
          continue;
        }

        const chatFile: ChatFile = {
          file: file,
          type: fileType,
          size: this.chatService.formatFileSize(file.size),
          name: file.name
        };

        // Crear preview para imágenes
        if (fileType === 'image') {
          try {
            chatFile.preview = await this.chatService.createImagePreview(file);
          } catch (error) {
            console.warn('Error creating image preview:', error);
          }
        }

        processedFiles.push(chatFile);

        // Si no es múltiple, emitir inmediatamente el primer archivo
        if (!this.multiple()) {
          this.onFileSelected.emit(chatFile);
          break;
        }
      }

      // Si es múltiple, emitir todos los archivos procesados
      if (this.multiple() && processedFiles.length > 0) {
        this.onFilesSelected.emit(processedFiles);
      }

    } catch (error) {
      console.error('Error processing files:', error);
      this.onError.emit('Error al procesar los archivos');
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Obtener icono para tipo de archivo
   */
  getFileIcon(fileType: string): string {
    const iconMap: { [key: string]: string } = {
      'application/pdf': 'fas fa-file-pdf',
      'application/msword': 'fas fa-file-word',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fas fa-file-word',
      'application/vnd.ms-excel': 'fas fa-file-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fas fa-file-excel',
      'application/vnd.ms-powerpoint': 'fas fa-file-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'fas fa-file-powerpoint',
      'text/plain': 'fas fa-file-alt',
      'text/csv': 'fas fa-file-csv',
      'application/zip': 'fas fa-file-archive',
      'application/x-rar-compressed': 'fas fa-file-archive'
    };

    return iconMap[fileType] || 'fas fa-file';
  }

  /**
   * Obtener texto de ayuda
   */
  getHelpText(): string {
    const types: string[] = [];
    
    if (this.acceptImages()) {
      types.push('imágenes');
    }
    
    if (this.acceptDocuments()) {
      types.push('documentos');
    }

    const typeText = types.join(' y ');
    const maxSize = this.chatService.formatFileSize(APP_CONFIG.files.maxSize);
    
    return `Arrastra ${typeText} aquí o haz clic para seleccionar. Máximo ${maxSize}`;
  }
}
