import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult, Recruiter, RecruiterUpsertRequest } from '../../shared/models';

export interface RecruiterSearchParams {
  page: number;
  pageSize: number;
  sort: string;
  search?: string;
  companyId?: number;
}

@Injectable({ providedIn: 'root' })
export class RecruitersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/recruiters`;

  // Full, unfiltered dataset for the current user. Powers the recruiter dropdown on the
  // application form, filtered client-side by company. See RecruitersController.GetAllUnpaged.
  private readonly recruitersSignal = signal<Recruiter[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly recruiters = this.recruitersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  load(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.http.get<Recruiter[]>(`${this.baseUrl}/all`).subscribe({
      next: (recruiters) => {
        this.recruitersSignal.set(recruiters);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set('Could not load recruiters.');
        this.loadingSignal.set(false);
      }
    });
  }

  search(params: RecruiterSearchParams): Observable<PagedResult<Recruiter>> {
    let httpParams = new HttpParams().set('page', params.page).set('pageSize', params.pageSize).set('sort', params.sort);

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.companyId) httpParams = httpParams.set('companyId', params.companyId);

    return this.http.get<PagedResult<Recruiter>>(this.baseUrl, { params: httpParams });
  }

  getById(id: number): Observable<Recruiter> {
    return this.http.get<Recruiter>(`${this.baseUrl}/${id}`);
  }

  create(request: RecruiterUpsertRequest): Observable<Recruiter> {
    return this.http
      .post<Recruiter>(this.baseUrl, request)
      .pipe(tap((recruiter) => this.recruitersSignal.update((list) => [...list, recruiter].sort(byName))));
  }

  update(id: number, request: RecruiterUpsertRequest): Observable<Recruiter> {
    return this.http
      .put<Recruiter>(`${this.baseUrl}/${id}`, request)
      .pipe(
        tap((updated) =>
          this.recruitersSignal.update((list) => list.map((r) => (r.id === id ? updated : r)).sort(byName))
        )
      );
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this.recruitersSignal.update((list) => list.filter((r) => r.id !== id))));
  }
}

function byName(a: Recruiter, b: Recruiter): number {
  return a.name.localeCompare(b.name);
}
