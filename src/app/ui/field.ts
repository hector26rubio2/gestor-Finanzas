import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fin-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <label class="flex flex-col gap-[7px] text-[0.76rem] text-muted-foreground" [class.col-span-full]="full()">
      {{ label() }}
      <ng-content />
    </label>
  `,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly full = input(false);
}
