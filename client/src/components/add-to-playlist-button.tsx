import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ListPlus, Check, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Playlist } from "@shared/schema";

interface AddToPlaylistButtonProps {
  episodeId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function AddToPlaylistButton({ episodeId, variant = "outline", size = "sm" }: AddToPlaylistButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: playlists = [], isLoading } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
    enabled: !!user && isOpen,
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async ({ playlistId }: { playlistId: string }) => {
      return await apiRequest("POST", `/api/playlists/${playlistId}/episodes`, { episodeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({
        title: "Episodio añadido",
        description: "El episodio se ha añadido a la playlist",
      });
      setIsOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("already in playlist")) {
        toast({
          title: "Ya existe",
          description: "Este episodio ya está en la playlist",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "No se pudo añadir el episodio a la playlist",
          variant: "destructive",
        });
      }
    },
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (name: string): Promise<Playlist> => {
      return await apiRequest<Playlist>("POST", "/api/playlists", {
        name,
        description: "",
        isPublic: false,
      });
    },
    onSuccess: async (newPlaylist: Playlist) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setNewPlaylistName("");
      setShowCreateForm(false);
      addToPlaylistMutation.mutate({ playlistId: newPlaylist.id });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la playlist",
        variant: "destructive",
      });
    },
  });

  const checkInPlaylist = async (playlistId: string): Promise<boolean> => {
    try {
      const playlist = await queryClient.fetchQuery<Playlist & { episodes: { id: string }[] }>({
        queryKey: ["/api/playlists", playlistId],
      });
      return playlist.episodes?.some((ep) => ep.id === episodeId) || false;
    } catch {
      return false;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} data-testid="button-add-to-playlist">
          <ListPlus className="w-4 h-4 mr-2" />
          Añadir a Playlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir a Playlist</DialogTitle>
          <DialogDescription>Selecciona una playlist o crea una nueva</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : playlists.length === 0 && !showCreateForm ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">No tienes playlists aún</p>
            <Button onClick={() => setShowCreateForm(true)} data-testid="button-create-first-playlist">
              <Plus className="w-4 h-4 mr-2" />
              Crear mi primera playlist
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!showCreateForm && playlists.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {playlists.map((playlist) => {
                  const [inPlaylist, setInPlaylist] = useState(false);

                  checkInPlaylist(playlist.id).then(setInPlaylist);

                  return (
                    <Card
                      key={playlist.id}
                      className={`cursor-pointer hover-elevate ${inPlaylist ? "opacity-50" : ""}`}
                      onClick={() => {
                        if (!inPlaylist && !addToPlaylistMutation.isPending) {
                          addToPlaylistMutation.mutate({ playlistId: playlist.id });
                        }
                      }}
                      data-testid={`playlist-option-${playlist.id}`}
                    >
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{playlist.name}</p>
                          {playlist.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {playlist.description}
                            </p>
                          )}
                        </div>
                        {inPlaylist && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {showCreateForm ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-playlist-name">Nombre de la playlist</Label>
                  <Input
                    id="new-playlist-name"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="Mi Nueva Playlist"
                    data-testid="input-new-playlist-name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewPlaylistName("");
                    }}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-cancel-create"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      if (newPlaylistName.trim()) {
                        createPlaylistMutation.mutate(newPlaylistName);
                      }
                    }}
                    disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                    className="flex-1"
                    data-testid="button-submit-create"
                  >
                    {createPlaylistMutation.isPending ? "Creando..." : "Crear y añadir"}
                  </Button>
                </div>
              </div>
            ) : playlists.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(true)}
                className="w-full"
                data-testid="button-show-create-form"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Playlist
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
