import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const lucide = createRequire(import.meta.url)('@ng-icons/lucide');

const nombres = ['ShoppingCart', 'ShoppingBag', 'Store', 'Package', 'Truck', 'Utensils', 'Coffee', 'Pizza', 'Beer', 'Wine', 'Apple', 'Carrot', 'Croissant', 'House', 'Building', 'Building2', 'Bed', 'Sofa', 'Lamp', 'Wrench', 'Hammer', 'Zap', 'Droplet', 'Flame', 'Wifi', 'Phone', 'Smartphone', 'Tv', 'Laptop', 'Monitor', 'Cpu', 'Code', 'Gamepad2', 'Headphones', 'Music', 'Film', 'Ticket', 'Camera', 'Book', 'BookOpen', 'GraduationCap', 'School', 'Pencil', 'Car', 'Bus', 'TrainFront', 'Plane', 'Bike', 'Fuel', 'CircleParking', 'MapPin', 'Globe', 'Heart', 'HeartPulse', 'Stethoscope', 'Pill', 'Syringe', 'Activity', 'Dumbbell', 'Shirt', 'Glasses', 'Scissors', 'Sparkles', 'Gem', 'Crown', 'Gift', 'PartyPopper', 'Baby', 'Dog', 'Cat', 'PawPrint', 'Trees', 'Flower2', 'Leaf', 'Sun', 'Umbrella', 'Cloud', 'Recycle', 'Trash2', 'Cigarette', 'Dices', 'Trophy', 'Medal', 'Wallet', 'CreditCard', 'Banknote', 'Coins', 'PiggyBank', 'Landmark', 'Receipt', 'ReceiptText', 'TrendingUp', 'TrendingDown', 'ChartLine', 'ChartPie', 'Briefcase', 'BriefcaseBusiness', 'HandCoins', 'Handshake', 'BadgeDollarSign', 'DollarSign', 'Calculator', 'FileText', 'Shield', 'ShieldCheck', 'Users', 'User', 'Repeat', 'Calendar', 'Clock', 'Star', 'Tag', 'Tags', 'CircleHelp', 'Circle'];

const clave = (n) => n.charAt(0).toLowerCase() + n.slice(1);
const lineas = [];
lineas.push('export const ICONOS_DE_CATEGORIA = {');
for (const n of nombres) lineas.push(`  '${clave(n)}': ${JSON.stringify(lucide['lucide' + n])},`);
lineas.push('} as const;', '');
lineas.push('export const ALIAS_DE_ICONO: Readonly<Record<string, string>> = {');
lineas.push("  home: 'house',", "  cart: 'shoppingCart',", "  bolt: 'zap',");
lineas.push('};', '');
lineas.push('export function iconoDeCategoria(valor: string | null | undefined): string | null {');
lineas.push('  if (!valor) return null;');
lineas.push('  const clave = ALIAS_DE_ICONO[valor] ?? valor;');
lineas.push('  return clave in ICONOS_DE_CATEGORIA ? clave : null;');
lineas.push('}', '');
lineas.push('export const NOMBRES_DE_ICONO = Object.keys(ICONOS_DE_CATEGORIA);', '');
writeFileSync(new URL('../src/app/ui/category-icon/category-icons.ts', import.meta.url), lineas.join('\n'));
console.log('ok', nombres.length);
