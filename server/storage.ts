import { 
  users, 
  audiobooks, 
  chapters,
  favorites,
  audiobookPurchases,
  userSubscriptions,
  subscriptionPlans,
  listeningProgress,
  emailConfig,
  passwordResetTokens,
  driveConfig,
  mediaAssets,
  playlists,
  playlistChapters,
  stripeConfig,
  paypalConfig,
  billingProfiles,
  invoices,
  invoiceLineItems,
  rssFeedTokens,
  cartItems,
  discountCodes,
  discountCodeUsage,
  type User, 
  type InsertUser,
  type Audiobook,
  type InsertAudiobook,
  type Chapter,
  type InsertChapter,
  type AudiobookWithChapters,
  type ChapterWithAudiobook,
  type Favorite,
  type AudiobookPurchase,
  type UserSubscription,
  type SubscriptionPlan,
  type ListeningProgress,
  type EmailConfig,
  type InsertEmailConfig,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type DriveConfig,
  type InsertDriveConfig,
  type MediaAsset,
  type InsertMediaAsset,
  type Playlist,
  type InsertPlaylist,
  type PlaylistChapter,
  type StripeConfig,
  type PaypalConfig,
  type BillingProfile,
  type InsertBillingProfile,
  type Invoice,
  type InsertInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
  type RssFeedToken,
  type CartItem,
  type CartItemWithAudiobook,
  type DiscountCode,
  type InsertDiscountCode,
  type DiscountCodeUsage,
  type InsertDiscountCodeUsage,
  externalServices,
  type ExternalService,
  type InsertExternalService,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike, sql, inArray, gte, lte, lt, isNotNull } from "drizzle-orm";

// Bulk operation response types
export interface BulkOperationResult {
  successIds: string[];
  failed: { id: string; reason: string }[];
}

