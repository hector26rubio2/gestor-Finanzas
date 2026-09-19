// El entorno local siempre usa la API y la base PostgreSQL de desarrollo.
// Los datos de prueba se cargan desde el seeder del backend, no desde memoria.
window.__FINANZAS_CONFIG__ = { mode: 'api', apiBaseUrl: 'http://localhost:5198' };
