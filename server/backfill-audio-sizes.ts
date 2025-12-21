/**
 * Backfill script to populate audioFileSize for existing episodes
 * Fetches Content-Length from audio URLs via HEAD requests
 */

import { db } from "./db";
import { episodes } from "@shared/schema";
import { isNull, eq } from "drizzle-orm";

async function fetchAudioFileSize(audioUrl: string): Promise<number | null> {
  try {
    const response = await fetch(audioUrl, { method: "HEAD" });
    const contentLength = response.headers.get("content-length");
    
    if (contentLength && !isNaN(parseInt(contentLength))) {
      return parseInt(contentLength);
    }
    
    console.warn(`No Content-Length header for ${audioUrl}`);
    return null;
  } catch (error) {
    console.error(`Failed to fetch size for ${audioUrl}:`, error);
    return null;
  }
}

export async function backfillAudioFileSizes() {
  console.log("Starting audioFileSize backfill...");
  
  // Get all episodes without audioFileSize
  const episodesWithoutSize = await db
    .select()
    .from(episodes)
    .where(isNull(episodes.audioFileSize));
  
  console.log(`Found ${episodesWithoutSize.length} episodes without audioFileSize`);
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const episode of episodesWithoutSize) {
    console.log(`Fetching size for episode ${episode.id}: ${episode.title}`);
    
    const fileSize = await fetchAudioFileSize(episode.audioUrl);
    
    if (fileSize !== null) {
      await db
        .update(episodes)
        .set({ audioFileSize: fileSize })
        .where(eq(episodes.id, episode.id));
      
      console.log(`✓ Updated episode ${episode.id} with size ${fileSize} bytes`);
      successCount++;
    } else {
      console.error(`✗ Failed to get size for episode ${episode.id}`);
      failureCount++;
    }
    
    // Small delay to avoid overwhelming servers
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\nBackfill complete:`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failures: ${failureCount}`);
  console.log(`  Total: ${episodesWithoutSize.length}`);
  
  return { successCount, failureCount, total: episodesWithoutSize.length };
}

// Run backfill if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillAudioFileSizes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Backfill failed:", error);
      process.exit(1);
    });
}
