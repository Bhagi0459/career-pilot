# 5. Frontend — Angular From the Ground Up (Signals Explained in Depth)

## First: what is Angular, and what is a "component"?

Angular is a framework for building the part of a web app that runs in the browser. Its core
building block is a **component**: a self-contained unit made of three files working together —

- a **TypeScript class** (the logic — data and behavior),
- an **HTML template** (what gets drawn on screen), and
- a **CSS/SCSS stylesheet** (how it looks) — scoped so styles don't leak and affect unrelated
  components.

```typescript
// features/companies/company-list/company-list.component.ts
@Component({
  selector: 'app-company-list',
  standalone: true,
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.scss'
})
export class CompanyListComponent { /* ... */ }
```

The `@Component` **decorator** (a TypeScript feature — metadata attached to a class) tells
Angular "this class is a component; here's its template, its styles, and the HTML tag
(`selector`) that instantiates it." Wherever `<app-company-list></app-company-list>` appears in
another template, Angular creates one of these.

**"Standalone"** components (`standalone: true`) are this project's style throughout, and are the
modern Angular default since Angular 15+/19. Older Angular apps grouped components into
`NgModule`s — a middle layer of "which components/services are available together." Standalone
components skip that entirely: each component just lists exactly what it needs
(`imports: [ReactiveFormsModule, RouterLink, ...]`) directly on itself. Simpler to reason about,
and it's why every `@Component` in this codebase has an `imports` array.

## Dependency Injection, again — but on the frontend

Just like the backend (see [03-BACKEND.md](./03-BACKEND.md)), Angular has its own DI container.
A component or service can ask for something it needs without knowing how to construct it:

```typescript
export class CompanyListComponent {
  private readonly companiesService = inject(CompaniesService);
}
```

`inject()` is the modern way to do this (an older style used constructor parameters instead —
you may see `constructor(private http: HttpClient) {}` in tutorials; `inject()` does the same
job, just callable anywhere, not only in a constructor). Any class marked `@Injectable({
providedIn: 'root' })` — every *service* in this codebase — becomes available to `inject()`
anywhere, as one shared instance for the whole app.

## Signals — the central concept of modern Angular

This is the part you specifically asked to understand deeply, so let's build it up from the
actual problem it solves.

### The problem: keeping the screen in sync with data

Say you have a number stored somewhere, and three different places on screen need to display it
(and stay correct if it changes). The old, manual way: whenever the number changes, you'd have to
remember to go find every place displaying it and update the DOM by hand. That's exactly the kind
of bookkeeping bugs come from — you forget one spot, and now the screen is showing stale data.

Frameworks exist largely to solve this "keep the UI in sync with data automatically" problem.
Angular's modern answer, introduced in Angular 16/17 and used throughout this codebase, is
**Signals**.

### What a Signal actually is

A **Signal** is a wrapper around a value that:

1. Lets you **read** the current value by calling it like a function: `mySignal()`.
2. Lets you **write** a new value: `mySignal.set(newValue)` or
   `mySignal.update(old => old + 1)`.
3. **Automatically notifies anything that read it** whenever the value changes, so those things
   can re-run/re-render without you writing any manual "now update the DOM" code.

```typescript
import { signal } from '@angular/core';

readonly totalCount = signal(0);

// reading it:
console.log(this.totalCount()); // 0

// writing it:
this.totalCount.set(5);
this.totalCount.update((current) => current + 1); // now 6
```

The critical difference from a plain variable (`let totalCount = 0`) is point 3: a plain variable
has no way to tell anything "hey, I changed." A Signal does. If a template does
`{{ totalCount() }}`, Angular's rendering system automatically tracks that this piece of the DOM
*read* `totalCount`, and re-renders **only that piece** whenever `totalCount` changes — nothing
else on the page re-renders, and you never wrote a line of "update the DOM" code yourself.

### Real example from this codebase

```typescript
// core/services/auth.service.ts
private readonly auth = signal<StoredAuth | null>(readFromStorage());

readonly currentUserEmail = computed(() => this.auth()?.email ?? null);
readonly isAuthenticated = computed(() => this.auth() !== null);
```

`auth` is a private signal holding "the current logged-in session, or null." Anywhere in the app
that shows the user's email, or needs to know "is someone logged in," reads
`currentUserEmail()` / `isAuthenticated()`. The moment `login()` or `logout()` calls
`this.auth.set(...)`, every template anywhere in the app that reads those derived values updates
itself, automatically, with zero manual wiring.

### `computed()` — values derived from other Signals

`computed()` creates a **read-only** Signal whose value is calculated *from* other Signals, and —
this is the important part — **automatically recalculates only when one of the Signals it
actually reads changes**, and is smart enough to skip recalculating and skip notifying anything
downstream if the *value* doesn't actually change.

