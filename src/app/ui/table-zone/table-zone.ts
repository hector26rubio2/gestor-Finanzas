import { Component } from '@angular/core';

@Component({
  selector: 'fin-table-zone',
  host: { class: 'flex min-h-[230px] flex-1 max-[700px]:h-auto max-[700px]:flex-none' },
  template: `<ng-content />`,
})
export class TableZoneComponent {}
