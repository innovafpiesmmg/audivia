import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { EpisodeCard } from "@/components/episode-card";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareMenu } from "@/components/ShareMenu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Rss, Heart, HeartOff, Plus, Pencil, Users, Search, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PodcastWithEpisodesAndUrls, Episode } from "@shared/schema";
import { useAuth } from "@/components/auth-provider";

export default function PodcastDetail() {
  const [, params] = useRoute("/podcast/:id");
  const podcastId = params?.id;
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "alpha-asc" | "alpha-desc" | "listened">("date-desc");
  const [listenedEpisodes, setListenedEpisodes] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  // Get listened episodes from localStorage
  const getListenedEpisodes = (): Set<string> => {
    try {
      const data = localStorage.getItem("listened-episodes");
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch {
      return new Set();
    }
  };

  // Load listened episodes on mount and listen for updates
  useEffect(() => {
    setListenedEpisodes(getListenedEpisodes());

    const handleEpisodeListened = () => {
      setListenedEpisodes(getListenedEpisodes());
    };

    window.addEventListener("episode-listened", handleEpisodeListened);
    return () => window.removeEventListener("episode-listened", handleEpisodeListened);
  }, []);

  const { data: podcast, isLoading } = useQuery<PodcastWithEpisodesAndUrls & { isSubscribed?: boolean }>({
    queryKey: ["/api/podcasts", podcastId],
    enabled: !!podcastId,
  });

  // Filter and sort episodes
  const filteredAndSortedEpisodes = useMemo(() => {
    if (!podcast?.episodes) return [];

    // First, filter by search query
    let filtered = podcast.episodes.filter((episode) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        episode.title.toLowerCase().includes(query) ||
        (episode.notes && episode.notes.toLowerCase().includes(query))
      );
    });

    // Then, sort by selected criterion
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case "date-asc":
          return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        case "alpha-asc":
          return a.title.localeCompare(b.title);
        case "alpha-desc":
          return b.title.localeCompare(a.title);
        case "listened":
          const aListened = listenedEpisodes.has(a.id);
          const bListened = listenedEpisodes.has(b.id);
          if (aListened === bListened) {
            // Same status, sort by date
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
          }
          // Not listened first
          return aListened ? 1 : -1;
        default:
          return 0;
      }
    });
  }, [podcast?.episodes, searchQuery, sortBy, listenedEpisodes]);

  const handleSubscribe = async () => {
    if (!podcastId) return;
    
    try {
      if (podcast?.isSubscribed) {
        await apiRequest("DELETE", `/api/podcasts/${podcastId}/subscribe`);
        toast({
          title: "Desuscrito",
          description: "Te has desuscrito del podcast",
        });
      } else {
        await apiRequest("POST", `/api/podcasts/${podcastId}/subscribe`);
        toast({
          title: "Suscrito",
          description: "Te has suscrito al podcast",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
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

  if (isLoading) {
    return (
      <div className="min-h-screen pb-32">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Skeleton className="h-8 w-24 mb-6" />
          <div className="flex gap-6 mb-8">
            <Skeleton className="w-48 h-48 rounded-xl" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!podcast) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Podcast no encontrado</h2>
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
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Back Button */}
          <Link href="/">
            <Button variant="ghost" className="mb-6" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>

          {/* Podcast Header */}
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {podcast.coverArtUrl ? (
              <img
                src={podcast.coverArtUrl}
                alt={podcast.title}
                className="w-full md:w-48 h-48 rounded-xl object-cover flex-shrink-0"
                data-testid="img-podcast-cover"
              />
            ) : (
              <div className="w-full md:w-48 h-48 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                <User className="h-20 w-20 text-primary/40" />
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-4xl font-bold font-[Outfit]" data-testid="text-podcast-title">
                  {podcast.title}
                </h1>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    data-testid="button-rss-feed"
                    title="Feed RSS"
                  >
                    <a 
                      href={`/api/podcasts/${podcastId}/rss`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Rss className="h-4 w-4" />
                    </a>
                  </Button>
                  <ShareMenu 
                    episodeTitle={podcast.title}
                    episodeUrl={`${window.location.origin}/podcast/${podcastId}`}
                    embedCode=""
                    isPodcast={true}
                    rssUrl={`${window.location.origin}/api/podcasts/${podcastId}/rss`}
                  />
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {podcast.description}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <span data-testid="text-episode-count">
                  {podcast.episodes?.length || 0} episodios
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={podcast.isSubscribed ? "secondary" : "default"}
                  onClick={handleSubscribe}
                  data-testid="button-subscribe"
                  className="gap-2"
                >
                  {podcast.isSubscribed ? (
                    <>
                      <HeartOff className="h-4 w-4" />
                      Desuscribirse
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4" />
                      Suscribirse
                    </>
                  )}
                </Button>
                {user && (user.id === podcast.ownerId || user.role === "ADMIN") && (
                  <Link href={`/edit-podcast/${podcastId}`}>
                    <Button variant="outline" data-testid="button-edit-podcast" className="gap-2">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                  </Link>
                )}
                {user && user.id === podcast.ownerId && (podcast.visibility === "UNLISTED" || podcast.visibility === "PRIVATE") && (
                  <Link href={`/manage-invitations/podcast/${podcastId}`}>
                    <Button variant="outline" data-testid="button-manage-invitations" className="gap-2">
                      <Users className="h-4 w-4" />
                      Gestionar Invitaciones
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Episodes List */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold font-[Outfit]">Episodios</h2>
            {user && (user.role === "ADMIN" || user.id === podcast.ownerId) && (
              <Link href={`/podcast/${podcastId}/add-episode`}>
                <Button data-testid="button-add-episode">
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Episodio
                </Button>
              </Link>
            )}
          </div>

          {/* Search and Filters */}
          {podcast.episodes && podcast.episodes.length > 0 && (
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar episodios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  data-testid="input-search-episodes"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery("")}
                    aria-label="Limpiar búsqueda"
                    data-testid="button-clear-search-inline"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-full md:w-[220px]" data-testid="select-sort-episodes">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Más recientes primero</SelectItem>
                  <SelectItem value="date-asc">Más antiguos primero</SelectItem>
                  <SelectItem value="alpha-asc">A-Z</SelectItem>
                  <SelectItem value="alpha-desc">Z-A</SelectItem>
                  <SelectItem value="listened">No escuchados primero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {podcast.episodes && podcast.episodes.length > 0 ? (
            filteredAndSortedEpisodes.length > 0 ? (
              <div className="space-y-4">
                {filteredAndSortedEpisodes.map((episode) => (
                  <EpisodeCard
                    key={episode.id}
                    episode={episode}
                    podcastTitle={podcast.title}
                    podcastCover={podcast.coverArtUrl || undefined}
                    onPlay={() => setCurrentEpisode(episode)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  No se encontraron episodios que coincidan con tu búsqueda.
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setSearchQuery("")}
                    data-testid="button-clear-search"
                  >
                    Limpiar búsqueda
                  </Button>
                )}
              </div>
            )
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <p className="text-muted-foreground">
                Este podcast aún no tiene episodios.
              </p>
              {user && (user.role === "ADMIN" || user.id === podcast.ownerId) && (
                <Link href={`/podcast/${podcastId}/add-episode`}>
                  <Button className="mt-4" data-testid="button-add-first-episode">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Primer Episodio
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Audio Player */}
      {currentEpisode && (
        <AudioPlayer
          episode={currentEpisode}
          podcastTitle={podcast.title}
          podcastCover={podcast.coverArtUrl || undefined}
        />
      )}
    </div>
  );
}
