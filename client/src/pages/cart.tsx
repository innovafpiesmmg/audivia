import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, BookOpen, ChevronLeft, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Audiobook } from "@shared/schema";

interface CartItemWithAudiobook {
  id: string;
  userId: string;
  audiobookId: string;
  createdAt: Date;
  audiobook: Audiobook;
}

interface CartData {
  items: CartItemWithAudiobook[];
  totalCents: number;
  itemCount: number;
  currency: string;
}

function formatPrice(cents: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(cents / 100);
}

function CartItemRow({ item, onRemove }: { item: CartItemWithAudiobook; onRemove: () => void }) {
  const { audiobook } = item;
  
  return (
    <div className="flex items-center gap-4 p-4" data-testid={`cart-item-${audiobook.id}`}>
      <Link href={`/audiobook/${audiobook.id}`}>
        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover-elevate">
          {audiobook.coverArtUrl ? (
            <img
              src={audiobook.coverArtUrl}
              alt={audiobook.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary-foreground/60" />
            </div>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/audiobook/${audiobook.id}`}>
          <h3 className="font-semibold truncate hover:text-primary cursor-pointer" data-testid={`text-title-${audiobook.id}`}>
            {audiobook.title}
          </h3>
        </Link>
        <p className="text-sm text-muted-foreground truncate">{audiobook.author}</p>
      </div>
      <div className="text-right flex items-center gap-4">
        <span className="font-bold text-lg" data-testid={`text-price-${audiobook.id}`}>
          {formatPrice(audiobook.priceCents, audiobook.currency)}
        </span>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onRemove}
          data-testid={`button-remove-${audiobook.id}`}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { toast } = useToast();

  const { data: cart, isLoading } = useQuery<CartData>({
    queryKey: ["/api/cart"],
  });

  const removeItemMutation = useMutation({
    mutationFn: async (audiobookId: string) => {
      await apiRequest("DELETE", `/api/cart/${audiobookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Eliminado del carrito",
        description: "El audiolibro se ha eliminado del carrito",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar del carrito",
      });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/cart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Carrito vaciado",
        description: "Se han eliminado todos los audiolibros del carrito",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo vaciar el carrito",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Seguir comprando
        </Button>
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
        <ShoppingCart className="w-8 h-8" />
        Tu carrito
      </h1>

      {isEmpty ? (
        <Card className="text-center py-16">
          <CardContent>
            <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Tu carrito esta vacio</h2>
            <p className="text-muted-foreground mb-6">
              Explora nuestra coleccion y agrega audiolibros a tu carrito
            </p>
            <Link href="/">
              <Button data-testid="button-explore">
                Explorar audiolibros
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="font-serif">
                  Audiolibros ({cart.itemCount})
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => clearCartMutation.mutate()}
                  disabled={clearCartMutation.isPending}
                  data-testid="button-clear-cart"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Vaciar carrito
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {cart.items.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      onRemove={() => removeItemMutation.mutate(item.audiobookId)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="font-serif">Resumen del pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="truncate flex-1 mr-2">{item.audiobook.title}</span>
                      <span>{formatPrice(item.audiobook.priceCents, item.audiobook.currency)}</span>
                    </div>
                  ))}
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span data-testid="text-cart-total">{formatPrice(cart.totalCents, cart.currency)}</span>
                </div>

                <Link href="/checkout">
                  <Button className="w-full gap-2" size="lg" data-testid="button-checkout">
                    <CreditCard className="w-5 h-5" />
                    Proceder al pago
                  </Button>
                </Link>

                <p className="text-xs text-center text-muted-foreground">
                  Pago seguro con PayPal
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
