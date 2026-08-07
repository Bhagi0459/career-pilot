import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InterviewsService } from '../interviews.service';
import { ApplicationsService } from '../../applications/applications.service';
import { INTERVIEW_STATUSES, InterviewStatus, InterviewUpsertRequest } from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';
import { resolveApiErrorMessage } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-interview-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './interview-form.component.html'
})
export class InterviewFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly interviewsService = inject(InterviewsService);
  private readonly applicationsService = inject(ApplicationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly applications = this.applicationsService.allApplications;
  readonly statuses = INTERVIEW_STATUSES;

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly interviewId = signal<number | null>(null);
  readonly isEditMode = computed(() => this.interviewId() !== null);

  readonly form = this.fb.nonNullable.group({
    jobApplicationId: [0, [Validators.required, Validators.min(1)]],
    round: ['', [Validators.required, Validators.maxLength(100)]],
    scheduledAt: [todayIsoDateTime(), [Validators.required]],
    status: ['Scheduled' as InterviewStatus, [Validators.required]],
    notes: ['']
  });

  constructor() {
    if (this.applications().length === 0) {
      this.applicationsService.loadAll();
    }

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.interviewId.set(id);
      this.interviewsService.getById(id).subscribe((interview) => {
        this.form.patchValue({
          jobApplicationId: interview.jobApplicationId,
          round: interview.round,
          scheduledAt: interview.scheduledAt.substring(0, 16),
          status: interview.status,
          notes: interview.notes ?? ''
        });
      });
    } else {
      const preselectedApplicationId = Number(this.route.snapshot.queryParamMap.get('applicationId'));
      if (preselectedApplicationId) {
        this.form.patchValue({ jobApplicationId: preselectedApplicationId });
      }
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
    const request: InterviewUpsertRequest = {
      jobApplicationId: raw.jobApplicationId,
      round: raw.round,
      scheduledAt: new Date(raw.scheduledAt).toISOString(),
      status: raw.status,
      notes: raw.notes || null
    };

    const id = this.interviewId();
    const request$ = id ? this.interviewsService.update(id, request) : this.interviewsService.create(request);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigateByUrl('/interviews');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(resolveApiErrorMessage(error, { default: 'Could not save this interview.' }));
      }
    });
  }
}

// Building this from toISOString() (UTC) rather than local Y/M/D/H/M components meant the
// prefilled "now" was off by the viewer's UTC offset - e.g. 8pm in a UTC-8 timezone would default
// the picker to 4am the next day. A `datetime-local` input always represents local wall-clock
// time, so the default fed into it has to be computed the same way.
function todayIsoDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
