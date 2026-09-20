import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex min-h-0 min-w-0 flex-col [height:max(24rem,calc(100dvh-17rem))] max-[700px]:[height:min(36rem,calc(100dvh-13rem))] [&>fin-table]:rounded-none [&>fin-table]:border-0 [&_[data-testid=table-scroll]]:max-[520px]:overflow-auto!',
  },
  template: `<ng-content />`,
})
export class AdminGridComponent {}
