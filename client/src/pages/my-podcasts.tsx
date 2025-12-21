import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Radio, Music, Rss, FolderOpen } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import type { Podcast } from "@shared/schema";

type PodcastWithCount = Podcast & { episodeCount: number };

export default function MyPodcasts() {
  const { user } = useAuth();
  const { data: podcasts, isLoading } = useQuery<PodcastWithCount[]>({
    queryKey: ["/api/my-podcasts"],
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "default";
      case "PENDING_APPROVAL":
        return "secondary";
      case "REJECTED":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "Aprobado";
      case "PENDING_APPROVAL":
        return "Pendiente";
      case "REJECTED":
        return "Rechazado";
      case "DRAFT":
        return "Borrador";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-32">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-[Outfit] mb-2" data-testid="text-page-title">
              Mis Podcasts
            </h1>
            <p className="text-muted-foreground">
              Gestiona todos tus podcasts y episodios
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/import-rss">
              <Button variant="outline" data-testid="button-import-rss">
                <Rss className="h-4 w-4 mr-2" />
                Importar RSS
              </Button>
            </Link>
            {user?.role === "ADMIN" && (
              <Link href="/import-local">
                <Button variant="outline" data-testid="button-import-local">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Importar Carpeta Local
                </Button>
              </Link>
            )}
            <Link href="/create">
              <Button data-testid="button-create-podcast">
                <Plus className="h-4 w-4 mr-2" />
                Crear Podcast
              </Button>
            </Link>
          </div>
        </div>

        {!podcasts || podcasts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-primary/10 p-6 mb-4">
                <Radio className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No tienes podcasts</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Comienza a compartir tu contenido creando tu primer podcast
              </p>
              <Link href="/create">
                <Button data-testid="button-create-first-podcast">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Mi Primer Podcast
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {podcasts.map((podcast) => (
              <Card key={podcast.id} className="hover-elevate" data-testid={`card-podcast-${podcast.id}`}>
                <CardHeader className="pb-3">
                  {podcast.coverArtUrl ? (
                    <img
                      src={podcast.coverArtUrl}
                      alt={podcast.title}
                      className="w-full aspect-square object-cover rounded-lg mb-4"
                      data-testid={`img-podcast-cover-${podcast.id}`}
                    />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                      <Radio className="h-20 w-20 text-primary/40" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2" data-testid={`text-podcast-title-${podcast.id}`}>
                      {podcast.title}
                    </CardTitle>
                    <Badge variant={getStatusVariant(podcast.status)} data-testid={`badge-status-${podcast.id}`}>
                      {getStatusLabel(podcast.status)}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 mt-2">
                    {podcast.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Music className="h-4 w-4" />
                    <span data-testid={`text-episode-count-${podcast.id}`}>
                      {podcast.episodeCount} {podcast.episodeCount === 1 ? "episodio" : "episodios"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/podcast/${podcast.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm" data-testid={`button-view-${podcast.id}`}>
                        Ver Detalles
                      </Button>
                    </Link>
                    <Link href={`/podcast/${podcast.id}/add-episode`} className="flex-1">
                      <Button variant="default" className="w-full" size="sm" data-testid={`button-add-episode-${podcast.id}`}>
                        <Plus className="h-4 w-4 mr-1" />
                        Episodio
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
