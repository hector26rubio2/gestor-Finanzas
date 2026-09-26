import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { ICONOS_DE_CATEGORIA, iconoDeCategoria } from './category-icons';

@Component({
  selector: 'fin-category-icon',
  imports: [NgIcon],
  providers: [provideIcons(ICONOS_DE_CATEGORIA)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-grid place-items-center leading-none' },
  template: `
    @if (clave(); as nombre) {
      <ng-icon [name]="nombre" size="1em" aria-hidden="true" />
    } @else {
      <span aria-hidden="true">{{ icon() }}</span>
    }
  `,
})
export class CategoryIconComponent {
  readonly icon = input<string | null | undefined>('');
  readonly clave = computed(() => iconoDeCategoria(this.icon()));
}
