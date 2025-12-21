import { StorageService, UploadMetadata } from "./storage-service";
import { storage } from "./storage";
import { MediaAsset } from "@shared/schema";

export class MediaOrchestrator {
  private storageService: StorageService | null = null;
  private lastConfigCheck: number = 0;
  private configCheckInterval: number = 5000; // Re-check config every 5 seconds

  private async getStorageService(): Promise<StorageService> {
    const now = Date.now();
    
    // Re-check config periodically to detect admin changes
    if (this.storageService && (now - this.lastConfigCheck) < this.configCheckInterval) {
      return this.storageService;
    }

    this.lastConfigCheck = now;
    const driveConfig = await storage.getActiveDriveConfig();
    this.storageService = await StorageService.createFromConfig(driveConfig || undefined);
    return this.storageService;
  }

  async saveCoverArt(file: Express.Multer.File, ownerId: string, podcastId?: string): Promise<MediaAsset> {
    const storageService = await this.getStorageService();
    
    // 1. Upload file using storage adapter - returns lightweight metadata
    const uploadMetadata: UploadMetadata = await storageService.saveCoverArt(file, ownerId, podcastId);

    try {
      // 2. Persist exact metadata in database - DB generates id and createdAt
      const savedAsset = await storage.createMediaAsset(uploadMetadata);

      return savedAsset;
    } catch (dbError) {
      // If database operation fails, compensate by deleting the uploaded file
      console.error("Database operation failed, cleaning up uploaded file:", dbError);

      // Delete the file that was successfully uploaded before the DB failure
      try {
        await storageService.deleteAsset(uploadMetadata);
      } catch (cleanupError) {
        console.error("Cleanup also failed:", cleanupError);
      }

      throw dbError;
    }
  }

  async saveEpisodeAudio(file: Express.Multer.File, ownerId: string, episodeId?: string, podcastId?: string): Promise<MediaAsset> {
    const storageService = await this.getStorageService();
    
    // 1. Upload file using storage adapter - returns lightweight metadata
    const uploadMetadata: UploadMetadata = await storageService.saveEpisodeAudio(file, ownerId, episodeId, podcastId);

    try {
      // 2. Persist exact metadata in database - DB generates id and createdAt
      const savedAsset = await storage.createMediaAsset(uploadMetadata);

      return savedAsset;
    } catch (dbError) {
      // If database operation fails, compensate by deleting the uploaded file
      console.error("Database operation failed, cleaning up uploaded file:", dbError);

      // Delete the file that was successfully uploaded before the DB failure
      try {
        await storageService.deleteAsset(uploadMetadata);
      } catch (cleanupError) {
        console.error("Cleanup also failed:", cleanupError);
      }

      throw dbError;
    }
  }

  async getMediaAsset(assetId: string): Promise<MediaAsset | undefined> {
    return await storage.getMediaAsset(assetId);
  }

  async streamMedia(assetId: string): Promise<{ asset: MediaAsset; stream: NodeJS.ReadableStream }> {
    const asset = await storage.getMediaAsset(assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }

    const storageService = await this.getStorageService();
    const stream = await storageService.streamAsset(asset);

    return { asset, stream };
  }

  async deleteMediaAsset(assetId: string): Promise<void> {
    const asset = await storage.getMediaAsset(assetId);
    if (!asset) {
      return; // Asset doesn't exist, nothing to delete
    }

    try {
      // 1. Delete from storage provider
      const storageService = await this.getStorageService();
      await storageService.deleteAsset(asset);
    } catch (storageError) {
      console.error("Failed to delete file from storage:", storageError);
      // Continue with DB deletion even if storage deletion fails
    }

    // 2. Delete metadata from database
    await storage.deleteMediaAsset(assetId);
  }

  // Clear the cached storage service (useful when drive config changes)
  clearCache(): void {
    this.storageService = null;
  }
}

export const mediaOrchestrator = new MediaOrchestrator();
