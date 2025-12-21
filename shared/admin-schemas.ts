import { z } from "zod";

// User management schemas
export const updateUserRoleSchema = z.object({
  role: z.enum(["LISTENER", "CREATOR", "ADMIN"]),
});

export const updateUserApprovalSchema = z.object({
  requiresApproval: z.boolean(),
});

export const updateUserActiveSchema = z.object({
  isActive: z.boolean(),
});

// Content moderation schemas
export const updateAudiobookStatusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]),
});

export const updateChapterStatusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]),
});

// Query parameter schemas for filtering
export const adminAudiobooksQuerySchema = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]).optional(),
  publisherId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const adminChaptersQuerySchema = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]).optional(),
  audiobookId: z.string().uuid().optional(),
  publisherId: z.string().uuid().optional(),
  search: z.string().optional(),
});

// Email configuration schemas
export const createEmailConfigSchema = z.object({
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().min(1, "SMTP user is required"),
  smtpPassword: z.string().min(1, "SMTP password is required"),
  fromEmail: z.string().email("Invalid email address"),
  fromName: z.string().min(1).default("Audivia"),
  isActive: z.boolean().default(false),
});

export const updateEmailConfigSchema = z.object({
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// Google Drive configuration schemas
const validateServiceAccountKey = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed.type || parsed.type !== 'service_account') {
      return false;
    }
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const createDriveConfigSchema = z.object({
  serviceAccountEmail: z.string().email("Invalid service account email"),
  serviceAccountKey: z.string()
    .min(1, "Service account key is required")
    .refine(validateServiceAccountKey, "Invalid service account key JSON"),
  folderIdImages: z.string().min(1, "Images folder ID is required"),
  folderIdAudio: z.string().min(1, "Audio folder ID is required"),
  isActive: z.boolean().default(false),
});

export const updateDriveConfigSchema = z.object({
  serviceAccountEmail: z.string().email().optional(),
  serviceAccountKey: z.string()
    .min(1)
    .refine(validateServiceAccountKey, "Invalid service account key JSON")
    .optional(),
  folderIdImages: z.string().min(1).optional(),
  folderIdAudio: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const testDriveConfigSchema = z.object({
  serviceAccountEmail: z.string().email("Invalid service account email"),
  serviceAccountKey: z.string()
    .min(1, "Service account key is required")
    .refine(validateServiceAccountKey, "Invalid service account key JSON"),
  folderIdImages: z.string().min(1, "Images folder ID is required"),
  folderIdAudio: z.string().min(1, "Audio folder ID is required"),
});

// Subscription plan schemas
export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  priceCents: z.number().int().min(0),
  currency: z.string().default("EUR"),
  intervalMonths: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

export const updateSubscriptionPlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  intervalMonths: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

// TypeScript types
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserApproval = z.infer<typeof updateUserApprovalSchema>;
export type UpdateUserActive = z.infer<typeof updateUserActiveSchema>;
export type UpdateAudiobookStatus = z.infer<typeof updateAudiobookStatusSchema>;
export type UpdateChapterStatus = z.infer<typeof updateChapterStatusSchema>;
export type AdminAudiobooksQuery = z.infer<typeof adminAudiobooksQuerySchema>;
export type AdminChaptersQuery = z.infer<typeof adminChaptersQuerySchema>;
export type CreateEmailConfig = z.infer<typeof createEmailConfigSchema>;
export type UpdateEmailConfig = z.infer<typeof updateEmailConfigSchema>;
export type CreateDriveConfig = z.infer<typeof createDriveConfigSchema>;
export type UpdateDriveConfig = z.infer<typeof updateDriveConfigSchema>;
export type TestDriveConfig = z.infer<typeof testDriveConfigSchema>;
export type CreateSubscriptionPlan = z.infer<typeof createSubscriptionPlanSchema>;
export type UpdateSubscriptionPlan = z.infer<typeof updateSubscriptionPlanSchema>;

// Bulk operations schemas
export const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one ID is required").max(50, "Maximum 50 items per operation"),
});

export const bulkDeleteUsersSchema = bulkIdsSchema;

export const bulkUpdateUsersRoleSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  role: z.enum(["LISTENER", "CREATOR", "ADMIN"]),
});

export const bulkUpdateUsersActiveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  isActive: z.boolean(),
});

export const bulkDeleteAudiobooksSchema = bulkIdsSchema;

export const bulkUpdateAudiobooksStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]),
});

export const bulkDeleteChaptersSchema = bulkIdsSchema;

export const bulkUpdateChaptersStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]),
});

// Legacy aliases for backward compatibility
export const updatePodcastStatusSchema = updateAudiobookStatusSchema;
export const updateEpisodeStatusSchema = updateChapterStatusSchema;
export const adminPodcastsQuerySchema = adminAudiobooksQuerySchema;
export const adminEpisodesQuerySchema = adminChaptersQuerySchema;
export const bulkDeletePodcastsSchema = bulkDeleteAudiobooksSchema;
export const bulkUpdatePodcastsStatusSchema = bulkUpdateAudiobooksStatusSchema;
export const bulkDeleteEpisodesSchema = bulkDeleteChaptersSchema;
export const bulkUpdateEpisodesStatusSchema = bulkUpdateChaptersStatusSchema;

// Bulk operation types
export type BulkIds = z.infer<typeof bulkIdsSchema>;
export type BulkDeleteUsers = z.infer<typeof bulkDeleteUsersSchema>;
export type BulkUpdateUsersRole = z.infer<typeof bulkUpdateUsersRoleSchema>;
export type BulkUpdateUsersActive = z.infer<typeof bulkUpdateUsersActiveSchema>;
export type BulkDeleteAudiobooks = z.infer<typeof bulkDeleteAudiobooksSchema>;
export type BulkUpdateAudiobooksStatus = z.infer<typeof bulkUpdateAudiobooksStatusSchema>;
export type BulkDeleteChapters = z.infer<typeof bulkDeleteChaptersSchema>;
export type BulkUpdateChaptersStatus = z.infer<typeof bulkUpdateChaptersStatusSchema>;

// Legacy type aliases
export type BulkDeletePodcasts = BulkDeleteAudiobooks;
export type BulkUpdatePodcastsStatus = BulkUpdateAudiobooksStatus;
export type BulkDeleteEpisodes = BulkDeleteChapters;
export type BulkUpdateEpisodesStatus = BulkUpdateChaptersStatus;
