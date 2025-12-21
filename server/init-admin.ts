import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateSecurePassword(length: number = 16): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  const randomValues = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }
  return password;
}

export async function initializeAdmin() {
  try {
    // Check if admin user already exists
    const existingAdmin = await db.select()
      .from(users)
      .where(eq(users.role, "ADMIN"))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log("[init] Admin user already exists");
      return;
    }

    // Get admin credentials from environment or generate secure random password
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminEmail = process.env.ADMIN_EMAIL || "admin@podcasthub.local";
    const adminPassword = process.env.ADMIN_PASSWORD || generateSecurePassword();
    
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await db.insert(users).values({
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      bio: "Administrator",
      emailVerified: true,
    }).returning();

    console.log("[init] Admin user created successfully");
    console.log("[init] Username:", adminUsername);
    console.log("[init] Email:", adminEmail);
    
    // Only log password if it was auto-generated (not from env)
    if (!process.env.ADMIN_PASSWORD) {
      console.log("[init] Generated password:", adminPassword);
      console.log("[init] IMPORTANT: Save this password securely - it won't be shown again!");
    } else {
      console.log("[init] Password was set from ADMIN_PASSWORD environment variable");
    }
  } catch (error) {
    console.error("[init] Error creating admin user:", error);
  }
}
