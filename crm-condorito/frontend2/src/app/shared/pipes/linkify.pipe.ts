import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'linkify',
  standalone: true
})
export class LinkifyPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {}

  transform(text: string): SafeHtml {
    if (!text) return '';

    // Regex para detectar URLs (http, https, www, y dominios simples)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}[^\s]*)/gi;
    
    // Preservar saltos de línea convirtiéndolos a <br>
    let linkedText = text.replace(/\n/g, '<br>');
    
    // Convertir URLs en enlaces clickeables
    linkedText = linkedText.replace(urlRegex, (url) => {
      let href = url;
      
      // Agregar protocolo si no lo tiene
      if (!url.match(/^https?:\/\//)) {
        href = 'https://' + url;
      }
      
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(linkedText);
  }
}
