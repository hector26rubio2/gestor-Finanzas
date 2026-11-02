import assert from 'node:assert/strict';
import { test } from 'node:test';
import { derivarCarril } from './e2e-carril.mjs';

test('sin carril conserva los valores de siempre', () => {
  const c = derivarCarril({});
  assert.equal(c.carril, null);
  assert.equal(c.aislado, false);
  assert.equal(c.webUrl, 'http://localhost:4300');
  assert.equal(c.apiUrl, 'http://localhost:5198');
  assert.equal(c.apiPort, 5198);
  assert.equal(c.dbName, 'finanzas_e2e_ci');
  assert.equal(c.resultados, 'resultados');
  assert.equal(c.informe, 'informe');
  assert.equal(c.estado, '.estado');
});

test('el carril deriva puertos, base y carpetas', () => {
  const c = derivarCarril({ E2E_CARRIL: '2' });
  assert.equal(c.aislado, true);
  assert.equal(c.webUrl, 'http://localhost:4302');
  assert.equal(c.webPort, 4302);
  assert.equal(c.apiUrl, 'http://localhost:5201');
  assert.equal(c.apiPort, 5201);
  assert.equal(c.dbName, 'finanzas_e2e_c2');
  assert.equal(c.resultados, 'resultados-c2');
  assert.equal(c.informe, 'informe-c2');
  assert.equal(c.estado, '.estado-c2');
});

test('los extremos 1 y 9', () => {
  assert.equal(derivarCarril({ E2E_CARRIL: '1' }).apiPort, 5200);
  assert.equal(derivarCarril({ E2E_CARRIL: '9' }).webPort, 4309);
  assert.equal(derivarCarril({ E2E_CARRIL: '9' }).apiPort, 5208);
});

test('las variables sueltas mandan sobre el carril', () => {
  const c = derivarCarril({
    E2E_CARRIL: '3',
    API_BASE_URL: 'http://localhost:6000/',
    E2E_DB_NAME: 'finanzas_e2e_otra',
  });
  assert.equal(c.apiUrl, 'http://localhost:6000');
  assert.equal(c.apiPort, 6000);
  assert.equal(c.dbName, 'finanzas_e2e_otra');
  assert.equal(c.webPort, 4303);
});

test('E2E_WEB_PORT suelto aísla sin carril', () => {
  const c = derivarCarril({ E2E_WEB_PORT: '4400' });
  assert.equal(c.carril, null);
  assert.equal(c.aislado, true);
  assert.equal(c.webUrl, 'http://localhost:4400');
  assert.equal(c.resultados, 'resultados');
});

test('carril inválido falla', () => {
  for (const malo of ['0', '10', 'a', '-1', '1.5'])
    assert.throws(() => derivarCarril({ E2E_CARRIL: malo }), /E2E_CARRIL/);
  assert.throws(() => derivarCarril({ E2E_WEB_PORT: 'x' }), /E2E_WEB_PORT/);
});
