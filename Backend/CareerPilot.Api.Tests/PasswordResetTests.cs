using System.Net;
using System.Net.Http.Json;
using CareerPilot.Api.Data;
using CareerPilot.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CareerPilot.Api.Tests;

public class PasswordResetTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public PasswordResetTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ForgotPassword_ReturnsTheSameResponse_WhetherOrNotTheEmailIsRegistered()
    {
        var client = _factory.CreateClient();
        var registeredEmail = $"enum-check-{Guid.NewGuid()}@example.com";
        await RegisterAsync(client, registeredEmail, "OriginalPass123");

        var forRegistered = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = registeredEmail });
        var forUnregistered = await client.PostAsJsonAsync(
            "/api/auth/forgot-password",
            new { email = $"never-registered-{Guid.NewGuid()}@example.com" });

        Assert.Equal(HttpStatusCode.OK, forRegistered.StatusCode);
        Assert.Equal(HttpStatusCode.OK, forUnregistered.StatusCode);
        Assert.Equal(await forRegistered.Content.ReadAsStringAsync(), await forUnregistered.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ForgotPassword_OnlyStoresAHashOfTheToken_NeverTheRawToken()
    {
        var client = _factory.CreateClient();
        var email = $"hash-only-{Guid.NewGuid()}@example.com";
        await RegisterAsync(client, email, "OriginalPass123");

        var sender = _factory.Services.GetRequiredService<TestPasswordResetEmailSender>();
        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var rawToken = sender.ExtractToken();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.PasswordResetTokens
            .Include(t => t.User)
            .SingleAsync(t => t.User.Email == email);

        Assert.NotEqual(rawToken, stored.TokenHash);
        Assert.DoesNotContain(rawToken, stored.TokenHash);
        // SHA-256 hex digest is 64 characters - a stand-in check that this really is a hash and
        // not, say, the raw token re-encoded.
        Assert.Equal(64, stored.TokenHash.Length);
        Assert.Null(stored.UsedAt);
    }

    [Fact]
    public async Task ResetPassword_WithValidToken_ChangesThePassword_AndTheOldPasswordStopsWorking()
    {
        var client = _factory.CreateClient();
        var email = $"reset-flow-{Guid.NewGuid()}@example.com";
        const string oldPassword = "OriginalPass123";
        const string newPassword = "BrandNewPass456";
        await RegisterAsync(client, email, oldPassword);

        var sender = _factory.Services.GetRequiredService<TestPasswordResetEmailSender>();
        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var token = sender.ExtractToken();

        var resetResponse = await client.PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword });
        Assert.Equal(HttpStatusCode.NoContent, resetResponse.StatusCode);

        var oldLogin = await client.PostAsJsonAsync("/api/auth/login", new { email, password = oldPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);

        var newLogin = await client.PostAsJsonAsync("/api/auth/login", new { email, password = newPassword });
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_TokenIsSingleUse_ASecondAttemptWithTheSameTokenIsRejected()
    {
        var client = _factory.CreateClient();
        var email = $"single-use-{Guid.NewGuid()}@example.com";
        await RegisterAsync(client, email, "OriginalPass123");

        var sender = _factory.Services.GetRequiredService<TestPasswordResetEmailSender>();
        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var token = sender.ExtractToken();

        var firstAttempt = await client.PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword = "FirstNewPass123" });
        Assert.Equal(HttpStatusCode.NoContent, firstAttempt.StatusCode);

        var secondAttempt = await client.PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword = "SecondNewPass456" });
        Assert.Equal(HttpStatusCode.BadRequest, secondAttempt.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_RedeemingOneToken_RevokesOtherOutstandingTokensForTheSameUser()
    {
        var client = _factory.CreateClient();
        var email = $"multi-request-{Guid.NewGuid()}@example.com";
        await RegisterAsync(client, email, "OriginalPass123");

        var sender = _factory.Services.GetRequiredService<TestPasswordResetEmailSender>();

        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var firstToken = sender.ExtractToken();

        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var secondToken = sender.ExtractToken();

        var redeemSecond = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = secondToken, newPassword = "SecondNewPass456" });
        Assert.Equal(HttpStatusCode.NoContent, redeemSecond.StatusCode);

        // The first email's link is still sitting unread in an inbox; it must not still work now
        // that the password has already been changed via the second link.
        var replayFirst = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = firstToken, newPassword = "ThirdNewPass789" });
        Assert.Equal(HttpStatusCode.BadRequest, replayFirst.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithAnUnknownToken_ReturnsBadRequest()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = "not-a-real-token", newPassword = "SomeNewPass123" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithAnExpiredToken_ReturnsBadRequest()
    {
        var client = _factory.CreateClient();
        var email = $"expired-{Guid.NewGuid()}@example.com";
        await RegisterAsync(client, email, "OriginalPass123");

        var sender = _factory.Services.GetRequiredService<TestPasswordResetEmailSender>();
        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var token = sender.ExtractToken();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var stored = await db.PasswordResetTokens.Include(t => t.User).SingleAsync(t => t.User.Email == email);
            stored.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        var response = await client.PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword = "SomeNewPass123" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task RegisterAsync(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { displayName = "Reset Test User", email, password });
        response.EnsureSuccessStatusCode();
    }
}
