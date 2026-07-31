import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationsService } from '../applications/applications.service';
import { InterviewsService } from '../interviews/interviews.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { ApplicationStatus } from '../../shared/models';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

const RADIUS = 58; // Must match the <circle r="58"> in the template.
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUS_CHART_COLORS: Record<ApplicationStatus, string> = {
  Applied: '#2563eb',
  Interviewing: '#d97706',
  Offer: '#16a34a',
  Rejected: '#dc2626'
};

interface ChartSegment {
  status: ApplicationStatus;
  count: number;
  color: string;
  dasharray: string;
  dashoffset: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, StatCardComponent, StatusBadgeComponent, EmptyStateComponent, LoadingSpinnerComponent, TimeAgoPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly applicationsService = inject(ApplicationsService);
  private readonly interviewsService = inject(InterviewsService);
  private readonly followUpsService = inject(FollowUpsService);

  readonly applications = this.applicationsService.allApplications;
  readonly interviews = this.interviewsService.interviews;
  readonly followUps = this.followUpsService.followUps;
  readonly loading = computed(
    () => this.applicationsService.allLoading() || this.interviewsService.loading() || this.followUpsService.loading()
  );
  readonly error = computed(
    () => this.applicationsService.allError() ?? this.interviewsService.error() ?? this.followUpsService.error()
  );

  readonly totalCount = computed(() => this.applications().length);
  readonly appliedCount = computed(() => this.countByStatus('Applied'));
  readonly interviewingCount = computed(() => this.countByStatus('Interviewing'));
  readonly rejectedCount = computed(() => this.countByStatus('Rejected'));
  readonly offerCount = computed(() => this.countByStatus('Offer'));

  readonly recentApplications = computed(() =>
    [...this.applications()]
      .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime())
      .slice(0, 5)
  );

  readonly upcomingInterviews = computed(() => {
    const now = Date.now();
    return this.interviews()
      .filter((interview) => interview.status === 'Scheduled' && new Date(interview.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 5);
  });

  readonly chartSegments = computed<ChartSegment[]>(() => {
    const total = this.totalCount();
    if (total === 0) {
      return [];
    }

    const counts: Array<{ status: ApplicationStatus; count: number }> = [
      { status: 'Applied', count: this.appliedCount() },
      { status: 'Interviewing', count: this.interviewingCount() },
      { status: 'Offer', count: this.offerCount() },
      { status: 'Rejected', count: this.rejectedCount() }
    ];

    let cumulativeFraction = 0;
    return counts
      .filter((entry) => entry.count > 0)
      .map((entry) => {
        const fraction = entry.count / total;
        const dash = fraction * CIRCUMFERENCE;
        const dashoffset = -(cumulativeFraction * CIRCUMFERENCE);
        cumulativeFraction += fraction;

        return {
          status: entry.status,
          count: entry.count,
          color: STATUS_CHART_COLORS[entry.status],
          dasharray: `${dash} ${CIRCUMFERENCE - dash}`,
          dashoffset
        };
      });
  });

  readonly upcomingFollowUps = computed(() =>
    [...this.followUps()]
      .filter((followUp) => !followUp.isDone)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5)
  );

  // Segments render fully "closed" (dasharray "0 C") on first paint, then flip to their real
  // computed dasharray a tick later - the existing CSS transition on stroke-dasharray turns that
  // into a sweep-in draw instead of the chart just appearing fully formed.
  readonly chartRevealed = signal(false);
  readonly hiddenDasharray = `0 ${CIRCUMFERENCE}`;

  constructor() {
    this.applicationsService.loadAll();
    this.interviewsService.load();
    this.followUpsService.load();
    setTimeout(() => this.chartRevealed.set(true));
  }

  private countByStatus(status: ApplicationStatus): number {
    return this.applications().filter((application) => application.status === status).length;
  }
}
