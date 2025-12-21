import type { Podcast, Episode, User } from "@shared/schema";

export interface EpisodeForRSS extends Episode {
  effectiveCoverArtUrl: string | null;
  effectiveCoverArtAssetId: string | null;
}

export interface PodcastForRSS extends Podcast {
  owner: User;
  episodes: EpisodeForRSS[];
}

/**
 * Escapes XML special characters
 */
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Formats a date to RFC 822 format (required for RSS)
 */
function formatRFC822Date(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Use UTC methods to ensure correct timezone
  const day = days[date.getUTCDay()];
  const dayNum = String(date.getUTCDate()).padStart(2, "0");
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  
  return `${day}, ${dayNum} ${month} ${year} ${hours}:${minutes}:${seconds} +0000`;
}

/**
 * Formats duration in seconds to HH:MM:SS format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Generates RSS 2.0 feed XML with iTunes extensions
 */
export function generateRSSFeed(podcast: PodcastForRSS, feedUrl: string, siteUrl: string): string {
  const { owner, episodes } = podcast;
  
  const podcastLink = `${siteUrl}/podcast/${podcast.id}`;
  const lastBuildDate = episodes.length > 0 
    ? formatRFC822Date(new Date(episodes[0].publishedAt))
    : formatRFC822Date(new Date());
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(podcast.title)}</title>
    <link>${escapeXml(podcastLink)}</link>
    <description>${escapeXml(podcast.description)}</description>
    <language>${escapeXml(podcast.language)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <managingEditor>${escapeXml(owner.email)} (${escapeXml(owner.username)})</managingEditor>
    <webMaster>${escapeXml(owner.email)} (${escapeXml(owner.username)})</webMaster>
    
    <!-- iTunes Tags -->
    <itunes:author>${escapeXml(owner.username)}</itunes:author>
    <itunes:summary>${escapeXml(podcast.description)}</itunes:summary>
    <itunes:owner>
      <itunes:name>${escapeXml(owner.username)}</itunes:name>
      <itunes:email>${escapeXml(owner.email)}</itunes:email>
    </itunes:owner>`;
  
  if (podcast.coverArtUrl) {
    xml += `
    <itunes:image href="${escapeXml(podcast.coverArtUrl)}" />
    <image>
      <url>${escapeXml(podcast.coverArtUrl)}</url>
      <title>${escapeXml(podcast.title)}</title>
      <link>${escapeXml(podcastLink)}</link>
    </image>`;
  }
  
  xml += `
    <itunes:category text="${escapeXml(podcast.category)}" />
    <itunes:explicit>no</itunes:explicit>
    
`;
  
  // Add episodes
  for (const episode of episodes) {
    const episodeLink = `${siteUrl}/podcast/${podcast.id}#episode-${episode.id}`;
    const pubDate = formatRFC822Date(new Date(episode.publishedAt));
    const duration = formatDuration(episode.duration);
    
    xml += `    <item>
      <title>${escapeXml(episode.title)}</title>
      <link>${escapeXml(episodeLink)}</link>
      <description>${escapeXml(episode.notes)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(episodeLink)}</guid>
      <enclosure url="${escapeXml(episode.audioUrl)}" type="audio/mpeg" length="${episode.audioFileSize}" />`;
    
    // Add episode cover art if available (with fallback to podcast cover)
    if (episode.effectiveCoverArtUrl) {
      xml += `
      <itunes:image href="${escapeXml(episode.effectiveCoverArtUrl)}" />`;
    }
    
    xml += `
      
      <!-- iTunes Episode Tags -->
      <itunes:title>${escapeXml(episode.title)}</itunes:title>
      <itunes:summary>${escapeXml(episode.notes)}</itunes:summary>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:explicit>no</itunes:explicit>
    </item>
`;
  }
  
  xml += `  </channel>
</rss>`;
  
  return xml;
}
