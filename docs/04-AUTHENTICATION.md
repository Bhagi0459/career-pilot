# 4. Authentication — From Zero to Refresh Tokens

Authentication is "how does the server know who you are, on every single request, without
asking for your password every time?" This is one of the most conceptually loaded parts of the
whole app, so this doc goes slower than the others.

## Step 1: Passwords are never stored as plain text

When you register, the backend does **not** save your password anywhere. It runs it through
**bcrypt**, a one-way **hashing** function:

```csharp
PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
```

A hash function takes an input and produces a fixed-length scrambled output that is
(practically) impossible to reverse — you can't take the hash and recover the original password.
What you *can* do is take a password someone types in later and hash it the same way, then
compare the two hashes:

```csharp
if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash)) { /* wrong password */ }
```

So even if the entire database leaked, an attacker would get a list of hashes, not passwords.
Bcrypt specifically is deliberately *slow* (by design, tunable) — this matters because it makes
brute-force guessing (trying millions of passwords per second) impractical, unlike a fast hash
like plain SHA-256.

## Step 2: What is a JWT?

A **JWT** (JSON Web Token, pronounced "jot") is a signed, self-contained string that proves "the
server issued this, and it says user #12 is logged in, and it expires at this time." It looks
like three chunks of base64 text separated by dots:

```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMiIsImVtYWlsIjoiLi4uIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
      ↑ header                    ↑ payload (claims)                    ↑ signature
```

The middle chunk (the **payload**, or **claims**) is just base64-encoded JSON — anyone can
decode and read it, it is **not encrypted**. In this project, it holds:

```json
{ "sub": "12", "email": "you@example.com", "jti": "a-random-guid", "exp": 1785509139 }
```

- `sub` (subject) — the user's ID.
- `email` — for convenience.
- `jti` (JWT ID) — a random unique ID for this specific token.
- `exp` — an expiry timestamp. After this moment, the token is invalid, full stop.

