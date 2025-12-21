import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShareMenu } from "@/components/ShareMenu";
import { Link } from "wouter";
import type { EpisodeWithUrls } from "@shared/schema";

interface EpisodeCardProps {
  episode: EpisodeWithUrls;
  podcastTitle?: string;
  podcastCover?: string;
  onPlay?: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function EpisodeCard({ episode, podcastTitle, podcastCover, onPlay }: EpisodeCardProps) {
  return (
    <Card 
      className="hover-elevate overflow-hidden" 
      data-testid={`card-episode-${episode.id}`}
      id={`episode-${episode.id}`}
    >
      <div className="flex gap-4 p-4">
        {/* Cover Art */}
        {podcastCover && (
          <div className="flex-shrink-0">
            <img
              src={podcastCover}
              alt={podcastTitle || "Podcast"}
              className="w-24 h-24 rounded-lg object-cover"
            />
          </div>
        )}

        {/* Episode Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <Link href={`/episode/${episode.id}`}>
                <h3 className="font-semibold text-lg line-clamp-1 font-[Outfit] hover:text-primary transition-colors cursor-pointer" data-testid={`text-episode-title-${episode.id}`}>
                  {episode.title}
                </h3>
              </Link>
              {podcastTitle && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {podcastTitle}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <ShareMenu
                episodeTitle={episode.title}
                episodeUrl={episode.shareUrl}
                embedCode={episode.embedCode}
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
            {episode.notes}
          </p>

          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(episode.publishedAt)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDuration(episode.duration)}</span>
            </div>
          </div>
        </div>

        {/* Play Button */}
        <div className="flex-shrink-0 flex items-center">
          <Button
            variant="default"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={onPlay}
            data-testid={`button-play-episode-${episode.id}`}
          >
            <Play className="h-5 w-5 fill-current" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
