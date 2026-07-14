namespace CareerPilot.Api.Models;

public class PasswordResetToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>SHA-256 hash of the raw token that was emailed to the user. The raw token itself is never stored.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Set once the token has been redeemed (or revoked because a newer one superseded it). Null means still usable.</summary>
    public DateTime? UsedAt { get; set; }
}
