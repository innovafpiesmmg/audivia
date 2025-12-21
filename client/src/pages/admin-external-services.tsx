import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ExternalLink, Plus, Trash2, Edit, Server, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ExternalService } from "@shared/schema";

const serviceSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  description: z.string().optional(),
  url: z.string().url("URL inválida"),
  iconName: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export default function AdminExternalServices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ExternalService | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: services, isLoading } = useQuery<ExternalService[]>({
    queryKey: ["/api/admin/external-services"],
  });

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      url: "",
      iconName: "ExternalLink",
      sortOrder: 0,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      return await apiRequest("POST", "/api/admin/external-services", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external-services"] });
      toast({ title: "Servicio creado", description: "El servicio externo ha sido agregado." });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ServiceFormData }) => {
      return await apiRequest("PATCH", `/api/admin/external-services/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external-services"] });
      toast({ title: "Servicio actualizado", description: "Los cambios han sido guardados." });
      setIsDialogOpen(false);
      setEditingService(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/external-services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external-services"] });
      toast({ title: "Servicio eliminado" });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const openAddDialog = () => {
    setEditingService(null);
    form.reset({
      name: "",
      description: "",
      url: "",
      iconName: "ExternalLink",
      sortOrder: services?.length || 0,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (service: ExternalService) => {
    setEditingService(service);
    form.reset({
      name: service.name,
      description: service.description || "",
      url: service.url,
      iconName: service.iconName || "ExternalLink",
      sortOrder: service.sortOrder,
      isActive: service.isActive,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ServiceFormData) => {
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openInNewWindow = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Server className="h-8 w-8" />
            Servicios Externos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona enlaces rápidos a tus servicios externos
          </p>
        </div>
        <Button onClick={openAddDialog} data-testid="button-add-service">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Servicio
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis Servicios</CardTitle>
          <CardDescription>
            Haz clic en un servicio para abrirlo en una nueva ventana
          </CardDescription>
        </CardHeader>
        <CardContent>
          {services && services.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} data-testid={`row-service-${service.id}`}>
                    <TableCell className="font-medium">
                      <button
                        onClick={() => openInNewWindow(service.url)}
                        className="flex items-center gap-2 text-left hover:text-primary transition-colors"
                        data-testid={`button-open-service-${service.id}`}
                      >
                        <Globe className="h-4 w-4" />
                        {service.name}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {service.description || "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {service.url}
                    </TableCell>
                    <TableCell>
                      <Badge variant={service.isActive ? "default" : "secondary"}>
                        {service.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(service)}
                          data-testid={`button-edit-service-${service.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(service.id)}
                          data-testid={`button-delete-service-${service.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay servicios externos configurados</p>
              <p className="text-sm mt-1">Agrega tus servicios para acceder rápidamente desde aquí</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Servicio" : "Agregar Servicio"}
            </DialogTitle>
            <DialogDescription>
              {editingService 
                ? "Modifica los datos del servicio externo" 
                : "Agrega un nuevo enlace a un servicio externo"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Mi Servidor" data-testid="input-service-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://mi-servicio.com" data-testid="input-service-url" />
                    </FormControl>
                    <FormDescription>
                      Incluye https:// o http://
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Panel de administración del servidor" data-testid="input-service-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orden</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-service-order"
                      />
                    </FormControl>
                    <FormDescription>
                      Los servicios se ordenan de menor a mayor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>
                        Solo los servicios activos se muestran en la lista
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-service-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-service"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
