import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { ApplicationsService } from '../applications.service';
import { APPLICATION_STATUSES, ApplicationStatus, JobApplication, PagedResult } from '../../../shared/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

const PAGE_SIZE = 10;
const EMPTY_RESULT: PagedResult<JobApplication> = { items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE };

@Component({
  selector: 'app-application-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    ConfirmDialogComponent,
    StatusBadgeComponent,
    TimeAgoPipe
  ],
  templateUrl: './application-list.component.html',
  styleUrl: './application-list.component.scss'
})
export class ApplicationListComponent {
  private readonly applicationsService = inject(ApplicationsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = APPLICATION_STATUSES;
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly countryControl = new FormControl('', { nonNullable: true });

  readonly statusFilter = signal<ApplicationStatus | ''>('');
  readonly sort = signal('appliedDate_desc');
  readonly page = signal(1);

  readonly result = signal<PagedResult<JobApplication>>(EMPTY_RESULT);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingDelete = signal<JobApplication | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.result().totalCount / PAGE_SIZE)));

  constructor() {
    // Server-side search: debounce keystrokes, ignore repeats, cancel stale requests.
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.page.set(1)),
        switchMap(() => this.runSearch()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    this.runSearch().subscribe();
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value as ApplicationStatus | '');
    this.page.set(1);
    this.runSearch().subscribe();
  }

  onCountryChange(value: string): void {
    this.countryControl.setValue(value, { emitEvent: false });
    this.page.set(1);
    this.runSearch().subscribe();
  }

  onSortChange(value: string): void {
    this.sort.set(value);
    this.runSearch().subscribe();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) {
      return;
    }
    this.page.set(page);
    this.runSearch().subscribe();
  }

  confirmDelete(application: JobApplication): void {
    this.pendingDelete.set(application);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  deleteConfirmed(): void {
    const application = this.pendingDelete();
    if (!application) {
      return;
    }
    this.applicationsService.delete(application.id).subscribe(() => {
      this.pendingDelete.set(null);
      this.runSearch().subscribe();
    });
  }

  private runSearch(): Observable<PagedResult<JobApplication>> {
    this.loading.set(true);
    this.error.set(null);

    return this.applicationsService
      .search({
        page: this.page(),
        pageSize: PAGE_SIZE,
        sort: this.sort(),
        search: this.searchControl.value,
        status: this.statusFilter() || undefined,
        country: this.countryControl.value || undefined
      })
      .pipe(
        tap((result) => {
          this.result.set(result);
          this.loading.set(false);
        }),
        catchError(() => {
          this.error.set('Could not load applications.');
          this.loading.set(false);
          return of(EMPTY_RESULT);
        })
      );
  }
}
