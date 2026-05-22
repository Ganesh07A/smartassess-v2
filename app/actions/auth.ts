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
}): Promise<SignUpResponse> {
  try {
    const { name, email, password, role, prn, inviteCode } = data;

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

      // Check if PRN is already registered
      const existingPrn = await prisma.user.findUnique({
        where: { prn: prn.trim() },
      });
      if (existingPrn) {
        return { success: false, error: "A student with this PRN is already registered." };
      }
    } else if (role === "TEACHER") {
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
      },
    });

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
