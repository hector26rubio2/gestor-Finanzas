export interface Carril {
  carril: number | null;
  aislado: boolean;
  webUrl: string;
  webPort: number;
  apiUrl: string;
  apiPort: number;
  dbName: string;
  resultados: string;
  informe: string;
  estado: string;
}

export function derivarCarril(env: Record<string, string | undefined>): Carril;
