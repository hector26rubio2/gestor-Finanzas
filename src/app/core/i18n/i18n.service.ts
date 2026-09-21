import { Injectable, signal } from '@angular/core';

type Messages = Record<string, string>;

const catalogLoaders: Record<string, () => Promise<{ default: Messages }>> = {
  es: () => import('./es'),
  en: () => import('./en'),
  pt: () => import('./pt'),
  fr: () => import('./fr'),
};

const FALLBACK_LANGUAGE = 'en';

const preloaded = new Map<string, Messages>();
let preloadedLanguage = '';

export function preloadCatalog(language: string, messages: Messages): void {
  preloaded.set(language, messages);
  preloadedLanguage = language;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly messages = signal<Messages>(preloaded.get(preloadedLanguage) ?? {});
  private loaded = preloadedLanguage;
  private loading: Promise<void> | null = null;

  async load(locale: string): Promise<void> {
    const language = this.languageOf(locale);
    if (language === this.loaded) return this.loading ?? Promise.resolve();
    const ready = preloaded.get(language);
    if (ready) {
      this.useCatalog(language, ready);
      return;
    }
    this.loading = this.downloadCatalog(language);
    return this.loading;
  }

  t(key: string, params?: Record<string, string | number>): string {
    const message = this.messages()[key] ?? key;
    if (!params) return message;
    return message.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }

  private languageOf(locale: string): string {
    const language = locale.split('-')[0].toLowerCase();
    return language in catalogLoaders ? language : FALLBACK_LANGUAGE;
  }

  private async downloadCatalog(language: string): Promise<void> {
    const catalog = (await catalogLoaders[language]()).default;
    this.loading = null;
    this.useCatalog(language, catalog);
  }

  private useCatalog(language: string, catalog: Messages): void {
    this.messages.set(catalog);
    this.loaded = language;
    document.documentElement.lang = language;
  }
}
