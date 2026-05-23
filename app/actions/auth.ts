"use server";

import { prisma } from "@/app/db";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

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
 * @param formData - The user details for sign-up
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
    const { name, email, password, role, prn, inviteCode, department, year, division } = data;

    // 1. Basic validation
    if (!name || name.trim().length === 0) {
      return { success: false, error: "Name is required." };
    }

    if (!email || !email.includes("@")) {
      return { success: false, error: "A valid email address is required." };
    }

    if (!password || password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    // 2. Role-specific validation
    if (role === "STUDENT") {
      if (!prn || prn.trim().length === 0) {
        return { success: false, error: "PRN (Permanent Registration Number) is required for students." };
      }
      if (!department || department.trim().length === 0) {
        return { success: false, error: "Department is required for students." };
      }
      if (!year || year.trim().length === 0) {
        return { success: false, error: "Year is required for students." };
      }
      if (!division || division.trim().length === 0) {
        return { success: false, error: "Division is required for students." };
      }

      // Check if PRN is already registered
      const existingPrn = await prisma.user.findUnique({
        where: { prn: prn.trim() },
      });
      if (existingPrn) {
        return { success: false, error: "A student with this PRN is already registered." };
      }
    } else if (role === "TEACHER") {
      if (!department || department.trim().length === 0) {
        return { success: false, error: "Department is required for teachers." };
      }
      const allowedDomain = process.env.TEACHER_EMAIL_DOMAIN;
      const requiredInviteCode = process.env.TEACHER_SIGNUP_CODE || "SMART_TEACHER_2026";
      
      const userDomain = email.split("@")[1]?.toLowerCase();
      const hasInstitutionalEmail = allowedDomain
        ? allowedDomain.split(",").map((d) => d.trim().toLowerCase()).includes(userDomain || "")
        : false;

      // If they do not have an institutional email, they must provide the correct invite code
      if (!hasInstitutionalEmail) {
        if (!inviteCode || inviteCode.trim() !== requiredInviteCode) {
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
      where: { email: email.toLowerCase().trim() },
    });
    if (existingEmail) {
      return { success: false, error: "An account with this email address already exists." };
    }

    // 4. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create user in database
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        prn: role === "STUDENT" ? prn?.trim() : null,
        department: department?.trim() || null,
        year: role === "STUDENT" ? (year?.trim() || null) : null,
        division: role === "STUDENT" ? (division?.trim() || null) : null,
      },
    });

    // 6. Handle automatic batch mapping for students
    if (role === "STUDENT" && department && year && division) {
      const yearMap: Record<string, string> = {
        "First Year": "FY",
        "Second Year": "SY",
        "Third Year": "TY",
        "Fourth Year": "BE"
      };
      const yearCode = yearMap[year.trim()] || year.trim();
      const batchName = `${yearCode} ${department.trim()} ${division.trim()}`;

      // Find or create global batch for this combination
      let batch = await prisma.batch.findFirst({
        where: {
          name: batchName,
          department: department.trim()
        }
      });

      if (!batch) {
        batch = await prisma.batch.create({
          data: {
            name: batchName,
            department: department.trim(),
            teacherId: null // Global department batch
          }
        });
      }

      // Enroll student in this batch
      await prisma.batch.update({
        where: { id: batch.id },
        data: {
          students: {
            connect: { id: user.id }
          }
        }
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
    console.error("Sign-up Server Action Error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during registration. Please try again.",
    };
  }
}
