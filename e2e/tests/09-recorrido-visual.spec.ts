import { analizarAxe, desbordeHorizontal, objetivosTactilesChicos } from '../support/auditoria';
import { expect, test } from '../support/fixtures';

const rutas = [
  'dashboard',
  'dashboard?vista=resumen',
  'movements',
  'calendar',
  'accounts',
  'people',
  'portfolio',
  'planning',
  'reports',
  'notifications',
  'settings',
  'admin?tab=summary',
  'admin?tab=users',
  'admin?tab=roles',
  'admin?tab=organizations',
  'admin?tab=flags',
  'admin?tab=audit',
  'admin?tab=errors',
];

const escenarios = [
  { nombre: 'móvil', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { nombre: 'tableta', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  {
    nombre: 'escritorio',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  },
];

for (const escenario of escenarios) {
  test.describe(`Recorrido visual · ${escenario.nombre} ${escenario.viewport.width}px`, () => {
    test.use({
      viewport: escenario.viewport,
      isMobile: escenario.isMobile,
      hasTouch: escenario.hasTouch,
      deviceScaleFactor: escenario.deviceScaleFactor,
    });

    for (const ruta of rutas) {
      test(`/${ruta}`, async ({ page }, info) => {
        await page.goto(`/${ruta}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-page], fin-sin-seccion').first()).toBeVisible();
        await expect(page.locator('hlm-spinner, .animate-spin')).toHaveCount(0);
        await expect(page.locator('main')).not.toHaveText(/^\s*$/);
        await page.waitForLoadState('networkidle');

        const desborde = await desbordeHorizontal(page);
        expect(desborde.scroll, 'desborde horizontal de la página').toBeLessThanOrEqual(desborde.vista + 1);

        const hallazgos = await analizarAxe(page);
        const graves = hallazgos.filter((h) => h.impacto === 'serious' || h.impacto === 'critical');
        for (const h of hallazgos.filter((x) => !graves.includes(x)))
          info.annotations.push({ type: 'axe-menor', description: `${h.id} (${h.impacto}) ×${h.nodos}: ${h.ejemplo}` });
        expect(graves, 'violaciones axe serias o críticas').toEqual([]);

        const chicos = await objetivosTactilesChicos(page);
        info.annotations.push({ type: 'objetivos-bajo-24px', description: String(chicos.length) });
        expect(chicos, 'objetivos interactivos menores de 24px (WCAG 2.5.8)').toEqual([]);
      });
    }
  });
}
