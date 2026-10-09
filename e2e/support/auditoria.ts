import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fuenteAxe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

export interface HallazgoAxe {
  id: string;
  impacto: string | null | undefined;
  nodos: number;
  ejemplo: string;
}

export async function analizarAxe(page: Page): Promise<HallazgoAxe[]> {
  await page.evaluate(fuenteAxe);
  const resultado = await page.evaluate(() =>
    (window as any).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    }),
  );
  return resultado.violations.map((violacion: any) => ({
    id: violacion.id,
    impacto: violacion.impact,
    nodos: violacion.nodes.length,
    ejemplo: String(violacion.nodes[0]?.target?.join(' ') ?? '').slice(0, 120),
  }));
}

export async function desbordeHorizontal(page: Page): Promise<{ scroll: number; vista: number }> {
  return page.evaluate(() => {
    const documento = document.scrollingElement ?? document.documentElement;
    return { scroll: documento.scrollWidth, vista: window.innerWidth };
  });
}

export async function objetivosTactilesChicos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector =
      'a[href], button, [role=button], input:not([type=hidden]), select, textarea, [role=tab], [role=combobox], [role=checkbox], [role=switch]';
    const visible = (el: Element) => {
      const caja = el.getBoundingClientRect();
      const estilo = getComputedStyle(el);
      return caja.width > 1 && caja.height > 1 && estilo.visibility !== 'hidden' && estilo.display !== 'none';
    };
    const enLineaConTexto = (el: Element) =>
      el.tagName === 'A' && getComputedStyle(el).display === 'inline' && !!el.closest('p, li, dd, span.text-sm, label');
    return [...document.querySelectorAll(selector)]
      .filter((el) => visible(el) && !el.closest('[aria-hidden=true], [inert]') && !enLineaConTexto(el))
      .filter((el) => {
        const caja = el.getBoundingClientRect();
        return caja.width < 24 || caja.height < 24;
      })
      .map((el) => {
        const caja = el.getBoundingClientRect();
        const etiqueta = (el.getAttribute('aria-label') || el.textContent || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 28);
        const ranura = el.getAttribute('data-slot') ?? el.closest('[data-slot]')?.getAttribute('data-slot') ?? '';
        return `${el.tagName.toLowerCase()} slot=${ranura} ${Math.round(caja.width)}x${Math.round(caja.height)} «${etiqueta}»`;
      });
  });
}
