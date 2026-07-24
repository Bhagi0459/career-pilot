using System.Text;
using System.Text.Json.Serialization;
using CareerPilot.Api.Data;
using CareerPilot.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Render (and most PaaS hosts) assign the container a port at runtime via PORT and route
// external traffic to it; ASP.NET Core doesn't read that variable on its own, so without this the
// app keeps listening on its build-time default and the platform's health checks can never reach
// it. Falls back to Kestrel's normal default when running locally, where PORT isn't set.
var port = builder.Configuration["PORT"];
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Connection string 'DefaultConnection' is not configured. " +
        "Set it locally with `dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"<neon-connection-string>\"`, " +
        "or via the ConnectionStrings__DefaultConnection environment variable in production.");

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "Jwt:Key is not configured. Set it locally with `dotnet user-secrets set \"Jwt:Key\" \"<a-long-random-secret>\"`, " +
        "or via the Jwt__Key environment variable in production.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "CareerPilot.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "CareerPilot.Client";

builder.Services.AddSingleton<ITokenService, TokenService>();

var gmailConfigured = !string.IsNullOrEmpty(builder.Configuration["Email:GmailAddress"])
    && !string.IsNullOrEmpty(builder.Configuration["Email:AppPassword"]);

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddScoped<IPasswordResetEmailSender, DevLoggingPasswordResetEmailSender>();
}
else if (gmailConfigured)
{
    builder.Services.AddScoped<IPasswordResetEmailSender, GmailSmtpPasswordResetEmailSender>();
}
else
{
    // Email:GmailAddress / Email:AppPassword aren't set (e.g. Email__GmailAddress /
    // Email__AppPassword env vars missing in this deployment) - fall back to a safe no-op
    // instead of crashing at startup.
    builder.Services.AddScoped<IPasswordResetEmailSender, UnconfiguredPasswordResetEmailSender>();
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });

builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:4200"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // `ng serve` can be reached as either localhost or 127.0.0.1, over http or (with
            // --ssl) https, and on a port other than 4200 if that one's taken. Matching only the
            // single configured origin silently breaks the moment the browser uses a different
            // variant - the preflight still returns 204 (CORS middleware always answers OPTIONS
            // that way), but without an Access-Control-Allow-Origin header, so the follow-up
            // request gets blocked client-side. Validate against loopback hosts instead of a
            // fixed string; this is still an explicit allow-list check, not AllowAnyOrigin, and
            // only applies in Development.
            policy.SetIsOriginAllowed(origin =>
                Uri.TryCreate(origin, UriKind.Absolute, out var originUri) &&
                originUri.Host is "localhost" or "127.0.0.1");
        }
        else
        {
            policy.WithOrigins(allowedOrigins);
        }

        policy.AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddProblemDetails();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Components ??= new();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Enter a valid JWT token (no 'Bearer ' prefix needed)."
        };
        return Task.CompletedTask;
    });
});

var app = builder.Build();

// Render terminates TLS at its edge and forwards plain HTTP to the container, marking the
// original scheme via X-Forwarded-Proto. Without this, UseHttpsRedirection below has no way to
// know the request was already HTTPS and would 307-redirect every request, which the proxy then
// forwards right back as HTTP again - an infinite redirect loop. Clearing the known
// networks/proxies list is safe here because the container has no public inbound path other than
// through Render's own edge proxy.
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
// KnownIPNetworks/KnownProxies default to loopback-only, which would ignore headers set by
// Render's proxy. Object-initializer `{ }` on these properties would call Add() zero times and
// leave the loopback-only defaults in place, so they have to be cleared explicitly instead.
forwardedHeadersOptions.KnownIPNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

// Unauthenticated liveness/readiness probe for Render's health checks - no CORS or auth concerns
// since it's called server-to-server, not from the browser.
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// UseExceptionHandler's default (parameterless) behavior writes the ProblemDetails response
// inline from within its own catch block, after calling Response.Clear() - which wipes any
// headers set by middleware earlier in the pipeline, including the CORS headers UseCors would
// have added. Without this branch, an unhandled exception (e.g. a transient database blip)
// produces a response with no Access-Control-Allow-Origin header, which the browser reports as a
// CORS failure instead of surfacing the real 500 to the frontend. Re-running UseCors inside the
// error branch ensures 5xx responses still carry the right CORS headers.
app.UseExceptionHandler(errorApp =>
{
    errorApp.UseCors("AllowAngular");
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        var problemDetailsService = context.RequestServices.GetService<IProblemDetailsService>();
        if (problemDetailsService is not null)
        {
            await problemDetailsService.WriteAsync(new ProblemDetailsContext { HttpContext = context });
        }
    });
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // interactive docs at /scalar/v1
}
else
{
    // Local dev (Kestrel with only an http:// endpoint) has no https port to redirect
    // to, which just produces a startup warning. Production (Render, behind a proxy
    // that terminates TLS) keeps this middleware.
    app.UseHttpsRedirection();
}

app.UseCors("AllowAngular");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Exposes the implicit Program class to WebApplicationFactory<Program> in the test project.
public partial class Program;
