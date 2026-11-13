import { Directive } from '@angular/core';

@Directive({
  selector: '[finAcciones]',
  host: {
    class:
      'hoja:absolute hoja:inset-x-0 hoja:bottom-0 hoja:z-10 hoja:border-t hoja:border-border hoja:bg-popover hoja:px-6 hoja:pt-4 hoja:pb-[max(1rem,env(safe-area-inset-bottom))] tactil:[&_button]:min-h-11',
  },
})
export class FinAcciones {}
