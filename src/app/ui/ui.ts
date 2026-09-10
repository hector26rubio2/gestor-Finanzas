import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { sincronizarPaginaConLaUrl } from '../core/url-state';
import { IconComponent } from './icon';

export interface TableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'demo-table',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="viewport"
      data-testid="table-scroll"
      tabindex="0"
      role="region"
      [attr.aria-label]="tableLabel() + ', desplazamiento interno'"
    >
      <table>
        <caption class="sr-only">
          {{
            tableLabel()
          }}
        </caption>
        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th scope="col">{{ column.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of visibleRows(); track row) {
            <tr [class.selectable]="selectable()" (click)="selectable() && rowSelected.emit(row)">
              @for (column of columns(); track column.key; let first = $first) {
                <td [attr.data-label]="column.label">
                  @if (first && selectable()) {
                    <button
                      type="button"
                      class="row-link"
                      (click)="$event.stopPropagation(); rowSelected.emit(row)"
                      [attr.aria-label]="'Ver detalle: ' + display(row[column.key])"
                    >
                      {{ display(row[column.key]) }}
                    </button>
                  } @else {
                    {{ display(row[column.key]) }}
                  }
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td [attr.colspan]="columns().length || 1" class="empty">No hay registros para estos filtros.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <footer>
      <span [id]="rangeId" aria-live="polite">{{ start() }}–{{ end() }} de {{ totalCount() }}</span>
      <label
        >Filas
        <select aria-label="Filas por página" [value]="size()" (change)="setSize($event)">
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
        </select></label
      >
      <div class="pages">
        <button type="button" aria-label="Primera página" [disabled]="currentPage() === 0" (click)="setPage(0)">
          <demo-icon name="first" />
        </button>
        <button
          type="button"
          aria-label="Página anterior"
          [attr.aria-describedby]="rangeId"
          [disabled]="currentPage() === 0"
          (click)="setPage(currentPage() - 1)"
        >
          <demo-icon name="previous" /></button
        ><label class="page-jump"
          >Página
          <!--
            La seleccion va en la opcion, no en el select: [value] sobre el select se
            aplica antes de que las opciones existan, y al llegar desde un enlace con
            ?pagina=4 la tabla mostraba la pagina correcta con el selector en la 1.
          -->
          <select aria-label="Ir a página" (change)="setPageFromEvent($event)">
            @for (number of pageOptions(); track number) {
              <option [value]="number" [selected]="number === currentPage()">{{ number + 1 }}</option>
            }
          </select>
          de {{ pageCount() }} </label
        ><button
          type="button"
          aria-label="Página siguiente"
          [attr.aria-describedby]="rangeId"
          [disabled]="currentPage() + 1 >= pageCount()"
          (click)="setPage(currentPage() + 1)"
        >
          <demo-icon name="next" /></button
        ><button
          type="button"
          aria-label="Última página"
          [disabled]="currentPage() + 1 >= pageCount()"
          (click)="setPage(pageCount() - 1)"
        >
          <demo-icon name="last" />
        </button>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        flex: 1;
        border: 1px solid var(--line);
        border-radius: 14px;
        overflow: hidden;
        background: var(--surface);
        color: var(--text);
      }
      .viewport {
        min-height: 0;
        flex: 1;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--line) transparent;
      }
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        text-align: left;
        font-size: 0.875rem;
      }
      th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: var(--surface);
        color: var(--muted);
        font-weight: 600;
        font-size: 0.75rem;
        letter-spacing: 0.02em;
      }
      th,
      td {
        padding: 14px 18px;
        border-bottom: 1px solid var(--line);
        white-space: nowrap;
      }
      tbody tr.selectable {
        cursor: pointer;
      }
      tbody tr.selectable:hover,
      tbody tr.selectable:focus-within {
        background: color-mix(in srgb, var(--accent) 7%, var(--surface));
      }
      .row-link {
        border: 0;
        background: none;
        color: var(--text);
        font: inherit;
        text-align: left;
        padding: 0;
        cursor: pointer;
        font-weight: 600;
      }
      .empty {
        text-align: center;
        padding: 48px 16px;
        color: var(--muted);
        white-space: normal;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      footer {
        display: flex;
        align-items: center;
        gap: 18px;
        justify-content: space-between;
        flex-wrap: wrap;
        padding: 12px 16px;
        font-size: 0.75rem;
        color: var(--muted);
        border-top: 1px solid var(--line);
        flex-shrink: 0;
      }
      label,
      .pages {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      select,
      .pages button {
        font: inherit;
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 7px;
        min-height: 32px;
        padding: 4px 9px;
      }
      .pages button:disabled {
        opacity: 0.35;
        cursor: default;
      }
      button:focus-visible,
      select:focus-visible,
      .viewport:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
      @media (max-width: 520px) {
        /*
         * Sin recorte: las tarjetas son más altas que el hueco y las cortaba el host.
         * El ancho sí se sujeta —min-width: 0 sobre un hijo flexible— o la tabla impone
         * su ancho natural y aparece scroll horizontal en toda la página.
         */
        :host {
          overflow: visible;
          min-width: 0;
          max-width: 100%;
        }
        .viewport {
          overflow: visible;
          padding: 10px;
        }
        table,
        tbody,
        tr,
        td {
          display: block;
          width: 100%;
        }
        thead {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(50%);
        }
        tbody {
          display: grid;
          gap: 10px;
        }
        tbody tr {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 8px 12px;
        }
        td {
          display: grid;
          grid-template-columns: minmax(92px, 0.65fr) 1fr;
          gap: 12px;
          padding: 8px 0;
          white-space: normal;
          border-bottom: 1px dashed var(--line);
          overflow-wrap: anywhere;
        }
        td:last-child {
          border-bottom: 0;
        }
        td::before {
          content: attr(data-label);
          color: var(--muted);
          font-size: 0.72rem;
          font-weight: 650;
        }
        td.empty {
          display: block;
        }
        /*
         * El pie tenía tres grupos en fila con salto de línea libre, y a 375px acababa en
         * tres renglones descuadrados de 99px. En rejilla cada cosa cae en su sitio: el
         * rango arriba, y debajo las filas por página junto a los controles.
         */
        footer {
          display: grid;
          grid-template-columns: 1fr;
          justify-items: center;
          gap: 12px;
          padding: 14px 12px;
          position: sticky;
          bottom: 0;
          background: var(--surface);
        }
        .pages {
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }
        .pages button {
          min-width: 44px;
          min-height: 44px;
        }
      }
    `,
  ],
})
export class DataTableComponent {
  private static nextId = 0;
  readonly rangeId = `table-range-${DataTableComponent.nextId++}`;
  readonly tableLabel = input('Registros');
  readonly columns = input<TableColumn[]>([]);
  readonly rows = input<Record<string, any>[]>([]);
  readonly pageSize = input(10);
  /** Set by remote consumers to avoid slicing an already paged response. */
  readonly totalRows = input<number | null>(null);
  readonly remotePage = input(1);
  readonly selectable = input(true);
  @Output() readonly rowSelected = new EventEmitter<Record<string, any>>();
  @Output() readonly pageSizeChange = new EventEmitter<number>();
  @Output() readonly pageChange = new EventEmitter<number>();
  readonly page = signal(0);

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

  constructor() {
    // Fuera de una ruta la tabla sigue funcionando igual, sin tocar la URL. La clave se
    // pasa como funcion: es un input de señal y aun no tiene valor en el constructor.
    if (inject(Router, { optional: true })) {
      sincronizarPaginaConLaUrl(() => this.urlKey(), this.page);
    }
  }
  setSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
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
  display(value: unknown): string {
    return value == null ? '—' : String(value);
  }
}

@Component({
  selector: 'demo-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      [class.inspector]="mode() === 'inspector'"
      [class.wide]="wide()"
      [attr.aria-labelledby]="titleId"
      (cancel)="onCancel($event)"
      (pointerdown)="rememberPointerOrigin($event)"
      (click)="backdrop($event)"
    >
      <section class="panel">
        <header>
          <h2 [id]="titleId">{{ title() }}</h2>
          <button #closeButton type="button" aria-label="Cerrar panel" (click)="requestClose()">✕</button>
        </header>
        <div class="content"><ng-content /></div>
      </section>
    </dialog>
  `,
  styles: [
    `
      dialog {
        /* Sin esto, al llegar al final del modal el gesto continúa en la página. */
        overscroll-behavior: contain;
        padding: 0;
        border: 1px solid var(--line);
        border-radius: 20px;
        width: min(760px, calc(100vw - 32px));
        max-width: none;
        max-height: calc(100dvh - 32px);
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 24px 80px #0004;
      }
      dialog::backdrop {
        background: #07191480;
        backdrop-filter: blur(3px);
      }
      dialog.inspector {
        margin: 0 0 0 auto;
        width: min(540px, 100vw);
        height: 100dvh;
        max-height: 100dvh;
        border-radius: 18px 0 0 18px;
        border-width: 0 0 0 1px;
      }
      dialog.inspector.wide {
        width: min(860px, 100vw);
      }
      .panel {
        display: flex;
        flex-direction: column;
        max-height: calc(100dvh - 34px);
      }
      .inspector .panel {
        height: 100%;
        max-height: 100%;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 22px 24px;
        border-bottom: 1px solid var(--line);
        flex-shrink: 0;
      }
      h2 {
        font-size: 1.15rem;
        margin: 0;
        font-weight: 650;
      }
      header button {
        width: 36px;
        height: 36px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
        cursor: pointer;
      }
      .content {
        padding: 24px;
        overflow: auto;
        min-height: 0;
        scrollbar-width: thin;
        scrollbar-color: var(--line) transparent;
      }
      button:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 3px;
      }
      @media (max-width: 540px) {
        dialog {
          width: calc(100vw - 16px);
          max-height: calc(100dvh - 16px);
        }
        dialog.inspector {
          border-radius: 0;
        }
        .content {
          padding: 18px;
        }
        header {
          padding: 18px;
        }
      }
    `,
  ],
})
export class OverlayComponent implements AfterViewInit, OnDestroy {
  private static nextId = 0;
  readonly titleId = `overlay-title-${OverlayComponent.nextId++}`;
  readonly title = input('Detalle');
  readonly mode = input<'modal' | 'inspector'>('inspector');
  readonly wide = input(false);
  @Output() readonly closed = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('closeButton', { static: true }) private closeButton!: ElementRef<HTMLButtonElement>;
  private previousFocus: HTMLElement | null = null;
  private pointerStartedOnBackdrop = false;
  private emittedClose = false;
  ngAfterViewInit(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.dialog.nativeElement.showModal();
    this.closeButton.nativeElement.focus();
  }
  ngOnDestroy(): void {
    if (this.dialog.nativeElement.open) this.dialog.nativeElement.close();
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }
  requestClose(): void {
    if (this.dialog.nativeElement.open) this.dialog.nativeElement.close();
    if (!this.emittedClose) {
      this.emittedClose = true;
      this.closed.emit();
    }
  }
  onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }
  backdrop(event: MouseEvent): void {
    if (!this.pointerStartedOnBackdrop || event.target !== this.dialog.nativeElement) return;
    this.pointerStartedOnBackdrop = false;
    if (this.isOutsidePanel(event.clientX, event.clientY)) this.requestClose();
  }
  rememberPointerOrigin(event: PointerEvent): void {
    this.pointerStartedOnBackdrop =
      event.target === this.dialog.nativeElement && this.isOutsidePanel(event.clientX, event.clientY);
  }
  private isOutsidePanel(clientX: number, clientY: number): boolean {
    const rect = this.dialog.nativeElement.getBoundingClientRect();
    return clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
  }
}

