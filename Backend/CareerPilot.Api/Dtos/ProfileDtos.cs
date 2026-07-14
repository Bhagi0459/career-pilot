using System.ComponentModel.DataAnnotations;

namespace CareerPilot.Api.Dtos;

public record ProfileResponse(string DisplayName, string Email, DateTime CreatedAt);

public sealed class UpdateProfileRequest
{
    [Required, MaxLength(100)]
    public string DisplayName { get; init; } = string.Empty;
}

public sealed class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; init; } = string.Empty;

    [Required, MinLength(8)]
    public string NewPassword { get; init; } = string.Empty;
}
