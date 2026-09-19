import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fin-bank-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative flex aspect-[1.6/1] flex-col justify-between overflow-hidden rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--card-color)_92%,#fff),color-mix(in_srgb,var(--card-color)_55%,#000))] px-[18px] py-4 text-start text-white shadow-[0_12px_24px_color-mix(in_srgb,var(--text)_16%,transparent)] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(120deg,color-mix(in_srgb,#fff_18%,transparent)_0%,transparent_40%)]',
    '[style.--card-color]': 'color()',
  },
  template: `
    <span class="flex items-start justify-between">
      <span class="text-[0.68rem] font-bold tracking-widest opacity-85">{{ typeLabel() }}</span>
      <i
        class="h-[22px] w-[30px] rounded-[5px] bg-[linear-gradient(135deg,#f6dfa3,#cf9f4c)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,#000_25%,transparent)]"
        aria-hidden="true"
      ></i>
    </span>
    <em class="text-[1.02rem] font-semibold tracking-[0.12em] not-italic">{{ numberLabel() }}</em>
    <span class="flex flex-col gap-1.5">
      <b class="text-[0.92rem] font-bold">{{ name() }}</b>
      <small class="flex justify-between gap-2 opacity-90">
        {{ balanceLabel() }}
        <strong>{{ balance() }}</strong>
      </small>
    </span>
  `,
})
export class BankCardComponent {
  readonly color = input.required<string>();
  readonly typeLabel = input.required<string>();
  readonly numberLabel = input.required<string>();
  readonly name = input.required<string>();
  readonly balanceLabel = input.required<string>();
  readonly balance = input.required<string>();
}
