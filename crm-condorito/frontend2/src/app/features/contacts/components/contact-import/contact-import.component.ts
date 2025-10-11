import { Component, inject, signal, OnDestroy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ContactsService } from '../../services/contacts.service';
import { LoadingService } from '../../../../core/services/loading.service';

interface ImportPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
}

/**
 * Componente para importar contactos desde CSV
 */
@Component({
  selector: 'app-contact-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact-import.component.html',
  styleUrl: './contact-import.component.scss'
})
export class ContactImportComponent implements OnDestroy {
  private contactsService = inject(ContactsService);
  public loadingService = inject(LoadingService);

  // Inputs
  public isVisible = input<boolean>(false);

  // Outputs
  public onClose = output<void>();
  public onImported = output<{ success: boolean; message: string; count?: number }>();

  // Signals
  public selectedFile = signal<File | null>(null);
  public importPreview = signal<ImportPreview | null>(null);
  public errorMessage = signal<string>('');
  public successMessage = signal<string>('');
  public dragOver = signal<boolean>(false);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  // CSV Template
  public csvTemplate = `phone_number,name,custom_name,comments,is_blocked
+5491150239962,Juan Pérez,Cliente VIP,Cliente frecuente,false
+5491150239963,María García,,Contacto nuevo,false
+5491150239964,Carlos López,Proveedor,Empresa de servicios,false`;

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Manejar selección de archivo
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  /**
   * Manejar drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  /**
   * Manejar drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  /**
   * Manejar drop de archivo
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  /**
   * Procesar archivo seleccionado
   */
  private handleFile(file: File): void {
    // Validar tipo de archivo
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.errorMessage.set('Por favor selecciona un archivo CSV válido');
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage.set('El archivo es demasiado grande. Máximo 5MB permitido');
      return;
    }

    this.selectedFile.set(file);
    this.clearMessages();
    this.previewImport();
  }

  /**
   * Previsualizar importación
   */
  private previewImport(): void {
    const file = this.selectedFile();
    if (!file) return;

    const loadingId = this.loadingService.startLoading('preview-import', 'Analizando archivo...');

    const subscription = this.contactsService.previewImport(file).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.importPreview.set(response.data);
        } else {
          this.errorMessage.set(response.message || 'Error al previsualizar el archivo');
        }
      },
      error: (error) => {
        console.error('Error previewing import:', error);
        this.errorMessage.set('Error al procesar el archivo: ' + (error.message || 'Error desconocido'));
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Ejecutar importación
   */
  executeImport(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.clearMessages();
    const loadingId = this.loadingService.startLoading('execute-import', 'Importando contactos...');

    const subscription = this.contactsService.importContacts(file).subscribe({
      next: (response) => {
        if (response.success) {
          const count = response.data?.imported || 0;
          this.successMessage.set(`¡Importación exitosa! ${count} contactos importados correctamente`);
          this.onImported.emit({ 
            success: true, 
            message: `${count} contactos importados correctamente`,
            count 
          });
          setTimeout(() => this.close(), 2000);
        } else {
          this.errorMessage.set(response.message || 'Error durante la importación');
        }
      },
      error: (error) => {
        console.error('Error executing import:', error);
        this.errorMessage.set('Error durante la importación: ' + (error.message || 'Error desconocido'));
      },
      complete: () => {
        this.loadingService.stopLoading(loadingId);
      }
    });

    this.subscriptions.push(subscription);
  }

  /**
   * Descargar template CSV
   */
  downloadTemplate(): void {
    const blob = new Blob([this.csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_contactos.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Limpiar selección
   */
  clearSelection(): void {
    this.selectedFile.set(null);
    this.importPreview.set(null);
    this.clearMessages();
  }

  /**
   * Cerrar modal
   */
  close(): void {
    this.clearSelection();
    this.onClose.emit();
  }

  /**
   * Limpiar mensajes
   */
  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  /**
   * Obtener nombre del archivo
   */
  getFileName(): string {
    return this.selectedFile()?.name || '';
  }

  /**
   * Obtener tamaño del archivo formateado
   */
  getFileSize(): string {
    const file = this.selectedFile();
    if (!file) return '';

    const bytes = file.size;
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Verificar si se puede importar
   */
  canImport(): boolean {
    const preview = this.importPreview();
    return !!(preview && preview.validRows > 0 && !this.loadingService.isLoadingByContext('execute-import'));
  }
}
