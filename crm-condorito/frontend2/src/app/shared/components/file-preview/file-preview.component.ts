import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../features/chat/services/chat.service';
import { ChatFile } from '../../../core/models/api.models';

@Component({
  selector: 'app-file-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-preview.component.html',
  styleUrl: './file-preview.component.scss'
})
export class FilePreviewComponent {
  private chatService = inject(ChatService);

  // Inputs
  public file = input.required<ChatFile>();
  public showCaption = input<boolean>(true);
  public showRemove = input<boolean>(true);
  public disabled = input<boolean>(false);

  // Outputs
  public onRemove = output<ChatFile>();
  public onCaptionChange = output<{ file: ChatFile; caption: string }>();

  // Signals
  public caption = signal<string>('');

  /**
   * Remover archivo
   */
  removeFile(): void {
    if (!this.disabled()) {
      this.onRemove.emit(this.file());
    }
  }

  /**
   * Manejar cambio de caption
   */
  onCaptionInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const captionValue = input.value;
    this.caption.set(captionValue);
    this.onCaptionChange.emit({
      file: this.file(),
      caption: captionValue
    });
  }

  /**
   * Obtener icono para tipo de archivo
   */
  getFileIcon(): string {
    const file = this.file();
    const iconMap: { [key: string]: string } = {
      'application/pdf': 'fas fa-file-pdf text-danger',
      'application/msword': 'fas fa-file-word text-primary',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fas fa-file-word text-primary',
      'application/vnd.ms-excel': 'fas fa-file-excel text-success',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fas fa-file-excel text-success',
      'application/vnd.ms-powerpoint': 'fas fa-file-powerpoint text-warning',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'fas fa-file-powerpoint text-warning',
      'text/plain': 'fas fa-file-alt text-secondary',
      'text/csv': 'fas fa-file-csv text-info',
      'application/zip': 'fas fa-file-archive text-dark',
      'application/x-rar-compressed': 'fas fa-file-archive text-dark'
    };

    return iconMap[file.file.type] || 'fas fa-file text-secondary';
  }

  /**
   * Obtener nombre truncado del archivo
   */
  getTruncatedName(): string {
    const name = this.file().name;
    if (name.length <= 25) return name;
    
    const extension = name.split('.').pop() || '';
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, 20) + '...';
    
    return extension ? `${truncated}.${extension}` : truncated;
  }

  /**
   * Verificar si es imagen
   */
  isImage(): boolean {
    return this.file().type === 'image';
  }

  /**
   * Verificar si es documento
   */
  isDocument(): boolean {
    return this.file().type === 'document';
  }
}
