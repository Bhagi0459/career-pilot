import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApplicationStatus, JobApplication, JobApplicationUpsertRequest, PagedResult } from '../../shared/models';

export interface ApplicationSearchParams {
  page: number;
  pageSize: number;
  sort: string;
  search?: string;
  status?: ApplicationStatus | '';
  country?: string;
}

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/applications`;

  // Full, unfiltered dataset for the current user. Powers the dashboard's client-side
  // computed() stats and the application dropdown on the interview form. Acceptable at
  // MVP scale - see JobApplicationsController.GetAllUnpaged on the backend.
  private readonly allApplicationsSignal = signal<JobApplication[]>([]);
  private readonly allLoadingSignal = signal(false);
  private readonly allErrorSignal = signal<string | null>(null);

  readonly allApplications = this.allApplicationsSignal.asReadonly();
  readonly allLoading = this.allLoadingSignal.asReadonly();
  readonly allError = this.allErrorSignal.asReadonly();

  loadAll(): void {
    this.allLoadingSignal.set(true);
    this.allErrorSignal.set(null);
    this.http.get<JobApplication[]>(`${this.baseUrl}/all`).subscribe({
      next: (items) => {
        this.allApplicationsSignal.set(items);
        this.allLoadingSignal.set(false);
      },
      error: () => {
        this.allErrorSignal.set('Could not load applications.');
        this.allLoadingSignal.set(false);
      }
    });
  }

  search(params: ApplicationSearchParams): Observable<PagedResult<JobApplication>> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize)
      .set('sort', params.sort);

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.country) httpParams = httpParams.set('country', params.country);

    return this.http.get<PagedResult<JobApplication>>(this.baseUrl, { params: httpParams });
  }

  getById(id: number): Observable<JobApplication> {
    return this.http.get<JobApplication>(`${this.baseUrl}/${id}`);
  }

  create(request: JobApplicationUpsertRequest): Observable<JobApplication> {
    return this.http.post<JobApplication>(this.baseUrl, request).pipe(tap(() => this.loadAll()));
  }

  update(id: number, request: JobApplicationUpsertRequest): Observable<JobApplication> {
    return this.http.put<JobApplication>(`${this.baseUrl}/${id}`, request).pipe(tap(() => this.loadAll()));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(tap(() => this.loadAll()));
  }
}
