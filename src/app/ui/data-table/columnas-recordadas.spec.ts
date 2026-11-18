import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { leerColumnasOcultas, guardarColumnasOcultas } from './columnas-recordadas';
import { DataTableComponent } from './data-table';
import { TableColumn } from './data-table.model';

const columns: TableColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'category', label: 'Categoría' },
  { key: 'amount', label: 'Importe' },
  { key: 'nota', label: 'Nota', hidden: true },
];

const rows = [{ id: 'a', name: 'Café', category: 'Comida', amount: 3, nota: 'x' }];

@Component({
  imports: [DataTableComponent],
  template: `<fin-table [columns]="columns" [rows]="rows" recordarColumnas="prueba" />`,
})
class HostComponent {
  columns = columns;
  rows = rows;
}

function montar() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const table = fixture.debugElement.children[0].componentInstance as DataTableComponent;
  const encabezados = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('thead th')].map((th) => th.textContent?.trim());
  return { fixture, table, encabezados };
}

const columna = (table: DataTableComponent, id: string) => table.hideableColumns().find((c) => c.id === id)!;

describe('columnas recordadas', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('guarda y lee las columnas ocultas por tabla', () => {
    guardarColumnasOcultas('a', ['x', 'y']);

    expect(leerColumnasOcultas('a')).toEqual(['x', 'y']);
    expect(leerColumnasOcultas('b')).toBeNull();
  });

  it('un valor dañado se ignora', () => {
    localStorage.setItem('finanzas.tabla.columnas-ocultas.a', '{no es json');

    expect(leerColumnasOcultas('a')).toBeNull();
  });

  it('sin nada guardado manda lo que la pantalla declara oculto', () => {
    const { encabezados } = montar();

    expect(encabezados()).not.toContain('Nota');
    expect(encabezados()).toContain('Importe');
  });

  it('lo que la persona oculta o muestra se recuerda al volver a abrir la tabla', () => {
    const primera = montar();
    columna(primera.table, 'amount').toggleVisibility(false);
    columna(primera.table, 'nota').toggleVisibility(true);
    primera.table.recordarEleccionDeColumnas();
    primera.fixture.detectChanges();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const segunda = montar();

    expect(segunda.encabezados()).not.toContain('Importe');
    expect(segunda.encabezados()).toContain('Nota');
    expect(segunda.encabezados()).toContain('Nombre');
  });
});
