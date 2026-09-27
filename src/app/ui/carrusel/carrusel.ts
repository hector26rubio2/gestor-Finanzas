import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { I18nService } from '../../core/i18n';
import { IconComponent } from '../icon/icon';

const UMBRAL_DE_ARRASTRE = 4;

@Component({
  selector: 'fin-carrusel',
  imports: [HlmButtonImports, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative flex min-w-0 shrink-0 items-center gap-1' },
  template: `
    <button
      hlmBtn
      type="button"
      variant="outline"
      size="icon-sm"
      class="flex-none rounded-full"
      [class.invisible]="!puedeRetroceder()"
      [attr.aria-hidden]="!puedeRetroceder()"
      [tabindex]="puedeRetroceder() ? 0 : -1"
      [attr.aria-label]="i18n.t('carousel.previous')"
      (click)="desplazar(-1)"
    >
      <fin-icon name="previous" />
    </button>
    <div
      #pista
      class="flex min-w-0 flex-1 touch-pan-x overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      [class.cursor-grab]="desborda()"
      [class.cursor-grabbing]="arrastrando()"
      [class.select-none]="arrastrando()"
      [class.scroll-auto]="arrastrando()"
      role="region"
      [attr.aria-label]="ariaLabel()"
      (scroll)="medir()"
      (wheel)="alRodar($event)"
      (pointerdown)="empezar($event)"
      (pointermove)="mover($event)"
      (pointerup)="terminar($event)"
      (pointercancel)="terminar($event)"
    >
      <ng-content />
    </div>
    <button
      hlmBtn
      type="button"
      variant="outline"
      size="icon-sm"
      class="flex-none rounded-full"
      [class.invisible]="!puedeAvanzar()"
      [attr.aria-hidden]="!puedeAvanzar()"
      [tabindex]="puedeAvanzar() ? 0 : -1"
      [attr.aria-label]="i18n.t('carousel.next')"
      (click)="desplazar(1)"
    >
      <fin-icon name="next" />
    </button>
  `,
})
export class CarruselComponent {
  readonly i18n = inject(I18nService);
  readonly ariaLabel = input('');
  private readonly pista = viewChild.required<ElementRef<HTMLElement>>('pista');
  readonly puedeRetroceder = signal(false);
  readonly puedeAvanzar = signal(false);
  readonly desborda = signal(false);
  readonly arrastrando = signal(false);
  private inicio: { x: number; scroll: number; puntero: number } | null = null;
  private huboArrastre = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const elemento = this.pista().nativeElement;
      const observador = new ResizeObserver(() => this.medir());
      observador.observe(elemento);
      const cambios = new MutationObserver(() => this.medir());
      cambios.observe(elemento, { childList: true, subtree: true });
      const alClic = (evento: MouseEvent) => this.bloquearClicTrasArrastre(evento);
      elemento.addEventListener('click', alClic, true);
      this.medir();
      destroyRef.onDestroy(() => {
        observador.disconnect();
        cambios.disconnect();
        elemento.removeEventListener('click', alClic, true);
      });
    });
  }

  medir(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this.pista().nativeElement;
    const sobrante = scrollWidth - clientWidth;
    this.desborda.set(sobrante > 1);
    this.puedeRetroceder.set(scrollLeft > 1);
    this.puedeAvanzar.set(scrollLeft < sobrante - 1);
  }

  desplazar(sentido: 1 | -1): void {
    const elemento = this.pista().nativeElement;
    elemento.scrollBy({ left: sentido * elemento.clientWidth * 0.8, behavior: 'smooth' });
  }

  alRodar(evento: WheelEvent): void {
    if (!this.desborda() || Math.abs(evento.deltaX) > Math.abs(evento.deltaY)) return;
    const elemento = this.pista().nativeElement;
    const antes = elemento.scrollLeft;
    elemento.scrollLeft += evento.deltaY;
    if (elemento.scrollLeft !== antes) evento.preventDefault();
  }

  empezar(evento: PointerEvent): void {
    if (evento.pointerType !== 'mouse' || evento.button !== 0 || !this.desborda()) return;
    this.inicio = { x: evento.clientX, scroll: this.pista().nativeElement.scrollLeft, puntero: evento.pointerId };
    this.huboArrastre = false;
  }

  mover(evento: PointerEvent): void {
    if (!this.inicio || evento.pointerId !== this.inicio.puntero) return;
    const recorrido = evento.clientX - this.inicio.x;
    if (!this.huboArrastre && Math.abs(recorrido) < UMBRAL_DE_ARRASTRE) return;
    const elemento = this.pista().nativeElement;
    if (!this.huboArrastre) {
      this.huboArrastre = true;
      this.arrastrando.set(true);
      elemento.setPointerCapture(evento.pointerId);
    }
    elemento.scrollLeft = this.inicio.scroll - recorrido;
  }

  terminar(evento: PointerEvent): void {
    if (!this.inicio || evento.pointerId !== this.inicio.puntero) return;
    const elemento = this.pista().nativeElement;
    if (elemento.hasPointerCapture(evento.pointerId)) elemento.releasePointerCapture(evento.pointerId);
    this.inicio = null;
    this.arrastrando.set(false);
  }

  bloquearClicTrasArrastre(evento: MouseEvent): void {
    if (!this.huboArrastre) return;
    this.huboArrastre = false;
    evento.preventDefault();
    evento.stopPropagation();
  }
}
