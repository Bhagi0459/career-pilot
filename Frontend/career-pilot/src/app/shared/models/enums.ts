export type ApplicationStatus = 'Applied' | 'Interviewing' | 'Rejected' | 'Offer';

export const APPLICATION_STATUSES: ApplicationStatus[] = ['Applied', 'Interviewing', 'Rejected', 'Offer'];

export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export const INTERVIEW_STATUSES: InterviewStatus[] = ['Scheduled', 'Completed', 'Cancelled'];

export type WorkMode = 'Remote' | 'Hybrid' | 'Onsite';

export const WORK_MODES: WorkMode[] = ['Remote', 'Hybrid', 'Onsite'];
