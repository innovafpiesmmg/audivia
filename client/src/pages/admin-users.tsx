import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, ShieldCheck, ShieldAlert, User, UserCheck, UserX, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { User as UserType } from "@shared/schema";

export default function AdminUsers() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [actionType, setActionType] = useState<"role" | "approval" | "active" | null>(null);
  const [newRole, setNewRole] = useState<"LISTENER" | "CREATOR" | "ADMIN">("LISTENER");
  
  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"delete" | "activate" | "deactivate" | null>(null);

  const { data: users, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
  });

  // Reset selection when dataset changes (to avoid stale selections)
  useEffect(() => {
    if (users) {
      setSelectedIds(prev => prev.filter(id => users.some(u => u.id === id)));
    }
  }, [users]);

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Rol actualizado",
        description: "El rol del usuario ha sido actualizado correctamente.",
      });
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el rol del usuario.",
        variant: "destructive",
      });
    },
  });

  const toggleApprovalMutation = useMutation({
    mutationFn: async ({ userId, requiresApproval }: { userId: string; requiresApproval: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/requires-approval`, { requiresApproval });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Configuración actualizada",
        description: "La configuración de aprobación ha sido actualizada.",
      });
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la configuración.",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/active`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Estado actualizado",
        description: "El estado del usuario ha sido actualizado.",
      });
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado del usuario.",
        variant: "destructive",
      });
    },
  });

  // Bulk operations mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest("POST", "/api/admin/users/bulk-delete", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      
      // Show success message
      toast({
        title: "Operación completada",
        description: data.message || `Se eliminaron ${data.successIds?.length || 0} usuario(s)`,
      });
      
      // Show errors if any failures occurred
      if (data.failed && data.failed.length > 0) {
        const failedUsers = users?.filter(u => data.failed.some((f: any) => f.id === u.id)) || [];
        const failedNames = failedUsers.map(u => u.username).join(", ");
        toast({
          title: "Algunos elementos fallaron",
          description: `Los siguientes usuarios no pudieron ser eliminados: ${failedNames}`,
          variant: "destructive",
        });
      }
      
      // Only remove successful IDs from selection, keep failed ones for retry
      setSelectedIds(prev => prev.filter(id => 
        !data.successIds?.includes(id)
      ));
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron eliminar los usuarios.",
        variant: "destructive",
      });
      setBulkAction(null);
    },
  });

  const bulkUpdateActiveMutation = useMutation({
    mutationFn: async ({ ids, isActive }: { ids: string[]; isActive: boolean }) => {
      return await apiRequest("POST", "/api/admin/users/bulk-update-active", { ids, isActive });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      
      // Show success message
      toast({
        title: "Operación completada",
        description: data.message || `Se actualizaron ${data.successIds?.length || 0} usuario(s)`,
      });
      
      // Show errors if any failures occurred
      if (data.failed && data.failed.length > 0) {
        const failedUsers = users?.filter(u => data.failed.some((f: any) => f.id === u.id)) || [];
        const failedNames = failedUsers.map(u => u.username).join(", ");
        toast({
          title: "Algunos elementos fallaron",
          description: `Los siguientes usuarios no pudieron ser actualizados: ${failedNames}`,
          variant: "destructive",
        });
      }
      
      // Only remove successful IDs from selection, keep failed ones for retry
      setSelectedIds(prev => prev.filter(id => 
        !data.successIds?.includes(id)
      ));
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron actualizar los estados.",
        variant: "destructive",
      });
      setBulkAction(null);
    },
  });

  const handleRoleChange = (user: UserType) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setActionType("role");
  };

  const handleToggleApproval = (user: UserType) => {
    setSelectedUser(user);
    setActionType("approval");
  };

  const handleToggleActive = (user: UserType) => {
    setSelectedUser(user);
    setActionType("active");
  };

  const confirmAction = () => {
    if (!selectedUser) return;

    if (actionType === "role") {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    } else if (actionType === "approval") {
      toggleApprovalMutation.mutate({
        userId: selectedUser.id,
        requiresApproval: !selectedUser.requiresApproval,
      });
    } else if (actionType === "active") {
      toggleActiveMutation.mutate({
        userId: selectedUser.id,
        isActive: !selectedUser.isActive,
      });
    }
  };

  // Bulk action handlers
  const handleToggleSelection = (userId: string) => {
    setSelectedIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleAll = () => {
    if (!users) return;
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map(u => u.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkAction("delete");
  };

  const handleBulkActivate = () => {
    if (selectedIds.length === 0) return;
    setBulkAction("activate");
  };

  const handleBulkDeactivate = () => {
    if (selectedIds.length === 0) return;
    setBulkAction("deactivate");
  };

  const confirmBulkAction = () => {
    if (selectedIds.length === 0) return;

    if (bulkAction === "delete") {
      bulkDeleteMutation.mutate(selectedIds);
    } else if (bulkAction === "activate") {
      bulkUpdateActiveMutation.mutate({ ids: selectedIds, isActive: true });
    } else if (bulkAction === "deactivate") {
      bulkUpdateActiveMutation.mutate({ ids: selectedIds, isActive: false });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge variant="destructive" data-testid={`badge-role-admin`}>Admin</Badge>;
      case "CREATOR":
        return <Badge variant="default" data-testid={`badge-role-creator`}>Creador</Badge>;
      case "LISTENER":
        return <Badge variant="secondary" data-testid={`badge-role-listener`}>Oyente</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[Outfit]">Gestión de Usuarios</h1>
        <p className="text-muted-foreground mt-1">
          Administra roles, permisos y estado de los usuarios
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos los Usuarios ({users?.length || 0})</CardTitle>
          <CardDescription>
            Gestiona los roles y permisos de cada usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedIds.length > 0 && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} usuario(s) seleccionado(s)
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkActivate}
                disabled={bulkUpdateActiveMutation.isPending || bulkDeleteMutation.isPending}
                data-testid="button-bulk-activate"
              >
                {bulkUpdateActiveMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <UserCheck className="w-3 h-3 mr-1" />
                )}
                Activar Seleccionados
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkDeactivate}
                disabled={bulkUpdateActiveMutation.isPending || bulkDeleteMutation.isPending}
                data-testid="button-bulk-deactivate"
              >
                {bulkUpdateActiveMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <UserX className="w-3 h-3 mr-1" />
                )}
                Desactivar Seleccionados
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkUpdateActiveMutation.isPending || bulkDeleteMutation.isPending}
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
                    checked={users && users.length > 0 && selectedIds.length === users.length}
                    onCheckedChange={handleToggleAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Requiere Aprobación</TableHead>
                <TableHead className="text-right">Acciónes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(user.id)}
                      onCheckedChange={() => handleToggleSelection(user.id)}
                      data-testid={`checkbox-user-${user.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>
                    {user.username}
                  </TableCell>
                  <TableCell data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20" data-testid={`badge-active-${user.id}`}>
                        <UserCheck className="w-3 h-3 mr-1" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20" data-testid={`badge-inactive-${user.id}`}>
                        <UserX className="w-3 h-3 mr-1" />
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.requiresApproval ? (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20" data-testid={`badge-requires-approval-${user.id}`}>
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Sí
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20" data-testid={`badge-auto-approve-${user.id}`}>
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        No
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRoleChange(user)}
                      data-testid={`button-change-role-${user.id}`}
                    >
                      <User className="w-3 h-3 mr-1" />
                      Cambiar Rol
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleApproval(user)}
                      data-testid={`button-toggle-approval-${user.id}`}
                    >
                      {user.requiresApproval ? <ShieldCheck className="w-3 h-3 mr-1" /> : <ShieldAlert className="w-3 h-3 mr-1" />}
                      {user.requiresApproval ? "Auto-aprobar" : "Requerir Aprobación"}
                    </Button>
                    <Button
                      size="sm"
                      variant={user.isActive ? "destructive" : "default"}
                      onClick={() => handleToggleActive(user)}
                      data-testid={`button-toggle-active-${user.id}`}
                    >
                      {user.isActive ? <UserX className="w-3 h-3 mr-1" /> : <UserCheck className="w-3 h-3 mr-1" />}
                      {user.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={!!selectedUser && !!actionType} 
        onOpenChange={(open) => {
          // Prevent closing dialog during pending operations
          if (!updateRoleMutation.isPending && !toggleApprovalMutation.isPending && !toggleActiveMutation.isPending) {
            if (!open) {
              setSelectedUser(null);
              setActionType(null);
            }
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "role" && "Cambiar Rol de Usuario"}
              {actionType === "approval" && "Cambiar Configuración de Aprobación"}
              {actionType === "active" && (selectedUser?.isActive ? "Desactivar Usuario" : "Activar Usuario")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "role" && (
                <div className="space-y-4">
                  <p>
                    Estás a punto de cambiar el rol de <strong>{selectedUser?.username}</strong>.
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nuevo Rol:</label>
                    <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                      <SelectTrigger data-testid="select-new-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LISTENER">Oyente</SelectItem>
                        <SelectItem value="CREATOR">Creador</SelectItem>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {actionType === "approval" && (
                <p>
                  {selectedUser?.requiresApproval ? (
                    <>
                      El contenido de <strong>{selectedUser?.username}</strong> actualmente requiere aprobación manual.
                      ¿Deseas que su contenido se apruebe automáticamente?
                    </>
                  ) : (
                    <>
                      El contenido de <strong>{selectedUser?.username}</strong> actualmente se aprueba automáticamente.
                      ¿Deseas que su contenido requiera aprobación manual?
                    </>
                  )}
                </p>
              )}
              {actionType === "active" && (
                <p>
                  {selectedUser?.isActive ? (
                    <>
                      ¿Estás seguro de que deseas desactivar a <strong>{selectedUser?.username}</strong>?
                      No podrán iniciar sesión hasta que los reactives.
                    </>
                  ) : (
                    <>
                      ¿Deseas reactivar la cuenta de <strong>{selectedUser?.username}</strong>?
                    </>
                  )}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={updateRoleMutation.isPending || toggleApprovalMutation.isPending || toggleActiveMutation.isPending}
              data-testid="button-cancel-action"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmAction}
              disabled={updateRoleMutation.isPending || toggleApprovalMutation.isPending || toggleActiveMutation.isPending}
              data-testid="button-confirm-action"
            >
              {updateRoleMutation.isPending || toggleApprovalMutation.isPending || toggleActiveMutation.isPending ? (
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
          // Prevent closing dialog during pending operations
          if (!bulkDeleteMutation.isPending && !bulkUpdateActiveMutation.isPending) {
            if (!open) setBulkAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "delete" && "Eliminar Usuarios"}
              {bulkAction === "activate" && "Activar Usuarios"}
              {bulkAction === "deactivate" && "Desactivar Usuarios"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "delete" && (
                <p>
                  ¿Estás seguro de que deseas eliminar <strong>{selectedIds.length}</strong> usuario(s)? 
                  Esta acción no se puede deshacer.
                </p>
              )}
              {bulkAction === "activate" && (
                <p>
                  ¿Deseas activar <strong>{selectedIds.length}</strong> usuario(s)?
                </p>
              )}
              {bulkAction === "deactivate" && (
                <p>
                  ¿Deseas desactivar <strong>{selectedIds.length}</strong> usuario(s)?
                  No podrán iniciar sesión hasta que los reactives.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={bulkDeleteMutation.isPending || bulkUpdateActiveMutation.isPending}
              data-testid="button-cancel-bulk-action"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkAction}
              disabled={bulkDeleteMutation.isPending || bulkUpdateActiveMutation.isPending}
              data-testid="button-confirm-bulk-action"
            >
              {bulkDeleteMutation.isPending || bulkUpdateActiveMutation.isPending ? (
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
