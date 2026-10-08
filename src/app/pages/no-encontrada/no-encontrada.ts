import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '@core/i18n';

@Component({
  selector: 'fin-no-encontrada',
  imports: [HlmButton, RouterLink],
  host: {
    class:
      'mx-auto my-12 grid max-w-[60ch] justify-items-start gap-3 rounded-lg border border-border bg-card p-8 text-foreground',
  },
  template: `
    <section class="contents" role="status">
      <h1 class="text-[1.2rem]">{{ i18n.t('notFound.title') }}</h1>
      <p class="leading-[1.6] text-muted-foreground">{{ i18n.t('notFound.detail') }}</p>
      <a hlmBtn routerLink="/dashboard" class="mt-1.5">{{ i18n.t('notFound.goHome') }}</a>
    </section>
  `,
})
export class NoEncontradaComponent {
  readonly i18n = inject(I18nService);
}
