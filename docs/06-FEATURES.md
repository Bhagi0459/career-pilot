# 6. Features — What Was Built, and Why

Every feature below follows the same underlying pattern explained in
[03-BACKEND.md](./03-BACKEND.md) (Model → DTO → Controller) and
[05-FRONTEND.md](./05-FRONTEND.md) (Service → Signal → Component). This doc focuses on what each
feature *does* for the user and the specific decisions behind it, rather than repeating the
mechanics.

## Authentication (register, login, forgot/reset password)

**Files:** `Controllers/AuthController.cs`, `features/auth/*`, `core/services/auth.service.ts`.
Fully explained in [04-AUTHENTICATION.md](./04-AUTHENTICATION.md).

Every endpoint in `AuthController` — the only part of the API reachable without already being
logged in — shares a rate limit: 10 requests/minute per caller. See
[01-ARCHITECTURE.md](./01-ARCHITECTURE.md#rate-limiting-on-the-public-endpoints).

One deliberate design decision worth calling out: **registering does not log you in
automatically.** Early on it did — but that skips confirming the flow actually completed, and
means a typo'd password on signup gets silently "fixed" by immediately being logged in with the
mistyped one. Now, registering redirects to the login page with a "account created" confirmation
banner, requiring you to actually type the password you meant to set.

A second decision: the **"forgot my password" flow deliberately reveals nothing.** Whether or not
an email address has an account, the response is identical
("If an account exists for that email, we've sent a link..."), and it takes the same amount of
time either way. This prevents someone from using the forgot-password form to fish for which
emails are registered.

## Dashboard

**Files:** `features/dashboard/*`.

The landing page after login: total application count, a status breakdown (Applied /
Interviewing / Rejected / Offer) as both stat cards and a donut chart, the 5 most recent
applications, the next 5 upcoming interviews, and the next 5 upcoming follow-ups. Everything here
is **read-only and computed** — this page doesn't own any data itself, it pulls already-loaded
Signals from `ApplicationsService`, `InterviewsService`, and `FollowUpsService` and derives
everything else via `computed()` (see [05-FRONTEND.md](./05-FRONTEND.md) for exactly how the
chart segments are calculated).

## Companies & Recruiters

**Files:** `features/companies/*`, `features/recruiters/*`.

The simplest CRUD (Create/Read/Update/Delete) features in the app, and the best place to read the
Model → DTO → Controller → Service → Component pattern with the least noise. Recruiters
additionally store a **mobile number** (added after the fact — see the DB migration
`AddRecruiterPhoneNumber` — a good example of how a single new column gets threaded through every
layer: `Recruiter.cs` model → `RecruiterDtos.cs` → `RecruitersController.cs` mapping → TypeScript
`Recruiter` interface → the add/edit form → the list table column).

Deleting a Company is refused with `409 Conflict` while it still has any JobApplications or
Recruiters attached, rather than silently cascading the delete through everything that references
it — see the note on cascading deletes in [02-DATABASE.md](./02-DATABASE.md). The list page's
delete confirmation surfaces that message directly if the delete is rejected.

### The "quick add" pattern

Originally, adding a Job Application required the Company (and optionally Recruiter) to already
exist — if it didn't, you had to abandon the application form, go create the company on its own
page, then come back and start over. **`CompanyQuickAddComponent`** and
**`RecruiterQuickAddComponent`** fix this: they're small modal dialogs, opened from a "+ New
company" link right next to the dropdown, that create the record via the same
`CompaniesService`/`RecruitersService` used everywhere else, then immediately select the new
record in the form — without ever navigating away or losing what you'd already typed.

## Job Applications

**Files:** `features/applications/*`, `Controllers/JobApplicationsController.cs`.

The core resource everything else hangs off. Each application tracks a role, a status (Applied /
Interviewing / Rejected / Offer), the company, an optional recruiter, applied date, country,
notes, and — added for offer comparison — salary, work mode, decision deadline, and benefits.

### Offer Comparison

**Files:** `features/applications/offer-comparison/*`.

Once you have more than one application at the "Offer" stage, deciding between them by scrolling
a normal list is awkward — you want them side by side. This page filters to only Offer-status
applications and lays them out as a comparison table (each *column* is one offer, each *row* is
an attribute: salary, work mode, deadline, benefits, ...) sorted by soonest decision deadline
first, with offers lacking a deadline sinking to the bottom. It reuses the same
`ApplicationsService` data everyone else already has loaded — no separate backend endpoint was
needed, just a different client-side filter and layout.

### The Offer celebration

When saving an application flips its status *to* "Offer" for the first time (not on a later edit
of an application that was already an Offer — the component remembers the status it started at
and only celebrates on the actual transition), a brief confetti animation and toast play before
navigating back to the list. Small, but a deliberate example of turning a meaningful life event
in the app ("you got an offer!") into a moment, rather than treating every save identically.

## Interviews

**Files:** `features/interviews/*`, `Controllers/InterviewsController.cs`.

Each interview belongs to exactly one Job Application (a "round" — phone screen, technical,
onsite, etc. — with its own status and scheduled time), reachable both from its own list page and
summarized on the dashboard.

## Follow-ups

**Files:** `features/follow-ups/*`, `Controllers/FollowUpsController.cs`.

A lightweight reminder system: "check in with the recruiter," tied to a specific application, with
a due date and a done/not-done toggle. The list page computes each reminder's display status
client-side (`Pending` / `Overdue` / `Done`) by comparing the due date's *calendar day* — not the
exact timestamp — against today, so a reminder due "today" doesn't flip to "Overdue" the instant
a few hours pass; it stays Pending until the day is actually over.

## Settings

**Files:** `features/settings/*`, `Controllers/ProfileController.cs`.

Lets a logged-in user change their display name or password. Changing the password, as covered in
[04-AUTHENTICATION.md](./04-AUTHENTICATION.md), also revokes every other active session — a
security-hygiene decision, not an oversight.

## Theming (light/dark mode)

**Files:** `core/services/theme.service.ts`, `styles.scss` (`:root[data-theme='dark']` block),
`index.html`.

The whole app's color palette is defined once, as **CSS custom properties** (variables like
`--color-bg`, `--color-text`) in `styles.scss`. Every component's stylesheet references those
variables instead of hardcoding colors — which is *why* a full dark theme could be added later as
purely a second block of variable values, with zero changes needed in any individual component's
CSS. `ThemeService` just toggles a `data-theme="dark"` attribute on the page's root `<html>`
element; the CSS variable overrides do the rest.

