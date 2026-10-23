import type { SessionUser } from '@core/state';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from './usuario-de-prueba';

/**
 * Builder fluido de sesión/permisos que parte de USUARIO_DE_PRUEBA.
 *
 * ```ts
 * store.user.set(sesionDe().conCapacidades('mov.editar', 'admin.fondos').construir());
 * // o directamente:
 * pruebaRender(MiComponente, { session: sesionDe().conCapacidad('x') });
 * ```
 */
export class SesionDePrueba {
  private readonly usuario: SessionUser;

  private constructor(base: SessionUser) {
    this.usuario = { ...base, capabilities: [...base.capabilities] };
  }

  static desde(base: SessionUser = USUARIO_DE_PRUEBA): SesionDePrueba {
    return new SesionDePrueba(base);
  }

  /** Añade capacidades (permisos) al usuario de prueba. */
  conCapacidad(...capacidades: string[]): this {
    this.usuario.capabilities.push(...capacidades);
    return this;
  }

  /** Deja al usuario sin capacidades (anónimo restringido). */
  sinCapacidades(): this {
    this.usuario.capabilities.length = 0;
    return this;
  }

  conId(id: string): this {
    this.usuario.id = id;
    return this;
  }

  conNombre(nombre: string): this {
    this.usuario.name = nombre;
    return this;
  }

  conEmail(email: string): this {
    this.usuario.email = email;
    return this;
  }

  construir(): SessionUser {
    return { ...this.usuario, capabilities: [...this.usuario.capabilities] };
  }

  /** Sembrar el usuario en el store (y marcar la sesión como lista). */
  aplicarEn(store: AppStore): SessionUser {
    const usuario = this.construir();
    store.user.set(usuario);
    store.remoteState.set('ready');
    return usuario;
  }
}

/** Atajo: sesionDe().conCapacidad('x').construir() */
export function sesionDe(base: SessionUser = USUARIO_DE_PRUEBA): SesionDePrueba {
  return SesionDePrueba.desde(base);
}
