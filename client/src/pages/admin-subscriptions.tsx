import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Crown, Plus, CreditCard, Pencil, RefreshCw, Check, AlertCircle } from "lucide-react";
import type { SubscriptionPlan } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priceCents: 999,
    currency: "EUR",
    intervalMonths: 1,
    trialDays: 0,
  });
  const [syncingPlanId, setSyncingPlanId] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/subscription-plans"],
  });

  const { data: paypalConfig } = useQuery<{ clientId: string; environment: string } | null>({
    queryKey: ["/api/admin/paypal/config"],
  });

  const syncWithPayPalMutation = useMutation({
    mutationFn: async (plan: SubscriptionPlan) => {
      setSyncingPlanId(plan.id);
      
      const product = await apiRequest("POST", "/api/admin/paypal/products", {
        name: "Audivia Suscripción",
        description: "Suscripción premium a Audivia - Audiolibros ilimitados",
      });
      
      const paypalPlan = await apiRequest("POST", "/api/admin/paypal/plans", {
        productId: product.id,
        name: plan.name,
        description: plan.description || `Suscripción ${plan.name}`,
        priceCents: plan.priceCents,
        currency: plan.currency,
        intervalMonths: plan.intervalMonths,
        trialDays: plan.trialDays || 0,
      });
      
      await apiRequest("PATCH", `/api/admin/subscription-plans/${plan.id}/paypal`, {
        paypalPlanId: paypalPlan.id,
        paypalProductId: product.id,
      });
      
      return paypalPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({
        title: "Sincronizado con PayPal",
        description: "El plan ahora está disponible para suscripciones.",
      });
      setSyncingPlanId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error de sincronización",
        description: error.message || "No se pudo sincronizar con PayPal. Verifica la configuración.",
        variant: "destructive",
      });
      setSyncingPlanId(null);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return await apiRequest("DELETE", `/api/admin/subscription-plans/${planId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({
        title: "Plan eliminado",
        description: "El plan de suscripción ha sido eliminado correctamente.",
      });
      setSelectedPlan(null);
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el plan.",
        variant: "destructive",
      });
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/subscription-plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({
        title: "Plan creado",
        description: "El plan de suscripción ha sido creado correctamente.",
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el plan.",
        variant: "destructive",
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData & { isActive?: boolean } }) => {
      return await apiRequest("PATCH", `/api/admin/subscription-plans/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({
        title: "Plan actualizado",
        description: "El plan de suscripción ha sido actualizado correctamente.",
      });
      setShowEditDialog(false);
      setEditingPlan(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el plan.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      priceCents: 999,
      currency: "EUR",
      intervalMonths: 1,
      trialDays: 0,
    });
  };

  const handleDeleteClick = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowDeleteDialog(true);
  };

  const handleEditClick = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      priceCents: plan.priceCents,
      currency: plan.currency,
      intervalMonths: plan.intervalMonths,
      trialDays: plan.trialDays || 0,
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = () => {
    if (!editingPlan) return;
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Por favor ingresa el nombre del plan.",
        variant: "destructive",
      });
      return;
    }
    updatePlanMutation.mutate({ 
      id: editingPlan.id, 
      data: { ...formData, isActive: editingPlan.isActive } 
    });
  };

  const togglePlanActive = (plan: SubscriptionPlan) => {
    updatePlanMutation.mutate({
      id: plan.id,
      data: {
        name: plan.name,
        description: plan.description || "",
        priceCents: plan.priceCents,
        currency: plan.currency,
        intervalMonths: plan.intervalMonths,
        isActive: !plan.isActive,
      },
    });
  };

  const confirmDelete = () => {
    if (selectedPlan) {
      deletePlanMutation.mutate(selectedPlan.id);
    }
  };

  const handleCreateSubmit = () => {
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Por favor ingresa el nombre del plan.",
        variant: "destructive",
      });
      return;
    }
    createPlanMutation.mutate(formData);
  };

  const formatPrice = (cents: number, currency: string = "EUR") => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  const getIntervalLabel = (months: number) => {
    if (months === 1) return "Mensual";
    if (months === 3) return "Trimestral";
    if (months === 6) return "Semestral";
    if (months === 12) return "Anual";
    return `${months} meses`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="font-serif text-2xl flex items-center gap-2">
                <Crown className="w-6 h-6" />
                Gestion de Suscripciónes
              </CardTitle>
              <CardDescription>
                Administra los planes de suscripción disponibles
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-plan">
              <Plus className="w-4 h-4 mr-2" />
              Añadir Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay planes de suscripción</p>
              <p className="text-sm text-muted-foreground mt-2">
                Crea tu primer plan para que los usuarios puedan suscribirse
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Prueba</TableHead>
                    <TableHead>PayPal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                            <Crown className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <span className="font-medium">{plan.name}</span>
                            {plan.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {plan.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {formatPrice(plan.priceCents, plan.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getIntervalLabel(plan.intervalMonths)}</Badge>
                      </TableCell>
                      <TableCell>
                        {plan.trialDays > 0 ? (
                          <Badge variant="secondary">{plan.trialDays} días</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {plan.paypalPlanId ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="default" className="gap-1">
                                <Check className="w-3 h-3" />
                                Vinculado
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">ID: {plan.paypalPlanId}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : paypalConfig?.clientId ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncWithPayPalMutation.mutate(plan)}
                            disabled={syncingPlanId === plan.id}
                            data-testid={`button-sync-paypal-${plan.id}`}
                          >
                            {syncingPlanId === plan.id ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3 mr-1" />
                            )}
                            Sincronizar
                          </Button>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Sin config
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Configura PayPal primero</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePlanActive(plan)}
                          data-testid={`button-toggle-plan-${plan.id}`}
                        >
                          <Badge variant={plan.isActive ? "default" : "secondary"}>
                            {plan.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(plan)}
                            data-testid={`button-edit-plan-${plan.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(plan)}
                            data-testid={`button-delete-plan-${plan.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Añadir Plan de Suscripción</DialogTitle>
            <DialogDescription>
              Crea un nuevo plan de suscripción para los usuarios
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre del plan *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Premium, Pro, etc."
                data-testid="input-plan-name"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe los beneficios del plan..."
                rows={3}
                data-testid="input-plan-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio (centimos)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={formData.priceCents}
                  onChange={(e) => setFormData({ ...formData, priceCents: parseInt(e.target.value) || 0 })}
                  placeholder="999"
                  data-testid="input-plan-price"
                />
                <p className="text-xs text-muted-foreground">
                  {formatPrice(formData.priceCents, formData.currency)}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger data-testid="select-plan-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="interval">Intervalo de facturacion</Label>
              <Select
                value={formData.intervalMonths.toString()}
                onValueChange={(value) => setFormData({ ...formData, intervalMonths: parseInt(value) })}
              >
                <SelectTrigger data-testid="select-plan-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Mensual (cada mes)</SelectItem>
                  <SelectItem value="3">Trimestral (cada 3 meses)</SelectItem>
                  <SelectItem value="6">Semestral (cada 6 meses)</SelectItem>
                  <SelectItem value="12">Anual (cada 12 meses)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="trial">Periodo de prueba (dias)</Label>
              <Input
                id="trial"
                type="number"
                min={0}
                max={90}
                value={formData.trialDays}
                onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value) || 0 })}
                placeholder="0"
                data-testid="input-plan-trial"
              />
              <p className="text-xs text-muted-foreground">
                {formData.trialDays > 0 ? `${formData.trialDays} dias de prueba gratis` : "Sin periodo de prueba"}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createPlanMutation.isPending} data-testid="button-submit-plan">
              {createPlanMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Crear Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Editar Plan de Suscripción</DialogTitle>
            <DialogDescription>
              Modifica los datos del plan de suscripción
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre del plan *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Premium, Pro, etc."
                data-testid="input-edit-plan-name"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descripcion</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe los beneficios del plan..."
                rows={3}
                data-testid="input-edit-plan-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-price">Precio (centimos)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min={0}
                  value={formData.priceCents}
                  onChange={(e) => setFormData({ ...formData, priceCents: parseInt(e.target.value) || 0 })}
                  placeholder="999"
                  data-testid="input-edit-plan-price"
                />
                <p className="text-xs text-muted-foreground">
                  {formatPrice(formData.priceCents, formData.currency)}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-currency">Moneda</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger data-testid="select-edit-plan-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-interval">Intervalo de facturacion</Label>
              <Select
                value={formData.intervalMonths.toString()}
                onValueChange={(value) => setFormData({ ...formData, intervalMonths: parseInt(value) })}
              >
                <SelectTrigger data-testid="select-edit-plan-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Mensual (cada mes)</SelectItem>
                  <SelectItem value="3">Trimestral (cada 3 meses)</SelectItem>
                  <SelectItem value="6">Semestral (cada 6 meses)</SelectItem>
                  <SelectItem value="12">Anual (cada 12 meses)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-trial">Periodo de prueba (dias)</Label>
              <Input
                id="edit-trial"
                type="number"
                min={0}
                max={90}
                value={formData.trialDays}
                onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value) || 0 })}
                placeholder="0"
                data-testid="input-edit-plan-trial"
              />
              <p className="text-xs text-muted-foreground">
                {formData.trialDays > 0 ? `${formData.trialDays} dias de prueba gratis` : "Sin periodo de prueba"}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingPlan(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} disabled={updatePlanMutation.isPending} data-testid="button-update-plan">
              {updatePlanMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Pencil className="w-4 h-4 mr-2" />
              )}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plan</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente el plan
              "{selectedPlan?.name}". Los usuarios con este plan mantendrán su suscripción hasta
              que expire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlanMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
