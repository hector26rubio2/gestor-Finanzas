import { Component, Directive, ElementRef, effect, inject, input, output, untracked } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '@core/i18n';
import { IconComponent } from '@ui/icon/icon';

@Component({
  selector: 'fin-boton-de-alta',
  imports: [HlmButton, IconComponent],
  host: { style: 'display: contents' },
  template: `
    <button
      hlmBtn
      type="button"
      variant="outline"
      size="icon"
      [attr.data-tour]="dataTour()"
      [attr.aria-label]="abierto() ? i18n.t('form.actions.cancel') : etiqueta()"
      [attr.aria-expanded]="abierto()"
      (click)="alternar.emit()"
    >
      @if (abierto()) {
        <fin-icon name="close" />
      } @else {
        <fin-icon name="plus" />
      }
    </button>
  `,
})
export class BotonDeAltaComponent {
  readonly i18n = inject(I18nService);
  readonly etiqueta = input.required<string>();
  readonly abierto = input(false);
  readonly dataTour = input<string | null>(null);
  readonly alternar = output<void>();
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private estabaAbierto = false;

  private readonly devolverElFoco = effect(() => {
    const abierto = this.abierto();
    untracked(() => {
      if (this.estabaAbierto && !abierto) setTimeout(() => this.enfocarSiSePerdio());
      this.estabaAbierto = abierto;
    });
  });

  private enfocarSiSePerdio(): void {
    const activo = document.activeElement;
    if (activo && activo !== document.body) return;
    this.anfitrion.nativeElement.querySelector('button')?.focus();
  }
}

@Directive({
  selector: '[finCancelarConEscape]',
  host: { '(keydown.escape)': 'cancelarConEscape($event)' },
})
export class CancelarConEscape {
  readonly cancelar = output<void>();

  protected cancelarConEscape(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.cancelar.emit();
  }
}
