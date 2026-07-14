namespace CareerPilot.Api.Services;

public interface IPasswordResetEmailSender
{
    Task SendAsync(string toEmail, string resetUrl, CancellationToken cancellationToken = default);
}