```typescript
// features/dashboard/dashboard.component.ts
readonly applications = this.applicationsService.allApplications; // a Signal<JobApplication[]>

readonly totalCount = computed(() => this.applications().length);
readonly appliedCount = computed(() => this.countByStatus('Applied'));
readonly offerCount = computed(() => this.countByStatus('Offer'));

readonly chartSegments = computed<ChartSegment[]>(() => {
  const total = this.totalCount();
  if (total === 0) return [];
  // ... build the donut chart's segments from appliedCount(), offerCount(), etc ...
});
```

Nobody ever tells `totalCount` or `chartSegments` to "update." Angular watches which Signals a
`computed()` reads *the first time it runs*, and treats those as its dependencies from then on.
When `applications` changes (a new application gets added), `totalCount` recalculates
automatically because it read `applications()`; `chartSegments` recalculates because it read
`totalCount()` (transitively depending on `applications` too); anything in the dashboard's HTML
template that reads `chartSegments()` re-renders. One `set()` call, and the entire dependency
chain updates itself correctly, in the right order, automatically. This is the single biggest
reason Signals-based code tends to have far fewer "the screen shows stale data" bugs than manual
state management.

**Why `computed()` instead of just a method** (`getTotalCount() { return this.applications().length; }`)? A
method re-runs its *entire body* every single time it's called, no matter what. A `computed()`
caches its result and only recalculates when a dependency actually changed — call
`totalCount()` a hundred times in a row with nothing changing, and it only computes once.

### Where Signals come from in this app: `signal()`, `computed()`, `toSignal()`, and `effect()`

You'll see four ways a Signal gets created or reacted to in this codebase:

1. **`signal(initialValue)`** — a plain, writable Signal you manually `set()`/`update()`. Used
   for local component state like `saving = signal(false)` or `showCompanyModal = signal(false)`.
2. **`computed(() => ...)`** — a read-only, derived Signal, as above.
3. **`toSignal(someObservable, { initialValue })`** — converts an RxJS **Observable** (see next
   section) into a Signal. Example:
   ```typescript
   // features/applications/application-form/application-form.component.ts
   readonly selectedCompanyId = toSignal(this.form.controls.companyId.valueChanges, {
     initialValue: this.form.controls.companyId.value
   });
   ```
   Angular's reactive forms emit changes as an Observable stream (`valueChanges`). `toSignal()`
   bridges that stream into a Signal so the rest of the component — which is written in the
   Signals style — can read `selectedCompanyId()` like any other Signal, and any `computed()`
   built on top of it (like `filteredRecruiters` in that same file) updates automatically too.
4. **`effect(() => ...)`** — runs a side effect whenever a Signal it reads changes, rather than
   producing a new Signal itself. Unlike `computed()`, an effect doesn't return a value the
   template can read — it's for reacting to a change by *doing* something (starting an animation,
   logging, syncing to `localStorage`). The one example in this codebase,
   `StatCardComponent`, uses an `effect()` that watches its `value` input and kicks off a
   `requestAnimationFrame` loop counting up to the new number whenever it changes — the animation
   itself lives outside the Signal graph (raw DOM/timing APIs), so `effect()` is the deliberate
   escape hatch for that, rather than trying to force it into a `computed()`.

## Signals vs. RxJS Observables — when this codebase uses which

Angular has *two* reactive systems in active use here, and it's worth being clear on the
difference instead of treating them as interchangeable:

| | **Signal** | **RxJS Observable** |
|---|---|---|
| Holds | One current value, always readable synchronously | A *stream* of values over time — may emit many times, or never, or asynchronously |
| Read by | Calling it: `mySignal()` | *Subscribing* to it: `.subscribe(value => ...)` |
| Used in this app for | UI state: what's currently true right now (loading? which item is selected? what's the current list?) | One-shot async operations: an HTTP request, which either succeeds once or fails once |

Concretely: every HTTP call in this app (`this.http.get<Company[]>(url)`) returns an
**Observable**, because "make a network request" is inherently a one-time async operation with a
result that arrives later. But once that data arrives, it's almost always immediately stored into
a **Signal** so the rest of the app can read it synchronously and reactively from then on:

```typescript
// features/companies/companies.service.ts
private readonly companiesSignal = signal<Company[]>([]);
readonly companies = this.companiesSignal.asReadonly();

load(): void {
  this.http.get<Company[]>(`${this.baseUrl}/all`).subscribe({
    next: (companies) => this.companiesSignal.set(companies),
    error: () => { /* ... */ }
  });
}
```

`.asReadonly()` is worth calling out: it exposes the Signal to the rest of the app so components
can *read* it, but hides the `.set()`/`.update()` methods — only this service can change the
data, everything else can only observe it. This is a deliberate, common pattern: keep mutation
centralized in the service that owns the data.

