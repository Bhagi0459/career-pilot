using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CareerPilot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRecruiterPhoneNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "Recruiters",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "Recruiters");
        }
    }
}
