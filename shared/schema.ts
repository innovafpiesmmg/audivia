import { sql } from "drizzle-orm";
import { pgTable, text, varchar, pgEnum, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User role enum: LISTENER, PUBLISHER, or ADMIN
export const userRoleEnum = pgEnum("user_role", ["LISTENER", "CREATOR", "ADMIN"]);

// Content status enum for moderation workflow
export const contentStatusEnum = pgEnum("content_status", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]);

// Media asset type enum
export const mediaAssetTypeEnum = pgEnum("media_asset_type", ["COVER_ART", "CHAPTER_AUDIO", "SAMPLE_AUDIO"]);

// Storage provider enum
export const storageProviderEnum = pgEnum("storage_provider", ["LOCAL", "GOOGLE_DRIVE"]);

// Visibility enum for audiobooks and chapters
export const visibilityEnum = pgEnum("visibility", ["PRIVATE", "UNLISTED", "PUBLIC"]);

// Subscription status enum
export const subscriptionStatusEnum = pgEnum("subscription_status", ["ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"]);

// Purchase status enum
export const purchaseStatusEnum = pgEnum("purchase_status", ["PENDING", "COMPLETED", "REFUNDED", "FAILED"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("LISTENER"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  website: text("website"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationTokenExpiresAt: timestamp("email_verification_token_expires_at"),
  stripeCustomerId: text("stripe_customer_id"),
  paypalPayerId: text("paypal_payer_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Subscription Plans table - admin-defined subscription tiers
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  intervalMonths: integer("interval_months").notNull().default(1),
  trialDays: integer("trial_days").notNull().default(0),
  stripePriceId: text("stripe_price_id"),
  stripeProductId: text("stripe_product_id"),
  paypalPlanId: text("paypal_plan_id"),
  paypalProductId: text("paypal_product_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User Subscriptions table - tracks user subscription status
export const userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => subscriptionPlans.id),
  status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Audiobooks table (formerly podcasts)
export const audiobooks = pgTable("audiobooks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author").notNull(),
  narrator: text("narrator"),
  description: text("description").notNull(),
  coverArtUrl: text("cover_art_url"),
  coverArtAssetId: varchar("cover_art_asset_id", { length: 36 }),
  category: text("category").notNull().default("Fiction"),
  language: text("language").notNull().default("es"),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("EUR"),
  isFree: boolean("is_free").notNull().default(false),
  sampleChapterId: varchar("sample_chapter_id", { length: 36 }),
  totalDuration: integer("total_duration").notNull().default(0),
  status: contentStatusEnum("status").notNull().default("APPROVED"),
  visibility: visibilityEnum("visibility").notNull().default("PUBLIC"),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  amazonEbookUrl: text("amazon_ebook_url"),
  amazonPrintUrl: text("amazon_print_url"),
  seriesName: text("series_name"),
  seriesIndex: integer("series_index"),
  publisherId: varchar("publisher_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id),
});

// Chapters table (formerly episodes)
export const chapters = pgTable("chapters", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  chapterNumber: integer("chapter_number").notNull().default(1),
  description: text("description"),
  coverArtUrl: text("cover_art_url"),
  coverArtAssetId: varchar("cover_art_asset_id", { length: 36 }),
  audioUrl: text("audio_url"),
  audioAssetId: varchar("audio_asset_id", { length: 36 }),
  audioFileSize: integer("audio_file_size"),
  duration: integer("duration").notNull().default(0),
  isSample: boolean("is_sample").notNull().default(false),
  status: contentStatusEnum("status").notNull().default("APPROVED"),
  visibility: visibilityEnum("visibility").notNull().default("PUBLIC"),
  audiobookId: varchar("audiobook_id", { length: 36 }).notNull().references(() => audiobooks.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id),
});

// Audiobook Purchases table - individual audiobook purchases
export const audiobookPurchases = pgTable("audiobook_purchases", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  audiobookId: varchar("audiobook_id", { length: 36 }).notNull().references(() => audiobooks.id),
  pricePaidCents: integer("price_paid_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: purchaseStatusEnum("status").notNull().default("PENDING"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSessionId: text("stripe_session_id"),
  paypalOrderId: text("paypal_order_id"),
  paypalCaptureId: text("paypal_capture_id"),
  paypalPayerEmail: text("paypal_payer_email"),
  purchasedAt: timestamp("purchased_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Favorites table - users can favorite audiobooks
export const favorites = pgTable("favorites", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  audiobookId: varchar("audiobook_id", { length: 36 }).notNull().references(() => audiobooks.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userAudiobookUnique: {
    columns: [table.userId, table.audiobookId],
    name: "favorites_user_audiobook_unique"
  }
}));

// Listening Progress table - tracks user progress in audiobooks
export const listeningProgress = pgTable("listening_progress", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  audiobookId: varchar("audiobook_id", { length: 36 }).notNull().references(() => audiobooks.id),
  chapterId: varchar("chapter_id", { length: 36 }).notNull().references(() => chapters.id),
  positionSeconds: integer("position_seconds").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Playlists table - user-created playlists
export const playlists = pgTable("playlists", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Playlist Chapters table - many-to-many relationship between playlists and chapters
export const playlistChapters = pgTable("playlist_chapters", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  playlistId: varchar("playlist_id", { length: 36 }).notNull().references(() => playlists.id, { onDelete: "cascade" }),
  chapterId: varchar("chapter_id", { length: 36 }).notNull().references(() => chapters.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => ({
  playlistChapterUnique: {
    columns: [table.playlistId, table.chapterId],
    name: "playlist_chapters_playlist_chapter_unique"
  }
}));

// Email configuration table - admin configures SMTP settings
export const emailConfig = pgTable("email_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  smtpUser: text("smtp_user").notNull(),
  smtpPassword: text("smtp_password").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull().default("Audivia"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Google Drive configuration table - admin configures Google Drive integration
export const driveConfig = pgTable("drive_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  serviceAccountEmail: text("service_account_email").notNull(),
  serviceAccountKey: text("service_account_key").notNull(),
  folderIdImages: text("folder_id_images").notNull(),
  folderIdAudio: text("folder_id_audio").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Media assets table - stores all uploaded files
export const mediaAssets = pgTable("media_assets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id", { length: 36 }).notNull().references(() => users.id),
  audiobookId: varchar("audiobook_id", { length: 36 }).references(() => audiobooks.id),
  chapterId: varchar("chapter_id", { length: 36 }).references(() => chapters.id),
  type: mediaAssetTypeEnum("type").notNull(),
  storageProvider: storageProviderEnum("storage_provider").notNull().default("LOCAL"),
  storageKey: text("storage_key").notNull(),
  publicUrl: text("public_url"),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum"),
  visibility: text("visibility").notNull().default("public"),
  status: contentStatusEnum("status").notNull().default("APPROVED"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sessions table for express-session with connect-pg-simple
export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Stripe configuration table
export const stripeConfig = pgTable("stripe_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  publishableKey: text("publishable_key"),
  webhookSecret: text("webhook_secret"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// PayPal configuration table
export const paypalConfig = pgTable("paypal_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientId: text("client_id").notNull(),
  webhookId: text("webhook_id"),
  environment: text("environment").notNull().default("sandbox"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Invoice type enum
export const invoiceTypeEnum = pgEnum("invoice_type", ["PURCHASE", "SUBSCRIPTION"]);

// Invoice status enum
export const invoiceStatusEnum = pgEnum("invoice_status", ["DRAFT", "ISSUED", "PAID", "CANCELLED"]);

// Billing profiles table - stores user billing information
export const billingProfiles = pgTable("billing_profiles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id).unique(),
  legalName: text("legal_name").notNull(),
  companyName: text("company_name"),
  taxId: text("tax_id"),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  city: text("city").notNull(),
  state: text("state"),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Invoices table - stores all issued invoices
export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  purchaseId: varchar("purchase_id", { length: 36 }).references(() => audiobookPurchases.id),
  subscriptionId: varchar("subscription_id", { length: 36 }).references(() => userSubscriptions.id),
  type: invoiceTypeEnum("type").notNull(),
  status: invoiceStatusEnum("status").notNull().default("ISSUED"),
  issueDate: timestamp("issue_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull().defaultNow(),
  subtotalCents: integer("subtotal_cents").notNull(),
  taxCents: integer("tax_cents").notNull().default(0),
  taxRate: integer("tax_rate").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  billingSnapshot: text("billing_snapshot"),
  sellerInfo: text("seller_info"),
  paymentMethod: text("payment_method").notNull().default("paypal"),
  pdfPath: text("pdf_path"),
  pdfStatus: text("pdf_status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invoice line items table
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id", { length: 36 }).notNull().references(() => invoices.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(),
  taxRate: integer("tax_rate").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Discount codes table
export const discountCodeTypeEnum = pgEnum("discount_code_type", ["PERCENTAGE", "FIXED_AMOUNT"]);

export const discountCodes = pgTable("discount_codes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  description: text("description"),
  type: discountCodeTypeEnum("type").notNull(),
  value: integer("value").notNull(),
  minPurchaseCents: integer("min_purchase_cents").default(0),
  maxUsesTotal: integer("max_uses_total"),
  maxUsesPerUser: integer("max_uses_per_user").default(1),
  usedCount: integer("used_count").notNull().default(0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").notNull().default(true),
  appliesToSubscriptions: boolean("applies_to_subscriptions").notNull().default(false),
  appliesToPurchases: boolean("applies_to_purchases").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Track discount code usage per user
export const discountCodeUsage = pgTable("discount_code_usage", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  discountCodeId: varchar("discount_code_id", { length: 36 }).notNull().references(() => discountCodes.id),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  purchaseId: varchar("purchase_id", { length: 36 }).references(() => audiobookPurchases.id),
  discountAmountCents: integer("discount_amount_cents").notNull(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
});

// External services table - quick links to external services for admin
export const externalServices = pgTable("external_services", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  iconName: text("icon_name").default("ExternalLink"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertExternalServiceSchema = createInsertSchema(externalServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExternalService = z.infer<typeof insertExternalServiceSchema>;
export type ExternalService = typeof externalServices.$inferSelect;

// RSS Feed tokens table - allows users to subscribe to their library via podcast apps
export const rssFeedTokens = pgTable("rss_feed_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id).unique(),
  token: text("token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Shopping cart items table - stores items in user's shopping cart
export const cartItems = pgTable("cart_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  audiobookId: varchar("audiobook_id", { length: 36 }).notNull().references(() => audiobooks.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userAudiobookUnique: {
    columns: [table.userId, table.audiobookId],
    name: "cart_items_user_audiobook_unique"
  }
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  audiobooks: many(audiobooks),
  purchases: many(audiobookPurchases),
  subscriptions: many(userSubscriptions),
  favorites: many(favorites),
  listeningProgress: many(listeningProgress),
}));

export const audiobooksRelations = relations(audiobooks, ({ one, many }) => ({
  publisher: one(users, {
    fields: [audiobooks.publisherId],
    references: [users.id],
  }),
  chapters: many(chapters),
  purchases: many(audiobookPurchases),
  favorites: many(favorites),
}));

export const chaptersRelations = relations(chapters, ({ one }) => ({
  audiobook: one(audiobooks, {
    fields: [chapters.audiobookId],
    references: [audiobooks.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  audiobook: one(audiobooks, {
    fields: [favorites.audiobookId],
    references: [audiobooks.id],
  }),
}));

export const audiobookPurchasesRelations = relations(audiobookPurchases, ({ one }) => ({
  user: one(users, {
    fields: [audiobookPurchases.userId],
    references: [users.id],
  }),
  audiobook: one(audiobooks, {
    fields: [audiobookPurchases.audiobookId],
    references: [audiobooks.id],
  }),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const listeningProgressRelations = relations(listeningProgress, ({ one }) => ({
  user: one(users, {
    fields: [listeningProgress.userId],
    references: [users.id],
  }),
  audiobook: one(audiobooks, {
    fields: [listeningProgress.audiobookId],
    references: [audiobooks.id],
  }),
  chapter: one(chapters, {
    fields: [listeningProgress.chapterId],
    references: [chapters.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  owner: one(users, {
    fields: [mediaAssets.ownerId],
    references: [users.id],
  }),
  audiobook: one(audiobooks, {
    fields: [mediaAssets.audiobookId],
    references: [audiobooks.id],
  }),
  chapter: one(chapters, {
    fields: [mediaAssets.chapterId],
    references: [chapters.id],
  }),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, {
    fields: [playlists.userId],
    references: [users.id],
  }),
  playlistChapters: many(playlistChapters),
}));

export const playlistChaptersRelations = relations(playlistChapters, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistChapters.playlistId],
    references: [playlists.id],
  }),
  chapter: one(chapters, {
    fields: [playlistChapters.chapterId],
    references: [chapters.id],
  }),
}));

// Zod schemas for inserts
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, passwordHash: true })
  .extend({
    password: z.string().min(8, "Password must be at least 8 characters"),
    bio: z.string().optional(),
    avatarUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    website: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  });

export const insertAudiobookSchema = createInsertSchema(audiobooks)
  .omit({ id: true, createdAt: true, coverArtUrl: true, publisherId: true, status: true, approvedAt: true, approvedBy: true, stripeProductId: true, stripePriceId: true, totalDuration: true, publishedAt: true, sampleChapterId: true, coverArtAssetId: true })
  .extend({
    coverArtUrl: z.union([z.string().url(), z.string().startsWith("/"), z.literal(""), z.null()]).optional(),
    narrator: z.string().optional().nullable(),
    category: z.string().min(1).default("Fiction"),
    language: z.string().min(2).default("es"),
    priceCents: z.number().int().min(0).default(0),
    currency: z.string().default("EUR"),
    isFree: z.boolean().default(false),
    visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).default("PUBLIC"),
    totalDuration: z.number().int().min(0).default(0),
    seriesName: z.string().optional().nullable(),
    seriesIndex: z.number().int().min(1).optional().nullable(),
  });

export const insertChapterSchema = createInsertSchema(chapters)
  .omit({ id: true, audioFileSize: true, coverArtUrl: true, coverArtAssetId: true, audioUrl: true, audioAssetId: true, status: true, approvedAt: true, approvedBy: true, createdAt: true })
  .extend({
    title: z.string().min(1, "Title is required"),
    chapterNumber: z.number().int().min(1).default(1),
    description: z.string().optional().nullable(),
    duration: z.number().int().min(0).default(0),
    coverArtUrl: z.union([z.string().url(), z.string().startsWith("/"), z.literal(""), z.null()]).optional(),
    coverArtAssetId: z.string().uuid().optional().nullable(),
    audioUrl: z.union([z.string().url(), z.string().startsWith("/"), z.literal(""), z.null()]).optional(),
    audioAssetId: z.string().uuid().optional().nullable(),
    audioFileSize: z.number().int().positive().optional(),
    isSample: z.boolean().default(false),
    visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).default("PUBLIC"),
  });

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens)
  .omit({ id: true, createdAt: true, usedAt: true });

export const insertEmailConfigSchema = createInsertSchema(emailConfig)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    smtpHost: z.string().min(1, "SMTP host is required"),
    smtpPort: z.number().int().min(1).max(65535).default(587),
    smtpUser: z.string().min(1, "SMTP user is required"),
    smtpPassword: z.string().min(1, "SMTP password is required"),
    fromEmail: z.string().email("Invalid email address"),
    fromName: z.string().min(1).default("Audivia"),
  });

export const insertDriveConfigSchema = createInsertSchema(driveConfig)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    serviceAccountEmail: z.string().email("Invalid email address"),
    serviceAccountKey: z.string().min(1, "Service account key is required"),
    folderIdImages: z.string().min(1, "Images folder ID is required"),
    folderIdAudio: z.string().min(1, "Audio folder ID is required"),
  });

export const insertMediaAssetSchema = createInsertSchema(mediaAssets)
  .omit({ id: true, createdAt: true, publicUrl: true });

export const insertPlaylistSchema = createInsertSchema(playlists)
  .omit({ id: true, createdAt: true, updatedAt: true, userId: true })
  .extend({
    name: z.string().min(1, "Playlist name is required").max(200, "Playlist name is too long"),
    description: z.string().max(1000, "Description is too long").optional(),
    isPublic: z.boolean().default(false),
  });

export const insertPlaylistChapterSchema = createInsertSchema(playlistChapters)
  .omit({ id: true, addedAt: true })
  .extend({
    playlistId: z.string().uuid("Invalid playlist ID"),
    chapterId: z.string().uuid("Invalid chapter ID"),
    position: z.number().int().min(0).default(0),
  });

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans)
  .omit({ id: true, createdAt: true, stripeProductId: true, stripePriceId: true })
  .extend({
    name: z.string().min(1, "Plan name is required"),
    description: z.string().optional().nullable(),
    priceCents: z.number().int().min(0),
    currency: z.string().default("EUR"),
    intervalMonths: z.number().int().min(1).default(1),
    isActive: z.boolean().default(true),
  });

export const insertAudiobookPurchaseSchema = createInsertSchema(audiobookPurchases)
  .omit({ id: true, createdAt: true, purchasedAt: true });

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = insertUserSchema;

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Audiobook = typeof audiobooks.$inferSelect;
export type InsertAudiobook = z.infer<typeof insertAudiobookSchema>;
export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type EmailConfig = typeof emailConfig.$inferSelect;
export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;
export type DriveConfig = typeof driveConfig.$inferSelect;
export type InsertDriveConfig = z.infer<typeof insertDriveConfigSchema>;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type PlaylistChapter = typeof playlistChapters.$inferSelect;
export type InsertPlaylistChapter = z.infer<typeof insertPlaylistChapterSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type AudiobookPurchase = typeof audiobookPurchases.$inferSelect;
export type InsertAudiobookPurchase = z.infer<typeof insertAudiobookPurchaseSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type ListeningProgress = typeof listeningProgress.$inferSelect;
export type StripeConfig = typeof stripeConfig.$inferSelect;
export type PaypalConfig = typeof paypalConfig.$inferSelect;

// Billing profile types
export const insertBillingProfileSchema = createInsertSchema(billingProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBillingProfile = z.infer<typeof insertBillingProfileSchema>;
export type BillingProfile = typeof billingProfiles.$inferSelect;

// Invoice types
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Invoice line item types
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({ id: true, createdAt: true });
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

// Discount code types
export const insertDiscountCodeSchema = createInsertSchema(discountCodes).omit({ id: true, createdAt: true, updatedAt: true, usedCount: true });
export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodes.$inferSelect;

// Discount code usage types
export const insertDiscountCodeUsageSchema = createInsertSchema(discountCodeUsage).omit({ id: true, usedAt: true });
export type InsertDiscountCodeUsage = z.infer<typeof insertDiscountCodeUsageSchema>;
export type DiscountCodeUsage = typeof discountCodeUsage.$inferSelect;

// RSS Feed token types
export const insertRssFeedTokenSchema = createInsertSchema(rssFeedTokens).omit({ id: true, createdAt: true, lastAccessedAt: true });
export type InsertRssFeedToken = z.infer<typeof insertRssFeedTokenSchema>;
export type RssFeedToken = typeof rssFeedTokens.$inferSelect;

// Cart item types
export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true, createdAt: true });
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;
export type CartItemWithAudiobook = CartItem & { audiobook: Audiobook };

// Extended types for API responses
export type AudiobookWithChapters = Audiobook & { chapters: Chapter[] };
export type AudiobookWithPublisher = Audiobook & { publisher: User };
export type ChapterWithAudiobook = Chapter & { audiobook: Audiobook };
export type AudiobookWithAccess = Audiobook & { 
  hasAccess: boolean; 
  isPurchased: boolean;
  isSubscriber: boolean;
  isFavorite: boolean;
};

export type AudiobookWithChaptersAndAccess = Audiobook & {
  chapters: Chapter[];
  hasAccess: boolean;
  isPurchased: boolean;
  isSubscriber: boolean;
  isFavorite: boolean;
};

// Legacy type aliases for backward compatibility during migration
export type Podcast = Audiobook;
export type Episode = Chapter;
export type InsertPodcast = InsertAudiobook;
export type InsertEpisode = InsertChapter;
export type PodcastWithEpisodes = AudiobookWithChapters;
export type EpisodeWithPodcast = ChapterWithAudiobook;
export type PodcastWithSubscription = Audiobook & { isSubscribed?: boolean };
export type EpisodeWithUrls = Chapter;
export type EpisodeWithPodcastAndUrls = ChapterWithAudiobook;
export type PodcastWithEpisodesAndUrls = AudiobookWithChapters;
export type ContentInvitation = { id: string; email: string; contentType: string; contentId: string; status: string };

// Legacy schema aliases
export const insertPodcastSchema = insertAudiobookSchema;
export const insertEpisodeSchema = insertChapterSchema;

// YouTube import schema
export const youtubeImportSchema = z.object({
  playlistUrl: z.string().url("Invalid YouTube playlist URL"),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().default("General"),
});

// Local import schema
export const localImportSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().default("General"),
  files: z.array(z.object({
    filename: z.string(),
    path: z.string(),
  })).optional(),
});
