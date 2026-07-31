import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FollowUpsService } from '../follow-ups.service';
import { ApplicationsService } from '../../applications/applications.service';
import { FollowUpUpsertRequest } from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-follow-up-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './follow-up-form.component.html',
  styleUrl: './follow-up-form.component.scss'
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
      dueDate: new Date(raw.dueDate).toISOString()
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
        this.errorMessage.set(error.error?.message ?? 'Could not save this follow-up.');
      }
    });
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().substring(0, 10);
}
