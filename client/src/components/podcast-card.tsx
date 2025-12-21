import { Card } from "@/components/ui/card";
import { Play, User } from "lucide-react";
import { Link } from "wouter";
import type { Podcast } from "@shared/schema";

interface PodcastCardProps {
  podcast: Podcast;
}

export function PodcastCard({ podcast }: PodcastCardProps) {
  return (
    <Link href={`/podcast/${podcast.id}`}>
      <Card
        className="overflow-hidden hover-elevate active-elevate-2 cursor-pointer group transition-all"
        data-testid={`card-podcast-${podcast.id}`}
      >
        <div className="relative aspect-square">
          {podcast.coverArtUrl ? (
            <img
              src={podcast.coverArtUrl}
              alt={podcast.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <User className="h-16 w-16 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-primary rounded-full p-4">
              <Play className="h-6 w-6 text-primary-foreground fill-current" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-[Outfit] font-bold text-lg line-clamp-1" data-testid={`text-podcast-title-${podcast.id}`}>
            {podcast.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {podcast.description}
          </p>
        </div>
      </Card>
    </Link>
  );
}
