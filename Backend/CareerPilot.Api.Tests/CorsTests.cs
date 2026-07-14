using System.Net.Http.Headers;
using Xunit;

namespace CareerPilot.Api.Tests;

/// <summary>
/// Covers the actual bug: the dev CORS policy only ever matched the single exact string
/// "http://localhost:4200", so any other loopback variant the browser might use - 127.0.0.1,
/// https, or a different port when 4200 is taken - got a preflight that "succeeded" (204) but
/// carried no Access-Control-Allow-Origin header, which the browser then reports as a CORS
/// failure on the real request. CustomWebApplicationFactory doesn't override the environment, so
/// these run against the Development policy (see Program.cs).
/// </summary>
public class CorsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public CorsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("http://localhost:4200")]
    [InlineData("http://127.0.0.1:4200")]
    [InlineData("https://localhost:4200")]
    [InlineData("http://localhost:4300")]
    public async Task Preflight_FromALoopbackOrigin_IsAllowed(string origin)
    {
        var client = _factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.TryGetValues("Access-Control-Allow-Origin", out var allowOrigin));
        Assert.Equal(origin, Assert.Single(allowOrigin!));
    }

    [Fact]
    public async Task Preflight_FromANonLoopbackOrigin_IsNotAllowed()
    {
        var client = _factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", "http://evil.example.com");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");

        var response = await client.SendAsync(request);

        // ASP.NET Core's CORS middleware still answers a preflight with 204 even when the origin
        // doesn't match the policy - it just omits the allow header, which is what actually makes
        // the browser block the follow-up request. The 204 alone would look like success in a
        // Network tab, so the header is the real assertion here.
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task ActualRequest_FromAnAllowedOrigin_CarriesTheAllowOriginHeaderEvenOnA4xxResponse()
    {
        var client = _factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent("{\"email\":\"nobody@example.com\",\"password\":\"wrong\"}")
        };
        request.Headers.Add("Origin", "http://127.0.0.1:4200");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.TryGetValues("Access-Control-Allow-Origin", out var allowOrigin));
        Assert.Equal("http://127.0.0.1:4200", Assert.Single(allowOrigin!));
    }

    private static HttpContent JsonContent(string json)
    {
        var content = new StringContent(json);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        return content;
    }
}
