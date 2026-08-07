import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FollowUpsService } from '../follow-ups.service';
import { ApplicationsService } from '../../applications/applications.service';
import { FollowUpUpsertRequest } from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';
import { resolveApiErrorMessage } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-follow-up-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './follow-up-form.component.html'
})
export class FollowUpFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly followUpsService = inject(FollowUpsService);
  private readonly applicationsService = inject(ApplicationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly applications = this.applicationsService.allApplications;

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly followUpId = signal<number | null>(null);
  readonly isEditMode = computed(() => this.followUpId() !== null);

  readonly form = this.fb.nonNullable.group({
    jobApplicationId: [0, [Validators.required, Validators.min(1)]],
    note: ['', [Validators.required, Validators.maxLength(500)]],
    dueDate: [todayIsoDate(), [Validators.required]]
  });

  constructor() {
    if (this.applications().length === 0) {
      this.applicationsService.loadAll();
    }

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.followUpId.set(id);
      this.followUpsService.getById(id).subscribe((followUp) => {
        this.form.patchValue({
          jobApplicationId: followUp.jobApplicationId,
          note: followUp.note,
          dueDate: followUp.dueDate.substring(0, 10)
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
    const request: FollowUpUpsertRequest = {
      jobApplicationId: raw.jobApplicationId,
      note: raw.note,
      dueDate: dateOnlyToIso(raw.dueDate)
    };

    const id = this.followUpId();
    const request$ = id ? this.followUpsService.update(id, request) : this.followUpsService.create(request);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigateByUrl('/follow-ups');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(resolveApiErrorMessage(error, { default: 'Could not save this follow-up.' }));
      }
    });
  }
}

// A plain browser Date is always anchored to a specific instant, which only exists relative to a
// timezone - so any UTC-based computation (Date.prototype.toISOString included) shifts the
// calendar date near midnight for anyone not at UTC+0. This field only ever means "today" as
// chosen on screen, not a specific instant, so it's built from the local Y/M/D components
// directly instead of going through any UTC conversion.
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
