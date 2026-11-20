// Loads the six demo users from brief §7.2 / design Reference B and the
// five leave types from brief §7.2 / design Reference C.
// AC-14 (users) and Task 10 (types): safe to run repeatedly — clears the
// tables first, so no duplicates. Wipe order is children before parents so
// no leave row ever points at a deleted user (leave design §6).
// AuditLog joins this order in Task 23 (X5), before LeaveRequest.
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

// The five choices for the leave form, verbatim from brief §7.2, with the
// Notes column as the optional helper description.
const LEAVE_TYPES = [
  { name: "Annual leave", description: "Yearly paid leave" },
  {
    name: "Maternity leave",
    description: "For employees who are expecting or have just given birth",
  },
  { name: "Unpaid leave", description: "Leave without pay" },
  {
    name: "Compassionate leave",
    description: "For a family emergency or bereavement",
  },
  { name: "Other", description: "The employee must write what is for" },
];

async function main() {
  // Children before parents (leave design §6): requests point at both
  // Users and LeaveTypes, so they go first. AuditLog joins this order
  // with Task 23 (X5).
  await prisma.leaveRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.leaveType.deleteMany();

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  for (const user of USERS) {
    await prisma.user.create({ data: { ...user, passwordHash } });
  }
  for (const type of LEAVE_TYPES) {
    await prisma.leaveType.create({ data: type });
  }
  console.log(
    `Seeded ${USERS.length} demo users and ${LEAVE_TYPES.length} leave types.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
