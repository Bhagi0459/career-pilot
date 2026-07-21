using CareerPilot.Api.Common;
using CareerPilot.Api.Data;
using CareerPilot.Api.Dtos;
using CareerPilot.Api.Models;
using CareerPilot.Api.Models.Enums;
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
    public async Task<ActionResult<PagedResult<InterviewDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] InterviewStatus? status,
        [FromQuery] int? applicationId,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var query = db.Interviews.Where(i => i.JobApplication!.UserId == userId);

        if (applicationId.HasValue)
        {
            query = query.Where(i => i.JobApplicationId == applicationId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(i =>
                EF.Functions.ILike(i.Round, $"%{term}%") ||
                EF.Functions.ILike(i.JobApplication!.RoleTitle, $"%{term}%") ||
                EF.Functions.ILike(i.JobApplication.Company!.Name, $"%{term}%"));
        }

        if (status.HasValue)
        {
            query = query.Where(i => i.Status == status.Value);
        }

        query = sort switch
        {
            "scheduledAt_desc" => query.OrderByDescending(i => i.ScheduledAt),
            "round_asc" => query.OrderBy(i => i.Round),
            "round_desc" => query.OrderByDescending(i => i.Round),
            _ => query.OrderBy(i => i.ScheduledAt)
        };

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new InterviewDto(
                i.Id, i.JobApplicationId, i.Round, i.ScheduledAt, i.Status, i.Notes,
                i.JobApplication!.RoleTitle, i.JobApplication.Company!.Name))
            .ToListAsync();

        return Ok(new PagedResult<InterviewDto>(items, totalCount, page, pageSize));
    }

    // Returns the full (unpaginated) interview set for the current user. Used by the
    // dashboard's "upcoming interviews" list.
    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<InterviewDto>>> GetAllUnpaged([FromQuery] int? applicationId)
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
