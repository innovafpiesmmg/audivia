import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Users, Search, Mail, User, CreditCard, FileText, Download, 
  Calendar, ShoppingBag, MapPin, Phone, Building, ChevronLeft,
  DollarSign, Receipt, Filter, X, Trash2, RefreshCw, AlertCircle, FileSpreadsheet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User as UserType, BillingProfile, AudiobookPurchase, Audiobook, Invoice, UserSubscription } from "@shared/schema";

interface CustomerWithStats {
  user: UserType;
  billingProfile: BillingProfile | null;
  totalPurchases: number;
  totalSpentCents: number;
  lastPurchaseAt: string | null;
}

interface CustomerDetail {
  user: UserType;
  billingProfile: BillingProfile | null;
  purchases: Array<AudiobookPurchase & { audiobook: Audiobook }>;
  invoices: Invoice[];
  subscription: UserSubscription | null;
  stats: { totalPurchases: number; totalSpentCents: number; lastPurchaseAt: string | null };
}

interface InvoiceWithUser extends Invoice {
  user: UserType;
}

interface PurchaseWithDetails extends AudiobookPurchase {
  user: UserType;
  audiobook: Audiobook;
}

function formatPrice(cents: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(cents / 100);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CustomerRow({ customer, onClick }: { customer: CustomerWithStats; onClick: () => void }) {
  return (
    <div 
      className="flex items-center gap-4 p-4 border-b hover-elevate cursor-pointer"
      onClick={onClick}
      data-testid={`customer-row-${customer.user.id}`}
    >
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{customer.user.username}</p>
        <p className="text-sm text-muted-foreground truncate">{customer.user.email}</p>
      </div>
      <div className="hidden md:flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm font-medium">{customer.totalPurchases}</p>
          <p className="text-xs text-muted-foreground">Compras</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{formatPrice(customer.totalSpentCents)}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{formatDate(customer.lastPurchaseAt)}</p>
          <p className="text-xs text-muted-foreground">Ultima compra</p>
        </div>
      </div>
      <Badge variant={customer.billingProfile ? "default" : "outline"}>
        {customer.billingProfile ? "Perfil completo" : "Sin perfil"}
      </Badge>
      <Badge variant="secondary">{customer.user.role}</Badge>
    </div>
  );
}

function CustomerDetailView({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data: customer, isLoading } = useQuery<CustomerDetail>({
    queryKey: ["/api/admin/customers", customerId],
  });

  const handleDownloadInvoice = (invoiceId: string) => {
    window.open(`/api/admin/invoices/${invoiceId}/download`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Cliente no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-serif font-bold">{customer.user.username}</h2>
          <p className="text-muted-foreground">{customer.user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">{customer.user.role}</Badge>
          {customer.subscription?.status === "ACTIVE" && (
            <Badge variant="default">Suscriptor</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{customer.stats.totalPurchases}</p>
                <p className="text-sm text-muted-foreground">Compras</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{formatPrice(customer.stats.totalSpentCents)}</p>
                <p className="text-sm text-muted-foreground">Total gastado</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Receipt className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{customer.invoices.length}</p>
                <p className="text-sm text-muted-foreground">Facturas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{formatDate(customer.stats.lastPurchaseAt)}</p>
                <p className="text-sm text-muted-foreground">Ultima compra</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {customer.billingProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Datos de facturacion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Nombre:</span>
                  <span>{customer.billingProfile.legalName}</span>
                </div>
                {customer.billingProfile.companyName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Empresa:</span>
                    <span>{customer.billingProfile.companyName}</span>
                  </div>
                )}
                {customer.billingProfile.taxId && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">NIF/CIF:</span>
                    <span>{customer.billingProfile.taxId}</span>
                  </div>
                )}
                {customer.billingProfile.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Telefono:</span>
                    <span>{customer.billingProfile.phone}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">Direccion:</span>
                    <p>{customer.billingProfile.addressLine1}</p>
                    {customer.billingProfile.addressLine2 && <p>{customer.billingProfile.addressLine2}</p>}
                    <p>{customer.billingProfile.postalCode} {customer.billingProfile.city}</p>
                    {customer.billingProfile.state && <p>{customer.billingProfile.state}</p>}
                    <p>{customer.billingProfile.country}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases" data-testid="tab-purchases">
            Compras ({customer.purchases.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">
            Facturas ({customer.invoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {customer.purchases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay compras registradas
                </div>
              ) : (
                <div className="divide-y">
                  {customer.purchases.map((purchase) => (
                    <div key={purchase.id} className="flex items-center gap-4 p-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        {purchase.audiobook.coverArtUrl ? (
                          <img
                            src={purchase.audiobook.coverArtUrl}
                            alt={purchase.audiobook.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{purchase.audiobook.title}</p>
                        <p className="text-sm text-muted-foreground">{purchase.audiobook.author}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatPrice(purchase.pricePaidCents, purchase.currency)}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(purchase.purchasedAt)}</p>
                      </div>
                      <Badge variant={purchase.status === "COMPLETED" ? "default" : "secondary"}>
                        {purchase.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {customer.invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay facturas registradas
                </div>
              ) : (
                <div className="divide-y">
                  {customer.invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(invoice.issueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatPrice(invoice.totalCents, invoice.currency)}</p>
                      </div>
                      <Badge variant={invoice.status === "PAID" ? "default" : "secondary"}>
                        {invoice.status}
                      </Badge>
                      {invoice.pdfPath && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDownloadInvoice(invoice.id)}
                          data-testid={`download-invoice-${invoice.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PurchasesTab({ customers }: { customers: CustomerWithStats[] | undefined }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const { toast } = useToast();

  const statusFilter = status === "all" ? undefined : status;
  const userFilter = userId === "all" ? undefined : userId;
  
  const { data: purchases, isLoading, refetch } = useQuery<PurchaseWithDetails[]>({
    queryKey: ["/api/admin/purchases", { status: statusFilter, userId: userFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (userFilter) params.append("userId", userFilter);
      const url = `/api/admin/purchases${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando compras");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      await apiRequest("DELETE", `/api/admin/purchases/${purchaseId}`);
    },
    onSuccess: () => {
      toast({ title: "Compra eliminada", description: "La compra pendiente ha sido eliminada" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo eliminar la compra", variant: "destructive" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cleanup-pending");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Limpieza completada", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error en la limpieza", variant: "destructive" });
    },
  });

  const filteredPurchases = purchases?.filter(p => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!p.user.username.toLowerCase().includes(searchLower) &&
          !p.user.email.toLowerCase().includes(searchLower) &&
          !p.audiobook.title.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  }) || [];

  const pendingCount = purchases?.filter(p => p.status === "PENDING").length || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o audiobook..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-purchases"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-purchase-status">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
            <SelectItem value="REFUNDED">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-[200px]" data-testid="select-purchase-user">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {customers?.map((c) => (
              <SelectItem key={c.user.id} value={c.user.id}>
                {c.user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pendingCount > 0 && (
          <Button 
            variant="outline" 
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            data-testid="button-cleanup-pending"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${cleanupMutation.isPending ? "animate-spin" : ""}`} />
            Limpiar pendientes ({pendingCount})
          </Button>
        )}
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
          <AlertCircle className="w-4 h-4 text-yellow-500" />
          <span className="text-sm">
            Hay {pendingCount} compra(s) en estado pendiente. Las compras pendientes se eliminan automaticamente despues de 24 horas.
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron compras
            </div>
          ) : (
            <div className="divide-y">
              {filteredPurchases.map((purchase) => (
                <div key={purchase.id} className="flex items-center gap-4 p-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    {purchase.audiobook.coverArtUrl ? (
                      <img
                        src={purchase.audiobook.coverArtUrl}
                        alt={purchase.audiobook.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{purchase.audiobook.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {purchase.user.username} - {purchase.user.email}
                    </p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-sm">{formatDate(purchase.createdAt)}</p>
                    {purchase.purchasedAt && (
                      <p className="text-xs text-muted-foreground">Completado: {formatDate(purchase.purchasedAt)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPrice(purchase.pricePaidCents, purchase.currency)}</p>
                  </div>
                  <Badge 
                    variant={
                      purchase.status === "COMPLETED" ? "default" : 
                      purchase.status === "PENDING" ? "secondary" : 
                      "outline"
                    }
                  >
                    {purchase.status === "PENDING" && "Pendiente"}
                    {purchase.status === "COMPLETED" && "Completado"}
                    {purchase.status === "CANCELLED" && "Cancelado"}
                    {purchase.status === "REFUNDED" && "Reembolsado"}
                  </Badge>
                  {purchase.status === "PENDING" && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteMutation.mutate(purchase.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`delete-purchase-${purchase.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InvoicesTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data: invoices, isLoading } = useQuery<InvoiceWithUser[]>({
    queryKey: ["/api/admin/invoices", { search, status: status === "all" ? undefined : status }],
  });

  const handleDownload = (invoiceId: string) => {
    window.open(`/api/admin/invoices/${invoiceId}/download`, "_blank");
  };

  const filteredInvoices = invoices?.filter(inv => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!inv.invoiceNumber.toLowerCase().includes(searchLower) &&
          !inv.user.username.toLowerCase().includes(searchLower) &&
          !inv.user.email.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (status !== "all" && inv.status !== status) {
      return false;
    }
    return true;
  }) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-invoices"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-invoice-status">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="ISSUED">Emitida</SelectItem>
            <SelectItem value="PAID">Pagada</SelectItem>
            <SelectItem value="CANCELLED">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron facturas
            </div>
          ) : (
            <div className="divide-y">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {invoice.user.username} - {invoice.user.email}
                    </p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-sm">{formatDate(invoice.issueDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPrice(invoice.totalCents, invoice.currency)}</p>
                  </div>
                  <Badge variant={invoice.status === "PAID" ? "default" : "secondary"}>
                    {invoice.status}
                  </Badge>
                  {invoice.pdfPath && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDownload(invoice.id)}
                      data-testid={`download-invoice-${invoice.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("customers");

  const { data: customers, isLoading } = useQuery<CustomerWithStats[]>({
    queryKey: ["/api/admin/customers"],
  });

  const filteredCustomers = customers?.filter(c => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!c.user.username.toLowerCase().includes(searchLower) &&
          !c.user.email.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (roleFilter !== "all" && c.user.role !== roleFilter) {
      return false;
    }
    if (profileFilter === "with" && !c.billingProfile) {
      return false;
    }
    if (profileFilter === "without" && c.billingProfile) {
      return false;
    }
    return true;
  }) || [];

  const totalCustomers = customers?.length || 0;
  const customersWithProfile = customers?.filter(c => c.billingProfile).length || 0;
  const totalRevenue = customers?.reduce((sum, c) => sum + c.totalSpentCents, 0) || 0;

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setProfileFilter("all");
  };

  const hasActiveFilters = search || roleFilter !== "all" || profileFilter !== "all";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Gestion Comercial</h1>
          <p className="text-muted-foreground">Clientes, compras y facturas en un solo lugar</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await fetch("/api/admin/reports/customers", { credentials: "include" });
                if (!response.ok) throw new Error("Error al exportar");
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `clientes_${new Date().toISOString().split("T")[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (e) {
                console.error("Export error:", e);
              }
            }}
            data-testid="button-export-customers"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Clientes
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await fetch("/api/admin/reports/purchases", { credentials: "include" });
                if (!response.ok) throw new Error("Error al exportar");
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `compras_${new Date().toISOString().split("T")[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (e) {
                console.error("Export error:", e);
              }
            }}
            data-testid="button-export-purchases"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Compras
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await fetch("/api/admin/reports/invoices", { credentials: "include" });
                if (!response.ok) throw new Error("Error al exportar");
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `facturas_${new Date().toISOString().split("T")[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (e) {
                console.error("Export error:", e);
              }
            }}
            data-testid="button-export-invoices"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Facturas
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalCustomers}</p>
                <p className="text-sm text-muted-foreground">Total clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{customersWithProfile}</p>
                <p className="text-sm text-muted-foreground">Con perfil completo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{formatPrice(totalRevenue)}</p>
                <p className="text-sm text-muted-foreground">Ingresos totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="customers" data-testid="tab-customers-main">
            <Users className="w-4 h-4 mr-2" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="purchases" data-testid="tab-purchases-main">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Compras
          </TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices-main">
            <FileText className="w-4 h-4 mr-2" />
            Facturas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          {selectedCustomerId ? (
            <CustomerDetailView 
              customerId={selectedCustomerId} 
              onClose={() => setSelectedCustomerId(null)} 
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-customers"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-role-filter">
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="LISTENER">Oyente</SelectItem>
                    <SelectItem value="CREATOR">Creador</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={profileFilter} onValueChange={setProfileFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-profile-filter">
                    <SelectValue placeholder="Perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="with">Con perfil</SelectItem>
                    <SelectItem value="without">Sin perfil</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                    <X className="w-4 h-4 mr-2" />
                    Limpiar filtros
                  </Button>
                )}
              </div>

              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="space-y-4 p-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No se encontraron clientes
                    </div>
                  ) : (
                    <div>
                      {filteredCustomers.map((customer) => (
                        <CustomerRow
                          key={customer.user.id}
                          customer={customer}
                          onClick={() => setSelectedCustomerId(customer.user.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchases">
          <PurchasesTab customers={customers} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
