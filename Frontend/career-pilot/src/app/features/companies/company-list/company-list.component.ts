import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { CompaniesService } from '../companies.service';
import { Company, PagedResult } from '../../../shared/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { resolveApiErrorMessage } from '../../../shared/utils/api-error.util';

const PAGE_SIZE = 10;
const EMPTY_RESULT: PagedResult<Company> = { items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE };
// Matches the `tbody tr.row-leaving` transition duration in styles.scss - the actual data refresh
// (which removes the row for real) waits until the fade/slide-out has visually finished.
const ROW_LEAVE_ANIMATION_MS = 200;

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, LoadingSpinnerComponent, ConfirmDialogComponent],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.scss'
})
export class CompanyListComponent {
  private readonly companiesService = inject(CompaniesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly sort = signal('name_asc');
  readonly page = signal(1);

  readonly result = signal<PagedResult<Company>>(EMPTY_RESULT);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingDelete = signal<Company | null>(null);
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

  confirmDelete(company: Company): void {
    this.pendingDelete.set(company);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  deleteConfirmed(): void {
    const company = this.pendingDelete();
    if (!company) {
      return;
    }
    this.companiesService.delete(company.id).subscribe({
      next: () => {
        this.pendingDelete.set(null);
        // The row plays its leaving animation first; only once that's visually finished do we
        // actually refetch (which is what removes it from `result()` for real).
        this.deletingId.set(company.id);
        setTimeout(() => {
          this.deletingId.set(null);
          this.runSearch().subscribe();
        }, ROW_LEAVE_ANIMATION_MS);
      },
      error: (error: HttpErrorResponse) => {
        // A 409 here means the company still has applications/recruiters attached (see
        // CompaniesController.Delete) - surface that reason instead of leaving the confirm
        // dialog open with no feedback.
        this.pendingDelete.set(null);
        this.error.set(resolveApiErrorMessage(error, { default: 'Could not delete this company.' }));
      }
    });
  }

  private runSearch(): Observable<PagedResult<Company>> {
    this.loading.set(true);
    this.error.set(null);

    return this.companiesService
      .search({
        page: this.page(),
        pageSize: PAGE_SIZE,
        sort: this.sort(),
        search: this.searchControl.value
      })
      .pipe(
        tap((result) => {
          this.result.set(result);
          this.loading.set(false);
        }),
        catchError((error: HttpErrorResponse) => {
          this.error.set(resolveApiErrorMessage(error, { default: 'Could not load companies.' }));
          this.loading.set(false);
          return of(EMPTY_RESULT);
        })
      );
  }
}
