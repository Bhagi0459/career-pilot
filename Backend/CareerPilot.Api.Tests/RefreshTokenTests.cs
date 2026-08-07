using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace CareerPilot.Api.Tests;

/// <summary>
/// AuthController.Refresh/Logout carry the most security-sensitive logic in the app - rotation
/// (every refresh invalidates the token that was just used) and reuse detection (presenting an
/// already-revoked refresh token nukes every active session for that user, on the theory that
/// reuse means the token was stolen). None of this had test coverage before.
/// </summary>
public class RefreshTokenTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public RefreshTokenTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Refresh_WithAValidToken_IssuesANewAccessAndRefreshToken()
    {
        var client = _factory.CreateClient();
        var (_, refreshToken) = await RegisterAsync(client, $"refresh-{Guid.NewGuid()}@example.com");

        var response = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("token").GetString()));
        var newRefreshToken = body.GetProperty("refreshToken").GetString();
        Assert.False(string.IsNullOrEmpty(newRefreshToken));
        Assert.NotEqual(refreshToken, newRefreshToken);
    }

    [Fact]
    public async Task Refresh_TheSameTokenTwice_TheSecondAttemptIsRejected()
    {
        var client = _factory.CreateClient();
        var (_, refreshToken) = await RegisterAsync(client, $"rotate-{Guid.NewGuid()}@example.com");

        var first = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, second.StatusCode);
    }

    [Fact]
    public async Task Refresh_ReusingAnAlreadyRotatedToken_RevokesEveryOtherActiveSessionToo()
    {
        var client = _factory.CreateClient();
        var (_, originalRefreshToken) = await RegisterAsync(client, $"theft-{Guid.NewGuid()}@example.com");

        // Simulates the legitimate client refreshing first (getting refreshTokenB), then the
        // original (stolen) token being replayed by an attacker.
        var legitimateRefresh = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = originalRefreshToken });
        legitimateRefresh.EnsureSuccessStatusCode();
        var refreshTokenB = (await legitimateRefresh.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("refreshToken").GetString();

        var replay = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = originalRefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        // refreshTokenB was legitimately issued and had never been used yet - but the reuse
        // detection above should have revoked it anyway as a precaution.
        var refreshWithB = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = refreshTokenB });
        Assert.Equal(HttpStatusCode.Unauthorized, refreshWithB.StatusCode);
    }

    [Fact]
    public async Task Refresh_WithAnUnknownToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = "not-a-real-refresh-token" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesTheRefreshToken_SoItCanNoLongerBeUsedToRefresh()
    {
        var client = _factory.CreateClient();
        var (_, refreshToken) = await RegisterAsync(client, $"logout-{Guid.NewGuid()}@example.com");

        var logoutResponse = await client.PostAsJsonAsync("/api/auth/logout", new { refreshToken });
        Assert.Equal(HttpStatusCode.NoContent, logoutResponse.StatusCode);

        var refreshAfterLogout = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, refreshAfterLogout.StatusCode);
    }

    [Fact]
    public async Task Logout_DoesNotRequireAValidAccessToken()
    {
        // Deliberately no Authorization header at all - logout only needs the refresh token,
        // since the whole point is revoking a session whose access token may already be expired.
        var client = _factory.CreateClient();
        var (_, refreshToken) = await RegisterAsync(client, $"no-jwt-logout-{Guid.NewGuid()}@example.com");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout")
        {
            Content = JsonContent.Create(new { refreshToken })
        };

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private static async Task<(string Token, string RefreshToken)> RegisterAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new { displayName = "Refresh Test User", email, password = "SomePassword123" });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return (body.GetProperty("token").GetString()!, body.GetProperty("refreshToken").GetString()!);
    }
}
