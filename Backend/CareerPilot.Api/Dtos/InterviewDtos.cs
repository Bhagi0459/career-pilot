using System.ComponentModel.DataAnnotations;
using CareerPilot.Api.Models.Enums;

namespace CareerPilot.Api.Dtos;

public record InterviewDto(
    int Id,
    int JobApplicationId,
    string Round,
    DateTime ScheduledAt,
    InterviewStatus Status,
    string? Notes,
    string RoleTitle,
    string CompanyName
);

public sealed class InterviewUpsertRequest
{
    [Required]
    public int JobApplicationId { get; init; }

    [Required, MaxLength(100)]
    public string Round { get; init; } = string.Empty;

    [Required]
    public DateTime ScheduledAt { get; init; }

    [Required]
    public InterviewStatus Status { get; init; }

    [MaxLength(2000)]
    public string? Notes { get; init; }
}
