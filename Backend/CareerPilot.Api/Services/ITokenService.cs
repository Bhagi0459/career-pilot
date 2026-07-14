using CareerPilot.Api.Models;

namespace CareerPilot.Api.Services;

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) CreateToken(User user);
}
