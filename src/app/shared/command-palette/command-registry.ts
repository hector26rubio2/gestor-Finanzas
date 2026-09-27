import { P } from '@core/session';
import type { Account, PersonKind, Preferences } from '@core/state';
import type { IconName } from '@ui/icon';

export interface Comando {
  id: string;
  label: string;
  hint?: string;
  palabras?: string;
  icon: IconName;
  run: () => void;
}

export interface ContextoDeComandos {
  t: (clave: string) => string;
  permite: (permiso: string) => boolean;
  bandera: (clave: string) => boolean;
  abrirMovimiento: (kind: 'expense' | 'income', operationType: string) => void;
  abrirPago: () => void;
  abrirCuenta: (tipo?: Account['type']) => void;
  abrirGestion: (kind: 'category' | 'person' | 'investment' | 'recurrence', personKind?: PersonKind) => void;
  irA: (ruta: string, params?: Record<string, string>) => void;
  usarTema: (tema: Preferences['theme']) => void;
  usarMiTema?: () => void;
}

interface Receta {
  id: string;
  clave: string;
  palabras: string;
  icon: IconName;
  permisos: readonly string[];
  bandera?: string;
  run: (c: ContextoDeComandos) => void;
}

const MOVIMIENTOS: readonly Receta[] = [
  {
    id: 'crear-gasto',
    clave: 'command.create.expense',
    palabras: 'gasto compra pago nuevo expense purchase',
    icon: 'trendDown',
    permisos: [P.movimientos.crear],
    run: (c) => c.abrirMovimiento('expense', 'normal'),
  },
  {
    id: 'crear-ingreso',
    clave: 'command.create.income',
    palabras: 'ingreso salario venta income salary',
    icon: 'trendUp',
    permisos: [P.movimientos.crear],
    run: (c) => c.abrirMovimiento('income', 'normal'),
  },
  {
    id: 'crear-transferencia',
    clave: 'command.create.transfer',
    palabras: 'transferencia mover cuentas transfer',
    icon: 'movements',
    permisos: [P.movimientos.transferencias.crear],
    run: (c) => c.abrirMovimiento('expense', 'transfer'),
  },
  {
    id: 'crear-recibida',
    clave: 'command.create.received',
    palabras: 'transferencia recibida me enviaron received',
    icon: 'download',
    permisos: [P.movimientos.crear],
    run: (c) => c.abrirMovimiento('income', 'received'),
  },
  {
    id: 'crear-avance',
    clave: 'command.create.advance',
    palabras: 'avance efectivo tarjeta cash advance',
    icon: 'accounts',
    permisos: [P.movimientos.avances.crear],
    bandera: 'movements.cashAdvance',
    run: (c) => c.abrirMovimiento('expense', 'advance'),
  },
  {
    id: 'crear-pago-tarjeta',
    clave: 'command.create.cardPayment',
    palabras: 'pago tarjeta abono extracto card payment',
    icon: 'check',
    permisos: [P.movimientos.pagos.crear],
    run: (c) => c.abrirPago(),
  },
  {
    id: 'crear-prestamo',
    clave: 'command.create.loanGiven',
    palabras: 'prestamo presté prestar loan lend',
    icon: 'people',
    permisos: [P.movimientos.prestamos.crear, P.personas.prestamos.crear],
    run: (c) => c.abrirMovimiento('expense', 'loan'),
  },
  {
    id: 'crear-prestamo-recibido',
    clave: 'command.create.loanReceived',
    palabras: 'prestamo me prestaron deuda borrowed',
    icon: 'people',
    permisos: [P.movimientos.prestamos.crear, P.personas.deudas.crear],
    run: (c) => c.abrirMovimiento('income', 'loan'),
  },
  {
    id: 'crear-credito',
    clave: 'command.create.credit',
    palabras: 'credito banco hipotecario vehiculo libre inversion loan bank',
    icon: 'wallet',
    permisos: [P.movimientos.creditos.crear],
    run: (c) => c.abrirMovimiento('income', 'credit'),
  },
];

