import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompaniesService } from '../companies.service';
import { Company } from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';
import { resolveApiErrorMessage } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-company-quick-add',
  standalone: true,
  imports: [ReactiveFormsModule, AutofocusDirective],
  templateUrl: './company-quick-add.component.html',
  styleUrl: './company-quick-add.component.scss'
})
export class CompanyQuickAddComponent {
  private readonly fb = inject(FormBuilder);
  private readonly companiesService = inject(CompaniesService);

  readonly created = output<Company>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    country: [''],
    website: ['']
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.companiesService
      .create({
        name: raw.name,
        country: raw.country || null,
        website: raw.website || null,
        notes: null
      })
      .subscribe({
        next: (company) => {
          this.saving.set(false);
          this.created.emit(company);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.errorMessage.set(resolveApiErrorMessage(error, { default: 'Could not create this company.' }));
        }
      });
  }
}
