using CareerPilot.Api.Common;
using CareerPilot.Api.Data;
using CareerPilot.Api.Dtos;
using CareerPilot.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CareerPilot.Api.Controllers;

[ApiController]
[Route("api/companies")]
[Authorize]
public class CompaniesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<CompanyDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var query = db.Companies.Where(c => c.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(c =>
                EF.Functions.ILike(c.Name, $"%{term}%") ||
                (c.Country != null && EF.Functions.ILike(c.Country, $"%{term}%")));
        }

        query = sort switch
        {
            "name_desc" => query.OrderByDescending(c => c.Name),
            _ => query.OrderBy(c => c.Name)
        };

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => ToDto(c))
            .ToListAsync();

        return Ok(new PagedResult<CompanyDto>(items, totalCount, page, pageSize));
    }

    // Returns the full (unpaginated) company set for the current user. Used by dropdowns
    // (application form, recruiter form) that need every company, not just one page.
    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<CompanyDto>>> GetAllUnpaged()
    {
        var userId = User.GetUserId();
        var companies = await db.Companies
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.Name)
            .Select(c => ToDto(c))
            .ToListAsync();

        return Ok(companies);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CompanyDto>> GetById(int id)
    {
        var userId = User.GetUserId();
        var company = await db.Companies
            .Where(c => c.Id == id && c.UserId == userId)
            .Select(c => ToDto(c))
            .SingleOrDefaultAsync();

        return company is null ? NotFound() : Ok(company);
    }

    [HttpPost]
    public async Task<ActionResult<CompanyDto>> Create(CompanyUpsertRequest request)
    {
        var userId = User.GetUserId();
        var company = new Company
        {
            UserId = userId,
            Name = request.Name.Trim(),
            Country = request.Country,
            Website = request.Website,
            Notes = request.Notes
        };

        db.Companies.Add(company);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = company.Id }, ToDto(company));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CompanyDto>> Update(int id, CompanyUpsertRequest request)
    {
        var userId = User.GetUserId();
        var company = await db.Companies.SingleOrDefaultAsync(c => c.Id == id && c.UserId == userId);
        if (company is null) return NotFound();

        company.Name = request.Name.Trim();
        company.Country = request.Country;
        company.Website = request.Website;
        company.Notes = request.Notes;

        await db.SaveChangesAsync();

        return Ok(ToDto(company));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserId();
        var company = await db.Companies.SingleOrDefaultAsync(c => c.Id == id && c.UserId == userId);
        if (company is null) return NotFound();

        // Company -> JobApplication -> {Interview, FollowUp} and Company -> Recruiter are all
        // configured with cascading deletes at the database level, which would otherwise let one
        // DELETE here silently wipe out a user's entire application history for this company.
        // Refuse instead, and tell the caller exactly what's still attached so they can deal with
        // it deliberately (reassign/delete those records first) rather than losing data by
        // accident.
        var applicationCount = await db.JobApplications.CountAsync(a => a.CompanyId == id && a.UserId == userId);
        var recruiterCount = await db.Recruiters.CountAsync(r => r.CompanyId == id && r.UserId == userId);
        if (applicationCount > 0 || recruiterCount > 0)
        {
            return Conflict(new
            {
                message = $"Can't delete {company.Name} — it still has {applicationCount} application(s) and {recruiterCount} recruiter(s) attached. Remove or reassign those first.",
                applicationCount,
                recruiterCount
            });
        }

        db.Companies.Remove(company);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static CompanyDto ToDto(Company c) => new(c.Id, c.Name, c.Country, c.Website, c.Notes);
}
