import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ShareMenu } from "@/components/ShareMenu";
import { ArrowLeft, Play, Clock, Calendar, User, Heart, HeartOff, Pencil, Users } from "lucide-react";
import { AudioPlayer } from "@/components/audio-player";
import { AddToPlaylistButton } from "@/components/add-to-playlist-button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EpisodeWithPodcastAndUrls } from "@shared/schema";
import { useAuth } from "@/components/auth-provider";

export default function EpisodeDetail() {
  const [, params] = useRoute("/episode/:id");
  const episodeId = params?.id;
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: episode, isLoading } = useQuery<EpisodeWithPodcastAndUrls & { isSubscribed?: boolean }>({
    queryKey: ["/api/episodes", episodeId],
    enabled: !!episodeId,
  });

  const handleSubscribe = async () => {
    if (!episode?.podcast?.id) return;
    
    try {
      if (episode?.isSubscribed) {
        await apiRequest("DELETE", `/api/podcasts/${episode.podcast.id}/subscribe`);
        toast({
          title: "Desuscrito",
          description: "Te has desuscrito del podcast",
        });
      } else {
        await apiRequest("POST", `/api/podcasts/${episode.podcast.id}/subscribe`);
        toast({
          title: "Suscrito",
          description: "Te has suscrito al podcast",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
    } catch (error: any) {
      if (error.message?.includes("401")) {
        toast({
          variant: "destructive",
          title: "No autenticado",
          description: "Debes iniciar sesión para suscribirte",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo actualizar la suscripción",
        });
      }
    }
  };

  // Update document title and meta tags when episode data loads
  useEffect(() => {
    if (episode) {
      document.title = `${episode.title} - ${episode.podcast?.title || 'Podcast'}`;
      
      // Update meta tags for social sharing
      const updateMetaTag = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };

      const updateMetaName = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', name);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };

      // Open Graph tags
      updateMetaTag('og:title', episode.title);
      updateMetaTag('og:description', episode.notes || episode.title);
      updateMetaTag('og:type', 'music.song');
      if (episode.podcast?.coverArtUrl) {
        updateMetaTag('og:image', episode.podcast.coverArtUrl);
      }
      if (episode.audioUrl) {
        updateMetaTag('og:audio', episode.audioUrl);
      }
      
      // Twitter Card tags
      updateMetaName('twitter:card', 'player');
      updateMetaName('twitter:title', episode.title);
      updateMetaName('twitter:description', episode.notes || episode.title);
      if (episode.podcast?.coverArtUrl) {
        updateMetaName('twitter:image', episode.podcast.coverArtUrl);
      }

      // Description meta tag
      updateMetaName('description', episode.notes || episode.title);
    }
  }, [episode]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-32">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Skeleton className="h-8 w-24 mb-6" />
          <div className="flex gap-6 mb-8">
            <Skeleton className="w-64 h-64 rounded-xl" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Episodio no encontrado</h2>
          <Link href="/">
            <Button variant="default">Volver al inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Back Button */}
          {episode.podcast && (
            <Link href={`/podcast/${episode.podcast.id}`}>
              <Button variant="ghost" className="mb-6" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al podcast
              </Button>
            </Link>
          )}

          {/* Episode Header */}
          <div className="flex flex-col md:flex-row gap-8 mb-6">
            {/* Cover Art */}
            {episode.podcast?.coverArtUrl ? (
              <img
                src={episode.podcast.coverArtUrl}
                alt={episode.podcast.title}
                className="w-full md:w-64 h-64 rounded-xl object-cover flex-shrink-0 shadow-lg"
                data-testid="img-episode-cover"
              />
            ) : (
              <div className="w-full md:w-64 h-64 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                <User className="h-24 w-24 text-primary/40" />
              </div>
            )}

            {/* Episode Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  {episode.podcast && (
                    <Link href={`/podcast/${episode.podcast.id}`}>
                      <p className="text-sm text-primary hover:underline mb-2" data-testid="link-podcast">
                        {episode.podcast.title}
                      </p>
                    </Link>
                  )}
                  <h1 className="text-3xl md:text-4xl font-bold font-[Outfit]" data-testid="text-episode-title">
                    {episode.title}
                  </h1>
                </div>
                <ShareMenu 
                  episodeTitle={episode.title}
                  episodeUrl={episode.canonicalUrl || ''}
                  embedCode={episode.embedCode || ''}
                />
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                <div className="flex items-center gap-1" data-testid="text-duration">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(episode.duration)}</span>
                </div>
                <div className="flex items-center gap-1" data-testid="text-published-date">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(episode.publishedAt)}</span>
                </div>
              </div>

              {/* Play and Subscribe Buttons */}
              <div className="flex gap-3 flex-wrap">
                <Button 
                  size="lg" 
                  onClick={() => setIsPlaying(true)}
                  className="gap-2"
                  data-testid="button-play-episode"
                >
                  <Play className="h-5 w-5" />
                  Reproducir episodio
                </Button>
                <Button
                  size="lg"
                  variant={episode.isSubscribed ? "secondary" : "outline"}
                  onClick={handleSubscribe}
                  data-testid="button-subscribe"
                  className="gap-2"
                >
                  {episode.isSubscribed ? (
                    <>
                      <HeartOff className="h-5 w-5" />
                      Desuscribirse
                    </>
                  ) : (
                    <>
                      <Heart className="h-5 w-5" />
                      Suscribirse
                    </>
                  )}
                </Button>
                {user && episodeId && (
                  <AddToPlaylistButton episodeId={episodeId} variant="outline" size="lg" />
                )}
                {user && episode.podcast && (user.id === episode.podcast.ownerId || user.role === "ADMIN") && (
                  <Link href={`/edit-episode/${episodeId}`}>
                    <Button size="lg" variant="outline" data-testid="button-edit-episode" className="gap-2">
                      <Pencil className="h-5 w-5" />
                      Editar
                    </Button>
                  </Link>
                )}
                {user && episode.podcast && user.id === episode.podcast.ownerId && (episode.visibility === "UNLISTED" || episode.visibility === "PRIVATE") && (
                  <Link href={`/manage-invitations/episode/${episodeId}`}>
                    <Button size="lg" variant="outline" data-testid="button-manage-invitations" className="gap-2">
                      <Users className="h-5 w-5" />
                      Gestionar Invitaciones
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Episode Description */}
        {episode.notes && (
          <Card className="p-6">
            <h2 className="text-xl font-bold font-[Outfit] mb-4">Descripción</h2>
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              data-testid="text-episode-notes"
            >
              <p className="whitespace-pre-wrap leading-relaxed">
                {episode.notes}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Fixed Audio Player */}
      {isPlaying && (
        <AudioPlayer
          episode={episode}
          podcastTitle={episode.podcast?.title}
          podcastCover={episode.podcast?.coverArtUrl || undefined}
        />
      )}
    </div>
  );
}
