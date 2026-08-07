import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { passwordsMatchValidator } from '../../shared/validators/passwords-match.validator';
import { ProfileResponse } from '../../shared/models';
import { ProfileService } from './profile.service';
import { resolveApiErrorMessage } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, LoadingSpinnerComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly profile = signal<ProfileResponse | null>(null);
  readonly profileLoading = signal(true);
  readonly profileLoadError = signal<string | null>(null);

  readonly profileSaving = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly profileSuccess = signal(false);

  readonly profileForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]]
  });

  readonly passwordSaving = signal(false);
  readonly passwordError = signal<string | null>(null);

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatchValidator('newPassword', 'confirmPassword') }
  );

  ngOnInit(): void {
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.profileForm.patchValue({ displayName: profile.displayName });
        this.profileLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.profileLoadError.set(resolveApiErrorMessage(error, { default: 'Could not load your profile.' }));
        this.profileLoading.set(false);
      }
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.profileSaving.set(true);
    this.profileError.set(null);
    this.profileSuccess.set(false);

    const { displayName } = this.profileForm.getRawValue();

    this.profileService.updateProfile({ displayName }).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.authService.updateDisplayName(profile.displayName);
        this.profileSaving.set(false);
        this.profileSuccess.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.profileSaving.set(false);
        this.profileError.set(resolveApiErrorMessage(error, { default: 'Could not save your profile.' }));
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.passwordSaving.set(true);
    this.passwordError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.profileService.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.authService.logout();
        void this.router.navigate(['/login'], { queryParams: { passwordChanged: 'true' } });
      },
      error: (error: HttpErrorResponse) => {
        this.passwordSaving.set(false);
        this.passwordForm.patchValue({ currentPassword: '', newPassword: '', confirmPassword: '' });
        this.passwordError.set(
          resolveApiErrorMessage(error, { default: 'Could not change your password. Check your current password and try again.' })
        );
      }
    });
  }
}
