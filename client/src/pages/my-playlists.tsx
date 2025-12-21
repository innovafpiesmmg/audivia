import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Music, Trash2, Edit, ExternalLink, Lock, Globe } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import type { Playlist } from "@shared/schema";

export default function MyPlaylists() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  const { data: playlists = [], isLoading } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; isPublic: boolean }) => {
      return await apiRequest("POST", "/api/playlists", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Playlist creada",
        description: "Tu playlist se ha creado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la playlist",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<Playlist, "name" | "description" | "isPublic">> }) => {
      return await apiRequest("PATCH", `/api/playlists/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setEditingPlaylist(null);
      toast({
        title: "Playlist actualizada",
        description: "Los cambios se han guardado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la playlist",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/playlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({
        title: "Playlist eliminada",
        description: "La playlist se ha eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la playlist",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      isPublic: formData.get("isPublic") === "on",
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPlaylist) return;
    
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editingPlaylist.id,
      data: {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        isPublic: formData.get("isPublic") === "on",
      },
    });
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>Debes iniciar sesión para ver tus playlists</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild data-testid="button-login">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Mis Playlists</h1>
          <p className="text-muted-foreground mt-1">Organiza tus episodios favoritos</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-playlist">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Playlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateSubmit}>
              <DialogHeader>
                <DialogTitle>Crear Playlist</DialogTitle>
                <DialogDescription>
                  Crea una nueva playlist para organizar tus episodios
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Nombre*</Label>
                  <Input
                    id="create-name"
                    name="name"
                    placeholder="Mi Playlist Favorita"
                    required
                    data-testid="input-playlist-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-description">Descripción</Label>
                  <Textarea
                    id="create-description"
                    name="description"
                    placeholder="Describe tu playlist..."
                    rows={3}
                    data-testid="input-playlist-description"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-isPublic">Playlist pública</Label>
                  <Switch
                    id="create-isPublic"
                    name="isPublic"
                    data-testid="switch-playlist-public"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Las playlists públicas pueden ser vistas por cualquier usuario
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create"
                >
                  {createMutation.isPending ? "Creando..." : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tienes playlists</h3>
            <p className="text-muted-foreground mb-4">
              Crea tu primera playlist para empezar a organizar episodios
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first">
              <Plus className="w-4 h-4 mr-2" />
              Crear Playlist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <Card key={playlist.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate" data-testid={`text-playlist-name-${playlist.id}`}>
                      {playlist.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      {playlist.isPublic ? (
                        <>
                          <Globe className="w-3 h-3" />
                          Pública
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          Privada
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {playlist.description || "Sin descripción"}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(`/playlists/${playlist.id}`)}
                  data-testid={`button-view-${playlist.id}`}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingPlaylist(playlist)}
                    data-testid={`button-edit-${playlist.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("¿Estás seguro de que quieres eliminar esta playlist?")) {
                        deleteMutation.mutate(playlist.id);
                      }
                    }}
                    data-testid={`button-delete-${playlist.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingPlaylist} onOpenChange={(open) => !open && setEditingPlaylist(null)}>
        <DialogContent>
          <form onSubmit={handleUpdateSubmit}>
            <DialogHeader>
              <DialogTitle>Editar Playlist</DialogTitle>
              <DialogDescription>
                Actualiza la información de tu playlist
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre*</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingPlaylist?.name}
                  required
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={editingPlaylist?.description || ""}
                  rows={3}
                  data-testid="input-edit-description"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-isPublic">Playlist pública</Label>
                <Switch
                  id="edit-isPublic"
                  name="isPublic"
                  defaultChecked={editingPlaylist?.isPublic}
                  data-testid="switch-edit-public"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPlaylist(null)}
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-submit-edit"
              >
                {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
