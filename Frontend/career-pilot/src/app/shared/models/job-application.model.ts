import { ApplicationStatus, WorkMode } from './enums';

export interface JobApplication {
  id: number;
  roleTitle: string;
  status: ApplicationStatus;
  country: string | null;
  appliedDate: string;
  notes: string | null;
  salary: string | null;
  workMode: WorkMode | null;
  offerDeadline: string | null;
  benefits: string | null;
  companyId: number;
  companyName: string;
  recruiterId: number | null;
  recruiterName: string | null;
}

export interface JobApplicationUpsertRequest {
  roleTitle: string;
  status: ApplicationStatus;
  country: string | null;
  appliedDate: string;
  notes: string | null;
  salary: string | null;
  workMode: WorkMode | null;
  offerDeadline: string | null;
  benefits: string | null;
  companyId: number;
  recruiterId: number | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
