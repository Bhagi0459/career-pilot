using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace CareerPilot.Api.Tests;

/// <summary>
/// CustomWebApplicationFactory raises the auth rate limit sky-high so every other test class can
/// fire auth requests freely. This factory does the opposite - it dials the limit down to
/// something a single test method can actually exceed on purpose, via in-memory configuration
/// (not an environment variable), so it doesn't race with the process-wide override the other
/// test classes rely on.
/// </summary>
public class LowAuthRateLimitWebApplicationFactory : CustomWebApplicationFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RateLimiting:Auth:PermitLimit"] = "3",
                ["RateLimiting:Auth:WindowSeconds"] = "60"
            });
        });
    }
}

public class RateLimitingTests : IClassFixture<LowAuthRateLimitWebApplicationFactory>
{
    private readonly LowAuthRateLimitWebApplicationFactory _factory;

    public RateLimitingTests(LowAuthRateLimitWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_BeyondThePermitLimit_IsThrottledWithA429AndAClearMessage()
    {
        var client = _factory.CreateClient();
        var credentials = new { email = "nobody@example.com", password = "wrong-password" };

        // The factory caps this policy at 3 requests/minute per IP - the first 3 should behave
        // normally (rejected as bad credentials, not throttled).
        for (var i = 0; i < 3; i++)
        {
            var response = await client.PostAsJsonAsync("/api/auth/login", credentials);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // The 4th request in the same window should be throttled before it ever reaches the
        // controller/database.
        var throttled = await client.PostAsJsonAsync("/api/auth/login", credentials);
        Assert.Equal(HttpStatusCode.TooManyRequests, throttled.StatusCode);

        var body = await throttled.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("Too many requests. Please wait a moment and try again.", body?["message"]);
    }
}
