import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPodcastSchema, insertEpisodeSchema, registerSchema, loginSchema, youtubeImportSchema, localImportSchema, insertPlaylistSchema, insertAudiobookSchema, insertChapterSchema, insertSubscriptionPlanSchema } from "@shared/schema";
import { 
  updateUserRoleSchema, 
  updateUserApprovalSchema, 
  updateUserActiveSchema,
  updatePodcastStatusSchema,
  updateEpisodeStatusSchema,
  adminPodcastsQuerySchema,
  adminEpisodesQuerySchema,
  createEmailConfigSchema,
  updateEmailConfigSchema,
  bulkDeleteUsersSchema,
  bulkUpdateUsersRoleSchema,
  bulkUpdateUsersActiveSchema,
  bulkDeletePodcastsSchema,
  bulkUpdatePodcastsStatusSchema,
  bulkDeleteEpisodesSchema,
  bulkUpdateEpisodesStatusSchema,
} from "@shared/admin-schemas";
import { generateRSSFeed } from "./rss-generator";
import { getSiteUrl, getEpisodeCanonicalUrl, getEpisodeEmbedUrl, getEpisodeShareUrl, getEmbedIframeCode } from "./url-helpers";
import { resolveEpisodeArtwork, resolveEpisodeAudioUrl, resolvePodcastCoverArtUrl } from "./serializers/episode";
import { getEpisodeForResponse } from "./storage-service";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import { mediaOrchestrator } from "./media-orchestrator";
import { StorageService } from "./storage-service";
import { getEmailService } from "./email";
import { 
  getPlaylistMetadata, 
  getPlaylistVideos, 
  downloadAudioFromVideo, 
  downloadThumbnail,
  uploadAudioToStorage,
  uploadImageToStorage,
  cleanupTempFiles
} from "./youtube-import";
import path from "path";
import os from "os";
import fs from "fs";
import { parseFile, parseBuffer } from "music-metadata";
import { updateMP3MetadataBuffer } from "./id3-utils";
import * as paypalService from "./paypal-service";
import { invoiceService } from "./invoice-service";
import { insertBillingProfileSchema, type Invoice } from "@shared/schema";
import { syncToGitHub, getGitHubStatus, pullFromGitHub } from "./github-service";

// Helper functions for RSS feed generation
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDurationForRss(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Middleware to require authentication
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized - Please login" });
  }
  
  try {
    // Check if user is active
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isActive) {
      // User is deactivated, destroy session and clear cookie
      req.session.destroy(() => {});
      res.clearCookie("connect.sid");
      return res.status(403).json({ error: "Forbidden - Account deactivated" });
    }
    next();
  } catch (error) {
    console.error("Error checking user status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Middleware to require admin role
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized - Please login" });
  }
  
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Error checking admin role:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Multer configuration for regular file uploads (images, single audio)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max (for audio files)
  },
  fileFilter: (req, file, cb) => {
    // Allow images and audio files
    const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedAudioMimes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'];
    const allAllowedMimes = [...allowedImageMimes, ...allowedAudioMimes];

    if (allAllowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allAllowedMimes.join(', ')}`));
    }
  },
});

// Multer configuration for bulk local import (disk-based to avoid RAM exhaustion)
const uploadLocalImport = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Use /tmp directory for temporary storage
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      // Generate unique filename to avoid collisions
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB per file
    files: 51, // Max 50 audio files + 1 cover art
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audioFiles') {
      // Only allow MP3 for audio files
      const allowedAudioMimes = ['audio/mpeg', 'audio/mp3'];
      if (allowedAudioMimes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.mp3')) {
        cb(null, true);
      } else {
        cb(new Error('Only MP3 audio files are allowed'));
      }
    } else if (file.fieldname === 'coverArt') {
      // Allow images for cover art
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowedImageMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPEG, PNG, or WebP images are allowed for cover art'));
      }
    } else {
      cb(new Error('Unexpected field'));
    }
  },
});

// Multer configuration for single audio file replacement (disk-based)
const uploadSingleAudio = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `audioFile-${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedAudioMimes = ['audio/mpeg', 'audio/mp3'];
    if (allowedAudioMimes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos MP3'));
    }
  },
});

