# Render builds this with the service's Root Directory set to Backend/CareerPilot.Api, so all
# paths below are relative to this project folder, not the repo root.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first with just the project file so this layer is cached across builds that only change
# application code.
COPY CareerPilot.Api.csproj .
RUN dotnet restore CareerPilot.Api.csproj

COPY . .
RUN dotnet publish CareerPilot.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_ENVIRONMENT=Production
# Actual listen port is read from the platform-provided PORT env var at startup (see Program.cs);
# this is just the documented/default fallback for running the image outside Render.
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "CareerPilot.Api.dll"]
