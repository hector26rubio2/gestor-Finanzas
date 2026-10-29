import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[finTableRowDetail]',
})
export class FinTableRowDetailDirective {
  constructor(readonly template: TemplateRef<{ $implicit: Record<string, any> }>) {}
}
