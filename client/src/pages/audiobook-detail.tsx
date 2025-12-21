import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Play, Clock, BookOpen, Heart, ShoppingCart, User, Headphones, ChevronLeft, ExternalLink, Check, FileText } from "lucide-react";
import { SiAmazon } from "react-icons/si";
import { PayPalButton } from "@/components/paypal-button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AudiobookWithChapters, Chapter, BillingProfile } from "@shared/schema";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatPrice(cents: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(cents / 100);
}

function ChapterItem({ chapter, index }: { chapter: Chapter; index: number }) {
  return (
    <Link href={`/chapter/${chapter.id}`}>
      <div 
        className="flex items-center gap-4 p-4 rounded-lg hover-elevate cursor-pointer border border-transparent hover:border-border transition-colors"
        data-testid={`chapter-item-${chapter.id}`}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
          {chapter.chapterNumber || index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{chapter.title}</h4>
          {chapter.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">{chapter.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {formatDuration(chapter.duration)}
          </span>
          {chapter.isSample && (
            <Badge variant="outline" className="text-xs">
              Muestra
            </Badge>
          )}
          <Button size="icon" variant="ghost">
            <Play className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
}

export default function AudiobookDetail() {
  const [, params] = useRoute("/audiobook/:id");
  const [, setLocation] = useLocation();
  const audiobookId = params?.id;
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const { toast } = useToast();

  const { data: audiobook, isLoading, error } = useQuery<AudiobookWithChapters>({
    queryKey: [`/api/audiobooks/${audiobookId}`],
    enabled: !!audiobookId,
  });

  const { data: userPurchases } = useQuery<Array<{ audiobookId: string }>>({
    queryKey: ["/api/user/purchases"],
  });

  const { data: userSubscription } = useQuery<{ subscription: { status: string } | null }>({
    queryKey: ["/api/user/subscription"],
  });

  const { data: userFavorites } = useQuery<Array<{ id: string }>>({
    queryKey: ["/api/library/favorites"],
  });

  const { data: cartStatus } = useQuery<{ isInCart: boolean }>({
    queryKey: ["/api/cart/check", audiobookId],
    enabled: !!audiobookId,
  });

  const { data: billingProfile } = useQuery<BillingProfile>({
    queryKey: ["/api/billing-profile"],
  });

  const isBillingComplete = useMemo(() => {
    if (!billingProfile) return false;
    return !!(
      billingProfile.fullName &&
      billingProfile.email &&
      billingProfile.address &&
      billingProfile.city &&
      billingProfile.postalCode &&
      billingProfile.country
    );
  }, [billingProfile]);

  const isFavorite = userFavorites?.some(f => f.id === audiobookId);
  const isPurchased = userPurchases?.some(p => p.audiobookId === audiobookId);
  const hasActiveSubscription = userSubscription?.subscription?.status === "ACTIVE";
  const hasAccess = isPurchased || hasActiveSubscription || audiobook?.isFree || audiobook?.priceCents === 0;
  const isInCart = cartStatus?.isInCart || false;

  const handleToggleFavorite = async () => {
    if (!audiobookId) return;
    try {
      if (isFavorite) {
        await apiRequest("DELETE", `/api/audiobooks/${audiobookId}/favorite`);
        toast({
          title: "Eliminado de favoritos",
          description: "El audiolibro se ha eliminado de tus favoritos",
        });
      } else {
        await apiRequest("POST", `/api/audiobooks/${audiobookId}/favorite`);
        toast({
          title: "Agregado a favoritos",
          description: "El audiolibro se ha agregado a tus favoritos",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/library/favorites"] });
    } catch (error: any) {
      if (error.message?.includes("401")) {
        toast({
          variant: "destructive",
          title: "No autenticado",
          description: "Debes iniciar sesion para gestionar favoritos",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo actualizar favoritos",
        });
      }
    }
  };

  const handleToggleCart = async () => {
    if (!audiobookId) return;
    try {
      if (isInCart) {
        await apiRequest("DELETE", `/api/cart/${audiobookId}`);
        toast({
          title: "Eliminado del carrito",
          description: "El audiolibro se ha eliminado del carrito",
        });
      } else {
        await apiRequest("POST", `/api/cart/${audiobookId}`);
        toast({
          title: "Agregado al carrito",
          description: "El audiolibro se ha agregado a tu carrito",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cart/check", audiobookId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    } catch (error: any) {
      if (error.message?.includes("401")) {
        toast({
          variant: "destructive",
          title: "No autenticado",
          description: "Debes iniciar sesion para gestionar el carrito",
        });
      } else if (error.message?.includes("Already purchased")) {
        toast({
          variant: "destructive",
          title: "Ya comprado",
          description: "Ya has comprado este audiolibro",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo actualizar el carrito",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/3">
            <Skeleton className="aspect-square rounded-xl" />
          </div>
          <div className="lg:w-2/3 space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !audiobook) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Audiolibro no encontrado</h2>
        <p className="text-muted-foreground mb-6">El audiolibro que buscas no existe o ha sido eliminado.</p>
        <Link href="/">
          <Button>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
        </Link>
      </div>
    );
  }

  const sortedChapters = [...(audiobook.chapters || [])].sort((a, b) => 
    (a.chapterNumber || 0) - (b.chapterNumber || 0)
  );

  return (
    <div className="min-h-screen pb-16">
      <div className="bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 py-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Volver
            </Button>
          </Link>

          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/3 flex-shrink-0">
              <div className="aspect-square rounded-xl overflow-hidden shadow-xl sticky top-8">
                {audiobook.coverArtUrl ? (
                  <img
                    src={audiobook.coverArtUrl}
                    alt={audiobook.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center">
                    <BookOpen className="w-24 h-24 text-primary-foreground/60" />
                  </div>
                )}
              </div>
            </div>

            <div className="lg:w-2/3 space-y-6">
              <div>
                <Badge variant="outline" className="mb-3">
                  {audiobook.category}
                </Badge>
                <h1 className="font-serif text-4xl md:text-5xl font-bold mb-3" data-testid="text-audiobook-title">
                  {audiobook.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {audiobook.author}
                  </span>
                  {audiobook.narrator && (
                    <span className="flex items-center gap-2">
                      <Headphones className="w-4 h-4" />
                      {audiobook.narrator}
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {formatDuration(audiobook.totalDuration)}
                  </span>
                </div>
              </div>

              <p className="text-lg leading-relaxed text-muted-foreground">
                {audiobook.description}
              </p>

              <div className="flex flex-wrap gap-4">
                {audiobook.isFree || audiobook.priceCents === 0 ? (
                  <Link href={sortedChapters[0] ? `/chapter/${sortedChapters[0].id}` : "#"}>
                    <Button size="lg" className="gap-2" data-testid="button-listen-free">
                      <Play className="w-5 h-5" />
                      Escuchar gratis
                    </Button>
                  </Link>
                ) : hasAccess ? (
                  <Link href={sortedChapters[0] ? `/chapter/${sortedChapters[0].id}` : "#"}>
                    <Button size="lg" className="gap-2" data-testid="button-listen">
                      <Play className="w-5 h-5" />
                      Escuchar ahora
                    </Button>
                  </Link>
                ) : (
                  <>
                    {isBillingComplete ? (
                      <Button 
                        size="lg" 
                        className="gap-2" 
                        onClick={() => setShowPurchaseDialog(true)}
                        data-testid="button-buy"
                      >
                        <ShoppingCart className="w-5 h-5" />
                        Comprar por {formatPrice(audiobook.priceCents, audiobook.currency)}
                      </Button>
                    ) : (
                      <Link href="/checkout">
                        <Button 
                          size="lg" 
                          className="gap-2" 
                          data-testid="button-complete-billing"
                        >
                          <FileText className="w-5 h-5" />
                          Completar datos para comprar
                        </Button>
                      </Link>
                    )}
                    <Button 
                      size="lg" 
                      variant={isInCart ? "secondary" : "outline"}
                      className="gap-2" 
                      data-testid="button-add-to-cart"
                      onClick={handleToggleCart}
                    >
                      <ShoppingCart className={`w-5 h-5 ${isInCart ? "fill-current" : ""}`} />
                      {isInCart ? "En el carrito" : "Agregar al carrito"}
                    </Button>
                    <Button 
                      size="lg" 
                      variant={isFavorite ? "default" : "outline"}
                      className="gap-2" 
                      data-testid="button-favorite"
                      onClick={handleToggleFavorite}
                    >
                      <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
                      {isFavorite ? "En favoritos" : "Agregar a favoritos"}
                    </Button>
                  </>
                )}
                {(isPurchased || hasActiveSubscription) && (
                  <Badge variant="secondary" className="flex items-center gap-1 px-3 py-2">
                    <Check className="w-4 h-4" />
                    {hasActiveSubscription ? "Suscriptor" : "Comprado"}
                  </Badge>
                )}
              </div>
              
              {(audiobook.amazonEbookUrl || audiobook.amazonPrintUrl) && (
                <div className="flex flex-wrap gap-3">
                  {audiobook.amazonEbookUrl && (
                    <a 
                      href={audiobook.amazonEbookUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      data-testid="link-amazon-ebook"
                    >
                      <Button variant="outline" className="gap-2">
                        <SiAmazon className="w-4 h-4" />
                        Ebook en Amazon
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  )}
                  {audiobook.amazonPrintUrl && (
                    <a 
                      href={audiobook.amazonPrintUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      data-testid="link-amazon-print"
                    >
                      <Button variant="outline" className="gap-2">
                        <SiAmazon className="w-4 h-4" />
                        Impreso en Amazon
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="font-serif text-2xl font-bold mb-6">
              Capitulos ({sortedChapters.length})
            </h2>
            <div className="space-y-2">
              {sortedChapters.map((chapter, index) => (
                <ChapterItem 
                  key={chapter.id} 
                  chapter={chapter} 
                  index={index} 
                />
              ))}
              {sortedChapters.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Este audiolibro aun no tiene capitulos.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Comprar audiolibro</DialogTitle>
            <DialogDescription>
              Completa tu compra de "{audiobook.title}" con PayPal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center gap-4">
              {audiobook.coverArtUrl && (
                <img 
                  src={audiobook.coverArtUrl} 
                  alt={audiobook.title}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold">{audiobook.title}</h3>
                <p className="text-sm text-muted-foreground">{audiobook.author}</p>
                <p className="text-lg font-bold text-primary mt-1">
                  {formatPrice(audiobook.priceCents, audiobook.currency)}
                </p>
              </div>
            </div>
            <PayPalButton
              audiobookId={audiobookId || ""}
              priceCents={audiobook.priceCents}
              currency={audiobook.currency}
              onSuccess={() => {
                setShowPurchaseDialog(false);
                window.location.reload();
              }}
            />
            <p className="text-xs text-center text-muted-foreground">
              Despues de la compra tendras acceso permanente a este audiolibro
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
