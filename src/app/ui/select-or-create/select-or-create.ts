import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { I18nService } from '@core/i18n';
import type { UiOption } from '@ui/select';

export const OPCION_CREAR = '__fin_crear__';

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase();

export function textoParaCrear(opciones: readonly UiOption[], busqueda: string, puedeCrear: boolean): string {
  const texto = busqueda.trim();
  if (!puedeCrear || !texto) return '';
  return opciones.some((opcion) => normalizar(opcion.label) === normalizar(texto)) ? '' : texto;
}

let siguienteId = 0;

@Component({
  selector: 'fin-select-or-create',
  imports: [HlmComboboxImports],
  host: { class: 'block' },
  template: `
    <label class="sr-only" [for]="inputId">{{ ariaLabel() }}</label>
    <hlm-combobox
      [value]="valorDelCombobox()"
      [itemToString]="etiquetaDe"
      [filter]="coincide"
      [disabled]="disabled()"
      (searchChange)="busqueda.set($event)"
      (valueChange)="elegir($event)"
    >
      <hlm-combobox-input
        class="w-full"
        [inputId]="inputId"
        [placeholder]="placeholder()"
        [triggerAriaLabel]="ariaLabel()"
        [clearAriaLabel]="i18n.t('selectOrCreate.clear')"
        showClear
      />
      <hlm-combobox-content *hlmComboboxPortal>
        <div hlmComboboxList>
          @for (opcion of options(); track opcion.value) {
            <hlm-combobox-item [value]="opcion.value">{{ opcion.label }}</hlm-combobox-item>
          }
          @if (crear()) {
            <hlm-combobox-item [value]="opcionCrear">{{
              i18n.t('selectOrCreate.create', { name: crear() })
            }}</hlm-combobox-item>
          }
        </div>
        <hlm-combobox-empty>{{
          i18n.t(canCreate() ? 'selectOrCreate.typeToCreate' : 'selectOrCreate.empty')
        }}</hlm-combobox-empty>
      </hlm-combobox-content>
    </hlm-combobox>
  `,
})
export class UiSelectOrCreateComponent {
  readonly i18n = inject(I18nService);
  readonly options = input.required<readonly UiOption[]>();
  readonly value = input('');
  readonly ariaLabel = input.required<string>();
  readonly placeholder = input('');
  readonly canCreate = input(false);
  readonly disabled = input(false);
  readonly valueChange = output<string>();
  readonly create = output<string>();

  readonly inputId = `fin-select-or-create-${siguienteId++}`;
  readonly opcionCrear = OPCION_CREAR;
  readonly busqueda = signal('');
  readonly crear = computed(() => textoParaCrear(this.options(), this.busqueda(), this.canCreate()));
  readonly valorDelCombobox = computed(() => this.value() || null);

  readonly etiquetaDe = (valor: string | null): string =>
    valor === OPCION_CREAR ? this.crear() : (this.options().find((opcion) => opcion.value === valor)?.label ?? '');

  readonly coincide = (valor: string, busqueda: string): boolean =>
    valor === OPCION_CREAR || normalizar(this.etiquetaDe(valor)).includes(normalizar(busqueda));

  elegir(valor: string | null | undefined): void {
    if (valor === OPCION_CREAR) {
      const nombre = this.crear();
      if (nombre) this.create.emit(nombre);
      return;
    }
    this.valueChange.emit(valor ?? '');
  }
}
