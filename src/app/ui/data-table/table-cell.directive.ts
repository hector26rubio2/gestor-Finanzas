import { Directive, TemplateRef, input } from '@angular/core';

@Directive({
  selector: 'ng-template[finCell]',
})
export class FinTableCellDirective {
  readonly column = input('', { alias: 'finCell' });
  constructor(readonly template: TemplateRef<{ $implicit: Record<string, any> }>) {}
}
