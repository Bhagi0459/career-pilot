import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { FollowUpsService } from '../follow-ups.service';
import { FollowUp, PagedResult } from '../../../shared/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { resolveApiErrorMessage } from '../../../shared/utils/api-error.util';

type DoneFilter = '' | 'pending' | 'done';

const PAGE_SIZE = 10;
const EMPTY_RESULT: PagedResult<FollowUp> = { items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE };
// Matches the `tbody tr.row-leaving` transition duration in styles.scss.
const ROW_LEAVE_ANIMATION_MS = 200;

@Component({
  selector: 'app-follow-up-list',
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
  templateUrl: './follow-up-list.component.html',
  styleUrl: './follow-up-list.component.scss'
})
export class FollowUpListComponent {
  private readonly followUpsService = inject(FollowUpsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly doneFilter = signal<DoneFilter>('');
  readonly sort = signal('dueDate_asc');
  readonly page = signal(1);

  readonly result = signal<PagedResult<FollowUp>>(EMPTY_RESULT);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingDelete = signal<FollowUp | null>(null);
  readonly deletingId = signal<number | null>(null);

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

  statusFor(followUp: FollowUp): 'Done' | 'Overdue' | 'Pending' {
    if (followUp.isDone) return 'Done';
    // Compare by calendar day, not exact instant - a follow-up due "today" shouldn't flip to
    // Overdue the moment any time has passed since midnight.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return new Date(followUp.dueDate).getTime() < startOfToday.getTime() ? 'Overdue' : 'Pending';
  }

  onDoneFilterChange(value: string): void {
    this.doneFilter.set(value as DoneFilter);
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

  toggleComplete(followUp: FollowUp): void {
    this.followUpsService.toggleComplete(followUp.id).subscribe(() => this.runSearch().subscribe());
  }

  confirmDelete(followUp: FollowUp): void {
    this.pendingDelete.set(followUp);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  deleteConfirmed(): void {
    const followUp = this.pendingDelete();
    if (!followUp) {
      return;
    }
    this.followUpsService.delete(followUp.id).subscribe({
      next: () => {
        this.pendingDelete.set(null);
        this.deletingId.set(followUp.id);
        setTimeout(() => {
          this.deletingId.set(null);
          this.runSearch().subscribe();
        }, ROW_LEAVE_ANIMATION_MS);
      },
      error: (error: HttpErrorResponse) => {
        this.pendingDelete.set(null);
        this.error.set(resolveApiErrorMessage(error, { default: 'Could not delete this follow-up.' }));
      }
    });
  }

  private runSearch(): Observable<PagedResult<FollowUp>> {
    this.loading.set(true);
    this.error.set(null);

    const doneFilter = this.doneFilter();

    return this.followUpsService
      .search({
        page: this.page(),
        pageSize: PAGE_SIZE,
        sort: this.sort(),
        search: this.searchControl.value,
        isDone: doneFilter === '' ? undefined : doneFilter === 'done'
      })
      .pipe(
        tap((result) => {
          this.result.set(result);
          this.loading.set(false);
        }),
        catchError((error: HttpErrorResponse) => {
          this.error.set(resolveApiErrorMessage(error, { default: 'Could not load follow-ups.' }));
          this.loading.set(false);
          return of(EMPTY_RESULT);
        })
      );
  }
}
