using CareerPilot.Api.Common;
using CareerPilot.Api.Data;
using CareerPilot.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CareerPilot.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/profile")]
public class ProfileController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ProfileResponse>> GetProfile()
    {
        var userId = User.GetUserId();
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return NotFound();
        }

        return Ok(new ProfileResponse(user.DisplayName, user.Email, user.CreatedAt));
    }

    [HttpPut]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile(UpdateProfileRequest request)
    {
        var userId = User.GetUserId();
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return NotFound();
        }

        user.DisplayName = request.DisplayName.Trim();
        await db.SaveChangesAsync();

        return Ok(new ProfileResponse(user.DisplayName, user.Email, user.CreatedAt));
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var userId = User.GetUserId();
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return NotFound();
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Current password is incorrect." });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        // A changed password should kill any other sessions logged in with the old one, the same
        // way a forgot-password reset does.
        var activeRefreshTokens = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var refreshToken in activeRefreshTokens)
        {
            refreshToken.RevokedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        return NoContent();
    }
}
