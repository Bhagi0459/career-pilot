export interface Company {
  id: number;
  name: string;
  country: string | null;
  website: string | null;
  notes: string | null;
}

export interface CompanyUpsertRequest {
  name: string;
  country: string | null;
  website: string | null;
  notes: string | null;
}