export interface IStorage {
  // Setup/Installation operations
  checkAdminExists(): Promise<boolean>;
  
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, 'password'> & { passwordHash: string }): Promise<User>;
  updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User>;
  
  // Audiobook operations
  getAllAudiobooks(): Promise<Audiobook[]>;
  getPublicAudiobooks(): Promise<Audiobook[]>;
  getAudiobook(id: string): Promise<Audiobook | undefined>;
  getAudiobookWithChapters(id: string): Promise<AudiobookWithChapters | undefined>;
  getAudiobooksByPublisher(userId: string): Promise<(Audiobook & { chapterCount: number })[]>;
  createAudiobook(audiobook: Omit<Audiobook, "id" | "createdAt">): Promise<Audiobook>;
  updateAudiobook(id: string, data: Partial<Pick<Audiobook, "title" | "author" | "narrator" | "description" | "coverArtUrl" | "coverArtAssetId" | "category" | "language" | "priceCents" | "currency" | "isFree" | "visibility" | "totalDuration">>): Promise<Audiobook>;
  updateAudiobookStripeIds(id: string, stripeProductId: string, stripePriceId: string): Promise<Audiobook>;
  
  // Chapter operations
  getChapter(id: string): Promise<Chapter | undefined>;
  getChapterWithAudiobook(id: string): Promise<ChapterWithAudiobook | undefined>;
  getChaptersByAudiobook(audiobookId: string): Promise<Chapter[]>;
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  updateChapter(id: string, data: Partial<Pick<Chapter, "title" | "chapterNumber" | "description" | "coverArtUrl" | "coverArtAssetId" | "visibility" | "audioUrl" | "audioAssetId" | "duration" | "isSample">>): Promise<Chapter>;
  
  // Favorites operations
  addToFavorites(userId: string, audiobookId: string): Promise<Favorite>;
  removeFromFavorites(userId: string, audiobookId: string): Promise<void>;
  getUserFavorites(userId: string): Promise<Audiobook[]>;
  isFavorite(userId: string, audiobookId: string): Promise<boolean>;
  
  // Purchase operations
  createPurchase(userId: string, audiobookId: string, pricePaidCents: number, currency: string): Promise<AudiobookPurchase>;
  getPurchase(id: string): Promise<AudiobookPurchase | undefined>;
  getPurchaseByUserAndAudiobook(userId: string, audiobookId: string): Promise<AudiobookPurchase | undefined>;
  getUserPurchases(userId: string): Promise<AudiobookPurchase[]>;
  updatePurchaseStatus(id: string, status: "PENDING" | "COMPLETED" | "REFUNDED" | "FAILED", stripePaymentIntentId?: string): Promise<AudiobookPurchase>;
  hasPurchasedAudiobook(userId: string, audiobookId: string): Promise<boolean>;
  
  // Subscription plan operations
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: Omit<SubscriptionPlan, "id" | "createdAt">): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, data: Partial<Pick<SubscriptionPlan, "name" | "description" | "priceCents" | "currency" | "intervalMonths" | "isActive">>): Promise<SubscriptionPlan>;
  deleteSubscriptionPlan(id: string): Promise<void>;
  
  // User subscription operations
  getUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  createUserSubscription(userId: string, planId: string, stripeSubscriptionId: string, periodStart: Date, periodEnd: Date): Promise<UserSubscription>;
  updateUserSubscriptionStatus(id: string, status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED"): Promise<UserSubscription>;
  cancelUserSubscription(id: string): Promise<UserSubscription>;
  hasActiveSubscription(userId: string): Promise<boolean>;
  
  // Access control
  hasAccessToAudiobook(userId: string | undefined, audiobookId: string): Promise<{ hasAccess: boolean; isPurchased: boolean; isSubscriber: boolean; isFree: boolean }>;
  hasAccessToChapter(userId: string | undefined, chapterId: string): Promise<boolean>;
  
  // Listening progress operations
  getListeningProgress(userId: string, audiobookId: string): Promise<ListeningProgress | undefined>;
  updateListeningProgress(userId: string, audiobookId: string, chapterId: string, positionSeconds: number, completed?: boolean): Promise<ListeningProgress>;
  getUserListeningHistory(userId: string): Promise<(ListeningProgress & { audiobook: Audiobook })[]>;
  
  // Admin operations - User management
  getAllUsers(): Promise<User[]>;
  updateUserRequiresApproval(userId: string, requiresApproval: boolean): Promise<User>;
  updateUserIsActive(userId: string, isActive: boolean): Promise<User>;
  updateUserRole(userId: string, role: "LISTENER" | "CREATOR" | "ADMIN"): Promise<User>;
  
  // Admin operations - Content moderation
  getAllAudiobooksWithPublisher(): Promise<(Audiobook & { publisher: User })[]>;
  getAllChaptersWithAudiobook(): Promise<(Chapter & { audiobook: Audiobook })[]>;
  listAudiobooksFiltered(status?: string, publisherId?: string, search?: string): Promise<(Audiobook & { publisher: User })[]>;
  listChaptersFiltered(status?: string, audiobookId?: string, publisherId?: string, search?: string): Promise<(Chapter & { audiobook: Audiobook & { publisher: User } })[]>;
  updateAudiobookStatus(audiobookId: string, status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED", adminId: string): Promise<Audiobook>;
  updateChapterStatus(chapterId: string, status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED", adminId: string): Promise<Chapter>;
  publishAudiobook(audiobookId: string): Promise<Audiobook>;
  unpublishAudiobook(audiobookId: string): Promise<Audiobook>;
  deleteAudiobook(audiobookId: string): Promise<void>;
  deleteChapter(chapterId: string): Promise<void>;
  
  // Email configuration operations
  getActiveEmailConfig(): Promise<EmailConfig | undefined>;
  getAllEmailConfigs(): Promise<EmailConfig[]>;
  createEmailConfig(config: Omit<EmailConfig, "id" | "createdAt" | "updatedAt">): Promise<EmailConfig>;
  updateEmailConfig(id: string, config: Partial<Omit<EmailConfig, "id" | "createdAt" | "updatedAt">>): Promise<EmailConfig>;
  deleteEmailConfig(id: string): Promise<void>;
  setActiveEmailConfig(id: string): Promise<EmailConfig>;
  
  // Password reset token operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  
  // Email verification operations
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  verifyUserEmail(userId: string): Promise<void>;
  updateUserVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  
  // User profile operations
  updateUserProfile(userId: string, data: { username?: string; email?: string; bio?: string; avatarUrl?: string; website?: string }): Promise<User>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  
  // Media asset operations
  createMediaAsset(asset: Omit<MediaAsset, "id" | "createdAt">): Promise<MediaAsset>;
  getMediaAsset(id: string): Promise<MediaAsset | undefined>;
  getMediaAssetByStorageKey(storageKey: string): Promise<MediaAsset | undefined>;
  getMediaAssetsByAudiobook(audiobookId: string): Promise<MediaAsset[]>;
  getMediaAssetsByChapter(chapterId: string): Promise<MediaAsset[]>;
  deleteMediaAsset(id: string): Promise<void>;
  
  // Google Drive configuration operations
  getActiveDriveConfig(): Promise<DriveConfig | undefined>;
  getAllDriveConfigs(): Promise<DriveConfig[]>;
  createDriveConfig(config: Omit<DriveConfig, "id" | "createdAt" | "updatedAt">): Promise<DriveConfig>;
  updateDriveConfig(id: string, config: Partial<Omit<DriveConfig, "id" | "createdAt" | "updatedAt">>): Promise<DriveConfig>;
  deleteDriveConfig(id: string): Promise<void>;
  setActiveDriveConfig(id: string): Promise<DriveConfig>;
  
  // Stripe configuration operations
  getStripeConfig(): Promise<StripeConfig | undefined>;
  updateStripeConfig(data: Partial<Pick<StripeConfig, "publishableKey" | "webhookSecret" | "isActive">>): Promise<StripeConfig>;
  
  // PayPal configuration operations
  getPayPalConfig(): Promise<PaypalConfig | undefined>;
  savePayPalConfig(config: { clientId: string; webhookId?: string; environment: string; isActive: boolean }): Promise<PaypalConfig>;
  
  // PayPal-specific operations
  getUserPurchaseForAudiobook(userId: string, audiobookId: string): Promise<AudiobookPurchase | undefined>;
  getPurchaseByPayPalOrderId(paypalOrderId: string): Promise<AudiobookPurchase | undefined>;
  markPurchaseCompletedByPayPalOrderId(paypalOrderId: string, captureId: string, payerEmail?: string): Promise<AudiobookPurchase | undefined>;
  getUserActiveSubscription(userId: string): Promise<UserSubscription | undefined>;
  getUserSubscriptionByPayPalId(userId: string, paypalSubscriptionId: string): Promise<UserSubscription | undefined>;
  updateSubscriptionStatusByPayPalId(paypalSubscriptionId: string, status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED"): Promise<void>;
  updateSubscriptionPlanPayPalIds(id: string, paypalPlanId: string, paypalProductId: string): Promise<SubscriptionPlan>;
  
  // Billing profile operations
  getBillingProfile(userId: string): Promise<BillingProfile | undefined>;
  createBillingProfile(profile: InsertBillingProfile): Promise<BillingProfile>;
  updateBillingProfile(userId: string, data: Partial<InsertBillingProfile>): Promise<BillingProfile>;
  
  // Invoice operations
  createInvoice(invoice: Omit<InsertInvoice, 'invoiceNumber'>, lineItems?: Array<{description: string; quantity: number; unitPriceCents: number; totalCents: number}>): Promise<Invoice>;
  createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined>;
  getUserInvoices(userId: string): Promise<Invoice[]>;
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  updateInvoicePdfPath(id: string, pdfPath: string): Promise<Invoice>;
  getNextInvoiceNumber(): Promise<string>;
  
  // Bulk operations
  bulkUpdateUsersRole(ids: string[], role: "LISTENER" | "CREATOR" | "ADMIN"): Promise<BulkOperationResult>;
  bulkUpdateUsersActive(ids: string[], isActive: boolean): Promise<BulkOperationResult>;
  bulkDeleteUsers(ids: string[]): Promise<BulkOperationResult>;
  bulkUpdateAudiobooksStatus(ids: string[], status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED", adminId: string): Promise<BulkOperationResult>;
  bulkDeleteAudiobooks(ids: string[]): Promise<BulkOperationResult>;
  bulkUpdateChaptersStatus(ids: string[], status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED", adminId: string): Promise<BulkOperationResult>;
  bulkDeleteChapters(ids: string[]): Promise<BulkOperationResult>;
  
  // Playlist operations
  createPlaylist(playlist: Omit<Playlist, "id" | "createdAt" | "updatedAt"> & { userId: string }): Promise<Playlist>;
  getPlaylist(id: string): Promise<Playlist | undefined>;
  getUserPlaylists(userId: string): Promise<Playlist[]>;
  getPublicPlaylists(): Promise<Playlist[]>;
  updatePlaylist(id: string, data: Partial<Pick<Playlist, "name" | "description" | "isPublic">>): Promise<Playlist>;
  deletePlaylist(id: string): Promise<void>;
  addChapterToPlaylist(playlistId: string, chapterId: string): Promise<PlaylistChapter>;
  removeChapterFromPlaylist(playlistId: string, chapterId: string): Promise<void>;
  getPlaylistChapters(playlistId: string): Promise<Chapter[]>;
  isChapterInPlaylist(playlistId: string, chapterId: string): Promise<boolean>;
  reorderPlaylistChapters(playlistId: string, chapterIds: string[]): Promise<void>;
  
  // Sales analytics operations
  getSalesSummary(from: Date, to: Date): Promise<{
    totalRevenueCents: number;
    purchaseCount: number;
    subscriptionCount: number;
    purchaseRevenueCents: number;
    subscriptionRevenueCents: number;
    averageOrderValueCents: number;
  }>;
  getRevenueTrend(from: Date, to: Date, interval: 'day' | 'week' | 'month'): Promise<Array<{
    date: string;
    purchaseRevenueCents: number;
    subscriptionRevenueCents: number;
    totalRevenueCents: number;
  }>>;
  getTopAudiobooks(from: Date, to: Date, limit: number): Promise<Array<{
    audiobook: Audiobook;
    salesCount: number;
    revenueCents: number;
  }>>;
  getRecentTransactions(limit: number): Promise<Array<{
    id: string;
    type: 'purchase' | 'subscription';
    amount: number;
    currency: string;
    userName: string;
    userEmail: string;
    itemName: string;
    date: Date;
    status: string;
  }>>;
  
  // RSS Feed token operations
  getRssFeedToken(userId: string): Promise<RssFeedToken | undefined>;
  getRssFeedTokenByToken(token: string): Promise<RssFeedToken | undefined>;
  createRssFeedToken(userId: string, token: string): Promise<RssFeedToken>;
  regenerateRssFeedToken(userId: string, newToken: string): Promise<RssFeedToken>;
  updateRssFeedTokenAccess(token: string): Promise<void>;
  
  // Shopping cart operations
  getCartItems(userId: string): Promise<CartItemWithAudiobook[]>;
  addToCart(userId: string, audiobookId: string): Promise<CartItem>;
  removeFromCart(userId: string, audiobookId: string): Promise<void>;
  clearCart(userId: string): Promise<void>;
  isInCart(userId: string, audiobookId: string): Promise<boolean>;
  getCartTotal(userId: string): Promise<{ totalCents: number; itemCount: number; currency: string }>;
  
  // Admin customer management operations
  getCustomersWithStats(filters?: { search?: string; role?: string; hasProfile?: boolean }): Promise<Array<{
    user: User;
    billingProfile: BillingProfile | null;
    totalPurchases: number;
    totalSpentCents: number;
    lastPurchaseAt: Date | null;
  }>>;
  getCustomerDetail(userId: string): Promise<{
    user: User;
    billingProfile: BillingProfile | null;
    purchases: Array<AudiobookPurchase & { audiobook: Audiobook }>;
    invoices: Invoice[];
    subscription: UserSubscription | null;
    stats: { totalPurchases: number; totalSpentCents: number; lastPurchaseAt: Date | null };
  } | undefined>;
  getAllInvoicesAdmin(filters?: { search?: string; status?: string; from?: Date; to?: Date }): Promise<Array<Invoice & { user: User }>>;
  
  // Discount code operations
  createDiscountCode(data: InsertDiscountCode): Promise<DiscountCode>;
  getDiscountCode(id: string): Promise<DiscountCode | undefined>;
  getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined>;
  getAllDiscountCodes(): Promise<DiscountCode[]>;
  updateDiscountCode(id: string, data: Partial<InsertDiscountCode>): Promise<DiscountCode>;
  deleteDiscountCode(id: string): Promise<void>;
  incrementDiscountCodeUsage(id: string): Promise<void>;
  validateDiscountCode(code: string, userId: string, totalCents: number, forSubscription: boolean): Promise<{ valid: boolean; discountCode?: DiscountCode; error?: string }>;
  recordDiscountCodeUsage(discountCodeId: string, userId: string, purchaseId: string | null, discountAmountCents: number): Promise<DiscountCodeUsage>;
  getUserDiscountCodeUsageCount(discountCodeId: string, userId: string): Promise<number>;
  
  // External services operations
  getExternalServices(): Promise<ExternalService[]>;
  getExternalService(id: string): Promise<ExternalService | undefined>;
  createExternalService(service: InsertExternalService): Promise<ExternalService>;
  updateExternalService(id: string, data: Partial<InsertExternalService>): Promise<ExternalService>;
  deleteExternalService(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Setup/Installation operations
  async checkAdminExists(): Promise<boolean> {
    const [admin] = await db.select().from(users).where(eq(users.role, "ADMIN")).limit(1);
    return !!admin;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: Omit<InsertUser, 'password'> & { passwordHash: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Audiobook operations
  async getAllAudiobooks(): Promise<Audiobook[]> {
    return await db.select().from(audiobooks).orderBy(desc(audiobooks.createdAt));
  }

  async getPublicAudiobooks(): Promise<Audiobook[]> {
    return await db
      .select()
      .from(audiobooks)
      .where(and(
        eq(audiobooks.visibility, "PUBLIC"),
        eq(audiobooks.status, "APPROVED"),
        isNotNull(audiobooks.publishedAt)
      ))
      .orderBy(desc(audiobooks.createdAt));
  }

  async getAudiobook(id: string): Promise<Audiobook | undefined> {
    const [audiobook] = await db.select().from(audiobooks).where(eq(audiobooks.id, id));
    return audiobook || undefined;
  }

  async getAudiobookWithChapters(id: string): Promise<AudiobookWithChapters | undefined> {
    const [audiobook] = await db.select().from(audiobooks).where(eq(audiobooks.id, id));
    if (!audiobook) return undefined;

    const audiobookChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.audiobookId, id))
      .orderBy(chapters.chapterNumber);
    
    return {
      ...audiobook,
      chapters: audiobookChapters,
    };
  }

  async getAudiobooksByPublisher(userId: string): Promise<(Audiobook & { chapterCount: number })[]> {
    const result = await db
      .select({
        audiobook: audiobooks,
        chapterCount: sql<number>`cast(count(${chapters.id}) as int)`,
      })
      .from(audiobooks)
      .leftJoin(chapters, eq(audiobooks.id, chapters.audiobookId))
      .where(eq(audiobooks.publisherId, userId))
      .groupBy(audiobooks.id)
      .orderBy(desc(audiobooks.createdAt));
    
    return result.map(r => ({ ...r.audiobook, chapterCount: r.chapterCount }));
  }

  async createAudiobook(insertAudiobook: Omit<Audiobook, "id" | "createdAt">): Promise<Audiobook> {
    const publisher = await this.getUser(insertAudiobook.publisherId);
    const status = (publisher?.requiresApproval === false) ? "APPROVED" : "PENDING_APPROVAL";
    
    const audiobookData: any = {
      ...insertAudiobook,
      status,
    };
    
    if (status === "APPROVED") {
      audiobookData.approvedAt = new Date();
      audiobookData.approvedBy = insertAudiobook.publisherId;
    }
    
    const [audiobook] = await db
      .insert(audiobooks)
      .values(audiobookData)
      .returning();
    return audiobook;
  }

  async updateAudiobook(id: string, data: Partial<Pick<Audiobook, "title" | "author" | "narrator" | "description" | "coverArtUrl" | "coverArtAssetId" | "category" | "language" | "priceCents" | "currency" | "isFree" | "visibility" | "totalDuration">>): Promise<Audiobook> {
    const [updated] = await db
      .update(audiobooks)
      .set(data)
      .where(eq(audiobooks.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Audiobook not found");
    }
    
    return updated;
  }

  async updateAudiobookStripeIds(id: string, stripeProductId: string, stripePriceId: string): Promise<Audiobook> {
    const [updated] = await db
      .update(audiobooks)
      .set({ stripeProductId, stripePriceId })
      .where(eq(audiobooks.id, id))
      .returning();
    return updated;
  }

  // Chapter operations
  async getChapter(id: string): Promise<Chapter | undefined> {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    return chapter || undefined;
  }

  async getChapterWithAudiobook(id: string): Promise<ChapterWithAudiobook | undefined> {
    const result = await db
      .select({
        chapter: chapters,
        audiobook: audiobooks,
      })
      .from(chapters)
      .innerJoin(audiobooks, eq(chapters.audiobookId, audiobooks.id))
      .where(eq(chapters.id, id));
    
    if (result.length === 0) return undefined;
    
    return {
      ...result[0].chapter,
      audiobook: result[0].audiobook,
    };
  }

  async getChaptersByAudiobook(audiobookId: string): Promise<Chapter[]> {
    return await db
      .select()
      .from(chapters)
      .where(eq(chapters.audiobookId, audiobookId))
      .orderBy(chapters.chapterNumber);
  }

  async createChapter(insertChapter: InsertChapter): Promise<Chapter> {
    const audiobook = await this.getAudiobook(insertChapter.audiobookId);
    if (!audiobook) {
      throw new Error("Audiobook not found");
    }
    
    const publisher = await this.getUser(audiobook.publisherId);
    const status = (publisher?.requiresApproval === false) ? "APPROVED" : "PENDING_APPROVAL";
    
    const chapterData: any = {
      ...insertChapter,
      status,
    };
    
    if (status === "APPROVED") {
      chapterData.approvedAt = new Date();
      chapterData.approvedBy = audiobook.publisherId;
    }
    
    const [chapter] = await db
      .insert(chapters)
      .values(chapterData)
      .returning();
    return chapter;
  }

  async updateChapter(id: string, data: Partial<Pick<Chapter, "title" | "chapterNumber" | "description" | "coverArtUrl" | "coverArtAssetId" | "visibility" | "audioUrl" | "audioAssetId" | "duration" | "isSample">>): Promise<Chapter> {
    const [updated] = await db
      .update(chapters)
      .set(data)
      .where(eq(chapters.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Chapter not found");
    }
    
    return updated;
  }

  // Favorites operations
  async addToFavorites(userId: string, audiobookId: string): Promise<Favorite> {
    const existing = await this.isFavorite(userId, audiobookId);
    if (existing) {
      const [fav] = await db
        .select()
        .from(favorites)
        .where(and(
          eq(favorites.userId, userId),
          eq(favorites.audiobookId, audiobookId)
        ))
        .limit(1);
      return fav;
    }
    
    const [favorite] = await db
      .insert(favorites)
      .values({ userId, audiobookId })
      .returning();
    return favorite;
  }

  async removeFromFavorites(userId: string, audiobookId: string): Promise<void> {
    await db
      .delete(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.audiobookId, audiobookId)
      ));
  }

  async getUserFavorites(userId: string): Promise<Audiobook[]> {
    const result = await db
      .select({ audiobook: audiobooks })
      .from(favorites)
      .innerJoin(audiobooks, eq(favorites.audiobookId, audiobooks.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
    
    return result.map(r => r.audiobook);
  }

  async isFavorite(userId: string, audiobookId: string): Promise<boolean> {
    const [fav] = await db
      .select()
      .from(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.audiobookId, audiobookId)
      ))
      .limit(1);
    
    return !!fav;
  }

  // Purchase operations
  async createPurchase(userId: string, audiobookId: string, pricePaidCents: number, currency: string): Promise<AudiobookPurchase> {
    const [purchase] = await db
      .insert(audiobookPurchases)
      .values({
        userId,
        audiobookId,
        pricePaidCents,
        currency,
        status: "PENDING",
      })
      .returning();
    return purchase;
  }

  async getPurchase(id: string): Promise<AudiobookPurchase | undefined> {
    const [purchase] = await db.select().from(audiobookPurchases).where(eq(audiobookPurchases.id, id));
    return purchase || undefined;
  }

  async getPurchaseByUserAndAudiobook(userId: string, audiobookId: string): Promise<AudiobookPurchase | undefined> {
    const [purchase] = await db
      .select()
      .from(audiobookPurchases)
      .where(and(
        eq(audiobookPurchases.userId, userId),
        eq(audiobookPurchases.audiobookId, audiobookId),
        eq(audiobookPurchases.status, "COMPLETED")
      ));
    return purchase || undefined;
  }

  async getUserPurchases(userId: string): Promise<AudiobookPurchase[]> {
    return await db
      .select()
      .from(audiobookPurchases)
      .where(and(
        eq(audiobookPurchases.userId, userId),
        eq(audiobookPurchases.status, "COMPLETED")
      ))
      .orderBy(desc(audiobookPurchases.purchasedAt));
  }

  async updatePurchaseStatus(id: string, status: "PENDING" | "COMPLETED" | "REFUNDED" | "FAILED", stripePaymentIntentId?: string): Promise<AudiobookPurchase> {
    const updateData: any = { status };
    if (status === "COMPLETED") {
      updateData.purchasedAt = new Date();
    }
    if (stripePaymentIntentId) {
      updateData.stripePaymentIntentId = stripePaymentIntentId;
    }
    
    const [purchase] = await db
      .update(audiobookPurchases)
      .set(updateData)
      .where(eq(audiobookPurchases.id, id))
      .returning();
    return purchase;
  }

  async hasPurchasedAudiobook(userId: string, audiobookId: string): Promise<boolean> {
    const purchase = await this.getPurchaseByUserAndAudiobook(userId, audiobookId);
    return !!purchase;
  }

  // Subscription plan operations
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.priceCents);
  }

  async getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.priceCents);
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan || undefined;
  }

  async createSubscriptionPlan(plan: Omit<SubscriptionPlan, "id" | "createdAt">): Promise<SubscriptionPlan> {
    const [newPlan] = await db
      .insert(subscriptionPlans)
      .values(plan)
      .returning();
    return newPlan;
  }

  async updateSubscriptionPlan(id: string, data: Partial<Pick<SubscriptionPlan, "name" | "description" | "priceCents" | "currency" | "intervalMonths" | "isActive">>): Promise<SubscriptionPlan> {
    const [updated] = await db
      .update(subscriptionPlans)
      .set(data)
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return updated;
  }

  async deleteSubscriptionPlan(id: string): Promise<void> {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  // User subscription operations
  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "ACTIVE")
      ))
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);
    return subscription || undefined;
  }

  async createUserSubscription(userId: string, planId: string, stripeSubscriptionId: string, periodStart: Date, periodEnd: Date): Promise<UserSubscription> {
    const [subscription] = await db
      .insert(userSubscriptions)
      .values({
        userId,
        planId,
        stripeSubscriptionId,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      })
      .returning();
    return subscription;
  }

  async updateUserSubscriptionStatus(id: string, status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED"): Promise<UserSubscription> {
    const [subscription] = await db
      .update(userSubscriptions)
      .set({ status })
      .where(eq(userSubscriptions.id, id))
      .returning();
    return subscription;
  }

  async cancelUserSubscription(id: string): Promise<UserSubscription> {
    const [subscription] = await db
      .update(userSubscriptions)
      .set({ status: "CANCELED", canceledAt: new Date() })
      .where(eq(userSubscriptions.id, id))
      .returning();
    return subscription;
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) return false;
    return subscription.status === "ACTIVE" && subscription.currentPeriodEnd > new Date();
  }

  // Access control
  async hasAccessToAudiobook(userId: string | undefined, audiobookId: string): Promise<{ hasAccess: boolean; isPurchased: boolean; isSubscriber: boolean; isFree: boolean }> {
    const audiobook = await this.getAudiobook(audiobookId);
    if (!audiobook) return { hasAccess: false, isPurchased: false, isSubscriber: false, isFree: false };

    const isFree = audiobook.isFree || audiobook.priceCents === 0;
    
    // Free audiobooks are accessible to everyone
    if (isFree) {
      return { hasAccess: true, isPurchased: false, isSubscriber: false, isFree: true };
    }

    // Not logged in - no access to paid content
    if (!userId) {
      return { hasAccess: false, isPurchased: false, isSubscriber: false, isFree: false };
    }

    // Publisher always has access
    if (audiobook.publisherId === userId) {
      return { hasAccess: true, isPurchased: false, isSubscriber: false, isFree: false };
    }

    // Check if admin
    const user = await this.getUser(userId);
    if (user?.role === "ADMIN") {
      return { hasAccess: true, isPurchased: false, isSubscriber: false, isFree: false };
    }

    // Check if purchased
    const isPurchased = await this.hasPurchasedAudiobook(userId, audiobookId);
    if (isPurchased) {
      return { hasAccess: true, isPurchased: true, isSubscriber: false, isFree: false };
    }

    // Check if subscriber
    const isSubscriber = await this.hasActiveSubscription(userId);
    if (isSubscriber) {
      return { hasAccess: true, isPurchased: false, isSubscriber: true, isFree: false };
    }

    return { hasAccess: false, isPurchased: false, isSubscriber: false, isFree: false };
  }

  async hasAccessToChapter(userId: string | undefined, chapterId: string): Promise<boolean> {
    const chapter = await this.getChapterWithAudiobook(chapterId);
    if (!chapter) return false;

    // Sample chapters are always accessible
    if (chapter.isSample) return true;

    const access = await this.hasAccessToAudiobook(userId, chapter.audiobookId);
    return access.hasAccess;
  }

  // Listening progress operations
  async getListeningProgress(userId: string, audiobookId: string): Promise<ListeningProgress | undefined> {
    const [progress] = await db
      .select()
      .from(listeningProgress)
      .where(and(
        eq(listeningProgress.userId, userId),
        eq(listeningProgress.audiobookId, audiobookId)
      ));
    return progress || undefined;
  }

  async updateListeningProgress(userId: string, audiobookId: string, chapterId: string, positionSeconds: number, completed?: boolean): Promise<ListeningProgress> {
    const existing = await this.getListeningProgress(userId, audiobookId);
    
    if (existing) {
      const [updated] = await db
        .update(listeningProgress)
        .set({
          chapterId,
          positionSeconds,
          completed: completed ?? existing.completed,
          updatedAt: new Date(),
        })
        .where(eq(listeningProgress.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(listeningProgress)
      .values({
        userId,
        audiobookId,
        chapterId,
        positionSeconds,
        completed: completed ?? false,
      })
      .returning();
    return created;
  }

  async getUserListeningHistory(userId: string): Promise<(ListeningProgress & { audiobook: Audiobook })[]> {
    const result = await db
      .select({
        progress: listeningProgress,
        audiobook: audiobooks,
      })
      .from(listeningProgress)
      .innerJoin(audiobooks, eq(listeningProgress.audiobookId, audiobooks.id))
      .where(eq(listeningProgress.userId, userId))
      .orderBy(desc(listeningProgress.updatedAt));
    
    return result.map(r => ({ ...r.progress, audiobook: r.audiobook }));
  }

  // Admin operations - User management
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRequiresApproval(userId: string, requiresApproval: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ requiresApproval })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserIsActive(userId: string, isActive: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserRole(userId: string, role: "LISTENER" | "CREATOR" | "ADMIN"): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Admin operations - Content moderation
  async getAllAudiobooksWithPublisher(): Promise<(Audiobook & { publisher: User })[]> {
    const result = await db
      .select({
        audiobook: audiobooks,
        publisher: users,
      })
      .from(audiobooks)
      .innerJoin(users, eq(audiobooks.publisherId, users.id))
      .orderBy(desc(audiobooks.createdAt));
    
    return result.map(r => ({ ...r.audiobook, publisher: r.publisher }));
  }

  async getAllChaptersWithAudiobook(): Promise<(Chapter & { audiobook: Audiobook })[]> {
    const result = await db
      .select({
        chapter: chapters,
        audiobook: audiobooks,
      })
      .from(chapters)
      .innerJoin(audiobooks, eq(chapters.audiobookId, audiobooks.id))
      .orderBy(chapters.chapterNumber);
    
    return result.map(r => ({ ...r.chapter, audiobook: r.audiobook }));
  }

  async listAudiobooksFiltered(
    status?: string,
    publisherId?: string,
    search?: string
  ): Promise<(Audiobook & { publisher: User })[]> {
    const conditions = [];
    
    if (status) {
      conditions.push(eq(audiobooks.status, status as any));
    }
    if (publisherId) {
      conditions.push(eq(audiobooks.publisherId, publisherId));
    }
    if (search) {
      conditions.push(
        or(
          ilike(audiobooks.title, `%${search}%`),
          ilike(audiobooks.description, `%${search}%`),
          ilike(audiobooks.author, `%${search}%`)
        )
      );
    }

    const result = await db
      .select({
        audiobook: audiobooks,
        publisher: users,
      })
      .from(audiobooks)
      .innerJoin(users, eq(audiobooks.publisherId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(audiobooks.createdAt));
    
    return result.map(r => ({ ...r.audiobook, publisher: r.publisher }));
  }

  async listChaptersFiltered(
    status?: string,
    audiobookId?: string,
    publisherId?: string,
    search?: string
  ): Promise<(Chapter & { audiobook: Audiobook & { publisher: User } })[]> {
    const conditions = [];
    
    if (status) {
      conditions.push(eq(chapters.status, status as any));
    }
    if (audiobookId) {
      conditions.push(eq(chapters.audiobookId, audiobookId));
    }
    if (publisherId) {
      conditions.push(eq(audiobooks.publisherId, publisherId));
    }
    if (search) {
      conditions.push(
        or(
          ilike(chapters.title, `%${search}%`),
          ilike(chapters.description, `%${search}%`),
          ilike(audiobooks.title, `%${search}%`)
        )
      );
    }

    const result = await db
      .select({
        chapter: chapters,
        audiobook: audiobooks,
        publisher: users,
      })
      .from(chapters)
      .innerJoin(audiobooks, eq(chapters.audiobookId, audiobooks.id))
      .innerJoin(users, eq(audiobooks.publisherId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(chapters.chapterNumber);
    
    return result.map(r => ({ 
      ...r.chapter, 
      audiobook: { ...r.audiobook, publisher: r.publisher } 
    }));
  }

  async updateAudiobookStatus(
    audiobookId: string, 
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED", 
    adminId: string
  ): Promise<Audiobook> {
    const updateData: any = { status };
    
    if (status === "APPROVED") {
      updateData.approvedAt = new Date();
      updateData.approvedBy = adminId;
    }
    
    const [audiobook] = await db
      .update(audiobooks)
      .set(updateData)
      .where(eq(audiobooks.id, audiobookId))
      .returning();
    return audiobook;
  }

  async updateChapterStatus(
    chapterId: string, 
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED", 
    adminId: string
  ): Promise<Chapter> {
    const updateData: any = { status };
    
    if (status === "APPROVED") {
      updateData.approvedAt = new Date();
      updateData.approvedBy = adminId;
    }
    
    const [chapter] = await db
      .update(chapters)
      .set(updateData)
      .where(eq(chapters.id, chapterId))
      .returning();
    return chapter;
  }

  async publishAudiobook(audiobookId: string): Promise<Audiobook> {
    const [audiobook] = await db
      .update(audiobooks)
      .set({ publishedAt: new Date() })
      .where(eq(audiobooks.id, audiobookId))
      .returning();
    return audiobook;
  }

  async unpublishAudiobook(audiobookId: string): Promise<Audiobook> {
    const [audiobook] = await db
      .update(audiobooks)
      .set({ publishedAt: null })
      .where(eq(audiobooks.id, audiobookId))
      .returning();
    return audiobook;
  }

  async deleteAudiobook(audiobookId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(favorites).where(eq(favorites.audiobookId, audiobookId));
      await tx.delete(audiobookPurchases).where(eq(audiobookPurchases.audiobookId, audiobookId));
      await tx.delete(listeningProgress).where(eq(listeningProgress.audiobookId, audiobookId));
      await tx.delete(mediaAssets).where(eq(mediaAssets.audiobookId, audiobookId));
      await tx.delete(chapters).where(eq(chapters.audiobookId, audiobookId));
      await tx.delete(audiobooks).where(eq(audiobooks.id, audiobookId));
    });
  }

  async deleteChapter(chapterId: string): Promise<void> {
    await db.delete(chapters).where(eq(chapters.id, chapterId));
  }

  // Email configuration operations
  async getActiveEmailConfig(): Promise<EmailConfig | undefined> {
    const [config] = await db
      .select()
      .from(emailConfig)
      .where(eq(emailConfig.isActive, true));
    return config || undefined;
  }

  async getAllEmailConfigs(): Promise<EmailConfig[]> {
    return await db.select().from(emailConfig).orderBy(desc(emailConfig.createdAt));
  }

  async createEmailConfig(config: Omit<EmailConfig, "id" | "createdAt" | "updatedAt">): Promise<EmailConfig> {
    if (config.isActive === true) {
      await db.update(emailConfig).set({ isActive: false });
    }

    const [newConfig] = await db
      .insert(emailConfig)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateEmailConfig(id: string, config: Partial<Omit<EmailConfig, "id" | "createdAt" | "updatedAt">>): Promise<EmailConfig> {
    if (config.isActive === true) {
      await db.update(emailConfig).set({ isActive: false });
    }

    const [updated] = await db
      .update(emailConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(emailConfig.id, id))
      .returning();
    return updated;
  }

  async deleteEmailConfig(id: string): Promise<void> {
    await db.delete(emailConfig).where(eq(emailConfig.id, id));
  }

  async setActiveEmailConfig(id: string): Promise<EmailConfig> {
    await db.update(emailConfig).set({ isActive: false });
    const [config] = await db
      .update(emailConfig)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(emailConfig.id, id))
      .returning();
    return config;
  }

  // Password reset token operations
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values(token)
      .returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(lte(passwordResetTokens.expiresAt, new Date()));
  }

  // Email verification operations
  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token));
    return user || undefined;
  }

  async verifyUserEmail(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      })
      .where(eq(users.id, userId));
  }

  async updateUserVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerificationToken: token,
        emailVerificationTokenExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId));
  }

  // User profile operations
  async updateUserProfile(userId: string, data: { username?: string; email?: string; bio?: string; avatarUrl?: string; website?: string }): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
  }

  // Media asset operations
  async createMediaAsset(asset: Omit<MediaAsset, "id" | "createdAt">): Promise<MediaAsset> {
    const [mediaAsset] = await db
      .insert(mediaAssets)
      .values(asset)
      .returning();
    return mediaAsset;
  }

  async getMediaAsset(id: string): Promise<MediaAsset | undefined> {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    return asset || undefined;
  }

  async getMediaAssetByStorageKey(storageKey: string): Promise<MediaAsset | undefined> {
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.storageKey, storageKey));
    return asset || undefined;
  }

  async getMediaAssetsByAudiobook(audiobookId: string): Promise<MediaAsset[]> {
    return await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.audiobookId, audiobookId));
  }

  async getMediaAssetsByChapter(chapterId: string): Promise<MediaAsset[]> {
    return await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.chapterId, chapterId));
  }

  async deleteMediaAsset(id: string): Promise<void> {
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  }

  // Google Drive configuration operations
  async getActiveDriveConfig(): Promise<DriveConfig | undefined> {
    const [config] = await db
      .select()
      .from(driveConfig)
      .where(eq(driveConfig.isActive, true));
    return config || undefined;
  }

  async getAllDriveConfigs(): Promise<DriveConfig[]> {
    return await db.select().from(driveConfig).orderBy(desc(driveConfig.createdAt));
  }

  async createDriveConfig(config: Omit<DriveConfig, "id" | "createdAt" | "updatedAt">): Promise<DriveConfig> {
    if (config.isActive === true) {
      await db.update(driveConfig).set({ isActive: false });
    }

    const [newConfig] = await db
      .insert(driveConfig)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateDriveConfig(id: string, config: Partial<Omit<DriveConfig, "id" | "createdAt" | "updatedAt">>): Promise<DriveConfig> {
    if (config.isActive === true) {
      await db.update(driveConfig).set({ isActive: false });
    }

    const [updated] = await db
      .update(driveConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(driveConfig.id, id))
      .returning();
    return updated;
  }

  async deleteDriveConfig(id: string): Promise<void> {
    await db.delete(driveConfig).where(eq(driveConfig.id, id));
  }

  async setActiveDriveConfig(id: string): Promise<DriveConfig> {
    await db.update(driveConfig).set({ isActive: false });
    const [config] = await db
      .update(driveConfig)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(driveConfig.id, id))
      .returning();
    return config;
  }

  // Stripe configuration operations
  async getStripeConfig(): Promise<StripeConfig | undefined> {
    const [config] = await db.select().from(stripeConfig).limit(1);
    return config || undefined;
  }

  async updateStripeConfig(data: Partial<Pick<StripeConfig, "publishableKey" | "webhookSecret" | "isActive">>): Promise<StripeConfig> {
    const existing = await this.getStripeConfig();
    
    if (existing) {
      const [updated] = await db
        .update(stripeConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(stripeConfig.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(stripeConfig)
      .values({ ...data })
      .returning();
    return created;
  }

  // PayPal configuration operations
  async getPayPalConfig(): Promise<PaypalConfig | undefined> {
    const [config] = await db
      .select()
      .from(paypalConfig)
      .where(eq(paypalConfig.isActive, true))
      .limit(1);
    return config || undefined;
  }

  async savePayPalConfig(config: { clientId: string; webhookId?: string; environment: string; isActive: boolean }): Promise<PaypalConfig> {
    const existing = await this.getPayPalConfig();
    
    if (existing) {
      const [updated] = await db
        .update(paypalConfig)
        .set({
          clientId: config.clientId,
          webhookId: config.webhookId || null,
          environment: config.environment,
          isActive: config.isActive,
          updatedAt: new Date(),
        })
        .where(eq(paypalConfig.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(paypalConfig)
      .values({
        clientId: config.clientId,
        webhookId: config.webhookId || null,
        environment: config.environment,
        isActive: config.isActive,
      })
      .returning();
    return created;
  }

  // PayPal-specific operations
  async getUserPurchaseForAudiobook(userId: string, audiobookId: string): Promise<AudiobookPurchase | undefined> {
    const [purchase] = await db
      .select()
      .from(audiobookPurchases)
      .where(and(
        eq(audiobookPurchases.userId, userId),
        eq(audiobookPurchases.audiobookId, audiobookId)
      ))
      .orderBy(desc(audiobookPurchases.createdAt))
      .limit(1);
    return purchase || undefined;
  }

  async getPurchaseByPayPalOrderId(paypalOrderId: string): Promise<AudiobookPurchase | undefined> {
    const [purchase] = await db
      .select()
      .from(audiobookPurchases)
      .where(eq(audiobookPurchases.paypalOrderId, paypalOrderId))
      .limit(1);
    return purchase || undefined;
  }

  async markPurchaseCompletedByPayPalOrderId(paypalOrderId: string, captureId: string, payerEmail?: string): Promise<AudiobookPurchase | undefined> {
    const [purchase] = await db
      .update(audiobookPurchases)
      .set({
        status: "COMPLETED",
        paypalCaptureId: captureId,
        paypalPayerEmail: payerEmail || null,
        purchasedAt: new Date(),
      })
      .where(eq(audiobookPurchases.paypalOrderId, paypalOrderId))
      .returning();
    return purchase || undefined;
  }

  async getUserActiveSubscription(userId: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "ACTIVE")
      ))
      .limit(1);
    return subscription || undefined;
  }

  async getUserSubscriptionByPayPalId(userId: string, paypalSubscriptionId: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.paypalSubscriptionId, paypalSubscriptionId)
      ))
      .limit(1);
    return subscription || undefined;
  }

  async updateSubscriptionStatusByPayPalId(paypalSubscriptionId: string, status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED"): Promise<void> {
    const updateData: any = { status };
    if (status === "CANCELED") {
      updateData.canceledAt = new Date();
    }
    await db
      .update(userSubscriptions)
      .set(updateData)
      .where(eq(userSubscriptions.paypalSubscriptionId, paypalSubscriptionId));
  }

  async updateSubscriptionPlanPayPalIds(id: string, paypalPlanId: string, paypalProductId: string): Promise<SubscriptionPlan> {
    const [updated] = await db
      .update(subscriptionPlans)
      .set({ paypalPlanId, paypalProductId })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    if (!updated) {
      throw new Error("Subscription plan not found");
    }
    return updated;
  }

  // Billing profile operations
  async getBillingProfile(userId: string): Promise<BillingProfile | undefined> {
    const [profile] = await db
      .select()
      .from(billingProfiles)
      .where(eq(billingProfiles.userId, userId))
      .limit(1);
    return profile || undefined;
  }

  async createBillingProfile(profile: InsertBillingProfile): Promise<BillingProfile> {
    const [created] = await db
      .insert(billingProfiles)
      .values(profile)
      .returning();
    return created;
  }

  async updateBillingProfile(userId: string, data: Partial<InsertBillingProfile>): Promise<BillingProfile> {
    const [updated] = await db
      .update(billingProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(billingProfiles.userId, userId))
      .returning();
    if (!updated) {
      throw new Error("Billing profile not found");
    }
    return updated;
  }

  // Invoice operations
  async createInvoice(
    invoice: Omit<InsertInvoice, 'invoiceNumber'>, 
    lineItems?: Array<{description: string; quantity: number; unitPriceCents: number; totalCents: number}>
  ): Promise<Invoice> {
    // Generate invoice number automatically
    const invoiceNumber = await this.getNextInvoiceNumber();
    
    // Use transaction to ensure invoice and line items are created atomically
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(invoices)
        .values({ ...invoice, invoiceNumber })
        .returning();
      
      // Create line items if provided
      if (lineItems && lineItems.length > 0) {
        for (const item of lineItems) {
          await tx.insert(invoiceLineItems).values({
            invoiceId: created.id,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            totalCents: item.totalCents,
          });
        }
      }
      
      return created;
    });
  }

  async createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [created] = await db
      .insert(invoiceLineItems)
      .values(item)
      .returning();
    return created;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);
    return invoice || undefined;
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber))
      .limit(1);
    return invoice || undefined;
  }

  async getUserInvoices(userId: string): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.issueDate));
  }

  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));
  }

  async updateInvoicePdfPath(id: string, pdfPath: string): Promise<Invoice> {
    const [updated] = await db
      .update(invoices)
      .set({ pdfPath, pdfStatus: "READY" })
      .where(eq(invoices.id, id))
      .returning();
    if (!updated) {
      throw new Error("Invoice not found");
    }
    return updated;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(sql`EXTRACT(YEAR FROM ${invoices.issueDate}) = ${year}`);
    const count = (result?.count || 0) + 1;
    return `AUD-${year}-${String(count).padStart(5, '0')}`;
  }

  // Bulk operations
  async bulkUpdateUsersRole(ids: string[], role: "LISTENER" | "CREATOR" | "ADMIN"): Promise<BulkOperationResult> {
    const uniqueIds = Array.from(new Set(ids));
    const successIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    await db.transaction(async (tx) => {
      const existingUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, uniqueIds));
      
      const existingIds = existingUsers.map(u => u.id);
      
      for (const id of uniqueIds) {
        if (!existingIds.includes(id)) {
          failed.push({ id, reason: "User not found" });
        }
      }

      if (existingIds.length > 0) {
        const updated = await tx
          .update(users)
          .set({ role })
          .where(inArray(users.id, existingIds))
          .returning({ id: users.id });
        
        successIds.push(...updated.map(u => u.id));
      }
    });

    return { successIds, failed };
  }

  async bulkUpdateUsersActive(ids: string[], isActive: boolean): Promise<BulkOperationResult> {
    const uniqueIds = Array.from(new Set(ids));
    const successIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    await db.transaction(async (tx) => {
      const existingUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, uniqueIds));
      
      const existingIds = existingUsers.map(u => u.id);
      
      for (const id of uniqueIds) {
        if (!existingIds.includes(id)) {
          failed.push({ id, reason: "User not found" });
        }
      }

      if (existingIds.length > 0) {
        const updated = await tx
          .update(users)
          .set({ isActive })
          .where(inArray(users.id, existingIds))
          .returning({ id: users.id });
        
        successIds.push(...updated.map(u => u.id));
      }
    });

    return { successIds, failed };
  }

  async bulkDeleteUsers(ids: string[]): Promise<BulkOperationResult> {
    const uniqueIds = Array.from(new Set(ids));
    const successIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    await db.transaction(async (tx) => {
      const existingUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, uniqueIds));
      
      const existingIds = existingUsers.map(u => u.id);
      
      for (const id of uniqueIds) {
        if (!existingIds.includes(id)) {
          failed.push({ id, reason: "User not found" });
        }
      }

      if (existingIds.length > 0) {
        const deleted = await tx
          .delete(users)
          .where(inArray(users.id, existingIds))
          .returning({ id: users.id });
        
        successIds.push(...deleted.map(u => u.id));
      }
    });

    return { successIds, failed };
  }

  async bulkUpdateAudiobooksStatus(
    ids: string[],
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED",
    adminId: string
  ): Promise<BulkOperationResult> {
    const uniqueIds = Array.from(new Set(ids));
    const successIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    await db.transaction(async (tx) => {
      const existingAudiobooks = await tx
        .select({ id: audiobooks.id })
        .from(audiobooks)
        .where(inArray(audiobooks.id, uniqueIds));
      
      const existingIds = existingAudiobooks.map(a => a.id);
      
      for (const id of uniqueIds) {
        if (!existingIds.includes(id)) {
          failed.push({ id, reason: "Audiobook not found" });
        }
      }

      if (existingIds.length > 0) {
        const updated = await tx
          .update(audiobooks)
          .set({ 
            status,
            approvedBy: adminId,
            approvedAt: new Date(),
          })
          .where(inArray(audiobooks.id, existingIds))
          .returning({ id: audiobooks.id });
        
        successIds.push(...updated.map(a => a.id));
      }
    });

    return { successIds, failed };
  }

  async bulkDeleteAudiobooks(ids: string[]): Promise<BulkOperationResult> {
    const uniqueIds = Array.from(new Set(ids));
    const successIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    await db.transaction(async (tx) => {
      const existingAudiobooks = await tx
        .select({ id: audiobooks.id })
        .from(audiobooks)
        .where(inArray(audiobooks.id, uniqueIds));
      
      const existingIds = existingAudiobooks.map(a => a.id);
      
      for (const id of uniqueIds) {
        if (!existingIds.includes(id)) {
          failed.push({ id, reason: "Audiobook not found" });
        }
      }

      if (existingIds.length > 0) {
        await tx.delete(favorites).where(inArray(favorites.audiobookId, existingIds));
        await tx.delete(audiobookPurchases).where(inArray(audiobookPurchases.audiobookId, existingIds));
        await tx.delete(listeningProgress).where(inArray(listeningProgress.audiobookId, existingIds));
        await tx.delete(mediaAssets).where(inArray(mediaAssets.audiobookId, existingIds));
        await tx.delete(chapters).where(inArray(chapters.audiobookId, existingIds));
        
        const deleted = await tx
          .delete(audiobooks)
          .where(inArray(audiobooks.id, existingIds))
          .returning({ id: audiobooks.id });
        
        successIds.push(...deleted.map(a => a.id));
      }
    });

    return { successIds, failed };
  }

  async bulkUpdateChaptersStatus(
    ids: string[],
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED",
    adminId: string
  ): Promise<BulkOperationResult> {
    const uniqueIds = Array.from(new Set(ids));
    const successIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    await db.transaction(async (tx) => {
      const existingChapters = await tx
        .select({ id: chapters.id })
        .from(chapters)
        .where(inArray(chapters.id, uniqueIds));
      
      const existingIds = existingChapters.map(c => c.id);
      
      for (const id of uniqueIds) {
        if (!existingIds.includes(id)) {
          failed.push({ id, reason: "Chapter not found" });
        }
      }

      if (existingIds.length > 0) {
        const updated = await tx
          .update(chapters)
          .set({ 
            status,
            approvedBy: adminId,
            approvedAt: new Date(),
          })
          .where(inArray(chapters.id, existingIds))
          .returning({ id: chapters.id });
        
        successIds.push(...updated.map(c => c.id));
      }
    });

    return { successIds, failed };
  }

  async bulkDeleteChapters(ids: string[]): Promise<BulkOperationResult> {
    const uniqueIds = Array.from(new Set(ids));
    const successIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    await db.transaction(async (tx) => {
      const existingChapters = await tx
        .select({ id: chapters.id })
        .from(chapters)
        .where(inArray(chapters.id, uniqueIds));
      
      const existingIds = existingChapters.map(c => c.id);
      
      for (const id of uniqueIds) {
        if (!existingIds.includes(id)) {
          failed.push({ id, reason: "Chapter not found" });
        }
      }

      if (existingIds.length > 0) {
        const deleted = await tx
          .delete(chapters)
          .where(inArray(chapters.id, existingIds))
          .returning({ id: chapters.id });
        
        successIds.push(...deleted.map(c => c.id));
      }
    });

    return { successIds, failed };
  }

  // Playlist operations
  async createPlaylist(playlist: Omit<Playlist, "id" | "createdAt" | "updatedAt"> & { userId: string }): Promise<Playlist> {
    const [newPlaylist] = await db
      .insert(playlists)
      .values(playlist)
      .returning();
    return newPlaylist;
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, id));
    return playlist || undefined;
  }

  async getUserPlaylists(userId: string): Promise<Playlist[]> {
    return await db
      .select()
      .from(playlists)
      .where(eq(playlists.userId, userId))
      .orderBy(desc(playlists.updatedAt));
  }

  async getPublicPlaylists(): Promise<Playlist[]> {
    return await db
      .select()
      .from(playlists)
      .where(eq(playlists.isPublic, true))
      .orderBy(desc(playlists.updatedAt));
  }

  async updatePlaylist(id: string, data: Partial<Pick<Playlist, "name" | "description" | "isPublic">>): Promise<Playlist> {
    const [updated] = await db
      .update(playlists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(playlists.id, id))
      .returning();
    return updated;
  }

  async deletePlaylist(id: string): Promise<void> {
    await db.delete(playlists).where(eq(playlists.id, id));
  }

  async addChapterToPlaylist(playlistId: string, chapterId: string): Promise<PlaylistChapter> {
    const existingChapters = await db
      .select()
      .from(playlistChapters)
      .where(eq(playlistChapters.playlistId, playlistId));
    
    const maxPosition = existingChapters.length > 0 
      ? Math.max(...existingChapters.map(c => c.position)) 
      : -1;

    const [added] = await db
      .insert(playlistChapters)
      .values({
        playlistId,
        chapterId,
        position: maxPosition + 1,
      })
      .returning();

    await db
      .update(playlists)
      .set({ updatedAt: new Date() })
      .where(eq(playlists.id, playlistId));

    return added;
  }

  async removeChapterFromPlaylist(playlistId: string, chapterId: string): Promise<void> {
    await db
      .delete(playlistChapters)
      .where(
        and(
          eq(playlistChapters.playlistId, playlistId),
          eq(playlistChapters.chapterId, chapterId)
        )
      );

    await db
      .update(playlists)
      .set({ updatedAt: new Date() })
      .where(eq(playlists.id, playlistId));
  }

  async getPlaylistChapters(playlistId: string): Promise<Chapter[]> {
    const result = await db
      .select({
        chapter: chapters,
        position: playlistChapters.position,
      })
      .from(playlistChapters)
      .innerJoin(chapters, eq(playlistChapters.chapterId, chapters.id))
      .where(eq(playlistChapters.playlistId, playlistId))
      .orderBy(playlistChapters.position);

    return result.map(r => r.chapter);
  }

  async isChapterInPlaylist(playlistId: string, chapterId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(playlistChapters)
      .where(
        and(
          eq(playlistChapters.playlistId, playlistId),
          eq(playlistChapters.chapterId, chapterId)
        )
      );
    return !!result;
  }

  async reorderPlaylistChapters(playlistId: string, chapterIds: string[]): Promise<void> {
    for (let i = 0; i < chapterIds.length; i++) {
      await db
        .update(playlistChapters)
        .set({ position: i })
        .where(
          and(
            eq(playlistChapters.playlistId, playlistId),
            eq(playlistChapters.chapterId, chapterIds[i])
          )
        );
    }

    await db
      .update(playlists)
      .set({ updatedAt: new Date() })
      .where(eq(playlists.id, playlistId));
  }

  // Sales analytics operations - uses invoices as the source of truth for revenue
  async getSalesSummary(from: Date, to: Date): Promise<{
    totalRevenueCents: number;
    purchaseCount: number;
    subscriptionCount: number;
    purchaseRevenueCents: number;
    subscriptionRevenueCents: number;
    averageOrderValueCents: number;
  }> {
    const purchaseInvoices = await db
      .select({
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.type, "PURCHASE"),
          or(eq(invoices.status, "ISSUED"), eq(invoices.status, "PAID")),
          gte(invoices.issueDate, from),
          lte(invoices.issueDate, to)
        )
      );

    const subscriptionInvoices = await db
      .select({
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.type, "SUBSCRIPTION"),
          or(eq(invoices.status, "ISSUED"), eq(invoices.status, "PAID")),
          gte(invoices.issueDate, from),
          lte(invoices.issueDate, to)
        )
      );

    const purchaseCount = purchaseInvoices[0]?.count || 0;
    const purchaseRevenueCents = purchaseInvoices[0]?.revenue || 0;
    const subscriptionCount = subscriptionInvoices[0]?.count || 0;
    const subscriptionRevenueCents = subscriptionInvoices[0]?.revenue || 0;
    const totalRevenueCents = purchaseRevenueCents + subscriptionRevenueCents;
    const totalTransactions = purchaseCount + subscriptionCount;
    const averageOrderValueCents = totalTransactions > 0 ? Math.round(totalRevenueCents / totalTransactions) : 0;

    return {
      totalRevenueCents,
      purchaseCount,
      subscriptionCount,
      purchaseRevenueCents,
      subscriptionRevenueCents,
      averageOrderValueCents,
    };
  }

  async getRevenueTrend(from: Date, to: Date, interval: 'day' | 'week' | 'month'): Promise<Array<{
    date: string;
    purchaseRevenueCents: number;
    subscriptionRevenueCents: number;
    totalRevenueCents: number;
  }>> {
    const truncInterval = interval === 'day' ? 'day' : interval === 'week' ? 'week' : 'month';
    
    const purchaseTrend = await db
      .select({
        date: sql<string>`date_trunc(${truncInterval}, ${invoices.issueDate})::date::text`,
        revenue: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.type, "PURCHASE"),
          or(eq(invoices.status, "ISSUED"), eq(invoices.status, "PAID")),
          gte(invoices.issueDate, from),
          lte(invoices.issueDate, to)
        )
      )
      .groupBy(sql`date_trunc(${truncInterval}, ${invoices.issueDate})`)
      .orderBy(sql`date_trunc(${truncInterval}, ${invoices.issueDate})`);

    const subscriptionTrend = await db
      .select({
        date: sql<string>`date_trunc(${truncInterval}, ${invoices.issueDate})::date::text`,
        revenue: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.type, "SUBSCRIPTION"),
          or(eq(invoices.status, "ISSUED"), eq(invoices.status, "PAID")),
          gte(invoices.issueDate, from),
          lte(invoices.issueDate, to)
        )
      )
      .groupBy(sql`date_trunc(${truncInterval}, ${invoices.issueDate})`)
      .orderBy(sql`date_trunc(${truncInterval}, ${invoices.issueDate})`);

    const dateMap = new Map<string, { purchaseRevenueCents: number; subscriptionRevenueCents: number }>();
    
    for (const p of purchaseTrend) {
      dateMap.set(p.date, { purchaseRevenueCents: p.revenue, subscriptionRevenueCents: 0 });
    }
    
    for (const s of subscriptionTrend) {
      const existing = dateMap.get(s.date) || { purchaseRevenueCents: 0, subscriptionRevenueCents: 0 };
      existing.subscriptionRevenueCents = s.revenue;
      dateMap.set(s.date, existing);
    }

    return Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        purchaseRevenueCents: data.purchaseRevenueCents,
        subscriptionRevenueCents: data.subscriptionRevenueCents,
        totalRevenueCents: data.purchaseRevenueCents + data.subscriptionRevenueCents,
      }));
  }

  async getTopAudiobooks(from: Date, to: Date, limit: number): Promise<Array<{
    audiobook: Audiobook;
    salesCount: number;
    revenueCents: number;
  }>> {
    const result = await db
      .select({
        audiobook: audiobooks,
        salesCount: sql<number>`count(${audiobookPurchases.id})::int`,
        revenueCents: sql<number>`coalesce(sum(${audiobookPurchases.pricePaidCents}), 0)::int`,
      })
      .from(audiobookPurchases)
      .innerJoin(audiobooks, eq(audiobookPurchases.audiobookId, audiobooks.id))
      .where(
        and(
          eq(audiobookPurchases.status, "COMPLETED"),
          gte(audiobookPurchases.purchasedAt, from),
          lte(audiobookPurchases.purchasedAt, to)
        )
      )
      .groupBy(audiobooks.id)
      .orderBy(sql`sum(${audiobookPurchases.pricePaidCents}) desc`)
      .limit(limit);

    return result;
  }

  async getRecentTransactions(limit: number): Promise<Array<{
    id: string;
    type: 'purchase' | 'subscription';
    amount: number;
    currency: string;
    userName: string;
    userEmail: string;
    itemName: string;
    date: Date;
    status: string;
  }>> {
    const allInvoices = await db
      .select({
        id: invoices.id,
        type: invoices.type,
        amount: invoices.totalCents,
        currency: invoices.currency,
        userName: users.username,
        userEmail: users.email,
        date: invoices.issueDate,
        status: invoices.status,
        purchaseId: invoices.purchaseId,
        subscriptionId: invoices.subscriptionId,
      })
      .from(invoices)
      .innerJoin(users, eq(invoices.userId, users.id))
      .where(or(eq(invoices.status, "ISSUED"), eq(invoices.status, "PAID")))
      .orderBy(desc(invoices.issueDate))
      .limit(limit * 2);

    const purchaseIds = allInvoices.filter(i => i.purchaseId).map(i => i.purchaseId!);
    const subscriptionIds = allInvoices.filter(i => i.subscriptionId).map(i => i.subscriptionId!);

    const purchaseNames: Record<string, string> = {};
    const subscriptionNames: Record<string, string> = {};

    if (purchaseIds.length > 0) {
      const purchases = await db
        .select({
          purchaseId: audiobookPurchases.id,
          title: audiobooks.title,
        })
        .from(audiobookPurchases)
        .innerJoin(audiobooks, eq(audiobookPurchases.audiobookId, audiobooks.id))
        .where(inArray(audiobookPurchases.id, purchaseIds));
      
      for (const p of purchases) {
        purchaseNames[p.purchaseId] = p.title;
      }
    }

    if (subscriptionIds.length > 0) {
      const subs = await db
        .select({
          subId: userSubscriptions.id,
          planName: subscriptionPlans.name,
        })
        .from(userSubscriptions)
        .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(inArray(userSubscriptions.id, subscriptionIds));
      
      for (const s of subs) {
        subscriptionNames[s.subId] = s.planName;
      }
    }

    return allInvoices
      .map(inv => ({
        id: inv.id,
        type: inv.type === "PURCHASE" ? "purchase" as const : "subscription" as const,
        amount: inv.amount,
        currency: inv.currency,
        userName: inv.userName,
        userEmail: inv.userEmail,
        itemName: inv.purchaseId 
          ? purchaseNames[inv.purchaseId] || "Audiolibro" 
          : subscriptionNames[inv.subscriptionId!] || "Suscripcion",
        date: inv.date,
        status: inv.status,
      }))
      .slice(0, limit);
  }

  // RSS Feed token operations
  async getRssFeedToken(userId: string): Promise<RssFeedToken | undefined> {
    const [token] = await db.select().from(rssFeedTokens).where(eq(rssFeedTokens.userId, userId));
    return token || undefined;
  }

  async getRssFeedTokenByToken(token: string): Promise<RssFeedToken | undefined> {
    const [feedToken] = await db.select().from(rssFeedTokens).where(eq(rssFeedTokens.token, token));
    return feedToken || undefined;
  }

  async createRssFeedToken(userId: string, token: string): Promise<RssFeedToken> {
    const [feedToken] = await db
      .insert(rssFeedTokens)
      .values({ userId, token, isActive: true })
      .returning();
    return feedToken;
  }

  async regenerateRssFeedToken(userId: string, newToken: string): Promise<RssFeedToken> {
    const [feedToken] = await db
      .update(rssFeedTokens)
      .set({ token: newToken })
      .where(eq(rssFeedTokens.userId, userId))
      .returning();
    return feedToken;
  }

  async updateRssFeedTokenAccess(token: string): Promise<void> {
    await db
      .update(rssFeedTokens)
      .set({ lastAccessedAt: new Date() })
      .where(eq(rssFeedTokens.token, token));
  }

  // Shopping cart operations
  async getCartItems(userId: string): Promise<CartItemWithAudiobook[]> {
    const items = await db
      .select({
        cartItem: cartItems,
        audiobook: audiobooks,
      })
      .from(cartItems)
      .innerJoin(audiobooks, eq(cartItems.audiobookId, audiobooks.id))
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.createdAt));

    return items.map(item => ({
      ...item.cartItem,
      audiobook: item.audiobook,
    }));
  }

  async addToCart(userId: string, audiobookId: string): Promise<CartItem> {
    const [item] = await db
      .insert(cartItems)
      .values({ userId, audiobookId })
      .onConflictDoNothing()
      .returning();
    
    if (!item) {
      const [existing] = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.userId, userId), eq(cartItems.audiobookId, audiobookId)));
      return existing;
    }
    return item;
  }

  async removeFromCart(userId: string, audiobookId: string): Promise<void> {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.audiobookId, audiobookId)));
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  async isInCart(userId: string, audiobookId: string): Promise<boolean> {
    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.audiobookId, audiobookId)));
    return !!item;
  }

  async getCartTotal(userId: string): Promise<{ totalCents: number; itemCount: number; currency: string }> {
    const items = await this.getCartItems(userId);
    const totalCents = items.reduce((sum, item) => sum + item.audiobook.priceCents, 0);
    return {
      totalCents,
      itemCount: items.length,
      currency: items.length > 0 ? items[0].audiobook.currency : "EUR",
    };
  }

  // Admin customer management operations
  async getCustomersWithStats(filters?: { search?: string; role?: string; hasProfile?: boolean }): Promise<Array<{
    user: User;
    billingProfile: BillingProfile | null;
    totalPurchases: number;
    totalSpentCents: number;
    lastPurchaseAt: Date | null;
  }>> {
    let conditions: any[] = [];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(users.username, searchTerm),
          ilike(users.email, searchTerm)
        )
      );
    }
    
    if (filters?.role) {
      conditions.push(eq(users.role, filters.role as any));
    }

    let query = db.select().from(users);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const allUsers = await query.orderBy(desc(users.createdAt));

    const results = await Promise.all(allUsers.map(async (user) => {
      const [profile] = await db.select().from(billingProfiles).where(eq(billingProfiles.userId, user.id));
      
      const purchaseStats = await db
        .select({
          count: sql<number>`count(*)::int`,
          total: sql<number>`coalesce(sum(${audiobookPurchases.pricePaidCents}), 0)::int`,
          lastPurchase: sql<Date | null>`max(${audiobookPurchases.purchasedAt})`,
        })
        .from(audiobookPurchases)
        .where(and(
          eq(audiobookPurchases.userId, user.id),
          eq(audiobookPurchases.status, "COMPLETED")
        ));

      return {
        user,
        billingProfile: profile || null,
        totalPurchases: purchaseStats[0]?.count || 0,
        totalSpentCents: purchaseStats[0]?.total || 0,
        lastPurchaseAt: purchaseStats[0]?.lastPurchase || null,
      };
    }));

    if (filters?.hasProfile !== undefined) {
      return results.filter(r => filters.hasProfile ? r.billingProfile !== null : r.billingProfile === null);
    }

    return results;
  }

  async getCustomerDetail(userId: string): Promise<{
    user: User;
    billingProfile: BillingProfile | null;
    purchases: Array<AudiobookPurchase & { audiobook: Audiobook }>;
    invoices: Invoice[];
    subscription: UserSubscription | null;
    stats: { totalPurchases: number; totalSpentCents: number; lastPurchaseAt: Date | null };
  } | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;

    const [profile] = await db.select().from(billingProfiles).where(eq(billingProfiles.userId, userId));
    
    const purchasesData = await db
      .select({
        purchase: audiobookPurchases,
        audiobook: audiobooks,
      })
      .from(audiobookPurchases)
      .innerJoin(audiobooks, eq(audiobookPurchases.audiobookId, audiobooks.id))
      .where(eq(audiobookPurchases.userId, userId))
      .orderBy(desc(audiobookPurchases.createdAt));

    const userInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.issueDate));

    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);

    const completedPurchases = purchasesData.filter(p => p.purchase.status === "COMPLETED");
    const totalSpentCents = completedPurchases.reduce((sum, p) => sum + p.purchase.pricePaidCents, 0);
    const lastPurchase = completedPurchases.length > 0 ? completedPurchases[0].purchase.purchasedAt : null;

    return {
      user,
      billingProfile: profile || null,
      purchases: purchasesData.map(p => ({ ...p.purchase, audiobook: p.audiobook })),
      invoices: userInvoices,
      subscription: subscription || null,
      stats: {
        totalPurchases: completedPurchases.length,
        totalSpentCents,
        lastPurchaseAt: lastPurchase,
      },
    };
  }

  async getAllInvoicesAdmin(filters?: { search?: string; status?: string; from?: Date; to?: Date }): Promise<Array<Invoice & { user: User }>> {
    let conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(invoices.status, filters.status as any));
    }

    if (filters?.from) {
      conditions.push(gte(invoices.issueDate, filters.from));
    }

    if (filters?.to) {
      conditions.push(lte(invoices.issueDate, filters.to));
    }

    let invoicesQuery = db
      .select({
        invoice: invoices,
        user: users,
      })
      .from(invoices)
      .innerJoin(users, eq(invoices.userId, users.id));
    
    if (conditions.length > 0) {
      invoicesQuery = invoicesQuery.where(and(...conditions)) as typeof invoicesQuery;
    }
    
    const invoicesData = await invoicesQuery.orderBy(desc(invoices.issueDate));

    let results = invoicesData.map(d => ({ ...d.invoice, user: d.user }));

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(r => 
        r.invoiceNumber.toLowerCase().includes(searchLower) ||
        r.user.username.toLowerCase().includes(searchLower) ||
        r.user.email.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }

  // Delete pending purchases older than specified hours
  async deleteOldPendingPurchases(hoursOld: number = 24): Promise<{ deletedPurchases: number; deletedCartItems: number }> {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    
    // Find old pending purchases
    const oldPendingPurchases = await db
      .select()
      .from(audiobookPurchases)
      .where(
        and(
          eq(audiobookPurchases.status, 'PENDING'),
          lt(audiobookPurchases.createdAt, cutoffDate)
        )
      );
    
    let deletedPurchases = 0;
    let deletedCartItems = 0;
    
    for (const purchase of oldPendingPurchases) {
      // Delete associated cart item if exists
      const deletedCart = await db
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.userId, purchase.userId),
            eq(cartItems.audiobookId, purchase.audiobookId)
          )
        )
        .returning();
      
      deletedCartItems += deletedCart.length;
      
      // Delete the pending purchase
      await db.delete(audiobookPurchases).where(eq(audiobookPurchases.id, purchase.id));
      deletedPurchases++;
    }
    
    return { deletedPurchases, deletedCartItems };
  }

  // Delete a single pending purchase by ID
  async deletePendingPurchase(purchaseId: string): Promise<boolean> {
    const [purchase] = await db
      .select()
      .from(audiobookPurchases)
      .where(eq(audiobookPurchases.id, purchaseId));
    
    if (!purchase || purchase.status !== 'PENDING') {
      return false;
    }
    
    // Delete associated cart item if exists
    await db
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.userId, purchase.userId),
          eq(cartItems.audiobookId, purchase.audiobookId)
        )
      );
    
    // Delete the pending purchase
    await db.delete(audiobookPurchases).where(eq(audiobookPurchases.id, purchaseId));
    
    return true;
  }

  // Get purchases with filters for admin
  async getPurchasesAdmin(filters?: {
    status?: string;
    userId?: string;
    search?: string;
  }): Promise<Array<AudiobookPurchase & { user: User; audiobook: Audiobook }>> {
    const conditions: any[] = [];
    
    if (filters?.status) {
      conditions.push(eq(audiobookPurchases.status, filters.status as any));
    }
    
    if (filters?.userId) {
      conditions.push(eq(audiobookPurchases.userId, filters.userId));
    }

    let query = db
      .select({
        purchase: audiobookPurchases,
        user: users,
        audiobook: audiobooks,
      })
      .from(audiobookPurchases)
      .innerJoin(users, eq(audiobookPurchases.userId, users.id))
      .innerJoin(audiobooks, eq(audiobookPurchases.audiobookId, audiobooks.id));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const data = await query.orderBy(desc(audiobookPurchases.createdAt));

    let results = data.map(d => ({
      ...d.purchase,
      user: d.user,
      audiobook: d.audiobook,
    }));

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(r =>
        r.user.username.toLowerCase().includes(searchLower) ||
        r.user.email.toLowerCase().includes(searchLower) ||
        r.audiobook.title.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }

  // Discount code operations
  async createDiscountCode(data: InsertDiscountCode): Promise<DiscountCode> {
    const [code] = await db.insert(discountCodes).values(data).returning();
    return code;
  }

  async getDiscountCode(id: string): Promise<DiscountCode | undefined> {
    const [code] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
    return code || undefined;
  }

  async getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined> {
    const [discountCode] = await db.select().from(discountCodes).where(eq(discountCodes.code, code.toUpperCase()));
    return discountCode || undefined;
  }

  async getAllDiscountCodes(): Promise<DiscountCode[]> {
    return db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
  }

  async updateDiscountCode(id: string, data: Partial<InsertDiscountCode>): Promise<DiscountCode> {
    const [updated] = await db
      .update(discountCodes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(discountCodes.id, id))
      .returning();
    return updated;
  }

  async deleteDiscountCode(id: string): Promise<void> {
    await db.delete(discountCodeUsage).where(eq(discountCodeUsage.discountCodeId, id));
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
  }

  async incrementDiscountCodeUsage(id: string): Promise<void> {
    await db
      .update(discountCodes)
      .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
      .where(eq(discountCodes.id, id));
  }

  async getUserDiscountCodeUsageCount(discountCodeId: string, userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(discountCodeUsage)
      .where(and(
        eq(discountCodeUsage.discountCodeId, discountCodeId),
        eq(discountCodeUsage.userId, userId)
      ));
    return Number(result[0]?.count || 0);
  }

  async validateDiscountCode(
    code: string,
    userId: string,
    totalCents: number,
    forSubscription: boolean
  ): Promise<{ valid: boolean; discountCode?: DiscountCode; error?: string }> {
    const discountCode = await this.getDiscountCodeByCode(code);
    
    if (!discountCode) {
      return { valid: false, error: "Codigo de descuento no encontrado" };
    }
    
    if (!discountCode.isActive) {
      return { valid: false, error: "Este codigo de descuento no esta activo" };
    }
    
    const now = new Date();
    if (discountCode.validFrom && now < discountCode.validFrom) {
      return { valid: false, error: "Este codigo de descuento aun no es valido" };
    }
    
    if (discountCode.validUntil && now > discountCode.validUntil) {
      return { valid: false, error: "Este codigo de descuento ha expirado" };
    }
    
    if (discountCode.maxUsesTotal && discountCode.usedCount >= discountCode.maxUsesTotal) {
      return { valid: false, error: "Este codigo de descuento ha alcanzado su limite de usos" };
    }
    
    if (forSubscription && !discountCode.appliesToSubscriptions) {
      return { valid: false, error: "Este codigo no aplica a suscripciones" };
    }
    
    if (!forSubscription && !discountCode.appliesToPurchases) {
      return { valid: false, error: "Este codigo no aplica a compras individuales" };
    }
    
    if (discountCode.minPurchaseCents && totalCents < discountCode.minPurchaseCents) {
      return { 
        valid: false, 
        error: `El monto minimo de compra es ${(discountCode.minPurchaseCents / 100).toFixed(2)} EUR` 
      };
    }
    
    if (discountCode.maxUsesPerUser) {
      const userUsageCount = await this.getUserDiscountCodeUsageCount(discountCode.id, userId);
      if (userUsageCount >= discountCode.maxUsesPerUser) {
        return { valid: false, error: "Ya has usado este codigo el numero maximo de veces" };
      }
    }
    
    return { valid: true, discountCode };
  }

  async recordDiscountCodeUsage(
    discountCodeId: string,
    userId: string,
    purchaseId: string | null,
    discountAmountCents: number
  ): Promise<DiscountCodeUsage> {
    const [usage] = await db
      .insert(discountCodeUsage)
      .values({
        discountCodeId,
        userId,
        purchaseId,
        discountAmountCents,
      })
      .returning();
    
    await this.incrementDiscountCodeUsage(discountCodeId);
    
    return usage;
  }

  // External services operations
  async getExternalServices(): Promise<ExternalService[]> {
    return await db
      .select()
      .from(externalServices)
      .where(eq(externalServices.isActive, true))
      .orderBy(externalServices.sortOrder);
  }

  async getExternalService(id: string): Promise<ExternalService | undefined> {
    const [service] = await db
      .select()
      .from(externalServices)
      .where(eq(externalServices.id, id));
    return service || undefined;
  }

  async createExternalService(service: InsertExternalService): Promise<ExternalService> {
    const [created] = await db
      .insert(externalServices)
      .values(service)
      .returning();
    return created;
  }

  async updateExternalService(id: string, data: Partial<InsertExternalService>): Promise<ExternalService> {
    const [updated] = await db
      .update(externalServices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(externalServices.id, id))
      .returning();
    return updated;
  }

  async deleteExternalService(id: string): Promise<void> {
    await db.delete(externalServices).where(eq(externalServices.id, id));
  }
}

export const storage = new DatabaseStorage();
