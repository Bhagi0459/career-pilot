import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const STATUS_COLOR_MAP: Record<string, string> = {
  Applied: 'info',
  Interviewing: 'amber',
  Offer: 'green',
  Rejected: 'red',
  Scheduled: 'info',
  Completed: 'green',
  Cancelled: 'red'
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();

  readonly colorClass = computed(() => STATUS_COLOR_MAP[this.status()] ?? 'neutral');
}