@Component({
  selector: 'demo-kpi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="label">{{ label() }}</span
    ><strong>{{ value() }}</strong>
    @if (hint()) {
      <span class="hint">{{ hint() }}</span>
    }`,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
        min-width: 0;
        min-height: 92px;
        padding: 13px 15px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
        color: var(--text);
      }
      .label {
        font-size: 0.78rem;
        color: var(--muted);
      }
      strong {
        font-size: clamp(1.12rem, 1.55vw, 1.55rem);
        font-weight: 650;
        letter-spacing: -0.04em;
        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
      }
      .hint {
        font-size: 0.72rem;
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class KpiComponent {
  readonly label = input('');
  readonly value = input('');
  readonly hint = input('');
}

@Component({
  selector: 'demo-empty',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<demo-icon name="dashboard" class="symbol" />
    <h3>{{ title() }}</h3>
    <p>{{ detail() }}</p>
    <ng-content />`,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 180px;
        padding: 24px;
        text-align: center;
        color: var(--text);
      }
      .symbol {
        color: var(--accent);
        font-size: 2rem;
      }
      h3 {
        font-size: 1rem;
        margin: 12px 0 8px;
      }
      p {
        color: var(--muted);
        font-size: 0.875rem;
        max-width: 420px;
        line-height: 1.6;
        margin: 0 0 16px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly title = input('Todavía no hay registros');
  readonly detail = input('Agrega un movimiento para comenzar.');
}

@Component({
  selector: 'demo-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span role="status" class="sr-only">Cargando contenido…</span>
    <div class="line short"></div>
    <div class="line"></div>
    <div class="line"></div>
    <div class="line"></div>`,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
        border-radius: 14px;
        background: var(--surface);
      }
      .line {
        height: 32px;
        margin-bottom: 16px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--muted) 15%, var(--surface));
        animation: pulse 1.4s ease-in-out infinite;
      }
      .short {
        width: 40%;
        height: 20px;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      @keyframes pulse {
        50% {
          opacity: 0.45;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .line {
          animation: none;
        }
      }
    `,
  ],
})
export class SkeletonComponent {}
