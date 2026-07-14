export type ApplicationStatus = 'Applied' | 'Interviewing' | 'Rejected' | 'Offer';

export const APPLICATION_STATUSES: ApplicationStatus[] = ['Applied', 'Interviewing', 'Rejected', 'Offer'];

export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export const INTERVIEW_STATUSES: InterviewStatus[] = ['Scheduled', 'Completed', 'Cancelled'];
