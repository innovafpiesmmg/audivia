CREATE TYPE "public"."content_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."media_asset_type" AS ENUM('COVER_ART', 'CHAPTER_AUDIO', 'SAMPLE_AUDIO');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('PENDING', 'COMPLETED', 'REFUNDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('LOCAL', 'GOOGLE_DRIVE');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('LISTENER', 'CREATOR', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('PRIVATE', 'UNLISTED', 'PUBLIC');--> statement-breakpoint
CREATE TABLE "audiobook_purchases" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"audiobook_id" varchar(36) NOT NULL,
	"price_paid_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"status" "purchase_status" DEFAULT 'PENDING' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_session_id" text,
	"purchased_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audiobooks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"narrator" text,
	"description" text NOT NULL,
	"cover_art_url" text,
	"cover_art_asset_id" varchar(36),
	"category" text DEFAULT 'Fiction' NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"sample_chapter_id" varchar(36),
	"total_duration" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'APPROVED' NOT NULL,
	"visibility" "visibility" DEFAULT 'PUBLIC' NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"amazon_ebook_url" text,
	"amazon_print_url" text,
	"publisher_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"approved_at" timestamp,
	"approved_by" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"chapter_number" integer DEFAULT 1 NOT NULL,
	"description" text,
	"cover_art_url" text,
	"cover_art_asset_id" varchar(36),
	"audio_url" text,
	"audio_asset_id" varchar(36),
	"audio_file_size" integer,
	"duration" integer DEFAULT 0 NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"status" "content_status" DEFAULT 'APPROVED' NOT NULL,
	"visibility" "visibility" DEFAULT 'PUBLIC' NOT NULL,
	"audiobook_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"approved_by" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "drive_config" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_account_email" text NOT NULL,
	"service_account_key" text NOT NULL,
	"folder_id_images" text NOT NULL,
	"folder_id_audio" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_config" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"smtp_user" text NOT NULL,
	"smtp_password" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text DEFAULT 'Audivia' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"audiobook_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listening_progress" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"audiobook_id" varchar(36) NOT NULL,
	"chapter_id" varchar(36) NOT NULL,
	"position_seconds" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar(36) NOT NULL,
	"audiobook_id" varchar(36),
	"chapter_id" varchar(36),
	"type" "media_asset_type" NOT NULL,
	"storage_provider" "storage_provider" DEFAULT 'LOCAL' NOT NULL,
	"storage_key" text NOT NULL,
	"public_url" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"status" "content_status" DEFAULT 'APPROVED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "playlist_chapters" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" varchar(36) NOT NULL,
	"chapter_id" varchar(36) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" varchar(36) NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" text NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_config" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publishable_key" text,
	"webhook_secret" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"interval_months" integer DEFAULT 1 NOT NULL,
	"stripe_price_id" text,
	"stripe_product_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"plan_id" varchar(36) NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"stripe_subscription_id" text,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'LISTENER' NOT NULL,
	"bio" text,
	"avatar_url" text,
	"website" text,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" text,
	"email_verification_token_expires_at" timestamp,
	"stripe_customer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audiobook_purchases" ADD CONSTRAINT "audiobook_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiobook_purchases" ADD CONSTRAINT "audiobook_purchases_audiobook_id_audiobooks_id_fk" FOREIGN KEY ("audiobook_id") REFERENCES "public"."audiobooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiobooks" ADD CONSTRAINT "audiobooks_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiobooks" ADD CONSTRAINT "audiobooks_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_audiobook_id_audiobooks_id_fk" FOREIGN KEY ("audiobook_id") REFERENCES "public"."audiobooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_audiobook_id_audiobooks_id_fk" FOREIGN KEY ("audiobook_id") REFERENCES "public"."audiobooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_progress" ADD CONSTRAINT "listening_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_progress" ADD CONSTRAINT "listening_progress_audiobook_id_audiobooks_id_fk" FOREIGN KEY ("audiobook_id") REFERENCES "public"."audiobooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_progress" ADD CONSTRAINT "listening_progress_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_audiobook_id_audiobooks_id_fk" FOREIGN KEY ("audiobook_id") REFERENCES "public"."audiobooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_chapters" ADD CONSTRAINT "playlist_chapters_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_chapters" ADD CONSTRAINT "playlist_chapters_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;