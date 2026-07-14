import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Interview, InterviewUpsertRequest } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class InterviewsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/interviews`;

  // Holds all of the current user's interviews. Reused by the dashboard's
  // "upcoming interviews" computed() list, not just this feature's own list page.
  private readonly interviewsSignal = signal<Interview[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly interviews = this.interviewsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  load(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.http.get<Interview[]>(this.baseUrl).subscribe({
      next: (interviews) => {
        this.interviewsSignal.set(interviews);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set('Could not load interviews.');
        this.loadingSignal.set(false);
      }
    });
  }

  getById(id: number): Observable<Interview> {
    return this.http.get<Interview>(`${this.baseUrl}/${id}`);
  }

  create(request: InterviewUpsertRequest): Observable<Interview> {
    return this.http
      .post<Interview>(this.baseUrl, request)
      .pipe(tap((interview) => this.interviewsSignal.update((list) => [...list, interview].sort(byScheduledAt))));
  }

  update(id: number, request: InterviewUpsertRequest): Observable<Interview> {
    return this.http
      .put<Interview>(`${this.baseUrl}/${id}`, request)
      .pipe(
        tap((updated) =>
          this.interviewsSignal.update((list) => list.map((i) => (i.id === id ? updated : i)).sort(byScheduledAt))
        )
      );
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this.interviewsSignal.update((list) => list.filter((i) => i.id !== id))));
  }
}

function byScheduledAt(a: Interview, b: Interview): number {
  return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
}
