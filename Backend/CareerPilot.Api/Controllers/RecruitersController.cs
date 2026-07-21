using CareerPilot.Api.Common;
using CareerPilot.Api.Data;
using CareerPilot.Api.Dtos;
using CareerPilot.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CareerPilot.Api.Controllers;

[ApiController]
[Route("api/recruiters")]
[Authorize]
public class RecruitersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<RecruiterDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] int? companyId,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var query = db.Recruiters.Where(r => r.UserId == userId);

        if (companyId.HasValue)
        {
            query = query.Where(r => r.CompanyId == companyId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r =>
                EF.Functions.ILike(r.Name, $"%{term}%") ||
                (r.Email != null && EF.Functions.ILike(r.Email, $"%{term}%")) ||
                EF.Functions.ILike(r.Company!.Name, $"%{term}%"));
        }

        query = sort switch
        {
            "name_desc" => query.OrderByDescending(r => r.Name),
            "company_asc" => query.OrderBy(r => r.Company!.Name),
            "company_desc" => query.OrderByDescending(r => r.Company!.Name),
            _ => query.OrderBy(r => r.Name)
        };

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RecruiterDto(r.Id, r.Name, r.Email, r.LinkedInUrl, r.CompanyId, r.Company!.Name))
            .ToListAsync();

        return Ok(new PagedResult<RecruiterDto>(items, totalCount, page, pageSize));
    }

    // Returns the full (unpaginated) recruiter set for the current user. Used by the
    // application form's recruiter dropdown, which filters client-side by company.
    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<RecruiterDto>>> GetAllUnpaged([FromQuery] int? companyId)
    {
        var userId = User.GetUserId();
        var query = db.Recruiters.Where(r => r.UserId == userId);

        if (companyId.HasValue)
        {
            query = query.Where(r => r.CompanyId == companyId.Value);
        }

        var recruiters = await query
            .OrderBy(r => r.Name)
            .Select(r => new RecruiterDto(r.Id, r.Name, r.Email, r.LinkedInUrl, r.CompanyId, r.Company!.Name))
            .ToListAsync();

        return Ok(recruiters);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RecruiterDto>> GetById(int id)
    {
        var userId = User.GetUserId();
        var recruiter = await db.Recruiters
            .Where(r => r.Id == id && r.UserId == userId)
            .Select(r => new RecruiterDto(r.Id, r.Name, r.Email, r.LinkedInUrl, r.CompanyId, r.Company!.Name))
            .SingleOrDefaultAsync();

        return recruiter is null ? NotFound() : Ok(recruiter);
    }

    [HttpPost]
    public async Task<ActionResult<RecruiterDto>> Create(RecruiterUpsertRequest request)
    {
        var userId = User.GetUserId();
        var companyExists = await db.Companies.AnyAsync(c => c.Id == request.CompanyId && c.UserId == userId);
        if (!companyExists) return BadRequest(new { message = "Company not found." });

        var recruiter = new Recruiter
        {
            UserId = userId,
            CompanyId = request.CompanyId,
            Name = request.Name,
            Email = request.Email,
            LinkedInUrl = request.LinkedInUrl
        };

        db.Recruiters.Add(recruiter);
        await db.SaveChangesAsync();
        await db.Entry(recruiter).Reference(r => r.Company).LoadAsync();

        var dto = new RecruiterDto(recruiter.Id, recruiter.Name, recruiter.Email, recruiter.LinkedInUrl, recruiter.CompanyId, recruiter.Company!.Name);
        return CreatedAtAction(nameof(GetById), new { id = recruiter.Id }, dto);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<RecruiterDto>> Update(int id, RecruiterUpsertRequest request)
    {
        var userId = User.GetUserId();
        var recruiter = await db.Recruiters.SingleOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (recruiter is null) return NotFound();

        var companyExists = await db.Companies.AnyAsync(c => c.Id == request.CompanyId && c.UserId == userId);
        if (!companyExists) return BadRequest(new { message = "Company not found." });

        recruiter.Name = request.Name;
        recruiter.Email = request.Email;
        recruiter.LinkedInUrl = request.LinkedInUrl;
        recruiter.CompanyId = request.CompanyId;

        await db.SaveChangesAsync();
        await db.Entry(recruiter).Reference(r => r.Company).LoadAsync();

        return Ok(new RecruiterDto(recruiter.Id, recruiter.Name, recruiter.Email, recruiter.LinkedInUrl, recruiter.CompanyId, recruiter.Company!.Name));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();
        var recruiter = await db.Recruiters.SingleOrDefaultAsync(r => r.Id == id && r.UserId == userId);
        if (recruiter is null) return NotFound();

        db.Recruiters.Remove(recruiter);
        await db.SaveChangesAsync();

        return NoContent();
    }
}
