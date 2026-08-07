using System.Security.Cryptography;
using System.Text;
using CareerPilot.Api.Data;
using CareerPilot.Api.Dtos;
using CareerPilot.Api.Models;
using CareerPilot.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CareerPilot.Api.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
public class AuthController(
    AppDbContext db,
    ITokenService tokenService,
    IPasswordResetEmailSender resetEmailSender,
    IConfiguration configuration) : ControllerBase
{
    private const int ResetTokenExpiryMinutes = 30;
    private const int RefreshTokenExpiryDays = 30;
    private const string DuplicateEmailMessage = "An account with this email already exists. Try resetting your password instead.";
    private const string InvalidRefreshTokenMessage = "Invalid or expired refresh token.";

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var displayName = request.DisplayName.Trim();

        if (displayName.Length == 0)
        {
            return BadRequest(new { message = "Display name can't be blank." });
        }

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail))
        {
            return Conflict(new { message = DuplicateEmailMessage });
        }

        var user = new User
        {
            Email = normalizedEmail,
            DisplayName = displayName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Email is the only unique constraint on Users, so a DbUpdateException here means a
            // concurrent request for this same not-yet-existing email won the race between our
            // AnyAsync check above and this insert. Surface the same friendly conflict instead of
            // letting the exception reach the global handler as an opaque 500.
            return Conflict(new { message = DuplicateEmailMessage });
        }

        var (token, expiresAt) = tokenService.CreateToken(user);
        var refreshToken = await IssueRefreshTokenAsync(user);
        await db.SaveChangesAsync();
        return Ok(new AuthResponse(token, refreshToken, user.Email, user.DisplayName, expiresAt));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var (token, expiresAt) = tokenService.CreateToken(user);
        var refreshToken = await IssueRefreshTokenAsync(user);
        await db.SaveChangesAsync();
        return Ok(new AuthResponse(token, refreshToken, user.Email, user.DisplayName, expiresAt));
    }

    // Exchanges a still-valid refresh token for a new access token, rotating the refresh token
    // in the same call so a stolen-but-unused refresh token stops working the moment the
    // legitimate client refreshes first.
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request)
    {
        var tokenHash = HashToken(request.RefreshToken);
        var storedToken = await db.RefreshTokens
            .Include(t => t.User)
            .SingleOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (storedToken is null || storedToken.ExpiresAt < DateTime.UtcNow)
        {
            return Unauthorized(new { message = InvalidRefreshTokenMessage });
        }

        if (storedToken.RevokedAt is not null)
        {
            // This exact token was already rotated away or logged out, and yet it's being
            // presented again - that's the signature of a stolen refresh token being replayed.
            // Kill every other active refresh token for this user as a precaution and force a
            // fresh login everywhere.
            var activeTokens = await db.RefreshTokens
                .Where(t => t.UserId == storedToken.UserId && t.RevokedAt == null)
                .ToListAsync();
            foreach (var active in activeTokens)
            {
                active.RevokedAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();

            return Unauthorized(new { message = InvalidRefreshTokenMessage });
        }

        storedToken.RevokedAt = DateTime.UtcNow;

        var (accessToken, expiresAt) = tokenService.CreateToken(storedToken.User);
        var newRefreshToken = await IssueRefreshTokenAsync(storedToken.User);

        await db.SaveChangesAsync();

        return Ok(new AuthResponse(accessToken, newRefreshToken, storedToken.User.Email, storedToken.User.DisplayName, expiresAt));
    }

    // No [Authorize] here on purpose - the access token may already be expired by the time the
    // user logs out, and revoking the session only needs the refresh token, not a valid JWT.
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequest request)
    {
        var tokenHash = HashToken(request.RefreshToken);
        var storedToken = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (storedToken is not null && storedToken.RevokedAt is null)
        {
            storedToken.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == normalizedEmail);

        // Only do the work (and only send an email) when the account actually exists, but always
        // return the same response either way - otherwise the response timing/content becomes an
        // oracle an attacker can use to enumerate registered emails.
        if (user is not null)
        {
            var rawToken = GenerateOpaqueToken();

            db.PasswordResetTokens.Add(new PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = HashToken(rawToken),
                ExpiresAt = DateTime.UtcNow.AddMinutes(ResetTokenExpiryMinutes)
            });
            await db.SaveChangesAsync();

            var baseUrl = (configuration["Frontend:BaseUrl"] ?? "http://localhost:4200").TrimEnd('/');
            var resetUrl = $"{baseUrl}/reset-password?token={Uri.EscapeDataString(rawToken)}";
            await resetEmailSender.SendAsync(user.Email, resetUrl);
        }

        return Ok(new { message = "If an account exists for that email, we've sent a link to reset the password." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var tokenHash = HashToken(request.Token);
        var resetToken = await db.PasswordResetTokens
            .Include(t => t.User)
            .SingleOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (resetToken is null || resetToken.UsedAt is not null || resetToken.ExpiresAt < DateTime.UtcNow)
        {
            return BadRequest(new { message = "This password reset link is invalid or has expired." });
        }

        resetToken.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        resetToken.UsedAt = DateTime.UtcNow;

        // A user could have requested several reset emails before using one; once any of them is
        // redeemed, the rest must stop working so an old, still-unread email can't reset the
        // password again later.
        var otherOutstandingTokens = await db.PasswordResetTokens
            .Where(t => t.UserId == resetToken.UserId && t.Id != resetToken.Id && t.UsedAt == null)
            .ToListAsync();
        foreach (var other in otherOutstandingTokens)
        {
            other.UsedAt = DateTime.UtcNow;
        }

        // A password reset means the old password (and whatever guessed/leaked it) should no
        // longer be able to keep an existing session alive via its refresh token either.
        var activeRefreshTokens = await db.RefreshTokens
            .Where(t => t.UserId == resetToken.UserId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var refreshToken in activeRefreshTokens)
        {
            refreshToken.RevokedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        return NoContent();
    }

    private async Task<string> IssueRefreshTokenAsync(User user)
    {
        var rawToken = GenerateOpaqueToken();

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawToken),
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays)
        });

        return rawToken;
    }

    private static string GenerateOpaqueToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static string HashToken(string rawToken)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(hash);
    }
}
