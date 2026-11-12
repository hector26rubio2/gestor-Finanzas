import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '@core/i18n';
import type { Account } from '@core/state';
import { IconComponent } from '@ui/icon/icon';
import { AccountFormComponent } from './account-form';
import type { PropuestaDeCuenta } from './propuesta-de-cuenta';

@Component({
  selector: 'fin-crear-cuenta-al-vuelo',
  imports: [HlmButton, IconComponent, AccountFormComponent],
  host: { style: 'display: contents' },
  template: `
    @if (propuesta(); as sugerencia) {
      <button
        hlmBtn
        type="button"
        variant="outline"
        size="icon"
        [attr.data-tour]="dataTour()"
        [attr.aria-label]="etiqueta()"
        [attr.aria-haspopup]="'dialog'"
        [attr.aria-expanded]="abierto()"
        (click)="abierto.set(true)"
      >
        <fin-icon name="plus" />
      </button>
      @if (abierto()) {
        <fin-account-form
          modo="al-vuelo"
          [tipoSugerido]="sugerencia.tipoSugerido"
          [monedaSugerida]="sugerencia.monedaSugerida"
          [tiposAdmitidos]="sugerencia.tipos"
          (creada)="alCrear($event)"
          (cancelada)="cerrar()"
        />
      }
    }
  `,
})
export class CrearCuentaAlVueloComponent {
  readonly i18n = inject(I18nService);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly propuesta = input<PropuestaDeCuenta | null>(null);
  readonly dataTour = input<string | null>(null);
  readonly creada = output<Account>();
  readonly abierto = signal(false);

  readonly etiqueta = computed(() =>
    this.i18n.t(
      this.propuesta()?.tipos.every((tipo) => tipo === 'credit')
        ? 'form.movement.account.addCard'
        : 'form.movement.account.addAccount',
    ),
  );

  alCrear(cuenta: Account): void {
    this.creada.emit(cuenta);
    this.cerrar();
  }

  cerrar(): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    setTimeout(() => this.enfocarSelector());
  }

  private enfocarSelector(): void {
    const campo = this.anfitrion.nativeElement.parentElement;
    campo?.querySelector<HTMLElement>('[data-slot="select-trigger"]')?.focus();
  }
}
