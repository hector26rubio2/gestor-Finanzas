import { Directive, Input, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[finCell]',
})
export class FinTableCellDirective {
  @Input('finCell') column = '';
  constructor(readonly template: TemplateRef<{ $implicit: Record<string, any> }>) {}
}
