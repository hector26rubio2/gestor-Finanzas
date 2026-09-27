import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http';
import { API_ROUTES } from './api-routes';

export interface ApiCategory {
  id: string;
  name: string;
  type: number;
  color: string;
  icon: string;
  parent: string | null;
  isActive: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly transport = inject(API_TRANSPORT);

  categories() {
    return this.transport.request<readonly ApiCategory[]>({ method: 'GET', path: API_ROUTES.categories });
  }

  createCategory(request: { name: string; type: number; color: string; icon: string; parent?: string | null }) {
    return this.transport.request<ApiCategory>({ method: 'POST', path: API_ROUTES.categories, body: request });
  }

  updateCategory(
    id: string,
    request: { name: string; color: string; icon: string; parent: string | null; isActive: boolean },
  ) {
    return this.transport.request<ApiCategory>({ method: 'PUT', path: API_ROUTES.category(id), body: request });
  }
}
