import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { RecruitersService } from '../recruiters.service';
import { CompaniesService } from '../../companies/companies.service';
import { PagedResult, Recruiter } from '../../../shared/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

const PAGE_SIZE = 10;
const EMPTY_RESULT: PagedResult<Recruiter> = { items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE };

@Component({
  selector: 'app-recruiter-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, LoadingSpinnerComponent, ConfirmDialogComponent],
  templateUrl: './recruiter-list.component.html',
  styleUrl: './recruiter-list.component.scss'
})
export class RecruiterListComponent {
  private readonly recruitersService = inject(RecruitersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly companies = this.companiesService.companies;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly companyFilter = signal<number | ''>('');
  readonly sort = signal('name_asc');
  readonly page = signal(1);

  readonly result = signal<PagedResult<Recruiter>>(EMPTY_RESULT);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingDelete = signal<Recruiter | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.result().totalCount / PAGE_SIZE)));

  constructor() {
    if (this.companies().length === 0) {
      this.companiesService.load();
    }

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

  onCompanyChange(value: string): void {
    this.companyFilter.set(value ? Number(value) : '');
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

  confirmDelete(recruiter: Recruiter): void {
    this.pendingDelete.set(recruiter);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  deleteConfirmed(): void {
    const recruiter = this.pendingDelete();
    if (!recruiter) {
      return;
    }
    this.recruitersService.delete(recruiter.id).subscribe(() => {
      this.pendingDelete.set(null);
      this.runSearch().subscribe();
    });
  }

  private runSearch(): Observable<PagedResult<Recruiter>> {
    this.loading.set(true);
    this.error.set(null);

    return this.recruitersService
      .search({
        page: this.page(),
        pageSize: PAGE_SIZE,
        sort: this.sort(),
        search: this.searchControl.value,
        companyId: this.companyFilter() || undefined
      })
      .pipe(
        tap((result) => {
          this.result.set(result);
          this.loading.set(false);
        }),
        catchError(() => {
          this.error.set('Could not load recruiters.');
          this.loading.set(false);
          return of(EMPTY_RESULT);
        })
      );
  }
}
