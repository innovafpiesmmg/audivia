import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Library as LibraryIcon, Heart, HeartOff, Clock, BookOpen, Play, ShoppingBag, Crown, Receipt, Download, FileText, Rss, Copy, RefreshCw, Check, Smartphone, Search } from "lucide-react";
import { SiAndroid, SiApple } from "react-icons/si";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Audiobook, SubscriptionPlan, UserSubscription, Invoice, RssFeedToken } from "@shared/schema";
import { BillingProfileForm } from "@/components/billing-profile-form";
import { Input } from "@/components/ui/input";

const ANTENNAPOD_ANDROID_URL = "https://play.google.com/store/apps/details?id=de.danoeh.antennapod";
const APPLE_PODCASTS_URL = "https://apps.apple.com/app/apple-podcasts/id525463029";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function AudiobookCard({ audiobook, onRemoveFavorite }: { audiobook: Audiobook; onRemoveFavorite?: (id: string) => void }) {
  return (
    <Card
      className="group overflow-hidden hover-elevate cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
      data-testid={`card-audiobook-${audiobook.id}`}
    >
      <Link href={`/audiobook/${audiobook.id}`}>
        <div className="aspect-square relative overflow-hidden">
          {audiobook.coverArtUrl ? (
            <img
              src={audiobook.coverArtUrl}
              alt={audiobook.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-primary-foreground/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-4 left-4 right-4 flex gap-2">
              <Button size="sm" className="flex-1 gap-1">
                <Play className="w-4 h-4" />
                Escuchar
              </Button>
              {onRemoveFavorite && (
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    onRemoveFavorite(audiobook.id);
                  }}
                >
                  <HeartOff className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-serif font-semibold text-lg line-clamp-1">{audiobook.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1">{audiobook.author}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatDuration(audiobook.totalDuration)}</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: {
  icon: typeof LibraryIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="text-center py-16 border border-dashed rounded-lg">
      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground mb-2 font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button data-testid="button-explore">{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-square" />
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Library() {
  const { toast } = useToast();
  const [copiedFeed, setCopiedFeed] = useState(false);

  const { data: favorites = [], isLoading: loadingFavorites } = useQuery<Audiobook[]>({
    queryKey: ["/api/library/favorites"],
  });

  const { data: purchases = [], isLoading: loadingPurchases } = useQuery<Audiobook[]>({
    queryKey: ["/api/library/purchases"],
  });

  const { data: subscriptionData } = useQuery<{
    subscription: UserSubscription | null;
    plan: SubscriptionPlan | null;
  }>({
    queryKey: ["/api/user/subscription"],
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/user/invoices"],
  });

  const { data: rssTokenData, isLoading: loadingRssToken } = useQuery<{ token: RssFeedToken | null }>({
    queryKey: ["/api/user/rss-token"],
  });

  const { data: rssFeedsData } = useQuery<{
    feeds: Array<{
      audiobookId: string;
      title: string;
      author: string;
      coverArtUrl: string | null;
      feedUrl: string;
    }>;
    token: string | null;
    globalFeedUrl: string;
  }>({
    queryKey: ["/api/user/rss-feeds"],
    enabled: !!rssTokenData?.token,
  });

  const [copiedFeedId, setCopiedFeedId] = useState<string | null>(null);
  const [feedSearchQuery, setFeedSearchQuery] = useState("");

  const filteredFeeds = rssFeedsData?.feeds?.filter(feed => 
    feed.title.toLowerCase().includes(feedSearchQuery.toLowerCase()) ||
    feed.author.toLowerCase().includes(feedSearchQuery.toLowerCase())
  ) || [];

  const copyIndividualFeedUrl = async (feedUrl: string, audiobookId: string) => {
    await navigator.clipboard.writeText(feedUrl);
    setCopiedFeedId(audiobookId);
    setTimeout(() => setCopiedFeedId(null), 2000);
    toast({
      title: "Copiado",
      description: "El enlace RSS del audiolibro ha sido copiado",
    });
  };

  const generateRssTokenMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/user/rss-token");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/rss-token"] });
      toast({
        title: "Token generado",
        description: "Tu nuevo enlace RSS ha sido creado",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo generar el token RSS",
      });
    },
  });

  const getFeedUrl = () => {
    if (!rssTokenData?.token?.token) return "";
    return `${window.location.origin}/feed/${rssTokenData.token.token}`;
  };

  const copyFeedUrl = async () => {
    const url = getFeedUrl();
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopiedFeed(true);
      setTimeout(() => setCopiedFeed(false), 2000);
      toast({
        title: "Copiado",
        description: "El enlace RSS ha sido copiado al portapapeles",
      });
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      window.open(`/api/invoices/${invoiceId}/download`, '_blank');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo descargar la factura",
      });
    }
  };

  const handleRemoveFavorite = async (audiobookId: string) => {
    try {
      await apiRequest("DELETE", `/api/audiobooks/${audiobookId}/favorite`);
      toast({
        title: "Eliminado de favoritos",
        description: "El audiolibro se ha eliminado de tus favoritos",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/library/favorites"] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar de favoritos",
      });
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h1 className="font-serif text-4xl font-bold mb-3" data-testid="text-page-title">
            Mi Biblioteca
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Tus audiolibros favoritos y comprados en un solo lugar
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="favorites" className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="favorites" className="gap-2" data-testid="tab-favorites">
              <Heart className="w-4 h-4" />
              Favoritos
              {favorites.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {favorites.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="purchases" className="gap-2" data-testid="tab-purchases">
              <ShoppingBag className="w-4 h-4" />
              Comprados
              {purchases.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {purchases.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2" data-testid="tab-subscription">
              <Crown className="w-4 h-4" />
              Suscripción
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2" data-testid="tab-billing">
              <Receipt className="w-4 h-4" />
              Facturacion
              {invoices.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {invoices.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="podcast" className="gap-2" data-testid="tab-podcast">
              <Rss className="w-4 h-4" />
              Podcast
            </TabsTrigger>
          </TabsList>

          <TabsContent value="favorites">
            {loadingFavorites ? (
              <LoadingSkeleton />
            ) : favorites.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No tienes favoritos"
                description="Los audiolibros que marques como favoritos aparecerán aqui"
                actionLabel="Explorar audiolibros"
                actionHref="/explore"
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {favorites.map((audiobook) => (
                  <AudiobookCard
                    key={audiobook.id}
                    audiobook={audiobook}
                    onRemoveFavorite={handleRemoveFavorite}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchases">
            {loadingPurchases ? (
              <LoadingSkeleton />
            ) : purchases.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="No has comprado audiolibros"
                description="Los audiolibros que compres aparecerán aqui para siempre"
                actionLabel="Ver catálogo"
                actionHref="/explore"
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {purchases.map((audiobook) => (
                  <AudiobookCard key={audiobook.id} audiobook={audiobook} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscription">
            {subscriptionData?.subscription?.status === "ACTIVE" ? (
              <Card className="p-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Crown className="w-10 h-10 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <Badge variant="secondary" className="mb-2">Activa</Badge>
                    <h2 className="font-serif text-2xl font-bold mb-1">
                      {subscriptionData.plan?.name || "Suscripción Premium"}
                    </h2>
                    <p className="text-muted-foreground">
                      Tienes acceso completo a todo el catálogo de audiolibros
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link href="/explore">
                      <Button className="gap-2 w-full">
                        <LibraryIcon className="w-4 h-4" />
                        Explorar catálogo
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Crown className="w-16 h-16 mx-auto text-accent mb-4" />
                <h2 className="font-serif text-2xl font-bold mb-2">Suscripción Premium</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Accede a todo el catálogo de audiolibros con una suscripción mensual. Cancela cuando quieras.
                </p>
                <Link href="/subscriptions">
                  <Button size="lg" className="gap-2" data-testid="button-view-plans">
                    <Crown className="w-5 h-5" />
                    Ver planes de suscripción
                  </Button>
                </Link>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="billing">
            <div className="space-y-8">
              <Card className="p-6">
                <h2 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Datos de facturacion
                </h2>
                <p className="text-muted-foreground mb-6">
                  Completa tu información de facturacion para recibir facturas con tus datos fiscales.
                </p>
                <BillingProfileForm />
              </Card>

              <Card className="p-6">
                <h2 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Historial de facturas
                </h2>
                {loadingInvoices ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-9 w-24" />
                      </div>
                    ))}
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-lg">
                    <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2 font-medium">No tienes facturas</p>
                    <p className="text-sm text-muted-foreground">
                      Las facturas de tus compras y suscripciónes aparecerán aqui
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`row-invoice-${invoice.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{invoice.invoiceNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(invoice.issueDate).toLocaleDateString('es-ES')}
                              {' - '}
                              <Badge variant="secondary" className="text-xs">
                                {invoice.type === 'PURCHASE' ? 'Compra' : 'Suscripción'}
                              </Badge>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-semibold">
                            {(invoice.totalCents / 100).toFixed(2)} {invoice.currency}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => handleDownloadInvoice(invoice.id)}
                            data-testid={`button-download-invoice-${invoice.id}`}
                          >
                            <Download className="w-4 h-4" />
                            Descargar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="podcast">
            <Card className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold mb-2">Escucha en tu app favorita</h2>
                  <p className="text-muted-foreground">
                    Usa aplicaciones como AntennaPod, Pocket Casts o cualquier lector de podcasts para escuchar tus audiolibros en tu movil, incluso sin conexion.
                  </p>
                </div>
              </div>

              {loadingRssToken ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-9 w-32" />
                </div>
              ) : rssTokenData?.token ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tu enlace RSS privado</label>
                    <div className="flex gap-2">
                      <Input
                        value={getFeedUrl()}
                        readOnly
                        className="font-mono text-sm"
                        data-testid="input-rss-url"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copyFeedUrl}
                        data-testid="button-copy-rss"
                      >
                        {copiedFeed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Copia este enlace y pegalo en tu app de podcasts para sincronizar tu biblioteca.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateRssTokenMutation.mutate()}
                      disabled={generateRssTokenMutation.isPending}
                      className="gap-2"
                      data-testid="button-regenerate-rss"
                    >
                      <RefreshCw className={`w-4 h-4 ${generateRssTokenMutation.isPending ? 'animate-spin' : ''}`} />
                      Regenerar enlace
                    </Button>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-4">Descarga una app de podcasts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="border rounded-lg p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <SiAndroid className="w-5 h-5 text-[#3DDC84]" />
                          <span className="font-medium">Android</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg inline-block mb-3">
                          <QRCodeSVG
                            value={ANTENNAPOD_ANDROID_URL}
                            size={120}
                            level="M"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">AntennaPod</p>
                        <p className="text-xs text-muted-foreground mt-1">Gratis y de codigo abierto</p>
                      </div>
                      <div className="border rounded-lg p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <SiApple className="w-5 h-5" />
                          <span className="font-medium">iPhone / iPad</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg inline-block mb-3">
                          <QRCodeSVG
                            value={APPLE_PODCASTS_URL}
                            size={120}
                            level="M"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">Apple Podcasts</p>
                        <p className="text-xs text-muted-foreground mt-1">Incluida en tu dispositivo</p>
                      </div>
                    </div>

                    <h3 className="font-medium mb-3">Como configurarlo</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Escanea el codigo QR con la camara de tu movil para descargar la app</li>
                      <li>Abre la app y busca "Agregar podcast por URL" o "Agregar feed"</li>
                      <li>Copia y pega el enlace RSS de arriba</li>
                      <li>Tus audiolibros aparecerán como episodios listos para escuchar</li>
                    </ol>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 mt-4">
                    <div className="flex items-start gap-3">
                      <Rss className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium mb-1">Que incluye tu feed</p>
                        <p className="text-muted-foreground">
                          Todos los audiolibros que hayas comprado, los gratuitos, y si tienes suscripción activa, el catálogo completo.
                        </p>
                      </div>
                    </div>
                  </div>

                  {rssFeedsData?.feeds && rssFeedsData.feeds.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Feeds individuales por audiolibro
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Tambien puedes suscribirte a cada audiolibro por separado:
                      </p>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar audiolibro..."
                          value={feedSearchQuery}
                          onChange={(e) => setFeedSearchQuery(e.target.value)}
                          className="pl-9"
                          data-testid="input-search-rss-feeds"
                        />
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredFeeds.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No se encontraron audiolibros
                          </p>
                        ) : filteredFeeds.map((feed) => (
                          <div
                            key={feed.audiobookId}
                            className="flex items-center gap-3 p-2 rounded-lg bg-card border"
                            data-testid={`rss-feed-item-${feed.audiobookId}`}
                          >
                            {feed.coverArtUrl ? (
                              <img
                                src={feed.coverArtUrl}
                                alt={feed.title}
                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <BookOpen className="w-5 h-5 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{feed.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{feed.author}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => copyIndividualFeedUrl(feed.feedUrl, feed.audiobookId)}
                              data-testid={`button-copy-rss-${feed.audiobookId}`}
                            >
                              {copiedFeedId === feed.audiobookId ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed rounded-lg">
                  <Rss className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2 font-medium">No tienes un enlace RSS</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Genera un enlace para sincronizar tu biblioteca con apps de podcasts
                  </p>
                  <Button
                    onClick={() => generateRssTokenMutation.mutate()}
                    disabled={generateRssTokenMutation.isPending}
                    className="gap-2"
                    data-testid="button-generate-rss"
                  >
                    {generateRssTokenMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Rss className="w-4 h-4" />
                    )}
                    Generar enlace RSS
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
