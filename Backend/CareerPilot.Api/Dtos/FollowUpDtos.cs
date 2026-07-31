using System.ComponentModel.DataAnnotations;

namespace CareerPilot.Api.Dtos;

public record FollowUpDto(
    int Id,
    int JobApplicationId,
    string Note,
    DateTime DueDate,
    bool IsDone,
    DateTime? CompletedAt,
    string RoleTitle,
    string CompanyName
);

public sealed class FollowUpUpsertRequest
{
    [Required]
    public int JobApplicationId { get; init; }

    [Required, MaxLength(500)]
    public string Note { get; init; } = string.Empty;

    [Required]
    public DateTime DueDate { get; init; }
}
