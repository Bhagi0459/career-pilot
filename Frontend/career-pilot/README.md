# CareerPilot — Frontend

Angular frontend for [CareerPilot](../../README.md), a full-stack job application tracking platform.

**Live demo:** [career-pilot-brown.vercel.app](https://career-pilot-brown.vercel.app/)

## Features

- Dashboard overview of applications, interviews, follow-ups, and pipeline status
- Applications (with an Offer Comparison view), Companies, Recruiters, Interviews, and Follow-ups
  feature modules
- JWT-based authentication (with silent refresh) and account settings
- RxJS-driven search and filtering, Signals-based reactive state with computed values
- Light/dark theming and motion, both respecting the OS "reduce motion" setting

## Tech stack

- Angular 19 — Standalone Components, Signals, computed state
- RxJS
- Talks to the [CareerPilot API](../../Backend/CareerPilot.Api) (ASP.NET Core / .NET 10)

## Project structure

```
src/app/
  core/           # app-wide services, guards, interceptors
  shell/          # app shell / layout
  features/
    auth/         # login, registration, password reset
    dashboard/    # pipeline overview
    applications/ # job application tracking
    companies/
    recruiters/
    interviews/
    follow-ups/
    settings/
  shared/         # shared UI building blocks
```

## Getting started

```bash
npm install
npm start        # ng serve, http://localhost:4200
```

The app expects the [CareerPilot API](../../Backend/CareerPilot.Api) running locally (or configured via environment) for auth and data.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the Angular dev server |
| `npm run build` | Production build to `dist/` |
| `npm run watch` | Incremental dev build |
| `npm test` | Run unit tests (Karma/Jasmine) |

## Deployment

Deployed on Vercel; `vercel.json` rewrites all routes to `index.html` for client-side routing.
