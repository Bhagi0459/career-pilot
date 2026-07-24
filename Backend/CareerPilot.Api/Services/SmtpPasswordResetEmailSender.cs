using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace CareerPilot.Api.Services;

/// <summary>
/// Sends password reset emails over SMTP, configured entirely via Email:Host, Email:Port,
/// Email:Username, and Email:Password (Email:FromAddress optionally overrides the From header,
/// defaulting to Email:Username). Provider-agnostic - works with Gmail (smtp.gmail.com, an App
/// Password), GoDaddy Workspace Email (smtpout.secureserver.net), Microsoft 365 via GoDaddy
/// (smtp.office365.com), or any other SMTP relay, purely by changing config, not code.
/// Registered in production when Email:Host/Username/Password are configured - see Program.cs.
/// </summary>
public class SmtpPasswordResetEmailSender(
    IConfiguration configuration,
    ILogger<SmtpPasswordResetEmailSender> logger) : IPasswordResetEmailSender
{
    public async Task SendAsync(string toEmail, string resetUrl, CancellationToken cancellationToken = default)
    {
        var host = configuration["Email:Host"]
            ?? throw new InvalidOperationException("Email:Host is not configured.");
        var port = int.TryParse(configuration["Email:Port"], out var configuredPort) ? configuredPort : 587;
        var username = configuration["Email:Username"]
            ?? throw new InvalidOperationException("Email:Username is not configured.");
        var password = configuration["Email:Password"]
            ?? throw new InvalidOperationException("Email:Password is not configured.");
        var fromAddress = configuration["Email:FromAddress"] ?? username;

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Reset your CareerPilot password";
        message.Body = new TextPart("plain")
        {
            Text = $"We received a request to reset your CareerPilot password.\n\n" +
                   $"Reset it here (link expires in 30 minutes):\n{resetUrl}\n\n" +
                   $"If you didn't request this, you can safely ignore this email."
        };

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(username, password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);

        logger.LogInformation("Password reset email sent to {Email} via {Host}", toEmail, host);
    }
}
