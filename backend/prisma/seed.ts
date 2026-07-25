import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Seed the deterministic red-flag rules from the spec so the admin rules
  // screen and the Phase 6 rule engine have real data to work against.
  const rules = [
    {
      name: "Chest pain with sweating",
      description: "Classic cardiac red flag — always routed as an emergency.",
      condition: { allOf: ["chest_pain", "sweating"] },
      resultingUrgency: "EMERGENCY" as const,
    },
    {
      name: "Difficulty breathing",
      description: "Respiratory distress of any severity is treated as an emergency.",
      condition: { anyOf: ["difficulty_breathing", "shortness_of_breath"] },
      resultingUrgency: "EMERGENCY" as const,
    },
    {
      name: "Head injury",
      description: "Any reported head injury, regardless of other symptoms.",
      condition: { anyOf: ["head_injury"] },
      resultingUrgency: "EMERGENCY" as const,
    },
    {
      name: "High fever in an infant",
      description: "High fever reported for a patient under 1 year old.",
      condition: { allOf: ["high_fever"], ageUnder: 1 },
      resultingUrgency: "URGENT" as const,
    },
    {
      name: "Minor cold symptoms",
      description: "Routine cold/flu symptoms with no red flags present.",
      condition: { allOf: ["minor_cold_symptoms"] },
      resultingUrgency: "ROUTINE" as const,
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.rule.findFirst({ where: { name: rule.name } });
    if (!existing) await prisma.rule.create({ data: rule });
  }

  const adminEmail = "admin@triage.local";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        authProviderId: `local:${adminEmail}`,
        email: adminEmail,
        passwordHash: await bcrypt.hash("ChangeMe123!", 12),
        role: "ADMIN",
        firstName: "System",
        lastName: "Admin",
      },
    });
    console.log(`Seeded admin user: ${adminEmail} / ChangeMe123! (change immediately)`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
