using System.ComponentModel.DataAnnotations;
using CareerPilot.Api.Models.Enums;

namespace CareerPilot.Api.Dtos;

public record JobApplicationDto(
    int Id,
    string RoleTitle,
    ApplicationStatus Status,
    string? Country,
    DateTime AppliedDate,
    string? Notes,
    string? Salary,
    WorkMode? WorkMode,
    DateTime? OfferDeadline,
    string? Benefits,
    int CompanyId,
    string CompanyName,
    int? RecruiterId,
    string? RecruiterName
);

public sealed class JobApplicationUpsertRequest
{
    [Required, MaxLength(200)]
    public string RoleTitle { get; init; } = string.Empty;

    [Required]
    public ApplicationStatus Status { get; init; }

    [MaxLength(100)]
    public string? Country { get; init; }

    [Required]
    public DateTime AppliedDate { get; init; }

    [MaxLength(2000)]
    public string? Notes { get; init; }

    [MaxLength(200)]
    public string? Salary { get; init; }

    public WorkMode? WorkMode { get; init; }

    public DateTime? OfferDeadline { get; init; }

    [MaxLength(2000)]
    public string? Benefits { get; init; }

    [Required]
    public int CompanyId { get; init; }

    public int? RecruiterId { get; init; }
}
