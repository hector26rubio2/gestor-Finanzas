import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';

interface EventoDeInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface EntornoInstalacion {
  esIos: () => boolean;
  esInstalada: () => boolean;
}

export function detectarIos(navegador: { userAgent: string; maxTouchPoints: number }): boolean {
  if (/iPhone|iPad|iPod/i.test(navegador.userAgent)) return true;
  return /Macintosh/i.test(navegador.userAgent) && navegador.maxTouchPoints > 1;
}

export const ENTORNO_INSTALACION = new InjectionToken<EntornoInstalacion>('ENTORNO_INSTALACION', {
  providedIn: 'root',
  factory: () => ({
    esIos: () => detectarIos(window.navigator),
    esInstalada: () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
  }),
});

@Injectable({ providedIn: 'root' })
export class InstalacionPwa {
  private readonly entorno = inject(ENTORNO_INSTALACION);
  private readonly evento = signal<EventoDeInstalacion | null>(null);
  private readonly instalada = signal(false);
  private iniciado = false;

  readonly puedeInstalar = computed(() => this.evento() !== null && !this.instalada());
  readonly instruccionIos = signal(false);

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    this.instalada.set(this.entorno.esInstalada());
    this.instruccionIos.set(this.entorno.esIos() && !this.instalada());
    window.addEventListener('beforeinstallprompt', (evento) => {
      evento.preventDefault();
      if (this.instalada()) return;
      this.evento.set(evento as EventoDeInstalacion);
    });
    window.addEventListener('appinstalled', () => {
      this.instalada.set(true);
      this.evento.set(null);
      this.instruccionIos.set(false);
    });
  }

  async instalar(): Promise<boolean> {
    const evento = this.evento();
    if (!evento) return false;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    this.evento.set(null);
    return outcome === 'accepted';
  }
}
