import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecruitersService } from '../recruiters.service';
import { CompaniesService } from '../../companies/companies.service';
import { RecruiterUpsertRequest } from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-recruiter-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './recruiter-form.component.html',
  styleUrl: './recruiter-form.component.scss'
})
export class RecruiterFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly recruitersService = inject(RecruitersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly companies = this.companiesService.companies;

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly recruiterId = signal<number | null>(null);

  readonly isEditMode = computed(() => this.recruiterId() !== null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.email]],
    linkedInUrl: [''],
    companyId: [0, [Validators.required, Validators.min(1)]]
  });

  constructor() {
    if (this.companies().length === 0) {
      this.companiesService.load();
    }

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.recruiterId.set(id);
      this.recruitersService.getById(id).subscribe((recruiter) => {
        this.form.patchValue({
          name: recruiter.name,
          email: recruiter.email ?? '',
          linkedInUrl: recruiter.linkedInUrl ?? '',
          companyId: recruiter.companyId
        });
      });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const request: RecruiterUpsertRequest = {
      name: raw.name,
      email: raw.email || null,
      linkedInUrl: raw.linkedInUrl || null,
      companyId: raw.companyId
    };

    const id = this.recruiterId();
    const request$ = id ? this.recruitersService.update(id, request) : this.recruitersService.create(request);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigateByUrl('/recruiters');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(error.error?.message ?? 'Could not save this recruiter.');
      }
    });
  }
}
