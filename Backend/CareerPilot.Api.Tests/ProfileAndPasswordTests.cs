using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace CareerPilot.Api.Tests;

public class ProfileAndPasswordTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public ProfileAndPasswordTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetProfile_WithoutToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/profile");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Register_ResponseBody_NeverExposesPasswordHash()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Hash Check",
            email = $"hash-check-{Guid.NewGuid()}@example.com",
            password = "SuperSecret123"
        });

        response.EnsureSuccessStatusCode();
        var raw = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain("passwordHash", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SuperSecret123", raw);
    }

    [Fact]
    public async Task ChangePassword_FullFlow_RejectsWrongCurrentPassword_ThenRotatesCredentials()
    {
        var client = _factory.CreateClient();
        var email = $"flow-{Guid.NewGuid()}@example.com";
        const string oldPassword = "OriginalPass123";
        const string newPassword = "BrandNewPass456";

        // Register and capture the issued token.
        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Flow User",
            email,
            password = oldPassword
        });
        registerResponse.EnsureSuccessStatusCode();
        var registerBody = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var token = registerBody.GetProperty("token").GetString();
        Assert.False(string.IsNullOrEmpty(token));

        using var authedClient = _factory.CreateClient();
        authedClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Profile is readable with a valid token and never leaks the hash.
        var profileResponse = await authedClient.GetAsync("/api/profile");
        profileResponse.EnsureSuccessStatusCode();
        var profileRaw = await profileResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("passwordHash", profileRaw, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Flow User", profileRaw);

        // Wrong current password is rejected and does not rotate the credential.
        var wrongAttempt = await authedClient.PostAsJsonAsync("/api/profile/change-password", new
        {
            currentPassword = "TotallyWrongPassword",
            newPassword
        });
        Assert.Equal(HttpStatusCode.BadRequest, wrongAttempt.StatusCode);

        // Correct current password succeeds.
        var changeResponse = await authedClient.PostAsJsonAsync("/api/profile/change-password", new
        {
            currentPassword = oldPassword,
            newPassword
        });
        Assert.Equal(HttpStatusCode.NoContent, changeResponse.StatusCode);

        // Old password no longer works.
        var loginWithOldPassword = await client.PostAsJsonAsync("/api/auth/login", new { email, password = oldPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, loginWithOldPassword.StatusCode);

        // New password works.
        var loginWithNewPassword = await client.PostAsJsonAsync("/api/auth/login", new { email, password = newPassword });
        Assert.Equal(HttpStatusCode.OK, loginWithNewPassword.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_OnlyAffectsTheAuthenticatedUsersOwnRecord()
    {
        var client = _factory.CreateClient();

        var userAEmail = $"user-a-{Guid.NewGuid()}@example.com";
        var userBEmail = $"user-b-{Guid.NewGuid()}@example.com";

        var tokenA = await RegisterAndGetToken(client, "User A", userAEmail, "PasswordA123");
        var tokenB = await RegisterAndGetToken(client, "User B", userBEmail, "PasswordB123");

        using var clientA = _factory.CreateClient();
        clientA.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenA);
        var updateResponse = await clientA.PutAsJsonAsync("/api/profile", new { displayName = "User A Renamed" });
        updateResponse.EnsureSuccessStatusCode();

        using var clientB = _factory.CreateClient();
        clientB.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenB);
        var profileB = await clientB.GetFromJsonAsync<JsonElement>("/api/profile");

        Assert.Equal("User B", profileB.GetProperty("displayName").GetString());
    }

    private static async Task<string> RegisterAndGetToken(HttpClient client, string displayName, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new { displayName, email, password });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }
}
