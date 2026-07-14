import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationsService } from '../applications.service';
import { CompaniesService } from '../../companies/companies.service';
import { RecruitersService } from '../../recruiters/recruiters.service';
import { APPLICATION_STATUSES, ApplicationStatus, JobApplicationUpsertRequest } from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './application-form.component.html',
  styleUrl: './application-form.component.scss'
})
export class ApplicationFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly applicationsService = inject(ApplicationsService);
  private readonly companiesService = inject(CompaniesService);
  private readonly recruitersService = inject(RecruitersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly companies = this.companiesService.companies;
  readonly statuses = APPLICATION_STATUSES;

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly applicationId = signal<number | null>(null);
  readonly isEditMode = computed(() => this.applicationId() !== null);

  readonly form = this.fb.nonNullable.group({
    roleTitle: ['', [Validators.required, Validators.maxLength(200)]],
    status: ['Applied' as ApplicationStatus, [Validators.required]],
    country: [''],
    appliedDate: [todayIsoDate(), [Validators.required]],
    notes: [''],
    companyId: [0, [Validators.required, Validators.min(1)]],
    recruiterId: [0]
  });

  // Mirrors the companyId control so the recruiter dropdown can filter reactively.
  // Driven by valueChanges (not a manually-set signal) so it stays correct for both
  // user selection AND the patchValue() used when loading an application for edit.
  private readonly selectedCompanyId = toSignal(this.form.controls.companyId.valueChanges, {
    initialValue: this.form.controls.companyId.value
  });

  readonly filteredRecruiters = computed(() =>
    this.recruitersService.recruiters().filter((r) => r.companyId === this.selectedCompanyId())
  );

  constructor() {
    if (this.companies().length === 0) {
      this.companiesService.load();
    }
    if (this.recruitersService.recruiters().length === 0) {
      this.recruitersService.load();
    }

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.applicationId.set(id);
      this.applicationsService.getById(id).subscribe((application) => {
        this.form.patchValue({
          roleTitle: application.roleTitle,
          status: application.status,
          country: application.country ?? '',
          appliedDate: application.appliedDate.substring(0, 10),
          notes: application.notes ?? '',
          companyId: application.companyId,
          recruiterId: application.recruiterId ?? 0
        });
      });
    }
  }

  // Bound to the Company select's (change) event (user interaction only - never
  // fires during patchValue), so edit-mode loading never clobbers the recruiterId
  // that was just patched from the saved application.
  onCompanyChange(): void {
    const companyId = this.form.controls.companyId.value;
    const currentRecruiterId = this.form.controls.recruiterId.value;

    const recruiterBelongsToCompany = this.recruitersService
      .recruiters()
      .some((recruiter) => recruiter.id === currentRecruiterId && recruiter.companyId === companyId);

    if (!recruiterBelongsToCompany) {
      this.form.controls.recruiterId.setValue(0);
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
    const request: JobApplicationUpsertRequest = {
      roleTitle: raw.roleTitle,
      status: raw.status,
      country: raw.country || null,
      appliedDate: new Date(raw.appliedDate).toISOString(),
      notes: raw.notes || null,
      companyId: raw.companyId,
      recruiterId: raw.recruiterId || null
    };

    const id = this.applicationId();
    const request$ = id ? this.applicationsService.update(id, request) : this.applicationsService.create(request);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigateByUrl('/applications');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(error.error?.message ?? 'Could not save this application.');
      }
    });
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().substring(0, 10);
}
