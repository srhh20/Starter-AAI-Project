// Loads the six demo users from brief section 7.2 / design Reference B.
// AC-14: safe to run repeatedly — clears Users first, so no duplicates.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Every demo account shares this password; only the bcrypt hash is stored.
const DEMO_PASSWORD = "password123";

const USERS = [
  {
    name: "Employee 1",
    icNo: "00-148888",
    email: "employee-1@budiman.com",
    role: "Employee",
    division: "Finance",
    designation: "Accounts Clerk",
  },
  {
    name: "Supervisor 1",
    icNo: "00-157777",
    email: "supervisor-1@budiman.com",
    role: "Supervisor",
    division: "Finance",
    designation: "Finance Manager",
  },
  {
    name: "Supervisor 2",
    icNo: "00-166666",
    email: "supervisor-2@budiman.com",
    role: "Supervisor",
    division: "Finance",
    designation: "Accountant",
  },
  {
    name: "HR 1",
    icNo: "00-175555",
    email: "hr-1@budiman.com",
    role: "HR",
    division: "Human Resources",
    designation: "HR Officer",
  },
  {
    name: "HR 2",
    icNo: "00-184444",
    email: "hr-2@budiman.com",
    role: "HR",
    division: "Human Resources",
    designation: "HR Officer",
  },
  {
    name: "Admin",
    icNo: "00-193333",
    email: "admin@budiman.com",
    role: "Admin",
    division: "Admin",
    designation: "Admin Manager",
  },
];

async function main() {
  await prisma.user.deleteMany();
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  for (const user of USERS) {
    await prisma.user.create({ data: { ...user, passwordHash } });
  }
  console.log(`Seeded ${USERS.length} demo users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
