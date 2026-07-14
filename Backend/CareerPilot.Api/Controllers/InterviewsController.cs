using CareerPilot.Api.Common;
using CareerPilot.Api.Data;
using CareerPilot.Api.Dtos;
using CareerPilot.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CareerPilot.Api.Controllers;

[ApiController]
[Route("api/interviews")]
[Authorize]
public class InterviewsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InterviewDto>>> GetAll([FromQuery] int? applicationId)
    {
        var userId = User.GetUserId();
        var query = db.Interviews.Where(i => i.JobApplication!.UserId == userId);

        if (applicationId.HasValue)
        {
            query = query.Where(i => i.JobApplicationId == applicationId.Value);
        }

        var interviews = await query
            .OrderBy(i => i.ScheduledAt)
            .Select(i => new InterviewDto(
                i.Id, i.JobApplicationId, i.Round, i.ScheduledAt, i.Status, i.Notes,
                i.JobApplication!.RoleTitle, i.JobApplication.Company!.Name))
            .ToListAsync();

        return Ok(interviews);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<InterviewDto>> GetById(int id)
    {
        var userId = User.GetUserId();
        var interview = await db.Interviews
            .Where(i => i.Id == id && i.JobApplication!.UserId == userId)
            .Select(i => new InterviewDto(
                i.Id, i.JobApplicationId, i.Round, i.ScheduledAt, i.Status, i.Notes,
                i.JobApplication!.RoleTitle, i.JobApplication.Company!.Name))
            .SingleOrDefaultAsync();

        return interview is null ? NotFound() : Ok(interview);
    }

    [HttpPost]
    public async Task<ActionResult<InterviewDto>> Create(InterviewUpsertRequest request)
    {
        var userId = User.GetUserId();
        var application = await db.JobApplications
            .Include(a => a.Company)
            .SingleOrDefaultAsync(a => a.Id == request.JobApplicationId && a.UserId == userId);

        if (application is null) return BadRequest(new { message = "Application not found." });

        var interview = new Interview
        {
            JobApplicationId = request.JobApplicationId,
            Round = request.Round,
            ScheduledAt = request.ScheduledAt,
            Status = request.Status,
            Notes = request.Notes
        };

        db.Interviews.Add(interview);
        await db.SaveChangesAsync();

        var dto = new InterviewDto(
            interview.Id, interview.JobApplicationId, interview.Round, interview.ScheduledAt,
            interview.Status, interview.Notes, application.RoleTitle, application.Company!.Name);

        return CreatedAtAction(nameof(GetById), new { id = interview.Id }, dto);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<InterviewDto>> Update(int id, InterviewUpsertRequest request)
    {
        var userId = User.GetUserId();
        var interview = await db.Interviews
            .SingleOrDefaultAsync(i => i.Id == id && i.JobApplication!.UserId == userId);

        if (interview is null) return NotFound();

        if (interview.JobApplicationId != request.JobApplicationId)
        {
            var applicationExists = await db.JobApplications.AnyAsync(a => a.Id == request.JobApplicationId && a.UserId == userId);
            if (!applicationExists) return BadRequest(new { message = "Application not found." });
            interview.JobApplicationId = request.JobApplicationId;
        }

        interview.Round = request.Round;
        interview.ScheduledAt = request.ScheduledAt;
        interview.Status = request.Status;
        interview.Notes = request.Notes;

        await db.SaveChangesAsync();

        await db.Entry(interview).Reference(i => i.JobApplication).LoadAsync();
        await db.Entry(interview.JobApplication!).Reference(a => a.Company).LoadAsync();

        return Ok(ToDto(interview));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();
        var interview = await db.Interviews.SingleOrDefaultAsync(i => i.Id == id && i.JobApplication!.UserId == userId);
        if (interview is null) return NotFound();

        db.Interviews.Remove(interview);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static InterviewDto ToDto(Interview i) => new(
        i.Id, i.JobApplicationId, i.Round, i.ScheduledAt, i.Status, i.Notes,
        i.JobApplication!.RoleTitle, i.JobApplication.Company!.Name);
}
