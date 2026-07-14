using System.ComponentModel.DataAnnotations;

namespace CareerPilot.Api.Dtos;

public record CompanyDto(int Id, string Name, string? Country, string? Website, string? Notes);

public sealed class CompanyUpsertRequest
{
    [Required, MaxLength(200)]
    public string Name { get; init; } = string.Empty;

    [MaxLength(100)]
    public string? Country { get; init; }

    [MaxLength(300), Url]
    public string? Website { get; init; }

    [MaxLength(2000)]
    public string? Notes { get; init; }
}
