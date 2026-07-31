using CareerPilot.Api.Common;
using CareerPilot.Api.Data;
using CareerPilot.Api.Dtos;
using CareerPilot.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CareerPilot.Api.Controllers;

[ApiController]
[Route("api/followups")]
[Authorize]
public class FollowUpsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<FollowUpDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] bool? isDone,
        [FromQuery] int? applicationId,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var query = db.FollowUps.Where(f => f.JobApplication!.UserId == userId);

        if (applicationId.HasValue)
        {
            query = query.Where(f => f.JobApplicationId == applicationId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(f =>
                EF.Functions.ILike(f.Note, $"%{term}%") ||
                EF.Functions.ILike(f.JobApplication!.RoleTitle, $"%{term}%") ||
                EF.Functions.ILike(f.JobApplication.Company!.Name, $"%{term}%"));
        }

        if (isDone.HasValue)
        {
            query = query.Where(f => f.IsDone == isDone.Value);
        }

        query = sort switch
        {
            "dueDate_desc" => query.OrderByDescending(f => f.DueDate),
            _ => query.OrderBy(f => f.DueDate)
        };

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new FollowUpDto(
                f.Id, f.JobApplicationId, f.Note, f.DueDate, f.IsDone, f.CompletedAt,
                f.JobApplication!.RoleTitle, f.JobApplication.Company!.Name))
            .ToListAsync();

        return Ok(new PagedResult<FollowUpDto>(items, totalCount, page, pageSize));
    }

    // Returns the full (unpaginated) follow-up set for the current user. Used by the
    // dashboard's "upcoming follow-ups" list.
    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<FollowUpDto>>> GetAllUnpaged([FromQuery] int? applicationId)
    {
        var userId = User.GetUserId();
        var query = db.FollowUps.Where(f => f.JobApplication!.UserId == userId);

        if (applicationId.HasValue)
        {
            query = query.Where(f => f.JobApplicationId == applicationId.Value);
        }

        var followUps = await query
            .OrderBy(f => f.DueDate)
            .Select(f => new FollowUpDto(
                f.Id, f.JobApplicationId, f.Note, f.DueDate, f.IsDone, f.CompletedAt,
                f.JobApplication!.RoleTitle, f.JobApplication.Company!.Name))
            .ToListAsync();

        return Ok(followUps);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FollowUpDto>> GetById(int id)
    {
        var userId = User.GetUserId();
        var followUp = await db.FollowUps
            .Where(f => f.Id == id && f.JobApplication!.UserId == userId)
            .Select(f => new FollowUpDto(
                f.Id, f.JobApplicationId, f.Note, f.DueDate, f.IsDone, f.CompletedAt,
                f.JobApplication!.RoleTitle, f.JobApplication.Company!.Name))
            .SingleOrDefaultAsync();

        return followUp is null ? NotFound() : Ok(followUp);
    }

    [HttpPost]
    public async Task<ActionResult<FollowUpDto>> Create(FollowUpUpsertRequest request)
    {
        var userId = User.GetUserId();
        var application = await db.JobApplications
            .Include(a => a.Company)
            .SingleOrDefaultAsync(a => a.Id == request.JobApplicationId && a.UserId == userId);

        if (application is null) return BadRequest(new { message = "Application not found." });

        var followUp = new FollowUp
        {
            JobApplicationId = request.JobApplicationId,
            Note = request.Note,
            DueDate = request.DueDate
        };

        db.FollowUps.Add(followUp);
        await db.SaveChangesAsync();

        var dto = new FollowUpDto(
            followUp.Id, followUp.JobApplicationId, followUp.Note, followUp.DueDate,
            followUp.IsDone, followUp.CompletedAt, application.RoleTitle, application.Company!.Name);

        return CreatedAtAction(nameof(GetById), new { id = followUp.Id }, dto);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<FollowUpDto>> Update(int id, FollowUpUpsertRequest request)
    {
        var userId = User.GetUserId();
        var followUp = await db.FollowUps
            .SingleOrDefaultAsync(f => f.Id == id && f.JobApplication!.UserId == userId);

        if (followUp is null) return NotFound();

        if (followUp.JobApplicationId != request.JobApplicationId)
        {
            var applicationExists = await db.JobApplications.AnyAsync(a => a.Id == request.JobApplicationId && a.UserId == userId);
            if (!applicationExists) return BadRequest(new { message = "Application not found." });
            followUp.JobApplicationId = request.JobApplicationId;
        }

        followUp.Note = request.Note;
        followUp.DueDate = request.DueDate;

        await db.SaveChangesAsync();

        await db.Entry(followUp).Reference(f => f.JobApplication).LoadAsync();
        await db.Entry(followUp.JobApplication!).Reference(a => a.Company).LoadAsync();

        return Ok(ToDto(followUp));
    }

    // Toggles IsDone rather than requiring the full upsert payload, so the list page can
    // offer a single-click checkbox instead of forcing an edit-form round trip.
    [HttpPatch("{id:int}/toggle-complete")]
    public async Task<ActionResult<FollowUpDto>> ToggleComplete(int id)
    {
        var userId = User.GetUserId();
        var followUp = await db.FollowUps
            .SingleOrDefaultAsync(f => f.Id == id && f.JobApplication!.UserId == userId);

        if (followUp is null) return NotFound();

        followUp.IsDone = !followUp.IsDone;
        followUp.CompletedAt = followUp.IsDone ? DateTime.UtcNow : null;

        await db.SaveChangesAsync();

        await db.Entry(followUp).Reference(f => f.JobApplication).LoadAsync();
        await db.Entry(followUp.JobApplication!).Reference(a => a.Company).LoadAsync();

        return Ok(ToDto(followUp));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();
        var followUp = await db.FollowUps.SingleOrDefaultAsync(f => f.Id == id && f.JobApplication!.UserId == userId);
        if (followUp is null) return NotFound();

        db.FollowUps.Remove(followUp);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static FollowUpDto ToDto(FollowUp f) => new(
        f.Id, f.JobApplicationId, f.Note, f.DueDate, f.IsDone, f.CompletedAt,
        f.JobApplication!.RoleTitle, f.JobApplication.Company!.Name);
}
