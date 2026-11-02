import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  Event,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  RouteConfigLoadStart,
  Router,
} from '@angular/router';

export const RETARDO_DE_BARRA_MS = 120;
export const UMBRAL_DE_LENTITUD_MS = 400;

const empieza = (evento: Event) => evento instanceof NavigationStart || evento instanceof RouteConfigLoadStart;
const termina = (evento: Event) =>
  evento instanceof NavigationEnd || evento instanceof NavigationCancel || evento instanceof NavigationError;

@Injectable({ providedIn: 'root' })
export class CargaDePagina {
  private readonly router = inject(Router);

  private readonly estaNavegando = signal(false);
  private readonly estaLenta = signal(false);
  readonly navegando = this.estaNavegando.asReadonly();
  readonly lenta = this.estaLenta.asReadonly();

  private activa = false;
  private temporizadorDeBarra: ReturnType<typeof setTimeout> | null = null;
  private temporizadorDeLentitud: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const suscripcion = this.router.events.subscribe((evento) => {
      if (empieza(evento)) this.comenzar();
      else if (termina(evento)) this.terminar();
    });
    inject(DestroyRef).onDestroy(() => {
      suscripcion.unsubscribe();
      this.limpiarTemporizadores();
    });
  }

  private comenzar(): void {
    if (this.activa) return;
    this.activa = true;
    this.temporizadorDeBarra = setTimeout(() => this.estaNavegando.set(true), RETARDO_DE_BARRA_MS);
    this.temporizadorDeLentitud = setTimeout(() => {
      this.estaNavegando.set(true);
      this.estaLenta.set(true);
    }, UMBRAL_DE_LENTITUD_MS);
  }

  private terminar(): void {
    this.activa = false;
    this.limpiarTemporizadores();
    this.estaNavegando.set(false);
    this.estaLenta.set(false);
  }

  private limpiarTemporizadores(): void {
    if (this.temporizadorDeBarra) clearTimeout(this.temporizadorDeBarra);
    if (this.temporizadorDeLentitud) clearTimeout(this.temporizadorDeLentitud);
    this.temporizadorDeBarra = null;
    this.temporizadorDeLentitud = null;
  }
}
