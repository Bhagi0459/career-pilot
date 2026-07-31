export interface FollowUp {
  id: number;
  jobApplicationId: number;
  note: string;
  dueDate: string;
  isDone: boolean;
  completedAt: string | null;
  roleTitle: string;
  companyName: string;
}

export interface FollowUpUpsertRequest {
  jobApplicationId: number;
  note: string;
  dueDate: string;
}
