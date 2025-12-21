# Design Guidelines: Audivia - Premium Audiobook Platform

## Design Approach
**Reference-Based**: Drawing from Audible (audiobook discovery), Spotify (audio player excellence), Apple Books (premium reading/listening), and Netflix (content-forward catalog). This platform combines e-commerce, subscription service, and immersive media playback in a luxury-positioned experience.

## Core Design Principles
- **Premium Positioning**: Sophisticated layouts with generous whitespace, elevated visual hierarchy
- **Content Showcase**: Book covers as primary visual anchors, hero imagery establishing tone
- **Listening Sanctuary**: Distraction-free player experience with focus on immersion
- **Mobile-First Audio**: Optimized for commute listening with one-handed navigation

---

## Typography
**Primary Font**: Cormorant Garamond (Google Fonts) - elegant serif for headings, literary sophistication
**Body Font**: Inter (Google Fonts) - crisp sans-serif for readability, UI elements

**Hierarchy**:
- Page Titles: text-5xl md:text-6xl font-bold (Cormorant Garamond)
- Book Titles: text-2xl md:text-3xl font-semibold (Cormorant Garamond)
- Author Names: text-lg font-medium tracking-wide uppercase (Inter)
- Chapter/Metadata: text-sm font-normal (Inter)
- Body Content: text-base leading-relaxed (Inter)

---

## Layout System
**Spacing Primitives**: Tailwind units **4, 6, 8, 12, 16, 24, 32**
- Compact (p-4, gap-4): Card internals, tight groupings
- Standard (p-6, p-8): Component padding, vertical rhythm
- Generous (p-12, p-16, p-24): Section dividers, hero spacing
- Luxurious (p-32): Major section breaks, landing page drama

**Containers**:
- Max width: max-w-7xl for main content areas
- Reading-optimized: max-w-3xl for description text
- Full-bleed sections: w-full for hero, featured collections

---

## Component Library

### 1. Immersive Audio Player (Priority Component)
**Full-Screen Mode**: Takes over viewport during active playback
- Top third: Book cover (large, centered, subtle shadow)
- Middle: Progress bar with chapter markers, time stamps
- Bottom: Controls (previous chapter, 15s back, play/pause, 15s forward, next chapter)
- Expanded info: Title, author, current chapter name
- Minimize button returns to mini-player

**Mini Player** (Sticky Bottom): h-20 fixed bar
- Left: Thumbnail cover (w-16 h-16), title/author truncated
- Center: Play/pause, progress indicator
- Right: Expand button, playback speed, add to library

**Controls**: Large touch targets (w-16 h-16 minimum), clear visual feedback

### 2. Hero Section (Landing/Browse Pages)
**Layout**: Full-width, h-[75vh] on desktop, h-[60vh] mobile
- Background: High-quality image of person reading/listening in sophisticated setting (library, commute, nature)
- Overlay: Gradient from transparent to solid at bottom for text legibility
- Content: Centered headline (max-w-3xl), subheadline, dual CTA buttons
- Buttons: Blurred background (backdrop-blur-md), large (px-8 py-4), "Start Free Trial" + "Browse Catalog"

### 3. Book Cover Grid
**Layouts**:
- Featured Row: Horizontal scroll (scrollbar-hide), large covers (w-48 h-72)
- Catalog Grid: grid-cols-2 md:grid-cols-4 lg:grid-cols-6, responsive sizing
- Cover aspect: 2:3 portrait, rounded-lg with subtle shadow
- Hover: Transform scale-105 transition, elevated shadow

### 4. Book Detail Card
**Expanded View**: max-w-5xl layout
- Left column (md:w-2/5): Large cover image, "Play Sample" button, purchase/subscribe CTAs
- Right column: Title, author, narrator, duration, genre tags, description (text-base leading-relaxed), chapter list preview
- Sticky purchase bar on mobile: Fixed bottom with price/subscribe options

### 5. Navigation
**Desktop**: Top bar with logo left, search center (max-w-xl), Browse/Library/Account right
**Mobile**: Bottom tab bar (fixed) - Home, Browse, Library, Player, Profile
- Icons with labels, active state with indicator line/fill

### 6. Collection Carousels
**Sections**: "Continue Listening", "Bestsellers", "New Releases", "Recommended for You"
- Horizontal scroll cards (snap-scroll behavior)
- Card: Cover + title + author, progress indicator for continue listening
- "See All" link at section end

### 7. Subscription Tiers (Pricing Page)
**Layout**: Three-column grid on desktop (grid-cols-1 md:grid-cols-3)
- Cards: Elevated with border, featured tier has enhanced shadow
- Content: Tier name, price (text-4xl), feature list with checkmarks, CTA button
- Annual toggle switch above cards showing savings

### 8. Search & Filters
**Search Bar**: Prominent, rounded-full with icon, autocomplete dropdown with cover thumbnails
**Filters**: Sidebar (md:w-64) or modal on mobile - Genre, Duration, Narrator, Price range
- Tag-based selections with remove icons

---

## Icons
**Library**: Heroicons (outline standard, solid for active states)
- Play/Pause: Play circle, pause circle
- Navigation: Home, book open, library (bookshelf), user circle
- Player: Backward 15s, forward 15s, speed meter, bookmark
- Commerce: Shopping bag, star (ratings)

---

## Images

**Hero Image**: Required full-width hero on landing page
- Subject: Sophisticated listener in premium environment (leather chair with books, minimalist headphones, warm lighting)
- Treatment: Professional photography, shallow depth of field
- Dimensions: 1920x1080 minimum, optimized for web
- Placement: Top of landing page, text overlay at center-bottom

**Book Covers**: Primary visual element throughout
- Source: Publisher-provided artwork
- Fallback: Gradient with title typography if unavailable
- Always maintain 2:3 aspect ratio

**Category Headers**: Full-width images (h-64) for genre pages
- Examples: Library interior for Classics, city transit for Business, fantasy landscapes
- Subtle overlay ensuring text readability

---

## Data Visualization
**Library Stats**: Personal listening dashboard
- Total hours listened: Large metric display (text-6xl)
- Books completed: Progress rings
- Listening streak: Calendar heatmap
- Top genres: Horizontal bar chart

---

## Forms
**Purchase Flow**: Single-page checkout (max-w-2xl)
- Payment method cards with icons
- Order summary sidebar (sticky on desktop)
- Large confirm button (w-full, py-4)

**Review Submission**: Star rating (large, interactive stars), textarea for review text, audio snippet upload option

---

## Animations
**Minimal, Purposeful**:
- Book cover scale on hover (scale-105)
- Player controls pulse on interaction
- Search autocomplete fade-in
- NO page transitions, NO parallax scrolling

---

## Accessibility
- Player: Full keyboard control (space play/pause, arrow keys seek, numbers for chapter selection)
- Focus indicators: Prominent ring on all interactive elements
- Skip navigation links for screen readers
- Captions available for promotional video content

---

## Responsive Strategy
- Mobile (base): Single column, bottom navigation, swipe gestures for player
- Tablet (md:768px): Two-column grids, sidebar filters, expanded mini-player
- Desktop (lg:1024px): Multi-column layouts, hover states active, persistent sidebars

This framework creates a premium audiobook experience balancing content discovery, seamless purchasing, and immersive playback.