import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ApiAdminFeatureFlag,
  ApiAdminOverride,
  ApiAdminRole,
  ApiAdminUser,
  ApiAuditEvent,
  ApiCapabilityDescriptor,
  ApiPermissionAction,
  ApiPermissionDescriptor,
  ApiPermissionLevel,
  ApiClientError,
  FinanceApiClient,
} from '../core/api-client';
import { P } from '../core/permissions';
import { IconComponent } from '../ui/icon';
import { RemoteBootstrap } from '../core/remote-bootstrap';
import { CAPABILITIES, DemoStore } from '../core/store';

type Tab = 'summary' | 'users' | 'roles' | 'flags' | 'audit' | 'errors';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="admin-page">
      <header class="page-head">
        <div>
          <h1>Administración</h1>
          <p>Gobierna accesos, despliegues y trazabilidad desde un solo lugar.</p>
        </div>
        <div class="health">
          <i></i><span><b>Servicios operativos</b><small>Última verificación ahora</small></span>
        </div>
      </header>

      <nav class="tabs" aria-label="Secciones de administración">
        @for (item of tabs(); track item.id) {
          <button [class.active]="tab() === item.id" (click)="tab.set(item.id)">
            <demo-icon [name]="item.icon" />{{ item.label }}
          </button>
        }
      </nav>

      @switch (tab()) {
        @case ('summary') {
          <section class="kpis">
            <article>
              <span>Usuarios activos</span><strong>{{ activeUsers() }}</strong
              ><small>de {{ users().length }} registrados</small>
            </article>
            <article>
              <span>Roles configurados</span><strong>{{ roles().length }}</strong
              ><small>{{ capabilityCount() }} capacidades disponibles</small>
            </article>
            <article>
              <span>Funciones activas</span><strong>{{ enabledFlags() }}</strong
              ><small>de {{ flagRows().length }} en despliegue</small>
            </article>
            <article class="warn">
              <span>Errores abiertos</span><strong>{{ openErrors() }}</strong
              ><small>{{ errorOccurrences() }} ocurrencias agrupadas</small>
            </article>
          </section>
          <section class="summary-grid">
            <article class="panel">
              <div class="panel-head">
                <div>
                  <h2>Actividad reciente</h2>
                  <p>Acciones relevantes en todas las áreas</p>
                </div>
                <button (click)="tab.set('audit')">Ver auditoría</button>
              </div>
              <div class="timeline">
                @for (event of auditRows().slice(0, 5); track event.id) {
                  <div>
                    <i></i
                    ><span
                      ><b>{{ event.action }}</b
                      ><small>{{ event.entityType }} · {{ event.createdAt | date: 'dd MMM, HH:mm' }}</small></span
                    ><code>{{ event.traceId.slice(0, 8) }}</code>
                  </div>
                }
              </div>
            </article>
            <article class="panel">
              <div class="panel-head">
                <div>
                  <h2>Control de acceso</h2>
                  <p>Distribución de usuarios</p>
                </div>
                <button (click)="tab.set('users')">Gestionar</button>
              </div>
              <div class="access-bars">
                @for (role of roles(); track role.id) {
                  <div>
                    <span
                      ><b>{{ role.name }}</b
                      ><small>{{ memberCount(role.id) }} miembros</small></span
                    ><progress [value]="memberCount(role.id)" [max]="users().length || 1"></progress>
                  </div>
                }
              </div>
            </article>
          </section>
        }
        @case ('users') {
          <section class="panel table-panel">
            <div class="toolbar">
              <div>
                <h2>Usuarios</h2>
                <p>Acceso efectivo por persona, sin depender de nombres de rol.</p>
              </div>
              <label class="search"
                ><demo-icon name="search" /><input
                  [(ngModel)]="userSearch"
                  placeholder="Buscar nombre o correo" /></label
              ><select [(ngModel)]="userStatus">
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Desactivados</option>
              </select>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Roles</th>
                    <th>Capacidades</th>
                    <th>Último acceso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of filteredUsers(); track user.id) {
                    <tr>
                      <td>
                        <div class="person">
                          <span>{{ initials(user.displayName) }}</span>
                          <div>
                            <b>{{ user.displayName }}</b
                            ><small>{{ user.email }}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="status" [class.off]="!user.isActive">{{
                          user.isActive ? 'Activo' : 'Desactivado'
                        }}</span>
                      </td>
                      <td>{{ user.roles.join(', ') || 'Acceso directo' }}</td>
                      <td>
                        <b>{{ user.capabilities.length }}</b> asignadas
                      </td>
                      <td>{{ user.lastSeenAt ? (user.lastSeenAt | date: 'dd MMM, HH:mm') : 'Sin acceso' }}</td>
                      <td>
                        @if (caps.allows(P.administracion.usuarios.editar)) {
                          <button class="icon-btn" aria-label="Administrar usuario" (click)="openUser(user)">→</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <footer class="pager">
              <span>{{ filteredUsers().length }} usuarios</span><span>Página 1 de 1</span>
            </footer>
          </section>
        }
        @case ('roles') {
          <section class="cards-head">
            <div>
              <h2>Roles y capacidades</h2>
              <p>Los roles agrupan permisos; las excepciones se aplican por usuario.</p>
            </div>
            @if (caps.allows(P.administracion.roles.crear)) {
              <button class="primary" (click)="newRole()"><demo-icon name="plus" /> Crear rol</button>
            }
          </section>
          <section class="role-grid">
            @for (role of roles(); track role.id) {
              <article class="role-card">
                <header>
                  <demo-icon name="shield" class="role-icon" />
                  <span>
                    <h3>{{ role.name }}</h3>
                    <small>{{ memberCount(role.id) }} miembros</small>
                  </span>
                  @if (caps.allows(P.administracion.roles.editar)) {
                    <button class="icon-btn" (click)="editRole(role)">✎</button>
                  }
                </header>
                <p>{{ role.description || 'Sin descripción.' }}</p>
                <!--
                  Los recursos que toca el rol y cuantas acciones concede. Antes mostraba
                  nombres de capacidades, que es el vocabulario que la aplicacion ya no
                  usa: la ficha decia una cosa y el editor del mismo rol, otra.
                -->
                <div class="chips">
                  @for (recurso of recursosDe(role).slice(0, 4); track recurso) {
                    <span>{{ recurso }}</span>
                  }
                  @if (recursosDe(role).length > 4) {
                    <span>+{{ recursosDe(role).length - 4 }}</span>
                  }
                  <span class="chip-cuenta">{{ role.permissions.length }} acciones</span>
                </div>
              </article>
            }
          </section>
        }
        @case ('flags') {
          <section class="panel">
            <div class="toolbar">
              <div>
                <h2>Feature Flags</h2>
                <p>Entrega gradual por audiencia sin volver a desplegar.</p>
              </div>
              <label class="search"
                ><demo-icon name="search" /><input [(ngModel)]="flagSearch" placeholder="Buscar funcionalidad"
              /></label>
            </div>
            <div class="flag-list">
              @for (flag of filteredFlags(); track flag.key + (flag.organizationId ?? '') + (flag.userId ?? '')) {
                <article>
                  <div class="flag-mark"><demo-icon name="flag" /></div>
                  <div>
                    <b>{{ flag.key }}</b
                    ><small>{{ flag.audience }}</small>
                  </div>
                  <span class="rollout">{{ flag.updatedAt | date: 'dd MMM, HH:mm' }}</span
                  ><label class="switch"
                    ><input
                      type="checkbox"
                      [checked]="flag.isEnabled"
                      (change)="toggleFlag(flag)" /><span></span></label
                  ><button class="icon-btn" (click)="selectFlag.set(flag.key)">→</button>
                </article>
              }
            </div>
          </section>
        }
        @case ('audit') {
          <section class="panel table-panel">
            <div class="toolbar">
              <div>
                <h2>Auditoría</h2>
                <p>Registro inmutable de acciones humanas y automáticas.</p>
              </div>
              <label class="search"
                ><demo-icon name="search" /><input
                  [(ngModel)]="auditSearch"
                  placeholder="Buscar acción, entidad o traza" /></label
              ><select [(ngModel)]="auditAction">
                <option value="all">Todas las acciones</option>
                <option value="create">Creación</option>
                <option value="update">Cambios</option>
                <option value="access">Accesos</option>
              </select>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Actor</th>
                    <th>Acción</th>
                    <th>Entidad</th>
                    <th>Trace ID</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of filteredAudit(); track e.id) {
                    <tr>
                      <td>{{ e.createdAt | date: 'dd/MM/yy HH:mm' }}</td>
                      <td>{{ actor(e.userId) }}</td>
                      <td>
                        <b>{{ e.action }}</b>
                      </td>
                      <td>
                        {{ e.entityType }}<small class="block">{{ e.entityId || '—' }}</small>
                      </td>
                      <td>
                        <code>{{ e.traceId.slice(0, 12) }}</code>
                      </td>
                      <td><button class="icon-btn" (click)="selectedAudit.set(e)">→</button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <footer class="pager">
              <span>{{ filteredAudit().length }} eventos visibles</span><span>Página 1 de 1</span>
            </footer>
          </section>
        }
        @case ('errors') {
          <section class="panel table-panel">
            <div class="toolbar">
              <div>
                <h2>Errores de aplicación</h2>
                <p>Fallos agrupados y saneados desde web, escritorio y API.</p>
              </div>
              <select [(ngModel)]="errorStatus">
                <option value="all">Todos los estados</option>
                <option value="new">Nuevos</option>
                <option value="investigating">En análisis</option>
                <option value="resolved">Resueltos</option>
              </select>
            </div>
            <div class="error-list">
              @for (error of filteredErrors(); track error.id) {
                <article (click)="selectedError.set(error)" tabindex="0">
                  <span class="source">{{ error.source }}</span>
                  <div>
                    <b>{{ error.message }}</b
                    ><small
                      >{{ error.version }} · {{ error.lastSeenAt | date: 'dd MMM, HH:mm' }} ·
                      {{ error.affectedUsers }} usuarios</small
                    >
                  </div>
                  <strong>{{ error.occurrences }}×</strong
                  ><span class="error-state" [attr.data-state]="error.status">{{ errorLabel(error.status) }}</span
                  ><button class="icon-btn">→</button>
                </article>
              }
            </div>
          </section>
        }
      }
    </main>

    @if (selectedUser(); as user) {
      <button class="drawer-scrim" (click)="selectedUser.set(null)" aria-label="Cerrar"></button>
      <aside class="drawer">
        <header>
          <div class="person">
            <span>{{ initials(user.displayName) }}</span>
            <div>
              <h2>{{ user.displayName }}</h2>
              <small>{{ user.email }}</small>
            </div>
          </div>
          <button class="icon-btn" (click)="selectedUser.set(null)">×</button>
        </header>
        <div class="drawer-body">
          <label class="active-row"
            ><span><b>Acceso a la plataforma</b><small>Bloquea nuevas sesiones y acciones</small></span
            ><span class="switch"
              ><input
                type="checkbox"
                [checked]="user.isActive"
                (change)="setUserActive(user, !user.isActive)" /><span></span></span
          ></label>
          @if (rolesFor(user).length) {
            <h3>Roles asignados</h3>
            <p class="hint">Los roles suman capacidades a la membresía de la organización.</p>
            <section class="cap-group">
              @for (role of rolesFor(user); track role.id) {
                <label
                  ><span
                    ><b>{{ role.name }}</b
                    ><small>{{ role.description || organizationName(user, role) }}</small></span
                  ><input
                    type="checkbox"
                    [checked]="userHasRole(user, role.id)"
                    (change)="toggleUserRole(user, role.id)"
                /></label>
              }
            </section>
          }
          @if (anulacionesDe(user).length) {
            <section class="excepciones">
              <h3>Excepciones directas</h3>
              <p class="hint">
                Mandan sobre los roles. Mientras estén puestas, cambiar el rol no altera lo que esta persona ve.
              </p>
              @for (anulacion of anulacionesDe(user); track anulacion.code) {
                <div class="excepcion">
                  <span>
                    <b>{{ anulacion.isAllowed ? 'Forzado a sí' : 'Forzado a no' }} · {{ anulacion.code }}</b>
                    <small>
                      @if (anulacion.affects.length > 1) {
                        Alcanza a {{ anulacion.affects.length }} acciones
                      } @else {
                        Una acción
                      }
                    </small>
                  </span>
                  <button class="quiet" (click)="quitarExcepcion(user, anulacion)">Quitar excepción</button>
                </div>
              }
            </section>
          }
          <h3>Permisos efectivos</h3>
          <p class="hint">
            Lo que esta persona puede hacer ahora mismo. Marcar o desmarcar aquí es una excepción directa: manda sobre
            lo que digan sus roles.
          </p>
          @for (group of permissionGroups(); track group.name) {
            <section class="cap-group">
              <header class="cap-group-head">
                <h4>{{ group.name }}</h4>
                <div class="cap-bulk">
                  <span>{{ concedidosEn(user, group.items) }} de {{ group.items.length }}</span>
                </div>
              </header>
              @for (permiso of group.items; track permiso.code) {
                <label
                  ><span
                    ><b>{{ permiso.description }}</b>
                    <small
                      ><em class="cap-action">{{ accionDe(permiso) }}</em> · {{ permiso.code }}</small
                    ></span
                  ><input
                    type="checkbox"
                    [checked]="tienePermiso(user, permiso.code)"
                    (change)="toggleUserCapability(user, permiso.code)"
                /></label>
              }
            </section>
          }
        </div>
      </aside>
    }
    @if (roleDraft(); as role) {
      <button class="drawer-scrim" (click)="roleDraft.set(null)" aria-label="Cerrar"></button>
      <aside class="drawer">
        <header>
          <div>
            <h2>{{ role.id ? 'Editar rol' : 'Crear rol' }}</h2>
            <small>Define un conjunto reutilizable de capacidades.</small>
          </div>
          <button class="icon-btn" (click)="roleDraft.set(null)">×</button>
        </header>
        <div class="drawer-body role-form">
          <label>Nombre<input [(ngModel)]="role.name" /></label
          ><label>Descripción<textarea [(ngModel)]="role.description"></textarea></label>
          @if (!role.id) {
            <label
              >Organización<select [(ngModel)]="role.organizationId">
                @for (org of organizations(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select></label
            >
          }
          @for (group of permissionGroups(); track group.name) {
            <section class="cap-group">
              <header class="cap-group-head">
                <h4>{{ group.name }}</h4>
                <div class="cap-bulk">
                  <span>{{ marcadosEn(group.items) }} de {{ group.items.length }}</span>
                  <button type="button" class="quiet" (click)="marcarGrupo(group.items, true)">Todo</button>
                  <button type="button" class="quiet" (click)="marcarGrupo(group.items, false)">Nada</button>
                </div>
              </header>
              @for (permiso of group.items; track permiso.code) {
                <label
                  ><span
                    ><b>{{ permiso.description }}</b>
                    <small
                      ><em class="cap-action">{{ accionDe(permiso) }}</em> · {{ permiso.code }} ·
                      {{ nivelDe(permiso) }}</small
                    ></span
                  ><input
                    type="checkbox"
                    [checked]="role.permissions.includes(permiso.code)"
                    (change)="togglePermiso(permiso.code)"
                /></label>
              }
            </section>
          }
        </div>
        <footer>
          <button (click)="roleDraft.set(null)">Cancelar</button
          ><button class="primary" (click)="saveRole()">Guardar rol</button>
        </footer>
      </aside>
    }
    @if (selectedError(); as error) {
      <button class="drawer-scrim" (click)="selectedError.set(null)"></button>
      <aside class="drawer">
        <header>
          <div>
            <span class="eyebrow">{{ error.fingerprint }}</span>
            <h2>Detalle del error</h2>
          </div>
          <button class="icon-btn" (click)="selectedError.set(null)">×</button>
        </header>
        <div class="drawer-body">
          <div class="error-hero">
            <b>{{ error.message }}</b
            ><small>{{ error.source }} · {{ error.version }}</small>
          </div>
          <dl>
            <div>
              <dt>Ocurrencias</dt>
              <dd>{{ error.occurrences }}</dd>
            </div>
            <div>
              <dt>Usuarios afectados</dt>
              <dd>{{ error.affectedUsers }}</dd>
            </div>
            <div>
              <dt>Última vez</dt>
              <dd>{{ error.lastSeenAt | date: 'medium' }}</dd>
            </div>
            <div>
              <dt>Trace ID</dt>
              <dd>
                <code>{{ error.traceId || 'No disponible' }}</code>
              </dd>
            </div>
          </dl>
          <label
            >Estado<select [ngModel]="error.status" (ngModelChange)="setErrorStatus(error, $event)">
              <option value="new">Nuevo</option>
              <option value="investigating">En análisis</option>
              <option value="resolved">Resuelto</option>
            </select></label
          >
          <p class="privacy">El reporte excluye cuerpos financieros, tokens y datos personales.</p>
        </div>
      </aside>
    }
    @if (selectedAudit(); as event) {
      <button class="drawer-scrim" (click)="selectedAudit.set(null)"></button>
      <aside class="drawer">
        <header>
          <div>
            <h2>{{ event.action }}</h2>
          </div>
          <button class="icon-btn" (click)="selectedAudit.set(null)">×</button>
        </header>
        <div class="drawer-body">
          <dl>
            <div>
              <dt>Fecha</dt>
              <dd>{{ event.createdAt | date: 'medium' }}</dd>
            </div>
            <div>
              <dt>Actor</dt>
              <dd>{{ actor(event.userId) }}</dd>
            </div>
            <div>
              <dt>Entidad</dt>
              <dd>{{ event.entityType }} / {{ event.entityId || '—' }}</dd>
            </div>
            <div>
              <dt>Trace ID</dt>
              <dd>
                <code>{{ event.traceId }}</code>
              </dd>
            </div>
          </dl>
          <h3>Cambios registrados</h3>
          <pre>{{ event.changesJson || 'Sin cambios de campos asociados.' }}</pre>
        </div>
      </aside>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .admin-page {
        padding: clamp(18px, 3vw, 38px);
        max-width: 1800px;
        margin: auto;
      }
      .page-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        margin-bottom: 22px;
      }
      .eyebrow {
        font-size: 0.72rem;
        letter-spacing: 0.14em;
        color: var(--accent);
        font-weight: 800;
      }
      .page-head h1 {
        font: 700 clamp(1.7rem, 3vw, 2.35rem)/1.1 var(--display);
        margin: 5px 0;
      }
      .page-head p,
      .panel p,
      .cards-head p {
        margin: 0;
        color: var(--muted);
      }
      .health {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 14px;
        background: var(--surface);
      }
      .health i {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--success);
        box-shadow: 0 0 0 5px color-mix(in srgb, var(--success) 15%, transparent);
      }
      .health span {
        display: grid;
      }
      .health small,
      .person small {
        color: var(--muted);
      }
      .tabs {
        display: flex;
        gap: 5px;
        padding: 5px;
        background: color-mix(in srgb, var(--surface) 65%, transparent);
        border: 1px solid var(--line);
        border-radius: 13px;
        overflow: auto;
        margin-bottom: 20px;
      }
      .tabs button {
        border: 0;
        background: transparent;
        white-space: nowrap;
        flex: 1;
      }
      .tabs button.active {
        background: var(--surface);
        color: var(--accent);
        box-shadow: 0 3px 12px #0000000d;
      }
      .tabs em {
        font-style: normal;
        font-size: 0.72rem;
        padding: 2px 6px;
        border-radius: 20px;
        background: var(--accent-soft);
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }
      .kpis article {
        padding: 17px 18px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--surface);
        display: grid;
        gap: 4px;
      }
      .kpis span {
        color: var(--muted);
        font-size: 0.82rem;
      }
      .kpis strong {
        font: 700 1.7rem var(--display);
      }
      .kpis small {
        color: var(--success);
      }
      .kpis .warn small {
        color: var(--danger);
      }
      .summary-grid {
        display: grid;
        grid-template-columns: 1.25fr 1fr;
        gap: 16px;
      }
      .panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: 0 10px 28px #00000008;
        padding: 18px;
      }
      .panel-head,
      .toolbar,
      .cards-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 17px;
      }
      .panel h2,
      .cards-head h2 {
        font: 700 1.12rem var(--display);
        margin: 0 0 3px;
      }
      .timeline {
        display: grid;
      }
      .timeline > div {
        display: grid;
        grid-template-columns: 14px 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 12px 0;
        border-top: 1px solid var(--line);
      }
      .timeline i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
      }
      .timeline span {
        display: grid;
      }
      .timeline small {
        color: var(--muted);
      }
      code {
        font-size: 0.76rem;
        background: var(--accent-soft);
        padding: 3px 6px;
        border-radius: 5px;
      }
      .access-bars {
        display: grid;
        gap: 15px;
      }
      .access-bars > div {
        display: grid;
        grid-template-columns: 150px 1fr;
        align-items: center;
        gap: 12px;
      }
      .access-bars span {
        display: grid;
      }
      .access-bars small {
        color: var(--muted);
      }
      progress {
        width: 100%;
        height: 7px;
        accent-color: var(--accent);
      }
      .toolbar {
        flex-wrap: wrap;
      }
      .toolbar .search {
        margin-left: auto;
      }
      .search {
        min-width: 240px;
        height: 36px;
        border: 1px solid var(--line);
        border-radius: 9px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        color: var(--muted);
      }
      .search input {
        border: 0 !important;
        box-shadow: none !important;
        background: transparent !important;
        min-height: 32px !important;
      }
      .toolbar select {
        width: auto;
        min-width: 160px;
      }
      .table-panel {
        padding-bottom: 0;
      }
      .table-wrap {
        overflow: auto;
        margin: 0 -18px;
        max-height: calc(100vh - 320px);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 850px;
      }
      th {
        position: sticky;
        top: 0;
        background: var(--surface);
        z-index: 1;
        color: var(--muted);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        text-align: left;
        padding: 11px 18px;
        border-bottom: 1px solid var(--line);
      }
      td {
        padding: 11px 18px;
        border-bottom: 1px solid var(--line);
        font-size: 0.86rem;
      }
      .person {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .person > span,
      .role-icon {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 800;
      }
      .person div {
        display: grid;
      }
      .status,
      .error-state {
        display: inline-flex;
        padding: 4px 8px;
        border-radius: 20px;
        background: color-mix(in srgb, var(--success) 12%, transparent);
        color: var(--success);
        font-size: 0.72rem;
        font-weight: 700;
      }
      .status.off {
        background: color-mix(in srgb, var(--muted) 12%, transparent);
        color: var(--muted);
      }
      .block {
        display: block;
        color: var(--muted);
      }
      .pager {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        color: var(--muted);
        font-size: 0.8rem;
      }
      .icon-btn {
        width: 34px;
        padding: 0;
        min-height: 34px;
      }
      /*
       * El mínimo táctil de 44px vive en styles.css, pero como regla sobre \`button\` la
       * vence cualquier selector de componente por especificidad. Se repite aquí con el
       * mismo alcance para que no se pierda en el dedo del usuario.
       */
      @media (pointer: coarse) {
        .icon-btn {
          width: 44px;
          min-height: 44px;
        }
      }
      .primary {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-contrast);
      }
      .role-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }
      .role-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 17px;
      }
      .role-card header {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .role-card header span:nth-child(2) {
        flex: 1;
      }
      .role-card h3 {
        margin: 0;
        font-size: 1rem;
      }
      .role-card p {
        color: var(--muted);
        min-height: 42px;
        font-size: 0.85rem;
      }
      .chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .chips span {
        font-size: 0.72rem;
        padding: 4px 7px;
        background: var(--accent-soft);
        border-radius: 6px;
        color: var(--accent);
      }
      .flag-list,
      .error-list {
        display: grid;
      }
      .flag-list article,
      .error-list article {
        display: grid;
        grid-template-columns: auto minmax(180px, 1fr) auto auto auto;
        gap: 14px;
        align-items: center;
        padding: 13px 0;
        border-top: 1px solid var(--line);
      }
      .flag-list article > div:nth-child(2),
      .error-list article > div {
        display: grid;
      }
      .flag-list small,
      .error-list small {
        color: var(--muted);
      }
      .flag-mark,
      .source {
        display: grid;
        place-items: center;
        width: 35px;
        height: 35px;
        border-radius: 9px;
        background: var(--accent-soft);
        color: var(--accent);
      }
      .source {
        width: auto;
        padding: 0 8px;
        text-transform: uppercase;
        font-size: 0.72rem;
        font-weight: 800;
      }
      .rollout {
        font-size: 0.77rem;
        color: var(--muted);
      }
      .switch input {
        position: absolute;
        opacity: 0;
      }
      .switch > span {
        display: block;
        width: 37px;
        height: 21px;
        border-radius: 20px;
        background: var(--line);
        position: relative;
        transition: background-color 0.16s ease-out;
      }
      .switch > span:after {
        content: '';
        position: absolute;
        width: 15px;
        height: 15px;
        left: 3px;
        top: 3px;
        background: white;
        border-radius: 50%;
        /* Sin lista de propiedades esto era «transition: all». */
        transition: transform 0.16s ease-out;
        box-shadow: 0 1px 3px color-mix(in srgb, var(--text) 25%, transparent);
      }
      .switch input:checked + span {
        background: var(--accent);
      }
      .switch input:checked + span:after {
        transform: translateX(16px);
      }
      .error-list article {
        cursor: pointer;
      }
      .error-state[data-state='new'] {
        color: var(--danger);
        background: color-mix(in srgb, var(--danger) 12%, transparent);
      }
      .error-state[data-state='investigating'] {
        color: #aa7410;
        background: #f7d88833;
      }
      .drawer-scrim {
        position: fixed;
        inset: 0;
        z-index: 50;
        background: #061a2077;
        border: 0;
        border-radius: 0;
      }
      .drawer {
        position: fixed;
        z-index: 51;
        right: 0;
        top: 0;
        height: 100dvh;
        width: min(570px, 100vw);
        background: var(--surface);
        box-shadow: -20px 0 60px #0003;
        display: flex;
        flex-direction: column;
      }
      .drawer > header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--line);
      }
      .drawer h2 {
        margin: 2px 0;
      }
      .drawer-body {
        padding: 20px;
        overflow: auto;
      }
      .drawer > footer {
        padding: 14px 20px;
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .active-row,
      .cap-group label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
      }
      .active-row {
        padding: 15px;
        border: 1px solid var(--line);
        border-radius: 12px;
      }
      .active-row > span:first-child,
      .cap-group label > span {
        display: grid;
      }
      .active-row small,
      .cap-group small,
      .hint {
        color: var(--muted);
      }
      .cap-group {
        border-top: 1px solid var(--line);
        margin-top: 16px;
      }
      .cap-group h4 {
        margin: 14px 0 5px;
      }
      /*
       * Las excepciones se ven antes que los permisos y con su propio color: son la
       * razon por la que editar un rol puede no cambiar nada, y estaban invisibles.
       */
      .excepciones {
        border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--line));
        background: color-mix(in srgb, var(--warning) 8%, transparent);
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 18px;
      }
      .excepciones h3 {
        margin: 0 0 4px;
      }
      .excepcion {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 10px 0;
        border-top: 1px solid color-mix(in srgb, var(--warning) 30%, var(--line));
      }
      .excepcion span {
        display: grid;
        min-width: 0;
      }
      .excepcion small {
        color: var(--muted);
      }
      .cap-group-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        position: sticky;
        top: 0;
        background: var(--panel);
        z-index: 1;
      }
      .cap-bulk {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
      }
      .cap-bulk button {
        padding: 3px 9px;
        font-size: 12px;
      }
      .cap-action {
        font-style: normal;
        font-weight: 600;
        color: var(--accent);
      }
      .cap-group label {
        padding: 9px 2px;
      }
      .cap-group input[type='checkbox'] {
        width: 17px;
        height: 17px;
        accent-color: var(--accent);
      }
      .role-form > label {
        display: grid;
        gap: 6px;
        margin-bottom: 14px;
      }
      .role-form textarea {
        min-height: 80px;
      }
      .error-hero {
        padding: 16px;
        background: var(--accent-soft);
        border-radius: 12px;
        display: grid;
        gap: 5px;
      }
      .error-hero small,
      .privacy {
        color: var(--muted);
      }
      dl {
        display: grid;
        gap: 0;
      }
      dl div {
        display: grid;
        grid-template-columns: 140px 1fr;
        padding: 12px 0;
        border-bottom: 1px solid var(--line);
      }
      dt {
        color: var(--muted);
      }
      dd {
        margin: 0;
      }
      pre {
        white-space: pre-wrap;
        background: var(--bg);
        border: 1px solid var(--line);
        padding: 12px;
        border-radius: 10px;
      }
      @media (max-width: 900px) {
        .kpis {
          grid-template-columns: repeat(2, 1fr);
        }
        .summary-grid,
        .role-grid {
          grid-template-columns: 1fr;
        }
        .page-head {
          align-items: flex-start;
        }
        .health {
          display: none;
        }
        .toolbar .search {
          margin-left: 0;
          flex: 1;
        }
        .flag-list article {
          grid-template-columns: auto 1fr auto auto;
        }
        .rollout {
          display: none;
        }
      }
      @media (max-width: 560px) {
        .admin-page {
          padding: 14px;
        }
        .kpis {
          grid-template-columns: 1fr 1fr;
        }
        .tabs button {
          flex: none;
        }
        .page-head p {
          display: none;
        }
        .toolbar {
          align-items: stretch;
        }
        .toolbar .search,
        .toolbar select {
          width: 100%;
        }
        .flag-list article,
        .error-list article {
          grid-template-columns: auto 1fr auto;
        }
        .flag-list .icon-btn,
        .error-list .icon-btn,
        .error-state {
          display: none;
        }
        .access-bars > div {
          grid-template-columns: 1fr;
        }
        .cards-head {
          align-items: flex-start;
        }
        .kpis article {
          padding: 13px;
        }
        .kpis strong {
          font-size: 1.35rem;
        }
      }
    `,
  ],
})
export class AdminComponent implements OnInit {
  readonly store = inject(DemoStore);
  private api = inject(FinanceApiClient);
  private readonly arranque = inject(RemoteBootstrap);
  readonly caps = inject(CAPABILITIES);

  /**
   * Vuelve a leer la sesion en cuanto se toca algo que cambia accesos.
   *
   * El sondeo normal corre cada minuto y al volver el foco a la ventana. Quien acaba de
   * quitar un permiso desde esta consola no hace ninguna de las dos cosas: se queda
   * mirando la misma pestana, y durante hasta un minuto seguia viendo la entrada de menu
   * que acababa de retirar. El servidor ya rechazaba la peticion —la revalidacion de la
   * cookie recalcula los permisos en cada llamada—, pero la pantalla mentia.
   *
   * Solo importa si el cambio afecta a quien lo hace; si no, no cambia nada y no molesta.
   */
  private async refrescarAccesos(): Promise<void> {
    if (this.store.runtime.mode !== 'api') return;
    await this.arranque.pollSession();
  }
  readonly P = P;
  readonly tab = signal<Tab>('summary');
  readonly users = signal<ApiAdminUser[]>([]);
  readonly roles = signal<readonly ApiAdminRole[]>([]);
  readonly errors = signal<ApiClientError[]>([]);
  readonly audit = signal<ApiAuditEvent[]>([]);
  readonly adminFlags = signal<readonly ApiAdminFeatureFlag[]>([]);
  readonly capabilityCatalog = signal<readonly ApiCapabilityDescriptor[]>([]);
  readonly selectedUser = signal<ApiAdminUser | null>(null);
  readonly roleDraft = signal<ApiAdminRole | null>(null);
  readonly selectedError = signal<ApiClientError | null>(null);
  readonly selectedAudit = signal<ApiAuditEvent | null>(null);
  readonly selectFlag = signal<string | null>(null);
  userSearch = '';
  userStatus = 'all';
  flagSearch = '';
  auditSearch = '';
  auditAction = 'all';
  errorStatus = 'all';
  private readonly allTabs = [
    { id: 'summary' as Tab, label: 'Resumen', icon: 'dashboard', capability: P.administracion.ver },
    { id: 'users' as Tab, label: 'Usuarios', icon: 'people', capability: P.administracion.usuarios.listar },
    { id: 'roles' as Tab, label: 'Roles y capacidades', icon: 'shield', capability: P.administracion.roles.listar },
    { id: 'flags' as Tab, label: 'Feature Flags', icon: 'flag', capability: P.administracion.banderas.listar },
    { id: 'audit' as Tab, label: 'Auditoría', icon: 'list', capability: P.administracion.auditoria.listar },
    { id: 'errors' as Tab, label: 'Errores', icon: '!', capability: P.administracion.errores.listar },
  ];

  /** La consola era todo o nada: quien entraba veía y podía las seis pestañas. */
  readonly tabs = computed(() => this.allTabs.filter((item) => this.caps.allows(item.capability)));
  readonly capabilityCount = computed(() => this.capabilityCatalog().length);

  /** Catálogo granular, agrupado por recurso: es como se lee y como se concede. */
  readonly permissionCatalog = signal<readonly ApiPermissionDescriptor[]>([]);
  readonly permissionGroups = computed(() => {
    const groups = new Map<string, ApiPermissionDescriptor[]>();
    for (const permiso of this.permissionCatalog()) {
      const items = groups.get(permiso.resource) ?? [];
      items.push(permiso);
      groups.set(permiso.resource, items);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });

  accionDe(permiso: ApiPermissionDescriptor): string {
    return ApiPermissionAction[permiso.action] ?? 'Acción';
  }
  nivelDe(permiso: ApiPermissionDescriptor): string {
    return ApiPermissionLevel[permiso.level] ?? 'básico';
  }
  marcadosEn(items: readonly ApiPermissionDescriptor[]): number {
    const concedidos = this.roleDraft()?.permissions ?? [];
    return items.filter((permiso) => concedidos.includes(permiso.code)).length;
  }

  /** Marca o desmarca un recurso entero: con noventa y cinco casillas hace falta. */
  marcarGrupo(items: readonly ApiPermissionDescriptor[], marcar: boolean) {
    this.roleDraft.update((rol) => {
      if (!rol) return rol;
      const codigos = items.map((permiso) => permiso.code);
      const restantes = rol.permissions.filter((codigo) => !codigos.includes(codigo));
      return { ...rol, permissions: marcar ? [...restantes, ...codigos] : restantes };
    });
  }

  /**
   * Los códigos que el catálogo conoce. Si todavía no ha llegado, no se filtra: es
   * preferible mandar lo que había a vaciar los permisos de un rol por una carrera.
   */
  private permisosDelCatalogo(permisos: readonly string[]): readonly string[] {
    const catalogo = this.permissionCatalog();
    if (!catalogo.length) return permisos;
    const conocidos = new Set(catalogo.map((permiso) => permiso.code));
    return permisos.filter((codigo) => conocidos.has(codigo));
  }

  togglePermiso(code: string) {
    this.roleDraft.update((rol) =>
      rol
        ? {
            ...rol,
            permissions: rol.permissions.includes(code)
              ? rol.permissions.filter((x) => x !== code)
              : [...rol.permissions, code],
          }
        : rol,
    );
  }
  readonly organizations = computed(() => {
    const map = new Map<string, string>();
    for (const user of this.users())
      for (const membership of user.memberships ?? []) map.set(membership.organizationId, membership.organizationName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  });
  readonly activeUsers = computed(() => this.users().filter((x) => x.isActive).length);
  readonly enabledFlags = computed(() => this.flagRows().filter((x) => x.isEnabled).length);
  readonly openErrors = computed(() => this.errors().filter((x) => x.status !== 'resolved').length);
  readonly errorOccurrences = computed(() =>
    this.errors()
      .filter((x) => x.status !== 'resolved')
      .reduce((n, x) => n + x.occurrences, 0),
  );
  readonly flagRows = computed(() =>
    this.adminFlags().map((flag) => ({
      ...flag,
      audience: flag.userId ? 'Usuario' : flag.organizationId ? 'Organización' : 'Global',
    })),
  );
  readonly filteredUsers = computed(() =>
    this.users().filter(
      (u) =>
        (this.userStatus === 'all' || (this.userStatus === 'active') === u.isActive) &&
        `${u.displayName} ${u.email}`.toLowerCase().includes(this.userSearch.toLowerCase()),
    ),
  );
  readonly filteredFlags = computed(() =>
    this.flagRows().filter((x) => x.key.toLowerCase().includes(this.flagSearch.toLowerCase())),
  );
  readonly auditRows = computed(() => this.audit());
  readonly filteredAudit = computed(() =>
    this.audit().filter(
      (e) =>
        (this.auditAction === 'all' || e.action.toLowerCase().includes(this.auditAction)) &&
        `${e.action} ${e.entityType} ${e.traceId}`.toLowerCase().includes(this.auditSearch.toLowerCase()),
    ),
  );
  readonly filteredErrors = computed(() =>
    this.errors().filter((e) => this.errorStatus === 'all' || e.status === this.errorStatus),
  );
  async ngOnInit() {
    if (!this.caps.allows(P.administracion.ver)) return;
    if (this.store.runtime.mode !== 'api') return;
    try {
      // Solo se pide lo que el permiso abre: así una sesión sin una pestaña no
      // provoca un 403 en el arranque de la consola.
      const [u, r, a, e, f, c, p] = await Promise.all([
        this.caps.allows(P.administracion.usuarios.listar)
          ? firstValueFrom(this.api.adminUsers())
          : Promise.resolve({ items: [], page: 1, size: 0, total: 0, totalPages: 0, hasNext: false }),
        this.caps.allows(P.administracion.roles.listar) ? firstValueFrom(this.api.adminRoles()) : Promise.resolve([]),
        this.caps.allows(P.administracion.auditoria.listar)
          ? firstValueFrom(this.api.superAdminAudit(1, 50))
          : Promise.resolve({ items: [], page: 1, size: 0, total: 0, totalPages: 0, hasNext: false }),
        this.caps.allows(P.administracion.errores.listar)
          ? firstValueFrom(this.api.adminErrors())
          : Promise.resolve({ items: [], page: 1, size: 0, total: 0, totalPages: 0, hasNext: false }),
        this.caps.allows(P.administracion.banderas.listar)
          ? firstValueFrom(this.api.adminFeatureFlags())
          : Promise.resolve([]),
        this.caps.allows(P.administracion.capacidades.listar)
          ? firstValueFrom(this.api.superAdminCapabilities())
          : Promise.resolve([]),
        this.caps.allows(P.administracion.capacidades.listar)
          ? firstValueFrom(this.api.superAdminPermissions())
          : Promise.resolve([]),
      ]);
      this.users.set(
        u.items.map((user) => ({
          ...user,
          roles: user.roles ?? user.memberships?.flatMap((m) => m.roles.map((role) => role.name)) ?? [],
          capabilities: user.capabilities ?? user.memberships?.flatMap((m) => m.effectiveCapabilities) ?? [],
        })),
      );
      this.roles.set(r);
      this.audit.set([...a.items]);
      this.adminFlags.set(f);
      this.capabilityCatalog.set(c);
      this.permissionCatalog.set(p);
      this.errors.set(
        e.items.map((error) => ({
          ...error,
          status: ((error.status as string) === 'open' ? 'new' : error.status) as ApiClientError['status'],
          occurrences: error.occurrences ?? 1,
          affectedUsers: error.affectedUsers ?? 1,
          version: error.version ?? error.source,
          traceId: error.traceId ?? null,
          lastSeenAt: error.lastSeenAt ?? error.createdAt ?? new Date().toISOString(),
        })),
      );
    } catch {
      this.store.toast.set('No fue posible cargar los datos de la consola de administración.');
    }
  }
  initials(n: string) {
    return n
      .split(' ')
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase();
  }
  actor(id: string | null) {
    return this.users().find((x) => x.id === id)?.displayName ?? 'Sistema';
  }
  /** Recursos que toca un rol, para resumirlo sin repetir los ciento doce codigos. */
  recursosDe(role: ApiAdminRole): readonly string[] {
    return [...new Set((role.permissions ?? []).map((codigo) => codigo.split('.')[0]))].sort();
  }
  anulacionesDe(u: ApiAdminUser): readonly ApiAdminOverride[] {
    return u.memberships?.flatMap((m) => m.overrides ?? []) ?? [];
  }

  /**
   * Devuelve un permiso a lo que digan los roles.
   *
   * Sin esto, una excepción puesta con el vocabulario viejo —una sola, con el nombre de
   * una capacidad— retiraba de golpe sus veintiséis acciones y no había forma de
   * deshacerla desde la consola: se editaba el rol, se recargaba, y seguía sin aparecer.
   */
  quitarExcepcion(u: ApiAdminUser, anulacion: ApiAdminOverride) {
    const organizationId = this.userOrganizationId(u);
    if (!organizationId) return;
    firstValueFrom(this.api.setAdminUserCapability(u.id, organizationId, anulacion.code, null))
      .then(() => this.refrescarAccesos())
      .then(() => this.recargarUsuarios())
      .catch(() => this.store.toast.set('No fue posible quitar la excepción.'));
  }

  /** Permisos vigentes de la persona, tal como los resolvio el servidor. */
  private permisosDe(u: ApiAdminUser): readonly string[] {
    return u.memberships?.flatMap((m) => m.effectivePermissions ?? []) ?? [];
  }
  tienePermiso(u: ApiAdminUser, code: string): boolean {
    return this.permisosDe(u).includes(code);
  }
  concedidosEn(u: ApiAdminUser, items: readonly ApiPermissionDescriptor[]): number {
    const concedidos = this.permisosDe(u);
    return items.filter((permiso) => concedidos.includes(permiso.code)).length;
  }
  errorLabel(s: ApiClientError['status']) {
    return s === 'new' ? 'Nuevo' : s === 'investigating' ? 'En análisis' : 'Resuelto';
  }
  memberCount(roleId: string) {
    return this.users().filter((u) => u.memberships?.some((m) => m.roles.some((r) => r.id === roleId))).length;
  }
  userOrganizationId(user: ApiAdminUser) {
    return (
      user.memberships?.find((m) => m.status === 'Active')?.organizationId ?? user.memberships?.[0]?.organizationId
    );
  }
  organizationName(user: ApiAdminUser, role: ApiAdminRole) {
    return (
      this.organizations().find((org) => org.id === (role.organizationId ?? this.userOrganizationId(user)))?.name ?? ''
    );
  }
  rolesFor(user: ApiAdminUser) {
    const organizationId = this.userOrganizationId(user);
    return organizationId ? this.roles().filter((r) => r.organizationId === organizationId) : this.roles();
  }
  userHasRole(user: ApiAdminUser, roleId: string) {
    return user.memberships?.some((m) => m.roles.some((r) => r.id === roleId)) ?? false;
  }
  openUser(u: ApiAdminUser) {
    this.selectedUser.set({ ...u, roles: [...u.roles], capabilities: [...u.capabilities] });
  }
  setUserActive(u: ApiAdminUser, v: boolean) {
    this.patchUser({ ...u, isActive: v });
    firstValueFrom(this.api.setAdminUserActive(u.id, v)).catch(() =>
      this.store.toast.set('No fue posible cambiar el estado del usuario.'),
    );
  }
  async toggleUserRole(user: ApiAdminUser, roleId: string) {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId) return;
    const current = user.memberships?.find((m) => m.organizationId === organizationId)?.roles.map((r) => r.id) ?? [];
    const roleIds = this.userHasRole(user, roleId) ? current.filter((x) => x !== roleId) : [...current, roleId];
    try {
      await firstValueFrom(this.api.assignAdminUserRoles(user.id, organizationId, roleIds));
      await this.refrescarAccesos();
      const roles = this.roles().filter((r) => roleIds.includes(r.id));
      this.patchUser({
        ...user,
        roles: roles.map((r) => r.name),
        memberships: user.memberships?.map((m) => (m.organizationId === organizationId ? { ...m, roles } : m)),
      });
    } catch {
      this.store.toast.set('No fue posible asignar el rol.');
    }
  }
  /**
   * Concede o retira un permiso concreto a una persona, como excepción directa.
   *
   * Recibe un código del catálogo, el mismo que edita el rol. Antes recibía el nombre de
   * una de las catorce capacidades, así que la ficha de un usuario y el editor de su rol
   * hablaban idiomas distintos y mostraban cosas que no cuadraban.
   */
  toggleUserCapability(u: ApiAdminUser, code: string) {
    const concedido = this.tienePermiso(u, code);
    const organizationId = this.userOrganizationId(u);
    if (!organizationId) return;

    // Se pinta el cambio antes de confirmarlo y se corrige al releer la sesion.
    this.patchUser({
      ...u,
      memberships: u.memberships?.map((m) =>
        m.organizationId === organizationId
          ? {
              ...m,
              effectivePermissions: concedido
                ? (m.effectivePermissions ?? []).filter((x) => x !== code)
                : [...(m.effectivePermissions ?? []), code],
            }
          : m,
      ),
    });

    firstValueFrom(this.api.setAdminUserCapability(u.id, organizationId, code, !concedido))
      .then(() => this.refrescarAccesos())
      .then(() => this.recargarUsuarios())
      .catch(() => this.store.toast.set('No fue posible aplicar el cambio de permiso.'));
  }

  /** Vuelve a pedir la lista para que lo mostrado sea lo que resolvio el servidor. */
  private async recargarUsuarios(): Promise<void> {
    if (!this.caps.allows(P.administracion.usuarios.listar)) return;
    try {
      const pagina = await firstValueFrom(this.api.adminUsers());
      this.users.set(
        pagina.items.map((user) => ({
          ...user,
          roles: user.roles ?? user.memberships?.flatMap((m) => m.roles.map((role) => role.name)) ?? [],
          capabilities: user.capabilities ?? user.memberships?.flatMap((m) => m.effectiveCapabilities) ?? [],
        })),
      );
      const abierto = this.selectedUser();
      if (abierto) this.selectedUser.set(this.users().find((x) => x.id === abierto.id) ?? null);
    } catch {
      /* se queda lo pintado; el proximo refresco lo corrige */
    }
  }
  private patchUser(u: ApiAdminUser) {
    this.users.update((xs) => xs.map((x) => (x.id === u.id ? u : x)));
    this.selectedUser.set(u);
  }
  newRole() {
    this.roleDraft.set({
      id: '',
      name: '',
      description: '',
      organizationId: this.organizations()[0]?.id ?? '',
      capabilities: [],
      permissions: [],
      isSystem: false,
    });
  }
  editRole(r: ApiAdminRole) {
    this.roleDraft.set({
      ...r,
      capabilities: [...r.capabilities],
      permissions: [...(r.permissions ?? [])],
      organizationId: r.organizationId ?? '',
    });
  }
  toggleRoleCapability(key: string) {
    this.roleDraft.update((r) =>
      r
        ? {
            ...r,
            capabilities: r.capabilities.includes(key)
              ? r.capabilities.filter((x) => x !== key)
              : [...r.capabilities, key],
          }
        : r,
    );
  }
  async saveRole() {
    const r = this.roleDraft();
    if (!r || !r.name.trim()) return;
    if (!r.organizationId) {
      this.store.toast.set('Selecciona una organización para el rol.');
      return;
    }
    try {
      const saved = await firstValueFrom(
        this.api.saveAdminRole(r.id || null, {
          organizationId: r.organizationId,
          name: r.name,
          description: r.description ?? '',
          capabilities: r.capabilities,
          // Solo códigos del catálogo que esta pantalla pintó: un rol traído de una
          // versión anterior puede llevar cadenas que el servidor ya no reconoce, y
          // devolvérselas hacía fallar el guardado sin haber tocado nada.
          permissions: this.permisosDelCatalogo(r.permissions),
        }),
      );
      this.roles.update((xs) => (r.id ? xs.map((x) => (x.id === saved.id ? saved : x)) : [...xs, saved]));
      this.roleDraft.set(null);
      await this.refrescarAccesos();
    } catch (error) {
      // El servidor dice qué código sobra; callarlo dejaba un «no fue posible» sin pista.
      const motivo = error instanceof Error ? error.message : '';
      this.store.toast.set(motivo ? `No fue posible guardar el rol: ${motivo}` : 'No fue posible guardar el rol.');
    }
  }
  toggleFlag(flag: { key: string; organizationId: string | null; userId: string | null; isEnabled: boolean }) {
    const isEnabled = !flag.isEnabled;
    this.adminFlags.update((flags) =>
      flags.map((x) =>
        x.key === flag.key && x.organizationId === flag.organizationId && x.userId === flag.userId
          ? { ...x, isEnabled }
          : x,
      ),
    );
    firstValueFrom(
      this.api.updateAdminFeatureFlag(flag.key, {
        organizationId: flag.organizationId,
        userId: flag.userId,
        isEnabled,
      }),
    ).catch(() => this.store.toast.set('No fue posible actualizar el flag.'));
  }
  setErrorStatus(e: ApiClientError, status: ApiClientError['status']) {
    const next = { ...e, status };
    this.errors.update((xs) => xs.map((x) => (x.id === e.id ? next : x)));
    this.selectedError.set(next);
    firstValueFrom(this.api.updateAdminError(e.id, status)).catch(() =>
      this.store.toast.set('No fue posible actualizar el estado del error.'),
    );
  }
}
