# CareerPilot

Full-stack job application tracking platform — a single, secure place to see applications, recruiters, and interview stages at a glance, instead of scattered spreadsheets and notes.

**Live demo:** [career-pilot-brown.vercel.app](https://career-pilot-brown.vercel.app/)

**New to this codebase?** Start with [`docs/README.md`](docs/README.md) — a complete,
beginner-friendly blueprint covering the architecture, the database and every migration, the
backend request pattern, authentication (JWT + refresh tokens) from first principles, Angular
Signals explained in depth, every feature, and how deployment actually works.

## Overview

CareerPilot is a self-directed, production-grade project built end to end: an Angular frontend talking to a secured ASP.NET Core REST API, backed by PostgreSQL. It covers the full slice of a real product — authentication, password reset, automated tests, and a Dockerized deployment pipeline — rather than just CRUD screens.

## Features

- Track job applications, companies, recruiters, interview stages, and follow-up reminders in one
  dashboard
- Offer Comparison view once you have more than one application at the offer stage
- JWT-authenticated accounts (short-lived access token + rotating refresh token) with secure
  password-reset token flow, and rate limiting on every public auth endpoint
- RxJS-driven search and filtering across applications
- Signals-based reactive UI state with computed derived values
- Light/dark theming, motion that respects the OS "reduce motion" setting

## Tech stack

**Frontend** (`Frontend/career-pilot`)
- Angular 19 — Standalone Components, Signals, computed state
- RxJS-driven search pipeline

**Backend** (`Backend/CareerPilot.Api`)
- ASP.NET Core (.NET 10) REST API
- JWT authentication, BCrypt password hashing
- PostgreSQL via EF Core (Npgsql)
- Scalar for OpenAPI docs

**Testing**
- `Backend/CareerPilot.Api.Tests` — automated backend test suite
- 54 automated frontend/backend tests total, run manually with `dotnet test` / `ng test` — see
  [Deployment](docs/07-DEPLOYMENT.md) for why there's no CI gate running them automatically yet

**Deployment**
- Frontend on Vercel, API on Render (Dockerized), database on Neon (PostgreSQL)

## Project structure

```
Frontend/career-pilot/    # Angular app (see its own README for frontend setup)
Backend/
  CareerPilot.Api/        # ASP.NET Core REST API
    Controllers/          # Auth, JobApplications, Companies, Recruiters, Interviews, FollowUps, Profile
    Services/             # Token service, password-reset email senders
    Data/                 # EF Core DbContext
    Migrations/           # EF Core migrations
    Dtos/ Models/ Common/
    Dockerfile
  CareerPilot.Api.Tests/  # Backend test suite
```

## Getting started

### Backend

```bash
cd Backend/CareerPilot.Api
dotnet restore
```

Configure `appsettings.Development.json` (or user-secrets) with:

```json
{
  "ConnectionStrings": { "DefaultConnection": "<postgres-connection-string>" },
  "Jwt": { "Key": "<signing-key>", "Issuer": "CareerPilot.Api", "Audience": "CareerPilot.Client" },
  "Cors": { "AllowedOrigins": ["http://localhost:4200"] }
}
```

```bash
dotnet ef database update
dotnet run
```

### Frontend

See [`Frontend/career-pilot/README.md`](Frontend/career-pilot/README.md).

## Testing

```bash
cd Backend/CareerPilot.Api.Tests
dotnet test
```
