import type { Router } from '@angular/router';
import type { AppStore } from '@core/state/store';
import type { EntidadDeGuia, FormularioDeGuia } from './catalogo-de-guias';
import { esVisible, esperarElemento } from './esperar-elemento';
import type { EntornoDelMotor } from './motor-de-guias';

const PAUSA_ENTRE_FORMULARIOS = 60;

const pausa = (milisegundos: number) => new Promise<void>((resolver) => setTimeout(resolver, milisegundos));

function resolverFormulario(
  store: AppStore,
  formulario: FormularioDeGuia,
  con: 'tarjeta' | 'inversion' | undefined,
): FormularioDeGuia | null {
  const datos = store.data();
  if (con === 'tarjeta') {
    const tarjeta = datos.accounts.find((cuenta) => cuenta.type === 'credit');
    return tarjeta ? { ...formulario, accountId: tarjeta.id } : formulario;
  }
  if (con === 'inversion') {
    const inversion = datos.investments[0];
    return inversion ? { ...formulario, targetId: inversion.id } : null;
  }
  return formulario;
}

function resolverEntidad(store: AppStore, entidad: EntidadDeGuia): { tipo: string; id: string } | null {
  const datos = store.data();
  const candidato =
    entidad === 'movimiento'
      ? { tipo: 'movement', id: datos.movements[0]?.id }
      : entidad === 'tarjeta'
        ? { tipo: 'card', id: datos.accounts.find((cuenta) => cuenta.type === 'credit')?.id }
        : entidad === 'cuenta'
          ? { tipo: 'account', id: datos.accounts.find((cuenta) => cuenta.type !== 'credit')?.id }
          : entidad === 'persona'
            ? { tipo: 'person', id: datos.people[0]?.id }
            : { tipo: 'investment', id: datos.investments[0]?.id };
  return candidato.id ? { tipo: candidato.tipo, id: candidato.id } : null;
}

export function crearEntornoReal(router: Router, store: AppStore, seccionActual: () => string): EntornoDelMotor {
  return {
    seccionActual,
    navegar: async (ruta, params) => {
      await router.navigate(['/' + ruta], params ? { queryParams: params } : {});
    },
    abrirFormulario: async (accion) => {
      const formulario = resolverFormulario(store, accion.form, accion.con);
      if (!formulario) return false;
      if (store.form()) {
        store.form.set(null);
        await pausa(PAUSA_ENTRE_FORMULARIOS);
      }
      store.form.set(formulario);
      return true;
    },
    inspeccionar: (entidad) => {
      const objetivo = resolverEntidad(store, entidad);
      if (!objetivo) return false;
      store.inspect(objetivo.tipo, objetivo.id);
      return true;
    },
    cerrarFormulario: async () => {
      if (!store.form()) return;
      store.form.set(null);
      await pausa(PAUSA_ENTRE_FORMULARIOS);
    },
    cerrarInspector: () => {
      store.inspector.set(null);
      store.cardPaymentMode.set(false);
    },
    clic: (selector) => {
      const elemento = document.querySelector<HTMLElement>(selector);
      if (!elemento) return false;
      elemento.click();
      return true;
    },
    escape: () => {
      const destino = document.activeElement ?? document.body;
      destino.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    },
    existe: (selector) => esVisible(document.querySelector(selector)),
    esperar: esperarElemento,
  };
}
