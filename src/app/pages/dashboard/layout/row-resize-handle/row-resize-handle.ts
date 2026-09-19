import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { ROW_HEIGHT_STEP, MAX_ROW_HEIGHT, MIN_ROW_HEIGHT, clampHeight } from '../dashboard-layout';

@Component({
  selector: 'fin-row-resize-handle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'separator',
    'aria-orientation': 'horizontal',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuenow]': 'height()',
    '[attr.aria-valuemin]': 'min',
    '[attr.aria-valuemax]': 'max',
    class:
      'group absolute inset-x-0 -bottom-1.5 z-10 flex h-3 cursor-ns-resize touch-none items-center justify-center outline-none max-[700px]:hidden',
  },
  template: `<span
    class="h-1 w-12 rounded-full bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
  ></span>`,
})
export class RowResizeHandleComponent {
  readonly height = input.required<number>();
  readonly label = input('');
  readonly heightChange = output<number>();

  protected readonly min = MIN_ROW_HEIGHT;
  protected readonly max = MAX_ROW_HEIGHT;

  private startY = 0;
  private startHeight = 0;
  private dragging = false;

  @HostListener('pointerdown', ['$event'])
  start(event: PointerEvent): void {
    event.preventDefault();
    this.dragging = true;
    this.startY = event.clientY;
    this.startHeight = this.height();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  move(event: PointerEvent): void {
    if (!this.dragging) return;
    this.heightChange.emit(clampHeight(this.startHeight + event.clientY - this.startY));
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  end(): void {
    this.dragging = false;
  }

  @HostListener('keydown', ['$event'])
  key(event: KeyboardEvent): void {
    const step = event.shiftKey ? ROW_HEIGHT_STEP * 5 : ROW_HEIGHT_STEP * 2;
    if (event.key === 'ArrowDown') this.heightChange.emit(clampHeight(this.height() + step));
    else if (event.key === 'ArrowUp') this.heightChange.emit(clampHeight(this.height() - step));
    else return;
    event.preventDefault();
  }
}
