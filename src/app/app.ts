import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CAPABILITIES, DemoStore, navigation } from './core/store';
import { MovementFormComponent } from './forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MovementFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!store.user()) {
      <router-outlet />
    } @else {
      <div class="app" [class.collapsed]="collapsed()">
        <aside [class.mobile-open]="mobileOpen()">
          <div class="brand-row">
            <a routerLink="/dashboard" class="brand" aria-label="Finanzas, ir al inicio"
              ><span>◈</span><b class="aside-label">Finanzas</b></a
            >
            <button
              class="collapse-trigger"
              type="button"
              (click)="collapsed.update((v) => !v)"
              [attr.aria-label]="collapsed() ? 'Expandir menú' : 'Colapsar menú'"
              [attr.aria-expanded]="!collapsed()"
              aria-controls="primary-navigation"
            >
              {{ collapsed() ? '›' : '‹' }}
            </button>
          </div>
          <div class="profile" [class.open]="profileOpen()">
            <button
              class="profile-trigger"
              type="button"
              (click)="profileOpen.update((v) => !v)"
              [attr.aria-expanded]="profileOpen()"
            >
              <span class="avatar">{{ userInitials() }}</span>
              <span class="profile-copy aside-label"
                ><strong>{{ store.user()?.name }}</strong
                ><small>Espacio personal</small></span
              >
              <span class="profile-more aside-label" aria-hidden="true">•••</span>
            </button>
            @if (profileOpen()) {
              <div class="profile-menu">
                <div class="profile-menu-head">
                  <strong>{{ store.user()?.name }}</strong
                  ><small>{{ store.user()?.email }}</small>
                </div>
                <a routerLink="/settings" (click)="profileOpen.set(false)">Perfil y preferencias</a>
                <button type="button" (click)="logout()">Cerrar sesión</button>
              </div>
            }
          </div>
          <div class="workspace aside-label" aria-label="Espacio activo: Personal">
            <span>Personal</span><span aria-hidden="true">⌄</span>
          </div>
          <nav id="primary-navigation" aria-label="Navegación principal">
            @for (group of groups(); track group) {
              <small class="aside-label">{{ group }}</small>
              @for (item of items(group); track item.path) {
                <a
                  [routerLink]="'/' + item.path"
                  routerLinkActive="active"
                  [attr.aria-label]="item.label"
                  (click)="mobileOpen.set(false)"
                  ><span class="nav-icon">{{ item.icon }}</span
                  ><span class="aside-label">{{ item.label }}</span>
                  @if (item.path === 'notifications' && store.unread()) {
                    <i>{{ store.unread() }}</i>
                  }
                </a>
              }
            }
          </nav>
        </aside>
        @if (mobileOpen()) {
          <button class="scrim" aria-label="Cerrar menú" (click)="mobileOpen.set(false)"></button>
        }
        <section class="stage">
          <header class="topbar">
            <button
              class="mobile-menu"
              [attr.aria-expanded]="mobileOpen()"
              aria-controls="primary-navigation"
              aria-label="Abrir menú"
              (click)="mobileOpen.set(true)"
            >
              ☰</button
            ><span class="org">♜ Personal</span>
            <div class="top-actions">
              <button aria-label="Buscar movimientos" (click)="openSearch()">⌕</button
              ><a routerLink="/notifications" class="bell" aria-label="Notificaciones"
                >♢
                @if (store.unread()) {
                  <i>{{ store.unread() }}</i>
                }</a
              ><button class="primary" (click)="store.open()">＋ Nuevo movimiento</button>
            </div>
          </header>
          <main><router-outlet /></main>
        </section>
      </div>
      @if (store.form() && store.form()?.kind !== 'account') {
        <demo-movement-form />
      }
      @if (store.toast()) {
        <div class="toast" role="status">
          {{ store.toast() }}<button aria-label="Cerrar aviso" (click)="store.toast.set('')">×</button>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
      }
      .app {
        display: grid;
        grid-template-columns: 238px minmax(0, 1fr);
        min-height: 100dvh;
      }
      .app.collapsed {
        grid-template-columns: 70px minmax(0, 1fr);
      }
      aside {
        position: sticky;
        top: 0;
        height: 100dvh;
        background: var(--nav);
        border-right: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        padding: 18px 12px;
        z-index: 20;
        transition: width 0.2s;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.14rem;
        color: var(--text);
        text-decoration: none;
        padding: 4px 6px;
        min-width: 0;
      }
      .brand-row {
        display: flex;
        align-items: center;
        min-height: 40px;
        margin: 0 2px 12px;
      }
      .collapse-trigger {
        margin-left: auto;
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--surface);
        color: var(--muted);
        padding: 0;
        font-size: 1.15rem;
      }
      .collapse-trigger:hover {
        color: var(--accent);
        border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
        background: var(--accent-soft);
      }
      .brand span {
        color: var(--accent);
        font-size: 1.5rem;
      }
      .workspace {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--text);
        padding: 7px 10px;
        border-radius: 11px;
        width: 100%;
        margin: 5px 4px 12px;
        justify-content: space-between;
        font-size: 0.72rem;
        color: var(--muted);
      }
      .avatar {
        display: grid;
        place-items: center;
        width: 29px;
        height: 29px;
        border-radius: 9px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.7rem;
        font-weight: 700;
      }
      .collapsed .aside-label {
        display: none;
      }
      .collapsed .brand {
        justify-content: center;
        padding-inline: 0;
      }
      .collapsed .brand-row {
        flex-direction: column;
        gap: 6px;
        margin-bottom: 10px;
      }
      .collapsed .collapse-trigger {
        margin-left: 0;
      }
      .collapsed nav a {
        justify-content: center;
      }
      .collapsed nav a i {
        position: absolute;
        right: 5px;
      }
      nav {
        min-height: 0;
        overflow: auto;
        scrollbar-width: none;
      }
      nav small {
        display: block;
        color: var(--muted);
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        padding: 14px 10px 7px;
      }
      nav a {
        position: relative;
        display: flex;
        gap: 12px;
        align-items: center;
        color: var(--muted);
        text-decoration: none;
        padding: 9px 10px;
        border-radius: 10px;
        margin: 2px 0;
        font-size: 0.82rem;
        font-weight: 550;
      }
      nav a:hover,
      nav a.active {
        background: var(--accent-soft);
        color: var(--accent);
      }
      nav a i,
      .bell i {
        background: var(--accent);
        color: var(--accent-contrast);
        font-style: normal;
        font-size: 0.6rem;
        border-radius: 20px;
        padding: 2px 5px;
        margin-left: auto;
      }
      .nav-icon {
        font-size: 1rem;
        min-width: 19px;
        text-align: center;
      }
      .profile {
        position: relative;
        margin: 0 2px 7px;
      }
      .profile-trigger {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 9px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text);
        padding: 7px;
        border-radius: 11px;
        text-align: left;
      }
      .profile-trigger:hover {
        background: var(--accent-soft);
      }
      .profile-trigger .avatar {
        flex: 0 0 29px;
      }
      .profile-copy {
        min-width: 0;
        display: grid;
        line-height: 1.15;
      }
      .profile-copy strong {
        font-size: 0.75rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .profile-copy small {
        color: var(--muted);
        font-size: 0.64rem;
        margin-top: 3px;
      }
      .profile-more {
        margin-left: auto;
        color: var(--muted);
        letter-spacing: 1px;
      }
      .profile-menu {
        position: absolute;
        z-index: 30;
        left: 0;
        top: calc(100% + 6px);
        width: 218px;
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
        box-shadow: var(--shadow);
        display: grid;
      }
      .profile-menu-head {
        display: grid;
        gap: 2px;
        padding: 8px 10px 10px;
        border-bottom: 1px solid var(--line);
        margin-bottom: 4px;
      }
      .profile-menu-head small {
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .profile-menu a,
      .profile-menu button {
        text-align: left;
        border: 0;
        background: transparent;
        color: var(--text);
        text-decoration: none;
        padding: 10px;
        border-radius: 8px;
      }
      .profile-menu a:hover,
      .profile-menu button:hover {
        background: var(--accent-soft);
      }
      .collapsed .profile {
        order: 2;
      }
      .collapsed .profile-trigger {
        justify-content: center;
        padding: 6px 0;
      }
      .collapsed .profile-menu {
        left: 52px;
        top: 0;
      }
      .stage {
        display: flex;
        min-width: 0;
        min-height: 100dvh;
        flex-direction: column;
      }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        height: 64px;
        display: flex;
        align-items: center;
        padding: 0 28px;
        border-bottom: 1px solid var(--line);
        background: color-mix(in srgb, var(--bg) 90%, transparent);
        backdrop-filter: blur(14px);
      }
      .org {
        font-size: 0.82rem;
      }
      .top-actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .top-actions button,
      .bell,
      .mobile-menu {
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--text);
        min-height: 36px;
        padding: 8px 11px;
        border-radius: 9px;
        text-decoration: none;
      }
      .top-actions .primary {
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
        font-weight: 650;
      }
      .bell {
        position: relative;
      }
      .bell i {
        position: absolute;
        right: -5px;
        top: -6px;
      }
      .mobile-menu {
        display: none;
      }
      main {
        min-width: 0;
        flex: 1;
        padding: 24px 28px;
      }
      .toast {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 100;
        background: var(--text);
        color: var(--bg);
        padding: 13px 16px;
        border-radius: 12px;
        box-shadow: var(--shadow);
        max-width: 420px;
      }
      .toast button {
        border: 0;
        background: transparent;
        color: inherit;
        margin-left: 14px;
      }
      .scrim {
        display: none;
      }
      @media (max-width: 780px) {
        .app,
        .app.collapsed {
          display: block;
        }
        .stage {
          min-height: 100dvh;
        }
        aside {
          position: fixed;
          left: 0;
          transform: translateX(-102%);
          width: min(286px, 85vw);
          box-shadow: var(--shadow);
        }
        aside.mobile-open {
          transform: none;
        }
        .scrim {
          display: block;
          position: fixed;
          inset: 0;
          border: 0;
          background: #001c1788;
          z-index: 19;
        }
        .mobile-menu {
          display: block;
          margin-right: 10px;
        }
        .topbar {
          padding: 0 14px;
        }
        .org {
          display: none;
        }
        .primary {
          font-size: 0;
        }
        .primary::after {
          content: '＋';
          font-size: 1rem;
        }
        main {
          padding: 18px 14px;
        }
      }
    `,
  ],
})
export class AppComponent {
  readonly store = inject(DemoStore);
  private caps = inject(CAPABILITIES);
  private router = inject(Router);
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly allowed = computed(() => navigation.filter((n) => this.caps.allows(n.capability)));
  readonly groups = computed(() => [...new Set(this.allowed().map((n) => n.group))]);
  items(group: string) {
    return this.allowed().filter((i) => i.group === group);
  }
  userInitials(): string {
    return (this.store.user()?.name ?? 'Usuario')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
  openSearch(): void {
    void this.router.navigate(['/movements'], { queryParams: { focus: 'search' } });
  }
  @HostListener('document:keydown.escape')
  closeMobileMenu(): void {
    this.mobileOpen.set(false);
    this.profileOpen.set(false);
  }
  async logout(): Promise<void> {
    this.store.user.set(null);
    this.store.form.set(null);
    this.store.inspector.set(null);
    this.profileOpen.set(false);
    await this.router.navigateByUrl('/login');
  }
}
