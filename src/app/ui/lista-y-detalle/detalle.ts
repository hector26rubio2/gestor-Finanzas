import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, effect, inject, input, output, viewChild } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '@core/i18n';
import { IconComponent } from '@ui/icon/icon';
import { OverlayComponent } from '@ui/overlay';
import { ListaYDetalleComponent } from './lista-y-detalle';

@Component({
  selector: 'fin-detalle',
  imports: [NgTemplateOutlet, HlmButton, IconComponent, OverlayComponent],
  template: `
    <ng-template #cuerpo><ng-content /></ng-template>
    @if (acoplado()) {
      <aside
        #panel
        role="complementary"
        tabindex="-1"
        [attr.aria-label]="titulo()"
        class="ml-4 flex min-h-0 w-[380px] max-w-[40%] flex-none flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground outline-none"
        (keydown.escape)="cerrar($event)"
      >
        <header class="flex shrink-0 items-center justify-between gap-2 border-b border-border py-2 pr-2 pl-4">
          <h2 class="min-w-0 truncate text-base font-semibold">{{ titulo() }}</h2>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            type="button"
            data-cerrar-detalle
            class="size-11 flex-none"
            [attr.aria-label]="i18n.t('overlay.close')"
            (click)="cerrado.emit()"
          >
            <fin-icon name="close" />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-4 [&_button]:min-h-11">
          <ng-container [ngTemplateOutlet]="cuerpo" />
        </div>
      </aside>
    } @else {
      <fin-overlay [title]="titulo()" mode="inspector" [wide]="ancho()" (closed)="cerrado.emit()"
        ><ng-container [ngTemplateOutlet]="cuerpo"
      /></fin-overlay>
    }
  `,
  host: {
    class: 'contents',
    '(document:keydown.escape)': 'escapeEnElDocumento($event)',
  },
})
export class DetalleComponent {
  readonly i18n = inject(I18nService);
  private readonly lista = inject(ListaYDetalleComponent, { optional: true });
  readonly titulo = input('');
  readonly ancho = input(false);
  readonly acoplable = input(true);
  readonly cerrado = output<void>();
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private elementoPrevio: HTMLElement | null = null;

  readonly acoplado = () => this.acoplable() && (this.lista?.acoplado() ?? false);

  constructor() {
    effect(() => this.lista?.detalleAcoplado.set(this.acoplado()));
    inject(DestroyRef).onDestroy(() => this.lista?.detalleAcoplado.set(false));
    effect(() => {
      const panel = this.panel()?.nativeElement;
      if (!panel) return;
      const activo = document.activeElement;
      this.elementoPrevio = activo instanceof HTMLElement && activo !== document.body ? activo : null;
      panel.focus({ preventScroll: true });
    });
  }

  protected cerrar(evento: Event): void {
    evento.stopPropagation();
    this.devolverFoco();
    this.cerrado.emit();
  }

  protected escapeEnElDocumento(evento: Event): void {
    if (!this.acoplado() || evento.defaultPrevented) return;
    if (document.querySelector('[role=alertdialog], [role=dialog], [role=listbox], [role=menu]')) return;
    this.cerrar(evento);
  }

  private devolverFoco(): void {
    const previo = this.elementoPrevio;
    if (previo?.isConnected) queueMicrotask(() => previo.focus({ preventScroll: true }));
  }
}
