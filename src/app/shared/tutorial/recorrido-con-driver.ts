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

export const crearRecorridoConDriver: CrearRecorrido = async (pasos, textos, alCerrar) => {
  const [{ driver }] = await Promise.all([import('driver.js'), ...HOJAS_DE_ESTILO.map(cargarHoja)]);
  const recorrido = driver({
    popoverClass: 'fin-tour',
    showProgress: true,
    allowKeyboardControl: true,
    nextBtnText: textos.siguiente,
    prevBtnText: textos.anterior,
    doneBtnText: textos.terminar,
    progressText: textos.progreso,
    steps: pasos,
    onDestroyed: alCerrar,
  });
  return { arrancar: () => recorrido.drive() };
};
