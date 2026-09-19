import { HlmScrollAreaImports } from '@spartan-ng/helm/scroll-area';
import { NgScrollbar } from 'ngx-scrollbar';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';

@Component({
  selector: 'fin-sheet-panel',
  imports: [HlmSheetImports, NgScrollbar, HlmScrollAreaImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="right" [state]="open() ? 'open' : 'closed'" (stateChanged)="onStateChanged($event)">
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="w-full gap-0 p-0 data-[side=right]:sm:max-w-xl">
        <hlm-sheet-header class="border-b border-border pe-14">
          <h2 hlmSheetTitle>{{ title() }}</h2>
          @if (subtitle()) {
            <p hlmSheetDescription>{{ subtitle() }}</p>
          }
        </hlm-sheet-header>
        <ng-scrollbar hlm orientation="vertical" class="min-h-0 flex-1">
          <div class="flex flex-col gap-4 p-4">
            <ng-content />
          </div>
        </ng-scrollbar>
        @if (footer()) {
          <hlm-sheet-footer class="flex-row justify-end border-t border-border">
            <ng-content select="[sheetFooter]" />
          </hlm-sheet-footer>
        }
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class SheetPanelComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly footer = input(false);
  readonly closed = output<void>();

  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') this.closed.emit();
  }
}
