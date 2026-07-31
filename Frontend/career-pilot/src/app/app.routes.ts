import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent)
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { title: 'Dashboard' }
      },
      {
        path: 'applications',
        loadComponent: () =>
          import('./features/applications/application-list/application-list.component').then(
            (m) => m.ApplicationListComponent
          ),
        data: { title: 'Applications' }
      },
      {
        path: 'applications/new',
        loadComponent: () =>
          import('./features/applications/application-form/application-form.component').then(
            (m) => m.ApplicationFormComponent
          ),
        data: { title: 'Add Application' }
      },
      {
        path: 'applications/:id/edit',
        loadComponent: () =>
          import('./features/applications/application-form/application-form.component').then(
            (m) => m.ApplicationFormComponent
          ),
        data: { title: 'Edit Application' }
      },
      {
        path: 'companies',
        loadComponent: () =>
          import('./features/companies/company-list/company-list.component').then((m) => m.CompanyListComponent),
        data: { title: 'Companies' }
      },
      {
        path: 'companies/new',
        loadComponent: () =>
          import('./features/companies/company-form/company-form.component').then((m) => m.CompanyFormComponent),
        data: { title: 'Add Company' }
      },
      {
        path: 'companies/:id/edit',
        loadComponent: () =>
          import('./features/companies/company-form/company-form.component').then((m) => m.CompanyFormComponent),
        data: { title: 'Edit Company' }
      },
      {
        path: 'recruiters',
        loadComponent: () =>
          import('./features/recruiters/recruiter-list/recruiter-list.component').then(
            (m) => m.RecruiterListComponent
          ),
        data: { title: 'Recruiters' }
      },
      {
        path: 'recruiters/new',
        loadComponent: () =>
          import('./features/recruiters/recruiter-form/recruiter-form.component').then(
            (m) => m.RecruiterFormComponent
          ),
        data: { title: 'Add Recruiter' }
      },
      {
        path: 'recruiters/:id/edit',
        loadComponent: () =>
          import('./features/recruiters/recruiter-form/recruiter-form.component').then(
            (m) => m.RecruiterFormComponent
          ),
        data: { title: 'Edit Recruiter' }
      },
      {
        path: 'interviews',
        loadComponent: () =>
          import('./features/interviews/interview-list/interview-list.component').then(
            (m) => m.InterviewListComponent
          ),
        data: { title: 'Interviews' }
      },
      {
        path: 'interviews/new',
        loadComponent: () =>
          import('./features/interviews/interview-form/interview-form.component').then(
            (m) => m.InterviewFormComponent
          ),
        data: { title: 'Schedule Interview' }
      },
      {
        path: 'interviews/:id/edit',
        loadComponent: () =>
          import('./features/interviews/interview-form/interview-form.component').then(
            (m) => m.InterviewFormComponent
          ),
        data: { title: 'Edit Interview' }
      },
      {
        path: 'follow-ups',
        loadComponent: () =>
          import('./features/follow-ups/follow-up-list/follow-up-list.component').then(
            (m) => m.FollowUpListComponent
          ),
        data: { title: 'Follow-ups' }
      },
      {
        path: 'follow-ups/new',
        loadComponent: () =>
          import('./features/follow-ups/follow-up-form/follow-up-form.component').then(
            (m) => m.FollowUpFormComponent
          ),
        data: { title: 'Add Follow-up' }
      },
      {
        path: 'follow-ups/:id/edit',
        loadComponent: () =>
          import('./features/follow-ups/follow-up-form/follow-up-form.component').then(
            (m) => m.FollowUpFormComponent
          ),
        data: { title: 'Edit Follow-up' }
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent),
        data: { title: 'Settings' }
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
