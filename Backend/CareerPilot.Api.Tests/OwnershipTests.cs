using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace CareerPilot.Api.Tests;

/// <summary>
/// Every resource controller filters its queries by the caller's UserId, which is what stops
/// user A from reading/editing/deleting user B's data just by guessing an ID (IDOR - Insecure
/// Direct Object Reference). None of that was previously covered by a test, despite it being the
/// single most important security property of the CRUD surface. These tests register two
/// separate users, let one create a full chain of resources (Company -> Recruiter ->
/// JobApplication -> Interview/FollowUp), and confirm the other user gets 404 (not a data leak,
/// not a 403 that would at least confirm the row exists) for every read/write/delete attempt.
/// </summary>
public class OwnershipTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public OwnershipTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed record Fixture(
        HttpClient OwnerClient,
        HttpClient OtherClient,
        int CompanyId,
        int RecruiterId,
        int ApplicationId,
        int InterviewId,
        int FollowUpId);

    [Fact]
    public async Task OtherUser_CannotReadUpdateOrDelete_AnotherUsersCompany()
    {
        var fixture = await BuildFullChainAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.GetAsync($"/api/companies/{fixture.CompanyId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.PutAsJsonAsync($"/api/companies/{fixture.CompanyId}", new { name = "Hijacked", country = (string?)null, website = (string?)null, notes = (string?)null })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.DeleteAsync($"/api/companies/{fixture.CompanyId}")).StatusCode);

        // The owner's data is untouched by the rejected attempts above.
        var stillOwned = await fixture.OwnerClient.GetAsync($"/api/companies/{fixture.CompanyId}");
        Assert.Equal(HttpStatusCode.OK, stillOwned.StatusCode);
    }

    [Fact]
    public async Task OtherUser_CannotReadUpdateOrDelete_AnotherUsersRecruiter()
    {
        var fixture = await BuildFullChainAsync();

        var updatePayload = new { name = "Hijacked", email = (string?)null, phoneNumber = (string?)null, linkedInUrl = (string?)null, companyId = fixture.CompanyId };

        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.GetAsync($"/api/recruiters/{fixture.RecruiterId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.PutAsJsonAsync($"/api/recruiters/{fixture.RecruiterId}", updatePayload)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.DeleteAsync($"/api/recruiters/{fixture.RecruiterId}")).StatusCode);
    }

    [Fact]
    public async Task OtherUser_CannotReadUpdateOrDelete_AnotherUsersJobApplication()
    {
        var fixture = await BuildFullChainAsync();

        var updatePayload = new
        {
            roleTitle = "Hijacked Role",
            status = "Applied",
            appliedDate = DateTime.UtcNow,
            companyId = fixture.CompanyId
        };

        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.GetAsync($"/api/applications/{fixture.ApplicationId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.PutAsJsonAsync($"/api/applications/{fixture.ApplicationId}", updatePayload)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.DeleteAsync($"/api/applications/{fixture.ApplicationId}")).StatusCode);
    }

    [Fact]
    public async Task OtherUser_CannotCreateAnApplication_AgainstAnotherUsersCompanyOrRecruiter()
    {
        var fixture = await BuildFullChainAsync();

        var payload = new
        {
            roleTitle = "Sneaky Application",
            status = "Applied",
            appliedDate = DateTime.UtcNow,
            companyId = fixture.CompanyId,
            recruiterId = fixture.RecruiterId
        };

        var response = await fixture.OtherClient.PostAsJsonAsync("/api/applications", payload);

        // The company/recruiter exist, just not for this caller - creating against them must be
        // rejected, not silently linked to someone else's records.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task OtherUser_CannotReadUpdateOrDelete_AnotherUsersInterview()
    {
        var fixture = await BuildFullChainAsync();

        var updatePayload = new
        {
            jobApplicationId = fixture.ApplicationId,
            round = "Hijacked Round",
            scheduledAt = DateTime.UtcNow,
            status = "Scheduled"
        };

        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.GetAsync($"/api/interviews/{fixture.InterviewId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.PutAsJsonAsync($"/api/interviews/{fixture.InterviewId}", updatePayload)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.DeleteAsync($"/api/interviews/{fixture.InterviewId}")).StatusCode);
    }

    [Fact]
    public async Task OtherUser_CannotReadUpdateToggleOrDelete_AnotherUsersFollowUp()
    {
        var fixture = await BuildFullChainAsync();

        var updatePayload = new
        {
            jobApplicationId = fixture.ApplicationId,
            note = "Hijacked note",
            dueDate = DateTime.UtcNow
        };

        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.GetAsync($"/api/followups/{fixture.FollowUpId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.PutAsJsonAsync($"/api/followups/{fixture.FollowUpId}", updatePayload)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.PatchAsync($"/api/followups/{fixture.FollowUpId}/toggle-complete", content: null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.OtherClient.DeleteAsync($"/api/followups/{fixture.FollowUpId}")).StatusCode);
    }

    [Fact]
    public async Task DeletingACompany_WithApplicationsOrRecruitersAttached_IsRefusedWithConflict()
    {
        var fixture = await BuildFullChainAsync();

        var response = await fixture.OwnerClient.DeleteAsync($"/api/companies/{fixture.CompanyId}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("applicationCount").GetInt32() > 0);
        Assert.True(body.GetProperty("recruiterCount").GetInt32() > 0);

        // Nothing was actually deleted.
        Assert.Equal(HttpStatusCode.OK, (await fixture.OwnerClient.GetAsync($"/api/companies/{fixture.CompanyId}")).StatusCode);
    }

    /// <summary>
    /// Registers two users. User A ("owner") creates a Company, a Recruiter under it, a
    /// JobApplication linking both, an Interview and a FollowUp under that application. Returns
    /// authenticated clients for both users plus every created ID, so each test just has to
    /// assert what user B (the "other" client) can and can't do to user A's data.
    /// </summary>
    private async Task<Fixture> BuildFullChainAsync()
    {
        var anonymous = _factory.CreateClient();

        var ownerToken = await RegisterAndGetTokenAsync(anonymous, $"owner-{Guid.NewGuid()}@example.com");
        var otherToken = await RegisterAndGetTokenAsync(anonymous, $"other-{Guid.NewGuid()}@example.com");

        var ownerClient = _factory.CreateClient();
        ownerClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);

        var otherClient = _factory.CreateClient();
        otherClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        var companyResponse = await ownerClient.PostAsJsonAsync("/api/companies", new { name = "Acme Corp", country = "USA", website = (string?)null, notes = (string?)null });
        companyResponse.EnsureSuccessStatusCode();
        var companyId = (await companyResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var recruiterResponse = await ownerClient.PostAsJsonAsync("/api/recruiters", new { name = "Jane Recruiter", email = (string?)null, phoneNumber = (string?)null, linkedInUrl = (string?)null, companyId });
        recruiterResponse.EnsureSuccessStatusCode();
        var recruiterId = (await recruiterResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var applicationResponse = await ownerClient.PostAsJsonAsync("/api/applications", new
        {
            roleTitle = "Backend Engineer",
            status = "Applied",
            appliedDate = DateTime.UtcNow,
            companyId,
            recruiterId
        });
        applicationResponse.EnsureSuccessStatusCode();
        var applicationId = (await applicationResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var interviewResponse = await ownerClient.PostAsJsonAsync("/api/interviews", new
        {
            jobApplicationId = applicationId,
            round = "Phone Screen",
            scheduledAt = DateTime.UtcNow.AddDays(3),
            status = "Scheduled"
        });
        interviewResponse.EnsureSuccessStatusCode();
        var interviewId = (await interviewResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var followUpResponse = await ownerClient.PostAsJsonAsync("/api/followups", new
        {
            jobApplicationId = applicationId,
            note = "Check in with recruiter",
            dueDate = DateTime.UtcNow.AddDays(7)
        });
        followUpResponse.EnsureSuccessStatusCode();
        var followUpId = (await followUpResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        return new Fixture(ownerClient, otherClient, companyId, recruiterId, applicationId, interviewId, followUpId);
    }

    private static async Task<string> RegisterAndGetTokenAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new { displayName = "Test User", email, password = "SomePassword123" });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }
}
