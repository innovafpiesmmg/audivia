import { google } from 'googleapis';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { mediaOrchestrator } from './media-orchestrator';

const execAsync = promisify(exec);

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY || '',
});

export interface PlaylistMetadata {
  playlistId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl?: string;
  videoCount: number;
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  duration: number;
  thumbnailUrl?: string;
  publishedAt: Date;
}

export async function getPlaylistMetadata(playlistUrl: string): Promise<PlaylistMetadata> {
  const playlistId = extractPlaylistId(playlistUrl);
  
  if (!playlistId) {
    throw new Error('URL de playlist de YouTube inválida');
  }

  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY no configurada. Por favor configura esta variable de entorno.');
  }

  try {
    const response = await youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      id: [playlistId],
    });

    const playlist = response.data.items?.[0];
    if (!playlist) {
      throw new Error('Playlist no encontrada');
    }

    return {
      playlistId,
      title: playlist.snippet?.title || 'Playlist sin título',
      description: playlist.snippet?.description || '',
      channelTitle: playlist.snippet?.channelTitle || 'Canal desconocido',
      thumbnailUrl: playlist.snippet?.thumbnails?.high?.url || playlist.snippet?.thumbnails?.default?.url || undefined,
      videoCount: playlist.contentDetails?.itemCount || 0,
    };
  } catch (error: any) {
    if (error.code === 403 || error.code === 400) {
      throw new Error('API Key de YouTube inválida o sin permisos. Verifica tu configuración.');
    }
    throw new Error(`Error al obtener metadatos de la playlist: ${error.message}`);
  }
}

export async function getPlaylistVideos(playlistId: string, maxResults: number = 50): Promise<VideoMetadata[]> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY no configurada');
  }

  const videos: VideoMetadata[] = [];
  let nextPageToken: string | undefined;

  try {
    do {
      const response = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId,
        maxResults: Math.min(50, maxResults - videos.length),
        pageToken: nextPageToken,
      });

      const items = response.data.items || [];
      
      for (const item of items) {
        const videoId = item.contentDetails?.videoId;
        if (!videoId) continue;

        videos.push({
          videoId,
          title: item.snippet?.title || 'Video sin título',
          description: item.snippet?.description || '',
          duration: 0, // Will be filled with actual duration
          thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || undefined,
          publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : new Date(),
        });
      }

      nextPageToken = response.data.nextPageToken || undefined;
    } while (nextPageToken && videos.length < maxResults);

    // Get actual durations for all videos
    if (videos.length > 0) {
      const videoIds = videos.map(v => v.videoId);
      const detailsResponse = await youtube.videos.list({
        part: ['contentDetails'],
        id: videoIds,
      });

      const durations = new Map<string, number>();
      for (const video of detailsResponse.data.items || []) {
        if (video.id && video.contentDetails?.duration) {
          durations.set(video.id, parseDuration(video.contentDetails.duration));
        }
      }

      videos.forEach(video => {
        video.duration = durations.get(video.videoId) || 0;
      });
    }

    return videos;
  } catch (error: any) {
    throw new Error(`Error al obtener videos de la playlist: ${error.message}`);
  }
}

export async function downloadAudioFromVideo(
  videoId: string,
  outputDir: string
): Promise<{ audioPath: string; filename: string }> {
  await fs.mkdir(outputDir, { recursive: true });

  const safeFilename = `${videoId}_%(title)s.%(ext)s`;
  const outputTemplate = path.join(outputDir, safeFilename);

  // Enhanced yt-dlp command following 2024-2025 best practices
  const commandParts = [
    'yt-dlp',
    // Extract audio only
    '--extract-audio',
    '--audio-format mp3',
    '--audio-quality 0',
    '--no-playlist',
    // Format selection - use simpler formats less prone to 403
    '-f "bestaudio/best"',
    // Anti-blocking measures
    '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"',
    '--referer "https://www.youtube.com/"',
    '--add-header "Accept-Language:en-US,en;q=0.9"',
    // Force IPv4 (IPv6 can cause issues)
    '-4',
    // Retry and timeout settings
    '--retries 5',
    '--fragment-retries 5',
    '--retry-sleep 3',
    // Delays to avoid rate limiting
    '--sleep-interval 2',
    '--max-sleep-interval 5',
    // Cache management
    '--rm-cache-dir',
    // Output
    `-o "${outputTemplate}"`,
    `"https://www.youtube.com/watch?v=${videoId}"`,
  ];

  const command = commandParts.join(' ');

  try {
    const { stdout, stderr } = await execAsync(command, { 
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 600000, // 10 minutes timeout
    });

    // Find the downloaded file
    const files = await fs.readdir(outputDir);
    const audioFile = files.find(f => f.startsWith(videoId) && f.endsWith('.mp3'));

    if (!audioFile) {
      throw new Error('No se pudo encontrar el archivo de audio descargado');
    }

    return {
      audioPath: path.join(outputDir, audioFile),
      filename: audioFile,
    };
  } catch (error: any) {
    // Check if it's a 403 error
    if (error.message?.includes('HTTP Error 403')) {
      throw new Error('YouTube bloqueó la descarga (Error 403). Esto puede ocurrir debido a:\n' +
        '1. Restricciones geográficas del video\n' +
        '2. YouTube detectando descargas automatizadas\n' +
        '3. El video requiere autenticación\n\n' +
        'Intenta importar menos videos a la vez o espera unos minutos antes de reintentar.');
    }
    throw new Error(`Error al descargar audio: ${error.message}`);
  }
}

export async function downloadThumbnail(
  thumbnailUrl: string,
  outputDir: string,
  filename: string
): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, filename);

  try {
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));

    return outputPath;
  } catch (error: any) {
    throw new Error(`Error al descargar thumbnail: ${error.message}`);
  }
}

export async function uploadAudioToStorage(
  audioPath: string,
  filename: string,
  ownerId: string,
  episodeId?: string,
  podcastId?: string
): Promise<string> {
  const buffer = await fs.readFile(audioPath);
  
  // Create a Multer-like file object
  const file: Express.Multer.File = {
    fieldname: 'audio',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'audio/mpeg',
    buffer,
    size: buffer.length,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const asset = await mediaOrchestrator.saveEpisodeAudio(file, ownerId, episodeId, podcastId);
  return asset.id;
}

export async function uploadImageToStorage(
  imagePath: string,
  filename: string,
  ownerId: string,
  podcastId?: string
): Promise<string> {
  const buffer = await fs.readFile(imagePath);
  
  // Detect mime type from extension
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  
  // Create a Multer-like file object
  const file: Express.Multer.File = {
    fieldname: 'coverArt',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimeTypes[ext] || 'image/jpeg',
    buffer,
    size: buffer.length,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const asset = await mediaOrchestrator.saveCoverArt(file, ownerId, podcastId);
  return asset.id;
}

export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(`Error deleting temp file ${filePath}:`, error);
    }
  }
}

function extractPlaylistId(url: string): string | null {
  const patterns = [
    /[?&]list=([a-zA-Z0-9_-]+)/,
    /youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function parseDuration(duration: string): number {
  // Parse ISO 8601 duration format (PT1H2M3S)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}
