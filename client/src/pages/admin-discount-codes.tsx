import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, Loader2, Percent, Euro } from "lucide-react";
import type { DiscountCode } from "@shared/schema";

export default function AdminDiscountCodes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    type: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
    value: 0,
    minPurchaseCents: 0,
    maxUsesTotal: "",
    maxUsesPerUser: 1,
    validFrom: "",
    validUntil: "",
    isActive: true,
    appliesToSubscriptions: false,
    appliesToPurchases: true,
  });

  const { data: discountCodes = [], isLoading } = useQuery<DiscountCode[]>({
    queryKey: ["/api/admin/discount-codes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/discount-codes", {
        ...data,
        value: data.type === "FIXED_AMOUNT" ? data.value * 100 : data.value,
        minPurchaseCents: data.minPurchaseCents * 100,
        maxUsesTotal: data.maxUsesTotal ? parseInt(data.maxUsesTotal) : null,
        validFrom: data.validFrom || null,
        validUntil: data.validUntil || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discount-codes"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Codigo creado", description: "El codigo de descuento ha sido creado correctamente" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Error creando codigo" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/admin/discount-codes/${id}`, {
        ...data,
        value: data.type === "FIXED_AMOUNT" ? data.value * 100 : data.value,
        minPurchaseCents: data.minPurchaseCents * 100,
        maxUsesTotal: data.maxUsesTotal ? parseInt(data.maxUsesTotal) : null,
        validFrom: data.validFrom || null,
        validUntil: data.validUntil || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discount-codes"] });
      setEditingCode(null);
      resetForm();
      toast({ title: "Codigo actualizado", description: "El codigo de descuento ha sido actualizado correctamente" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Error actualizando codigo" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/discount-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discount-codes"] });
      toast({ title: "Codigo eliminado", description: "El codigo de descuento ha sido eliminado" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Error eliminando codigo" });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      type: "PERCENTAGE",
      value: 0,
      minPurchaseCents: 0,
      maxUsesTotal: "",
      maxUsesPerUser: 1,
      validFrom: "",
      validUntil: "",
      isActive: true,
      appliesToSubscriptions: false,
      appliesToPurchases: true,
    });
  };

  const openEditDialog = (code: DiscountCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description || "",
      type: code.type,
      value: code.type === "FIXED_AMOUNT" ? code.value / 100 : code.value,
      minPurchaseCents: (code.minPurchaseCents || 0) / 100,
      maxUsesTotal: code.maxUsesTotal?.toString() || "",
      maxUsesPerUser: code.maxUsesPerUser || 1,
      validFrom: code.validFrom ? new Date(code.validFrom).toISOString().split("T")[0] : "",
      validUntil: code.validUntil ? new Date(code.validUntil).toISOString().split("T")[0] : "",
      isActive: code.isActive,
      appliesToSubscriptions: code.appliesToSubscriptions,
      appliesToPurchases: code.appliesToPurchases,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatValue = (code: DiscountCode) => {
    if (code.type === "PERCENTAGE") {
      return `${code.value}%`;
    }
    return `${(code.value / 100).toFixed(2)} EUR`;
  };

  const isCodeValid = (code: DiscountCode) => {
    if (!code.isActive) return false;
    const now = new Date();
    if (code.validFrom && now < new Date(code.validFrom)) return false;
    if (code.validUntil && now > new Date(code.validUntil)) return false;
    if (code.maxUsesTotal && code.usedCount >= code.maxUsesTotal) return false;
    return true;
  };

  const FormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">Codigo</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="DESCUENTO20"
            required
            data-testid="input-discount-code"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as typeof formData.type })}>
            <SelectTrigger data-testid="select-discount-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENTAGE">Porcentaje</SelectItem>
              <SelectItem value="FIXED_AMOUNT">Monto Fijo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripcion</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripcion del descuento"
          data-testid="input-discount-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="value">
            Valor {formData.type === "PERCENTAGE" ? "(%)" : "(EUR)"}
          </Label>
          <Input
            id="value"
            type="number"
            min="0"
            max={formData.type === "PERCENTAGE" ? 100 : undefined}
            step={formData.type === "PERCENTAGE" ? 1 : 0.01}
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
            required
            data-testid="input-discount-value"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minPurchase">Compra Minima (EUR)</Label>
          <Input
            id="minPurchase"
            type="number"
            min="0"
            step="0.01"
            value={formData.minPurchaseCents}
            onChange={(e) => setFormData({ ...formData, minPurchaseCents: parseFloat(e.target.value) || 0 })}
            data-testid="input-discount-min-purchase"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxUsesTotal">Usos Totales (vacio = ilimitado)</Label>
          <Input
            id="maxUsesTotal"
            type="number"
            min="1"
            value={formData.maxUsesTotal}
            onChange={(e) => setFormData({ ...formData, maxUsesTotal: e.target.value })}
            placeholder="Ilimitado"
            data-testid="input-discount-max-uses"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxUsesPerUser">Usos por Usuario</Label>
          <Input
            id="maxUsesPerUser"
            type="number"
            min="1"
            value={formData.maxUsesPerUser}
            onChange={(e) => setFormData({ ...formData, maxUsesPerUser: parseInt(e.target.value) || 1 })}
            data-testid="input-discount-max-per-user"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="validFrom">Valido Desde</Label>
          <Input
            id="validFrom"
            type="date"
            value={formData.validFrom}
            onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
            data-testid="input-discount-valid-from"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="validUntil">Valido Hasta</Label>
          <Input
            id="validUntil"
            type="date"
            value={formData.validUntil}
            onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
            data-testid="input-discount-valid-until"
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="isActive">Activo</Label>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            data-testid="switch-discount-active"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="appliesToPurchases">Aplica a Compras</Label>
          <Switch
            id="appliesToPurchases"
            checked={formData.appliesToPurchases}
            onCheckedChange={(checked) => setFormData({ ...formData, appliesToPurchases: checked })}
            data-testid="switch-discount-purchases"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="appliesToSubscriptions">Aplica a Suscripciónes</Label>
          <Switch
            id="appliesToSubscriptions"
            checked={formData.appliesToSubscriptions}
            onCheckedChange={(checked) => setFormData({ ...formData, appliesToSubscriptions: checked })}
            data-testid="switch-discount-subscriptions"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-discount">
          {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {editingCode ? "Guardar Cambios" : "Crear Codigo"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl font-bold" data-testid="text-page-title">
            Codigos de Descuento
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona los codigos de descuento para compras y suscripciónes
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-discount">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Codigo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Codigo de Descuento</DialogTitle>
              <DialogDescription>
                Crea un nuevo codigo de descuento para tus clientes
              </DialogDescription>
            </DialogHeader>
            <FormContent />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Codigos Disponibles
          </CardTitle>
          <CardDescription>
            Lista de todos los codigos de descuento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : discountCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay codigos de descuento</p>
              <p className="text-sm">Crea tu primer codigo con el boton de arriba</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Validez</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discountCodes.map((code) => (
                    <TableRow key={code.id} data-testid={`row-discount-${code.id}`}>
                      <TableCell className="font-mono font-bold">{code.code}</TableCell>
                      <TableCell>
                        {code.type === "PERCENTAGE" ? (
                          <Badge variant="outline"><Percent className="w-3 h-3 mr-1" />Porcentaje</Badge>
                        ) : (
                          <Badge variant="outline"><Euro className="w-3 h-3 mr-1" />Monto Fijo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{formatValue(code)}</TableCell>
                      <TableCell>
                        {code.usedCount}{code.maxUsesTotal ? `/${code.maxUsesTotal}` : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {code.validFrom || code.validUntil ? (
                          <>
                            {code.validFrom && <div>Desde: {new Date(code.validFrom).toLocaleDateString("es-ES")}</div>}
                            {code.validUntil && <div>Hasta: {new Date(code.validUntil).toLocaleDateString("es-ES")}</div>}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Sin limite</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isCodeValid(code) ? (
                          <Badge variant="default">Activo</Badge>
                        ) : (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog open={editingCode?.id === code.id} onOpenChange={(open) => { if (!open) { setEditingCode(null); resetForm(); } }}>
                            <DialogTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => openEditDialog(code)} data-testid={`button-edit-discount-${code.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Editar Codigo de Descuento</DialogTitle>
                                <DialogDescription>
                                  Modifica los detalles del codigo {code.code}
                                </DialogDescription>
                              </DialogHeader>
                              <FormContent />
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`¿Eliminar el codigo ${code.code}?`)) {
                                deleteMutation.mutate(code.id);
                              }
                            }}
                            data-testid={`button-delete-discount-${code.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
