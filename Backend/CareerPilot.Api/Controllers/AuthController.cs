using System.Security.Cryptography;
using System.Text;
using CareerPilot.Api.Data;
using CareerPilot.Api.Dtos;
using CareerPilot.Api.Models;
using CareerPilot.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CareerPilot.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AppDbContext db,
    ITokenService tokenService,
    IPasswordResetEmailSender resetEmailSender,
    IConfiguration configuration) : ControllerBase
{
    private const int ResetTokenExpiryMinutes = 30;

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail))
        {
            return Conflict(new { message = "An account with this email already exists." });
        }

        var user = new User
        {
            Email = normalizedEmail,
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var (token, expiresAt) = tokenService.CreateToken(user);
        return Ok(new AuthResponse(token, user.Email, user.DisplayName, expiresAt));
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
        return Ok(new AuthResponse(token, user.Email, user.DisplayName, expiresAt));
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
            var rawToken = GenerateResetToken();

            db.PasswordResetTokens.Add(new PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = HashResetToken(rawToken),
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
        var tokenHash = HashResetToken(request.Token);
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

        await db.SaveChangesAsync();

        return NoContent();
    }

    private static string GenerateResetToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static string HashResetToken(string rawToken)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(hash);
    }
}