// Multer configuration for ZIP import
const uploadZip = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `import-${uniqueSuffix}.zip`);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB max for ZIP
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos ZIP'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Multer error handling middleware - must be registered after upload routes
  const handleMulterError = (error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Images must be ≤2MB, audio files ≤500MB.' });
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected field name in upload.' });
      }
      return res.status(400).json({ error: `Upload error: ${error.message}` });
    }
    
    // Handle custom file filter errors
    if (error.message && error.message.startsWith('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }
    
    // Pass to next error handler
    next(error);
  };

  // ==================== AUTH ROUTES ====================
  
  // Register new user
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email" });
      }

      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(validatedData.password, 10);
      
      // Generate email verification token (valid for 24 hours)
      const verificationToken = await bcrypt.hash(`${validatedData.email}-${Date.now()}`, 10);
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Create user
      const user = await storage.createUser({
        ...validatedData,
        passwordHash,
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiresAt: verificationExpiresAt,
      });

      // Set session
      req.session.userId = user.id;
      
      // Send verification email
      try {
        const emailService = await getEmailService(storage);
        const verificationUrl = `${getSiteUrl(req)}/verify-email?token=${encodeURIComponent(verificationToken)}`;
        await emailService.sendEmailVerification(user.email, user.username, verificationUrl);
        console.log(`Verification email sent to ${user.email}`);
        console.log(`Verification URL: ${verificationUrl}`);
      } catch (emailError) {
        // Log error but don't fail registration
        console.error(`Failed to send verification email to ${user.email}:`, emailError);
      }
      
      // Don't send password hash to client
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Set session
      req.session.userId = user.id;
      
      // Don't send password hash to client
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ==================== PROFILE ROUTES ====================
  
  // Get user profile
  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Get user invoices
  app.get("/api/my-invoices", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const invoicesData = await storage.getUserInvoices(userId);
      res.json(invoicesData);
    } catch (error) {
      console.error("Error fetching user invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // Update user profile
  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const updateSchema = z.object({
        username: z.string().min(3).max(50).optional(),
        email: z.string().email().optional(),
        bio: z.string().max(500).optional(),
        avatarUrl: z.string().url().optional().or(z.literal("")),
        website: z.string().url().optional().or(z.literal("")),
      });

      const validatedData = updateSchema.parse(req.body);

      // Check if username or email already exists (if being updated)
      if (validatedData.username) {
        const existingUser = await storage.getUserByUsername(validatedData.username);
        if (existingUser && existingUser.id !== req.session.userId) {
          return res.status(400).json({ error: "Username already taken" });
        }
      }

      if (validatedData.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser && existingUser.id !== req.session.userId) {
          return res.status(400).json({ error: "Email already in use" });
        }
      }

      const updatedUser = await storage.updateUserProfile(req.session.userId!, validatedData);
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Change password
  app.patch("/api/profile/password", requireAuth, async (req, res) => {
    try {
      const passwordSchema = z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(8, "New password must be at least 8 characters"),
      });

      const validatedData = passwordSchema.parse(req.body);

      // Verify current password
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isValidPassword = await bcrypt.compare(validatedData.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password and update
      const newPasswordHash = await bcrypt.hash(validatedData.newPassword, 10);
      await storage.updateUserPassword(req.session.userId!, newPasswordHash);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Request password reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email("Invalid email address"),
      });

      const { email } = schema.parse(req.body);

      const user = await storage.getUserByEmail(email);
      // Always return success even if user doesn't exist (security best practice)
      if (!user) {
        return res.json({ message: "If an account exists with that email, a password reset link has been sent." });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save token to database
      await storage.createPasswordResetToken({
        token: resetToken,
        userId: user.id,
        expiresAt,
      });

      // Send password reset email
      const resetUrl = `${getSiteUrl(req)}/reset-password?token=${resetToken}`;
      
      try {
        const emailService = await getEmailService(storage);
        await emailService.sendPasswordResetEmail(user.email, user.username, resetUrl);
        console.log(`Password reset email sent to ${email}`);
      } catch (emailError) {
        // Log error but don't fail the request (for security, don't reveal if email failed)
        console.error(`Failed to send password reset email to ${email}:`, emailError);
        // Still log the reset URL for development/debugging
        console.log(`Reset URL (email failed): ${resetUrl}`);
      }

      res.json({ message: "If an account exists with that email, a password reset link has been sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error requesting password reset:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const schema = z.object({
        token: z.string().min(1, "Token is required"),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      });

      const { token, newPassword } = schema.parse(req.body);

      // Get token from database
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Check if token is expired
      if (resetToken.expiresAt < new Date()) {
        return res.status(400).json({ error: "Reset token has expired" });
      }

      // Check if token has already been used
      if (resetToken.usedAt) {
        return res.status(400).json({ error: "Reset token has already been used" });
      }

      // Hash new password and update user
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(resetToken.userId, passwordHash);

      // Mark token as used
      await storage.markPasswordResetTokenUsed(token);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Verify email with token
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const schema = z.object({
        token: z.string().min(1, "Token is required"),
      });

      const { token } = schema.parse(req.body);

      // Find user by verification token
      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }

      // Check if token is expired
      if (user.emailVerificationTokenExpiresAt && user.emailVerificationTokenExpiresAt < new Date()) {
        return res.status(400).json({ error: "Verification token has expired" });
      }

      // Check if email is already verified
      if (user.emailVerified) {
        return res.json({ message: "Email already verified" });
      }

      // Mark email as verified and clear token
      await storage.verifyUserEmail(user.id);

      res.json({ message: "Email verified successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error verifying email:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }

      // Generate new verification token (valid for 24 hours)
      const verificationToken = await bcrypt.hash(`${user.email}-${Date.now()}`, 10);
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Update user with new token
      await storage.updateUserVerificationToken(user.id, verificationToken, verificationExpiresAt);

      // Send verification email
      try {
        const emailService = await getEmailService(storage);
        const verificationUrl = `${getSiteUrl(req)}/verify-email?token=${encodeURIComponent(verificationToken)}`;
        await emailService.sendEmailVerification(user.email, user.username, verificationUrl);
        console.log(`Verification email resent to ${user.email}`);
        console.log(`Verification URL: ${verificationUrl}`);
      } catch (emailError) {
        console.error(`Failed to resend verification email to ${user.email}:`, emailError);
        return res.status(500).json({ error: "Failed to send verification email" });
      }

      res.json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Error resending verification email:", error);
      res.status(500).json({ error: "Failed to resend verification email" });
    }
  });

  // ==================== UPLOAD ROUTES ====================
  
  // Upload cover art image (protected - requires authentication)
  app.post("/api/uploads/cover", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Validate file type is image
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedImageMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed." });
      }

      // Validate file size (2MB for images)
      const maxImageSize = 2 * 1024 * 1024; // 2MB
      if (req.file.size > maxImageSize) {
        return res.status(400).json({ error: "File too large. Maximum size for images is 2MB." });
      }

      // Optional: podcastId from query/body for linking
      const podcastId = req.body.podcastId || req.query.podcastId as string | undefined;

      // Save file using media orchestrator
      const asset = await mediaOrchestrator.saveCoverArt(req.file, req.session.userId!, podcastId);

      res.status(201).json({
        id: asset.id,
        assetId: asset.id, // Add assetId for frontend compatibility
        publicUrl: asset.publicUrl,
        storageProvider: asset.storageProvider,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      });
    } catch (error) {
      console.error("Error uploading cover art:", error);
      res.status(500).json({ error: "Failed to upload cover art" });
    }
  });

  // Upload episode audio (protected - requires authentication)
  app.post("/api/uploads/audio", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Validate file type is audio
      const allowedAudioMimes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'];
      if (!allowedAudioMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Only MP3, M4A, and WAV audio files are allowed." });
      }

      // Validate file size (500MB for audio)
      const maxAudioSize = 500 * 1024 * 1024; // 500MB
      if (req.file.size > maxAudioSize) {
        return res.status(400).json({ error: "File too large. Maximum size for audio is 500MB." });
      }

      // Optional: episodeId and podcastId from query/body for linking
      const episodeId = req.body.episodeId || req.query.episodeId as string | undefined;
      const podcastId = req.body.podcastId || req.query.podcastId as string | undefined;

      // Save file using media orchestrator
      const asset = await mediaOrchestrator.saveEpisodeAudio(req.file, req.session.userId!, episodeId, podcastId);

      // Extract duration from audio file
      let duration = 0;
      try {
        const metadata = await parseBuffer(req.file.buffer, req.file.mimetype);
        duration = Math.round(metadata.format.duration || 0);
      } catch (metadataError) {
        console.warn(`Could not extract duration from ${req.file.originalname}:`, metadataError);
      }

      res.status(201).json({
        id: asset.id,
        assetId: asset.id, // Add assetId for frontend compatibility
        publicUrl: asset.publicUrl,
        storageProvider: asset.storageProvider,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        duration, // Add duration for frontend
      });
    } catch (error) {
      console.error("Error uploading audio:", error);
      res.status(500).json({ error: "Failed to upload audio" });
    }
  });

  // Serve static files from uploads directory
  app.use("/media", express.static(path.join(process.cwd(), "uploads")));

  // Serve media files (supports both local storage and Google Drive) - fallback for database-tracked files
  app.get("/media/:type/:filename", async (req, res) => {
    try {
      const { type, filename } = req.params;
      
      // Validate type
      if (type !== 'images' && type !== 'audio') {
        return res.status(400).json({ error: "Invalid media type" });
      }

      // Construct storage key
      const storageKey = `${type}/${filename}`;

      // Look up asset in database
      const asset = await storage.getMediaAssetByStorageKey(storageKey);
      
      if (!asset) {
        return res.status(404).json({ error: "File not found in database" });
      }

      // Set content type from database
      res.setHeader('Content-Type', asset.mimeType);
      
      // Use media orchestrator to stream the file (supports both LOCAL and GOOGLE_DRIVE)
      try {
        const { stream } = await mediaOrchestrator.streamMedia(asset.id);
        
        // Handle stream errors to prevent server crash
        stream.on('error', (streamError) => {
          console.error(`Stream error for asset ${asset.id}:`, streamError);
          if (!res.headersSent) {
            res.status(404).json({ error: "File not found on storage" });
          }
        });
        
        stream.pipe(res);
      } catch (streamError: any) {
        console.error(`Error streaming asset ${asset.id}:`, streamError);
        if (!res.headersSent) {
          return res.status(404).json({ error: "File not found on storage" });
        }
      }
    } catch (error) {
      console.error("Error serving media:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to serve media" });
      }
    }
  });

  // ==================== AUDIOBOOK ROUTES ====================
  
  // Get all audiobooks (public catalog)
  app.get("/api/audiobooks", async (req, res) => {
    try {
      const audiobooks = await storage.getPublicAudiobooks();
      res.json(audiobooks);
    } catch (error) {
      console.error("Error fetching audiobooks:", error);
      res.status(500).json({ error: "Failed to fetch audiobooks" });
    }
  });

  // Get single audiobook with chapters
  app.get("/api/audiobooks/:id", async (req, res) => {
    try {
      const audiobook = await storage.getAudiobookWithChapters(req.params.id);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      // Check visibility (only show public or if user has special access)
      if (audiobook.visibility !== "PUBLIC") {
        const userId = req.session.userId;
        if (!userId) {
          return res.status(404).json({ error: "Audiobook not found" });
        }
        const user = await storage.getUser(userId);
        const isAdmin = user?.role === "ADMIN";
        const isPublisher = audiobook.publisherId === userId;
        if (!isAdmin && !isPublisher) {
          return res.status(404).json({ error: "Audiobook not found" });
        }
      }
      
      // Check access for monetization (for response enrichment)
      const accessInfo = await storage.hasAccessToAudiobook(req.session.userId, audiobook.id);
      
      // Filter chapters based on access - only show sample chapters if no access
      const visibleChapters = audiobook.chapters.filter(chapter => {
        if (accessInfo.hasAccess || accessInfo.isFree) return true;
        return chapter.isSample;
      });
      
      // Hide audio URLs for non-accessible chapters
      const sanitizedChapters = visibleChapters.map(chapter => {
        if (accessInfo.hasAccess || accessInfo.isFree || chapter.isSample) {
          return chapter;
        }
        return { ...chapter, audioUrl: null };
      });
      
      res.json({
        ...audiobook,
        chapters: sanitizedChapters,
        hasAccess: accessInfo.hasAccess,
        isPurchased: accessInfo.isPurchased,
        isSubscriber: accessInfo.isSubscriber,
        isFree: accessInfo.isFree,
      });
    } catch (error) {
      console.error("Error fetching audiobook:", error);
      res.status(500).json({ error: "Failed to fetch audiobook" });
    }
  });

  // Get single chapter with audiobook
  app.get("/api/chapters/:id", async (req, res) => {
    try {
      const chapter = await storage.getChapterWithAudiobook(req.params.id);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      
      // Check if user has access to this chapter
      const hasAccess = await storage.hasAccessToChapter(req.session.userId, req.params.id);
      
      // Only allow access if: has access, chapter is free sample, or audiobook is free
      const accessInfo = await storage.hasAccessToAudiobook(req.session.userId, chapter.audiobookId);
      
      if (!hasAccess && !chapter.isSample && !accessInfo.isFree) {
        return res.status(403).json({ error: "Purchase required to access this chapter" });
      }
      
      res.json(chapter);
    } catch (error) {
      console.error("Error fetching chapter:", error);
      res.status(500).json({ error: "Failed to fetch chapter" });
    }
  });

  // Add audiobook to favorites
  app.post("/api/audiobooks/:id/favorite", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const audiobookId = req.params.id;
      
      const audiobook = await storage.getAudiobook(audiobookId);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      const favorite = await storage.addToFavorites(userId, audiobookId);
      res.status(201).json(favorite);
    } catch (error: any) {
      if (error.message?.includes("already in favorites")) {
        return res.status(400).json({ error: "Already in favorites" });
      }
      console.error("Error adding to favorites:", error);
      res.status(500).json({ error: "Failed to add to favorites" });
    }
  });

  // Remove audiobook from favorites
  app.delete("/api/audiobooks/:id/favorite", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.removeFromFavorites(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from favorites:", error);
      res.status(500).json({ error: "Failed to remove from favorites" });
    }
  });

  // Get user's favorite audiobooks
  app.get("/api/library/favorites", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  // Get user's purchased audiobooks
  app.get("/api/library/purchases", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const purchases = await storage.getUserPurchases(userId);
      
      // Get the audiobook details for each purchase
      const audiobooks = await Promise.all(
        purchases.map(async (purchase) => {
          const audiobook = await storage.getAudiobook(purchase.audiobookId);
          return audiobook;
        })
      );
      
      res.json(audiobooks.filter(Boolean));
    } catch (error) {
      console.error("Error fetching purchases:", error);
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  // ===== SHOPPING CART ENDPOINTS =====

  // Get cart items
  app.get("/api/cart", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const items = await storage.getCartItems(userId);
      const total = await storage.getCartTotal(userId);
      res.json({ items, ...total });
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ error: "Failed to fetch cart" });
    }
  });

  // Add item to cart
  app.post("/api/cart/:audiobookId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { audiobookId } = req.params;

      // Check if audiobook exists
      const audiobook = await storage.getAudiobook(audiobookId);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }

      // Check if already purchased
      const hasPurchased = await storage.hasPurchasedAudiobook(userId, audiobookId);
      if (hasPurchased) {
        return res.status(400).json({ error: "Already purchased" });
      }

      // Check if free
      if (audiobook.isFree || audiobook.priceCents === 0) {
        return res.status(400).json({ error: "Free audiobooks don't need to be in cart" });
      }

      const item = await storage.addToCart(userId, audiobookId);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ error: "Failed to add to cart" });
    }
  });

  // Remove item from cart
  app.delete("/api/cart/:audiobookId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.removeFromCart(userId, req.params.audiobookId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ error: "Failed to remove from cart" });
    }
  });

  // Clear cart
  app.delete("/api/cart", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.clearCart(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  // Check if item is in cart
  app.get("/api/cart/check/:audiobookId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const isInCart = await storage.isInCart(userId, req.params.audiobookId);
      res.json({ isInCart });
    } catch (error) {
      console.error("Error checking cart:", error);
      res.status(500).json({ error: "Failed to check cart" });
    }
  });

  // Get cart item count (for mobile badge)
  app.get("/api/cart/count", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const items = await storage.getCartItems(userId);
      res.json({ itemCount: items.length });
    } catch (error) {
      console.error("Error fetching cart count:", error);
      res.status(500).json({ error: "Failed to fetch cart count" });
    }
  });

  // ===== MOBILE ENDPOINTS =====

  // Get featured audiobook for mobile home screen
  app.get("/api/mobile/featured", async (req, res) => {
    try {
      const audiobooks = await storage.getPublicAudiobooks();
      const approvedAudiobooks = audiobooks.filter(a => a.status === "APPROVED");
      
      // Get featured (first with isFeatured flag or first available)
      const featured = approvedAudiobooks.find(a => a.isFeatured) || approvedAudiobooks[0] || null;
      
      res.json({
        featured,
        totalCount: approvedAudiobooks.length,
      });
    } catch (error) {
      console.error("Error fetching mobile featured:", error);
      res.status(500).json({ error: "Failed to fetch featured audiobook" });
    }
  });

  // Admin: Get all audiobooks
  app.get("/api/admin/audiobooks", requireAuth, requireAdmin, async (req, res) => {
    try {
      const audiobooks = await storage.getAllAudiobooksWithPublisher();
      res.json(audiobooks);
    } catch (error) {
      console.error("Error fetching admin audiobooks:", error);
      res.status(500).json({ error: "Failed to fetch audiobooks" });
    }
  });

  // Admin: Create audiobook
  app.post("/api/admin/audiobooks", requireAuth, requireAdmin, async (req, res) => {
    try {
      const validated = insertAudiobookSchema.parse(req.body);
      const audiobook = await storage.createAudiobook({
        ...validated,
        publisherId: req.session.userId!,
        status: "APPROVED",
      });
      res.status(201).json(audiobook);
    } catch (error) {
      console.error("Error creating audiobook:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create audiobook" });
      }
    }
  });

  // Admin: Delete audiobook
  app.delete("/api/admin/audiobooks/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteAudiobook(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting audiobook:", error);
      res.status(500).json({ error: "Failed to delete audiobook" });
    }
  });

  // Admin: Update audiobook
  app.patch("/api/admin/audiobooks/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const audiobook = await storage.getAudiobook(req.params.id);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      const updated = await storage.updateAudiobook(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating audiobook:", error);
      res.status(500).json({ error: "Failed to update audiobook" });
    }
  });

  // Admin: Publish audiobook
  app.post("/api/admin/audiobooks/:id/publish", requireAuth, requireAdmin, async (req, res) => {
    try {
      const audiobook = await storage.getAudiobook(req.params.id);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      const updated = await storage.publishAudiobook(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error publishing audiobook:", error);
      res.status(500).json({ error: "Failed to publish audiobook" });
    }
  });

  // Admin: Unpublish audiobook
  app.post("/api/admin/audiobooks/:id/unpublish", requireAuth, requireAdmin, async (req, res) => {
    try {
      const audiobook = await storage.getAudiobook(req.params.id);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      const updated = await storage.unpublishAudiobook(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error unpublishing audiobook:", error);
      res.status(500).json({ error: "Failed to unpublish audiobook" });
    }
  });

  // Admin: Get all chapters
  app.get("/api/admin/chapters", requireAuth, requireAdmin, async (req, res) => {
    try {
      const chapters = await storage.getAllChaptersWithAudiobook();
      res.json(chapters);
    } catch (error) {
      console.error("Error fetching admin chapters:", error);
      res.status(500).json({ error: "Failed to fetch chapters" });
    }
  });

  // Admin: Create chapter
  app.post("/api/admin/chapters", requireAuth, requireAdmin, async (req, res) => {
    try {
      const validated = insertChapterSchema.parse(req.body);
      const chapter = await storage.createChapter({
        ...validated,
        status: "APPROVED",
      });
      res.status(201).json(chapter);
    } catch (error) {
      console.error("Error creating chapter:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create chapter" });
      }
    }
  });

  // Admin: Delete chapter
  app.delete("/api/admin/chapters/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteChapter(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chapter:", error);
      res.status(500).json({ error: "Failed to delete chapter" });
    }
  });

  // Admin: Update chapter
  app.patch("/api/admin/chapters/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const chapter = await storage.getChapter(req.params.id);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      const updated = await storage.updateChapter(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating chapter:", error);
      res.status(500).json({ error: "Failed to update chapter" });
    }
  });

  // ==================== SUBSCRIPTION PLAN ROUTES ====================

  // Admin: Get all subscription plans
  app.get("/api/admin/subscription-plans", requireAuth, requireAdmin, async (req, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  // Admin: Create subscription plan
  app.post("/api/admin/subscription-plans", requireAuth, requireAdmin, async (req, res) => {
    try {
      const validated = insertSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.createSubscriptionPlan(validated);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating subscription plan:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create subscription plan" });
      }
    }
  });

  // Admin: Delete subscription plan
  app.delete("/api/admin/subscription-plans/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteSubscriptionPlan(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting subscription plan:", error);
      res.status(500).json({ error: "Failed to delete subscription plan" });
    }
  });

  // Admin: Update subscription plan
  app.patch("/api/admin/subscription-plans/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const plan = await storage.getSubscriptionPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      const updated = await storage.updateSubscriptionPlan(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating subscription plan:", error);
      res.status(500).json({ error: "Failed to update subscription plan" });
    }
  });

  // Public: Get active subscription plans (for users to view)
  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getActiveSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  // ==================== PODCAST ROUTES ====================
  
  // Get all podcasts
  app.get("/api/podcasts", async (req, res) => {
    try {
      const allPodcasts = await storage.getAllPodcasts();
      
      // Check access for each podcast (visibility + invitations)
      const accessChecks = await Promise.all(
        allPodcasts.map(async (p) => ({
          podcast: p,
          hasVisibilityAccess: await storage.checkUserHasAccessToPodcast(req.session.userId, p.id),
        }))
      );
      
      // Filter by visibility access first
      const visibilityFilteredPodcasts = accessChecks
        .filter(({ hasVisibilityAccess }) => hasVisibilityAccess)
        .map(({ podcast }) => podcast);
      
      // Then filter by moderation status
      let isAdmin = false;
      let currentUserId: string | undefined;
      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        isAdmin = user?.role === "ADMIN";
        currentUserId = req.session.userId;
      }
      
      const podcasts = visibilityFilteredPodcasts.filter(p => {
        // Admins see everything
        if (isAdmin) return true;
        // Owners see their own podcasts regardless of moderation status
        if (currentUserId && p.ownerId === currentUserId) return true;
        // Everyone else only sees approved podcasts (moderation)
        return p.status === "APPROVED";
      });
      
      // Enrich podcasts with cover art URLs from assets
      const enrichedPodcasts = await Promise.all(
        podcasts.map(async (podcast) => {
          // Resolve cover art URL from asset if needed
          let coverArtAsset = null;
          if (podcast.coverArtAssetId && !podcast.coverArtUrl) {
            coverArtAsset = await storage.getMediaAsset(podcast.coverArtAssetId);
          }
          const coverArtUrl = resolvePodcastCoverArtUrl(podcast, coverArtAsset);
          
          return {
            ...podcast,
            coverArtUrl,
          };
        })
      );
      
      // If user is authenticated, add subscription status
      if (req.session.userId) {
        const podcastsWithSubscription = await Promise.all(
          enrichedPodcasts.map(async (podcast) => ({
            ...podcast,
            isSubscribed: await storage.isSubscribed(req.session.userId!, podcast.id),
          }))
        );
        return res.json(podcastsWithSubscription);
      }
      
      res.json(enrichedPodcasts);
    } catch (error) {
      console.error("Error fetching podcasts:", error);
      res.status(500).json({ error: "Failed to fetch podcasts" });
    }
  });

  // Get user's own podcasts
  app.get("/api/my-podcasts", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userPodcasts = await storage.getPodcastsByOwner(userId);
      
      // Enrich podcasts with cover art URLs from assets
      const enrichedPodcasts = await Promise.all(
        userPodcasts.map(async (podcast) => {
          // Resolve cover art URL from asset if needed
          let coverArtAsset = null;
          if (podcast.coverArtAssetId && !podcast.coverArtUrl) {
            coverArtAsset = await storage.getMediaAsset(podcast.coverArtAssetId);
          }
          const coverArtUrl = resolvePodcastCoverArtUrl(podcast, coverArtAsset);
          
          return {
            ...podcast,
            coverArtUrl,
          };
        })
      );
      
      res.json(enrichedPodcasts);
    } catch (error) {
      console.error("Error fetching user podcasts:", error);
      res.status(500).json({ error: "Failed to fetch user podcasts" });
    }
  });

  // Get single podcast with episodes (including share/embed URLs)
  app.get("/api/podcasts/:id", async (req, res) => {
    try {
      const podcast = await storage.getPodcastWithEpisodes(req.params.id);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      // Check access using visibility + invitations + moderation status
      const hasAccess = await storage.checkUserHasAccessToPodcast(req.session.userId, req.params.id);
      
      if (!hasAccess) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      // Also check moderation status (approved content, or owner/admin can see draft/pending)
      let hasModerationAccess = podcast.status === "APPROVED";
      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        const isAdmin = user?.role === "ADMIN";
        const isOwner = podcast.ownerId === req.session.userId;
        hasModerationAccess = hasModerationAccess || isAdmin || isOwner;
      }
      
      if (!hasModerationAccess) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      // Filter episodes: check both visibility and moderation status for each episode
      const accessibleEpisodes = [];
      for (const episode of podcast.episodes) {
        const hasEpisodeAccess = await storage.checkUserHasAccessToEpisode(req.session.userId, episode.id);
        
        // Also check episode moderation status
        let hasEpisodeModerationAccess = episode.status === "APPROVED";
        if (req.session.userId) {
          const user = await storage.getUser(req.session.userId);
          const isAdmin = user?.role === "ADMIN";
          const isOwner = podcast.ownerId === req.session.userId;
          hasEpisodeModerationAccess = hasEpisodeModerationAccess || isAdmin || isOwner;
        }
        
        if (hasEpisodeAccess && hasEpisodeModerationAccess) {
          accessibleEpisodes.push(episode);
        }
      }
      
      const filteredEpisodes = accessibleEpisodes;
      
      // Resolve podcast cover art URL from asset if needed
      let podcastCoverArtAsset = null;
      if (podcast.coverArtAssetId && !podcast.coverArtUrl) {
        podcastCoverArtAsset = await storage.getMediaAsset(podcast.coverArtAssetId);
      }
      const podcastCoverArtUrl = resolvePodcastCoverArtUrl(podcast, podcastCoverArtAsset);
      
      // Enrich episodes with share/embed URLs and audio URLs
      const siteUrl = getSiteUrl(req);
      const episodesWithUrls = await Promise.all(
        filteredEpisodes.map(async (episode) => {
          // Resolve audio URL from asset if needed
          let audioAsset = null;
          if (episode.audioAssetId && !episode.audioUrl) {
            audioAsset = await storage.getMediaAsset(episode.audioAssetId);
          }
          const audioUrl = resolveEpisodeAudioUrl(episode, audioAsset);
          
          return {
            ...episode,
            audioUrl,
            canonicalUrl: getEpisodeCanonicalUrl(siteUrl, podcast.id, episode.id),
            embedUrl: getEpisodeEmbedUrl(siteUrl, episode.id),
            shareUrl: getEpisodeShareUrl(siteUrl, podcast.id, episode.id),
            embedCode: getEmbedIframeCode(getEpisodeEmbedUrl(siteUrl, episode.id), episode.title),
          };
        })
      );
      
      res.json({
        ...podcast,
        coverArtUrl: podcastCoverArtUrl,
        episodes: episodesWithUrls,
      });
    } catch (error) {
      console.error("Error fetching podcast:", error);
      res.status(500).json({ error: "Failed to fetch podcast" });
    }
  });

  // Get RSS feed for podcast
  app.get("/api/podcasts/:id/rss", async (req, res) => {
    try {
      const podcast = await storage.getPodcastForRSS(req.params.id);
      if (!podcast) {
        return res.status(404).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Podcast not found</error>");
      }
      
      // RSS feeds are public - only include approved podcast if not approved
      if (podcast.status !== "APPROVED") {
        return res.status(404).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Podcast not found</error>");
      }
      
      // Filter to only include approved episodes in RSS feed
      const approvedEpisodes = podcast.episodes.filter(e => e.status === "APPROVED");
      
      // Enrich episodes with effective cover art (fallback to podcast cover)
      const enrichedEpisodes = approvedEpisodes.map(episode => {
        const { coverArtUrl, coverArtAssetId } = resolveEpisodeArtwork(episode, podcast);
        return {
          ...episode,
          effectiveCoverArtUrl: coverArtUrl,
          effectiveCoverArtAssetId: coverArtAssetId,
        };
      });
      
      const podcastWithEnrichedEpisodes = {
        ...podcast,
        episodes: enrichedEpisodes,
      };

      // Generate site URL from request
      const siteUrl = getSiteUrl(req);
      const feedUrl = `${siteUrl}/api/podcasts/${podcast.id}/rss`;
      
      // Generate RSS XML
      const rssXml = generateRSSFeed(podcastWithEnrichedEpisodes, feedUrl, siteUrl);
      
      // Set headers with ETag based on latest approved episode
      const latestEpisodeTimestamp = approvedEpisodes.length > 0
        ? new Date(approvedEpisodes[0].publishedAt).getTime()
        : podcast.createdAt.getTime();
      
      res.set({
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "ETag": `"${podcast.id}-${latestEpisodeTimestamp}"`,
      });
      
      res.send(rssXml);
    } catch (error) {
      console.error("Error generating RSS feed:", error);
      res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Failed to generate RSS feed</error>");
    }
  });

  // Import podcast from RSS feed (protected - requires authentication)
  app.post("/api/podcasts/import-rss", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        rssUrl: z.string().url("Invalid RSS URL"),
      });

      const { rssUrl } = schema.parse(req.body);
      const userId = req.session.userId!;

      // Define iTunes interfaces for type-safe RSS parsing
      interface ItunesFeed {
        itunesImage?: { href: string };
        itunesCategory?: string | { $: { text: string } };
      }
      
      interface ItunesItem {
        itunesDuration?: string | number;
        itunesImage?: { href: string };
      }
      
      // Import rss-parser dynamically with typed generics
      const Parser = (await import("rss-parser")).default;
      const parser = new Parser<ItunesFeed, ItunesItem>({
        customFields: {
          feed: [['itunes:image', 'itunesImage'], ['itunes:category', 'itunesCategory']],
          item: [['itunes:duration', 'itunesDuration'], ['itunes:image', 'itunesImage']],
        },
      });

      // Fetch and parse the RSS feed
      const feed = await parser.parseURL(rssUrl);

      if (!feed || !feed.title) {
        return res.status(400).json({ 
          error: "Feed RSS inválido - falta el título",
          message: "Feed RSS inválido - falta el título"
        });
      }

      // Check if podcast with same title already exists for this user
      const existingPodcasts = await storage.getPodcastsByOwner(userId);
      const duplicate = existingPodcasts.find(p => 
        p.title.toLowerCase().trim() === (feed.title || "").toLowerCase().trim()
      );
      
      if (duplicate) {
        return res.status(409).json({ 
          error: "Ya tienes un podcast con este nombre",
          message: "Ya tienes un podcast con este nombre",
          existingPodcastId: duplicate.id 
        });
      }

      // Extract cover art with proper iTunes handling
      let coverArtUrl: string | null = null;
      if (feed.image?.url) {
        coverArtUrl = feed.image.url;
      } else if (feed.itunesImage?.href) {
        coverArtUrl = feed.itunesImage.href;
      } else if (feed.itunes?.image) {
        coverArtUrl = feed.itunes.image;
      }

      // Extract category
      let category = "General";
      if (feed.itunesCategory) {
        const cat = feed.itunesCategory;
        category = typeof cat === 'string' ? cat : (cat.$ && cat.$.text) || "General";
      } else if (feed.itunes?.categories && feed.itunes.categories.length > 0) {
        category = feed.itunes.categories[0];
      }

      // Validate podcast data with schema
      const podcastValidation = insertPodcastSchema.safeParse({
        title: feed.title.trim(),
        description: (feed.description || feed.title).trim(),
        coverArtUrl: coverArtUrl || "",
        category,
        language: feed.language || "es",
      });

      if (!podcastValidation.success) {
        return res.status(400).json({ 
          error: "Datos inválidos en el feed RSS",
          message: "Datos inválidos en el feed RSS",
          details: podcastValidation.error.errors 
        });
      }

      // Create the podcast
      const podcastData = {
        ...podcastValidation.data,
        coverArtUrl: podcastValidation.data.coverArtUrl || null,
        coverArtAssetId: null,
        ownerId: userId,
        status: "PENDING_APPROVAL" as const,
        approvedAt: null,
        approvedBy: null,
      };

      const podcast = await storage.createPodcast(podcastData);

      // Import episodes from feed
      let importedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      if (feed.items && feed.items.length > 0) {
        // Limit to first 50 episodes to avoid overwhelming the system
        const itemsToImport = feed.items.slice(0, 50);

        for (const item of itemsToImport) {
          try {
            // Extract audio URL from enclosure
            const audioUrl = item.enclosure?.url || item.link;
            
            if (!audioUrl || !item.title) {
              skippedCount++;
              continue;
            }

            // Parse duration with improved handling
            let durationSeconds: number | undefined = undefined;
            const itunesDuration = item.itunesDuration;
            
            if (itunesDuration) {
              const duration = itunesDuration;
              if (typeof duration === 'string') {
                if (duration.includes(':')) {
                  // Format: HH:MM:SS or MM:SS
                  const parts = duration.split(':').map(Number);
                  if (parts.length === 3) {
                    durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                  } else if (parts.length === 2) {
                    durationSeconds = parts[0] * 60 + parts[1];
                  }
                } else {
                  // Format: seconds as string
                  durationSeconds = parseInt(duration) || undefined;
                }
              } else if (typeof duration === 'number') {
                durationSeconds = duration;
              }
            }

            // Extract episode cover art
            let episodeCoverArt: string | null = null;
            if (item.itunesImage?.href) {
              episodeCoverArt = item.itunesImage.href;
            } else if (item.enclosure?.type?.startsWith('image/')) {
              episodeCoverArt = item.enclosure.url;
            }

            // Validate episode data
            const episodeValidation = insertEpisodeSchema.safeParse({
              podcastId: podcast.id,
              title: item.title.trim(),
              notes: (item.contentSnippet || item.content || item.title).trim(),
              audioUrl,
              coverArtUrl: episodeCoverArt || "",
              duration: durationSeconds,
            });

            if (!episodeValidation.success) {
              errors.push(`Episode "${item.title}": ${episodeValidation.error.errors[0].message}`);
              skippedCount++;
              continue;
            }

            await storage.createEpisode(episodeValidation.data);
            importedCount++;
          } catch (episodeError: any) {
            console.error(`Error importing episode "${item.title}":`, episodeError);
            errors.push(`Episode "${item.title}": ${episodeError.message}`);
            skippedCount++;
          }
        }
      }

      res.status(201).json({
        podcast,
        imported: importedCount,
        skipped: skippedCount,
        totalInFeed: feed.items?.length || 0,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        message: `Podcast imported successfully with ${importedCount} episode${importedCount !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      
      // Handle RSS parsing errors with more detail
      if (error.message?.includes('404')) {
        return res.status(404).json({ error: "RSS feed not found at the provided URL" });
      }
      if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED')) {
        return res.status(400).json({ error: "Cannot reach the RSS feed URL - please check the address" });
      }
      if (error.message?.includes('Invalid XML')) {
        return res.status(400).json({ error: "The URL does not contain valid RSS feed data" });
      }
      
      console.error("Error importing RSS feed:", error);
      res.status(500).json({ 
        error: "Failed to import RSS feed", 
        detail: error.message 
      });
    }
  });

  // Preview YouTube playlist before importing (protected - ADMIN only)
  app.get("/api/import-youtube/preview", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "ADMIN") {
        return res.status(403).json({ error: "Solo administradores pueden importar desde YouTube" });
      }

      const { playlistUrl, maxVideos } = req.query;
      
      if (!playlistUrl || typeof playlistUrl !== 'string') {
        return res.status(400).json({ error: "playlistUrl es requerida" });
      }

      const maxVids = maxVideos ? parseInt(maxVideos as string) : 10;
      
      // Get playlist metadata
      const playlistMetadata = await getPlaylistMetadata(playlistUrl);
      
      // Get playlist videos
      const videos = await getPlaylistVideos(playlistMetadata.playlistId, maxVids);

      res.json({
        playlist: {
          title: playlistMetadata.title,
          description: playlistMetadata.description,
          channelTitle: playlistMetadata.channelTitle,
          thumbnailUrl: playlistMetadata.thumbnailUrl,
        },
        videos: videos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnailUrl,
          duration: v.duration,
          publishedAt: v.publishedAt,
        })),
        totalVideos: videos.length,
      });
    } catch (error: any) {
      console.error("Error fetching YouTube playlist:", error);
      
      if (error.message?.includes('YOUTUBE_API_KEY')) {
        return res.status(500).json({ 
          error: "YouTube API no configurada",
          message: "El administrador debe configurar la API de YouTube para usar esta función"
        });
      }

      if (error.message?.includes('Playlist no encontrada')) {
        return res.status(404).json({ 
          error: "Playlist no encontrada",
          message: "Verifica que la URL sea correcta y que la playlist sea pública"
        });
      }

      res.status(500).json({ 
        error: "Error al obtener información de la playlist", 
        detail: error.message 
      });
    }
  });

  // Import podcast from YouTube playlist (protected - ADMIN only)
  app.post("/api/import-youtube", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Solo administradores pueden importar desde YouTube" });
    }
    try {
      const validatedData = youtubeImportSchema.parse(req.body);
      const userId = req.session.userId!;

      // Get playlist metadata
      const playlistMetadata = await getPlaylistMetadata(validatedData.playlistUrl);

      // Check if podcast with same title already exists for this user
      const existingPodcasts = await storage.getPodcastsByOwner(userId);
      const podcastTitle = validatedData.podcastTitle || playlistMetadata.title;
      const duplicate = existingPodcasts.find(p => 
        p.title.toLowerCase().trim() === podcastTitle.toLowerCase().trim()
      );
      
      if (duplicate) {
        return res.status(409).json({ 
          error: "Ya tienes un podcast con este nombre",
          message: "Ya tienes un podcast con este nombre",
          existingPodcastId: duplicate.id 
        });
      }

      // Get playlist videos
      let videos = await getPlaylistVideos(playlistMetadata.playlistId, validatedData.maxVideos);

      // Filter by selected video IDs if provided
      if (validatedData.selectedVideoIds && validatedData.selectedVideoIds.length > 0) {
        videos = videos.filter(v => validatedData.selectedVideoIds!.includes(v.videoId));
      }

      if (videos.length === 0) {
        return res.status(400).json({
          error: "No hay videos seleccionados para importar",
          message: "Debes seleccionar al menos un video para importar"
        });
      }

      // Create temporary directory for downloads
      const tempDir = path.join(os.tmpdir(), `youtube-import-${Date.now()}`);
      const tempFiles: string[] = [];

      try {
        // Download and upload podcast cover art if available
        let coverArtAssetId: string | null = null;
        if (playlistMetadata.thumbnailUrl) {
          try {
            const thumbnailFilename = `playlist-${playlistMetadata.playlistId}.jpg`;
            const thumbnailPath = await downloadThumbnail(
              playlistMetadata.thumbnailUrl, 
              tempDir, 
              thumbnailFilename
            );
            tempFiles.push(thumbnailPath);
            
            coverArtAssetId = await uploadImageToStorage(thumbnailPath, thumbnailFilename, userId);
          } catch (thumbError) {
            console.error("Error downloading playlist thumbnail:", thumbError);
            // Continue without cover art
          }
        }

        // Create the podcast
        const podcast = await storage.createPodcast({
          title: podcastTitle,
          description: validatedData.podcastDescription || playlistMetadata.description || `Podcast importado desde YouTube: ${playlistMetadata.channelTitle}`,
          coverArtUrl: null,
          coverArtAssetId,
          category: "YouTube Import",
          language: "es",
          ownerId: userId,
          status: "PENDING_APPROVAL" as const,
          visibility: validatedData.visibility as any,
          approvedAt: null,
          approvedBy: null,
        });

        // Import episodes
        let importedCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];

        for (const video of videos) {
          try {
            // Add delay between downloads to avoid rate limiting (except first video)
            if (importedCount > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            }

            // Download audio from video
            const { audioPath, filename } = await downloadAudioFromVideo(video.videoId, tempDir);
            tempFiles.push(audioPath);

            // Upload audio to storage
            const audioAssetId = await uploadAudioToStorage(
              audioPath,
              filename,
              userId,
              undefined, // episodeId - will be filled after creation
              podcast.id
            );

            // Download episode cover art if different from podcast
            let episodeCoverArtAssetId: string | null = null;
            if (video.thumbnailUrl && video.thumbnailUrl !== playlistMetadata.thumbnailUrl) {
              try {
                const episodeThumbFilename = `video-${video.videoId}.jpg`;
                const episodeThumbPath = await downloadThumbnail(
                  video.thumbnailUrl,
                  tempDir,
                  episodeThumbFilename
                );
                tempFiles.push(episodeThumbPath);
                
                episodeCoverArtAssetId = await uploadImageToStorage(
                  episodeThumbPath,
                  episodeThumbFilename,
                  userId,
                  podcast.id
                );
              } catch (thumbError) {
                console.error(`Error downloading thumbnail for video ${video.videoId}:`, thumbError);
                // Continue without episode-specific cover art
              }
            }

            // Create episode
            await storage.createEpisode({
              podcastId: podcast.id,
              title: video.title,
              notes: video.description || video.title,
              audioUrl: undefined,
              audioAssetId,
              coverArtUrl: undefined,
              coverArtAssetId: episodeCoverArtAssetId,
              duration: video.duration,
              status: "PENDING_APPROVAL" as const,
              visibility: validatedData.visibility as any,
              publishedAt: video.publishedAt?.toISOString(),
              approvedAt: null,
              approvedBy: null,
            });

            importedCount++;
          } catch (episodeError: any) {
            console.error(`Error importing video "${video.title}":`, episodeError);
            errors.push(`Video "${video.title}": ${episodeError.message}`);
            skippedCount++;
          }
        }

        // Cleanup temp files
        await cleanupTempFiles(tempFiles);

        res.status(201).json({
          podcast,
          imported: importedCount,
          skipped: skippedCount,
          totalRequested: validatedData.maxVideos,
          totalAvailable: videos.length,
          errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
          message: `Podcast creado exitosamente con ${importedCount} episodio${importedCount !== 1 ? 's' : ''}`,
        });
      } catch (importError) {
        // Cleanup temp files on error
        await cleanupTempFiles(tempFiles);
        throw importError;
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }

      console.error("Error importing from YouTube:", error);
      
      // Handle specific YouTube errors
      if (error.message?.includes('YOUTUBE_API_KEY')) {
        return res.status(500).json({ 
          error: "YouTube API no configurada",
          message: "El administrador debe configurar la API de YouTube para usar esta función"
        });
      }

      if (error.message?.includes('Playlist no encontrada')) {
        return res.status(404).json({ 
          error: "Playlist no encontrada",
          message: "Verifica que la URL sea correcta y que la playlist sea pública"
        });
      }

      res.status(500).json({ 
        error: "Error al importar desde YouTube", 
        detail: error.message 
      });
    }
  });

  // ==================== ZIP IMPORT ROUTES ====================
  
  // Import audiobook from ZIP file (protected - ADMIN only)
  app.post("/api/admin/import/zip", requireAuth, requireAdmin, uploadZip.single('zipFile'), async (req, res) => {
    const tempFiles: string[] = [];
    let extractDir: string | null = null;
    
    try {
      const userId = req.session.userId!;
      const zipFile = req.file;
      
      if (!zipFile) {
        return res.status(400).json({ error: "Debes subir un archivo ZIP" });
      }
      
      tempFiles.push(zipFile.path);
      
      // Create extraction directory
      const unzipper = await import('unzipper');
      const path = await import('path');
      const fsPromises = await import('fs/promises');
      const fs = await import('fs');
      
      extractDir = path.join(os.tmpdir(), `import-${Date.now()}`);
      await fsPromises.mkdir(extractDir, { recursive: true });
      
      // Extract ZIP file
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(zipFile.path)
          .pipe(unzipper.Extract({ path: extractDir! }))
          .on('close', resolve)
          .on('error', reject);
      });
      
      // Look for metadata.json
      const metadataPath = path.join(extractDir, 'metadata.json');
      let metadata: any = null;
      let autoDetectedFromMP3 = false;
      
      try {
        const metadataContent = await fsPromises.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch (err) {
        // No metadata.json found, try to auto-detect from MP3 files
        console.log("No metadata.json found, attempting to read metadata from MP3 files...");
        
        const files = await fsPromises.readdir(extractDir);
        const mp3Files = files.filter(f => f.toLowerCase().endsWith('.mp3')).sort();
        
        if (mp3Files.length === 0) {
          return res.status(400).json({ 
            error: "No se encontraron archivos MP3",
            message: "El archivo ZIP debe contener archivos MP3 o un archivo metadata.json"
          });
        }
        
        // Read metadata from the first MP3 file to get album/artist info
        const mm = await import('music-metadata');
        const firstMp3Path = path.join(extractDir, mp3Files[0]);
        const firstMp3Metadata = await mm.parseFile(firstMp3Path);
        
        const albumTitle = firstMp3Metadata.common.album || "Audiolibro sin titulo";
        const author = firstMp3Metadata.common.artist || "Autor desconocido";
        const narrator = firstMp3Metadata.common.composer || null;
        const genre = firstMp3Metadata.common.genre?.[0] || "Audiobook";
        
        // Build chapters array from all MP3 files
        const chaptersFromMP3: any[] = [];
        
        for (const mp3File of mp3Files) {
          const mp3Path = path.join(extractDir, mp3File);
          try {
            const mp3Meta = await mm.parseFile(mp3Path);
            const trackNo = mp3Meta.common.track?.no || chaptersFromMP3.length + 1;
            
            chaptersFromMP3.push({
              title: mp3Meta.common.title || mp3File.replace('.mp3', '').replace('.MP3', ''),
              chapterNumber: trackNo,
              description: null,
              audioFile: mp3File,
              duration: Math.round(mp3Meta.format.duration || 0),
              isSample: false,
            });
          } catch (mp3Err) {
            console.warn(`Could not read metadata from ${mp3File}:`, mp3Err);
            chaptersFromMP3.push({
              title: mp3File.replace('.mp3', '').replace('.MP3', ''),
              chapterNumber: chaptersFromMP3.length + 1,
              audioFile: mp3File,
              duration: 0,
              isSample: false,
            });
          }
        }
        
        // Sort chapters by track number
        chaptersFromMP3.sort((a, b) => a.chapterNumber - b.chapterNumber);
        
        // Reassign chapter numbers after sorting
        chaptersFromMP3.forEach((ch, idx) => {
          ch.chapterNumber = idx + 1;
        });
        
        metadata = {
          title: albumTitle,
          author: author,
          narrator: narrator,
          description: "",
          category: genre === "Audiobook" ? "Fiction" : genre,
          language: "es",
          isFree: true,
          priceCents: 0,
          currency: "EUR",
          chapters: chaptersFromMP3,
        };
        
        autoDetectedFromMP3 = true;
        console.log(`Auto-detected audiobook: "${albumTitle}" by ${author} with ${chaptersFromMP3.length} chapters`);
      }
      
      // Validate metadata structure with Zod
      const zipMetadataSchema = z.object({
        title: z.string().min(1, "Titulo es requerido"),
        author: z.string().min(1, "Autor es requerido"),
        narrator: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        category: z.string().default("Fiction"),
        language: z.string().default("es"),
        isFree: z.boolean().default(true),
        priceCents: z.number().int().min(0).default(0),
        currency: z.string().default("EUR"),
        chapters: z.array(z.object({
          title: z.string().optional(),
          chapterNumber: z.number().int().min(1).optional(),
          description: z.string().optional().nullable(),
          audioFile: z.string().optional(),
          duration: z.number().int().min(0).default(0),
          isSample: z.boolean().default(false),
        })).default([]),
      });
      
      let validatedMetadata;
      try {
        validatedMetadata = zipMetadataSchema.parse(metadata);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({ 
            error: "Metadatos invalidos",
            message: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          });
        }
        throw validationError;
      }
      
      // Helper function to safely resolve paths (prevent path traversal)
      const safePath = (basePath: string, filename: string): string | null => {
        // Remove any path components and only use the filename
        const safeName = path.basename(filename);
        if (safeName !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
          console.warn(`Rejected unsafe path: ${filename}`);
          return null;
        }
        return path.join(basePath, safeName);
      };
      
      // Get storage service for uploads (local storage organized by audiobook title)
      const storageService = StorageService.createLocal(validatedMetadata.title);
      
      // Upload cover art if exists
      let coverArtUrl: string | null = null;
      const coverFiles = ['cover.jpg', 'cover.png', 'cover.jpeg', 'portada.jpg', 'portada.png'];
      
      for (const coverName of coverFiles) {
        const coverPath = safePath(extractDir, coverName);
        if (!coverPath) continue;
        try {
          await fsPromises.access(coverPath);
          // Cover exists, upload it
          const coverBuffer = await fsPromises.readFile(coverPath);
          const mimeType = coverName.endsWith('.png') ? 'image/png' : 'image/jpeg';
          
          const multerFile: Express.Multer.File = {
            buffer: coverBuffer,
            originalname: coverName,
            mimetype: mimeType,
            size: coverBuffer.length,
            fieldname: 'cover',
            encoding: '7bit',
            destination: '',
            filename: '',
            path: '',
            stream: null as any,
          };
          
          const uploadResult = await storageService.saveCoverArt(multerFile, userId);
          coverArtUrl = uploadResult.publicUrl;
          break;
        } catch {
          // Cover file doesn't exist, try next
        }
      }
      
      // Create the audiobook
      const audiobook = await storage.createAudiobook({
        title: validatedMetadata.title,
        author: validatedMetadata.author,
        narrator: validatedMetadata.narrator || "",
        description: validatedMetadata.description ?? "",
        coverArtUrl: coverArtUrl,
        category: validatedMetadata.category,
        language: validatedMetadata.language,
        priceCents: validatedMetadata.priceCents,
        currency: validatedMetadata.currency,
        isFree: validatedMetadata.isFree,
        publisherId: userId,
      });
      
      // Process chapters from metadata
      const chapters = validatedMetadata.chapters;
      const createdChapters: any[] = [];
      let totalDuration = 0;
      
      for (let i = 0; i < chapters.length; i++) {
        const chapterMeta = chapters[i];
        const chapterNumber = chapterMeta.chapterNumber || (i + 1);
        
        let audioUrl: string | null = null;
        let duration = chapterMeta.duration || 0;
        
        // Try to find the audio file
        if (chapterMeta.audioFile) {
          const audioPath = safePath(extractDir, chapterMeta.audioFile);
          if (!audioPath) {
            console.warn(`Rejected unsafe audio path: ${chapterMeta.audioFile}`);
          } else try {
            await fsPromises.access(audioPath);
            // Audio file exists, read it
            let audioBuffer = await fsPromises.readFile(audioPath);
            const ext = path.extname(chapterMeta.audioFile).toLowerCase();
            const mimeType = ext === '.mp3' ? 'audio/mpeg' : ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg';
            
            // Update ID3 metadata for MP3 files
            if (ext === '.mp3') {
              try {
                // Read cover art buffer if available
                let coverBuffer: Buffer | undefined;
                for (const coverName of coverFiles) {
                  const coverPath = safePath(extractDir!, coverName);
                  if (!coverPath) continue;
                  try {
                    coverBuffer = await fsPromises.readFile(coverPath);
                    break;
                  } catch {
                    // Cover not found, try next
                  }
                }
                
                audioBuffer = await updateMP3MetadataBuffer(audioBuffer, {
                  title: chapterMeta.title || `Capitulo ${chapterNumber}`,
                  author: validatedMetadata.author,
                  album: validatedMetadata.title,
                  trackNumber: chapterNumber,
                  totalTracks: chapters.length,
                  year: new Date().getFullYear(),
                  genre: 'Audiobook',
                  narrator: validatedMetadata.narrator || undefined,
                }, coverBuffer);
                console.log(`Updated ID3 metadata for chapter ${chapterNumber}: ${chapterMeta.title || 'Untitled'}`);
              } catch (id3Error) {
                console.warn(`Could not update ID3 metadata for ${chapterMeta.audioFile}:`, id3Error);
              }
            }
            
            const multerFile: Express.Multer.File = {
              buffer: audioBuffer,
              originalname: chapterMeta.audioFile,
              mimetype: mimeType,
              size: audioBuffer.length,
              fieldname: 'audio',
              encoding: '7bit',
              destination: '',
              filename: '',
              path: '',
              stream: null as any,
            };
            
            const uploadResult = await storageService.saveEpisodeAudio(multerFile, userId);
            audioUrl = uploadResult.publicUrl;
            
            // Try to get duration from file
            if (duration === 0) {
              try {
                const mm = await import('music-metadata');
                const audioMetadata = await mm.parseBuffer(audioBuffer);
                duration = Math.round(audioMetadata.format.duration || 0);
              } catch {
                // Couldn't get duration
              }
            }
          } catch {
            console.warn(`Audio file not found: ${chapterMeta.audioFile}`);
          }
        }
        
        totalDuration += duration;
        
        const chapter = await storage.createChapter({
          title: chapterMeta.title || `Capitulo ${chapterNumber}`,
          chapterNumber,
          description: chapterMeta.description || null,
          audioUrl,
          duration,
          isSample: chapterMeta.isSample || false,
          audiobookId: audiobook.id,
        });
        
        createdChapters.push(chapter);
      }
      
      // Update audiobook with total duration
      if (totalDuration > 0) {
        await storage.updateAudiobook(audiobook.id, { totalDuration });
      }
      
      // Cleanup
      try {
        await fsPromises.rm(extractDir, { recursive: true, force: true });
        await fsPromises.unlink(zipFile.path);
      } catch {
        // Ignore cleanup errors
      }
      
      res.status(201).json({
        success: true,
        audiobook: { ...audiobook, totalDuration },
        chaptersCreated: createdChapters.length,
        message: `Audiolibro "${audiobook.title}" importado con ${createdChapters.length} capitulos`
      });
      
    } catch (error: any) {
      console.error("Error importing from ZIP:", error);
      
      // Cleanup on error
      try {
        const fsPromises = await import('fs/promises');
        for (const file of tempFiles) {
          await fsPromises.unlink(file).catch(() => {});
        }
        if (extractDir) {
          await fsPromises.rm(extractDir, { recursive: true, force: true }).catch(() => {});
        }
      } catch {
        // Ignore cleanup errors
      }
      
      res.status(500).json({ 
        error: "Error al importar ZIP", 
        detail: error.message 
      });
    }
  });

  // Import podcast from local folder - multiple MP3 files (protected - ADMIN only)
  app.post("/api/import-local", requireAuth, uploadLocalImport.fields([
    { name: 'audioFiles', maxCount: 50 },
    { name: 'coverArt', maxCount: 1 }
  ]), async (req, res) => {
    const tempFiles: string[] = [];
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "ADMIN") {
        return res.status(403).json({ error: "Solo administradores pueden importar carpetas locales" });
      }

      const userId = req.session.userId!;
      const files = req.files as { audioFiles?: Express.Multer.File[], coverArt?: Express.Multer.File[] };
      
      if (!files.audioFiles || files.audioFiles.length === 0) {
        return res.status(400).json({ error: "Debes subir al menos un archivo de audio" });
      }

      // Collect all temp file paths for cleanup
      files.audioFiles.forEach(file => tempFiles.push(file.path));
      if (files.coverArt?.[0]) {
        tempFiles.push(files.coverArt[0].path);
      }

      // Validate metadata
      const validatedData = localImportSchema.parse(req.body);

      // Check if podcast with same title already exists for this user
      const existingPodcasts = await storage.getPodcastsByOwner(userId);
      const duplicate = existingPodcasts.find(p => 
        p.title.toLowerCase().trim() === validatedData.podcastTitle.toLowerCase().trim()
      );
      
      if (duplicate) {
        return res.status(409).json({ 
          error: "Ya tienes un podcast con este nombre",
          message: "Ya tienes un podcast con este nombre",
          existingPodcastId: duplicate.id 
        });
      }

      // Upload cover art if provided
      let coverArtAssetId: string | null = null;
      if (files.coverArt && files.coverArt[0]) {
        // Read file from disk into buffer (disk storage doesn't have .buffer)
        const coverBuffer = fs.readFileSync(files.coverArt[0].path);
        const coverWithBuffer = {
          ...files.coverArt[0],
          buffer: coverBuffer
        };
        const coverArt = await mediaOrchestrator.saveCoverArt(coverWithBuffer, userId);
        coverArtAssetId = coverArt.id;
      }

      // Create the podcast
      const podcast = await storage.createPodcast({
        title: validatedData.podcastTitle,
        description: validatedData.podcastDescription,
        coverArtUrl: null,
        coverArtAssetId,
        category: validatedData.category,
        language: validatedData.language,
        ownerId: userId,
        status: "PENDING_APPROVAL" as const,
        visibility: validatedData.visibility as any,
        approvedAt: null,
        approvedBy: null,
      });

      // Import episodes from audio files
      let importedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const audioFile of files.audioFiles) {
        try {
          // Extract metadata from audio file to get duration
          let duration = 0;
          try {
            const metadata = await parseFile(audioFile.path);
            duration = Math.round(metadata.format.duration || 0);
          } catch (metadataError) {
            console.warn(`Could not extract duration from ${audioFile.originalname}:`, metadataError);
          }

          // Read file from disk into buffer (disk storage doesn't have .buffer)
          const fileBuffer = fs.readFileSync(audioFile.path);
          
          // Create file object with buffer for storage service
          const fileWithBuffer = {
            ...audioFile,
            buffer: fileBuffer
          };
          
          // Upload audio file
          const audioAsset = await mediaOrchestrator.saveEpisodeAudio(
            fileWithBuffer,
            userId,
            undefined, // episodeId - will be filled after creation
            podcast.id
          );

          // Extract episode title from filename (remove extension)
          const episodeTitle = audioFile.originalname.replace(/\.[^/.]+$/, "");

          // Create episode
          await storage.createEpisode({
            podcastId: podcast.id,
            title: episodeTitle,
            notes: `Episodio importado desde archivo local: ${audioFile.originalname}`,
            audioUrl: undefined,
            audioAssetId: audioAsset.id,
            coverArtUrl: undefined,
            coverArtAssetId: null,
            duration: duration,
            status: "PENDING_APPROVAL" as const,
            visibility: validatedData.visibility as any,
            publishedAt: new Date(),
            approvedAt: null,
            approvedBy: null,
          });

          importedCount++;
        } catch (episodeError: any) {
          console.error(`Error importing audio file "${audioFile.originalname}":`, episodeError);
          errors.push(`Archivo "${audioFile.originalname}": ${episodeError.message}`);
          skippedCount++;
        }
      }

      res.status(201).json({
        podcast,
        imported: importedCount,
        skipped: skippedCount,
        totalFiles: files.audioFiles.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        message: `Podcast creado exitosamente con ${importedCount} episodio${importedCount !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }

      console.error("Error importing from local folder:", error);
      res.status(500).json({ 
        error: "Error al importar archivos locales", 
        detail: error.message 
      });
    } finally {
      // Clean up temporary files from disk
      for (const filePath of tempFiles) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupError) {
          console.error(`Failed to cleanup temp file ${filePath}:`, cleanupError);
        }
      }
    }
  });

  // Create podcast (protected - requires authentication)
  app.post("/api/podcasts", requireAuth, async (req, res) => {
    try {
      // Parse request body (ownerId is omitted from schema)
      const validatedData = insertPodcastSchema.parse(req.body);
      
      // Create podcast with authenticated user as owner
      const podcastData = {
        title: validatedData.title,
        description: validatedData.description,
        coverArtUrl: validatedData.coverArtUrl || null,
        coverArtAssetId: null,
        category: validatedData.category,
        language: validatedData.language,
        visibility: validatedData.visibility || "PUBLIC",
        ownerId: req.session.userId!,
        status: "PENDING_APPROVAL" as const, // Will be determined by createPodcast based on user settings
        approvedAt: null,
        approvedBy: null,
      };
      
      const podcast = await storage.createPodcast(podcastData);
      res.status(201).json(podcast);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating podcast:", error);
      res.status(500).json({ error: "Failed to create podcast" });
    }
  });

  // Update podcast (protected - requires authentication and ownership)
  app.patch("/api/podcasts/:id", requireAuth, async (req, res) => {
    try {
      const podcastId = req.params.id;
      const userId = req.session.userId!;
      
      // Verify the podcast exists and belongs to the authenticated user (or user is admin)
      const podcast = await storage.getPodcast(podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      const user = await storage.getUser(userId);
      const isOwner = podcast.ownerId === userId;
      const isAdmin = user?.role === "ADMIN";
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden - You can only edit your own podcasts" });
      }
      
      // Validate and update allowed fields
      const updateSchema = z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        coverArtUrl: z.string().nullable().optional(),
        coverArtAssetId: z.string().nullable().optional(),
        category: z.string().optional(),
        language: z.string().optional(),
        visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updatePodcast(podcastId, validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating podcast:", error);
      res.status(500).json({ error: "Failed to update podcast" });
    }
  });

  // Subscribe to podcast (protected - requires authentication)
  app.post("/api/podcasts/:id/subscribe", requireAuth, async (req, res) => {
    try {
      const podcastId = req.params.id;
      const userId = req.session.userId!;
      
      // Check if podcast exists
      const podcast = await storage.getPodcast(podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      const subscription = await storage.subscribeToPodcast(userId, podcastId);
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error subscribing to podcast:", error);
      res.status(500).json({ error: "Failed to subscribe to podcast" });
    }
  });

  // Unsubscribe from podcast (protected - requires authentication)
  app.delete("/api/podcasts/:id/subscribe", requireAuth, async (req, res) => {
    try {
      const podcastId = req.params.id;
      const userId = req.session.userId!;
      
      await storage.unsubscribeFromPodcast(userId, podcastId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unsubscribing from podcast:", error);
      res.status(500).json({ error: "Failed to unsubscribe from podcast" });
    }
  });

  // Get user's library (subscribed podcasts)
  app.get("/api/library", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const podcasts = await storage.getUserSubscriptions(userId);
      res.json(podcasts);
    } catch (error) {
      console.error("Error fetching library:", error);
      res.status(500).json({ error: "Failed to fetch library" });
    }
  });

  // ==================== PLAYLIST ROUTES ====================

  // Create playlist
  app.post("/api/playlists", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const validatedData = insertPlaylistSchema.parse(req.body);
      
      const playlist = await storage.createPlaylist({ ...validatedData, userId });
      res.status(201).json(playlist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating playlist:", error);
      res.status(500).json({ error: "Failed to create playlist" });
    }
  });

  // Get user's playlists
  app.get("/api/playlists", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const playlists = await storage.getUserPlaylists(userId);
      res.json(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      res.status(500).json({ error: "Failed to fetch playlists" });
    }
  });

  // Get public playlists
  app.get("/api/playlists/public", async (req, res) => {
    try {
      const playlists = await storage.getPublicPlaylists();
      res.json(playlists);
    } catch (error) {
      console.error("Error fetching public playlists:", error);
      res.status(500).json({ error: "Failed to fetch public playlists" });
    }
  });

  // Get single playlist with episodes
  app.get("/api/playlists/:id", async (req, res) => {
    try {
      const playlistId = req.params.id;
      const playlist = await storage.getPlaylist(playlistId);
      
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      // Check access: public playlists are accessible to everyone, private ones only to owner
      if (!playlist.isPublic && playlist.userId !== req.session.userId) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      const episodes = await storage.getPlaylistEpisodes(playlistId);
      
      res.json({ ...playlist, episodes });
    } catch (error) {
      console.error("Error fetching playlist:", error);
      res.status(500).json({ error: "Failed to fetch playlist" });
    }
  });

  // Update playlist
  app.patch("/api/playlists/:id", requireAuth, async (req, res) => {
    try {
      const playlistId = req.params.id;
      const userId = req.session.userId!;
      
      const playlist = await storage.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      if (playlist.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        isPublic: z.boolean().optional(),
      });

      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updatePlaylist(playlistId, validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating playlist:", error);
      res.status(500).json({ error: "Failed to update playlist" });
    }
  });

  // Delete playlist
  app.delete("/api/playlists/:id", requireAuth, async (req, res) => {
    try {
      const playlistId = req.params.id;
      const userId = req.session.userId!;
      
      const playlist = await storage.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      if (playlist.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deletePlaylist(playlistId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting playlist:", error);
      res.status(500).json({ error: "Failed to delete playlist" });
    }
  });

  // Add episode to playlist
  app.post("/api/playlists/:id/episodes", requireAuth, async (req, res) => {
    try {
      const playlistId = req.params.id;
      const userId = req.session.userId!;
      const { episodeId } = req.body;

      if (!episodeId) {
        return res.status(400).json({ error: "Episode ID is required" });
      }

      const playlist = await storage.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      if (playlist.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Check if episode exists
      const episode = await storage.getEpisode(episodeId);
      if (!episode) {
        return res.status(404).json({ error: "Episode not found" });
      }

      // Check if already in playlist
      const exists = await storage.isEpisodeInPlaylist(playlistId, episodeId);
      if (exists) {
        return res.status(409).json({ error: "Episode already in playlist" });
      }

      const playlistEpisode = await storage.addEpisodeToPlaylist(playlistId, episodeId);
      res.status(201).json(playlistEpisode);
    } catch (error) {
      console.error("Error adding episode to playlist:", error);
      res.status(500).json({ error: "Failed to add episode to playlist" });
    }
  });

  // Remove episode from playlist
  app.delete("/api/playlists/:id/episodes/:episodeId", requireAuth, async (req, res) => {
    try {
      const playlistId = req.params.id;
      const episodeId = req.params.episodeId;
      const userId = req.session.userId!;

      const playlist = await storage.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      if (playlist.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.removeEpisodeFromPlaylist(playlistId, episodeId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing episode from playlist:", error);
      res.status(500).json({ error: "Failed to remove episode from playlist" });
    }
  });

  // Reorder playlist episodes
  app.put("/api/playlists/:id/reorder", requireAuth, async (req, res) => {
    try {
      const playlistId = req.params.id;
      const userId = req.session.userId!;
      const { episodeIds } = req.body;

      if (!Array.isArray(episodeIds)) {
        return res.status(400).json({ error: "Episode IDs must be an array" });
      }

      const playlist = await storage.getPlaylist(playlistId);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      if (playlist.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.reorderPlaylistEpisodes(playlistId, episodeIds);
      res.status(204).send();
    } catch (error) {
      console.error("Error reordering playlist:", error);
      res.status(500).json({ error: "Failed to reorder playlist" });
    }
  });

  // Get single episode
  app.get("/api/episodes/:id", async (req, res) => {
    try {
      // Get user info if authenticated
      let userRole: string | undefined;
      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        userRole = user?.role;
      }
      
      // Fetch enriched episode with access control
      const result = await getEpisodeForResponse(
        req.params.id,
        req.session.userId,
        userRole
      );
      
      if (!result) {
        return res.status(404).json({ error: "Episode not found" });
      }
      
      if (!result.hasAccess) {
        return res.status(404).json({ error: "Episode not found" });
      }
      
      // Generate URLs for sharing and embedding
      const siteUrl = getSiteUrl(req);
      const canonicalUrl = getEpisodeCanonicalUrl(siteUrl, result.episode.podcastId, result.episode.id);
      const embedUrl = getEpisodeEmbedUrl(siteUrl, result.episode.id);
      const shareUrl = getEpisodeShareUrl(siteUrl, result.episode.podcastId, result.episode.id);
      const embedCode = getEmbedIframeCode(embedUrl, result.episode.title);
      
      res.json({
        ...result.episode,
        canonicalUrl,
        embedUrl,
        shareUrl,
        embedCode,
      });
    } catch (error) {
      console.error("Error fetching episode:", error);
      res.status(500).json({ error: "Failed to fetch episode" });
    }
  });

  // Create episode (protected - requires authentication)
  app.post("/api/episodes", requireAuth, async (req, res) => {
    try {
      const validatedData = insertEpisodeSchema.parse(req.body);
      
      // Verify the podcast exists and belongs to the authenticated user
      const podcast = await storage.getPodcast(validatedData.podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      if (podcast.ownerId !== req.session.userId) {
        return res.status(403).json({ error: "Forbidden - You can only add episodes to your own podcasts" });
      }
      
      // Ensure audioFileSize is provided or can be fetched
      let audioFileSize = validatedData.audioFileSize;
      
      if (!audioFileSize) {
        // Attempt to fetch Content-Length if not provided
        try {
          const headResponse = await fetch(validatedData.audioUrl, { method: "HEAD" });
          const contentLength = headResponse.headers.get("content-length");
          
          if (contentLength && !isNaN(parseInt(contentLength))) {
            audioFileSize = parseInt(contentLength);
            console.log(`Auto-fetched audioFileSize: ${audioFileSize} bytes for ${validatedData.audioUrl}`);
          } else {
            return res.status(400).json({ 
              error: "Unable to determine audio file size. Please provide audioFileSize or ensure the audio URL returns a Content-Length header." 
            });
          }
        } catch (error) {
          console.error(`Failed to fetch audioFileSize for ${validatedData.audioUrl}:`, error);
          return res.status(400).json({ 
            error: "Unable to fetch audio file size. Please provide audioFileSize or ensure the audio URL is accessible." 
          });
        }
      }
      
      const episode = await storage.createEpisode({
        ...validatedData,
        audioFileSize,
        publishedAt: validatedData.publishedAt ? new Date(validatedData.publishedAt) : undefined,
      });
      res.status(201).json(episode);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating episode:", error);
      res.status(500).json({ error: "Failed to create episode" });
    }
  });

  // Update episode (protected - requires authentication and ownership)
  app.patch("/api/episodes/:id", requireAuth, async (req, res) => {
    try {
      const episodeId = req.params.id;
      const userId = req.session.userId!;
      
      // Verify the episode exists and belongs to the authenticated user (or user is admin)
      const episode = await storage.getEpisode(episodeId);
      if (!episode) {
        return res.status(404).json({ error: "Episode not found" });
      }
      
      // Get podcast to check ownership
      const podcast = await storage.getPodcast(episode.podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      const user = await storage.getUser(userId);
      const isOwner = podcast.ownerId === userId;
      const isAdmin = user?.role === "ADMIN";
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden - You can only edit episodes from your own podcasts" });
      }
      
      // Validate and update allowed fields (metadata only, not audio files)
      const updateSchema = z.object({
        title: z.string().min(1).optional(),
        notes: z.string().optional(),
        coverArtUrl: z.string().nullable().optional(),
        coverArtAssetId: z.string().nullable().optional(),
        visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updateEpisode(episodeId, validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating episode:", error);
      res.status(500).json({ error: "Failed to update episode" });
    }
  });

  // Upload new audio file for existing episode
  app.post("/api/episodes/:id/audio", requireAuth, uploadSingleAudio.single("audioFile"), async (req, res) => {
    const tempFiles: string[] = [];
    try {
      const userId = req.session.userId!;
      const episodeId = req.params.id;
      
      // Verify the episode exists
      const episode = await storage.getEpisode(episodeId);
      if (!episode) {
        return res.status(404).json({ error: "Episodio no encontrado" });
      }
      
      // Get podcast to check ownership
      const podcast = await storage.getPodcast(episode.podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast no encontrado" });
      }
      
      // Verify user is owner or admin
      const user = await storage.getUser(userId);
      const isOwner = podcast.ownerId === userId;
      const isAdmin = user?.role === "ADMIN";
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "No tienes permiso para modificar este episodio" });
      }
      
      // Verify audio file was uploaded
      const audioFile = req.file;
      if (!audioFile) {
        return res.status(400).json({ error: "Debes subir un archivo de audio" });
      }
      
      // Add temp file for cleanup
      tempFiles.push(audioFile.path);
      
      // Extract duration from MP3 metadata
      let duration = 0;
      try {
        const metadata = await parseFile(audioFile.path);
        duration = Math.round(metadata.format.duration || 0);
      } catch (metadataError) {
        console.warn(`Could not extract duration from ${audioFile.originalname}:`, metadataError);
      }
      
      // Read file from disk into buffer
      const fileBuffer = fs.readFileSync(audioFile.path);
      const fileWithBuffer = {
        ...audioFile,
        buffer: fileBuffer
      };
      
      // Upload new audio file
      const audioAsset = await mediaOrchestrator.saveEpisodeAudio(
        fileWithBuffer,
        userId,
        episodeId,
        podcast.id
      );
      
      // Delete old audio asset if it exists
      if (episode.audioAssetId) {
        try {
          await mediaOrchestrator.deleteMediaAsset(episode.audioAssetId);
        } catch (deleteError) {
          console.warn(`Could not delete old audio asset ${episode.audioAssetId}:`, deleteError);
        }
      }
      
      // Update episode with new audio file
      const updated = await storage.updateEpisode(episodeId, {
        audioAssetId: audioAsset.id,
        audioUrl: undefined, // Clear old URL, will be resolved from asset
        duration,
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error uploading new audio file:", error);
      res.status(500).json({ 
        error: "Error al subir el archivo de audio", 
        detail: error.message 
      });
    } finally {
      // Clean up temporary files
      for (const filePath of tempFiles) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupError) {
          console.error(`Failed to cleanup temp file ${filePath}:`, cleanupError);
        }
      }
    }
  });

  // Embed route - Returns responsive iframe-optimized HTML5 audio player
  app.get("/embed/episode/:id", async (req, res) => {
    try {
      // Use centralized helper for enriched episode with cover art fallback
      let viewerId: string | undefined;
      let userRole: string | undefined;
      
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        viewerId = req.session.userId;
        userRole = user?.role;
      }
      
      const result = await getEpisodeForResponse(req.params.id, viewerId, userRole);
      
      if (!result) {
        res.status(404);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(`
          <!DOCTYPE html>
          <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Episodio no encontrado</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 200px;
                  margin: 0;
                  background: #f5f5f5;
                  color: #333;
                }
              </style>
            </head>
            <body>
              <p>Episodio no encontrado</p>
            </body>
          </html>
        `);
      }
      
      const { episode, podcast, hasAccess } = result;
      
      // IMPORTANT: Embed routes are public iframe surfaces with stricter approval requirements.
      // Authenticated users (admin/owners/delegated roles): trust hasAccess from getEpisodeForResponse.
      // Public users (unauthenticated): require BOTH episode AND podcast to be approved to prevent
      // leaking embargoed branding/audio via iframe embedding.
      let embedHasAccess = hasAccess;
      if (!viewerId) {
        // Public users require both podcast and episode to be approved
        embedHasAccess = embedHasAccess && podcast?.status === "APPROVED";
      }
      
      if (!embedHasAccess) {
        res.status(404);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(`
          <!DOCTYPE html>
          <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Episodio no encontrado</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 200px;
                  margin: 0;
                  background: #f5f5f5;
                  color: #333;
                }
              </style>
            </head>
            <body>
              <p>Episodio no encontrado</p>
            </body>
          </html>
        `);
      }
      
      // Generate URLs
      const siteUrl = getSiteUrl(req);
      const canonicalUrl = getEpisodeCanonicalUrl(siteUrl, episode.podcastId, episode.id);
      
      // Escape HTML entities for safe rendering (requires non-null string input)
      const escapeHtml = (str: string) => str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      // Provide safe defaults before escaping
      const safeEpisodeTitle = episode.title || 'Episodio sin título';
      const safePodcastTitle = podcast?.title || 'Podcast';
      const safeDescription = episode.notes ? episode.notes.substring(0, 200) : safeEpisodeTitle;
      // Use enriched episode's effective cover art (with automatic podcast fallback)
      const safeCoverArtUrl = episode.effectiveCoverArtUrl || '';
      const safeAudioUrl = episode.audioUrl || '';

      const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(safeEpisodeTitle)} - ${escapeHtml(safePodcastTitle)}</title>
    
    <!-- Open Graph meta tags -->
    <meta property="og:type" content="music.song">
    <meta property="og:title" content="${escapeHtml(safeEpisodeTitle)}">
    <meta property="og:description" content="${escapeHtml(safeDescription)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    ${safeCoverArtUrl ? `<meta property="og:image" content="${escapeHtml(safeCoverArtUrl)}">` : ''}
    <meta property="og:audio" content="${escapeHtml(safeAudioUrl)}">
    
    <!-- Twitter Card meta tags -->
    <meta name="twitter:card" content="player">
    <meta name="twitter:title" content="${escapeHtml(safeEpisodeTitle)}">
    <meta name="twitter:description" content="${escapeHtml(safeDescription)}">
    ${safeCoverArtUrl ? `<meta name="twitter:image" content="${escapeHtml(safeCoverArtUrl)}">` : ''}
    
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: #ffffff;
        overflow: hidden;
      }
      
      .player-container {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        max-width: 420px;
        height: 200px;
        margin: 0 auto;
        background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
        border-radius: 8px;
      }
      
      .cover-art {
        width: 120px;
        height: 120px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
        background: rgba(0, 0, 0, 0.1);
      }
      
      .player-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        color: white;
      }
      
      .episode-title {
        font-size: 16px;
        font-weight: 700;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      
      .podcast-title {
        font-size: 13px;
        opacity: 0.9;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      audio {
        width: 100%;
        height: 40px;
        outline: none;
      }
      
      .cta-link {
        display: inline-block;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border-radius: 6px;
        color: white;
        text-decoration: none;
        font-size: 12px;
        font-weight: 600;
        transition: background 0.2s;
        text-align: center;
      }
      
      .cta-link:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      @media (max-width: 380px) {
        .cover-art {
          width: 80px;
          height: 80px;
        }
        .episode-title {
          font-size: 14px;
        }
        .podcast-title {
          font-size: 12px;
        }
      }
    </style>
  </head>
  <body>
    <div class="player-container">
      ${safeCoverArtUrl && safeCoverArtUrl.trim() ? `<img src="${escapeHtml(safeCoverArtUrl)}" alt="${escapeHtml(safePodcastTitle)}" class="cover-art">` : ''}
      <div class="player-content">
        <h2 class="episode-title">${escapeHtml(safeEpisodeTitle)}</h2>
        ${podcast ? `<p class="podcast-title">${escapeHtml(safePodcastTitle)}</p>` : ''}
        <audio controls preload="metadata">
          <source src="${escapeHtml(safeAudioUrl)}" type="audio/mpeg">
          Tu navegador no soporta el elemento de audio.
        </audio>
        <a href="${escapeHtml(canonicalUrl)}" target="_blank" class="cta-link" rel="noopener noreferrer">
          Ver episodio completo →
        </a>
      </div>
    </div>
  </body>
</html>`;

      // Set appropriate headers for iframe embedding (allow all origins for multitenant use)
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Use CSP frame-ancestors instead of deprecated X-Frame-Options
      res.setHeader('Content-Security-Policy', "frame-ancestors *;");
      res.send(html);
    } catch (error) {
      console.error("Error in embed route:", error);
      res.status(500).send("Error loading episode");
    }
  });

  // ==================== CONTENT INVITATION ROUTES ====================
  
  // Create invitation for a podcast
  app.post("/api/podcasts/:id/invitations", requireAuth, async (req, res) => {
    try {
      const podcastId = req.params.id;
      const userId = req.session.userId!;
      
      // Verify podcast exists and user is the owner
      const podcast = await storage.getPodcast(podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "ADMIN";
      const isOwner = podcast.ownerId === userId;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden - Only the podcast owner can invite users" });
      }
      
      // Validate request body
      const invitationSchema = z.object({
        email: z.string().email("Invalid email address"),
        expiresAt: z.string().datetime().optional(),
      });
      
      const validatedData = invitationSchema.parse(req.body);
      
      // Create invitation
      const invitation = await storage.createContentInvitation({
        email: validatedData.email,
        podcastId,
        episodeId: null,
        invitedBy: userId,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
      });
      
      // TODO: Send invitation email using email service
      // const emailService = getEmailService();
      // await emailService.sendInvitationEmail(...)
      
      res.status(201).json(invitation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating podcast invitation:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });
  
  // Get invitations for a podcast
  app.get("/api/podcasts/:id/invitations", requireAuth, async (req, res) => {
    try {
      const podcastId = req.params.id;
      const userId = req.session.userId!;
      
      // Verify podcast exists and user is the owner
      const podcast = await storage.getPodcast(podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "ADMIN";
      const isOwner = podcast.ownerId === userId;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden - Only the podcast owner can view invitations" });
      }
      
      const invitations = await storage.getContentInvitationsByPodcast(podcastId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching podcast invitations:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });
  
  // Create invitation for an episode
  app.post("/api/episodes/:id/invitations", requireAuth, async (req, res) => {
    try {
      const episodeId = req.params.id;
      const userId = req.session.userId!;
      
      // Verify episode exists and user is the owner
      const episode = await storage.getEpisode(episodeId);
      if (!episode) {
        return res.status(404).json({ error: "Episode not found" });
      }
      
      const podcast = await storage.getPodcast(episode.podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "ADMIN";
      const isOwner = podcast.ownerId === userId;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden - Only the podcast owner can invite users to episodes" });
      }
      
      // Validate request body
      const invitationSchema = z.object({
        email: z.string().email("Invalid email address"),
        expiresAt: z.string().datetime().optional(),
      });
      
      const validatedData = invitationSchema.parse(req.body);
      
      // Create invitation
      const invitation = await storage.createContentInvitation({
        email: validatedData.email,
        podcastId: null,
        episodeId,
        invitedBy: userId,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
      });
      
      // TODO: Send invitation email using email service
      
      res.status(201).json(invitation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating episode invitation:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });
  
  // Get invitations for an episode
  app.get("/api/episodes/:id/invitations", requireAuth, async (req, res) => {
    try {
      const episodeId = req.params.id;
      const userId = req.session.userId!;
      
      // Verify episode exists and user is the owner
      const episode = await storage.getEpisode(episodeId);
      if (!episode) {
        return res.status(404).json({ error: "Episode not found" });
      }
      
      const podcast = await storage.getPodcast(episode.podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "ADMIN";
      const isOwner = podcast.ownerId === userId;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden - Only the podcast owner can view episode invitations" });
      }
      
      const invitations = await storage.getContentInvitationsByEpisode(episodeId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching episode invitations:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });
  
  // Create an invitation (generic endpoint that accepts podcastId or episodeId)
  app.post("/api/invitations", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Validate request body - exactly one of podcastId or episodeId must be present
      const invitationSchema = z.object({
        email: z.string().email("Invalid email address"),
        podcastId: z.string().optional(),
        episodeId: z.string().optional(),
        expiresAt: z.string().datetime().optional(),
      }).refine(
        data => (data.podcastId && !data.episodeId) || (!data.podcastId && data.episodeId),
        { message: "Exactly one of podcastId or episodeId must be provided" }
      );
      
      const validatedData = invitationSchema.parse(req.body);
      
      // Verify permissions based on content type
      if (validatedData.podcastId) {
        // Verify podcast exists and user is the owner
        const podcast = await storage.getPodcast(validatedData.podcastId);
        if (!podcast) {
          return res.status(404).json({ error: "Podcast not found" });
        }
        
        const user = await storage.getUser(userId);
        const isAdmin = user?.role === "ADMIN";
        const isOwner = podcast.ownerId === userId;
        
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: "Forbidden - Only the podcast owner can invite users" });
        }
        
        // Create podcast invitation
        const invitation = await storage.createContentInvitation({
          email: validatedData.email,
          podcastId: validatedData.podcastId,
          episodeId: null,
          invitedBy: userId,
          expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        });
        
        return res.status(201).json(invitation);
      } else if (validatedData.episodeId) {
        // Verify episode exists and user is the owner
        const episode = await storage.getEpisode(validatedData.episodeId);
        if (!episode) {
          return res.status(404).json({ error: "Episode not found" });
        }
        
        const podcast = await storage.getPodcast(episode.podcastId);
        if (!podcast) {
          return res.status(404).json({ error: "Podcast not found" });
        }
        
        const user = await storage.getUser(userId);
        const isAdmin = user?.role === "ADMIN";
        const isOwner = podcast.ownerId === userId;
        
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: "Forbidden - Only the podcast owner can invite users to episodes" });
        }
        
        // Create episode invitation
        const invitation = await storage.createContentInvitation({
          email: validatedData.email,
          podcastId: null,
          episodeId: validatedData.episodeId,
          invitedBy: userId,
          expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        });
        
        return res.status(201).json(invitation);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating invitation:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });
  
  // Delete an invitation
  app.delete("/api/invitations/:id", requireAuth, async (req, res) => {
    try {
      const invitationId = req.params.id;
      const userId = req.session.userId!;
      
      // Verify invitation exists
      const invitation = await storage.getContentInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      // Verify user is the one who created the invitation or is admin
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "ADMIN";
      const isInviter = invitation.invitedBy === userId;
      
      if (!isInviter && !isAdmin) {
        return res.status(403).json({ error: "Forbidden - You can only delete invitations you created" });
      }
      
      await storage.deleteContentInvitation(invitationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ error: "Failed to delete invitation" });
    }
  });

  // ==================== ADMIN ROUTES ====================
  
  // User Management
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Exclude password hashes from response
      const usersWithoutPasswords = users.map(({ passwordHash: _, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const validatedData = updateUserRoleSchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Prevent demoting the last admin
      if (user.role === "ADMIN" && validatedData.role !== "ADMIN") {
        const allUsers = await storage.getAllUsers();
        const adminCount = allUsers.filter(u => u.role === "ADMIN").length;
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Cannot demote the last admin" });
        }
      }
      
      const updatedUser = await storage.updateUserRole(userId, validatedData.role);
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });
  
  app.patch("/api/admin/users/:id/requires-approval", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const validatedData = updateUserApprovalSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const updatedUser = await storage.updateUserRequiresApproval(userId, validatedData.requiresApproval);
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating user approval status:", error);
      res.status(500).json({ error: "Failed to update user approval status" });
    }
  });
  
  app.patch("/api/admin/users/:id/active", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const validatedData = updateUserActiveSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Prevent self-deactivation
      if (userId === req.session.userId && !validatedData.isActive) {
        return res.status(400).json({ error: "Cannot deactivate your own account" });
      }
      
      const updatedUser = await storage.updateUserIsActive(userId, validatedData.isActive);
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating user active status:", error);
      res.status(500).json({ error: "Failed to update user active status" });
    }
  });
  
  // Podcast Moderation
  app.get("/api/admin/podcasts", requireAdmin, async (req, res) => {
    try {
      const query = adminPodcastsQuerySchema.parse(req.query);
      const podcasts = await storage.listPodcastsFiltered(
        query.status,
        query.ownerId,
        query.search
      );
      res.json(podcasts);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      console.error("Error fetching podcasts for admin:", error);
      res.status(500).json({ error: "Failed to fetch podcasts" });
    }
  });
  
  app.patch("/api/admin/podcasts/:id/status", requireAdmin, async (req, res) => {
    try {
      const podcastId = req.params.id;
      const validatedData = updatePodcastStatusSchema.parse(req.body);
      
      const podcast = await storage.getPodcast(podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      const updatedPodcast = await storage.updatePodcastStatus(
        podcastId,
        validatedData.status,
        req.session.userId!
      );
      res.json(updatedPodcast);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating podcast status:", error);
      res.status(500).json({ error: "Failed to update podcast status" });
    }
  });
  
  app.delete("/api/admin/podcasts/:id", requireAdmin, async (req, res) => {
    try {
      const podcastId = req.params.id;
      
      const podcast = await storage.getPodcast(podcastId);
      if (!podcast) {
        return res.status(404).json({ error: "Podcast not found" });
      }
      
      await storage.deletePodcast(podcastId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting podcast:", error);
      res.status(500).json({ error: "Failed to delete podcast" });
    }
  });
  
  // Episode Moderation
  app.get("/api/admin/episodes", requireAdmin, async (req, res) => {
    try {
      const query = adminEpisodesQuerySchema.parse(req.query);
      const episodes = await storage.listEpisodesFiltered(
        query.status,
        query.podcastId,
        query.ownerId,
        query.search
      );
      res.json(episodes);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      console.error("Error fetching episodes for admin:", error);
      res.status(500).json({ error: "Failed to fetch episodes" });
    }
  });
  
  app.patch("/api/admin/episodes/:id/status", requireAdmin, async (req, res) => {
    try {
      const episodeId = req.params.id;
      const validatedData = updateEpisodeStatusSchema.parse(req.body);
      
      const episode = await storage.getEpisode(episodeId);
      if (!episode) {
        return res.status(404).json({ error: "Episode not found" });
      }
      
      const updatedEpisode = await storage.updateEpisodeStatus(
        episodeId,
        validatedData.status,
        req.session.userId!
      );
      res.json(updatedEpisode);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating episode status:", error);
      res.status(500).json({ error: "Failed to update episode status" });
    }
  });
  
  app.delete("/api/admin/episodes/:id", requireAdmin, async (req, res) => {
    try {
      const episodeId = req.params.id;
      
      const episode = await storage.getEpisode(episodeId);
      if (!episode) {
        return res.status(404).json({ error: "Episode not found" });
      }
      
      await storage.deleteEpisode(episodeId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting episode:", error);
      res.status(500).json({ error: "Failed to delete episode" });
    }
  });

  // Bulk operations - Users
  app.post("/api/admin/users/bulk-update-role", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkUpdateUsersRoleSchema.parse(req.body);
      const result = await storage.bulkUpdateUsersRole(validatedData.ids, validatedData.role);
      res.json({
        message: `Updated ${result.successIds.length} user(s)`,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error bulk updating user roles:", error);
      res.status(500).json({ error: "Failed to bulk update user roles" });
    }
  });

  app.post("/api/admin/users/bulk-update-active", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkUpdateUsersActiveSchema.parse(req.body);
      const result = await storage.bulkUpdateUsersActive(validatedData.ids, validatedData.isActive);
      res.json({
        message: `Updated ${result.successIds.length} user(s)`,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error bulk updating user active status:", error);
      res.status(500).json({ error: "Failed to bulk update user active status" });
    }
  });

  app.post("/api/admin/users/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkDeleteUsersSchema.parse(req.body);
      const result = await storage.bulkDeleteUsers(validatedData.ids);
      res.json({
        message: `Deleted ${result.successIds.length} user(s)`,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error bulk deleting users:", error);
      res.status(500).json({ error: "Failed to bulk delete users" });
    }
  });

  // Bulk operations - Podcasts
  app.post("/api/admin/podcasts/bulk-update-status", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkUpdatePodcastsStatusSchema.parse(req.body);
      const result = await storage.bulkUpdatePodcastsStatus(
        validatedData.ids,
        validatedData.status,
        req.session.userId!
      );
      res.json({
        message: `Updated ${result.successIds.length} podcast(s)`,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error bulk updating podcast status:", error);
      res.status(500).json({ error: "Failed to bulk update podcast status" });
    }
  });

  app.post("/api/admin/podcasts/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkDeletePodcastsSchema.parse(req.body);
      const result = await storage.bulkDeletePodcasts(validatedData.ids);
      res.json({
        message: `Deleted ${result.successIds.length} podcast(s)`,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error bulk deleting podcasts:", error);
      res.status(500).json({ error: "Failed to bulk delete podcasts" });
    }
  });

  // Bulk operations - Episodes
  app.post("/api/admin/episodes/bulk-update-status", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkUpdateEpisodesStatusSchema.parse(req.body);
      const result = await storage.bulkUpdateEpisodesStatus(
        validatedData.ids,
        validatedData.status,
        req.session.userId!
      );
      res.json({
        message: `Updated ${result.successIds.length} episode(s)`,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error bulk updating episode status:", error);
      res.status(500).json({ error: "Failed to bulk update episode status" });
    }
  });

  app.post("/api/admin/episodes/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkDeleteEpisodesSchema.parse(req.body);
      const result = await storage.bulkDeleteEpisodes(validatedData.ids);
      res.json({
        message: `Deleted ${result.successIds.length} episode(s)`,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error bulk deleting episodes:", error);
      res.status(500).json({ error: "Failed to bulk delete episodes" });
    }
  });

  // Email configuration endpoints
  app.get("/api/admin/email-config", requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllEmailConfigs();
      // Mask password in response for security
      const maskedConfigs = configs.map(config => ({
        ...config,
        smtpPassword: "********",
      }));
      res.json(maskedConfigs);
    } catch (error) {
      console.error("Error fetching email configs:", error);
      res.status(500).json({ error: "Failed to fetch email configurations" });
    }
  });

  app.get("/api/admin/email-config/active", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getActiveEmailConfig();
      if (!config) {
        return res.status(404).json({ error: "No active email configuration found" });
      }
      // Mask password in response for security
      res.json({
        ...config,
        smtpPassword: "********",
      });
    } catch (error) {
      console.error("Error fetching active email config:", error);
      res.status(500).json({ error: "Failed to fetch active email configuration" });
    }
  });

  app.post("/api/admin/email-config", requireAdmin, async (req, res) => {
    try {
      const validatedData = createEmailConfigSchema.parse(req.body);
      const newConfig = await storage.createEmailConfig(validatedData);
      
      // Mask password in response for security
      res.status(201).json({
        ...newConfig,
        smtpPassword: "********",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error creating email config:", error);
      res.status(500).json({ error: "Failed to create email configuration" });
    }
  });

  app.patch("/api/admin/email-config/:id", requireAdmin, async (req, res) => {
    try {
      const configId = req.params.id;
      const validatedData = updateEmailConfigSchema.parse(req.body);
      
      const existingConfig = await storage.getAllEmailConfigs();
      if (!existingConfig.find(c => c.id === configId)) {
        return res.status(404).json({ error: "Email configuration not found" });
      }
      
      const updatedConfig = await storage.updateEmailConfig(configId, validatedData);
      
      // Mask password in response for security
      res.json({
        ...updatedConfig,
        smtpPassword: "********",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating email config:", error);
      res.status(500).json({ error: "Failed to update email configuration" });
    }
  });

  app.patch("/api/admin/email-config/:id/activate", requireAdmin, async (req, res) => {
    try {
      const configId = req.params.id;
      const activeConfig = await storage.setActiveEmailConfig(configId);
      
      // Mask password in response for security
      res.json({
        ...activeConfig,
        smtpPassword: "********",
      });
    } catch (error) {
      console.error("Error activating email config:", error);
      res.status(500).json({ error: "Failed to activate email configuration" });
    }
  });

  app.delete("/api/admin/email-config/:id", requireAdmin, async (req, res) => {
    try {
      const configId = req.params.id;
      
      const existingConfig = await storage.getAllEmailConfigs();
      if (!existingConfig.find(c => c.id === configId)) {
        return res.status(404).json({ error: "Email configuration not found" });
      }
      
      await storage.deleteEmailConfig(configId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting email config:", error);
      res.status(500).json({ error: "Failed to delete email configuration" });
    }
  });

  // Test email configuration - sends a test email with branded template
  app.post("/api/admin/email-config/test", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getActiveEmailConfig();
      
      if (!config) {
        return res.status(404).json({ error: "No hay configuración de email activa. Guarda la configuración primero." });
      }

      if (!config.isActive) {
        return res.status(400).json({ error: "La configuración de email no está activa." });
      }

      // Create nodemailer transporter with stored config
      const nodemailer = await import("nodemailer");
      const { getEmailTemplate } = await import("./email-templates");
      
      const transporter = nodemailer.default.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });

      // Load logo for email
      const logoPath = path.join(process.cwd(), "attached_assets", "audivia-logo.png");
      const attachments: any[] = [];
      let logoBase64: string | undefined;
      
      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: "audivia-logo.png",
          path: logoPath,
          cid: "audivia-logo",
        });
        logoBase64 = fs.readFileSync(logoPath).toString("base64");
      }

      // Generate branded test email
      const testContent = `
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">&#9989;</span>
        </div>
        <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
          ¡Configuración Exitosa!
        </h1>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
          Este es un email de prueba desde <strong style="color: #A78BFA;">Audivia</strong>.
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
          Si recibes este mensaje, la configuración SMTP está funcionando correctamente.
        </p>
        
        <div style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(91, 33, 182, 0.1) 100%); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="color: white; margin: 0 0 15px 0; font-size: 16px;">Configuración utilizada:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Servidor:</td>
              <td style="padding: 8px 0; text-align: right; color: #d1d5db;">${config.smtpHost}:${config.smtpPort}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">SSL/TLS:</td>
              <td style="padding: 8px 0; text-align: right; color: #d1d5db;">${config.smtpSecure ? 'Activado' : 'Desactivado'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Remitente:</td>
              <td style="padding: 8px 0; text-align: right; color: #d1d5db;">${config.fromName}</td>
            </tr>
          </table>
        </div>
      `;

      const html = getEmailTemplate(testContent, false, logoBase64);

      // Send test email to the configured sender email
      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: config.smtpUser,
        subject: "Email de prueba - Audivia",
        html,
        attachments,
      });

      console.log(`[EMAIL] Test email sent successfully to ${config.smtpUser}`);
      res.json({ success: true, message: "Email de prueba enviado correctamente" });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      
      // Provide more helpful error messages
      let errorMessage = "Error al enviar email de prueba";
      let details = error.message || "Verifica la configuración SMTP";
      
      if (error.code === "ESOCKET" || error.code === "ECONNREFUSED") {
        details = "No se pudo conectar al servidor SMTP. Verifica que el servidor y puerto sean correctos, o que el firewall permita la conexión.";
      } else if (error.code === "EAUTH") {
        details = "Error de autenticación. Verifica el usuario y contraseña SMTP.";
      } else if (error.code === "ETIMEDOUT") {
        details = "Tiempo de conexión agotado. El servidor SMTP no responde.";
      }
      
      res.status(500).json({ error: errorMessage, details });
    }
  });

  // Get email template previews
  app.get("/api/admin/email-templates", requireAdmin, async (req, res) => {
    try {
      const { getAllTemplates } = await import("./email-templates");
      const logoPath = path.join(process.cwd(), "attached_assets", "audivia-logo.png");
      let logoBase64: string | undefined;
      
      if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath).toString("base64");
      }
      
      const templates = getAllTemplates(logoBase64);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  // Get single email template preview
  app.get("/api/admin/email-templates/:id", requireAdmin, async (req, res) => {
    try {
      const { getTemplatePreview } = await import("./email-templates");
      const logoPath = path.join(process.cwd(), "attached_assets", "audivia-logo.png");
      let logoBase64: string | undefined;
      
      if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath).toString("base64");
      }
      
      const template = getTemplatePreview(req.params.id, logoBase64);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching email template:", error);
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  // Render email template HTML (for iframe preview)
  app.get("/api/admin/email-templates/:id/html", requireAdmin, async (req, res) => {
    try {
      const { getTemplatePreview } = await import("./email-templates");
      const logoPath = path.join(process.cwd(), "attached_assets", "audivia-logo.png");
      let logoBase64: string | undefined;
      
      if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath).toString("base64");
      }
      
      const template = getTemplatePreview(req.params.id, logoBase64);
      if (!template) {
        return res.status(404).send("Template not found");
      }
      res.setHeader("Content-Type", "text/html");
      res.send(template.html);
    } catch (error) {
      console.error("Error rendering email template:", error);
      res.status(500).send("Failed to render email template");
    }
  });

  // PATCH email config without ID (update or create the active one)
  app.patch("/api/admin/email-config", requireAdmin, async (req, res) => {
    try {
      const validatedData = updateEmailConfigSchema.parse(req.body);
      
      // Check if there's an existing config
      const configs = await storage.getAllEmailConfigs();
      
      if (configs.length > 0) {
        // Update the first config
        const updatedConfig = await storage.updateEmailConfig(configs[0].id, {
          ...validatedData,
          isActive: true,
        });
        
        res.json({
          ...updatedConfig,
          smtpPassword: "********",
        });
      } else {
        // Create new config
        const newConfig = await storage.createEmailConfig({
          ...validatedData,
          smtpPassword: validatedData.smtpPassword || "",
          isActive: true,
        });
        
        res.status(201).json({
          ...newConfig,
          smtpPassword: "********",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating email config:", error);
      res.status(500).json({ error: "Failed to update email configuration" });
    }
  });

  // External services endpoints
  app.get("/api/admin/external-services", requireAdmin, async (req, res) => {
    try {
      const services = await storage.getExternalServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching external services:", error);
      res.status(500).json({ error: "Error al obtener servicios externos" });
    }
  });

  app.post("/api/admin/external-services", requireAdmin, async (req, res) => {
    try {
      const { name, description, url, iconName, sortOrder, isActive } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ error: "Nombre y URL son requeridos" });
      }

      const service = await storage.createExternalService({
        name,
        description: description || null,
        url,
        iconName: iconName || "ExternalLink",
        sortOrder: sortOrder || 0,
        isActive: isActive !== false,
      });
      
      res.status(201).json(service);
    } catch (error) {
      console.error("Error creating external service:", error);
      res.status(500).json({ error: "Error al crear servicio externo" });
    }
  });

  app.patch("/api/admin/external-services/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, url, iconName, sortOrder, isActive } = req.body;
      
      const existing = await storage.getExternalService(id);
      if (!existing) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }

      const updated = await storage.updateExternalService(id, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(url !== undefined && { url }),
        ...(iconName !== undefined && { iconName }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating external service:", error);
      res.status(500).json({ error: "Error al actualizar servicio externo" });
    }
  });

  app.delete("/api/admin/external-services/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const existing = await storage.getExternalService(id);
      if (!existing) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }

      await storage.deleteExternalService(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting external service:", error);
      res.status(500).json({ error: "Error al eliminar servicio externo" });
    }
  });

  // Emergency endpoint to reset admin password (use only once in production)
  app.post("/api/emergency/reset-admin-password", async (req, res) => {
    try {
      // Security: Only allow if ADMIN_PASSWORD is set in environment
      if (!process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ error: "Emergency reset not configured" });
      }

      // Get admin email from environment or default
      const adminEmail = process.env.ADMIN_EMAIL || "admin@podcasthub.local";
      
      // Find admin user
      const user = await storage.getUserByEmail(adminEmail);
      if (!user) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      if (user.role !== "ADMIN") {
        return res.status(403).json({ error: "User is not an admin" });
      }

      // Hash the new password from environment
      const newPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      
      // Update password
      await storage.updateUserPassword(user.id, newPasswordHash);
      
      res.json({ 
        message: "Admin password reset successfully",
        email: adminEmail,
        note: "You can now login with the password from ADMIN_PASSWORD environment variable"
      });
    } catch (error) {
      console.error("Error resetting admin password:", error);
      res.status(500).json({ error: "Failed to reset admin password" });
    }
  });

  // ==================== PayPal Routes ====================

  // Get PayPal client configuration (public)
  app.get("/api/paypal/config", async (req, res) => {
    try {
      const config = await paypalService.getPayPalClientId();
      if (!config) {
        return res.status(404).json({ error: "PayPal no está configurado" });
      }
      res.json(config);
    } catch (error: any) {
      console.error("Error getting PayPal config:", error);
      res.status(500).json({ error: error.message || "Error obteniendo configuración de PayPal" });
    }
  });

  // Check if PayPal is configured
  app.get("/api/paypal/status", async (req, res) => {
    try {
      const isConfigured = await paypalService.isPayPalConfigured();
      res.json({ isConfigured });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get PayPal client ID for frontend
  app.get("/api/paypal/client-id", async (req, res) => {
    try {
      const config = await paypalService.getPayPalClientId();
      if (!config) {
        return res.status(404).json({ error: "PayPal no está configurado" });
      }
      res.json(config);
    } catch (error: any) {
      console.error("Error getting PayPal client ID:", error);
      res.status(500).json({ error: error.message || "Error obteniendo cliente de PayPal" });
    }
  });

  // ===== CART PAYPAL ENDPOINTS =====

  // Create order for cart checkout
  app.post("/api/paypal/create-cart-order", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { discountCode: discountCodeInput } = req.body || {};
      const cartItems = await storage.getCartItems(userId);
      
      if (cartItems.length === 0) {
        return res.status(400).json({ error: "El carrito está vacío" });
      }

      const cartTotal = await storage.getCartTotal(userId);
      let finalTotalCents = cartTotal.totalCents;
      let discountAmountCents = 0;
      let validatedDiscountCode = null;
      
      // Validate and apply discount if provided - using server-side validation
      if (discountCodeInput) {
        const validation = await storage.validateDiscountCode(
          discountCodeInput,
          userId,
          cartTotal.totalCents,
          false // forSubscription = false for cart purchases
        );
        
        if (validation.valid && validation.discountCode) {
          validatedDiscountCode = validation.discountCode;
          
          // Calculate discount server-side
          if (validatedDiscountCode.type === "PERCENTAGE") {
            discountAmountCents = Math.round((cartTotal.totalCents * validatedDiscountCode.value) / 100);
          } else {
            discountAmountCents = Math.min(validatedDiscountCode.value, cartTotal.totalCents);
          }
          finalTotalCents = Math.max(0, cartTotal.totalCents - discountAmountCents);
          
          // Store validated discount in session for capture validation
          req.session.pendingDiscount = {
            discountCodeId: validatedDiscountCode.id,
            discountCode: validatedDiscountCode.code,
            discountAmountCents,
            originalTotalCents: cartTotal.totalCents,
            finalTotalCents,
          };
        }
      } else {
        // Clear any pending discount if no code provided
        req.session.pendingDiscount = undefined;
      }
      
      // Get PayPal config
      const paypalConfig = await storage.getPayPalConfig();
      if (!paypalConfig?.clientId || !paypalConfig?.clientSecret) {
        return res.status(500).json({ error: "PayPal no está configurado" });
      }

      // Get PayPal access token
      const tokenResponse = await fetch(
        `${paypalConfig.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"}/v1/oauth2/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${paypalConfig.clientId}:${paypalConfig.clientSecret}`).toString("base64")}`,
          },
          body: "grant_type=client_credentials",
        }
      );
      
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Create PayPal order with discount breakdown if applicable
      const breakdown: any = {
        item_total: {
          currency_code: cartTotal.currency,
          value: (cartTotal.totalCents / 100).toFixed(2),
        },
      };
      
      if (discountAmountCents > 0) {
        breakdown.discount = {
          currency_code: cartTotal.currency,
          value: (discountAmountCents / 100).toFixed(2),
        };
      }

      // Create PayPal order
      const orderResponse = await fetch(
        `${paypalConfig.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"}/v2/checkout/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
              {
                amount: {
                  currency_code: cartTotal.currency,
                  value: (finalTotalCents / 100).toFixed(2),
                  breakdown,
                },
                items: cartItems.map(item => ({
                  name: item.audiobook.title.substring(0, 127),
                  quantity: "1",
                  unit_amount: {
                    currency_code: item.audiobook.currency,
                    value: (item.audiobook.priceCents / 100).toFixed(2),
                  },
                  category: "DIGITAL_GOODS",
                })),
                description: `Compra de ${cartItems.length} audiolibro(s) en Audivia${validatedDiscountCode ? ` (Descuento: ${validatedDiscountCode.code})` : ""}`,
              },
            ],
            application_context: {
              brand_name: "Audivia",
              landing_page: "NO_PREFERENCE",
              user_action: "PAY_NOW",
            },
          }),
        }
      );

      const orderData = await orderResponse.json();
      
      if (!orderResponse.ok) {
        console.error("PayPal order creation error:", orderData);
        return res.status(500).json({ error: "Error creando orden de PayPal" });
      }

      res.json({ 
        orderId: orderData.id, 
        discountApplied: validatedDiscountCode ? {
          code: validatedDiscountCode.code,
          discountAmountCents,
          finalTotalCents,
        } : null 
      });
    } catch (error: any) {
      console.error("Error creating cart PayPal order:", error);
      res.status(500).json({ error: error.message || "Error creando orden de PayPal" });
    }
  });

  // Capture cart order
  app.post("/api/paypal/capture-cart-order", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.body;
      const userId = req.session.userId!;
      
      if (!orderId) {
        return res.status(400).json({ error: "orderId es requerido" });
      }

      const cartItems = await storage.getCartItems(userId);
      if (cartItems.length === 0) {
        return res.status(400).json({ error: "El carrito está vacío" });
      }

      // Get PayPal config
      const paypalConfig = await storage.getPayPalConfig();
      if (!paypalConfig?.clientId || !paypalConfig?.clientSecret) {
        return res.status(500).json({ error: "PayPal no está configurado" });
      }

      // Get PayPal access token
      const tokenResponse = await fetch(
        `${paypalConfig.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"}/v1/oauth2/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${paypalConfig.clientId}:${paypalConfig.clientSecret}`).toString("base64")}`,
          },
          body: "grant_type=client_credentials",
        }
      );
      
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Capture order
      const captureResponse = await fetch(
        `${paypalConfig.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"}/v2/checkout/orders/${orderId}/capture`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const captureData = await captureResponse.json();

      if (!captureResponse.ok || captureData.status !== "COMPLETED") {
        console.error("PayPal capture error:", captureData);
        // Invalidate session discount on any capture failure to prevent reuse
        req.session.pendingDiscount = undefined;
        return res.status(500).json({ error: "Error capturando pago de PayPal" });
      }

      // Get pending discount from session
      const pendingDiscount = req.session.pendingDiscount;
      
      // Verify captured amount matches expected total - sum ALL captures from ALL purchase units
      const purchaseUnits = captureData.purchase_units || [];
      const cartCurrency = cartItems[0]?.audiobook?.currency || "EUR";
      let totalCapturedCents = 0;
      for (const unit of purchaseUnits) {
        const captures = unit?.payments?.captures || [];
        for (const capture of captures) {
          // Verify currency matches expected
          if (capture.amount?.currency_code && capture.amount.currency_code !== cartCurrency) {
            console.error("Currency mismatch:", { expected: cartCurrency, received: capture.amount.currency_code });
            req.session.pendingDiscount = undefined;
            return res.status(400).json({ 
              error: "Moneda de pago incorrecta. Por favor, intenta de nuevo." 
            });
          }
          totalCapturedCents += Math.round(parseFloat(capture.amount?.value || "0") * 100);
        }
      }
      
      const expectedCents = pendingDiscount?.finalTotalCents || 
        cartItems.reduce((sum, item) => sum + item.audiobook.priceCents, 0);
      
      // Allow small rounding differences (max 1 cent per item)
      const tolerance = cartItems.length;
      if (Math.abs(totalCapturedCents - expectedCents) > tolerance) {
        console.error("Amount mismatch:", { totalCapturedCents, expectedCents, tolerance, purchaseUnitsCount: purchaseUnits.length });
        // Invalidate session discount immediately to prevent reuse
        req.session.pendingDiscount = undefined;
        return res.status(400).json({ 
          error: "El monto capturado no coincide con el esperado. Por favor, intenta de nuevo." 
        });
      }
      
      // Clear pending discount immediately after successful reconciliation
      const appliedDiscount = pendingDiscount;
      req.session.pendingDiscount = undefined;
      
      // Create purchases for all cart items
      const user = await storage.getUser(userId);
      const billingProfile = await storage.getBillingProfile(userId);
      
      // Calculate per-item discount distribution if discount applied
      const totalItemsCents = cartItems.reduce((sum, item) => sum + item.audiobook.priceCents, 0);
      let remainingDiscount = appliedDiscount?.discountAmountCents || 0;
      
      const createdPurchaseIds: string[] = [];
      const createdInvoices: Array<{ invoice: Invoice; pdfPath: string | null; audiobookTitle: string }> = [];
      const purchasedAudiobooks: Array<{ title: string; invoiceNumber: string | null }> = [];
      
      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        
        // Distribute discount proportionally to each item
        let itemDiscount = 0;
        if (remainingDiscount > 0 && totalItemsCents > 0) {
          const proportion = item.audiobook.priceCents / totalItemsCents;
          itemDiscount = Math.round((appliedDiscount?.discountAmountCents || 0) * proportion);
          // Last item gets remaining to avoid rounding issues
          if (i === cartItems.length - 1) {
            itemDiscount = remainingDiscount;
          }
          remainingDiscount -= itemDiscount;
        }
        
        const finalItemPrice = Math.max(0, item.audiobook.priceCents - itemDiscount);
        
        // Create purchase record
        const purchase = await storage.createPurchase({
          userId,
          audiobookId: item.audiobookId,
          paypalOrderId: orderId,
          amountCents: finalItemPrice,
          currency: item.audiobook.currency,
          status: "COMPLETED",
        });
        
        createdPurchaseIds.push(purchase.id);

        // Create invoice and generate PDF if billing profile exists
        let invoiceNumber: string | null = null;
        if (billingProfile) {
          const lineItems = [{
            description: item.audiobook.title,
            quantity: 1,
            unitPriceCents: item.audiobook.priceCents,
            totalCents: item.audiobook.priceCents,
          }];
          
          // Add discount line item if applicable
          if (itemDiscount > 0 && appliedDiscount) {
            lineItems.push({
              description: `Descuento (${appliedDiscount.discountCode})`,
              quantity: 1,
              unitPriceCents: -itemDiscount,
              totalCents: -itemDiscount,
            });
          }
          
          const invoice = await storage.createInvoice({
            userId,
            purchaseId: purchase.id,
            billingProfileId: billingProfile.id,
            type: "PURCHASE",
            status: "PAID",
            totalCents: finalItemPrice,
            currency: item.audiobook.currency,
            paymentMethod: "PAYPAL",
            paymentReference: orderId,
          }, lineItems);
          
          invoiceNumber = invoice.invoiceNumber;
          
          // Generate PDF for this invoice
          try {
            const pdfPath = await invoiceService.generatePDF(invoice.id);
            await storage.updateInvoicePdfPath(invoice.id, pdfPath);
            
            // Fetch fresh invoice with updated pdfPath
            const freshInvoice = await storage.getInvoice(invoice.id);
            if (freshInvoice) {
              createdInvoices.push({ invoice: freshInvoice, pdfPath, audiobookTitle: item.audiobook.title });
            }
          } catch (pdfError) {
            console.error("Error generating invoice PDF:", pdfError);
            // Still store invoice for email but without PDF path
            createdInvoices.push({ invoice, pdfPath: null, audiobookTitle: item.audiobook.title });
          }
        }
        
        // Track audiobook for purchase confirmation (always, even without billing profile)
        // Use invoice number if available, otherwise use purchase ID as reference
        purchasedAudiobooks.push({ 
          title: item.audiobook.title, 
          invoiceNumber: invoiceNumber || `REF-${purchase.id.substring(0, 8).toUpperCase()}`
        });
      }
      
      // Record discount code usage if applied
      if (appliedDiscount?.discountCodeId && createdPurchaseIds.length > 0) {
        try {
          await storage.recordDiscountCodeUsage(
            appliedDiscount.discountCodeId,
            userId,
            createdPurchaseIds[0], // Reference first purchase
            appliedDiscount.discountAmountCents
          );
          await storage.incrementDiscountCodeUsage(appliedDiscount.discountCodeId);
        } catch (err) {
          console.error("Error recording discount usage:", err);
          // Don't fail the purchase if discount recording fails
        }
      }

      // Clear cart
      await storage.clearCart(userId);
      
      // Send email notifications
      if (user?.email) {
        let confirmationsSent = 0;
        let invoicesSent = 0;
        
        try {
          const emailService = await getEmailService(storage);
          
          // Send purchase confirmations for ALL audiobooks (even without invoices)
          for (const { title, invoiceNumber } of purchasedAudiobooks) {
            try {
              await emailService.sendPurchaseConfirmation(
                user.email,
                user.displayName || user.username,
                title,
                invoiceNumber || ''
              );
              confirmationsSent++;
            } catch (err) {
              console.error(`Error sending confirmation for "${title}":`, err);
            }
          }
          
          // Send invoice emails only when invoices were created (billing profile exists)
          for (const { invoice, pdfPath } of createdInvoices) {
            try {
              await emailService.sendInvoiceEmail(
                user.email,
                user.displayName || user.username,
                invoice,
                pdfPath
              );
              invoicesSent++;
            } catch (err) {
              console.error(`Error sending invoice ${invoice.invoiceNumber}:`, err);
            }
          }
          
          console.log(`[EMAIL] Sent ${confirmationsSent}/${purchasedAudiobooks.length} confirmations and ${invoicesSent}/${createdInvoices.length} invoices to ${user.email}`);
        } catch (emailError) {
          console.error("Error initializing email service:", emailError);
        }
      }

      res.json({ success: true, orderStatus: captureData.status });
    } catch (error: any) {
      console.error("Error capturing cart PayPal order:", error);
      res.status(500).json({ error: error.message || "Error capturando pago" });
    }
  });

  // Create order for audiobook purchase
  app.post("/api/paypal/orders", requireAuth, async (req, res) => {
    try {
      const { audiobookId } = req.body;
      
      if (!audiobookId) {
        return res.status(400).json({ error: "audiobookId es requerido" });
      }

      const audiobook = await storage.getAudiobook(audiobookId);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiolibro no encontrado" });
      }

      if (audiobook.isFree || audiobook.priceCents === 0) {
        return res.status(400).json({ error: "Este audiolibro es gratuito" });
      }

      // Check if already purchased
      const existingPurchase = await storage.getUserPurchaseForAudiobook(req.session.userId!, audiobookId);
      if (existingPurchase && existingPurchase.status === "COMPLETED") {
        return res.status(400).json({ error: "Ya has comprado este audiolibro" });
      }

      const result = await paypalService.createOrder(
        audiobookId,
        req.session.userId!,
        audiobook.priceCents,
        audiobook.currency
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error creating PayPal order:", error);
      res.status(500).json({ error: error.message || "Error creando orden de PayPal" });
    }
  });

  // Capture payment for order
  app.post("/api/paypal/orders/:orderId/capture", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.session.userId as string;
      
      const purchase = await storage.getPurchaseByPayPalOrderId(orderId);
      if (!purchase) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }
      if (purchase.userId !== userId) {
        return res.status(403).json({ error: "No tienes permiso para capturar esta orden" });
      }
      if (purchase.status === "COMPLETED") {
        return res.json({ success: true, purchase, message: "Orden ya capturada" });
      }
      
      const result = await paypalService.captureOrder(orderId);
      res.json(result);
    } catch (error: any) {
      console.error("Error capturing PayPal order:", error);
      res.status(500).json({ error: error.message || "Error capturando pago" });
    }
  });

  // Get order status
  app.get("/api/paypal/orders/:orderId", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await paypalService.getOrderStatus(orderId);
      res.json(order);
    } catch (error: any) {
      console.error("Error getting PayPal order:", error);
      res.status(500).json({ error: error.message || "Error obteniendo orden" });
    }
  });

  // Create subscription
  app.post("/api/paypal/subscriptions", requireAuth, async (req, res) => {
    try {
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({ error: "planId es requerido" });
      }

      // Check if user already has active subscription
      const existingSubscription = await storage.getUserActiveSubscription(req.session.userId!);
      if (existingSubscription) {
        return res.status(400).json({ error: "Ya tienes una suscripción activa" });
      }

      const result = await paypalService.createSubscription(planId, req.session.userId!);
      res.json(result);
    } catch (error: any) {
      console.error("Error creating PayPal subscription:", error);
      res.status(500).json({ error: error.message || "Error creando suscripción" });
    }
  });

  // Activate subscription after PayPal approval
  app.post("/api/paypal/subscriptions/:subscriptionId/activate", requireAuth, async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "planId es requerido" });
      }

      const result = await paypalService.activateSubscription(
        subscriptionId,
        planId,
        req.session.userId!
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error activating PayPal subscription:", error);
      res.status(500).json({ error: error.message || "Error activando suscripción" });
    }
  });

  // Cancel subscription
  app.post("/api/paypal/subscriptions/:subscriptionId/cancel", requireAuth, async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const { reason } = req.body;
      
      // Verify user owns this subscription
      const userSubscription = await storage.getUserSubscriptionByPayPalId(req.session.userId!, subscriptionId);
      if (!userSubscription) {
        return res.status(404).json({ error: "Suscripción no encontrada" });
      }

      const result = await paypalService.cancelSubscription(subscriptionId, reason);
      res.json(result);
    } catch (error: any) {
      console.error("Error canceling PayPal subscription:", error);
      res.status(500).json({ error: error.message || "Error cancelando suscripción" });
    }
  });

  // Get subscription status
  app.get("/api/paypal/subscriptions/:subscriptionId", requireAuth, async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const subscription = await paypalService.getSubscriptionStatus(subscriptionId);
      res.json(subscription);
    } catch (error: any) {
      console.error("Error getting PayPal subscription:", error);
      res.status(500).json({ error: error.message || "Error obteniendo suscripción" });
    }
  });

  // Get user's current subscription
  app.get("/api/user/subscription", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getUserActiveSubscription(req.session.userId!);
      res.json({ subscription });
    } catch (error: any) {
      console.error("Error getting user subscription:", error);
      res.status(500).json({ error: error.message || "Error obteniendo suscripción" });
    }
  });

  // Get user's purchases
  app.get("/api/user/purchases", requireAuth, async (req, res) => {
    try {
      const purchases = await storage.getUserPurchases(req.session.userId!);
      res.json(purchases);
    } catch (error: any) {
      console.error("Error getting user purchases:", error);
      res.status(500).json({ error: error.message || "Error obteniendo compras" });
    }
  });

  // Billing profile routes
  app.get("/api/user/billing-profile", requireAuth, async (req, res) => {
    try {
      const profile = await storage.getBillingProfile(req.session.userId!);
      res.json({ profile });
    } catch (error: any) {
      console.error("Error getting billing profile:", error);
      res.status(500).json({ error: error.message || "Error obteniendo perfil de facturacion" });
    }
  });

  app.post("/api/user/billing-profile", requireAuth, async (req, res) => {
    try {
      const data = insertBillingProfileSchema.parse({ ...req.body, userId: req.session.userId });
      
      const existingProfile = await storage.getBillingProfile(req.session.userId!);
      let profile;
      
      if (existingProfile) {
        profile = await storage.updateBillingProfile(req.session.userId!, data);
      } else {
        profile = await storage.createBillingProfile(data);
      }
      
      res.json({ profile });
    } catch (error: any) {
      console.error("Error saving billing profile:", error);
      res.status(500).json({ error: error.message || "Error guardando perfil de facturacion" });
    }
  });

  // Invoice routes
  app.get("/api/user/invoices", requireAuth, async (req, res) => {
    try {
      const invoicesList = await storage.getUserInvoices(req.session.userId!);
      res.json(invoicesList);
    } catch (error: any) {
      console.error("Error getting invoices:", error);
      res.status(500).json({ error: error.message || "Error obteniendo facturas" });
    }
  });

  app.get("/api/invoices/:invoiceId", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      if (invoice.userId !== req.session.userId) {
        return res.status(403).json({ error: "No tienes permiso para ver esta factura" });
      }
      const lineItems = await storage.getInvoiceLineItems(invoice.id);
      res.json({ invoice, lineItems });
    } catch (error: any) {
      console.error("Error getting invoice:", error);
      res.status(500).json({ error: error.message || "Error obteniendo factura" });
    }
  });

  app.get("/api/invoices/:invoiceId/download", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      if (invoice.userId !== req.session.userId) {
        return res.status(403).json({ error: "No tienes permiso para descargar esta factura" });
      }
      
      if (!invoice.pdfPath || !fs.existsSync(invoice.pdfPath)) {
        const pdfPath = await invoiceService.generatePDF(invoice.id);
        await storage.updateInvoicePdfPath(invoice.id, pdfPath);
        invoice.pdfPath = pdfPath;
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      res.sendFile(invoice.pdfPath!);
    } catch (error: any) {
      console.error("Error downloading invoice:", error);
      res.status(500).json({ error: error.message || "Error descargando factura" });
    }
  });

  // RSS Feed token routes
  app.get("/api/user/rss-token", requireAuth, async (req, res) => {
    try {
      const token = await storage.getRssFeedToken(req.session.userId!);
      res.json({ token: token || null });
    } catch (error: any) {
      console.error("Error getting RSS token:", error);
      res.status(500).json({ error: error.message || "Error obteniendo token RSS" });
    }
  });

  app.post("/api/user/rss-token", requireAuth, async (req, res) => {
    try {
      const existingToken = await storage.getRssFeedToken(req.session.userId!);
      const newToken = crypto.randomUUID();
      
      let token;
      if (existingToken) {
        token = await storage.regenerateRssFeedToken(req.session.userId!, newToken);
      } else {
        token = await storage.createRssFeedToken(req.session.userId!, newToken);
      }
      
      res.json({ token });
    } catch (error: any) {
      console.error("Error creating/regenerating RSS token:", error);
      res.status(500).json({ error: error.message || "Error generando token RSS" });
    }
  });

  // Public RSS Feed endpoint for podcast apps (AntennaPod, etc.)
  app.get("/feed/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const feedToken = await storage.getRssFeedTokenByToken(token);
      if (!feedToken || !feedToken.isActive) {
        return res.status(404).send("Feed not found");
      }
      
      // Update last accessed timestamp
      await storage.updateRssFeedTokenAccess(token);
      
      const user = await storage.getUser(feedToken.userId);
      if (!user) {
        return res.status(404).send("Feed not found");
      }
      
      // Get user's accessible audiobooks (purchases + active subscription)
      const purchases = await storage.getUserPurchases(feedToken.userId);
      const subscription = await storage.getUserActiveSubscription(feedToken.userId);
      
      // Get purchased audiobook IDs
      const purchasedIds = new Set(purchases.map(p => p.audiobookId));
      
      // Get all audiobooks the user has access to
      let accessibleAudiobooks: any[] = [];
      
      if (subscription) {
        // Subscriber has access to all audiobooks
        const allAudiobooks = await storage.getPublicAudiobooks();
        accessibleAudiobooks = allAudiobooks;
      } else {
        // Only purchased audiobooks + free audiobooks
        const allAudiobooks = await storage.getPublicAudiobooks();
        accessibleAudiobooks = allAudiobooks.filter(ab => 
          purchasedIds.has(ab.id) || ab.isFree
        );
      }
      
      // Build RSS feed
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      let items = "";
      for (const audiobook of accessibleAudiobooks) {
        const chapters = await storage.getChaptersByAudiobook(audiobook.id);
        
        for (const chapter of chapters) {
          if (!chapter.audioUrl) continue;
          
          const pubDate = new Date(chapter.createdAt).toUTCString();
          const duration = formatDurationForRss(chapter.duration);
          const audioUrl = chapter.audioUrl.startsWith('http') 
            ? chapter.audioUrl 
            : `${baseUrl}${chapter.audioUrl}`;
          const coverUrl = audiobook.coverArtUrl?.startsWith('http')
            ? audiobook.coverArtUrl
            : audiobook.coverArtUrl ? `${baseUrl}${audiobook.coverArtUrl}` : '';
          
          items += `
    <item>
      <title>${escapeXml(`${audiobook.title} - Cap. ${chapter.chapterNumber}: ${chapter.title}`)}</title>
      <description><![CDATA[${chapter.description || audiobook.description || ''}]]></description>
      <enclosure url="${escapeXml(audioUrl)}" type="audio/mpeg" length="${chapter.audioFileSize || 0}"/>
      <guid isPermaLink="false">${chapter.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <itunes:author>${escapeXml(audiobook.author)}</itunes:author>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:episode>${chapter.chapterNumber}</itunes:episode>
      <itunes:title>${escapeXml(chapter.title)}</itunes:title>
      ${coverUrl ? `<itunes:image href="${escapeXml(coverUrl)}"/>` : ''}
    </item>`;
        }
      }
      
      const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Audivia - Biblioteca de ${escapeXml(user.username)}</title>
    <link>${baseUrl}</link>
    <description>Tu biblioteca personal de audiolibros en Audivia</description>
    <language>es</language>
    <itunes:author>Audivia</itunes:author>
    <itunes:summary>Audiolibros adquiridos y suscripciones activas</itunes:summary>
    <itunes:category text="Arts">
      <itunes:category text="Books"/>
    </itunes:category>
    ${items}
  </channel>
</rss>`;
      
      res.set('Content-Type', 'application/rss+xml; charset=utf-8');
      res.send(feedXml);
    } catch (error: any) {
      console.error("Error generating RSS feed:", error);
      res.status(500).send("Error generating feed");
    }
  });

  // PayPal webhook handler
  app.post("/api/paypal/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const headers = {
        "paypal-auth-algo": req.headers["paypal-auth-algo"] as string,
        "paypal-cert-url": req.headers["paypal-cert-url"] as string,
        "paypal-transmission-id": req.headers["paypal-transmission-id"] as string,
        "paypal-transmission-sig": req.headers["paypal-transmission-sig"] as string,
        "paypal-transmission-time": req.headers["paypal-transmission-time"] as string,
      };

      const body = req.body.toString();
      const isValid = await paypalService.verifyWebhookSignature(headers, body);

      if (!isValid) {
        console.error("Invalid PayPal webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }

      const event = JSON.parse(body);
      console.log("PayPal webhook event:", event.event_type);

      switch (event.event_type) {
        case "PAYMENT.CAPTURE.COMPLETED":
          // Handle completed payment - mark purchase as completed without re-capturing
          const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
          if (orderId) {
            const captureId = event.resource?.id;
            const payerEmail = event.resource?.payer?.email_address;
            await storage.markPurchaseCompletedByPayPalOrderId(orderId, captureId, payerEmail);
            console.log("Purchase marked as completed via webhook:", orderId);
          }
          break;

        case "PAYMENT.CAPTURE.REFUNDED":
          // Handle refund
          const refundedOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
          if (refundedOrderId) {
            const purchase = await storage.getPurchaseByPayPalOrderId(refundedOrderId);
            if (purchase) {
              await storage.updatePurchaseStatus(purchase.id, "REFUNDED");
            }
          }
          break;

        case "BILLING.SUBSCRIPTION.ACTIVATED":
          // Subscription activated - already handled in activate endpoint
          break;

        case "BILLING.SUBSCRIPTION.CANCELLED":
        case "BILLING.SUBSCRIPTION.SUSPENDED":
          const subscriptionId = event.resource?.id;
          if (subscriptionId) {
            await storage.updateSubscriptionStatusByPayPalId(subscriptionId, "CANCELED");
          }
          break;

        case "BILLING.SUBSCRIPTION.EXPIRED":
          const expiredSubscriptionId = event.resource?.id;
          if (expiredSubscriptionId) {
            await storage.updateSubscriptionStatusByPayPalId(expiredSubscriptionId, "EXPIRED");
          }
          break;

        default:
          console.log("Unhandled PayPal event:", event.event_type);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Error processing PayPal webhook:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create PayPal product for subscriptions
  app.post("/api/admin/paypal/products", requireAdmin, async (req, res) => {
    try {
      const { name, description } = req.body;
      const product = await paypalService.createPayPalProduct(name, description);
      res.json(product);
    } catch (error: any) {
      console.error("Error creating PayPal product:", error);
      res.status(500).json({ error: error.message || "Error creando producto" });
    }
  });

  // Admin: Create PayPal plan for subscriptions
  app.post("/api/admin/paypal/plans", requireAdmin, async (req, res) => {
    try {
      const { productId, name, description, priceCents, currency, intervalMonths, trialDays } = req.body;
      const plan = await paypalService.createPayPalPlan(
        productId,
        name,
        description,
        priceCents,
        currency,
        intervalMonths,
        trialDays || 0
      );
      res.json(plan);
    } catch (error: any) {
      console.error("Error creating PayPal plan:", error);
      res.status(500).json({ error: error.message || "Error creando plan" });
    }
  });

  // Admin: Update subscription plan with PayPal IDs
  app.patch("/api/admin/subscription-plans/:id/paypal", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { paypalPlanId, paypalProductId } = req.body;
      
      const plan = await storage.updateSubscriptionPlanPayPalIds(id, paypalPlanId, paypalProductId);
      res.json(plan);
    } catch (error: any) {
      console.error("Error updating subscription plan:", error);
      res.status(500).json({ error: error.message || "Error actualizando plan" });
    }
  });

  // Admin: Save PayPal configuration
  app.post("/api/admin/paypal/config", requireAdmin, async (req, res) => {
    try {
      const { clientId, webhookId, environment } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ error: "clientId es requerido" });
      }

      const config = await storage.savePayPalConfig({
        clientId,
        webhookId,
        environment: environment || "sandbox",
        isActive: true,
      });
      
      res.json(config);
    } catch (error: any) {
      console.error("Error saving PayPal config:", error);
      res.status(500).json({ error: error.message || "Error guardando configuración" });
    }
  });

  // Admin: Get PayPal configuration
  app.get("/api/admin/paypal/config", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getPayPalConfig();
      res.json(config || null);
    } catch (error: any) {
      console.error("Error getting PayPal config:", error);
      res.status(500).json({ error: error.message || "Error obteniendo configuración" });
    }
  });

  // ==================== GITHUB SYNC ENDPOINTS ====================

  // Admin: Get GitHub connection status
  app.get("/api/admin/github/status", requireAdmin, async (req, res) => {
    try {
      const status = await getGitHubStatus();
      res.json(status);
    } catch (error: any) {
      console.error("Error getting GitHub status:", error);
      res.status(500).json({ error: error.message || "Error obteniendo estado de GitHub" });
    }
  });

  // Admin: Sync project to GitHub
  app.post("/api/admin/github/sync", requireAdmin, async (req, res) => {
    try {
      const result = await syncToGitHub();
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json({ error: result.message });
      }
    } catch (error: any) {
      console.error("Error syncing to GitHub:", error);
      res.status(500).json({ error: error.message || "Error sincronizando con GitHub" });
    }
  });

  // Admin: Pull latest code from GitHub and restart
  app.post("/api/admin/github/pull", requireAdmin, async (req, res) => {
    try {
      const result = await pullFromGitHub();
      if (result.success) {
        res.json(result);
        setTimeout(() => {
          console.log('[GitHub] Restarting application...');
          process.exit(0);
        }, 1000);
      } else {
        res.status(500).json({ error: result.message });
      }
    } catch (error: any) {
      console.error("Error pulling from GitHub:", error);
      res.status(500).json({ error: error.message || "Error actualizando desde GitHub" });
    }
  });

  // ==================== SALES ANALYTICS ENDPOINTS ====================

  // Admin: Get sales summary
  app.get("/api/admin/sales/summary", requireAdmin, async (req, res) => {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      
      const summary = await storage.getSalesSummary(fromDate, toDate);
      res.json(summary);
    } catch (error: any) {
      console.error("Error getting sales summary:", error);
      res.status(500).json({ error: error.message || "Error obteniendo resumen de ventas" });
    }
  });

  // Admin: Get revenue trend
  app.get("/api/admin/sales/revenue-trend", requireAdmin, async (req, res) => {
    try {
      const { from, to, interval = 'day' } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      const validInterval = ['day', 'week', 'month'].includes(interval as string) ? interval as 'day' | 'week' | 'month' : 'day';
      
      const trend = await storage.getRevenueTrend(fromDate, toDate, validInterval);
      res.json(trend);
    } catch (error: any) {
      console.error("Error getting revenue trend:", error);
      res.status(500).json({ error: error.message || "Error obteniendo tendencia de ingresos" });
    }
  });

  // Admin: Get top selling audiobooks
  app.get("/api/admin/sales/top-audiobooks", requireAdmin, async (req, res) => {
    try {
      const { from, to, limit = '10' } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      const limitNum = Math.min(parseInt(limit as string) || 10, 50);
      
      const topAudiobooks = await storage.getTopAudiobooks(fromDate, toDate, limitNum);
      res.json(topAudiobooks);
    } catch (error: any) {
      console.error("Error getting top audiobooks:", error);
      res.status(500).json({ error: error.message || "Error obteniendo audiolibros mas vendidos" });
    }
  });

  // Admin: Get recent transactions
  app.get("/api/admin/sales/recent-transactions", requireAdmin, async (req, res) => {
    try {
      const { limit = '25' } = req.query;
      const limitNum = Math.min(parseInt(limit as string) || 25, 100);
      
      const transactions = await storage.getRecentTransactions(limitNum);
      res.json(transactions);
    } catch (error: any) {
      console.error("Error getting recent transactions:", error);
      res.status(500).json({ error: error.message || "Error obteniendo transacciones recientes" });
    }
  });

  // Admin: Get all customers with stats
  app.get("/api/admin/customers", requireAdmin, async (req, res) => {
    try {
      const { search, role, hasProfile } = req.query;
      const filters: { search?: string; role?: string; hasProfile?: boolean } = {};
      
      if (search) filters.search = search as string;
      if (role) filters.role = role as string;
      if (hasProfile !== undefined) filters.hasProfile = hasProfile === 'true';
      
      const customers = await storage.getCustomersWithStats(filters);
      res.json(customers);
    } catch (error: any) {
      console.error("Error getting customers:", error);
      res.status(500).json({ error: error.message || "Error obteniendo clientes" });
    }
  });

  // Admin: Get customer detail
  app.get("/api/admin/customers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomerDetail(id);
      
      if (!customer) {
        return res.status(404).json({ error: "Cliente no encontrado" });
      }
      
      res.json(customer);
    } catch (error: any) {
      console.error("Error getting customer detail:", error);
      res.status(500).json({ error: error.message || "Error obteniendo detalle del cliente" });
    }
  });

  // Admin: Get all invoices
  app.get("/api/admin/invoices", requireAdmin, async (req, res) => {
    try {
      const { search, status, from, to } = req.query;
      const filters: { search?: string; status?: string; from?: Date; to?: Date } = {};
      
      if (search) filters.search = search as string;
      if (status) filters.status = status as string;
      if (from) filters.from = new Date(from as string);
      if (to) filters.to = new Date(to as string);
      
      const allInvoices = await storage.getAllInvoicesAdmin(filters);
      res.json(allInvoices);
    } catch (error: any) {
      console.error("Error getting invoices:", error);
      res.status(500).json({ error: error.message || "Error obteniendo facturas" });
    }
  });

  // Admin: Download invoice PDF
  app.get("/api/admin/invoices/:id/download", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      
      if (!invoice.pdfPath) {
        return res.status(404).json({ error: "PDF no disponible" });
      }
      
      const fs = await import("fs");
      const path = await import("path");
      const pdfFullPath = path.resolve(invoice.pdfPath);
      
      if (!fs.existsSync(pdfFullPath)) {
        return res.status(404).json({ error: "Archivo PDF no encontrado" });
      }
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      
      const fileStream = fs.createReadStream(pdfFullPath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error("Error downloading invoice:", error);
      res.status(500).json({ error: error.message || "Error descargando factura" });
    }
  });

  // Admin: Get all purchases with filters
  app.get("/api/admin/purchases", requireAdmin, async (req, res) => {
    try {
      const { search, status, userId } = req.query;
      const filters: { search?: string; status?: string; userId?: string } = {};
      
      if (search) filters.search = search as string;
      if (status) filters.status = status as string;
      if (userId) filters.userId = userId as string;
      
      const purchases = await storage.getPurchasesAdmin(filters);
      res.json(purchases);
    } catch (error: any) {
      console.error("Error getting purchases:", error);
      res.status(500).json({ error: error.message || "Error obteniendo compras" });
    }
  });

  // Admin: Delete pending purchase
  app.delete("/api/admin/purchases/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePendingPurchase(id);
      
      if (!deleted) {
        return res.status(400).json({ error: "Solo se pueden eliminar compras en estado pendiente" });
      }
      
      res.json({ success: true, message: "Compra pendiente eliminada" });
    } catch (error: any) {
      console.error("Error deleting purchase:", error);
      res.status(500).json({ error: error.message || "Error eliminando compra" });
    }
  });

  // Admin: Manual cleanup of old pending purchases
  app.post("/api/admin/cleanup-pending", requireAdmin, async (req, res) => {
    try {
      const result = await storage.deleteOldPendingPurchases(24);
      res.json({ 
        success: true, 
        message: `Limpieza completada: ${result.deletedPurchases} compras pendientes y ${result.deletedCartItems} items de carrito eliminados` 
      });
    } catch (error: any) {
      console.error("Error in cleanup:", error);
      res.status(500).json({ error: error.message || "Error en limpieza" });
    }
  });

  // ============ DISCOUNT CODE ROUTES ============
  
  // Admin: Get all discount codes
  app.get("/api/admin/discount-codes", requireAdmin, async (req, res) => {
    try {
      const codes = await storage.getAllDiscountCodes();
      res.json(codes);
    } catch (error: any) {
      console.error("Error fetching discount codes:", error);
      res.status(500).json({ error: error.message || "Error fetching discount codes" });
    }
  });

  // Admin: Create discount code
  app.post("/api/admin/discount-codes", requireAdmin, async (req, res) => {
    try {
      const { code, description, type, value, minPurchaseCents, maxUsesTotal, maxUsesPerUser, validFrom, validUntil, isActive, appliesToSubscriptions, appliesToPurchases } = req.body;
      
      if (!code || !type || value === undefined) {
        return res.status(400).json({ error: "Codigo, tipo y valor son requeridos" });
      }
      
      const discountCode = await storage.createDiscountCode({
        code: code.toUpperCase().trim(),
        description,
        type,
        value,
        minPurchaseCents: minPurchaseCents || 0,
        maxUsesTotal,
        maxUsesPerUser: maxUsesPerUser || 1,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: isActive !== false,
        appliesToSubscriptions: appliesToSubscriptions || false,
        appliesToPurchases: appliesToPurchases !== false,
      });
      
      res.json(discountCode);
    } catch (error: any) {
      console.error("Error creating discount code:", error);
      if (error.message?.includes("unique")) {
        return res.status(400).json({ error: "Ya existe un codigo con ese nombre" });
      }
      res.status(500).json({ error: error.message || "Error creating discount code" });
    }
  });

  // Admin: Update discount code
  app.patch("/api/admin/discount-codes/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.code) {
        updates.code = updates.code.toUpperCase().trim();
      }
      if (updates.validFrom) {
        updates.validFrom = new Date(updates.validFrom);
      }
      if (updates.validUntil) {
        updates.validUntil = new Date(updates.validUntil);
      }
      
      const updated = await storage.updateDiscountCode(id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating discount code:", error);
      res.status(500).json({ error: error.message || "Error updating discount code" });
    }
  });

  // Admin: Delete discount code
  app.delete("/api/admin/discount-codes/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDiscountCode(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting discount code:", error);
      res.status(500).json({ error: error.message || "Error deleting discount code" });
    }
  });

  // User: Validate discount code
  app.post("/api/discount-codes/validate", requireAuth, async (req, res) => {
    try {
      const { code, totalCents, forSubscription } = req.body;
      const userId = req.session.userId!;
      
      if (!code) {
        return res.status(400).json({ valid: false, error: "Codigo requerido" });
      }
      
      const result = await storage.validateDiscountCode(
        code, 
        userId, 
        totalCents || 0, 
        forSubscription || false
      );
      
      if (!result.valid) {
        return res.json({ valid: false, error: result.error });
      }
      
      // Calculate discount amount
      const discountCode = result.discountCode!;
      let discountAmountCents = 0;
      
      if (discountCode.type === "PERCENTAGE") {
        discountAmountCents = Math.round((totalCents * discountCode.value) / 100);
      } else {
        discountAmountCents = Math.min(discountCode.value, totalCents);
      }
      
      res.json({
        valid: true,
        discountCode: {
          id: discountCode.id,
          code: discountCode.code,
          type: discountCode.type,
          value: discountCode.value,
          description: discountCode.description,
        },
        discountAmountCents,
        finalAmountCents: Math.max(0, totalCents - discountAmountCents),
      });
    } catch (error: any) {
      console.error("Error validating discount code:", error);
      res.status(500).json({ valid: false, error: "Error validando codigo" });
    }
  });

  // Admin: Download customers report in Excel
  app.get("/api/admin/reports/customers", requireAdmin, async (req, res) => {
    try {
      const ExcelJSModule = await import("exceljs");
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const customers = await storage.getCustomersWithStats();
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Clientes");
      
      worksheet.columns = [
        { header: "ID", key: "id", width: 36 },
        { header: "Usuario", key: "username", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Rol", key: "role", width: 12 },
        { header: "Nombre Legal", key: "legalName", width: 25 },
        { header: "Empresa", key: "companyName", width: 25 },
        { header: "NIF/CIF", key: "taxId", width: 15 },
        { header: "Telefono", key: "phone", width: 15 },
        { header: "Direccion", key: "address", width: 40 },
        { header: "Ciudad", key: "city", width: 20 },
        { header: "CP", key: "postalCode", width: 10 },
        { header: "Pais", key: "country", width: 15 },
        { header: "Total Compras", key: "totalPurchases", width: 15 },
        { header: "Total Gastado", key: "totalSpent", width: 15 },
        { header: "Ultima Compra", key: "lastPurchase", width: 20 },
        { header: "Fecha Registro", key: "createdAt", width: 20 },
      ];
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      
      customers.forEach((c) => {
        worksheet.addRow({
          id: c.user.id,
          username: c.user.username,
          email: c.user.email,
          role: c.user.role,
          legalName: c.billingProfile?.legalName || "",
          companyName: c.billingProfile?.companyName || "",
          taxId: c.billingProfile?.taxId || "",
          phone: c.billingProfile?.phone || "",
          address: c.billingProfile?.addressLine1 || "",
          city: c.billingProfile?.city || "",
          postalCode: c.billingProfile?.postalCode || "",
          country: c.billingProfile?.country || "",
          totalPurchases: c.totalPurchases,
          totalSpent: c.totalSpentCents / 100,
          lastPurchase: c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleDateString("es-ES") : "",
          createdAt: c.user.createdAt ? new Date(c.user.createdAt).toLocaleDateString("es-ES") : "",
        });
      });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=clientes_${new Date().toISOString().split("T")[0]}.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("Error generating customers report:", error);
      res.status(500).json({ error: error.message || "Error generando informe" });
    }
  });

  // Admin: Download purchases report in Excel
  app.get("/api/admin/reports/purchases", requireAdmin, async (req, res) => {
    try {
      const ExcelJSModule = await import("exceljs");
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const { status, userId } = req.query;
      const filters: { status?: string; userId?: string } = {};
      if (status) filters.status = status as string;
      if (userId) filters.userId = userId as string;
      
      const purchases = await storage.getPurchasesAdmin(filters);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Compras");
      
      worksheet.columns = [
        { header: "ID", key: "id", width: 36 },
        { header: "Cliente", key: "username", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Audiolibro", key: "audiobook", width: 35 },
        { header: "Autor", key: "author", width: 25 },
        { header: "Precio", key: "price", width: 12 },
        { header: "Moneda", key: "currency", width: 10 },
        { header: "Estado", key: "status", width: 15 },
        { header: "PayPal Order ID", key: "paypalOrderId", width: 25 },
        { header: "Fecha Creacion", key: "createdAt", width: 20 },
        { header: "Fecha Compra", key: "purchasedAt", width: 20 },
      ];
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      
      purchases.forEach((p) => {
        worksheet.addRow({
          id: p.id,
          username: p.user.username,
          email: p.user.email,
          audiobook: p.audiobook.title,
          author: p.audiobook.author,
          price: p.pricePaidCents / 100,
          currency: p.currency,
          status: p.status,
          paypalOrderId: p.paypalOrderId || "",
          createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-ES") : "",
          purchasedAt: p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString("es-ES") : "",
        });
      });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=compras_${new Date().toISOString().split("T")[0]}.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("Error generating purchases report:", error);
      res.status(500).json({ error: error.message || "Error generando informe" });
    }
  });

  // Admin: Download invoices report in Excel
  app.get("/api/admin/reports/invoices", requireAdmin, async (req, res) => {
    try {
      const ExcelJSModule = await import("exceljs");
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const { status } = req.query;
      const filters: { status?: string } = {};
      if (status) filters.status = status as string;
      
      const invoicesData = await storage.getAllInvoicesAdmin(filters);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Facturas");
      
      worksheet.columns = [
        { header: "Numero Factura", key: "invoiceNumber", width: 20 },
        { header: "Cliente", key: "username", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Subtotal", key: "subtotal", width: 12 },
        { header: "IVA", key: "tax", width: 12 },
        { header: "Total", key: "total", width: 12 },
        { header: "Moneda", key: "currency", width: 10 },
        { header: "Estado", key: "status", width: 15 },
        { header: "Metodo Pago", key: "paymentMethod", width: 15 },
        { header: "Fecha Emision", key: "issueDate", width: 20 },
        { header: "PDF", key: "hasPdf", width: 10 },
      ];
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      
      invoicesData.forEach((inv) => {
        worksheet.addRow({
          invoiceNumber: inv.invoiceNumber,
          username: inv.user.username,
          email: inv.user.email,
          subtotal: inv.subtotalCents / 100,
          tax: inv.taxCents / 100,
          total: inv.totalCents / 100,
          currency: inv.currency,
          status: inv.status,
          paymentMethod: inv.paymentMethod,
          issueDate: inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("es-ES") : "",
          hasPdf: inv.pdfPath ? "Si" : "No",
        });
      });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=facturas_${new Date().toISOString().split("T")[0]}.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("Error generating invoices report:", error);
      res.status(500).json({ error: error.message || "Error generando informe" });
    }
  });

  // ==================== SETUP / INSTALLATION ENDPOINTS ====================

  // Check if system is installed (has admin user)
  app.get("/api/setup/status", async (req, res) => {
    try {
      const adminExists = await storage.checkAdminExists();
      res.json({ 
        installed: adminExists,
        databaseConnected: true
      });
    } catch (error: any) {
      res.json({ 
        installed: false, 
        databaseConnected: false,
        error: error.message 
      });
    }
  });

  // Create initial admin user (only works if no admin exists)
  app.post("/api/setup/create-admin", async (req, res) => {
    try {
      // Check if admin already exists
      const adminExists = await storage.checkAdminExists();
      if (adminExists) {
        return res.status(400).json({ error: "El sistema ya está configurado. Ya existe un administrador." });
      }

      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Todos los campos son requeridos" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
      }

      // Check if email is already in use
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Este email ya está en uso" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const admin = await storage.createUser({
        username,
        email,
        passwordHash,
        role: "ADMIN",
        bio: "Administrador del sistema",
        emailVerified: true,
      });

      res.json({ 
        success: true, 
        message: "Administrador creado exitosamente",
        admin: { id: admin.id, email: admin.email, username: admin.username }
      });
    } catch (error: any) {
      console.error("Error creating admin:", error);
      res.status(500).json({ error: error.message || "Error al crear el administrador" });
    }
  });

  // Register Multer error handler (must be after all routes)
  app.use(handleMulterError);

  const httpServer = createServer(app);
  return httpServer;
}
