declare module 'node:fs' {
  export function readdirSync(ruta: string): string[];
  export function readFileSync(ruta: string, codificacion: 'utf8'): string;
  export function statSync(ruta: string): { isDirectory(): boolean };
}

declare module 'node:path' {
  export function join(...partes: string[]): string;
}

declare const process: { cwd(): string };