One subtlety worth knowing: `index.html` has a small inline `<script>` that runs *before* Angular
loads and sets the correct theme attribute immediately, based on either a saved preference or the
OS's own light/dark setting. Without this, the page would render in the light theme for a
fraction of a second and then "flash" to dark once Angular's `ThemeService` catches up — a small
but very noticeable visual glitch that's easy to prevent by doing the check earlier, in plain
JavaScript, before any framework code runs at all.

## Row actions (Edit / Delete)

**Files:** every `*-list.component.html`, `offer-comparison.component.html`, `styles.scss`
(`.icon-btn-edit` / `.icon-btn-delete`).

Edit and Delete were originally two visually identical bordered buttons, told apart only by their
text label. Edit now carries a pencil icon in the accent color; Delete carries a trash icon in
red — a color-coded cue that one is a normal, reversible action and the other deserves a second's
thought before clicking. Both icons are `aria-hidden="true"`, since the visible text label is
still the accessible name for the button.

## Animation

Small, deliberately restrained motion is applied throughout: modal dialogs fade and scale in
rather than snapping into existence, list rows and dashboard cards stagger in on load, buttons
lift slightly on hover, and the dashboard's donut chart visibly "draws itself" on load (each
segment animates from zero to its real size) rather than just appearing fully formed. Two more
additions on top of that:

- **Stat cards count up.** `StatCardComponent` doesn't just print the number it's given — an
  `effect()` watches the `value` input and animates a local `displayValue` signal from whatever it
  last showed up to the new number over ~700ms with an eased curve, using `requestAnimationFrame`
  directly rather than any animation library. It replays every time the value actually changes,
  not just on first load.
- **Rows fade out on delete.** Deleting a row no longer just vanishes the instant the list
  refetches — the specific row gets a `row-leaving` class (opacity + slide transition) first, and
  the actual data refresh is deferred with a `setTimeout` matched to the CSS transition's duration,
  so the row visibly leaves before the list underneath it changes shape.

All of it respects the operating system's "reduce motion" accessibility setting globally — a
single CSS rule near the top of `styles.scss` catches every animation in the app and effectively
turns it off for anyone who's told their OS they're sensitive to motion, without needing to
remember that setting in each individual animation. The stat-card count-up additionally checks
`prefers-reduced-motion` directly in its own effect and jumps straight to the final value instead
of relying on the CSS-only blanket rule, since a `requestAnimationFrame` loop isn't something a
`transition-duration: 0.001ms` override can intercept.

Next: [07-DEPLOYMENT.md](./07-DEPLOYMENT.md) — how a change goes from your editor to the live
site.
