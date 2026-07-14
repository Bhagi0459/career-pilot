using CareerPilot.Api.Models.Enums;

namespace CareerPilot.Api.Models;

public class Interview
{
    public int Id { get; set; }

    public int JobApplicationId { get; set; }
    public JobApplication? JobApplication { get; set; }

    public string Round { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public InterviewStatus Status { get; set; } = InterviewStatus.Scheduled;
    public string? Notes { get; set; }
}
