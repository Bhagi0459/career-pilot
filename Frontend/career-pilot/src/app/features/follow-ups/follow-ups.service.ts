import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FollowUp, FollowUpUpsertRequest, PagedResult } from '../../shared/models';

export interface FollowUpSearchParams {
  page: number;
  pageSize: number;
  sort: string;
  search?: string;
  isDone?: boolean;
}

@Injectable({ providedIn: 'root' })
export class FollowUpsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/followups`;

  // Holds all of the current user's follow-ups. Reused by the dashboard's
  // "upcoming follow-ups" computed() list, not just this feature's own list page.
  private readonly followUpsSignal = signal<FollowUp[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly followUps = this.followUpsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  load(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.http.get<FollowUp[]>(`${this.baseUrl}/all`).subscribe({
      next: (followUps) => {
        this.followUpsSignal.set(followUps);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set('Could not load follow-ups.');
        this.loadingSignal.set(false);
      }
    });
  }

  search(params: FollowUpSearchParams): Observable<PagedResult<FollowUp>> {
    let httpParams = new HttpParams().set('page', params.page).set('pageSize', params.pageSize).set('sort', params.sort);

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.isDone !== undefined) httpParams = httpParams.set('isDone', params.isDone);

    return this.http.get<PagedResult<FollowUp>>(this.baseUrl, { params: httpParams });
  }

  getById(id: number): Observable<FollowUp> {
    return this.http.get<FollowUp>(`${this.baseUrl}/${id}`);
  }

  create(request: FollowUpUpsertRequest): Observable<FollowUp> {
    return this.http
      .post<FollowUp>(this.baseUrl, request)
      .pipe(tap((followUp) => this.followUpsSignal.update((list) => [...list, followUp].sort(byDueDate))));
  }

  update(id: number, request: FollowUpUpsertRequest): Observable<FollowUp> {
    return this.http
      .put<FollowUp>(`${this.baseUrl}/${id}`, request)
      .pipe(
        tap((updated) =>
          this.followUpsSignal.update((list) => list.map((f) => (f.id === id ? updated : f)).sort(byDueDate))
        )
      );
  }

  toggleComplete(id: number): Observable<FollowUp> {
    return this.http
      .patch<FollowUp>(`${this.baseUrl}/${id}/toggle-complete`, {})
      .pipe(
        tap((updated) =>
          this.followUpsSignal.update((list) => list.map((f) => (f.id === id ? updated : f)).sort(byDueDate))
        )
      );
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this.followUpsSignal.update((list) => list.filter((f) => f.id !== id))));
  }
}

function byDueDate(a: FollowUp, b: FollowUp): number {
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}