The **signature** (the third chunk) is what makes this trustworthy. The server signs the header +
payload using a secret key (`Jwt:Key` — a long random string, never shared with the client) via
HMAC-SHA256. Anyone can *read* a JWT's payload, but only someone who knows the secret key can
produce a signature that matches — so if a client tampered with the payload (e.g., changed
`"sub": "12"` to `"sub": "999"` to impersonate another user), the signature would no longer match
and the server would reject the token instantly. This is what
`ValidateIssuerSigningKey = true` (in `Program.cs`'s JWT setup) checks on every single request.

**The critical property this gives you:** the server doesn't need to look anything up in a
database to know "is this a legitimate, unmodified token issued by me?" — it just re-computes the
signature and compares. That's what makes JWTs fast: authentication doesn't cost a database
query on every request, only a fast cryptographic check.

## Step 3: Login, end to end

```csharp
[HttpPost("login")]
public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
{
    var user = await db.Users.SingleOrDefaultAsync(u => u.Email == normalizedEmail);
    if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        return Unauthorized(new { message = "Invalid email or password." });

    var (token, expiresAt) = tokenService.CreateToken(user);
    var refreshToken = await IssueRefreshTokenAsync(user);
    return Ok(new AuthResponse(token, refreshToken, user.Email, user.DisplayName, expiresAt));
}
```

Notice the response says "Invalid email or password" whether the *email* doesn't exist or the
*password* is wrong — never "no account with that email" specifically. That's deliberate: it
stops an attacker from using the login form to discover which emails have accounts (an
"enumeration" attack).

On the frontend, `AuthService.login()` gets that response back and saves it to the browser's
`localStorage` (persistent storage that survives closing the tab) so the login sticks around
across page reloads.

## Step 4: why one token isn't enough — the access/refresh split

An earlier version of this app used a single JWT valid for **7 days**. That has a real problem:
if that token is ever stolen (e.g., via a malicious browser extension, or an XSS bug elsewhere on
the page), there is no way to invalidate it — a JWT's whole point is that the server doesn't look
anything up to trust it, so there's nothing to "turn off." The thief has full access for up to a
week.

The fix, and the standard industry pattern, is **two tokens with very different lifetimes**:

| Token | Lifetime | Purpose | Where it's checked |
|---|---|---|---|
| **Access token** (the JWT above) | 30 minutes | Sent on every API request, proves who you are | Purely by signature — no database lookup |
| **Refresh token** | 30 days | Used *only* to get a new access token when the old one expires | Looked up in the `RefreshTokens` database table on every use |

The access token being short-lived shrinks the "stolen token is useful" window from a week to 30
minutes. The refresh token lives longer, but — unlike the JWT — it's a **database-backed**
credential that *can* be revoked instantly, because checking it always involves a database query.

### How the refresh token is stored

Exactly like a password, the raw refresh token is never saved to the database — only its SHA-256
hash:

```csharp
private async Task<string> IssueRefreshTokenAsync(User user)
{
    var rawToken = GenerateOpaqueToken(); // 32 random bytes, base64url-encoded
    db.RefreshTokens.Add(new RefreshToken
    {
        UserId = user.Id,
        TokenHash = HashToken(rawToken),
        ExpiresAt = DateTime.UtcNow.AddDays(30)
    });
    return rawToken; // the RAW value goes to the client; only the HASH stays in the DB
}
```

This means even a full database leak doesn't hand out usable refresh tokens — same reasoning as
bcrypt-hashed passwords, just with a faster hash (SHA-256) since these are already
high-entropy random strings, not human-guessable passwords.

## Step 5: refreshing, transparently

The frontend stores both tokens. When an API call gets back `401 Unauthorized` — meaning the
access token just expired, which happens routinely every 30 minutes — an Angular **interceptor**
catches it:

```typescript
// core/interceptors/error.interceptor.ts
if (error.status === 401 && authService.isAuthenticated() && !isAuthEndpoint) {
  return authService.refreshAccessToken().pipe(
    switchMap((response) => next(req.clone({ setHeaders: { Authorization: `Bearer ${response.token}` } }))),
    catchError(() => { authService.logout(); void router.navigate(['/login']); return throwError(() => error); })
  );
}
```

In plain language: *"If a request failed because I'm not authenticated, try silently exchanging
my refresh token for a new access token, then retry the exact same request. Only if that also
fails do I actually log the user out."* The user never sees this happen — from their perspective,
they just stay logged in seamlessly for up to 30 days.

On the backend, the refresh endpoint does three things every time it's called:

```csharp
[HttpPost("refresh")]
public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request)
{
    var storedToken = await db.RefreshTokens
        .Include(t => t.User)
        .SingleOrDefaultAsync(t => t.TokenHash == HashToken(request.RefreshToken));

    if (storedToken is null || storedToken.ExpiresAt < DateTime.UtcNow)
        return Unauthorized(...);

    if (storedToken.RevokedAt is not null)
    {
        // reuse of an already-used token = possible theft. Kill every token for this user.
        var activeTokens = await db.RefreshTokens
            .Where(t => t.UserId == storedToken.UserId && t.RevokedAt == null).ToListAsync();
        foreach (var t in activeTokens) t.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Unauthorized(...);
    }

    storedToken.RevokedAt = DateTime.UtcNow; // this one is now spent
    var (accessToken, expiresAt) = tokenService.CreateToken(storedToken.User);
    var newRefreshToken = await IssueRefreshTokenAsync(storedToken.User); // issue a fresh one
    await db.SaveChangesAsync();
    return Ok(new AuthResponse(accessToken, newRefreshToken, ...));
}
```

This is called **refresh token rotation with reuse detection**, and it's worth understanding why
each part exists:

1. **Rotation** — every refresh call marks the old refresh token as used (`RevokedAt`) and issues
   a brand new one. The client's old refresh token is now worthless, even to the legitimate user —
   they must use the *new* one next time.
2. **Reuse detection** — if an *already-revoked* refresh token is ever presented again, that's
   suspicious: the only way that happens under normal use is if two different parties both have a
   copy of the same refresh token (one legitimate, one stolen) and both tried to use it. The
   response is aggressive on purpose: revoke *every* active refresh token for that user, forcing a
   fresh login everywhere. This trades a little inconvenience (a real user occasionally has to log
   in again if something glitches) for shutting down a real theft scenario immediately instead of
   letting a thief keep refreshing indefinitely.

## Step 6: logout, and other things that revoke sessions

Logging out isn't just "clear the browser's local storage" — it also tells the server to revoke
the refresh token server-side, so it truly can't be used again even if someone captured it before
logout:

```csharp
[HttpPost("logout")]
public async Task<IActionResult> Logout(RefreshRequest request)
{
    var storedToken = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == HashToken(request.RefreshToken));
    if (storedToken is not null && storedToken.RevokedAt is null)
    {
        storedToken.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }
    return NoContent();
}
```

The same "revoke everything" logic also fires whenever a password is changed (via Settings) or
reset (via the "forgot password" email flow) — the reasoning: if you just proved you're the real
owner of the account by resetting the password, any *other* session that might belong to someone
who guessed/stole the old password should be logged out too.

## The whole lifecycle, visualized

```mermaid
sequenceDiagram
    participant Browser
    participant API as Backend
    participant DB as Database

    Browser->>API: POST /auth/login (email, password)
    API->>DB: look up user, verify bcrypt hash
    API->>DB: INSERT new RefreshToken (hashed)
    API-->>Browser: { token (30 min JWT), refreshToken (30 days) }
    Note over Browser: both saved to localStorage

    loop every request
        Browser->>API: GET /api/... (Authorization: Bearer <JWT>)
        API-->>Browser: 200 OK (signature checked, no DB lookup needed)
    end

    Note over Browser,API: 30 minutes later, JWT has expired
    Browser->>API: GET /api/... (expired JWT)
    API-->>Browser: 401 Unauthorized
    Browser->>API: POST /auth/refresh (refreshToken)
    API->>DB: look up hash, check not expired/revoked
    API->>DB: mark old token revoked, INSERT new one
    API-->>Browser: new { token, refreshToken }
    Browser->>API: retries the original request, now succeeds
```

## Route guards: keeping logged-out users off protected pages

On the frontend, `authGuard` (in `core/guards/auth.guard.ts`) runs before Angular activates any
route under the main app shell. It checks `authService.isAuthenticated()` — which, deliberately,
just means "do we have *any* stored session," not "is the access token specifically still valid
right now" (that's the interceptor's job, reactively, per request). If there's no session at all,
the guard redirects to `/login` before the page ever renders.

Next: [05-FRONTEND.md](./05-FRONTEND.md) — Angular, and Signals explained in depth.
