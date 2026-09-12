// Configuración explícita de despliegue. Por defecto: datos demo.
//
// Para probar contra la API real en local (backend en modo Development, que
// autentica automáticamente como el usuario de pruebas sembrado sin login),
// una sola vez en la consola del navegador:
//   localStorage.setItem('finanzas.devApi', 'http://localhost:5198');
// y recargar. Para volver a datos demo:
//   localStorage.removeItem('finanzas.devApi');
(() => {
  let devApi = null;
  try {
    devApi = localStorage.getItem('finanzas.devApi');
  } catch {
    devApi = null;
  }
  window.__FINANZAS_CONFIG__ = devApi ? { mode: 'api', apiBaseUrl: devApi } : { mode: 'demo' };
})();
