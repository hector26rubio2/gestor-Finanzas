import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { IconComponent, IconName } from '../icon/icon';

const CATEGORY_ICONS: readonly (readonly [RegExp, IconName])[] = [
  [/aliment|comida|restaur|caf[eé]|food|dining/i, 'utensils'],
  [/mercado|super|compra|shop|grocer/i, 'cart'],
  [/transport|movilidad|gasolina|taxi|bus|fuel|car\b/i, 'car'],
  [/hogar|vivienda|arriendo|renta|casa|home|rent|housing/i, 'home'],
  [/salud|m[eé]dic|farmacia|health/i, 'health'],
  [/educaci|estudio|curso|education/i, 'education'],
  [/viaje|vuelo|hotel|travel/i, 'travel'],
  [/ocio|entretenimiento|cine|leisure|entertain/i, 'leisure'],
  [/servicio|luz|agua|internet|utilit/i, 'utilities'],
  [/trabajo|salario|n[oó]mina|sueldo|ingreso|work|salary|income/i, 'work'],
  [/regalo|donaci|gift/i, 'gift'],
  [/ahorro|inversi|saving|invest/i, 'savings'],
  [/pago de tarjeta|tarjeta|deuda|pr[eé]stamo|card|debt|loan/i, 'bank'],
  [/transferencia|transfer/i, 'repeat'],
  [/efectivo|cash/i, 'cash'],
];

export function iconForCategory(name: string): IconName {
  return CATEGORY_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? 'tag';
}

@Component({
  selector: 'fin-category-badge',
  imports: [HlmBadgeImports, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `<span hlmBadge [variant]="variant()" class="h-6 gap-1.5 px-2.5 text-[0.78rem]">
    <fin-icon [name]="icon()" class="[--icon-size:13px]" />{{ name() }}
  </span>`,
})
export class CategoryBadgeComponent {
  readonly name = input.required<string>();
  readonly variant = input<'default' | 'secondary' | 'outline'>('secondary');
  readonly icon = computed(() => iconForCategory(this.name()));
}
