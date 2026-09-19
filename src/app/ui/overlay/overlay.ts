import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  input,
} from '@angular/core';
import { I18nService } from '../../core/i18n';

@Component({
  selector: 'fin-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overlay.html',
  styleUrl: './overlay.css',
})
export class OverlayComponent implements AfterViewInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private static nextId = 0;
  readonly titleId = `overlay-title-${OverlayComponent.nextId++}`;
  readonly title = input(this.i18n.t('overlay.defaultTitle'));
  readonly mode = input<'modal' | 'inspector'>('inspector');
  readonly wide = input(false);
  @Output() readonly closed = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('closeButton', { static: true }) private closeButton!: ElementRef<HTMLButtonElement>;
  private previousFocus: HTMLElement | null = null;
  private pointerStartedOnBackdrop = false;
  private emittedClose = false;
  /**
   * Se recuerda quien tenia el foco al construirse, no al pintarse.
   *
   * Entre una cosa y otra cabe el desmontaje de otro panel, y al desmontarse ese devuelve
   * el foco a su propio disparador: el panel nuevo acababa recordando un boton que no era
   * el suyo y, al cerrarse, mandaba el foco a la otra punta de la pantalla. Solo se nota
   * al abrir un panel justo despues de cerrar otro, que es donde lo cazo la suite.
   */
  private readonly abridor = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);

  ngAfterViewInit(): void {
    this.previousFocus = this.abridor;
    this.dialog.nativeElement.showModal();
    this.closeButton.nativeElement.focus();
  }
  ngOnDestroy(): void {
    if (this.dialog.nativeElement.open) this.dialog.nativeElement.close();
    // Solo se devuelve el foco si nadie se lo ha llevado ya a otro sitio con sentido:
    // robarselo a la pantalla que acaba de recibirlo es peor que no devolverlo.
    const activo = document.activeElement;
    const nadieLoTiene = !activo || activo === document.body || this.dialog.nativeElement.contains(activo);
    if (nadieLoTiene && this.previousFocus?.isConnected) this.previousFocus.focus();
  }
  requestClose(): void {
    if (this.dialog.nativeElement.open) this.dialog.nativeElement.close();
    if (!this.emittedClose) {
      this.emittedClose = true;
      this.closed.emit();
    }
  }
  onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }
  backdrop(event: MouseEvent): void {
    if (!this.pointerStartedOnBackdrop || event.target !== this.dialog.nativeElement) return;
    this.pointerStartedOnBackdrop = false;
    if (this.isOutsidePanel(event.clientX, event.clientY)) this.requestClose();
  }
  rememberPointerOrigin(event: PointerEvent): void {
    this.pointerStartedOnBackdrop =
      event.target === this.dialog.nativeElement && this.isOutsidePanel(event.clientX, event.clientY);
  }
  private isOutsidePanel(clientX: number, clientY: number): boolean {
    const rect = this.dialog.nativeElement.getBoundingClientRect();
    return clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
  }
}
