using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace CareerPilot.Api.Common;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal principal)
    {
        var subject = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (subject is null || !int.TryParse(subject, out var userId))
        {
            throw new InvalidOperationException("The current principal does not have a valid user id claim.");
        }

        return userId;
    }
}
