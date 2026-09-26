import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HlmFieldImports } from '@spartan-ng/helm/field';

@Component({
  selector: 'fin-field',
  imports: [HlmFieldImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <label hlmField class="gap-2" [class.col-span-full]="full()">
      <span hlmFieldLabel class="text-[0.78rem] font-medium text-muted-foreground">{{ label() }}</span>
      <ng-content />
    </label>
  `,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly full = input(false);
}
