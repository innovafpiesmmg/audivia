/**
 * URL generation helpers for episodes and podcasts
 * Ensures consistent URL generation across the application
 */

import type { Request } from "express";

/**
 * Get the base site URL from request headers
 * @param req Express request object
 * @returns Base site URL (e.g., "https://example.com")
 */
export function getSiteUrl(req: Request): string {
  const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const host = req.get("host") || "localhost:5000";
  return `${protocol}://${host}`;
}

/**
 * Generate canonical URL for an episode
 * @param siteUrl Base site URL
 * @param podcastId Podcast ID (not used but kept for backwards compatibility)
 * @param episodeId Episode ID
 * @returns Canonical episode URL pointing to dedicated episode page (e.g., "/episode/xyz")
 */
export function getEpisodeCanonicalUrl(siteUrl: string, podcastId: string, episodeId: string): string {
  return `${siteUrl}/episode/${episodeId}`;
}

/**
 * Generate embed URL for an episode
 * @param siteUrl Base site URL
 * @param episodeId Episode ID
 * @returns Embed URL (e.g., "/embed/episode/xyz")
 */
export function getEpisodeEmbedUrl(siteUrl: string, episodeId: string): string {
  return `${siteUrl}/embed/episode/${episodeId}`;
}

/**
 * Generate share URL for an episode (same as canonical for now)
 * @param siteUrl Base site URL
 * @param podcastId Podcast ID
 * @param episodeId Episode ID
 * @returns Share URL
 */
export function getEpisodeShareUrl(siteUrl: string, podcastId: string, episodeId: string): string {
  return getEpisodeCanonicalUrl(siteUrl, podcastId, episodeId);
}

/**
 * Escape HTML entities for safe rendering in HTML attributes
 * @param str String to escape
 * @returns Escaped string
 */
function escapeHtmlAttribute(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate embed iframe code snippet
 * @param embedUrl Full embed URL (should already be safe)
 * @param episodeTitle Episode title for iframe title attribute
 * @returns HTML iframe snippet with escaped attributes
 */
export function getEmbedIframeCode(embedUrl: string, episodeTitle: string): string {
  const safeTitle = escapeHtmlAttribute(episodeTitle);
  const safeUrl = escapeHtmlAttribute(embedUrl);
  return `<iframe src="${safeUrl}" width="100%" height="200" frameborder="0" allow="autoplay; clipboard-write" loading="lazy" title="${safeTitle}"></iframe>`;
}

/**
 * Generate podcast page URL
 * @param siteUrl Base site URL
 * @param podcastId Podcast ID
 * @returns Podcast page URL (e.g., "/podcast/xyz")
 */
export function getPodcastUrl(siteUrl: string, podcastId: string): string {
  return `${siteUrl}/podcast/${podcastId}`;
}

/**
 * Generate RSS feed URL for a podcast
 * @param siteUrl Base site URL
 * @param podcastId Podcast ID
 * @returns RSS feed URL (e.g., "/api/podcasts/xyz/rss")
 */
export function getPodcastRSSUrl(siteUrl: string, podcastId: string): string {
  return `${siteUrl}/api/podcasts/${podcastId}/rss`;
}
