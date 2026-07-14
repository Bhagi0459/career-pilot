import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompaniesService } from '../companies.service';
import { Company } from '../../../shared/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, LoadingSpinnerComponent, ConfirmDialogComponent],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.scss'
})
export class CompanyListComponent {
  private readonly companiesService = inject(CompaniesService);

  readonly companies = this.companiesService.companies;
  readonly loading = this.companiesService.loading;
  readonly error = this.companiesService.error;

  readonly pendingDelete = signal<Company | null>(null);

  constructor() {
    this.companiesService.load();
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
    this.companiesService.delete(company.id).subscribe(() => this.pendingDelete.set(null));
  }
}
