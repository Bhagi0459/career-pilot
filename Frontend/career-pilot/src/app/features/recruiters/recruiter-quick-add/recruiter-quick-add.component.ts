import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RecruitersService } from '../recruiters.service';
import { Recruiter } from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-recruiter-quick-add',
  standalone: true,
  imports: [ReactiveFormsModule, AutofocusDirective],
  templateUrl: './recruiter-quick-add.component.html',
  styleUrl: './recruiter-quick-add.component.scss'
})
export class RecruiterQuickAddComponent {
  private readonly fb = inject(FormBuilder);
  private readonly recruitersService = inject(RecruitersService);

  // The recruiter is always created for the company already selected in the parent form -
  // there's no company picker here, since that's the whole point of "quick" add.
  readonly companyId = input.required<number>();
  readonly companyName = input<string | null>(null);

  readonly created = output<Recruiter>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.email]],
    phoneNumber: [''],
    linkedInUrl: ['']
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.recruitersService
      .create({
        name: raw.name,
        email: raw.email || null,
        phoneNumber: raw.phoneNumber || null,
        linkedInUrl: raw.linkedInUrl || null,
        companyId: this.companyId()
      })
      .subscribe({
        next: (recruiter) => {
          this.saving.set(false);
          this.created.emit(recruiter);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.errorMessage.set(error.error?.message ?? 'Could not create this recruiter.');
        }
      });
  }
}
