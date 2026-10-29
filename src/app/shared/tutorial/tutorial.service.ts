import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '@core/i18n';
import { AppStore, CAPABILITIES } from '@core/state/store';

export interface PasoDelRecorrido {
  element: string;
  popover: { title: string; description: string };
}

export interface TextosDelRecorrido {
  siguiente: string;
  anterior: string;
  terminar: string;
  progreso: string;
}

export interface Recorrido {
  arrancar(): void;
}

export type CrearRecorrido = (
  pasos: PasoDelRecorrido[],
  textos: TextosDelRecorrido,
  alCerrar: () => void,
) => Promise<Recorrido>;

export const CREAR_RECORRIDO = new InjectionToken<CrearRecorrido>('CREAR_RECORRIDO', {
  providedIn: 'root',
  factory: () => async (pasos, textos, alCerrar) =>
    (await import('./recorrido-con-driver')).crearRecorridoConDriver(pasos, textos, alCerrar),
});

const PREFIJO_VISTO = 'finanzas.tutorial.visto.';
const CLAVE_AL_ENTRAR = 'finanzas.tutorial.al-entrar';
const DESTINO_DEL_FOCO_RESPALDO = '#contenido-principal';

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly router = inject(Router);
  private readonly store = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly i18n = inject(I18nService);
  private readonly crear = inject(CREAR_RECORRIDO);
  private readonly ofrecidos = new Set<string>();
  private corriendo = false;
  private origenDelFoco: HTMLElement | null = null;

  private readonly alEntrarEscribible = signal(leer(CLAVE_AL_ENTRAR) !== 'false');
  readonly alEntrar = this.alEntrarEscribible.asReadonly();
  readonly oferta = signal(false);

  cambiarAlEntrar(valor: boolean): void {
    this.alEntrarEscribible.set(valor);
    escribir(CLAVE_AL_ENTRAR, String(valor));
  }

  ofrecerSiEsPrimeraVez(): void {
    const usuario = this.store.user()?.id;
    if (!usuario || !this.alEntrarEscribible() || this.ofrecidos.has(usuario)) return;
    if (leer(PREFIJO_VISTO + usuario) !== null) return;
    this.ofrecidos.add(usuario);
    this.oferta.set(true);
  }

  marcarVisto(): void {
    const usuario = this.store.user()?.id;
    if (usuario) {
      this.ofrecidos.add(usuario);
      escribir(PREFIJO_VISTO + usuario, '1');
    }
    this.oferta.set(false);
  }

  async iniciar(seccion: string = this.seccionActual(), origen?: HTMLElement): Promise<void> {
    if (this.corriendo) return;
    const { pasosDe } = await import('./pasos-del-tutorial');
    const pasos = pasosDe(seccion, {
      t: (clave) => this.i18n.t(clave),
      puede: (permiso) => this.caps.allows(permiso),
    })
      .filter((paso) => document.querySelector(paso.selector))
      .map((paso) => ({ element: paso.selector, popover: { title: paso.titulo, description: paso.texto } }));
    if (!pasos.length) return;
    this.corriendo = true;
    this.origenDelFoco = origen ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    try {
      const recorrido = await this.crear(
        pasos,
        {
          siguiente: this.i18n.t('tutorial.next'),
          anterior: this.i18n.t('tutorial.previous'),
          terminar: this.i18n.t('tutorial.done'),
          progreso: this.i18n.t('tutorial.progress'),
        },
        () => this.alCerrar(),
      );
      recorrido.arrancar();
    } catch {
      this.alCerrar();
    }
  }

  private alCerrar(): void {
    this.corriendo = false;
    const origen = this.origenDelFoco;
    this.origenDelFoco = null;
    const destino = origen?.isConnected ? origen : document.querySelector<HTMLElement>(DESTINO_DEL_FOCO_RESPALDO);
    destino?.focus();
  }

  private seccionActual(): string {
    return this.router.url.split(/[?#]/)[0].split('/')[1] ?? '';
  }
}
