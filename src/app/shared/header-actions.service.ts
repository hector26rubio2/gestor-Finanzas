import { Injectable, signal } from '@angular/core';

/**
 * Los botones de exportar/marcar leídas viven en la cabecera compartida del workspace,
 * pero la lógica es de la pestaña activa. Con rutas reales por feature ya no hay un
 * ViewChild al que apuntar: cada pestaña se registra aquí al iniciar y se da de baja al
 * destruirse, y la cabecera invoca lo que esté registrado (o nada, si no aplica a la vista).
 */
@Injectable({ providedIn: 'root' })
export class HeaderActionsService {
  readonly exportReport = signal<(() => void) | null>(null);
  readonly exportMovements = signal<(() => void) | null>(null);
  readonly readAll = signal<(() => void) | null>(null);
}
