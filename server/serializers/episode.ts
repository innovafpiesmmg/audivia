import type { Episode, Podcast, MediaAsset } from "@shared/schema";

/**
 * Resolves the effective cover art for an episode.
 * Falls back to podcast cover art if episode doesn't have its own.
 */
export function resolveEpisodeArtwork(
  episode: Episode,
  podcast: Podcast
): { coverArtUrl: string | null; coverArtAssetId: string | null } {
  return {
    coverArtUrl: episode.coverArtUrl || podcast.coverArtUrl,
    coverArtAssetId: episode.coverArtAssetId || podcast.coverArtAssetId,
  };
}

/**
 * Resolves the audio URL for an episode.
 * If episode has audioAssetId but no audioUrl, generates URL from the asset.
 */
export function resolveEpisodeAudioUrl(
  episode: Episode,
  audioAsset?: MediaAsset | null
): string | null {
  // If episode already has audioUrl, use it
  if (episode.audioUrl) {
    return episode.audioUrl;
  }
  
  // If episode has audioAssetId and we have the asset, use its publicUrl
  if (episode.audioAssetId && audioAsset) {
    return audioAsset.publicUrl;
  }
  
  return null;
}

/**
 * Enriches an episode with effective cover art from its podcast.
 * Useful for API responses where clients need the resolved artwork.
 */
export function enrichEpisodeWithArtwork<T extends Episode>(
  episode: T,
  podcast: Podcast
): T & { effectiveCoverArtUrl: string | null; effectiveCoverArtAssetId: string | null } {
  const { coverArtUrl, coverArtAssetId } = resolveEpisodeArtwork(episode, podcast);
  return {
    ...episode,
    effectiveCoverArtUrl: coverArtUrl,
    effectiveCoverArtAssetId: coverArtAssetId,
  };
}

/**
 * Resolves the cover art URL for a podcast.
 * If podcast has coverArtAssetId but no coverArtUrl, generates URL from the asset.
 */
export function resolvePodcastCoverArtUrl(
  podcast: Podcast,
  coverArtAsset?: MediaAsset | null
): string | null {
  // If podcast already has coverArtUrl, use it
  if (podcast.coverArtUrl) {
    return podcast.coverArtUrl;
  }
  
  // If podcast has coverArtAssetId and we have the asset, use its publicUrl
  if (podcast.coverArtAssetId && coverArtAsset) {
    return coverArtAsset.publicUrl;
  }
  
  return null;
}
