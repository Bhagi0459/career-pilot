namespace CareerPilot.Api.Services;

/// <summary>
/// Default non-Development implementation: no real email provider is wired up yet, so this
/// deliberately does not send anything and never logs the email address or reset URL (both would
/// be sensitive data in a production log). It only records that delivery was skipped, so the gap
/// is visible in monitoring instead of failing the request or silently pretending to succeed.
/// Replace this registration in Program.cs with a real provider (see README/report) before
/// relying on this flow in production.
/// </summary>
public class UnconfiguredPasswordResetEmailSender(ILogger<UnconfiguredPasswordResetEmailSender> logger) : IPasswordResetEmailSender
{
    public Task SendAsync(string toEmail, string resetUrl, CancellationToken cancellationToken = default)
    {
        logger.LogWarning(
            "Password reset was requested but no production email provider is configured - " +
            "no email was sent. Register a real IPasswordResetEmailSender implementation.");
        return Task.CompletedTask;
    }
}
