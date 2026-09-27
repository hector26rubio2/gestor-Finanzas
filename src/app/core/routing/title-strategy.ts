import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from '@core/i18n';

const APP_NAME = 'Finanzas';

@Injectable({ providedIn: 'root' })
export class FinanzasTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private readonly section = signal<string | null>(null);

  constructor() {
    super();
    effect(() => {
      const key = this.section();
      this.title.setTitle(key ? `${this.i18n.t(key)} · ${APP_NAME}` : APP_NAME);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.section.set(this.buildTitle(snapshot) ?? null);
  }
}
