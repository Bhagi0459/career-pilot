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
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'applications',
        loadComponent: () =>
          import('./features/applications/application-list/application-list.component').then(
            (m) => m.ApplicationListComponent
          )
      },
      {
        path: 'applications/new',
        loadComponent: () =>
          import('./features/applications/application-form/application-form.component').then(
            (m) => m.ApplicationFormComponent
          )
      },
      {
        path: 'applications/:id/edit',
        loadComponent: () =>
          import('./features/applications/application-form/application-form.component').then(
            (m) => m.ApplicationFormComponent
          )
      },
      {
        path: 'companies',
        loadComponent: () =>
          import('./features/companies/company-list/company-list.component').then((m) => m.CompanyListComponent)
      },
      {
        path: 'companies/new',
        loadComponent: () =>
          import('./features/companies/company-form/company-form.component').then((m) => m.CompanyFormComponent)
      },
      {
        path: 'companies/:id/edit',
        loadComponent: () =>
          import('./features/companies/company-form/company-form.component').then((m) => m.CompanyFormComponent)
      },
      {
        path: 'recruiters',
        loadComponent: () =>
          import('./features/recruiters/recruiter-list/recruiter-list.component').then(
            (m) => m.RecruiterListComponent
          )
      },
      {
        path: 'recruiters/new',
        loadComponent: () =>
          import('./features/recruiters/recruiter-form/recruiter-form.component').then(
            (m) => m.RecruiterFormComponent
          )
      },
      {
        path: 'recruiters/:id/edit',
        loadComponent: () =>
          import('./features/recruiters/recruiter-form/recruiter-form.component').then(
            (m) => m.RecruiterFormComponent
          )
      },
      {
        path: 'interviews',
        loadComponent: () =>
          import('./features/interviews/interview-list/interview-list.component').then(
            (m) => m.InterviewListComponent
          )
      },
      {
        path: 'interviews/new',
        loadComponent: () =>
          import('./features/interviews/interview-form/interview-form.component').then(
            (m) => m.InterviewFormComponent
          )
      },
      {
        path: 'interviews/:id/edit',
        loadComponent: () =>
          import('./features/interviews/interview-form/interview-form.component').then(
            (m) => m.InterviewFormComponent
          )
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
