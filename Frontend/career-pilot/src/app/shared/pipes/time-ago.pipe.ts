import { Pipe, PipeTransform } from '@angular/core';

/**
 * Renders a date as a short relative label ("Today", "In 3 days", "5 days ago").
 * Used for both past dates (applied date) and future dates (interview schedule).
 */
@Pipe({ name: 'timeAgo', standalone: true, pure: true })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const diffDays = Math.round((date.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  }
}
