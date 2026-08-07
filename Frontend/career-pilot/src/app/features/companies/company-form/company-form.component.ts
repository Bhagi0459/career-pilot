import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompaniesService } from '../companies.service';
import { CompanyUpsertRequest } from '../../../shared/models';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';
import { resolveApiErrorMessage } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-company-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './company-form.component.html'
})
export class CompanyFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly companiesService = inject(CompaniesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly companyId = signal<number | null>(null);

  readonly isEditMode = computed(() => this.companyId() !== null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    country: [''],
    website: [''],
    notes: ['']
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.companyId.set(id);
      this.companiesService.getById(id).subscribe((company) => {
        this.form.patchValue({
          name: company.name,
          country: company.country ?? '',
          website: company.website ?? '',
          notes: company.notes ?? ''
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
    const request: CompanyUpsertRequest = {
      name: raw.name,
      country: raw.country || null,
      website: raw.website || null,
      notes: raw.notes || null
    };

    const id = this.companyId();
    const request$ = id ? this.companiesService.update(id, request) : this.companiesService.create(request);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigateByUrl('/companies');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(resolveApiErrorMessage(error, { default: 'Could not save this company.' }));
      }
    });
  }
}