## Services — where shared state and HTTP calls live

A **service** is a plain TypeScript class registered with `@Injectable({ providedIn: 'root' })`,
meaning Angular creates exactly one instance and shares it everywhere. This project puts one
service per feature (`CompaniesService`, `RecruitersService`, `ApplicationsService`,
`FollowUpsService`, ...), and each follows the same shape:

- A private, writable Signal holding the current data (`companiesSignal`).
- A public, read-only version of it (`companies = companiesSignal.asReadonly()`).
- Methods that call `HttpClient` and update the Signal when a response comes back
  (`load()`, `create()`, `update()`, `delete()`).

Components never call `HttpClient` directly — they inject the relevant service and call its
methods. This keeps "how do we talk to the backend" in one place per resource, and means every
component displaying companies automatically sees the same, single, shared list.

## Routing

`app.routes.ts` maps URLs to components:

```typescript
{
  path: 'companies',
  loadComponent: () => import('./features/companies/company-list/company-list.component')
    .then((m) => m.CompanyListComponent),
  data: { title: 'Companies' }
}
```

`loadComponent` with a dynamic `import()` is **lazy loading** — the code for `CompanyListComponent`
isn't downloaded by the browser until the user actually navigates to `/companies`. This keeps the
initial page load fast, since the browser only fetches the code for the page you're actually on,
not the whole app up front.

`authGuard` (see [04-AUTHENTICATION.md](./04-AUTHENTICATION.md)) is attached to the parent route
that wraps every logged-in page, so unauthenticated users get redirected before any protected
component ever loads.

## Reactive Forms

Every add/edit screen (`application-form`, `company-form`, ...) uses Angular's **Reactive
Forms** — the form's state lives in TypeScript, not scattered across template attributes:

```typescript
readonly form = this.fb.nonNullable.group({
  roleTitle: ['', [Validators.required, Validators.maxLength(200)]],
  status: ['Applied' as ApplicationStatus, [Validators.required]],
  companyId: [0, [Validators.required, Validators.min(1)]]
});
```

`FormBuilder.group()` creates a `FormGroup` — one `FormControl` per field, each with its current
value, validity, and "has the user touched this yet" state built in. The template binds to it
with `[formGroup]="form"` and `formControlName="roleTitle"`, and Angular keeps the two in sync
both ways: typing in the input updates `form.controls.roleTitle.value`, and calling
`form.patchValue({...})` (used when loading an existing record to edit) updates the input on
screen.

`.nonNullable` means every control's value is typed as non-null TypeScript-side (an empty text
field is `''`, never `null`), which avoids a whole category of "is this null or not" bugs when
reading the form's values later.

## HTTP Interceptors

An **interceptor** is a function that every outgoing HTTP request (and every incoming response)
passes through, registered once for the whole app:

```typescript
// app.config.ts
provideHttpClient(withInterceptors([authInterceptor, errorInterceptor]))
```

- **`authInterceptor`** attaches the current access token to every request's `Authorization`
  header — so no individual service has to remember to do this itself.
- **`errorInterceptor`** watches every response for a `401`, and — as detailed in
  [04-AUTHENTICATION.md](./04-AUTHENTICATION.md) — silently refreshes the session and retries the
  request rather than immediately logging the user out.

## Tying it all together: one component, fully traced

`CompanyListComponent`, end to end:

1. **Injects** `CompaniesService` via `inject()`.
2. In its constructor, calls `this.companiesService.search({...})`, which fires an HTTP `GET`
   through `authInterceptor` (attaches the token) to the backend.
3. The response is a `PagedResult<Company>`; the component stores it in a local `signal`
   (`result = signal<PagedResult<Company>>(EMPTY_RESULT)`).
4. The template (`company-list.component.html`) reads `result().items` inside an `@for` block to
   render one `<tr>` per company, and reads `loading()` / `error()` Signals to conditionally show
   a spinner or an error banner instead — all declarative, no manual DOM manipulation.
5. Typing in the search box updates a `FormControl`, whose `valueChanges` Observable is piped
   through `debounceTime(300)` (wait 300ms after the user stops typing) before triggering a new
   search — this avoids firing a network request on every single keystroke.
6. Clicking "Delete" opens `<app-confirm-dialog>` (a small reusable component), and only on
   confirmation does the component call `companiesService.delete(id)`, which fires the `DELETE`
   request and, on success, updates the shared `companiesSignal` — so if the company also appears
   in a dropdown somewhere else in the app right now, it disappears from there too, automatically.

Next: [06-FEATURES.md](./06-FEATURES.md) — every feature in the app, mapped to the files that
implement it.
