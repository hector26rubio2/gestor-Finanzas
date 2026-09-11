import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { applyTheme, DemoStore, Preferences } from '../core/store';
import { RemoteBootstrap } from '../core/remote-bootstrap';
import { IconComponent } from '../ui/icon';
import { UiOption, UiSelectComponent } from '../ui/select';
import { I18nService } from '../core/i18n';
@Component({
  standalone: true,
  imports: [FormsModule, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="login">
    <section class="story">
      <b><demo-icon name="dashboard" /> Finanzas</b>
      <div>
        <h1>{{ i18n.t('login.title') }}</h1>
        <p>{{ i18n.t('login.subtitle') }}</p>
        <div class="mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
    </section>
    <section class="access">
      <div class="login-card">
        <demo-icon name="dashboard" class="mark" />
        <h2>{{ i18n.t('login.welcome') }}</h2>
        @if (store.runtime.mode === 'demo') {
          <p>Selecciona el espacio con el que deseas continuar.</p>
          <button class="google" (click)="login(0)"><b>G</b> Continuar como Valentina</button
          ><button (click)="login(1)">Entrar como revisor</button>
        } @else if (store.remoteState() === 'loading') {
          <p role="status">Conectando con la API…</p>
        } @else if (store.remoteState() === 'anonymous') {
          <p>Inicia sesión con Google para continuar.</p>
          <a class="google api-login" [href]="googleLoginUrl()"><b>G</b> {{ i18n.t('login.google') }}</a>
        } @else {
          <p class="api-error" role="alert">{{ store.remoteError() }}</p>
          <a class="google api-login" [href]="googleLoginUrl()"><b>G</b> {{ i18n.t('login.google') }}</a>
          <button (click)="retry()">{{ i18n.t('login.retry') }}</button>
        }
        <hr />
        <label
          >{{ i18n.t('login.language')
          }}<demo-select
            [options]="languages"
            [(ngModel)]="selectedLocale"
            (ngModelChange)="locale($event)"
            ariaLabel="Idioma" /></label
        ><label
          >{{ i18n.t('login.theme')
          }}<demo-select
            [options]="themes"
            [(ngModel)]="selectedTheme"
            (ngModelChange)="theme($event)"
            ariaLabel="Tema" /></label
        ><small>Acceso local · Información protegida en este dispositivo</small>
      </div>
    </section>
  </main>`,
  styles: [
    `
      .login {
        min-height: 100dvh;
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        background: var(--bg);
      }
      .story {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 52px clamp(30px, 7vw, 110px);
        background:
          radial-gradient(circle at 20% 70%, var(--accent-soft), transparent 38%),
          linear-gradient(145deg, var(--nav), var(--bg));
        border-right: 1px solid var(--line);
      }
      .story b {
        font-size: 1.25rem;
        color: var(--accent);
      }
      .story div {
        max-width: 600px;
      }
      .story span {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.13em;
        color: var(--accent);
      }
      h1 {
        font-family: Georgia, serif;
        font-size: clamp(2.6rem, 5vw, 5.5rem);
        line-height: 1;
        margin: 18px 0;
        letter-spacing: -0.055em;
      }
      p {
        color: var(--muted);
        line-height: 1.65;
      }
      .mini-chart {
        height: 180px !important;
        display: flex;
        align-items: flex-end !important;
        gap: 16px;
        margin-top: 34px;
      }
      .mini-chart i {
        display: block;
        width: 42px;
        height: 30%;
        background: var(--accent);
        border-radius: 7px 7px 0 0;
      }
      .mini-chart i:nth-child(2) {
        height: 52%;
      }
      .mini-chart i:nth-child(3) {
        height: 40%;
      }
      .mini-chart i:nth-child(4) {
        height: 80%;
      }
      .mini-chart i:nth-child(5) {
        height: 67%;
      }
      .mini-chart i:nth-child(6) {
        height: 100%;
      }
      .access {
        display: grid;
        place-items: center;
        padding: 32px;
      }
      .login-card {
        width: min(420px, 100%);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 38px;
        box-shadow: var(--shadow);
      }
      .mark {
        font-size: 2.2rem;
        color: var(--accent);
      }
      h2 {
        font-size: 1.8rem;
        margin: 18px 0 4px;
      }
      button,
      select {
        width: 100%;
        min-height: 45px;
        margin-top: 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
      }
      .google {
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
      }
      .api-login {
        display: block;
        padding: 12px;
        text-align: center;
        text-decoration: none;
        border-radius: 10px;
      }
      .api-error {
        color: var(--danger);
      }
      .google b {
        background: #fff;
        color: #356;
        padding: 4px 7px;
        border-radius: 5px;
        margin-right: 9px;
      }
      hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 24px 0 14px;
      }
      label {
        display: block;
        color: var(--muted);
        font-size: 0.76rem;
        margin-top: 12px;
      }
      select {
        padding: 0 12px;
      }
      small {
        display: block;
        text-align: center;
        color: var(--muted);
        margin-top: 22px;
      }
      @media (max-width: 760px) {
        .login {
          display: block;
        }
        .story {
          display: none;
        }
        .access {
          min-height: 100dvh;
        }
        .login-card {
          padding: 26px;
        }
      }
    `,
  ],
})
export class LoginComponent {
  readonly store = inject(DemoStore);
  private router = inject(Router);
  private remote = inject(RemoteBootstrap);
  readonly i18n = inject(I18nService);
  selectedLocale = this.store.preferences().locale;
  selectedTheme = this.store.preferences().theme;
  readonly languages: readonly UiOption[] = [
    { value: 'es-CO', label: 'Español (Colombia)' },
    { value: 'en-US', label: 'English (United States)' },
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'fr-FR', label: 'Français' },
  ];
  readonly themes: readonly UiOption[] = [
    { value: 'system', label: 'Automático', description: 'Sigue la configuración del dispositivo' },
    { value: 'light', label: 'Luz editorial' },
    { value: 'dark', label: 'Noche esmeralda' },
    { value: 'ocean', label: 'Azul profundo' },
    { value: 'sand', label: 'Marfil cálido' },
    { value: 'berry', label: 'Ciruela' },
  ];
  login(index: number) {
    this.store.user.set(this.store.users[index]);
    this.store.rememberDemoSession(index);
    void this.router.navigateByUrl('/dashboard');
  }
  theme(value: string) {
    const theme = value as Preferences['theme'];
    this.store.preferences.update((p) => ({ ...p, theme }));
    applyTheme(theme);
  }
  locale(locale: string) {
    this.store.preferences.update((preferences) => ({ ...preferences, locale }));
    document.documentElement.lang = locale.slice(0, 2);
  }
  googleLoginUrl(): string {
    const returnUrl = encodeURIComponent(window.location.href);
    return `${this.store.runtime.apiBaseUrl}/api/v1/auth/google?returnUrl=${returnUrl}`;
  }
  retry(): void {
    void this.remote.initialize();
  }
}
