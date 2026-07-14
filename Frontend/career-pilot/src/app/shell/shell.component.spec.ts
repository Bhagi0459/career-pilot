import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../core/services/auth.service';
import { ShellComponent } from './shell.component';

@Component({ standalone: true, template: '' })
class DummyChildComponent {}

const TEST_ROUTES: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: 'dashboard', component: DummyChildComponent, data: { title: 'Dashboard' } },
      { path: 'settings', component: DummyChildComponent, data: { title: 'Settings' } },
      { path: 'untitled', component: DummyChildComponent },
      {
        path: 'reports',
        component: DummyChildComponent,
        data: { title: 'Reports' },
        children: [{ path: 'detail', component: DummyChildComponent, data: { title: 'Report Detail' } }]
      }
    ]
  }
];

describe('ShellComponent', () => {
  const fakeAuthService = {
    currentUserEmail: signal<string | null>('user@example.com'),
    currentUserDisplayName: signal<string | null>('Test User'),
    logout: () => {}
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(TEST_ROUTES), { provide: AuthService, useValue: fakeAuthService }]
    });
  });

  async function mountAt(url: string): Promise<ShellComponent> {
    const harness = await RouterTestingHarness.create(url);
    const shell = harness.routeDebugElement?.componentInstance;
    expect(shell).toBeInstanceOf(ShellComponent);
    return shell as ShellComponent;
  }

  it('constructs without throwing on a direct deep link (simulates a browser refresh) and resolves that title', async () => {
    const shell = await mountAt('/settings');

    expect(shell.pageTitle()).toBe('Settings');
  });

  it('resolves the title for the route activated via the root redirect', async () => {
    const shell = await mountAt('/dashboard');

    expect(shell.pageTitle()).toBe('Dashboard');
  });

  it('updates the title after navigating between routes', async () => {
    const shell = await mountAt('/dashboard');
    expect(shell.pageTitle()).toBe('Dashboard');

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/settings');

    expect(shell.pageTitle()).toBe('Settings');
  });

  it('falls back to "Dashboard" when the activated route has no title data', async () => {
    const shell = await mountAt('/untitled');

    expect(shell.pageTitle()).toBe('Dashboard');
  });

  it('resolves the title from the deepest matched route for nested child routes', async () => {
    const shell = await mountAt('/reports/detail');

    expect(shell.pageTitle()).toBe('Report Detail');
  });
});
