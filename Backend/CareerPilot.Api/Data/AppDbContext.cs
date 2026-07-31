using CareerPilot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CareerPilot.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Recruiter> Recruiters => Set<Recruiter>();
    public DbSet<JobApplication> JobApplications => Set<JobApplication>();
    public DbSet<Interview> Interviews => Set<Interview>();
    public DbSet<FollowUp> FollowUps => Set<FollowUp>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.DisplayName).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<Company>(entity =>
        {
            entity.HasOne(c => c.User)
                .WithMany(u => u.Companies)
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Recruiter>(entity =>
        {
            entity.HasOne(r => r.User)
                .WithMany(u => u.Recruiters)
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Company)
                .WithMany(c => c.Recruiters)
                .HasForeignKey(r => r.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JobApplication>(entity =>
        {
            entity.HasOne(a => a.User)
                .WithMany(u => u.JobApplications)
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(a => a.Company)
                .WithMany(c => c.JobApplications)
                .HasForeignKey(a => a.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(a => a.Recruiter)
                .WithMany(r => r.JobApplications)
                .HasForeignKey(a => a.RecruiterId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Interview>(entity =>
        {
            entity.HasOne(i => i.JobApplication)
                .WithMany(a => a.Interviews)
                .HasForeignKey(i => i.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FollowUp>(entity =>
        {
            entity.HasOne(f => f.JobApplication)
                .WithMany(a => a.FollowUps)
                .HasForeignKey(f => f.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.HasIndex(t => t.TokenHash).IsUnique();
            entity.Property(t => t.TokenHash).HasMaxLength(128).IsRequired();

            entity.HasOne(t => t.User)
                .WithMany(u => u.PasswordResetTokens)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
