import { InterviewStatus } from './enums';

export interface Interview {
  id: number;
  jobApplicationId: number;
  round: string;
  scheduledAt: string;
  status: InterviewStatus;
  notes: string | null;
  roleTitle: string;
  companyName: string;
}

export interface InterviewUpsertRequest {
  jobApplicationId: number;
  round: string;
  scheduledAt: string;
  status: InterviewStatus;
  notes: string | null;
}
