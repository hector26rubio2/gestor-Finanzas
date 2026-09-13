import { Injectable, signal } from '@angular/core';
import es from './i18n/es';

type Messages = Record<string, string>;

/**
 * Catálogo cargado por idioma. Solo español forma parte del paquete inicial; los demás
 * se descargan cuando la persona los elige.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly messages = signal<Messages>(es);
  private loaded = 'es';

  async load(locale: string): Promise<void> {
    const language = locale.split('-')[0].toLowerCase();
    if (language === this.loaded) return;
    const loaders: Record<string, () => Promise<{ default: Messages }>> = {
      en: () => import('./i18n/en'),
      pt: () => import('./i18n/pt'),
      fr: () => import('./i18n/fr'),
    };
    const catalog = language === 'es' ? es : (await (loaders[language] ?? loaders['en'])()).default;
    this.messages.set(catalog);
    this.loaded = language;
    document.documentElement.lang = language;
  }

  /** `params` sustituye marcadores `{nombre}` dentro del mensaje. */
  t(key: string, params?: Record<string, string | number>): string {
    const message = this.messages()[key] ?? es[key as keyof typeof es] ?? key;
    if (!params) return message;
    return message.replace(/\{(\w+)\}/g, (match, name) =>
      name in params ? String(params[name]) : match,
    );
  }
}
