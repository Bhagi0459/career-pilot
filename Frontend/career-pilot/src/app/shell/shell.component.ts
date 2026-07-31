import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  readonly currentUserEmail = this.authService.currentUserEmail;
  readonly currentUserDisplayName = this.authService.currentUserDisplayName;

  readonly mobileNavOpen = signal(false);

  readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.resolveTitle()),
      startWith(this.resolveTitle())
    ),
    { initialValue: 'Dashboard' }
  );

  toggleMobileNav(): void {
    this.mobileNavOpen.update((open) => !open);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  /**
   * Walks the Router's own resolved snapshot tree rather than this component's
   * `ActivatedRoute.firstChild` chain. The latter is a live node whose `children`
   * are populated by outlet activation, which happens after the shell (and this
   * field initializer) is constructed - reading it here could see an incomplete
   * tree. `router.routerState.snapshot` is a fully-resolved, always-defined
   * snapshot (redirects already applied), safe to read at any time.
   */
  private resolveTitle(): string {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (route?.firstChild) {
      route = route.firstChild;
    }
    return (route?.data?.['title'] as string | undefined) ?? 'Dashboard';
  }
}
