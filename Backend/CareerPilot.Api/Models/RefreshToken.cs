namespace CareerPilot.Api.Models;

public class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>SHA-256 hash of the raw refresh token handed to the client. The raw value is never stored.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Set once this token has been rotated away, logged out, or killed by reuse detection. Null means still usable.</summary>
    public DateTime? RevokedAt { get; set; }
}
