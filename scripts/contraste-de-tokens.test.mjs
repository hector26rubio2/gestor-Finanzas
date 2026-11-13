import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const estilos = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles.css'), 'utf8');

function bloque(selector) {
  const inicio = estilos.indexOf(selector);
  assert.notEqual(inicio, -1, `no existe el bloque ${selector}`);
  return estilos.slice(inicio, estilos.indexOf('}', inicio));
}

function tokens(texto) {
  return Object.fromEntries(
    [...texto.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s*;/g)].map(([, n, v]) => [n, seisDigitos(v)]),
  );
}

function seisDigitos(hex) {
  return hex.length === 7 ? hex : `#${[...hex.slice(1)].map((d) => d + d).join('')}`;
}

const claro = tokens(bloque(':root {'));
const temas = {
  claro,
  oscuro: { ...claro, ...tokens(bloque(":root[data-theme='dark']")) },
  ocean: { ...claro, ...tokens(bloque(":root[data-theme='ocean']")) },
  sand: { ...claro, ...tokens(bloque(":root[data-theme='sand']")) },
  berry: { ...claro, ...tokens(bloque(":root[data-theme='berry']")) },
};

function luminancia(hex) {
  const canal = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

function contraste(a, b) {
  const [alto, bajo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (bajo + 0.05);
}

for (const [nombre, tema] of Object.entries(temas)) {
  test(`${nombre}: el borde de los controles llega a 3:1 sobre superficie y fondo`, () => {
    assert.ok(contraste(tema['--control-line'], tema['--surface']) >= 3);
    assert.ok(contraste(tema['--control-line'], tema['--bg']) >= 3);
  });

  test(`${nombre}: texto, atenuado, peligro y advertencia llegan a 4,5:1 sobre superficie`, () => {
    for (const token of ['--text', '--muted', '--danger', '--warning'])
      assert.ok(contraste(tema[token], tema['--surface']) >= 4.5, `${token} ${tema[token]}`);
  });
}

test('el placeholder usa el color atenuado completo', () => {
  assert.doesNotMatch(estilos, /placeholder\s*\{[^}]*color-mix/);
});
