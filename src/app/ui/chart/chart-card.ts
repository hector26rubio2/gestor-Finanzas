import { Component, input } from '@angular/core';
import { HlmCard } from '@spartan-ng/helm/card';
import { ChartComponent, ChartOption } from './chart';

@Component({
  selector: 'fin-chart-card',
  imports: [ChartComponent, HlmCard],
  host: { class: 'block min-w-0' },
  template: `
    <div hlmCard class="h-full gap-0 p-4">
      <header class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold">{{ title() }}</h2>
          @if (description()) {
            <p class="mt-0.5 text-xs text-muted-foreground">{{ description() }}</p>
          }
        </div>
        <ng-content select="[finChartAcciones]" />
      </header>
      @if (hasData()) {
        <fin-chart class="mt-2" [option]="option()" [height]="height()" [ariaLabel]="title()" />
      } @else {
        <p class="grid place-items-center text-center text-sm text-muted-foreground" [style.min-height.px]="height()">
          {{ empty() }}
        </p>
      }
    </div>
  `,
})
export class ChartCardComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly option = input.required<ChartOption>();
  readonly hasData = input(true);
  readonly empty = input('');
  readonly height = input(200);
}
