import type { CrearRecorrido } from './tutorial.service';

const HOJAS_DE_ESTILO = ['vendor/driver.css', 'vendor/tutorial-tema.css'];

function cargarHoja(ruta: string): Promise<void> {
  const url = new URL(ruta, document.baseURI).href;
  if (document.querySelector(`link[data-tutorial][href="${url}"]`)) return Promise.resolve();
  return new Promise((resolver) => {
    const enlace = document.createElement('link');
    enlace.rel = 'stylesheet';
    enlace.href = url;
    enlace.dataset['tutorial'] = '';
    enlace.onload = () => resolver();
    enlace.onerror = () => resolver();
    document.head.appendChild(enlace);
  });
}

export const crearRecorridoConDriver: CrearRecorrido = async (pasos, textos, alCerrar, navegacion) => {
  const [{ driver }] = await Promise.all([import('driver.js'), ...HOJAS_DE_ESTILO.map(cargarHoja)]);
  let ocupado = false;

  const irA = async (buscar: (indice: number) => Promise<number | null>, mover: (indice: number) => void) => {
    if (ocupado || !navegacion) return;
    ocupado = true;
    try {
      const indice = recorrido.getActiveIndex() ?? 0;
      const destino = await buscar(indice);
      if (destino === null) recorrido.destroy();
      else mover(destino);
    } finally {
      ocupado = false;
    }
  };

  const recorrido = driver({
    popoverClass: 'fin-tour',
    showProgress: true,
    allowKeyboardControl: true,
    disableActiveInteraction: true,
    nextBtnText: textos.siguiente,
    prevBtnText: textos.anterior,
    doneBtnText: textos.terminar,
    progressText: textos.progreso,
    steps: pasos.map((paso) => ({
      element: paso.element,
      disableActiveInteraction: !paso.interactivo,
      popover: paso.popover,
    })),
    onNextClick: navegacion ? () => void irA(navegacion.siguiente, (i) => recorrido.moveTo(i)) : undefined,
    onDoneClick: navegacion ? () => void irA(navegacion.siguiente, (i) => recorrido.moveTo(i)) : undefined,
    onPrevClick: navegacion
      ? () =>
          void irA(
            async (indice) => (await navegacion.anterior(indice)) ?? indice,
            (i) => recorrido.moveTo(i),
          )
      : undefined,
    onDestroyed: alCerrar,
  });

  return {
    arrancar: async () => {
      const inicio = navegacion ? await navegacion.primero() : 0;
      if (inicio === null) alCerrar();
      else recorrido.drive(inicio);
    },
  };
};
