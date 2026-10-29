import { NgTemplateOutlet } from '@angular/common';
import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { NgScrollbar } from 'ngx-scrollbar';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { anchoAlArrastrar, limitarAncho } from './ancho-del-panel';

const ANCHO_MINIMO = 576;
const ANCHO_MINIMO_AMPLIO = 768;
const CLAVE_DE_ANCHOS = 'fin.panel.anchos';

type Anchos = Partial<Record<'normal' | 'amplio', number>>;

function leerAnchos(): Anchos {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_DE_ANCHOS) ?? '{}') as Anchos;
    return typeof guardado === 'object' && guardado ? guardado : {};
  } catch {
    return {};
  }
}

function sinClave(anchos: Anchos, clave: keyof Anchos): Anchos {
  const copia = { ...anchos };
  delete copia[clave];
  return copia;
}

function guardarAnchos(anchos: Anchos): void {
  try {
    localStorage.setItem(CLAVE_DE_ANCHOS, JSON.stringify(anchos));
  } catch {
    return;
  }
}
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { I18nService } from '@core/i18n';
import { IconComponent } from '@ui/icon/icon';

@Component({
  selector: 'fin-overlay',
  imports: [
    NgTemplateOutlet,
    NgScrollbar,
    HlmScrollAreaImports,
    HlmButton,
    HlmDialogImports,
    HlmSheetImports,
    IconComponent,
  ],
  template: `
    <ng-template #body><ng-content /></ng-template>
    @if (mode() === 'modal') {
      <hlm-dialog state="open" (stateChanged)="onStateChanged($event)">
        <hlm-dialog-content
          *hlmDialogPortal="let ctx"
          [showCloseButton]="false"
          class="flex max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100vw-2rem))] max-w-none flex-col gap-0 p-0 sm:max-w-none"
        >
          <header class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-5">
            <h2 hlmDialogTitle class="text-lg font-semibold">{{ title() }}</h2>
            <button hlmBtn variant="ghost" size="icon-sm" hlmDialogClose [attr.aria-label]="i18n.t('overlay.close')">
              <fin-icon name="close" />
            </button>
          </header>
          <ng-scrollbar hlm orientation="vertical" class="min-h-0 flex-1"
            ><div class="p-6"><ng-container [ngTemplateOutlet]="body" /></div
          ></ng-scrollbar>
        </hlm-dialog-content>
      </hlm-dialog>
    } @else {
      <hlm-sheet side="right" state="open" (stateChanged)="onStateChanged($event)">
        <hlm-sheet-content
          *hlmSheetPortal="let ctx"
          [showCloseButton]="false"
          [class]="
            ancho()
              ? 'data-[side=right]:sm:max-w-none'
              : wide()
                ? 'data-[side=right]:sm:max-w-3xl'
                : 'data-[side=right]:sm:max-w-xl'
          "
          [style.width.px]="ancho()"
          class="w-full gap-0 p-0"
        >
          <div
            role="separator"
            tabindex="0"
            aria-orientation="vertical"
            [attr.aria-label]="i18n.t('overlay.resize')"
            [attr.aria-valuemin]="minimo()"
            [attr.aria-valuenow]="ancho() ?? minimo()"
            class="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize touch-none after:absolute after:inset-y-0 after:left-[3px] after:w-0.5 after:rounded-full after:bg-transparent after:transition-colors hover:after:bg-primary/60 focus-visible:outline-none focus-visible:after:bg-primary sm:block"
            (pointerdown)="empezarArrastre($event)"
            (pointermove)="arrastrar($event)"
            (pointerup)="terminarArrastre($event)"
            (pointercancel)="terminarArrastre($event)"
            (dblclick)="restablecerAncho()"
            (keydown.arrowleft)="$event.preventDefault(); moverAncho(PASO_DE_TECLADO)"
            (keydown.arrowright)="$event.preventDefault(); moverAncho(-PASO_DE_TECLADO)"
          ></div>
          <header class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-5">
            <h2 hlmSheetTitle class="text-lg font-semibold">{{ title() }}</h2>
            <button hlmBtn variant="ghost" size="icon-sm" hlmSheetClose [attr.aria-label]="i18n.t('overlay.close')">
              <fin-icon name="close" />
            </button>
          </header>
          <ng-scrollbar hlm orientation="vertical" class="min-h-0 flex-1"
            ><div class="p-6"><ng-container [ngTemplateOutlet]="body" /></div
          ></ng-scrollbar>
        </hlm-sheet-content>
      </hlm-sheet>
    }
  `,
})
export class OverlayComponent {
  readonly i18n = inject(I18nService);
  readonly title = input(this.i18n.t('overlay.defaultTitle'));
  readonly mode = input<'modal' | 'inspector'>('inspector');
  readonly wide = input(false);
  readonly closed = output<void>();
  private emittedClose = false;

  protected readonly PASO_DE_TECLADO = 32;
  protected readonly minimo = computed(() => (this.wide() ? ANCHO_MINIMO_AMPLIO : ANCHO_MINIMO));
  private readonly anchosGuardados = signal(leerAnchos());
  protected readonly ancho = computed(() => this.anchosGuardados()[this.claveDeAncho()] ?? null);
  private readonly claveDeAncho = computed(() => (this.wide() ? 'amplio' : 'normal'));
  private arrastrando = false;

  protected empezarArrastre(evento: PointerEvent): void {
    this.arrastrando = true;
    (evento.target as HTMLElement).setPointerCapture?.(evento.pointerId);
  }

  protected arrastrar(evento: PointerEvent): void {
    if (this.arrastrando) this.fijarAncho(anchoAlArrastrar(window.innerWidth, evento.clientX, this.minimo()), false);
  }

  protected terminarArrastre(evento: PointerEvent): void {
    if (!this.arrastrando) return;
    this.arrastrando = false;
    (evento.target as HTMLElement).releasePointerCapture?.(evento.pointerId);
    guardarAnchos(this.anchosGuardados());
  }

  protected moverAncho(delta: number): void {
    this.fijarAncho(limitarAncho((this.ancho() ?? this.minimo()) + delta, this.minimo(), window.innerWidth), true);
  }

  protected restablecerAncho(): void {
    this.anchosGuardados.update((anchos) => sinClave(anchos, this.claveDeAncho()));
    guardarAnchos(this.anchosGuardados());
  }

  private fijarAncho(ancho: number, guardar: boolean): void {
    const clave = this.claveDeAncho();
    this.anchosGuardados.update((anchos) =>
      ancho <= this.minimo() ? sinClave(anchos, clave) : { ...anchos, [clave]: ancho },
    );
    if (guardar) guardarAnchos(this.anchosGuardados());
  }

  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state !== 'closed' || this.emittedClose) return;
    this.emittedClose = true;
    this.closed.emit();
  }
}
