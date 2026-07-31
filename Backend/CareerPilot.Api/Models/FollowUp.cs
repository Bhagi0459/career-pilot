namespace CareerPilot.Api.Models;

public class FollowUp
{
    public int Id { get; set; }

    public int JobApplicationId { get; set; }
    public JobApplication? JobApplication { get; set; }

    public string Note { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public bool IsDone { get; set; }
    public DateTime? CompletedAt { get; set; }
}
