import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InterviewsService } from '../interviews.service';
import { Interview } from '../../../shared/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-interview-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, LoadingSpinnerComponent, ConfirmDialogComponent, StatusBadgeComponent, TimeAgoPipe],
  templateUrl: './interview-list.component.html',
  styleUrl: './interview-list.component.scss'
})
export class InterviewListComponent {
  private readonly interviewsService = inject(InterviewsService);

  readonly interviews = this.interviewsService.interviews;
  readonly loading = this.interviewsService.loading;
  readonly error = this.interviewsService.error;

  readonly pendingDelete = signal<Interview | null>(null);

  constructor() {
    this.interviewsService.load();
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
    this.interviewsService.delete(interview.id).subscribe(() => this.pendingDelete.set(null));
  }
}
