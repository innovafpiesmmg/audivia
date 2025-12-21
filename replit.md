# Audivia - Premium Audiobook Platform

## Overview
Audivia is a premium audiobook platform featuring two monetization models: individual audiobook purchases (one-time payment) and monthly subscriptions for full catalog access. The platform emphasizes a mobile-optimized, immersive audio experience with sophisticated design using deep purple/indigo color scheme with gold accents to convey luxury. Target audience includes book lovers and commuters preferring audio content.

## Recent Changes (December 2024)
- **Platform Transformation**: Converted from podcast platform (PodcastHub) to premium audiobook platform (Audivia)
- **Database Schema**: Added new tables: audiobooks, chapters, subscription_plans, user_subscriptions, audiobook_purchases, favorites, listening_progress
- **Monetization Models**: Implemented dual purchase system (individual purchases + subscriptions)
- **Design System**: Updated to premium Audivia theme with:
  - Primary: Deep purple/indigo (HSL 260° 65% 50-60%)
  - Accent: Gold (HSL 45° 90% 55%)
  - Typography: Cormorant Garamond (serif) for headings, Inter (sans-serif) for body
- **Frontend Pages**: Created new audiobook-detail, chapter-player, explore, library pages with audiobook model
- **API Routes**: Added /api/audiobooks, /api/chapters, /api/library/favorites, /api/library/purchases endpoints
- **Admin Pages**: Created admin-audiobooks and admin-chapters management pages
- **Email System**: Updated all email templates to Audivia branding (purple #7C3AED)
- **Invoice Emails**: Added automatic invoice and purchase confirmation emails after PayPal payments
  - Invoice PDFs generated and attached to emails when billing profile exists
  - Fallback reference ID (REF-{purchaseId}) for customers without billing profile
  - Individual error handling per email to prevent one failure from blocking others
- **Invoice Generation**: Transactional creation of invoices with line items for data integrity

## User Preferences
- Preferred communication style: Simple, everyday language
- Stripe integration: Deferred - will need manual configuration with API keys later

## System Architecture

### UI/UX Decisions
- **Design Philosophy**: Premium, luxury positioning with elegant typography and sophisticated color palette
- **Color Scheme**: Deep purple/indigo (#7C3AED to #4F46E5) with gold accents (#EAB308)
- **Typography Hierarchy**: Cormorant Garamond (serif) for headings conveys literary sophistication, Inter (sans-serif) for body ensures readability
- **Frontend**: React (Vite), Wouter for routing, TanStack Query for state, shadcn/ui with Tailwind CSS
- **Theme Support**: Dark mode default with light mode support, optimized for audiobook consumption

### Technical Implementations
- **Frontend**: React (Vite), Wouter routing, TanStack Query, shadcn/ui, Tailwind CSS
- **Backend**: Express.js (Node.js), RESTful API, Zod validation
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Session-based with PostgreSQL store, bcryptjs passwords, three-tier roles (ADMIN, CREATOR/PUBLISHER, LISTENER)

### Data Model (Audiobook-focused)
```
Users → UserSubscriptions → SubscriptionPlans
     → AudiobookPurchases → Audiobooks
     → Favorites → Audiobooks
     → ListeningProgress → Audiobooks/Chapters

Audiobooks → Chapters (ordered by chapterNumber)
          → Publisher (User)
          → Purchases
          → Favorites

Playlists → PlaylistChapters → Chapters
```

### Access Control Logic
- **Free audiobooks**: Accessible to all users
- **Paid audiobooks**: Require one of:
  - Individual purchase completion
  - Active subscription
  - Publisher/Admin access

### Key Features
- **Audiobook Catalog**: Browse, search, filter by category/price
- **Chapter Playback**: Full audio player with progress tracking, skip controls
- **Library Management**: Favorites, purchases, subscription access
- **Subscription System**: Monthly plans with Stripe integration (to be configured)
- **Purchase System**: Individual audiobook purchases with Stripe (to be configured)
- **Progress Tracking**: Resume playback, chapter completion status
- **Admin Panel**: Audiobook/chapter management, user administration

## External Dependencies
- **Database**: Neon Database (PostgreSQL serverless)
- **Fonts**: Google Fonts (Cormorant Garamond, Inter)
- **Payments**: Stripe (requires manual API key configuration)
- **UI**: Radix UI, Lucide React, shadcn/ui
- **Audio**: HTML5 Audio API with custom player controls

## TODO / Future Work
- [ ] Configure Stripe integration with API keys (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET)
- [ ] Implement subscription checkout flow
- [ ] Implement individual purchase checkout flow
- [ ] Add audiobook creation/upload interface for publishers
- [ ] Implement chapter upload with audio file handling
- [ ] Add subscription management (cancel, upgrade, billing history)
- [ ] Implement sample chapter preview for non-purchased audiobooks
- [ ] Add ratings and reviews system
- [ ] Implement search with full-text search capabilities
- [ ] Add offline download capability (future enhancement)

## Legacy Compatibility
The codebase maintains backward compatibility with the original podcast platform through type aliases in shared/schema.ts:
- Podcast = Audiobook
- Episode = Chapter
- insertPodcastSchema = insertAudiobookSchema
- insertEpisodeSchema = insertChapterSchema

This allows gradual migration of existing podcast-focused code while new features use audiobook terminology.
