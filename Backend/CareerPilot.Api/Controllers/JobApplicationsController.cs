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
[Route("api/applications")]
[Authorize]
public class JobApplicationsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<JobApplicationDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] ApplicationStatus? status,
        [FromQuery] string? country,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var query = db.JobApplications.Where(a => a.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(a =>
                EF.Functions.ILike(a.RoleTitle, $"%{term}%") ||
                EF.Functions.ILike(a.Company!.Name, $"%{term}%"));
        }

        if (status.HasValue)
        {
            query = query.Where(a => a.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(country))
        {
            query = query.Where(a => a.Country == country);
        }

        query = sort switch
        {
            "appliedDate_asc" => query.OrderBy(a => a.AppliedDate),
            "roleTitle_asc" => query.OrderBy(a => a.RoleTitle),
            "roleTitle_desc" => query.OrderByDescending(a => a.RoleTitle),
            "company_asc" => query.OrderBy(a => a.Company!.Name),
            "company_desc" => query.OrderByDescending(a => a.Company!.Name),
            _ => query.OrderByDescending(a => a.AppliedDate)
        };

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new JobApplicationDto(
                a.Id, a.RoleTitle, a.Status, a.Country, a.AppliedDate, a.Notes,
                a.CompanyId, a.Company!.Name, a.RecruiterId, a.Recruiter != null ? a.Recruiter.Name : null))
            .ToListAsync();

        return Ok(new PagedResult<JobApplicationDto>(items, totalCount, page, pageSize));
    }

    // Returns the full (unpaginated) application set for the current user. Used by the
    // Angular dashboard to derive stats client-side via computed(). Acceptable at MVP
    // scale (personal tracker, small dataset); replace with a server-side aggregation
    // endpoint (e.g. GET /api/applications/summary) if the dataset grows meaningfully.
    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<JobApplicationDto>>> GetAllUnpaged()
    {
        var userId = User.GetUserId();
        var items = await db.JobApplications
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.AppliedDate)
            .Select(a => new JobApplicationDto(
                a.Id, a.RoleTitle, a.Status, a.Country, a.AppliedDate, a.Notes,
                a.CompanyId, a.Company!.Name, a.RecruiterId, a.Recruiter != null ? a.Recruiter.Name : null))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<JobApplicationDto>> GetById(int id)
    {
        var userId = User.GetUserId();
        var application = await db.JobApplications
            .Where(a => a.Id == id && a.UserId == userId)
            .Select(a => new JobApplicationDto(
                a.Id, a.RoleTitle, a.Status, a.Country, a.AppliedDate, a.Notes,
                a.CompanyId, a.Company!.Name, a.RecruiterId, a.Recruiter != null ? a.Recruiter.Name : null))
            .SingleOrDefaultAsync();

        return application is null ? NotFound() : Ok(application);
    }

    [HttpPost]
    public async Task<ActionResult<JobApplicationDto>> Create(JobApplicationUpsertRequest request)
    {
        var userId = User.GetUserId();

        var companyExists = await db.Companies.AnyAsync(c => c.Id == request.CompanyId && c.UserId == userId);
        if (!companyExists) return BadRequest(new { message = "Company not found." });

        if (request.RecruiterId.HasValue)
        {
            var recruiterExists = await db.Recruiters.AnyAsync(r => r.Id == request.RecruiterId && r.UserId == userId);
            if (!recruiterExists) return BadRequest(new { message = "Recruiter not found." });
        }

        var application = new JobApplication
        {
            UserId = userId,
            CompanyId = request.CompanyId,
            RecruiterId = request.RecruiterId,
            RoleTitle = request.RoleTitle,
            Status = request.Status,
            Country = request.Country,
            AppliedDate = request.AppliedDate,
            Notes = request.Notes
        };

        db.JobApplications.Add(application);
        await db.SaveChangesAsync();

        await db.Entry(application).Reference(a => a.Company).LoadAsync();
        if (application.RecruiterId.HasValue)
        {
            await db.Entry(application).Reference(a => a.Recruiter).LoadAsync();
        }

        return CreatedAtAction(nameof(GetById), new { id = application.Id }, ToDto(application));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<JobApplicationDto>> Update(int id, JobApplicationUpsertRequest request)
    {
        var userId = User.GetUserId();
        var application = await db.JobApplications.SingleOrDefaultAsync(a => a.Id == id && a.UserId == userId);
        if (application is null) return NotFound();

        var companyExists = await db.Companies.AnyAsync(c => c.Id == request.CompanyId && c.UserId == userId);
        if (!companyExists) return BadRequest(new { message = "Company not found." });

        if (request.RecruiterId.HasValue)
        {
            var recruiterExists = await db.Recruiters.AnyAsync(r => r.Id == request.RecruiterId && r.UserId == userId);
            if (!recruiterExists) return BadRequest(new { message = "Recruiter not found." });
        }

        application.CompanyId = request.CompanyId;
        application.RecruiterId = request.RecruiterId;
        application.RoleTitle = request.RoleTitle;
        application.Status = request.Status;
        application.Country = request.Country;
        application.AppliedDate = request.AppliedDate;
        application.Notes = request.Notes;

        await db.SaveChangesAsync();

        await db.Entry(application).Reference(a => a.Company).LoadAsync();
        await db.Entry(application).Reference(a => a.Recruiter).LoadAsync();

        return Ok(ToDto(application));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();
        var application = await db.JobApplications.SingleOrDefaultAsync(a => a.Id == id && a.UserId == userId);
        if (application is null) return NotFound();

        db.JobApplications.Remove(application);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static JobApplicationDto ToDto(JobApplication a) => new(
        a.Id, a.RoleTitle, a.Status, a.Country, a.AppliedDate, a.Notes,
        a.CompanyId, a.Company!.Name, a.RecruiterId, a.Recruiter != null ? a.Recruiter.Name : null);
}
