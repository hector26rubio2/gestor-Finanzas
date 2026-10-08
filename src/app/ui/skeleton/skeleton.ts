import { Component, computed, inject, input } from '@angular/core';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { I18nService } from '@core/i18n';

export type TipoDeSkeleton = 'tabla' | 'kpi' | 'grafica' | 'lista' | 'formulario';

@Component({
  selector: 'fin-skeleton',
  imports: [HlmSkeleton],
  host: { class: 'block rounded-lg bg-card p-6', 'aria-busy': 'true' },
  template: `
    <span role="status" class="sr-only">{{ i18n.t('skeleton.loading') }}</span>
    @switch (tipo()) {
      @case ('kpi') {
        <div class="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
          @for (i of repeticiones(); track i) {
            <div class="grid gap-3">
              <div hlmSkeleton class="h-3 w-1/2"></div>
              <div hlmSkeleton class="h-8 w-3/4"></div>
              <div hlmSkeleton class="h-3 w-2/3"></div>
            </div>
          }
        </div>
      }
      @case ('grafica') {
        <div hlmSkeleton class="mb-4 h-4 w-1/3"></div>
        <div class="flex h-48 items-end gap-2">
          @for (alto of barras; track $index) {
            <div hlmSkeleton class="flex-1" [style.height.%]="alto"></div>
          }
        </div>
      }
      @case ('lista') {
        @for (i of repeticiones(); track i) {
          <div class="flex items-center gap-3 py-2">
            <div hlmSkeleton class="size-9 shrink-0 rounded-full"></div>
            <div class="grid flex-1 gap-2">
              <div hlmSkeleton class="h-3 w-2/3"></div>
              <div hlmSkeleton class="h-3 w-1/3"></div>
            </div>
          </div>
        }
      }
      @case ('formulario') {
        <div class="grid gap-4 sm:grid-cols-2">
          @for (i of repeticiones(); track i) {
            <div class="grid gap-2">
              <div hlmSkeleton class="h-3 w-1/3"></div>
              <div hlmSkeleton class="h-10"></div>
            </div>
          }
        </div>
      }
      @default {
        <div hlmSkeleton class="mb-4 h-5 w-2/5"></div>
        @for (i of repeticiones(); track i) {
          <div hlmSkeleton class="mb-4 h-8"></div>
        }
      }
    }
  `,
})
export class SkeletonComponent {
  readonly i18n = inject(I18nService);
  readonly tipo = input<TipoDeSkeleton>('tabla');
  readonly filas = input(3);
  readonly repeticiones = computed(() => Array.from({ length: Math.max(1, this.filas()) }, (_, i) => i));
  readonly barras = [45, 70, 55, 85, 40, 65, 75, 50];
}
