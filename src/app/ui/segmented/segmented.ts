import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { IconComponent, IconName } from '@ui/icon/icon';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: IconName;
}

@Component({
  selector: 'fin-segmented',
  imports: [HlmTabsImports, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-tabs [tab]="value()" (tabActivated)="valueChange.emit($event)">
      <hlm-tabs-list class="grid h-11 w-full auto-cols-fr grid-flow-col" [attr.aria-label]="ariaLabel()">
        @for (opcion of options(); track opcion.value) {
          <button
            [hlmTabsTrigger]="opcion.value"
            type="button"
            class="h-full gap-2 px-5 font-semibold whitespace-nowrap"
          >
            @if (opcion.icon) {
              <fin-icon [name]="opcion.icon" />
            }
            {{ opcion.label }}
          </button>
        }
      </hlm-tabs-list>
    </hlm-tabs>
  `,
})
export class SegmentedComponent {
  readonly value = input.required<string>();
  readonly options = input.required<readonly SegmentedOption[]>();
  readonly ariaLabel = input('');
  readonly valueChange = output<string>();
}
