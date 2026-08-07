import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { InterviewsService } from '../interviews.service';
import { INTERVIEW_STATUSES, Interview, InterviewStatus, PagedResult } from '../../../shared/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { resolveApiErrorMessage } from '../../../shared/utils/api-error.util';

const PAGE_SIZE = 10;
const EMPTY_RESULT: PagedResult<Interview> = { items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE };
// Matches the `tbody tr.row-leaving` transition duration in styles.scss.
const ROW_LEAVE_ANIMATION_MS = 200;

@Component({
  selector: 'app-interview-list',
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
  templateUrl: './interview-list.component.html',
  styleUrl: './interview-list.component.scss'
})
export class InterviewListComponent {
  private readonly interviewsService = inject(InterviewsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = INTERVIEW_STATUSES;
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusFilter = signal<InterviewStatus | ''>('');
  readonly sort = signal('scheduledAt_asc');
  readonly page = signal(1);

  readonly result = signal<PagedResult<Interview>>(EMPTY_RESULT);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingDelete = signal<Interview | null>(null);
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

  onStatusChange(value: string): void {
    this.statusFilter.set(value as InterviewStatus | '');
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

  confirmDelete(interview: Interview): void {
    this.pendingDelete.set(interview);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  deleteConfirmed(): void {
    const interview = this.pendingDelete();
    if (!interview) {
      return;
    }
    this.interviewsService.delete(interview.id).subscribe({
      next: () => {
        this.pendingDelete.set(null);
        this.deletingId.set(interview.id);
        setTimeout(() => {
          this.deletingId.set(null);
          this.runSearch().subscribe();
        }, ROW_LEAVE_ANIMATION_MS);
      },
      error: (error: HttpErrorResponse) => {
        this.pendingDelete.set(null);
        this.error.set(resolveApiErrorMessage(error, { default: 'Could not delete this interview.' }));
      }
    });
  }

  private runSearch(): Observable<PagedResult<Interview>> {
    this.loading.set(true);
    this.error.set(null);

    return this.interviewsService
      .search({
        page: this.page(),
        pageSize: PAGE_SIZE,
        sort: this.sort(),
        search: this.searchControl.value,
        status: this.statusFilter() || undefined
      })
      .pipe(
        tap((result) => {
          this.result.set(result);
          this.loading.set(false);
        }),
        catchError((error: HttpErrorResponse) => {
          this.error.set(resolveApiErrorMessage(error, { default: 'Could not load interviews.' }));
          this.loading.set(false);
          return of(EMPTY_RESULT);
        })
      );
  }
}
