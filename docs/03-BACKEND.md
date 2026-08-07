# 3. Backend — ASP.NET Core From the Ground Up

## First: what is an API, really?

If you're new to backend development, start here. An **API** (Application Programming Interface)
in a web context is just a program that sits and listens for **HTTP requests** and sends back
**HTTP responses**. HTTP is the same protocol your browser uses to load any web page — a request
has a **method** (`GET` to fetch something, `POST` to create something, `PUT` to update
something, `DELETE` to remove something), a **URL** (which resource you want, e.g.
`/api/companies/17`), optionally a **body** (data you're sending, usually as **JSON** — a
text format for structured data that looks like `{ "name": "Acme Corp", "country": "USA" }`), and
some **headers** (metadata, like "here's my login token" or "the body is JSON").

The response has a **status code** (a number telling you what happened — `200` means success,
`401` means "you're not logged in", `404` means "that doesn't exist", `500` means "the server
broke") and usually a JSON body too.

CareerPilot's backend is one such program: it listens on a port, and for every request that
matches a known URL pattern, it runs some C# code and sends back JSON. That's the entire job of
everything in `Backend/CareerPilot.Api/Controllers/`.

## `Program.cs` — where the app is assembled at startup

Every ASP.NET Core app has one file that runs first and wires everything else together. Reading
it top to bottom tells you almost everything about how the app is configured, so let's go through
it in the order it actually executes.

```csharp
var builder = WebApplication.CreateBuilder(args);
```
This creates a "builder" object — think of it as a shopping list you fill in before the app
actually starts. Nothing is running yet.

```csharp
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(...);
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
```
This reads the database connection string (see [02-DATABASE.md](./02-DATABASE.md)) and registers
`AppDbContext` — the EF Core class that represents "a connection to the database" — with
**dependency injection**.

### What is dependency injection, in one paragraph?

Instead of a controller creating its own database connection with `new AppDbContext(...)`
inside itself, it just declares "I need an `AppDbContext`" and the framework hands it one
automatically. This is **Dependency Injection (DI)**: a central container (`builder.Services`)
knows how to construct every registered "service," and any class can just ask for one in its
constructor instead of knowing how to build it. The benefit: a controller doesn't need to know
*how* to build a database connection or a token service — it just declares what it needs, and
testing becomes much easier too (you can hand a controller a fake `AppDbContext` in a test
without changing the controller's code at all).

You'll see this pattern constantly in this codebase:

```csharp
public class CompaniesController(AppDbContext db) : ControllerBase
```

That `(AppDbContext db)` right after the class name is a C# 12 shorthand called a **primary
constructor** — it's exactly equivalent to writing a normal constructor that saves `db` into a
private field. DI sees that `CompaniesController` needs an `AppDbContext` and supplies one
automatically every time a request comes in for this controller.

```csharp
builder.Services.AddSingleton<ITokenService, TokenService>();
```
This registers `TokenService` (which creates JWT tokens — see
[04-AUTHENTICATION.md](./04-AUTHENTICATION.md)) so anything that asks for `ITokenService` gets a
`TokenService` instance. `AddSingleton` means: create exactly *one* instance and reuse it for the
whole life of the app (as opposed to `AddScoped`, which creates a new one per request — that's
what `AppDbContext` uses, since you don't want two unrelated requests sharing one database
connection).

```csharp
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddScoped<IPasswordResetEmailSender, DevLoggingPasswordResetEmailSender>();
}
else if (smtpConfigured)
{
    builder.Services.AddScoped<IPasswordResetEmailSender, SmtpPasswordResetEmailSender>();
}
else
{
    builder.Services.AddScoped<IPasswordResetEmailSender, UnconfiguredPasswordResetEmailSender>();
}
```
This is a nice example of DI's real power: `IPasswordResetEmailSender` is an **interface** — a
contract saying "something with a `SendAsync(email, resetUrl)` method" — and *which actual class*
implements it is decided here, based on environment. Locally, "sending" an email just logs it to
the console (`DevLoggingPasswordResetEmailSender`), so you can test the password-reset flow
without a real mail server. In production, it actually sends via SMTP. The `AuthController` that
uses this service doesn't know or care which one it got — it just calls
`resetEmailSender.SendAsync(...)`.

```csharp
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* ... */ });
```
This configures how the app validates JWT tokens on incoming requests. Fully explained in
[04-AUTHENTICATION.md](./04-AUTHENTICATION.md).

```csharp
builder.Services.AddCors(options => { /* ... */ });
```
**CORS** (Cross-Origin Resource Sharing) is a browser security feature: by default, a page loaded
from `vercel.app` is *not allowed* to make requests to `onrender.com` — different "origins."
This code explicitly tells the backend "requests from this specific frontend URL are allowed,"
which the browser checks before letting the request through.

```csharp
builder.Services.AddRateLimiter(options => { /* ... */ });
```
Registers a fixed-window rate limiter, applied to `AuthController` via `[EnableRateLimiting("auth")]`
on the class. See [01-ARCHITECTURE.md](./01-ARCHITECTURE.md#rate-limiting-on-the-public-endpoints)
for *why* — this is the *how*. The interesting detail: the permit count and window length are read
from `IConfiguration` **inside** the policy factory lambda (which runs per request), not captured
into a local variable up here at startup. That's deliberate, not an accident — a value captured at
startup is fixed before `WebApplicationFactory` (used by the test project) finishes layering in
its own configuration overrides, so a test-specific limit would silently never take effect. Reading
it lazily, per request, means both the real app (`appsettings.json`'s default of 10/minute) and the
test suite (which dials the limit down to something a test can deliberately exceed) see the value
that's actually meant for them.

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
```
Registers controller support, and configures C# `enum` values (like `ApplicationStatus.Applied`)
to be sent as the readable string `"Applied"` in JSON instead of the raw number `0`.

```csharp
var app = builder.Build();
```
This is the moment the "shopping list" becomes an actual running app object. Everything below this
line configures the **middleware pipeline** — a chain of steps every request passes through, in
order, before reaching your controller code (and again, in reverse, on the way out).

```csharp
app.UseForwardedHeaders(forwardedHeadersOptions);
```
Render terminates HTTPS at its own edge and forwards plain HTTP to the container. Without this,
the app can't tell a request was originally secure, and the next line would create an infinite
redirect loop.

```csharp
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
```
A tiny, unauthenticated endpoint Render calls automatically to check "is this container alive?"

```csharp
app.UseExceptionHandler(errorApp => { /* ... */ });
```
A safety net: if any controller code throws an unhandled exception, this catches it and returns a
clean `500` response instead of crashing the whole app or leaking a stack trace to the client.

```csharp
app.UseCors("AllowAngular");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```
The order here matters a lot: CORS is checked first, then "who are you?" (`Authentication` —
decode and validate the JWT), then "are you allowed to do this?" (`Authorization` — check
`[Authorize]` attributes), and finally the request is routed to the matching controller method.

```csharp
app.Run();
```
Starts the app listening for real requests. Everything above this line was setup; this line
blocks and keeps the process alive.

## The Model → DTO → Controller pattern

This is the core shape every feature in this backend follows. Let's trace it for **Company**,
end to end, since it's the simplest example.

### 1. The Model — what the database looks like

```csharp
// Models/Company.cs
public class Company
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Country { get; set; }
    public string? Website { get; set; }
    public string? Notes { get; set; }
}
```
This class exists purely to describe the database table (see
[02-DATABASE.md](./02-DATABASE.md)). It's *not* what gets sent to the frontend.

### 2. The DTO — what actually goes over the wire

**DTO** stands for **Data Transfer Object**. It's a separate, deliberately simpler class that
represents exactly what a specific API response (or request) should look like:

```csharp
// Dtos/CompanyDtos.cs
public record CompanyDto(int Id, string Name, string? Country, string? Website, string? Notes);

public sealed class CompanyUpsertRequest
{
    [Required, MaxLength(200)]
    public string Name { get; init; } = string.Empty;
    public string? Country { get; init; }
    public string? Website { get; init; }
    public string? Notes { get; init; }
}
```

**Why not just send the `Company` model directly?** Three real reasons:

1. **You'd leak data you never meant to expose.** `Company` doesn't have secrets today, but
   `User` does (`PasswordHash`) — if a controller ever accidentally returned the raw `User` model
   instead of a `ProfileResponse` DTO, the password hash would go straight to the browser. DTOs
   make "what does the client actually see" an explicit, reviewable decision, not an accident of
   what columns happen to exist.
2. **The shape you want to *receive* is often different from what you *store*.** Notice
   `CompanyUpsertRequest` has no `Id` and no `UserId` — the client shouldn't be allowed to choose
   which user a company belongs to (that comes from their login token, server-side) or overwrite
   an arbitrary ID.
3. **Validation lives on the request DTO.** `[Required]` and `[MaxLength(200)]` are data
   annotations — ASP.NET Core automatically checks these before your controller method body even
   runs, and rejects the request with a `400 Bad Request` if they fail. This keeps validation
   rules next to the shape they validate, separate from the database model.

`record` vs `class`: `CompanyDto` is declared as a `record` — a C# feature for simple,
immutable data holders. Once created, a `record`'s properties can't be changed, which fits a
"this is a snapshot of data to send out" DTO perfectly. `CompanyUpsertRequest` is a `class`
because ASP.NET Core's model-binding (turning incoming JSON into a C# object) needs settable
properties (`init` still allows setting once, during construction from JSON).

### 3. The Controller — the actual endpoints

```csharp
[ApiController]
[Route("api/companies")]
[Authorize]
public class CompaniesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<CompanyDto>>> GetAll(
        [FromQuery] string? search, [FromQuery] string? sort,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        var query = db.Companies.Where(c => c.UserId == userId);
        // ... search/sort/paging ...
        var items = await query.Select(c => ToDto(c)).ToListAsync();
        return Ok(new PagedResult<CompanyDto>(items, totalCount, page, pageSize));
    }
    // ... GetById, Create, Update, Delete follow the same shape ...
}
```

Reading the attributes from top to bottom:

- `[ApiController]` — turns on a bundle of sensible defaults (automatic `400` on invalid model
  state, requiring `[FromBody]`/`[FromQuery]` to be explicit, etc.).
- `[Route("api/companies")]` — every method in this class handles a URL starting with
  `/api/companies`.
- `[Authorize]` — **every** endpoint in this controller requires a valid, logged-in user. Without
  a valid JWT in the `Authorization` header, ASP.NET Core rejects the request with `401` before
  your code ever runs.
- `[HttpGet]` on the method — this specific method handles `GET` requests to the class's route
  (so, `GET /api/companies`).
- `async Task<...>` — this method is **asynchronous**. Talking to a database over the network
  takes time (milliseconds, but still time); `async`/`await` lets the server handle *other*
  requests while waiting for the database to respond, instead of freezing that thread. This is
  why almost every database call in this codebase is `await`ed.
- `User.GetUserId()` — a small extension method (in `Common/ClaimsPrincipalExtensions.cs`) that
  pulls the user's ID out of the already-validated JWT. This is the *only* source of truth for
  "who is making this request" — never trust an ID the client sends in the request body itself.
- `db.Companies.Where(c => c.UserId == userId)` — this is **LINQ** (Language Integrated Query), C#'s
  built-in syntax for querying collections, which EF Core translates into real SQL. This single
  line is what enforces the "you can only see your own data" rule described in
  [02-DATABASE.md](./02-DATABASE.md).

## Common code, shared across controllers

A few small files pull weight across the whole backend and are worth knowing by name:

- **`Common/ClaimsPrincipalExtensions.cs`** — `User.GetUserId()`, used in every authenticated
  controller.
- **`Dtos/PagedResult.cs`** — a generic `record PagedResult<T>(IReadOnlyList<T> Items, int
  TotalCount, int Page, int PageSize)` used by every list endpoint, so the frontend always gets
  pagination info in the same shape regardless of what it's listing.
- **`Services/TokenService.cs`** and **`Services/*PasswordResetEmailSender.cs`** — the "things
  that aren't really about one specific resource" logic, injected via DI as described above.

## Backend tests

`Backend/CareerPilot.Api.Tests/` holds automated tests that spin up the whole app in-memory
(via `WebApplicationFactory`) and fire real HTTP requests at it — testing things like "does
`/api/profile` ever leak a password hash?", "can user A read user B's data?", "does refresh-token
reuse actually revoke every session?", and "does the rate limiter actually reject the 11th request
in a window?" These run with `dotnet test` and are meant to catch regressions in exactly the
security patterns described above, automatically, on every change.

- **`CorsTests.cs`, `PasswordResetTests.cs`, `ProfileAndPasswordTests.cs`** — the original suite:
  CORS policy behavior, the full forgot/reset-password token lifecycle, and profile/password
  changes never leaking a hash or affecting another user's account.
- **`OwnershipTests.cs`** — registers two users and proves, for every resource (Company, Recruiter,
  JobApplication, Interview, FollowUp), that user B gets `404 Not Found` — not a data leak, not a
  `403` that would at least confirm the row exists — when trying to read, edit, or delete something
  that belongs to user A. Also covers the `409 Conflict` a Company delete returns once it has
  applications or recruiters attached (see [02-DATABASE.md](./02-DATABASE.md)).
- **`RefreshTokenTests.cs`** — covers the refresh-token rotation and reuse-detection logic
  described in [04-AUTHENTICATION.md](./04-AUTHENTICATION.md): a stolen-and-replayed refresh token
  correctly nukes every other active session for that user, not just itself.
- **`RateLimitingTests.cs`** — spins up a second `WebApplicationFactory` with the auth rate limit
  dialed down to 3 requests/minute (via in-memory configuration, not an environment variable — see
  the comment on `LowAuthRateLimitWebApplicationFactory` for why that distinction matters) and
  proves the 4th request in a window actually comes back `429`.

Next: [04-AUTHENTICATION.md](./04-AUTHENTICATION.md) — how login, JWTs, and refresh tokens
actually work, from zero.
