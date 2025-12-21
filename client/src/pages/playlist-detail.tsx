import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Music, Trash2, Globe, Lock, Share2, Copy } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { AudioPlayer } from "@/components/audio-player";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Playlist, Episode } from "@shared/schema";

interface PlaylistWithEpisodes extends Playlist {
  episodes: Episode[];
}

export default function PlaylistDetail() {
  const params = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const playlistId = params.id as string;

  const { data: playlist, isLoading } = useQuery<PlaylistWithEpisodes>({
    queryKey: ["/api/playlists", playlistId],
    enabled: !!playlistId,
  });

  const removeEpisodeMutation = useMutation({
    mutationFn: async (episodeId: string) => {
      return await apiRequest("DELETE", `/api/playlists/${playlistId}/episodes/${episodeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", playlistId] });
      toast({
        title: "Episodio eliminado",
        description: "El episodio se ha eliminado de la playlist",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el episodio",
        variant: "destructive",
      });
    },
  });

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/playlists/${playlistId}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Enlace copiado",
      description: "El enlace de la playlist se ha copiado al portapapeles",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Playlist no encontrada</CardTitle>
            <CardDescription>La playlist que buscas no existe o es privada</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild data-testid="button-back">
              <Link href="/my-playlists">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Mis Playlists
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwner = user?.id === playlist.userId;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4" data-testid="button-back">
          <Link href="/my-playlists">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-2xl" data-testid="text-playlist-name">
                    {playlist.name}
                  </CardTitle>
                  <Badge variant="secondary">
                    {playlist.isPublic ? (
                      <>
                        <Globe className="w-3 h-3 mr-1" />
                        Pública
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 mr-1" />
                        Privada
                      </>
                    )}
                  </Badge>
                </div>
                {playlist.description && (
                  <CardDescription className="text-base" data-testid="text-playlist-description">
                    {playlist.description}
                  </CardDescription>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {playlist.episodes.length} {playlist.episodes.length === 1 ? "episodio" : "episodios"}
                </p>
              </div>
              {playlist.isPublic && (
                <Button variant="outline" onClick={handleShare} data-testid="button-share">
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartir
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      </div>

      {playlist.episodes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Playlist vacía</h3>
            <p className="text-muted-foreground">
              {isOwner
                ? "Aún no has añadido episodios a esta playlist. Explora podcasts y añade episodios desde los detalles de cada episodio."
                : "Esta playlist no tiene episodios todavía"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {playlist.episodes.map((episode) => (
            <Card key={episode.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg" data-testid={`text-episode-title-${episode.id}`}>
                      {episode.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {episode.publishedAt && (
                        <span>
                          {formatDistanceToNow(new Date(episode.publishedAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      )}
                      {episode.duration && (
                        <>
                          {" • "}
                          {Math.floor(episode.duration / 60)} min
                        </>
                      )}
                    </CardDescription>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("¿Eliminar este episodio de la playlist?")) {
                          removeEpisodeMutation.mutate(episode.id);
                        }
                      }}
                      disabled={removeEpisodeMutation.isPending}
                      data-testid={`button-remove-${episode.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {episode.notes && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {episode.notes}
                  </p>
                )}
                <AudioPlayer episode={episode} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
