import NodeID3 from 'node-id3';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AudiobookMetadata {
  title: string;
  author: string;
  album: string;
  trackNumber: number;
  totalTracks?: number;
  year?: number;
  genre?: string;
  narrator?: string;
  coverArtPath?: string;
}

export async function updateMP3Metadata(
  filePath: string,
  metadata: AudiobookMetadata
): Promise<void> {
  const tags: NodeID3.Tags = {
    title: metadata.title,
    artist: metadata.author,
    album: metadata.album,
    trackNumber: String(metadata.trackNumber),
    year: metadata.year ? String(metadata.year) : String(new Date().getFullYear()),
    genre: metadata.genre || 'Audiobook',
    composer: metadata.narrator || undefined,
  };

  if (metadata.coverArtPath) {
    try {
      const coverBuffer = await fs.readFile(metadata.coverArtPath);
      const ext = path.extname(metadata.coverArtPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      
      tags.image = {
        mime: mimeType,
        type: {
          id: 3,
          name: 'front cover',
        },
        description: 'Cover',
        imageBuffer: coverBuffer,
      };
    } catch (error) {
      console.warn('Could not read cover art for ID3 tags:', error);
    }
  }

  const success = NodeID3.update(tags, filePath);
  
  if (!success) {
    console.warn(`Failed to update ID3 tags for ${filePath}`);
  }
}

export async function updateMP3MetadataBuffer(
  buffer: Buffer,
  metadata: AudiobookMetadata,
  coverBuffer?: Buffer
): Promise<Buffer> {
  const tags: NodeID3.Tags = {
    title: metadata.title,
    artist: metadata.author,
    album: metadata.album,
    trackNumber: String(metadata.trackNumber),
    year: metadata.year ? String(metadata.year) : String(new Date().getFullYear()),
    genre: metadata.genre || 'Audiobook',
    composer: metadata.narrator || undefined,
  };

  if (coverBuffer) {
    tags.image = {
      mime: 'image/jpeg',
      type: {
        id: 3,
        name: 'front cover',
      },
      description: 'Cover',
      imageBuffer: coverBuffer,
    };
  }

  const updatedBuffer = NodeID3.update(tags, buffer);
  
  if (!updatedBuffer) {
    console.warn('Failed to update ID3 tags in buffer, returning original');
    return buffer;
  }
  
  return updatedBuffer as Buffer;
}

export async function readMP3Metadata(filePath: string): Promise<NodeID3.Tags | null> {
  try {
    const tags = NodeID3.read(filePath);
    return tags;
  } catch (error) {
    console.error('Error reading ID3 tags:', error);
    return null;
  }
}
