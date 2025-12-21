import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { DollarSign, ShoppingCart, Users, TrendingUp, BookOpen, Calendar, CreditCard, Repeat } from "lucide-react";
import type { Audiobook } from "@shared/schema";

type SalesSummary = {
  totalRevenueCents: number;
  purchaseCount: number;
  subscriptionCount: number;
  purchaseRevenueCents: number;
  subscriptionRevenueCents: number;
  averageOrderValueCents: number;
};

type RevenueTrendItem = {
  date: string;
  purchaseRevenueCents: number;
  subscriptionRevenueCents: number;
  totalRevenueCents: number;
};

type TopAudiobook = {
  audiobook: Audiobook;
  salesCount: number;
  revenueCents: number;
};

type Transaction = {
  id: string;
  type: 'purchase' | 'subscription';
  amount: number;
  currency: string;
  userName: string;
  userEmail: string;
  itemName: string;
  date: string;
  status: string;
};

const formatCurrency = (cents: number, currency = "EUR") => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(cents / 100);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
};

const getDateRange = (range: string) => {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (range) {
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { from: from.toISOString(), to };
};

export default function AdminSalesDashboard() {
  const [dateRange, setDateRange] = useState("30d");
  const [chartInterval, setChartInterval] = useState<"day" | "week" | "month">("day");

  const { from, to } = getDateRange(dateRange);

  const { data: summary, isLoading: summaryLoading } = useQuery<SalesSummary>({
    queryKey: ["/api/admin/sales/summary", { from, to }],
  });

  const { data: revenueTrend, isLoading: trendLoading } = useQuery<RevenueTrendItem[]>({
    queryKey: ["/api/admin/sales/revenue-trend", { from, to, interval: chartInterval }],
  });

  const { data: topAudiobooks, isLoading: topLoading } = useQuery<TopAudiobook[]>({
    queryKey: ["/api/admin/sales/top-audiobooks", { from, to, limit: "10" }],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/sales/recent-transactions", { limit: "20" }],
  });

  const chartData = revenueTrend?.map(item => ({
    date: formatDate(item.date),
    Compras: item.purchaseRevenueCents / 100,
    Suscripciónes: item.subscriptionRevenueCents / 100,
    Total: item.totalRevenueCents / 100,
  })) || [];

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-8 w-8" />
              Dashboard de Ventas
            </h1>
            <p className="text-muted-foreground mt-1">
              Resumen de ingresos, compras y suscripciónes
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]" data-testid="select-date-range">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Ultimos 7 dias</SelectItem>
                <SelectItem value="30d">Ultimos 30 dias</SelectItem>
                <SelectItem value="90d">Ultimos 90 dias</SelectItem>
                <SelectItem value="1y">Ultimo ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-revenue">
                    {formatCurrency(summary?.totalRevenueCents || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compras + Suscripciónes
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compras</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-purchase-count">
                    {summary?.purchaseCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(summary?.purchaseRevenueCents || 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suscripciónes</CardTitle>
              <Repeat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-subscription-count">
                    {summary?.subscriptionCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(summary?.subscriptionRevenueCents || 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-aov">
                    {formatCurrency(summary?.averageOrderValueCents || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Por transaccion
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle>Tendencia de Ingresos</CardTitle>
                  <CardDescription>Evolucion de ventas en el periodo seleccionado</CardDescription>
                </div>
                <Select value={chartInterval} onValueChange={(v) => setChartInterval(v as any)}>
                  <SelectTrigger className="w-[120px]" data-testid="select-chart-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Diario</SelectItem>
                    <SelectItem value="week">Semanal</SelectItem>
                    <SelectItem value="month">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <div className="h-[300px] bg-muted animate-pulse rounded" />
              ) : chartData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No hay datos para el periodo seleccionado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${v}€`} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}€`, ""]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Compras" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Suscripciónes" fill="hsl(45, 90%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Top Audiolibros
              </CardTitle>
              <CardDescription>Los mas vendidos en el periodo</CardDescription>
            </CardHeader>
            <CardContent>
              {topLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : (topAudiobooks?.length || 0) === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No hay ventas en el periodo
                </div>
              ) : (
                <div className="space-y-3">
                  {topAudiobooks?.slice(0, 5).map((item, idx) => (
                    <div key={item.audiobook.id} className="flex items-center gap-3" data-testid={`row-top-audiobook-${idx}`}>
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.audiobook.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.salesCount} ventas
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-right">
                        {formatCurrency(item.revenueCents)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Transacciones Recientes
            </CardTitle>
            <CardDescription>Últimas compras y suscripciónes</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (transactions?.length || 0) === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No hay transacciones recientes
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions?.map((tx) => (
                      <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                        <TableCell>
                          <Badge variant={tx.type === "purchase" ? "default" : "secondary"}>
                            {tx.type === "purchase" ? "Compra" : "Suscripción"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tx.userName}</p>
                            <p className="text-xs text-muted-foreground">{tx.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{tx.itemName}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(tx.amount, tx.currency)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(tx.date).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
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
    </div>
  );
}
