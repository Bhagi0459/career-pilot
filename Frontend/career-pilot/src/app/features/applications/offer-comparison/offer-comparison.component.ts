import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationsService } from '../applications.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-offer-comparison',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, LoadingSpinnerComponent, TimeAgoPipe],
  templateUrl: './offer-comparison.component.html',
  styleUrl: './offer-comparison.component.scss'
})
export class OfferComparisonComponent {
  private readonly applicationsService = inject(ApplicationsService);

  readonly loading = this.applicationsService.allLoading;
  readonly error = this.applicationsService.allError;

  // Deadline-soonest first - the one you need to decide on first belongs first, and offers
  // without a deadline (least time pressure) sink to the end.
  readonly offers = computed(() =>
    [...this.applicationsService.allApplications()]
      .filter((application) => application.status === 'Offer')
      .sort((a, b) => {
        if (!a.offerDeadline && !b.offerDeadline) return 0;
        if (!a.offerDeadline) return 1;
        if (!b.offerDeadline) return -1;
        return new Date(a.offerDeadline).getTime() - new Date(b.offerDeadline).getTime();
      })
  );

  constructor() {
    if (this.applicationsService.allApplications().length === 0) {
      this.applicationsService.loadAll();
    }
  }
}
