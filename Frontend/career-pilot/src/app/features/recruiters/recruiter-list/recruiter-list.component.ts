import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecruitersService } from '../recruiters.service';
import { Recruiter } from '../../../shared/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-recruiter-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, LoadingSpinnerComponent, ConfirmDialogComponent],
  templateUrl: './recruiter-list.component.html',
  styleUrl: './recruiter-list.component.scss'
})
export class RecruiterListComponent {
  private readonly recruitersService = inject(RecruitersService);

  readonly recruiters = this.recruitersService.recruiters;
  readonly loading = this.recruitersService.loading;
  readonly error = this.recruitersService.error;

  readonly pendingDelete = signal<Recruiter | null>(null);

  constructor() {
    this.recruitersService.load();
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
    this.recruitersService.delete(recruiter.id).subscribe(() => this.pendingDelete.set(null));
  }
}
