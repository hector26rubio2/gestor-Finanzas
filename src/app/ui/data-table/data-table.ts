import {
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  EventEmitter,
  inject,
  Output,
  QueryList,
  computed,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { sincronizarPaginaConLaUrl } from '../../core/url-state';
import { I18nService } from '../../core/i18n';
import { IconComponent } from '../icon';
import { UiOption, UiSelectComponent } from '../select';
import { FinTableCellDirective } from '../table-cell.directive';

export interface TableColumn {
  key: string;
  label: string;
  /**
   * `false` saca la columna de la tarjeta apilada en movil (max-width: 520px) y la manda
   * al detalle plegable de la fila. Sin esto, una tabla de 8-9 columnas como la de
   * Movimientos convertia cada fila en una tarjeta larguisima y una sola pagina se volvia
   * un scroll de miles de pixeles. En escritorio no cambia nada: todas las columnas se ven
   * igual que siempre.
   */
  essential?: boolean;
}

@Component({
  selector: 'fin-table',
  standalone: true,
  imports: [FormsModule, CommonModule, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTableComponent {
  readonly i18n = inject(I18nService);
  /**
   * Plantillas a medida por columna, proyectadas como `<ng-template finCell="...">`
   * hijas de `<fin-table>`. Sin esto, una fila con una celda que no es texto plano
   * (un avatar, una insignia de estado, un botón) obligaba a reescribir la tabla
   * entera a mano en vez de usar esta — ver `table-cell.directive.ts`.
   */
  @ContentChildren(FinTableCellDirective) private cellTemplates!: QueryList<FinTableCellDirective>;
  cellTemplate(key: string) {
    return this.cellTemplates?.find((t) => t.column === key)?.template ?? null;
  }
  private static nextId = 0;
  readonly rangeId = `table-range-${DataTableComponent.nextId++}`;
  readonly tableLabel = input(this.i18n.t('table.defaultLabel'));
  readonly columns = input<TableColumn[]>([]);
  readonly rows = input<Record<string, any>[]>([]);
  readonly pageSize = input(10);
  /** Set by remote consumers to avoid slicing an already paged response. */
  readonly totalRows = input<number | null>(null);
  readonly remotePage = input(1);
  readonly selectable = input(true);
  /** En falso para una vista pequeña de solo lectura (un resumen, una previsualización): sin paginación que administrar. */
  readonly showFooter = input(true);
  @Output() readonly rowSelected = new EventEmitter<Record<string, any>>();
  @Output() readonly pageSizeChange = new EventEmitter<number>();
  @Output() readonly pageChange = new EventEmitter<number>();
  readonly page = signal(0);
  readonly hasDetailColumns = computed(() => this.columns().some((c) => c.essential === false));
  private readonly expandedRows = signal<ReadonlySet<number>>(new Set());
  isRowExpanded(index: number): boolean {
    return this.expandedRows().has(index);
  }
  toggleRow(index: number): void {
    this.expandedRows.update((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  /**
   * Clave del parámetro donde se guarda la página. Opcional a propósito: la tabla es un
   * componente genérico y tiene que poder montarse fuera de una ruta —en una prueba, por
   * ejemplo—, así que sin clave o sin enrutador simplemente no sincroniza.
   */
  readonly urlKey = input<string | null>(null);
  private readonly selectedSize = signal<number | null>(null);
  readonly size = computed(() => Math.max(1, this.selectedSize() ?? this.pageSize()));
  readonly totalCount = computed(() => this.totalRows() ?? this.rows().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.size())));
  readonly currentPage = computed(() =>
    Math.min(this.totalRows() === null ? this.page() : Math.max(0, this.remotePage() - 1), this.pageCount() - 1),
  );
  readonly start = computed(() => (this.totalCount() ? this.currentPage() * this.size() + 1 : 0));
  readonly end = computed(() => Math.min((this.currentPage() + 1) * this.size(), this.totalCount()));
  readonly visibleRows = computed(() =>
    this.totalRows() === null ? this.rows().slice(this.currentPage() * this.size(), this.end()) : this.rows(),
  );
  readonly pageOptions = computed(() => Array.from({ length: this.pageCount() }, (_, index) => index));
  readonly sizeOptions: readonly UiOption[] = [
    { value: '5', label: '5' },
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
  ];
  readonly pageSelectOptions = computed<readonly UiOption[]>(() =>
    this.pageOptions().map((number) => ({ value: number.toString(), label: (number + 1).toString() })),
  );

  constructor() {
    // Fuera de una ruta la tabla sigue funcionando igual, sin tocar la URL. La clave se
    // pasa como funcion: es un input de señal y aun no tiene valor en el constructor.
    if (inject(Router, { optional: true })) {
      sincronizarPaginaConLaUrl(() => this.urlKey(), this.page);
    }
    // Sin esto, cambiar de filtro en el padre (otra cuenta, otro periodo) deja la tabla
    // en la pagina donde se quedo el listado anterior -a veces mas alla del nuevo total,
    // aterrizando en la ultima pagina en vez de la primera-. Un cambio real en el total de
    // filas es la señal de que la lista es otra, no una actualizacion de la misma; se
    // ignora el primer disparo del effect (el del montaje) para no pisar una pagina que
    // ya llego fijada por la URL.
    let primerCalculo = true;
    effect(() => {
      this.totalCount();
      if (primerCalculo) {
        primerCalculo = false;
        return;
      }
      if (this.totalRows() === null && untracked(this.page) !== 0) this.page.set(0);
    });
  }
  setSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    this.selectedSize.set(size);
    this.page.set(0);
    this.pageSizeChange.emit(size);
    if (this.totalRows() !== null) this.pageChange.emit(1);
  }
  setSizeValue(value: string): void {
    const size = Number(value);
    this.selectedSize.set(size);
    this.page.set(0);
    this.pageSizeChange.emit(size);
    if (this.totalRows() !== null) this.pageChange.emit(1);
  }
  setPage(zeroBasedPage: number): void {
    const next = Math.max(0, Math.min(zeroBasedPage, this.pageCount() - 1));
    if (this.totalRows() === null) this.page.set(next);
    else this.pageChange.emit(next + 1);
  }
  setPageFromEvent(event: Event): void {
    this.setPage(Number((event.target as HTMLSelectElement).value));
  }
  setPageValue(value: string): void {
    this.setPage(Number(value));
  }
  display(value: unknown): string {
    return value == null ? '—' : String(value);
  }
}
