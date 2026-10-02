"use server";

import { headers } from "next/headers";
import { prisma } from "@/app/db";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { parseInput, ValidationError } from "@/lib/validation/parse";
import { signUpSchema } from "@/lib/validation/schemas";
import { rateLimits } from "@/lib/rate-limit";

export interface SignUpResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
  };
}

/**
 * Handles the registration of new student and teacher accounts.
 * Checks for email/PRN uniqueness and validates the teacher sign-up invite code.
 *
 * @param data - The user details for sign-up
 */
export async function signUp(data: {
  name: string;
  email: string;
  password?: string;
  role: Role;
  prn?: string;
  inviteCode?: string;
  department?: string;
  year?: string;
  division?: string;
}): Promise<SignUpResponse> {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await rateLimits.signUp(ip);

    // 1. Runtime validation (types are erased at runtime; this is a public endpoint).
    const input = parseInput(signUpSchema, {
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      prn: data.prn,
      inviteCode: data.inviteCode,
      department: data.department,
      year: data.year,
      division: data.division,
    });

    // 2. Role-specific validation
    if (input.role === "STUDENT") {
      const existingPrn = await prisma.user.findUnique({
        where: { prn: input.prn!.trim() },
        select: { id: true },
      });
      if (existingPrn) {
        return { success: false, error: "A student with this PRN is already registered." };
      }
    } else if (input.role === "TEACHER") {
      const allowedDomain = process.env.TEACHER_EMAIL_DOMAIN;
      const requiredInviteCode = process.env.TEACHER_SIGNUP_CODE;

      // Fail closed: if no invite code is configured, only institutional emails may register.
      if (!allowedDomain && !requiredInviteCode) {
        console.error(
          "Teacher sign-up is disabled: configure TEACHER_EMAIL_DOMAIN or TEACHER_SIGNUP_CODE.",
        );
        return { success: false, error: "Teacher registration is currently disabled." };
      }

      const userDomain = input.email.split("@")[1]?.toLowerCase();
      const hasInstitutionalEmail = allowedDomain
        ? allowedDomain
            .split(",")
            .map((domain) => domain.trim().toLowerCase())
            .includes(userDomain || "")
        : false;

      // If they do not have an institutional email, they must provide the correct invite code
      if (!hasInstitutionalEmail) {
        if (!requiredInviteCode || input.inviteCode !== requiredInviteCode) {
          const errorMsg = allowedDomain
            ? `Invalid registration. Please use an institutional email (${allowedDomain}) or provide a valid Admin Invite Code.`
            : "Invalid Admin Invite Code for teacher registration.";
          return { success: false, error: errorMsg };
        }
      }
    } else {
      return { success: false, error: "Invalid user role specified." };
    }

    // 3. Check for email uniqueness
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existingEmail) {
      return { success: false, error: "An account with this email address already exists." };
    }

    // 4. Hash the password
    const hashedPassword = await bcrypt.hash(input.password, 10);

    // 5. Create user in database
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: input.role,
        prn: input.role === "STUDENT" ? input.prn?.trim() : null,
        department: input.department?.trim() || null,
        year: input.role === "STUDENT" ? input.year?.trim() || null : null,
        division: input.role === "STUDENT" ? input.division?.trim() || null : null,
      },
    });

    // 6. Handle automatic batch mapping for students
    if (input.role === "STUDENT" && input.department && input.year && input.division) {
      const yearMap: Record<string, string> = {
        "First Year": "FY",
        "Second Year": "SY",
        "Third Year": "TY",
        "Fourth Year": "BE",
      };
      const yearCode = yearMap[input.year.trim()] || input.year.trim();
      const batchName = `${yearCode} ${input.department.trim()} ${input.division.trim()}`;

      // Find or create global batch for this combination
      let batch = await prisma.batch.findFirst({
        where: {
          name: batchName,
          department: input.department.trim(),
        },
        select: { id: true },
      });

      if (!batch) {
        batch = await prisma.batch.create({
          data: {
            name: batchName,
            department: input.department.trim(),
            teacherId: null, // Global department batch
          },
          select: { id: true },
        });
      }

      // Enroll student in this batch
      await prisma.batch.update({
        where: { id: batch.id },
        data: {
          students: {
            connect: { id: user.id },
          },
        },
      });
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email ?? "",
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.issues[0]?.message ?? "Invalid registration details." };
    }
    console.error("Sign-up Server Action Error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during registration. Please try again.",
    };
  }
}
