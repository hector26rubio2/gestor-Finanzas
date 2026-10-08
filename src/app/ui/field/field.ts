import { Component, input } from '@angular/core';
import { HlmFieldImports } from '@spartan-ng/helm/field';

@Component({
  selector: 'fin-field',
  imports: [HlmFieldImports],
  host: { class: 'contents' },
  template: `
    <div hlmField class="min-w-0 gap-2" [class.col-span-full]="full()" [attr.data-invalid]="error() ? true : null">
      <label class="flex flex-col gap-2">
        <span hlmFieldLabel class="text-[0.78rem] font-medium text-muted-foreground">{{ label() }}</span>
        <ng-content />
      </label>
      @if (error()) {
        <p class="text-xs text-destructive" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly full = input(false);
  readonly error = input('');
}
