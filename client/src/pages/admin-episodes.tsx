import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Trash2, Search, Radio } from "lucide-react";
import { format } from "date-fns";
import type { Episode, Podcast, User } from "@shared/schema";

type StatusFilter = "all" | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

interface EpisodeWithPodcast extends Episode {
  podcast: Podcast & {
    owner: User;
  };
}

export default function AdminEpisodes() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeWithPodcast | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "delete" | null>(null);
  
  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"delete" | "approve" | "reject" | null>(null);

  const { data: allEpisodes, isLoading } = useQuery<EpisodeWithPodcast[]>({
    queryKey: ["/api/admin/episodes"],
  });

  // Reset selection when dataset changes (to avoid stale selections)
  useEffect(() => {
    if (allEpisodes) {
      setSelectedIds(prev => prev.filter(id => allEpisodes.some(e => e.id === id)));
    }
  }, [allEpisodes]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, searchQuery]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ episodeId, status }: { episodeId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/episodes/${episodeId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      toast({
        title: "Estado actualizado",
        description: "El estado del episodio ha sido actualizado correctamente.",
      });
      setSelectedEpisode(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado del episodio.",
        variant: "destructive",
      });
    },
  });

  const deleteEpisodeMutation = useMutation({
    mutationFn: async (episodeId: string) => {
      return await apiRequest("DELETE", `/api/admin/episodes/${episodeId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      toast({
        title: "Episodio eliminado",
        description: "El episodio ha sido eliminado correctamente.",
      });
      setSelectedEpisode(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el episodio.",
        variant: "destructive",
      });
    },
  });

  // Bulk operations mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest("POST", "/api/admin/episodes/bulk-delete", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      
      toast({
        title: "Operación completada",
        description: data.message || `Se eliminaron ${data.successIds?.length || 0} episodio(s)`,
      });
      
      if (data.failed && data.failed.length > 0) {
        const failedEpisodes = allEpisodes?.filter(e => data.failed.some((f: any) => f.id === e.id)) || [];
        const failedTitles = failedEpisodes.map(e => e.title).join(", ");
        toast({
          title: "Algunos elementos fallaron",
          description: `Los siguientes episodios no pudieron ser eliminados: ${failedTitles}`,
          variant: "destructive",
        });
      }
      
      setSelectedIds(prev => prev.filter(id => !data.successIds?.includes(id)));
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron eliminar los episodios.",
        variant: "destructive",
      });
      setBulkAction(null);
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      return await apiRequest("POST", "/api/admin/episodes/bulk-update-status", { ids, status });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      
      toast({
        title: "Operación completada",
        description: data.message || `Se actualizaron ${data.successIds?.length || 0} episodio(s)`,
      });
      
      if (data.failed && data.failed.length > 0) {
        const failedEpisodes = allEpisodes?.filter(e => data.failed.some((f: any) => f.id === e.id)) || [];
        const failedTitles = failedEpisodes.map(e => e.title).join(", ");
        toast({
          title: "Algunos elementos fallaron",
          description: `Los siguientes episodios no pudieron ser actualizados: ${failedTitles}`,
          variant: "destructive",
        });
      }
      
      setSelectedIds(prev => prev.filter(id => !data.successIds?.includes(id)));
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron actualizar los episodios.",
        variant: "destructive",
      });
      setBulkAction(null);
    },
  });

  const handleApprove = (episode: EpisodeWithPodcast) => {
    setSelectedEpisode(episode);
    setActionType("approve");
  };

  const handleReject = (episode: EpisodeWithPodcast) => {
    setSelectedEpisode(episode);
    setActionType("reject");
  };

  const handleDelete = (episode: EpisodeWithPodcast) => {
    setSelectedEpisode(episode);
    setActionType("delete");
  };

  const confirmAction = () => {
    if (!selectedEpisode) return;

    if (actionType === "approve") {
      updateStatusMutation.mutate({ episodeId: selectedEpisode.id, status: "APPROVED" });
    } else if (actionType === "reject") {
      updateStatusMutation.mutate({ episodeId: selectedEpisode.id, status: "REJECTED" });
    } else if (actionType === "delete") {
      deleteEpisodeMutation.mutate(selectedEpisode.id);
    }
  };

  // Bulk operation handlers
  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    const filteredEpisodes = allEpisodes?.filter((episode) => {
      const matchesStatus = statusFilter === "all" || episode.status === statusFilter;
      const matchesSearch = searchQuery === "" ||
        episode.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        episode.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    }) || [];

    if (selectedIds.length === filteredEpisodes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEpisodes.map(e => e.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkAction("delete");
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    setBulkAction("approve");
  };

  const handleBulkReject = () => {
    if (selectedIds.length === 0) return;
    setBulkAction("reject");
  };

  const confirmBulkAction = () => {
    if (selectedIds.length === 0) return;

    if (bulkAction === "delete") {
      bulkDeleteMutation.mutate(selectedIds);
    } else if (bulkAction === "approve") {
      bulkUpdateStatusMutation.mutate({ ids: selectedIds, status: "APPROVED" });
    } else if (bulkAction === "reject") {
      bulkUpdateStatusMutation.mutate({ ids: selectedIds, status: "REJECTED" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20" data-testid={`badge-status-approved`}>
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprobado
          </Badge>
        );
      case "PENDING_APPROVAL":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20" data-testid={`badge-status-pending`}>
            Pendiente
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20" data-testid={`badge-status-rejected`}>
            <XCircle className="w-3 h-3 mr-1" />
            Rechazado
          </Badge>
        );
      case "DRAFT":
        return <Badge variant="outline" data-testid={`badge-status-draft`}>Borrador</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter episodes
  const filteredEpisodes = allEpisodes?.filter((episode) => {
    const matchesStatus = statusFilter === "all" || episode.status === statusFilter;
    const matchesSearch = searchQuery === "" ||
      episode.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      episode.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      episode.podcast?.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  }) || [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[Outfit]">Moderación de Episodios</h1>
        <p className="text-muted-foreground mt-1">
          Revisa y gestiona los episodios de la plataforma
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, descripción o podcast..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-episodes"
              />
            </div>
          </div>
          <div className="w-[200px]">
            <label className="text-sm font-medium mb-2 block">Estado</label>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pendientes</SelectItem>
                <SelectItem value="APPROVED">Aprobados</SelectItem>
                <SelectItem value="REJECTED">Rechazados</SelectItem>
                <SelectItem value="DRAFT">Borradores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            Episodios ({filteredEpisodes.length})
          </CardTitle>
          <CardDescription>
            {statusFilter === "all" ? "Todos los episodios" : `Episodios con estado: ${statusFilter}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedIds.length > 0 && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} episodio(s) seleccionado(s)
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkApprove}
                disabled={bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
                data-testid="button-bulk-approve"
              >
                {bulkUpdateStatusMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="w-3 h-3 mr-1" />
                )}
                Aprobar Seleccionados
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkReject}
                disabled={bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
                data-testid="button-bulk-reject"
              >
                {bulkUpdateStatusMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Rechazar Seleccionados
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
                data-testid="button-bulk-delete"
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3 mr-1" />
                )}
                Eliminar Seleccionados
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={filteredEpisodes && filteredEpisodes.length > 0 && selectedIds.length === filteredEpisodes.length}
                    onCheckedChange={handleToggleAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead>Episodio</TableHead>
                <TableHead>Podcast</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciónes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEpisodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No se encontraron episodios
                  </TableCell>
                </TableRow>
              ) : (
                filteredEpisodes.map((episode) => (
                  <TableRow key={episode.id} data-testid={`row-episode-${episode.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(episode.id)}
                        onCheckedChange={() => handleToggleSelection(episode.id)}
                        data-testid={`checkbox-episode-${episode.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-xs" data-testid={`text-title-${episode.id}`}>
                      <div className="truncate">{episode.title}</div>
                      {episode.notes && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {episode.notes.substring(0, 80)}...
                        </div>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-podcast-${episode.id}`}>
                      <div className="flex items-center gap-2">
                        <Radio className="w-3 h-3 text-primary" />
                        <span className="truncate max-w-[200px]">
                          {episode.podcast?.title || "Desconocido"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {episode.duration ? formatDuration(episode.duration) : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(episode.status)}</TableCell>
                    <TableCell>
                      {format(new Date(episode.publishedAt || Date.now()), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {episode.status !== "APPROVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(episode)}
                          className="text-green-600 hover:text-green-700"
                          data-testid={`button-approve-${episode.id}`}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Aprobar
                        </Button>
                      )}
                      {episode.status !== "REJECTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(episode)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-reject-${episode.id}`}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Rechazar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(episode)}
                        data-testid={`button-delete-${episode.id}`}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={!!selectedEpisode && !!actionType} 
        onOpenChange={(open) => {
          if (!updateStatusMutation.isPending && !deleteEpisodeMutation.isPending) {
            if (!open) {
              setSelectedEpisode(null);
              setActionType(null);
            }
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve" && "Aprobar Episodio"}
              {actionType === "reject" && "Rechazar Episodio"}
              {actionType === "delete" && "Eliminar Episodio"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve" && (
                <p>
                  ¿Estás seguro de que deseas aprobar el episodio <strong>{selectedEpisode?.title}</strong>?
                  Será visible para todos los usuarios.
                </p>
              )}
              {actionType === "reject" && (
                <p>
                  ¿Estás seguro de que deseas rechazar el episodio <strong>{selectedEpisode?.title}</strong>?
                  El creador podrá verlo pero no será público.
                </p>
              )}
              {actionType === "delete" && (
                <p className="text-red-600">
                  ¿Estás seguro de que deseas eliminar permanentemente el episodio <strong>{selectedEpisode?.title}</strong>?
                  Esta acción no se puede deshacer.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={updateStatusMutation.isPending || deleteEpisodeMutation.isPending}
              data-testid="button-cancel-action"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={updateStatusMutation.isPending || deleteEpisodeMutation.isPending}
              className={actionType === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              data-testid="button-confirm-action"
            >
              {updateStatusMutation.isPending || deleteEpisodeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Actions Confirmation Dialog */}
      <AlertDialog 
        open={!!bulkAction} 
        onOpenChange={(open) => {
          if (!bulkDeleteMutation.isPending && !bulkUpdateStatusMutation.isPending) {
            if (!open) setBulkAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "delete" && "Eliminar Episodios"}
              {bulkAction === "approve" && "Aprobar Episodios"}
              {bulkAction === "reject" && "Rechazar Episodios"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "delete" && (
                <p className="text-red-600">
                  ¿Estás seguro de que deseas eliminar <strong>{selectedIds.length}</strong> episodio(s)? 
                  Esta acción no se puede deshacer.
                </p>
              )}
              {bulkAction === "approve" && (
                <p>
                  ¿Deseas aprobar <strong>{selectedIds.length}</strong> episodio(s)?
                  Serán visibles para todos los usuarios.
                </p>
              )}
              {bulkAction === "reject" && (
                <p>
                  ¿Deseas rechazar <strong>{selectedIds.length}</strong> episodio(s)?
                  Los creadores podrán verlos pero no serán públicos.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={bulkDeleteMutation.isPending || bulkUpdateStatusMutation.isPending}
              data-testid="button-cancel-bulk-action"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkAction}
              disabled={bulkDeleteMutation.isPending || bulkUpdateStatusMutation.isPending}
              className={bulkAction === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              data-testid="button-confirm-bulk-action"
            >
              {bulkDeleteMutation.isPending || bulkUpdateStatusMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
