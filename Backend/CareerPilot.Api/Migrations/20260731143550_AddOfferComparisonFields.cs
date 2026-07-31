using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CareerPilot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOfferComparisonFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Benefits",
                table: "JobApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OfferDeadline",
                table: "JobApplications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Salary",
                table: "JobApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WorkMode",
                table: "JobApplications",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Benefits",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "OfferDeadline",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "Salary",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "WorkMode",
                table: "JobApplications");
        }
    }
}