const REGISTROS: readonly Receta[] = [
  {
    id: 'crear-cuenta',
    clave: 'command.create.account',
    palabras: 'cuenta ahorro efectivo billetera account',
    icon: 'wallet',
    permisos: [P.cuentas.crear],
    run: (c) => c.abrirCuenta('savings'),
  },
  {
    id: 'crear-tarjeta',
    clave: 'command.create.card',
    palabras: 'tarjeta credito card',
    icon: 'accounts',
    permisos: [P.cuentas.tarjetas.crear],
    run: (c) => c.abrirCuenta('credit'),
  },
  {
    id: 'crear-categoria',
    clave: 'command.create.category',
    palabras: 'categoria etiqueta category',
    icon: 'tag',
    permisos: [P.cuentas.categorias.crear],
    run: (c) => c.abrirGestion('category'),
  },
  {
    id: 'crear-persona',
    clave: 'command.create.person',
    palabras: 'persona contacto person',
    icon: 'people',
    permisos: [P.personas.crear],
    run: (c) => c.abrirGestion('person', 'person'),
  },
  {
    id: 'crear-entidad',
    clave: 'command.create.institution',
    palabras: 'entidad banco institucion institution bank',
    icon: 'bank',
    permisos: [P.personas.crear],
    run: (c) => c.abrirGestion('person', 'institution'),
  },
  {
    id: 'crear-inversion',
    clave: 'command.create.investment',
    palabras: 'inversion cdt fondo accion investment',
    icon: 'portfolio',
    permisos: [P.patrimonio.inversiones.crear],
    run: (c) => c.abrirGestion('investment'),
  },
  {
    id: 'crear-recurrente',
    clave: 'command.create.recurrence',
    palabras: 'recurrente suscripcion mensual recurrence subscription',
    icon: 'calendar',
    permisos: [P.calendario.recurrencias.crear],
    run: (c) => c.abrirGestion('recurrence'),
  },
];

const TEMAS: readonly { tema: Preferences['theme']; clave: string }[] = [
  { tema: 'system', clave: 'preferences.theme.system' },
  { tema: 'light', clave: 'preferences.theme.light' },
  { tema: 'dark', clave: 'preferences.theme.dark' },
  { tema: 'ocean', clave: 'preferences.theme.ocean' },
  { tema: 'sand', clave: 'preferences.theme.sand' },
  { tema: 'berry', clave: 'preferences.theme.berry' },
];

function construir(recetas: readonly Receta[], c: ContextoDeComandos): Comando[] {
  return recetas
    .filter((r) => r.permisos.every((permiso) => c.permite(permiso)) && (!r.bandera || c.bandera(r.bandera)))
    .map((r) => ({ id: r.id, label: c.t(r.clave), palabras: r.palabras, icon: r.icon, run: () => r.run(c) }));
}

export function comandosDeMovimiento(c: ContextoDeComandos): Comando[] {
  return construir(MOVIMIENTOS, c);
}

export function comandosDeRegistro(c: ContextoDeComandos): Comando[] {
  return construir(REGISTROS, c);
}

export function comandosDeApariencia(c: ContextoDeComandos): Comando[] {
  if (!c.permite(P.preferencias.editar)) return [];
  const temas: Comando[] = TEMAS.map(({ tema, clave }) => ({
    id: `tema-${tema}`,
    label: `${c.t('command.theme')}: ${c.t(clave)}`,
    palabras: 'tema theme apariencia color',
    icon: 'palette',
    run: () => c.usarTema(tema),
  }));
  const usarMiTema = c.usarMiTema;
  if (usarMiTema)
    temas.push({
      id: 'tema-propio',
      label: c.t('command.useMyTheme'),
      palabras: 'tema propio personalizado custom theme',
      icon: 'palette',
      run: usarMiTema,
    });
  if (c.permite(P.preferencias.tema.editar))
    temas.push({
      id: 'tema-estudio',
      label: c.t('preferences.studio.open'),
      palabras: 'crear tema propio personalizado estudio custom theme',
      icon: 'edit',
      run: () => c.irA('settings', { section: 'studio' }),
    });
  return temas;
}

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
}
