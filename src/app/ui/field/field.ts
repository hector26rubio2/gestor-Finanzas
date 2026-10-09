import { Component, ElementRef, afterRenderEffect, computed, inject, input } from '@angular/core';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { ErroresDeFormulario } from './errores-de-formulario';

const SELECTOR_DE_CONTROL = 'input, textarea, select, [data-slot="select-trigger"], [role="combobox"]';
let contadorDeCampos = 0;

@Component({
  selector: 'fin-field',
  imports: [HlmFieldImports],
  host: { class: 'contents' },
  template: `
    <div hlmField class="min-w-0 gap-2" [class.col-span-full]="full()" [attr.data-invalid]="mensaje() ? true : null">
      <label class="flex flex-col gap-2">
        <span hlmFieldLabel class="text-xs font-medium text-muted-foreground">{{ label() }}</span>
        <ng-content />
      </label>
      @if (mensaje()) {
        <p class="text-xs text-destructive" role="alert" [id]="idDelError">{{ mensaje() }}</p>
      }
    </div>
  `,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly full = input(false);
  readonly error = input('');
  readonly campo = input('');

  private readonly errores = inject(ErroresDeFormulario, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly idDelError = `fin-field-error-${++contadorDeCampos}`;
  readonly mensaje = computed(() => this.error() || (this.campo() ? (this.errores?.de(this.campo()) ?? '') : ''));

  constructor() {
    afterRenderEffect(() => this.marcarControl(this.mensaje()));
  }

  private marcarControl(mensaje: string): void {
    const control = this.host.querySelector(SELECTOR_DE_CONTROL);
    if (!control) return;
    if (mensaje) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', this.idDelError);
    } else if (control.getAttribute('aria-describedby') === this.idDelError) {
      control.removeAttribute('aria-invalid');
      control.removeAttribute('aria-describedby');
    }
  }
}
