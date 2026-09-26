import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { I18nService } from '../../core/i18n';
import { CategoryIconComponent } from '../category-icon/category-icon';
import { ICONOS_DE_CATEGORIA, NOMBRES_DE_ICONO, iconoDeCategoria } from '../category-icon/category-icons';

@Component({
  selector: 'fin-icon-picker',
  imports: [NgIcon, HlmButton, HlmInput, HlmPopoverImports, CategoryIconComponent],
  providers: [provideIcons(ICONOS_DE_CATEGORIA)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-popover [state]="abierto() ? 'open' : 'closed'" (stateChanged)="abierto.set($event === 'open')">
      <button
        hlmBtn
        hlmPopoverTrigger
        variant="outline"
        type="button"
        class="w-full justify-start gap-2.5"
        [attr.aria-label]="i18n.t('iconPicker.open', { label: label() })"
      >
        <span class="grid size-6 place-items-center rounded-md bg-muted text-base" [style.color]="color()">
          <fin-category-icon [icon]="value()" />
        </span>
        <span class="truncate text-muted-foreground">{{ seleccionado() ?? i18n.t('iconPicker.choose') }}</span>
      </button>
      <div *hlmPopoverPortal="let ctx" hlmPopoverContent class="grid w-80 gap-2 p-3">
        <input
          hlmInput
          type="search"
          [value]="buscado()"
          (input)="buscado.set($any($event.target).value)"
          [placeholder]="i18n.t('iconPicker.search')"
          [attr.aria-label]="i18n.t('iconPicker.search')"
        />
        <div class="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto p-0.5" role="listbox" [attr.aria-label]="label()">
          @for (nombre of visibles(); track nombre) {
            <button
              hlmBtn
              variant="ghost"
              size="icon"
              type="button"
              role="option"
              class="size-8 data-[activo=true]:bg-accent data-[activo=true]:text-primary data-[activo=true]:ring-2 data-[activo=true]:ring-primary"
              [attr.data-activo]="nombre === seleccionado()"
              [attr.aria-selected]="nombre === seleccionado()"
              [attr.aria-label]="nombre"
              [attr.title]="nombre"
              (click)="elegir(nombre)"
            >
              <ng-icon [name]="nombre" size="18" aria-hidden="true" />
            </button>
          } @empty {
            <p class="col-span-full py-4 text-center text-xs text-muted-foreground">{{ i18n.t('iconPicker.empty') }}</p>
          }
        </div>
      </div>
    </hlm-popover>
  `,
})
export class IconPickerComponent {
  readonly i18n = inject(I18nService);
  readonly value = model<string>('');
  readonly label = input('');
  readonly color = input<string | null>(null);
  readonly abierto = signal(false);
  readonly buscado = signal('');
  readonly seleccionado = computed(() => iconoDeCategoria(this.value()));
  readonly visibles = computed(() => {
    const texto = this.buscado().trim().toLocaleLowerCase();
    return texto ? NOMBRES_DE_ICONO.filter((nombre) => nombre.includes(texto)) : NOMBRES_DE_ICONO;
  });

  elegir(nombre: string): void {
    this.value.set(nombre);
    this.abierto.set(false);
  }
}
