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

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[], separator = ';'): string {
  const cabecera = columns.map((column) => escapeCsv(column.header, separator)).join(separator);
  const cuerpo = rows.map((row) => columns.map((column) => escapeCsv(column.value(row), separator)).join(separator));
  return [cabecera, ...cuerpo].join('\r\n');
}

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
