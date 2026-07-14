namespace CareerPilot.Api.Models;

public class Company
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Country { get; set; }
    public string? Website { get; set; }
    public string? Notes { get; set; }

    public ICollection<Recruiter> Recruiters { get; set; } = new List<Recruiter>();
    public ICollection<JobApplication> JobApplications { get; set; } = new List<JobApplication>();
}
