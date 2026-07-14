using CareerPilot.Api.Data;
using CareerPilot.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CareerPilot.Api.Tests;

/// <summary>
/// Boots the real API pipeline (auth, controllers, validation) against an isolated
/// EF Core InMemory database instead of the configured Neon/Postgres connection, so
/// tests never touch real data. Each instance gets its own database.
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"careerpilot-tests-{Guid.NewGuid()}";

    public CustomWebApplicationFactory()
    {
        // Program.cs throws at startup if these are missing; they're never used to
        // actually connect since the DbContext registration is replaced below.
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", "Host=localhost;Database=unused;Username=unused;Password=unused");
        Environment.SetEnvironmentVariable("Jwt__Key", "test-only-signing-key-do-not-use-in-production-0123456789");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // AddDbContext registers more than just DbContextOptions<AppDbContext> - EF Core
            // combines every IDbContextOptionsConfiguration<AppDbContext> singleton when the
            // options are resolved. Removing only the options descriptor leaves the original
            // UseNpgsql configuration in place alongside our UseInMemoryDatabase one, which EF
            // then rejects as two providers registered for the same context. Strip anything
            // keyed to AppDbContext before re-adding it.
            var descriptorsToRemove = services
                .Where(d => d.ServiceType == typeof(AppDbContext)
                    || (d.ServiceType.IsGenericType && d.ServiceType.GetGenericArguments().Contains(typeof(AppDbContext))))
                .ToList();

            foreach (var descriptor in descriptorsToRemove)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(_databaseName));

            // Real delivery (Development-logging or the unconfigured-in-production stub) is
            // replaced with a fake that captures the reset link, since tests need the raw token
            // the same way a user would pull it from their inbox - the API never returns it.
            services.RemoveAll<IPasswordResetEmailSender>();
            services.AddSingleton<TestPasswordResetEmailSender>();
            services.AddSingleton<IPasswordResetEmailSender>(sp => sp.GetRequiredService<TestPasswordResetEmailSender>());
        });
    }
}
