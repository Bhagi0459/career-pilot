namespace CareerPilot.Api.Models;

public class Recruiter
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public int CompanyId { get; set; }
    public Company? Company { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? LinkedInUrl { get; set; }

    public ICollection<JobApplication> JobApplications { get; set; } = new List<JobApplication>();
}
