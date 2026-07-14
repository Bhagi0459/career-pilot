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
    public async Task<ActionResult<IReadOnlyList<CompanyDto>>> GetAll()
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
            Name = request.Name,
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

        company.Name = request.Name;
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

        db.Companies.Remove(company);
        await db.SaveChangesAsync();

        return NoContent();
    }

    private static CompanyDto ToDto(Company c) => new(c.Id, c.Name, c.Country, c.Website, c.Notes);
}
