export interface Recruiter {
  id: number;
  name: string;
  email: string | null;
  linkedInUrl: string | null;
  companyId: number;
  companyName: string;
}

export interface RecruiterUpsertRequest {
  name: string;
  email: string | null;
  linkedInUrl: string | null;
  companyId: number;
}
