import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { applyTheme, DemoStore, Preferences } from '../core/store';
import { RemoteBootstrap } from '../core/remote-bootstrap';
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="login">
    <section class="story">
      <b>◈ Finanzas</b>
      <div>
        <span>ESTUDIO FINANCIERO PERSONAL</span>
        <h1>Tu dinero, explicado con claridad.</h1>
        <p>Organiza, comprende y proyecta tus finanzas desde un solo lugar.</p>
        <div class="mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
    </section>
    <section class="access">
      <div class="login-card">
        <span class="mark">◈</span>
        <h2>Bienvenido</h2>
        @if (store.runtime.mode === 'demo') {
          <p>Selecciona el espacio con el que deseas continuar.</p>
          <button class="google" (click)="login(0)"><b>G</b> Continuar como Valentina</button
          ><button (click)="login(1)">Entrar como revisor</button>
        } @else if (store.remoteState() === 'loading') {
          <p role="status">Conectando con la API…</p>
        } @else if (store.remoteState() === 'anonymous') {
          <p>Inicia sesión con Google para continuar.</p>
          <a class="google api-login" [href]="googleLoginUrl()"><b>G</b> Iniciar sesión con Google</a>
        } @else {
          <p class="api-error" role="alert">{{ store.remoteError() }}</p>
          <a class="google api-login" [href]="googleLoginUrl()"><b>G</b> Iniciar sesión con Google</a>
          <button (click)="retry()">Reintentar conexión</button>
        }
        <hr />
        <label
          >Idioma<select [value]="store.preferences().locale" (change)="locale($event)">
            <option value="es-CO">Español (Colombia)</option>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="fr-FR">Français</option>
          </select></label
        ><label
          >Tema<select (change)="theme($event)">
            <option value="system">Igual que el sistema</option>
            <option value="light">Verona claro</option>
            <option value="dark">Esmeralda noche</option>
            <option value="ocean">Océano</option>
            <option value="sand">Arena</option>
            <option value="berry">Mora</option>
          </select></label
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
        font-size: 0.7rem;
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
  login(index: number) {
    this.store.user.set(this.store.users[index]);
    this.store.rememberDemoSession(index);
    void this.router.navigateByUrl('/dashboard');
  }
  theme(event: Event) {
    const theme = (event.target as HTMLSelectElement).value as Preferences['theme'];
    this.store.preferences.update((p) => ({ ...p, theme }));
    applyTheme(theme);
  }
  locale(event: Event) {
    const locale = (event.target as HTMLSelectElement).value;
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
