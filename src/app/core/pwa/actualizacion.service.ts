import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';

export const RECARGAR_PAGINA = new InjectionToken<() => void>('RECARGAR_PAGINA', {
  providedIn: 'root',
  factory: () => () => window.location.reload(),
});

@Injectable({ providedIn: 'root' })
export class ActualizacionPwa {
  private readonly sw = inject(SwUpdate);
  private readonly recargar = inject(RECARGAR_PAGINA);
  private readonly destroyRef = inject(DestroyRef);
  private iniciado = false;

  readonly versionNueva = signal(false);
  readonly falloDeInstalacion = signal(false);

  iniciar(): void {
    if (this.iniciado || !this.sw.isEnabled) return;
    this.iniciado = true;
    this.sw.versionUpdates.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((evento) => {
      if (evento.type === 'VERSION_READY') {
        this.falloDeInstalacion.set(false);
        this.versionNueva.set(true);
      } else if (evento.type === 'VERSION_INSTALLATION_FAILED') {
        this.versionNueva.set(false);
        this.falloDeInstalacion.set(true);
      }
    });
    this.sw.unrecoverable.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recargar());
  }

  async actualizar(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } catch {
      this.falloDeInstalacion.set(true);
    }
    this.recargar();
  }

  descartarFallo(): void {
    this.falloDeInstalacion.set(false);
  }
}
