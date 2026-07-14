namespace CareerPilot.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Company> Companies { get; set; } = new List<Company>();
    public ICollection<Recruiter> Recruiters { get; set; } = new List<Recruiter>();
    public ICollection<JobApplication> JobApplications { get; set; } = new List<JobApplication>();
}
