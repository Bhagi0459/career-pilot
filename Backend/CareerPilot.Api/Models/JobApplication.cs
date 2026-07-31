using CareerPilot.Api.Models.Enums;

namespace CareerPilot.Api.Models;

public class JobApplication
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public int CompanyId { get; set; }
    public Company? Company { get; set; }

    public int? RecruiterId { get; set; }
    public Recruiter? Recruiter { get; set; }

    public string RoleTitle { get; set; } = string.Empty;
    public ApplicationStatus Status { get; set; } = ApplicationStatus.Applied;
    public string? Country { get; set; }
    public DateTime AppliedDate { get; set; }
    public string? Notes { get; set; }

    public ICollection<Interview> Interviews { get; set; } = new List<Interview>();
    public ICollection<FollowUp> FollowUps { get; set; } = new List<FollowUp>();
}
