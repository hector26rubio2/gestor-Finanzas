import { Component, computed, inject, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';

const CLAVE_BASE = 'finanzas.bienvenida-beta';

function yaEntendida(clave: string): boolean {
  try {
    return localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}

function recordarEntendida(clave: string): void {
  try {
    localStorage.setItem(clave, '1');
  } catch {
    return;
  }
}

@Component({
  selector: 'fin-bienvenida-beta',
  imports: [HlmButton],
  templateUrl: './bienvenida-beta.html',
})
export class BienvenidaBetaComponent {
  private readonly capacidades = inject(CAPABILITIES);
  private readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);

  private readonly clave = computed(() => `${CLAVE_BASE}.${this.store.user()?.id ?? ''}`);
  private readonly cerrada = signal(false);

  readonly visible = computed(
    () =>
      !this.cerrada() &&
      this.capacidades.allows(P.dashboard.ver) &&
      !this.capacidades.allows(P.movimientos.crear) &&
      !this.capacidades.allows(P.cuentas.crear) &&
      !yaEntendida(this.clave()),
  );

  entendido(): void {
    recordarEntendida(this.clave());
    this.cerrada.set(true);
  }
}
