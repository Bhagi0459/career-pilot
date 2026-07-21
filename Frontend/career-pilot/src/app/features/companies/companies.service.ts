import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Company, CompanyUpsertRequest, PagedResult } from '../../shared/models';

export interface CompanySearchParams {
  page: number;
  pageSize: number;
  sort: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/companies`;

  // Full, unfiltered dataset for the current user. Powers the company dropdown on the
  // application and recruiter forms. Acceptable at MVP scale - see CompaniesController.GetAllUnpaged.
  private readonly companiesSignal = signal<Company[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly companies = this.companiesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  load(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.http.get<Company[]>(`${this.baseUrl}/all`).subscribe({
      next: (companies) => {
        this.companiesSignal.set(companies);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set('Could not load companies.');
        this.loadingSignal.set(false);
      }
    });
  }

  search(params: CompanySearchParams): Observable<PagedResult<Company>> {
    let httpParams = new HttpParams().set('page', params.page).set('pageSize', params.pageSize).set('sort', params.sort);

    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<PagedResult<Company>>(this.baseUrl, { params: httpParams });
  }

  getById(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.baseUrl}/${id}`);
  }

  create(request: CompanyUpsertRequest): Observable<Company> {
    return this.http
      .post<Company>(this.baseUrl, request)
      .pipe(tap((company) => this.companiesSignal.update((list) => [...list, company].sort(byName))));
  }

  update(id: number, request: CompanyUpsertRequest): Observable<Company> {
    return this.http
      .put<Company>(`${this.baseUrl}/${id}`, request)
      .pipe(
        tap((updated) =>
          this.companiesSignal.update((list) => list.map((c) => (c.id === id ? updated : c)).sort(byName))
        )
      );
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this.companiesSignal.update((list) => list.filter((c) => c.id !== id))));
  }
}

function byName(a: Company, b: Company): number {
  return a.name.localeCompare(b.name);
}
