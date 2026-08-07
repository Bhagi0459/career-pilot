import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationsService } from '../applications.service';
import { CompaniesService } from '../../companies/companies.service';
import { RecruitersService } from '../../recruiters/recruiters.service';
import { CompanyQuickAddComponent } from '../../companies/company-quick-add/company-quick-add.component';
import { RecruiterQuickAddComponent } from '../../recruiters/recruiter-quick-add/recruiter-quick-add.component';
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  Company,
  JobApplicationUpsertRequest,
  Recruiter,
  WORK_MODES,
  WorkMode
} from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';
import { resolveApiErrorMessage } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective, CompanyQuickAddComponent, RecruiterQuickAddComponent],
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
  readonly workModes = WORK_MODES;

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
    salary: [''],
    workMode: ['' as WorkMode | ''],
    offerDeadline: [''],
    benefits: [''],
    companyId: [0, [Validators.required, Validators.min(1)]],
    recruiterId: [0]
  });

  // Mirrors the companyId control so the recruiter dropdown can filter reactively.
  // Driven by valueChanges (not a manually-set signal) so it stays correct for both
  // user selection AND the patchValue() used when loading an application for edit.
  readonly selectedCompanyId = toSignal(this.form.controls.companyId.valueChanges, {
    initialValue: this.form.controls.companyId.value
  });

  readonly filteredRecruiters = computed(() =>
    this.recruitersService.recruiters().filter((r) => r.companyId === this.selectedCompanyId())
  );

  readonly selectedCompanyName = computed(
    () => this.companies().find((c) => c.id === this.selectedCompanyId())?.name ?? null
  );

  readonly showCompanyModal = signal(false);
  readonly showRecruiterModal = signal(false);

  // Tracks the status the application had when this form loaded (null for a brand-new
  // application), so the celebration only fires the moment a role first *becomes* an Offer -
  // not every time someone re-saves an application that was already at that stage.
  private readonly originalStatus = signal<ApplicationStatus | null>(null);
  readonly showOfferCelebration = signal(false);

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
        this.originalStatus.set(application.status);
        this.form.patchValue({
          roleTitle: application.roleTitle,
          status: application.status,
          country: application.country ?? '',
          appliedDate: application.appliedDate.substring(0, 10),
          notes: application.notes ?? '',
          salary: application.salary ?? '',
          workMode: application.workMode ?? '',
          offerDeadline: application.offerDeadline ? application.offerDeadline.substring(0, 10) : '',
          benefits: application.benefits ?? '',
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

  // Fired from the "+ New company" modal opened next to the Company select, so a company
  // discovered mid-application doesn't force the user to abandon this form to go create it.
  onCompanyCreated(company: Company): void {
    this.showCompanyModal.set(false);
    this.form.controls.companyId.setValue(company.id);
    this.onCompanyChange();
  }

  // Same idea for the recruiter dropdown - the quick-add modal is only reachable once a
  // company is selected, since a recruiter must belong to one.
  onRecruiterCreated(recruiter: Recruiter): void {
    this.showRecruiterModal.set(false);
    this.form.controls.recruiterId.setValue(recruiter.id);
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
      appliedDate: dateOnlyToIso(raw.appliedDate),
      notes: raw.notes || null,
      salary: raw.salary || null,
      workMode: raw.workMode || null,
      offerDeadline: raw.offerDeadline ? dateOnlyToIso(raw.offerDeadline) : null,
      benefits: raw.benefits || null,
      companyId: raw.companyId,
      recruiterId: raw.recruiterId || null
    };

    const id = this.applicationId();
    const request$ = id ? this.applicationsService.update(id, request) : this.applicationsService.create(request);

    const becameOffer = request.status === 'Offer' && this.originalStatus() !== 'Offer';

    request$.subscribe({
      next: () => {
        this.saving.set(false);

        if (becameOffer) {
          // Hold on this page just long enough for the celebration to play before leaving -
          // the applications list has nowhere to show it after navigating away.
          this.showOfferCelebration.set(true);
          setTimeout(() => void this.router.navigateByUrl('/applications'), 1400);
        } else {
          void this.router.navigateByUrl('/applications');
        }
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(resolveApiErrorMessage(error, { default: 'Could not save this application.' }));
      }
    });
  }
}

// A plain browser Date is always anchored to a specific instant, which only exists relative to a
// timezone - so any UTC-based computation (Date.prototype.toISOString included) shifts the
// calendar date near midnight for anyone not at UTC+0. These fields only ever mean "today" or "a
// date" as chosen on screen, not a specific instant, so they're built and read from the local
// Y/M/D components directly instead of going through any UTC conversion.
function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Turns a bare "YYYY-MM-DD" (from a native date input) into an ISO instant without routing it
// through `new Date(dateOnly)` first - that constructor treats a date-only string as UTC
// midnight, which is a JS-only quirk future edits could easily "fix" without realizing this
// depends on it. Anchoring explicitly to UTC midnight here says exactly what's happening.
function dateOnlyToIso(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000Z`;
}
