import { Directive } from '@angular/core';

@Directive({
  selector: '[finAcciones]',
  host: {
    class:
      'tableta:absolute tableta:inset-x-0 tableta:bottom-0 tableta:z-10 tableta:border-t tableta:border-border tableta:bg-popover tableta:px-6 tableta:pt-4 tableta:pb-[max(1rem,env(safe-area-inset-bottom))] tactil:[&_button]:min-h-11',
  },
})
export class FinAcciones {}
