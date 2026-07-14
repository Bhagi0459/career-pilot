using CareerPilot.Api.Services;
using Microsoft.AspNetCore.WebUtilities;

namespace CareerPilot.Api.Tests;

/// <summary>
/// Captures the last "sent" reset email instead of delivering or logging it, so tests can pull
/// the raw reset token out of the URL the same way a real user would from their inbox - the API
/// itself never returns the token in a response body.
/// </summary>
public class TestPasswordResetEmailSender : IPasswordResetEmailSender
{
    public string? LastEmail { get; private set; }
    public string? LastResetUrl { get; private set; }
    public int SendCount { get; private set; }

    public Task SendAsync(string toEmail, string resetUrl, CancellationToken cancellationToken = default)
    {
        LastEmail = toEmail;
        LastResetUrl = resetUrl;
        SendCount++;
        return Task.CompletedTask;
    }

    public string ExtractToken()
    {
        var uri = new Uri(LastResetUrl ?? throw new InvalidOperationException("No reset email was sent."));
        var query = QueryHelpers.ParseQuery(uri.Query);
        return query.TryGetValue("token", out var token)
            ? token.ToString()
            : throw new InvalidOperationException("Reset URL had no token query parameter.");
    }
}
