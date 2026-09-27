import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HlmFieldImports } from '@spartan-ng/helm/field';

@Component({
  selector: 'fin-field',
  imports: [HlmFieldImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div hlmField class="gap-2" [class.col-span-full]="full()">
      <label class="flex flex-col gap-2">
        <span hlmFieldLabel class="text-[0.78rem] font-medium text-muted-foreground">{{ label() }}</span>
        <ng-content />
      </label>
    </div>
  `,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly full = input(false);
}
