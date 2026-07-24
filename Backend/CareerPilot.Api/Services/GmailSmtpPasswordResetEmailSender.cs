using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace CareerPilot.Api.Services;

/// <summary>
/// Sends password reset emails through Gmail's SMTP relay using an account App Password
/// (Google Account -> Security -> 2-Step Verification -> App Passwords), not the account's
/// real login password. Registered in production when Email:GmailAddress and Email:AppPassword
/// are configured - see Program.cs.
/// </summary>
public class GmailSmtpPasswordResetEmailSender(
    IConfiguration configuration,
    ILogger<GmailSmtpPasswordResetEmailSender> logger) : IPasswordResetEmailSender
{
    public async Task SendAsync(string toEmail, string resetUrl, CancellationToken cancellationToken = default)
    {
        var gmailAddress = configuration["Email:GmailAddress"]
            ?? throw new InvalidOperationException("Email:GmailAddress is not configured.");
        var appPassword = configuration["Email:AppPassword"]
            ?? throw new InvalidOperationException("Email:AppPassword is not configured.");

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(gmailAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Reset your CareerPilot password";
        message.Body = new TextPart("plain")
        {
            Text = $"We received a request to reset your CareerPilot password.\n\n" +
                   $"Reset it here (link expires in 30 minutes):\n{resetUrl}\n\n" +
                   $"If you didn't request this, you can safely ignore this email."
        };

        using var client = new SmtpClient();
        await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(gmailAddress, appPassword, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);

        logger.LogInformation("Password reset email sent to {Email}", toEmail);
    }
}
