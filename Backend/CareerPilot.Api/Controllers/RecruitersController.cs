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
    public async Task<ActionResult<IReadOnlyList<RecruiterDto>>> GetAll([FromQuery] int? companyId)
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
