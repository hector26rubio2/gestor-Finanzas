import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app';
import { API_TRANSPORT, HttpApiTransport } from './app/core/api-client';
import { RemoteBootstrap } from './app/core/remote-bootstrap';
import { routes } from './app/routes';
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: API_TRANSPORT, useClass: HttpApiTransport },
    provideAppInitializer(() => inject(RemoteBootstrap).start()),
  ],
}).catch(console.error);
