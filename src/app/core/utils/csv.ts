/**
 * Exportación a CSV.
 *
 * La capacidad `ExportData` existía en el dominio desde el principio y estaba concedida
 * a los roles `Colaborador` y `Propietario`, pero no protegía nada: no había ninguna
 * exportación en el cliente. Aquí está lo que protege.
 */

/**
 * Escapa un valor según RFC 4180: comillas dobles cuando el texto lleva separador, salto
 * de línea o comillas, y las comillas internas se duplican.
 */
export function escapeCsv(value: unknown, separator = ';'): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!text.includes(separator) && !text.includes('"') && !/[\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/**
 * Construye el CSV. El separador es `;` porque es lo que espera Excel en locales que usan
 * la coma como separador decimal, que son los de esta aplicación.
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[], separator = ';'): string {
  const cabecera = columns.map((column) => escapeCsv(column.header, separator)).join(separator);
  const cuerpo = rows.map((row) => columns.map((column) => escapeCsv(column.value(row), separator)).join(separator));
  return [cabecera, ...cuerpo].join('\r\n');
}

/**
 * Entrega el fichero al navegador.
 *
 * Lleva BOM porque sin él Excel abre el UTF-8 como Latin-1 y destroza cada tilde, que en
 * un informe en español es cada dos palabras.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
