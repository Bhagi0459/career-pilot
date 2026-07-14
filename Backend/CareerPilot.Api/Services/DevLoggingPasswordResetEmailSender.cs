namespace CareerPilot.Api.Services;

/// <summary>
/// Development-only stand-in for real email delivery: writes the reset link to the console/log
/// instead of sending it, so the flow can be exercised locally with no email provider set up.
/// Registered only when the host environment is Development - see Program.cs.
/// </summary>
public class DevLoggingPasswordResetEmailSender(ILogger<DevLoggingPasswordResetEmailSender> logger) : IPasswordResetEmailSender
{
    public Task SendAsync(string toEmail, string resetUrl, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "[DEV ONLY - not sent] Password reset link for {Email}: {ResetUrl}",
            toEmail,
            resetUrl);
        return Task.CompletedTask;
    }
}
