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
import { Loader2, CheckCircle, XCircle, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import type { Podcast, User } from "@shared/schema";

interface PodcastWithOwner extends Podcast {
  owner: User;
}

type StatusFilter = "all" | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export default function AdminPodcasts() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPodcast, setSelectedPodcast] = useState<PodcastWithOwner | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "delete" | null>(null);
  
  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"delete" | "approve" | "reject" | null>(null);

  const { data: allPodcasts, isLoading } = useQuery<PodcastWithOwner[]>({
    queryKey: ["/api/admin/podcasts"],
  });

  // Reset selection when dataset changes (to avoid stale selections)
  useEffect(() => {
    if (allPodcasts) {
      setSelectedIds(prev => prev.filter(id => allPodcasts.some(p => p.id === id)));
    }
  }, [allPodcasts]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, searchQuery]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ podcastId, status }: { podcastId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/podcasts/${podcastId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      toast({
        title: "Estado actualizado",
        description: "El estado del podcast ha sido actualizado correctamente.",
      });
      setSelectedPodcast(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado del podcast.",
        variant: "destructive",
      });
    },
  });

  const deletePodcastMutation = useMutation({
    mutationFn: async (podcastId: string) => {
      return await apiRequest("DELETE", `/api/admin/podcasts/${podcastId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      toast({
        title: "Podcast eliminado",
        description: "El podcast ha sido eliminado correctamente.",
      });
      setSelectedPodcast(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el podcast.",
        variant: "destructive",
      });
    },
  });

  // Bulk operations mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest("POST", "/api/admin/podcasts/bulk-delete", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      
      toast({
        title: "Operación completada",
        description: data.message || `Se eliminaron ${data.successIds?.length || 0} podcast(s)`,
      });
      
      if (data.failed && data.failed.length > 0) {
        const failedPodcasts = allPodcasts?.filter(p => data.failed.some((f: any) => f.id === p.id)) || [];
        const failedTitles = failedPodcasts.map(p => p.title).join(", ");
        toast({
          title: "Algunos elementos fallaron",
          description: `Los siguientes podcasts no pudieron ser eliminados: ${failedTitles}`,
          variant: "destructive",
        });
      }
      
      setSelectedIds(prev => prev.filter(id => !data.successIds?.includes(id)));
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron eliminar los podcasts.",
        variant: "destructive",
      });
      setBulkAction(null);
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      return await apiRequest("POST", "/api/admin/podcasts/bulk-update-status", { ids, status });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      
      toast({
        title: "Operación completada",
        description: data.message || `Se actualizaron ${data.successIds?.length || 0} podcast(s)`,
      });
      
      if (data.failed && data.failed.length > 0) {
        const failedPodcasts = allPodcasts?.filter(p => data.failed.some((f: any) => f.id === p.id)) || [];
        const failedTitles = failedPodcasts.map(p => p.title).join(", ");
        toast({
          title: "Algunos elementos fallaron",
          description: `Los siguientes podcasts no pudieron ser actualizados: ${failedTitles}`,
          variant: "destructive",
        });
      }
      
      setSelectedIds(prev => prev.filter(id => !data.successIds?.includes(id)));
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron actualizar los podcasts.",
        variant: "destructive",
      });
      setBulkAction(null);
    },
  });

  const handleApprove = (podcast: PodcastWithOwner) => {
    setSelectedPodcast(podcast);
    setActionType("approve");
  };

  const handleReject = (podcast: PodcastWithOwner) => {
    setSelectedPodcast(podcast);
    setActionType("reject");
  };

  const handleDelete = (podcast: PodcastWithOwner) => {
    setSelectedPodcast(podcast);
    setActionType("delete");
  };

  const confirmAction = () => {
    if (!selectedPodcast) return;

    if (actionType === "approve") {
      updateStatusMutation.mutate({ podcastId: selectedPodcast.id, status: "APPROVED" });
    } else if (actionType === "reject") {
      updateStatusMutation.mutate({ podcastId: selectedPodcast.id, status: "REJECTED" });
    } else if (actionType === "delete") {
      deletePodcastMutation.mutate(selectedPodcast.id);
    }
  };

  // Bulk operation handlers
  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (selectedIds.length === filteredPodcasts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPodcasts.map(p => p.id));
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

  // Filter podcasts
  const filteredPodcasts = allPodcasts?.filter((podcast) => {
    const matchesStatus = statusFilter === "all" || podcast.status === statusFilter;
    const matchesSearch = searchQuery === "" ||
      podcast.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      podcast.description?.toLowerCase().includes(searchQuery.toLowerCase());
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
        <h1 className="text-3xl font-bold font-[Outfit]">Moderación de Podcasts</h1>
        <p className="text-muted-foreground mt-1">
          Revisa y gestiona los podcasts de la plataforma
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
                placeholder="Buscar por título o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-podcasts"
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
            Podcasts ({filteredPodcasts.length})
          </CardTitle>
          <CardDescription>
            {statusFilter === "all" ? "Todos los podcasts" : `Podcasts con estado: ${statusFilter}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedIds.length > 0 && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} podcast(s) seleccionado(s)
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
                    checked={filteredPodcasts && filteredPodcasts.length > 0 && selectedIds.length === filteredPodcasts.length}
                    onCheckedChange={handleToggleAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Creador</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead className="text-right">Acciónes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPodcasts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No se encontraron podcasts
                  </TableCell>
                </TableRow>
              ) : (
                filteredPodcasts.map((podcast) => (
                  <TableRow key={podcast.id} data-testid={`row-podcast-${podcast.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(podcast.id)}
                        onCheckedChange={() => handleToggleSelection(podcast.id)}
                        data-testid={`checkbox-podcast-${podcast.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-xs" data-testid={`text-title-${podcast.id}`}>
                      <div className="truncate">{podcast.title}</div>
                      {podcast.description && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {podcast.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-owner-${podcast.id}`}>
                      {podcast.owner?.username || "Desconocido"}
                    </TableCell>
                    <TableCell>{getStatusBadge(podcast.status)}</TableCell>
                    <TableCell>
                      {format(new Date(podcast.createdAt || Date.now()), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {podcast.status !== "APPROVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(podcast)}
                          className="text-green-600 hover:text-green-700"
                          data-testid={`button-approve-${podcast.id}`}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Aprobar
                        </Button>
                      )}
                      {podcast.status !== "REJECTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(podcast)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-reject-${podcast.id}`}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Rechazar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(podcast)}
                        data-testid={`button-delete-${podcast.id}`}
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
        open={!!selectedPodcast && !!actionType} 
        onOpenChange={(open) => {
          if (!updateStatusMutation.isPending && !deletePodcastMutation.isPending) {
            if (!open) {
              setSelectedPodcast(null);
              setActionType(null);
            }
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve" && "Aprobar Podcast"}
              {actionType === "reject" && "Rechazar Podcast"}
              {actionType === "delete" && "Eliminar Podcast"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve" && (
                <p>
                  ¿Estás seguro de que deseas aprobar el podcast <strong>{selectedPodcast?.title}</strong>?
                  Será visible para todos los usuarios.
                </p>
              )}
              {actionType === "reject" && (
                <p>
                  ¿Estás seguro de que deseas rechazar el podcast <strong>{selectedPodcast?.title}</strong>?
                  El creador podrá verlo pero no será público.
                </p>
              )}
              {actionType === "delete" && (
                <p className="text-red-600">
                  ¿Estás seguro de que deseas eliminar permanentemente el podcast <strong>{selectedPodcast?.title}</strong>?
                  Esta acción no se puede deshacer y también eliminará todos sus episodios.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={updateStatusMutation.isPending || deletePodcastMutation.isPending}
              data-testid="button-cancel-action"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={updateStatusMutation.isPending || deletePodcastMutation.isPending}
              className={actionType === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              data-testid="button-confirm-action"
            >
              {updateStatusMutation.isPending || deletePodcastMutation.isPending ? (
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
              {bulkAction === "delete" && "Eliminar Podcasts"}
              {bulkAction === "approve" && "Aprobar Podcasts"}
              {bulkAction === "reject" && "Rechazar Podcasts"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "delete" && (
                <p className="text-red-600">
                  ¿Estás seguro de que deseas eliminar <strong>{selectedIds.length}</strong> podcast(s)? 
                  Esta acción no se puede deshacer y también eliminará todos sus episodios.
                </p>
              )}
              {bulkAction === "approve" && (
                <p>
                  ¿Deseas aprobar <strong>{selectedIds.length}</strong> podcast(s)?
                  Serán visibles para todos los usuarios.
                </p>
              )}
              {bulkAction === "reject" && (
                <p>
                  ¿Deseas rechazar <strong>{selectedIds.length}</strong> podcast(s)?
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
