using System.ComponentModel.DataAnnotations;

namespace CareerPilot.Api.Dtos;

public record RecruiterDto(
    int Id,
    string Name,
    string? Email,
    string? PhoneNumber,
    string? LinkedInUrl,
    int CompanyId,
    string CompanyName
);

public sealed class RecruiterUpsertRequest
{
    [Required, MaxLength(200)]
    public string Name { get; init; } = string.Empty;

    [EmailAddress, MaxLength(200)]
    public string? Email { get; init; }

    [Phone, MaxLength(30)]
    public string? PhoneNumber { get; init; }

    [MaxLength(300), Url]
    public string? LinkedInUrl { get; init; }

    [Required]
    public int CompanyId { get; init; }
}
