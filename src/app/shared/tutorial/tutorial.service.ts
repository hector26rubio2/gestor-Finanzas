import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '@core/i18n';
import { AppStore, CAPABILITIES, FEATURES } from '@core/state/store';
import type { Guia } from './catalogo-de-guias';
import type { SesionDeGuia } from './motor-de-guias';

export interface PasoDelRecorrido {
  element: string;
  interactivo?: boolean;
  popover: { title: string; description: string };
}

export interface NavegacionDelRecorrido {
  primero(): Promise<number | null>;
  siguiente(indice: number): Promise<number | null>;
  anterior(indice: number): Promise<number | null>;
}

export interface TextosDelRecorrido {
  siguiente: string;
  anterior: string;
  terminar: string;
  progreso: string;
}

export interface Recorrido {
  arrancar(): void | Promise<void>;
}

export type CrearRecorrido = (
  pasos: PasoDelRecorrido[],
  textos: TextosDelRecorrido,
  alCerrar: () => void,
  navegacion?: NavegacionDelRecorrido,
) => Promise<Recorrido>;

export const CREAR_RECORRIDO = new InjectionToken<CrearRecorrido>('CREAR_RECORRIDO', {
  providedIn: 'root',
  factory: () => async (pasos, textos, alCerrar, navegacion) =>
    (await import('./recorrido-con-driver')).crearRecorridoConDriver(pasos, textos, alCerrar, navegacion),
});

const PREFIJO_VISTO = 'finanzas.tutorial.visto.';
const PREFIJO_COMPLETADAS = 'finanzas.tutorial.completadas.';
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

function leerCompletadas(usuario: string | undefined): ReadonlySet<string> {
  if (!usuario) return new Set();
  try {
    const guardadas: unknown = JSON.parse(leer(PREFIJO_COMPLETADAS + usuario) ?? '[]');
    return new Set(Array.isArray(guardadas) ? guardadas.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly router = inject(Router);
  private readonly store = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  private readonly i18n = inject(I18nService);
  private readonly crear = inject(CREAR_RECORRIDO);
  private readonly ofrecidos = new Set<string>();
  private readonly versionDeCompletadas = signal(0);
  private corriendo = false;
  private origenDelFoco: HTMLElement | null = null;
  private sesion: SesionDeGuia | null = null;

  private readonly alEntrarEscribible = signal(leer(CLAVE_AL_ENTRAR) !== 'false');
  readonly alEntrar = this.alEntrarEscribible.asReadonly();
  readonly oferta = signal(false);
  readonly centroAbierto = signal(false);
  readonly completadas = computed(() => {
    this.versionDeCompletadas();
    return leerCompletadas(this.store.user()?.id);
  });

  cambiarAlEntrar(valor: boolean): void {
    this.alEntrarEscribible.set(valor);
    escribir(CLAVE_AL_ENTRAR, String(valor));
  }

  abrirCentro(): void {
    this.centroAbierto.set(true);
  }

  cerrarCentro(): void {
    this.centroAbierto.set(false);
  }

  marcarCompletada(id: string): void {
    const usuario = this.store.user()?.id;
    if (!usuario) return;
    escribir(PREFIJO_COMPLETADAS + usuario, JSON.stringify([...leerCompletadas(usuario), id]));
    this.versionDeCompletadas.update((version) => version + 1);
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
    }).filter((paso) => document.querySelector(paso.selector));
    if (!pasos.length) return;
    const guia: Guia = {
      id: 'esta-pagina',
      categoria: '',
      titulo: this.i18n.t('tutorial.guia.esta-pagina.title'),
      resumen: this.i18n.t('tutorial.guia.esta-pagina.summary'),
      ruta: this.seccionActual(),
      pasos: pasos.map((paso) => ({ selector: paso.selector, titulo: paso.titulo, texto: paso.texto, esperar: false })),
    };
    await this.ejecutar(guia, origen);
  }

  async iniciarGuia(id: string, origen?: HTMLElement): Promise<void> {
    if (this.corriendo) return;
    const { guiasDisponibles } = await import('./catalogo-de-guias');
    const guia = guiasDisponibles({
      t: (clave) => this.i18n.t(clave),
      puede: (permiso) => this.caps.allows(permiso),
      activa: (bandera) => this.features.enabled(bandera),
    }).find((candidata) => candidata.id === id);
    if (guia) await this.ejecutar(guia, origen);
  }

  private async ejecutar(guia: Guia, origen?: HTMLElement): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    this.origenDelFoco = origen ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    try {
      const [{ crearSesionDeGuia }, { crearEntornoReal }] = await Promise.all([
        import('./motor-de-guias'),
        import('./entorno-real'),
      ]);
      const sesion = crearSesionDeGuia(
        guia,
        crearEntornoReal(this.router, this.store, () => this.seccionActual()),
      );
      this.sesion = sesion;
      const recorrido = await this.crear(
        guia.pasos.map((paso) => ({
          element: paso.selector,
          interactivo: paso.interactivo,
          popover: { title: paso.titulo, description: paso.texto },
        })),
        {
          siguiente: this.i18n.t('tutorial.next'),
          anterior: this.i18n.t('tutorial.previous'),
          terminar: this.i18n.t('tutorial.done'),
          progreso: this.i18n.t('tutorial.progress'),
        },
        () => this.alCerrar(guia.id),
        sesion,
      );
      await recorrido.arrancar();
    } catch {
      this.alCerrar(guia.id);
    }
  }

  private alCerrar(id: string): void {
    const sesion = this.sesion;
    this.sesion = null;
    sesion?.cerrar();
    if (sesion?.terminada) this.marcarCompletada(id);
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
