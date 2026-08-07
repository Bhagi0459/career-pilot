# Glossary

Every piece of jargon used across these docs, defined in plain language. If a term links to
another doc, that's where it's explained in full depth with real code from this project.

---

**API (Application Programming Interface)** — A program that listens for requests and sends back
responses, so other programs (like this project's frontend) can ask it to do things or fetch
data. See [03-BACKEND.md](./03-BACKEND.md).

**Async / await** — A way of writing code that does something slow (like a database query or a
network request) without freezing the whole program while it waits. `await someSlowThing()` means
"pause *this* piece of code until it's done, but let other work happen in the meantime."

**bcrypt** — A slow, one-way hashing algorithm used specifically for passwords. See
[04-AUTHENTICATION.md](./04-AUTHENTICATION.md).

**CDN (Content Delivery Network)** — A network of servers around the world that serve copies of
static files (like this app's built frontend) from a location physically close to whoever's
requesting it, for speed. Vercel serves the frontend this way.

**Component (Angular)** — A self-contained unit of UI: a class (logic) + a template (HTML) + a
stylesheet. See [05-FRONTEND.md](./05-FRONTEND.md).

**`computed()`** — An Angular Signal whose value is automatically derived from other Signals, and
recalculates only when a Signal it actually depends on changes. See
[05-FRONTEND.md](./05-FRONTEND.md).

**Controller (ASP.NET Core)** — A C# class holding the methods that actually handle incoming API
requests for one resource (e.g. `CompaniesController`). See [03-BACKEND.md](./03-BACKEND.md).

**CORS (Cross-Origin Resource Sharing)** — A browser security rule that blocks a page on one
domain from calling an API on a different domain, unless that API explicitly allows it. See
[03-BACKEND.md](./03-BACKEND.md).

**CRUD** — Create, Read, Update, Delete — the four basic operations almost every resource in this
app supports (add a company, list companies, edit a company, delete a company).

**Dependency Injection (DI)** — A pattern where a class declares what it needs (e.g. "a database
connection") and a central container supplies it automatically, instead of the class constructing
it itself. Used on both the backend (`AppDbContext db` in a controller's constructor) and the
frontend (`inject(CompaniesService)`). See [03-BACKEND.md](./03-BACKEND.md) and
[05-FRONTEND.md](./05-FRONTEND.md).

**DTO (Data Transfer Object)** — A class shaped specifically for what gets sent over the network,
kept deliberately separate from the database model. See [03-BACKEND.md](./03-BACKEND.md).

**EF Core (Entity Framework Core)** — The library that lets C# code talk to the database by
working with ordinary classes/objects instead of writing raw SQL. See
[02-DATABASE.md](./02-DATABASE.md).

**`effect()`** — An Angular function that reruns a block of code whenever a Signal it reads
changes, used for side effects (like driving a manual animation) rather than producing a value a
template reads. See [05-FRONTEND.md](./05-FRONTEND.md).

**Endpoint** — One specific URL + HTTP method combination an API responds to, e.g.
`GET /api/companies`.

**Enum** — A type representing a fixed set of named values (e.g. `ApplicationStatus` can only be
`Applied`, `Interviewing`, `Rejected`, or `Offer` — never anything else).

**Foreign key** — A column in one database table that stores the ID of a row in another table,
creating a link between them (e.g. `Recruiter.CompanyId` points at a row in `Companies`). See
[02-DATABASE.md](./02-DATABASE.md).

**HTTP / HTTPS** — The protocol web browsers and APIs use to communicate; HTTPS is the encrypted
version. See [03-BACKEND.md](./03-BACKEND.md).

**Interceptor (Angular)** — A function every outgoing HTTP request and incoming response passes
through, used here to attach the login token to every request and to catch expired-session
errors. See [05-FRONTEND.md](./05-FRONTEND.md).

**IDOR (Insecure Direct Object Reference)** — A security vulnerability where an app lets one
user access another user's data just by guessing/changing an ID in a request. This project
defends against it by filtering every database query by the logged-in user's ID. See
[02-DATABASE.md](./02-DATABASE.md).

**JSON (JavaScript Object Notation)** — A text format for structured data, e.g.
`{ "name": "Acme Corp", "country": "USA" }`. Used for essentially every request/response body in
this app.

**JWT (JSON Web Token)** — A signed, self-contained token proving who's logged in, without the
server needing to look anything up to trust it. See [04-AUTHENTICATION.md](./04-AUTHENTICATION.md).

**LINQ (Language Integrated Query)** — C#'s built-in syntax for querying collections
(`.Where(...)`, `.Select(...)`), which EF Core translates into real SQL when used on a
`DbSet`.

**Migration (EF Core)** — A generated file describing one specific change to the database schema,
and the mechanism for applying that change to a real database. See
[02-DATABASE.md](./02-DATABASE.md).

**Model (backend)** — A C# class whose shape EF Core maps directly to a database table. See
[02-DATABASE.md](./02-DATABASE.md) and [03-BACKEND.md](./03-BACKEND.md).

**ORM (Object-Relational Mapper)** — A library (EF Core, here) that translates between database
rows and objects in a programming language, so you rarely write raw SQL by hand.

**Observable (RxJS)** — A stream of values over time that you `.subscribe()` to, used in this app
mainly for one-shot async operations like HTTP requests. Contrast with **Signal**. See
[05-FRONTEND.md](./05-FRONTEND.md).

**Primary key** — The column that uniquely identifies each row in a table (always `Id` in this
project's tables).

**Rate limiting** — Capping how many requests a single caller (identified here by IP address) can
make in a given time window, so a script can't hammer an endpoint thousands of times a second. This
project applies it to every unauthenticated endpoint (register, login, refresh, forgot/reset
password). See [01-ARCHITECTURE.md](./01-ARCHITECTURE.md#rate-limiting-on-the-public-endpoints).

**Reactive Forms (Angular)** — Angular's approach to forms where the form's state (values,
validity) lives in TypeScript, not scattered across the template. See
[05-FRONTEND.md](./05-FRONTEND.md).

**Refresh token** — A longer-lived, database-backed credential used to obtain new access tokens
without re-entering a password. See [04-AUTHENTICATION.md](./04-AUTHENTICATION.md).

**REST / RESTful API** — A common style for designing APIs around resources and standard HTTP
methods (`GET` to read, `POST` to create, `PUT` to update, `DELETE` to remove). This project's
backend follows this style throughout.

**Route guard (Angular)** — A function that runs before a route activates and can block/redirect
navigation — used here to keep logged-out users off protected pages. See
[04-AUTHENTICATION.md](./04-AUTHENTICATION.md).

**Service (Angular)** — A shared, injectable TypeScript class holding state and logic used across
multiple components — where this app's Signals and HTTP calls for each resource actually live.
See [05-FRONTEND.md](./05-FRONTEND.md).

**Signal (Angular)** — A wrapper around a value that automatically notifies anything reading it
whenever the value changes, keeping the screen in sync with data with no manual DOM updates. See
[05-FRONTEND.md](./05-FRONTEND.md) for the full explanation.

**SPA (Single Page Application)** — A web app, like this one, where the browser loads one HTML
page once and then JavaScript (Angular) swaps content in and out without full page reloads as you
navigate.

**SQL (Structured Query Language)** — The language relational databases like PostgreSQL actually
speak. EF Core generates SQL for you; you rarely write it directly in this project.

**Standalone component (Angular)** — A component that declares its own dependencies directly
(`imports: [...]`) rather than belonging to a shared `NgModule`. The style used throughout this
project. See [05-FRONTEND.md](./05-FRONTEND.md).

**Status code (HTTP)** — A number in every HTTP response indicating what happened: `200` success,
`401` not logged in, `404` not found, `500` server error, etc.

**TypeScript** — JavaScript with an added type system, catching a class of "wrong shape of data"
bugs before the code ever runs. What the entire Angular frontend is written in.
