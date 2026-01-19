import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Headphones, 
  Library, 
  ShoppingCart, 
  User, 
  Play,
  Pause,
  SkipBack,
  SkipForward,
  BookOpen,
  Crown,
  Home,
  Search,
  Heart,
  Trash2,
  Plus,
  Minus,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Volume2,
  Copy,
  ExternalLink,
  Rss,
  Download,
  ChevronDown,
  ChevronUp,
  LogOut,
  Settings,
  Mail,
  CreditCard,
  Tag,
  Loader2
} from "lucide-react";
import type { Audiobook, CartItem, UserSubscription, SubscriptionPlan, Chapter, BillingProfile } from "@shared/schema";
const logoImage = "/attached_assets/audivia_horizonta_1766267902382.png";

type TabType = "home" | "explore" | "library" | "cart";

interface CartWithItems {
  items: (CartItem & { audiobook: Audiobook })[];
  total: number;
}

function formatPrice(cents: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(cents / 100);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function AudiobookCard({ audiobook, onView, onAddToCart, inCart, purchased }: { 
  audiobook: Audiobook; 
  onView: () => void;
  onAddToCart?: () => void;
  inCart?: boolean;
  purchased?: boolean;
}) {
  return (
    <Card className="overflow-hidden hover-elevate cursor-pointer" onClick={onView}>
      <div className="aspect-square relative">
        {audiobook.coverArtUrl ? (
          <img
            src={audiobook.coverArtUrl}
            alt={audiobook.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/80 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary-foreground/60" />
          </div>
        )}
        {purchased && (
          <Badge className="absolute top-2 right-2 bg-green-600">
            <Check className="w-3 h-3 mr-1" />
            Tuyo
          </Badge>
        )}
        {audiobook.priceCents === 0 && !purchased && (
          <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">Gratis</Badge>
        )}
      </div>
      <CardContent className="p-2">
        <h3 className="font-medium text-sm line-clamp-1">{audiobook.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{audiobook.author}</p>
        <div className="flex items-center justify-between mt-2 gap-1">
          {audiobook.priceCents > 0 && !purchased ? (
            <span className="text-sm font-bold text-primary">
              {formatPrice(audiobook.priceCents, audiobook.currency)}
            </span>
          ) : (
            <span></span>
          )}
          {!purchased && audiobook.priceCents > 0 && (
            <Button 
              size="icon" 
              variant={inCart ? "secondary" : "default"}
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart?.();
              }}
              data-testid={`button-add-cart-${audiobook.id}`}
            >
              {inCart ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AudioPlayer({ 
  chapter, 
  audiobook,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev
}: { 
  chapter: Chapter;
  audiobook: Audiobook;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (hasNext && onNext) onNext();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [hasNext, onNext]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <audio ref={audioRef} src={chapter.audioUrl || undefined} preload="metadata" />
      
      <header className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-player">
          <X className="w-5 h-5" />
        </Button>
        <span className="text-sm font-medium">Reproduciendo</span>
        <div className="w-9" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-48 aspect-square rounded-lg overflow-hidden shadow-xl">
          {audiobook.coverArtUrl ? (
            <img src={audiobook.coverArtUrl} alt={audiobook.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/80 flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-primary-foreground/60" />
            </div>
          )}
        </div>

        <div className="text-center w-full">
          <h2 className="font-serif text-xl font-bold line-clamp-2">{chapter.title}</h2>
          <p className="text-muted-foreground">{audiobook.title}</p>
          <p className="text-sm text-muted-foreground">{audiobook.author}</p>
        </div>
      </div>

      <div className="p-6 space-y-4 shrink-0">
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onPrev}
            disabled={!hasPrev}
            data-testid="button-prev-chapter"
          >
            <SkipBack className="w-6 h-6" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => skip(-15)}
            data-testid="button-rewind"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-xs absolute bottom-1">15</span>
          </Button>
          
          <Button 
            size="icon" 
            className="h-16 w-16 rounded-full"
            onClick={togglePlay}
            data-testid="button-play-pause"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => skip(15)}
            data-testid="button-forward"
          >
            <ChevronRight className="w-5 h-5" />
            <span className="text-xs absolute bottom-1">15</span>
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onNext}
            disabled={!hasNext}
            data-testid="button-next-chapter"
          >
            <SkipForward className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function HomeTab({ 
  audiobooks, 
  isLoading, 
  onViewAudiobook,
  cartItems,
  purchasedIds,
  onAddToCart,
  onShowSubscriptions
}: { 
  audiobooks: Audiobook[];
  isLoading: boolean;
  onViewAudiobook: (audiobook: Audiobook) => void;
  cartItems: string[];
  purchasedIds: string[];
  onAddToCart: (id: string) => void;
  onShowSubscriptions: () => void;
}) {
  const { data: user } = useQuery<{ id: string } | null>({
    queryKey: ["/api/auth/me"],
  });

  const { data: subscription } = useQuery<UserSubscription & { plan: SubscriptionPlan }>({
    queryKey: ["/api/subscriptions/active"],
    enabled: !!user,
  });

  const categories = [...new Set(audiobooks.map(b => b.category).filter(Boolean))];
  const freeBooks = audiobooks.filter(b => b.priceCents === 0).slice(0, 4);
  const popularBooks = audiobooks.filter(b => b.priceCents > 0).slice(0, 6);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-6 overflow-auto">
        <Skeleton className="h-24 rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 space-y-6">
        <section className="text-center py-4">
          <h1 className="font-serif text-2xl font-bold" data-testid="text-welcome">
            Bienvenido a Audivia
          </h1>
          <p className="text-muted-foreground mt-1">
            Tu biblioteca de audiolibros en español
          </p>
        </section>

        {subscription && (
          <Card className="border-accent bg-accent/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Crown className="w-10 h-10 text-accent" />
              <div>
                <p className="font-semibold">Suscripción {subscription.plan?.name}</p>
                <p className="text-sm text-muted-foreground">Acceso ilimitado a todo el catálogo</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!subscription && !user && (
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-4 text-center">
              <Headphones className="w-10 h-10 mx-auto text-primary mb-2" />
              <p className="font-medium">Descubre audiolibros increíbles</p>
              <p className="text-sm text-muted-foreground mb-3">Inicia sesión para comprar y guardar favoritos</p>
              <Link href="/login?from=mobile">
                <Button size="sm" data-testid="button-login-cta">Iniciar sesión</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {user && !subscription && (
          <Card className="bg-gradient-to-br from-accent/20 to-primary/20 border-accent/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Crown className="w-10 h-10 text-accent" />
                <div>
                  <p className="font-semibold">Hazte Premium</p>
                  <p className="text-sm text-muted-foreground">Acceso ilimitado a todo el catálogo</p>
                </div>
              </div>
              <Button className="w-full" onClick={onShowSubscriptions} data-testid="button-show-subscriptions">
                Ver planes de suscripción
              </Button>
            </CardContent>
          </Card>
        )}

        {freeBooks.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Audiolibros gratuitos
            </h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {freeBooks.map(book => (
                <div key={book.id} className="w-36 shrink-0">
                  <AudiobookCard
                    audiobook={book}
                    onView={() => onViewAudiobook(book)}
                    purchased={purchasedIds.includes(book.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {popularBooks.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-primary" />
              Catálogo completo
            </h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {popularBooks.map(book => (
                <div key={book.id} className="w-36 shrink-0">
                  <AudiobookCard
                    audiobook={book}
                    onView={() => onViewAudiobook(book)}
                    onAddToCart={() => onAddToCart(book.id)}
                    inCart={cartItems.includes(book.id)}
                    purchased={purchasedIds.includes(book.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {categories.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-3">Categorías</h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {categories.map(cat => (
                <Badge key={cat} variant="secondary" className="px-3 py-1 shrink-0">
                  {cat}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ExploreTab({ 
  audiobooks, 
  isLoading,
  cartItems, 
  purchasedIds,
  onAddToCart, 
  onViewAudiobook 
}: { 
  audiobooks: Audiobook[];
  isLoading: boolean;
  cartItems: string[];
  purchasedIds: string[];
  onAddToCart: (id: string) => void;
  onViewAudiobook: (audiobook: Audiobook) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAudiobooks = audiobooks.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 p-4 grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, autor o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 pt-2">
        {filteredAudiobooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Search className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">No se encontraron audiolibros</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredAudiobooks.map(book => (
              <AudiobookCard
                key={book.id}
                audiobook={book}
                onView={() => onViewAudiobook(book)}
                onAddToCart={() => onAddToCart(book.id)}
                inCart={cartItems.includes(book.id)}
                purchased={purchasedIds.includes(book.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LibraryTab({ onViewAudiobook }: { 
  onViewAudiobook: (audiobook: Audiobook) => void;
}) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<"purchases" | "favorites">("purchases");

  const { data: user } = useQuery<{ id: string } | null>({
    queryKey: ["/api/auth/me"],
  });

  const { data: purchases, isLoading: loadingPurchases } = useQuery<{ audiobook: Audiobook }[]>({
    queryKey: ["/api/library/purchases"],
    enabled: !!user,
  });

  const { data: favorites, isLoading: loadingFavorites } = useQuery<{ audiobook: Audiobook }[]>({
    queryKey: ["/api/library/favorites"],
    enabled: !!user,
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: (audiobookId: string) => apiRequest("DELETE", `/api/library/favorites/${audiobookId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/favorites"] });
      toast({ title: "Eliminado de favoritos" });
    },
  });

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        <Library className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground text-center">Inicia sesión para ver tu biblioteca</p>
        <Link href="/login?from=mobile">
          <Button data-testid="button-login">Iniciar sesión</Button>
        </Link>
      </div>
    );
  }

  const isLoading = loadingPurchases || loadingFavorites;
  const items = activeSection === "purchases" ? purchases : favorites;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 pb-2 shrink-0">
        <div className="flex gap-2">
          <Button
            variant={activeSection === "purchases" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection("purchases")}
            className="flex-1"
            data-testid="button-purchases"
          >
            <BookOpen className="w-4 h-4 mr-1" />
            Mis audiolibros
          </Button>
          <Button
            variant={activeSection === "favorites" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection("favorites")}
            className="flex-1"
            data-testid="button-favorites"
          >
            <Heart className="w-4 h-4 mr-1" />
            Favoritos
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 pt-2">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            {activeSection === "purchases" ? (
              <>
                <BookOpen className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">No tienes audiolibros comprados</p>
                <p className="text-sm text-muted-foreground">Explora nuestro catálogo</p>
              </>
            ) : (
              <>
                <Heart className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">No tienes favoritos</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(({ audiobook }) => (
              <Card 
                key={audiobook.id} 
                className="overflow-hidden cursor-pointer hover-elevate" 
                onClick={() => onViewAudiobook(audiobook)}
              >
                <div className="flex gap-3 p-3">
                  <div className="w-16 h-16 rounded overflow-hidden shrink-0">
                    {audiobook.coverArtUrl ? (
                      <img src={audiobook.coverArtUrl} alt={audiobook.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/80 flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-primary-foreground/60" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm line-clamp-2">{audiobook.title}</h3>
                    <p className="text-xs text-muted-foreground">{audiobook.author}</p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewAudiobook(audiobook);
                        }}
                        data-testid={`button-listen-${audiobook.id}`}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Escuchar
                      </Button>
                      {activeSection === "favorites" && (
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavoriteMutation.mutate(audiobook.id);
                          }}
                          data-testid={`button-remove-favorite-${audiobook.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const billingFormSchema = z.object({
  fullName: z.string().min(2, "Nombre completo es requerido"),
  email: z.string().email("Email inválido"),
  taxId: z.string().optional(),
  address: z.string().min(5, "Dirección es requerida"),
  city: z.string().min(2, "Ciudad es requerida"),
  postalCode: z.string().min(3, "Código postal es requerido"),
  country: z.string().min(2, "Pais es requerido"),
});

type BillingFormData = z.infer<typeof billingFormSchema>;

interface AppliedDiscount {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  discountAmountCents: number;
  finalAmountCents: number;
}

interface MobileCartData {
  items: (CartItem & { audiobook: Audiobook })[];
  totalCents: number;
  total: number;
  itemCount: number;
  currency: string;
}

function MobilePayPalButton({ 
  totalCents, 
  currency, 
  discountCode,
  onSuccess 
}: { 
  totalCents: number; 
  currency: string;
  discountCode?: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const containerIdRef = useRef(`paypal-mobile-btn-${Date.now()}`);
  const discountCodeRef = useRef(discountCode);
  const onSuccessRef = useRef(onSuccess);

  discountCodeRef.current = discountCode;
  onSuccessRef.current = onSuccess;

  const { data: paypalConfig } = useQuery<{ clientId: string }>({
    queryKey: ["/api/paypal/client-id"],
  });

  useEffect(() => {
    if (!paypalConfig?.clientId) return;
    
    if ((window as any).paypal) {
      setScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
    if (existingScript) {
      const checkPaypal = setInterval(() => {
        if ((window as any).paypal) {
          clearInterval(checkPaypal);
          setScriptLoaded(true);
          setIsLoading(false);
        }
      }, 100);
      return () => clearInterval(checkPaypal);
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&currency=${currency}`;
    script.async = true;
    script.onload = () => {
      setScriptLoaded(true);
      setIsLoading(false);
    };
    script.onerror = () => {
      setError("Error al cargar PayPal");
      setIsLoading(false);
    };
    document.body.appendChild(script);
  }, [paypalConfig?.clientId, currency]);

  useEffect(() => {
    if (!scriptLoaded || !(window as any).paypal) return;

    const container = document.getElementById(containerIdRef.current);
    if (!container) return;
    
    container.innerHTML = "";

    (window as any).paypal.Buttons({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "pay",
      },
      createOrder: async () => {
        try {
          const response = await fetch("/api/paypal/create-cart-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ discountCode: discountCodeRef.current }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error creating order");
          }
          
          const data = await response.json();
          return data.orderId;
        } catch (err: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: err.message || "No se pudo crear la orden",
          });
          throw err;
        }
      },
      onApprove: async (data: { orderID: string }) => {
        try {
          const response = await fetch("/api/paypal/capture-cart-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderId: data.orderID }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error capturing order");
          }
          
          onSuccessRef.current();
        } catch (err: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: err.message || "No se pudo completar el pago",
          });
        }
      },
      onError: (err: any) => {
        console.error("PayPal error:", err);
        toast({
          variant: "destructive",
          title: "Error de PayPal",
          description: "Hubo un problema con el pago",
        });
      },
    }).render(`#${containerIdRef.current}`);
  }, [scriptLoaded, toast]);

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-destructive text-sm">{error}</p>
        <Button 
          variant="outline" 
          size="sm"
          className="mt-2" 
          onClick={() => {
            setError(null);
            setIsLoading(true);
            setScriptLoaded(false);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      <div id={containerIdRef.current} data-testid="paypal-mobile-button"></div>
      <p className="text-xs text-center text-muted-foreground">
        Pago seguro procesado por PayPal
      </p>
    </div>
  );
}

function MobileCheckoutView({ 
  cart, 
  onBack, 
  onSuccess 
}: { 
  cart: MobileCartData;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPayPal, setShowPayPal] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const { data: billingProfile } = useQuery<BillingProfile>({
    queryKey: ["/api/billing-profile"],
  });

  const { data: user } = useQuery<{ id: string; email: string; displayName?: string }>({
    queryKey: ["/api/user"],
  });

  const form = useForm<BillingFormData>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      taxId: "",
      address: "",
      city: "",
      postalCode: "",
      country: "Espana",
    },
  });

  const isProfileComplete = useMemo(() => {
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

  useEffect(() => {
    if (billingProfile || user) {
      form.reset({
        fullName: billingProfile?.fullName || user?.displayName || "",
        email: billingProfile?.email || user?.email || "",
        taxId: billingProfile?.taxId || "",
        address: billingProfile?.address || "",
        city: billingProfile?.city || "",
        postalCode: billingProfile?.postalCode || "",
        country: billingProfile?.country || "Espana",
      });
    }
  }, [billingProfile, user, form]);

  useEffect(() => {
    if (isProfileComplete) {
      setShowPayPal(true);
    }
  }, [isProfileComplete]);

  const onSubmit = async (data: BillingFormData) => {
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/billing-profile", data);
      queryClient.invalidateQueries({ queryKey: ["/api/billing-profile"] });
      setShowPayPal(true);
      toast({
        title: "Datos guardados",
        description: "Tus datos de facturación se han guardado",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron guardar los datos",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const validateDiscountCode = async () => {
    if (!discountCode.trim()) return;
    
    setIsValidatingCode(true);
    try {
      const response = await apiRequest("POST", "/api/discount-codes/validate", {
        code: discountCode.trim().toUpperCase(),
        totalCents: cart.totalCents || cart.total * 100,
        forSubscription: false,
      });
      
      const data = await response.json();
      
      if (data.valid) {
        setAppliedDiscount({
          id: data.discountCode.id,
          code: data.discountCode.code,
          type: data.discountCode.type,
          value: data.discountCode.value,
          discountAmountCents: data.discountAmountCents,
          finalAmountCents: data.finalAmountCents,
        });
        toast({
          title: "Código aplicado",
          description: `Descuento de ${formatPrice(data.discountAmountCents, cart.currency || "EUR")} aplicado`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Código inválido",
          description: data.error || "El código de descuento no es válido",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo validar el código",
      });
    } finally {
      setIsValidatingCode(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode("");
  };

  const totalCents = cart.totalCents || cart.total * 100;
  const finalTotal = appliedDiscount ? appliedDiscount.finalAmountCents : totalCents;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b shrink-0 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-checkout">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          <h1 className="font-serif text-xl font-bold">Finalizar compra</h1>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Resumen</span>
              <span className="text-sm text-muted-foreground">{cart.items?.length || cart.itemCount} audiolibros</span>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {cart.items?.map((item) => (
                <div key={item.id} className="w-12 h-12 rounded overflow-hidden shrink-0">
                  {item.audiobook.coverArtUrl ? (
                    <img src={item.audiobook.coverArtUrl} alt={item.audiobook.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/80 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-primary-foreground/60" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tag className="w-4 h-4" />
              Código de descuento
            </div>
            {appliedDiscount ? (
              <div className="flex items-center justify-between bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                <div>
                  <span className="font-mono font-bold text-green-600 dark:text-green-400">{appliedDiscount.code}</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {appliedDiscount.type === "PERCENTAGE" 
                      ? `${appliedDiscount.value}% de descuento`
                      : `${formatPrice(appliedDiscount.value * 100, cart.currency || "EUR")} de descuento`
                    }
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={removeDiscount} data-testid="button-remove-discount-mobile">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Tu código"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), validateDiscountCode())}
                  className="flex-1 font-mono"
                  data-testid="input-discount-code-mobile"
                />
                <Button 
                  variant="outline" 
                  onClick={validateDiscountCode}
                  disabled={isValidatingCode || !discountCode.trim()}
                  data-testid="button-apply-discount-mobile"
                >
                  {isValidatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              {showPayPal && <Check className="w-4 h-4 text-green-500" />}
              <span className="font-medium text-sm">Datos de facturación</span>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Nombre completo</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={showPayPal} className="h-9" data-testid="input-fullname-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} disabled={showPayPal} className="h-9" data-testid="input-email-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Dirección</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={showPayPal} className="h-9" data-testid="input-address-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Ciudad</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={showPayPal} className="h-9" data-testid="input-city-mobile" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">C.P.</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={showPayPal} className="h-9" data-testid="input-postalcode-mobile" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Pais</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={showPayPal} className="h-9" data-testid="input-country-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!showPayPal && (
                  <Button type="submit" className="w-full" disabled={isProcessing} data-testid="button-continue-payment-mobile">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {isProcessing ? "Guardando..." : "Continuar al pago"}
                  </Button>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        {showPayPal && (
          <Card>
            <CardContent className="p-4">
              <p className="font-medium text-sm mb-3">Pago con PayPal</p>
              <MobilePayPalButton 
                totalCents={finalTotal}
                currency={cart.currency || "EUR"}
                discountCode={appliedDiscount?.code}
                onSuccess={onSuccess}
              />
            </CardContent>
          </Card>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatPrice(totalCents, cart.currency || "EUR")}</span>
          </div>
          {appliedDiscount && (
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span>Descuento</span>
              <span>-{formatPrice(appliedDiscount.discountAmountCents, cart.currency || "EUR")}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2">
            <span>Total</span>
            <span data-testid="text-checkout-total-mobile">{formatPrice(finalTotal, cart.currency || "EUR")}</span>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground pb-4">
          Al completar la compra, aceptas nuestros terminos y condiciones.
        </p>
      </div>
    </div>
  );
}

function CartTab({ onGoToExplore, onCheckout }: { onGoToExplore: () => void; onCheckout: (cart: MobileCartData) => void }) {
  const { toast } = useToast();

  const { data: user } = useQuery<{ id: string } | null>({
    queryKey: ["/api/auth/me"],
  });

  const { data: cart, isLoading } = useQuery<CartWithItems>({
    queryKey: ["/api/cart"],
    enabled: !!user,
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => apiRequest("DELETE", `/api/cart/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({ title: "Eliminado del carrito" });
    },
  });

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        <ShoppingCart className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground text-center">Inicia sesión para ver tu carrito</p>
        <Link href="/login?from=mobile">
          <Button data-testid="button-login">Iniciar sesión</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!cart?.items || cart.items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        <ShoppingCart className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Tu carrito está vacío</p>
        <Button variant="outline" onClick={onGoToExplore} data-testid="button-explore">
          Explorar audiolibros
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {cart.items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="flex gap-3 p-3">
                <div className="w-14 h-14 rounded overflow-hidden shrink-0">
                  {item.audiobook.coverArtUrl ? (
                    <img src={item.audiobook.coverArtUrl} alt={item.audiobook.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/80 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary-foreground/60" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm line-clamp-1">{item.audiobook.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.audiobook.author}</p>
                  <p className="text-sm font-bold text-primary mt-1">
                    {formatPrice(item.audiobook.priceCents, item.audiobook.currency)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive shrink-0"
                  onClick={() => removeItemMutation.mutate(item.id)}
                  data-testid={`button-remove-${item.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="p-4 border-t bg-muted/30 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-muted-foreground">Total:</span>
          <span className="text-xl font-bold">{formatPrice(cart.total)}</span>
        </div>
        <Button 
          className="w-full" 
          size="lg" 
          onClick={() => onCheckout({
            items: cart.items,
            totalCents: cart.total * 100,
            total: cart.total,
            itemCount: cart.items.length,
            currency: cart.items[0]?.audiobook.currency || "EUR"
          })}
          data-testid="button-checkout"
        >
          Pagar ahora
        </Button>
      </div>
    </div>
  );
}

interface AudiobookWithAccess extends Audiobook {
  chapters: Chapter[];
  hasAccess: boolean;
  isPurchased: boolean;
  isSubscriber: boolean;
  isFree: boolean;
}

function AudiobookDetailView({ 
  audiobook, 
  onBack, 
  onAddToCart, 
  inCart, 
  purchased,
  onPlayChapter
}: {
  audiobook: Audiobook;
  onBack: () => void;
  onAddToCart: () => void;
  inCart: boolean;
  purchased: boolean;
  onPlayChapter: (chapter: Chapter) => void;
}) {
  const { toast } = useToast();
  const [showAntennaPod, setShowAntennaPod] = useState(false);
  
  const { data: audiobookData, isLoading } = useQuery<AudiobookWithAccess>({
    queryKey: ["/api/audiobooks", audiobook.id],
  });

  const chapters = audiobookData?.chapters || [];
  const canPlay = audiobookData?.hasAccess || audiobookData?.isFree || purchased || audiobook.priceCents === 0;
  const rssUrl = `${window.location.origin}/api/podcasts/${audiobook.id}/rss`;

  const copyRssUrl = async () => {
    try {
      await navigator.clipboard.writeText(rssUrl);
      toast({ title: "Enlace RSS copiado" });
    } catch {
      toast({ title: "No se pudo copiar. Copia manualmente el enlace.", variant: "destructive" });
    }
  };

  const openAntennaPod = () => {
    const encodedUrl = encodeURIComponent(rssUrl);
    window.location.href = `antennapod://subscribe?url=${encodedUrl}`;
  };

  const openPlayStore = () => {
    window.open("https://play.google.com/store/apps/details?id=de.danoeh.antennapod", "_blank");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver
        </Button>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">
          <div className="flex gap-4">
            <div className="w-32 aspect-square rounded-lg overflow-hidden shadow-lg shrink-0">
              {audiobook.coverArtUrl ? (
                <img src={audiobook.coverArtUrl} alt={audiobook.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/80 flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-primary-foreground/60" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-xl font-bold line-clamp-2">{audiobook.title}</h1>
              <p className="text-muted-foreground">{audiobook.author}</p>
              {audiobook.category && (
                <Badge variant="secondary" className="mt-2">{audiobook.category}</Badge>
              )}
              {purchased && (
                <Badge className="mt-2 bg-green-600">
                  <Check className="w-3 h-3 mr-1" />
                  Comprado
                </Badge>
              )}
            </div>
          </div>

          {audiobook.description && (
            <p className="text-sm text-muted-foreground">{audiobook.description}</p>
          )}

          {!canPlay && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-muted-foreground">Precio:</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(audiobook.priceCents, audiobook.currency)}
                  </span>
                </div>
                <Button 
                  className="w-full" 
                  onClick={onAddToCart}
                  disabled={inCart}
                  data-testid="button-add-cart"
                >
                  {inCart ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      En el carrito
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Añadir al carrito
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          <section>
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-primary" />
              Capítulos ({chapters.length})
            </h2>
            
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : chapters.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay capítulos disponibles</p>
            ) : (
              <div className="space-y-2">
                {chapters.map((chapter, index) => (
                  <Card 
                    key={chapter.id} 
                    className={`overflow-hidden ${canPlay ? 'cursor-pointer hover-elevate' : 'opacity-60'}`}
                    onClick={() => canPlay && onPlayChapter(chapter)}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${canPlay ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {canPlay ? <Play className="w-4 h-4 ml-0.5" /> : <span className="text-sm">{index + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm line-clamp-1">{chapter.title}</h3>
                        {chapter.duration && (
                          <p className="text-xs text-muted-foreground">{formatDuration(chapter.duration)}</p>
                        )}
                      </div>
                      {!canPlay && (
                        <Badge variant="outline" className="shrink-0">
                          Comprar
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {canPlay && (
            <section>
              <button
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => setShowAntennaPod(!showAntennaPod)}
                data-testid="button-toggle-antennapod"
              >
                <div className="flex items-center gap-2">
                  <Rss className="w-5 h-5 text-primary" />
                  <span className="font-medium">Escuchar en AntennaPod</span>
                </div>
                {showAntennaPod ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAntennaPod && (
                <Card className="mt-3 border-primary/20">
                  <CardContent className="p-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      AntennaPod es una app gratuita para escuchar podcasts y audiolibros con funciones avanzadas como descarga offline y velocidad de reproducción.
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">1</div>
                        <div>
                          <p className="font-medium text-sm">Descargar AntennaPod</p>
                          <p className="text-xs text-muted-foreground mb-2">Instala la app desde Google Play Store</p>
                          <Button size="sm" variant="outline" onClick={openPlayStore} data-testid="button-play-store">
                            <Download className="w-4 h-4 mr-1" />
                            Google Play
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">2</div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Añadir el feed RSS</p>
                          <p className="text-xs text-muted-foreground mb-2">Copia este enlace y pégalo en AntennaPod</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={copyRssUrl} className="flex-1" data-testid="button-copy-rss">
                              <Copy className="w-4 h-4 mr-1" />
                              Copiar enlace
                            </Button>
                            <Button size="sm" onClick={openAntennaPod} className="flex-1" data-testid="button-open-antennapod">
                              <Rss className="w-4 h-4 mr-1" />
                              Abrir app
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">3</div>
                        <div>
                          <p className="font-medium text-sm">Sincronizar y escuchar</p>
                          <p className="text-xs text-muted-foreground">Los capítulos se descargarán automáticamente. Disfruta de la escucha offline.</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground text-center">
                        Enlace RSS: <span className="font-mono break-all">{rssUrl}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  role: string;
}

function ProfileView({ onBack, onShowSubscriptions }: { onBack: () => void; onShowSubscriptions: () => void }) {
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/auth/me"],
  });

  const { data: subscription } = useQuery<UserSubscription & { plan: SubscriptionPlan }>({
    queryKey: ["/api/subscriptions/active"],
    enabled: !!user,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      queryClient.invalidateQueries();
      toast({ title: "Sesión cerrada" });
      onBack();
    },
  });

  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-primary/20 shrink-0" style={{ backgroundColor: "#7C3AED" }}>
          <img src={logoImage} alt="Audivia" className="h-8 w-auto brightness-0 invert" />
          <Button variant="ghost" size="sm" className="text-white" onClick={onBack}>
            <X className="w-4 h-4 mr-1" />
            Cerrar
          </Button>
        </header>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-primary/20 shrink-0" style={{ backgroundColor: "#7C3AED" }}>
          <img src={logoImage} alt="Audivia" className="h-8 w-auto brightness-0 invert" />
          <Button variant="ghost" size="sm" className="text-white" onClick={onBack}>
            <X className="w-4 h-4 mr-1" />
            Cerrar
          </Button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          <User className="w-16 h-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">No has iniciado sesión</p>
          <Link href="/login?from=mobile">
            <Button data-testid="button-login">Iniciar sesión</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-primary/20 shrink-0" style={{ backgroundColor: "#7C3AED" }}>
        <img src={logoImage} alt="Audivia" className="h-8 w-auto brightness-0 invert" data-testid="img-logo" />
        <Button variant="ghost" size="sm" className="text-white" onClick={onBack} data-testid="button-back-profile">
          <X className="w-4 h-4 mr-1" />
          Cerrar
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-lg">{user.displayName || user.username}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {user.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {subscription ? (
          <Card className="border-accent bg-accent/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Crown className="w-10 h-10 text-accent" />
                <div>
                  <p className="font-semibold">Suscripción {subscription.plan?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Válida hasta {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-accent/20 to-primary/20 border-accent/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Crown className="w-10 h-10 text-accent" />
                <div>
                  <p className="font-semibold">Hazte Premium</p>
                  <p className="text-sm text-muted-foreground">Acceso ilimitado a todo el catálogo</p>
                </div>
              </div>
              <Button className="w-full" onClick={onShowSubscriptions} data-testid="button-show-subscriptions-profile">
                Ver planes de suscripción
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Cuenta
            </h3>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {logoutMutation.isPending ? "Cerrando sesión..." : "Cerrar sesión"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SubscriptionsView({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const { data: subscription } = useQuery<UserSubscription & { plan: SubscriptionPlan }>({
    queryKey: ["/api/subscriptions/active"],
  });

  const subscribeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest("POST", "/api/paypal/subscriptions", { planId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        toast({ title: "Error al procesar la suscripción", variant: "destructive" });
      }
      setProcessingPlanId(null);
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Error al crear la suscripción", variant: "destructive" });
      setProcessingPlanId(null);
    },
  });

  const handleSubscribe = (planId: string) => {
    setProcessingPlanId(planId);
    subscribeMutation.mutate(planId);
  };

  const activePlans = plans.filter(p => p.isActive);

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-primary/20 shrink-0" style={{ backgroundColor: "#7C3AED" }}>
        <img src={logoImage} alt="Audivia" className="h-8 w-auto brightness-0 invert" data-testid="img-logo" />
        <Button variant="ghost" size="sm" className="text-white" onClick={onBack} data-testid="button-back-subscriptions">
          <X className="w-4 h-4 mr-1" />
          Cerrar
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="text-center mb-6">
          <Crown className="w-16 h-16 mx-auto text-accent mb-3" />
          <h1 className="font-serif text-2xl font-bold">Planes Premium</h1>
          <p className="text-muted-foreground mt-1">Acceso ilimitado a todo el catálogo</p>
        </div>

        {subscription && (
          <Card className="border-accent bg-accent/10 mb-6">
            <CardContent className="p-4 text-center">
              <Check className="w-8 h-8 mx-auto text-green-600 mb-2" />
              <p className="font-semibold">Ya tienes una suscripción activa</p>
              <p className="text-sm text-muted-foreground">Plan: {subscription.plan?.name}</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : activePlans.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay planes disponibles en este momento</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activePlans.map((plan) => (
              <Card key={plan.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">
                        {formatPrice(plan.priceCents, plan.currency)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        /{plan.intervalMonths === 1 ? "mes" : `${plan.intervalMonths} meses`}
                      </p>
                    </div>
                  </div>
                  
                  {plan.trialDays > 0 && (
                    <Badge className="mb-3 bg-accent text-accent-foreground">
                      {plan.trialDays} días de prueba gratis
                    </Badge>
                  )}

                  <ul className="text-sm space-y-2 mb-4">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Acceso ilimitado a audiolibros
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Escucha sin conexión
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Nuevos títulos cada semana
                    </li>
                  </ul>

                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!subscription || processingPlanId === plan.id || !plan.paypalPlanId}
                    data-testid={`button-subscribe-${plan.id}`}
                  >
                    {processingPlanId === plan.id ? (
                      "Procesando..."
                    ) : subscription ? (
                      "Ya suscrito"
                    ) : !plan.paypalPlanId ? (
                      "No disponible"
                    ) : (
                      "Suscribirse con PayPal"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>Al suscribirte aceptas nuestros términos de servicio.</p>
          <p>Puedes cancelar en cualquier momento.</p>
        </div>
      </div>
    </div>
  );
}

export default function MobilePage() {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [selectedAudiobook, setSelectedAudiobook] = useState<Audiobook | null>(null);
  const [playingChapter, setPlayingChapter] = useState<{ chapter: Chapter; audiobook: Audiobook } | null>(null);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [checkoutCart, setCheckoutCart] = useState<MobileCartData | null>(null);
  const { toast } = useToast();

  const { data: user } = useQuery<{ id: string } | null>({
    queryKey: ["/api/auth/me"],
  });

  const { data: cart } = useQuery<CartWithItems>({
    queryKey: ["/api/cart"],
    enabled: !!user,
  });

  const { data: audiobooks = [], isLoading: loadingAudiobooks } = useQuery<Audiobook[]>({
    queryKey: ["/api/audiobooks"],
  });

  const { data: purchases = [] } = useQuery<{ audiobookId: string }[]>({
    queryKey: ["/api/library/purchases"],
    enabled: !!user,
  });

  const { data: selectedAudiobookData } = useQuery<AudiobookWithAccess>({
    queryKey: ["/api/audiobooks", selectedAudiobook?.id],
    enabled: !!selectedAudiobook,
  });

  const chapters = selectedAudiobookData?.chapters || [];

  const cartItems = cart?.items.map(i => i.audiobook.id) || [];
  const cartCount = cart?.items.length || 0;
  const purchasedIds = purchases?.map(p => p.audiobookId) || [];

  const addToCartMutation = useMutation({
    mutationFn: (audiobookId: string) => apiRequest("POST", "/api/cart/items", { audiobookId, quantity: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({ title: "Añadido al carrito" });
    },
    onError: () => {
      toast({ title: "Inicia sesión para añadir al carrito", variant: "destructive" });
    },
  });

  const handleAddToCart = (audiobookId: string) => {
    if (!user) {
      toast({ title: "Inicia sesión para añadir al carrito", variant: "destructive" });
      return;
    }
    if (cartItems.includes(audiobookId)) {
      toast({ title: "Ya está en el carrito" });
      return;
    }
    addToCartMutation.mutate(audiobookId);
  };

  const handlePlayChapter = (chapter: Chapter) => {
    if (selectedAudiobook) {
      setPlayingChapter({ chapter, audiobook: selectedAudiobook });
    }
  };

  const currentChapterIndex = chapters.findIndex(c => c.id === playingChapter?.chapter.id);
  const hasNextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1;
  const hasPrevChapter = currentChapterIndex > 0;

  const playNextChapter = () => {
    if (hasNextChapter && selectedAudiobook) {
      setPlayingChapter({ chapter: chapters[currentChapterIndex + 1], audiobook: selectedAudiobook });
    }
  };

  const playPrevChapter = () => {
    if (hasPrevChapter && selectedAudiobook) {
      setPlayingChapter({ chapter: chapters[currentChapterIndex - 1], audiobook: selectedAudiobook });
    }
  };

  const handleCheckoutSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    queryClient.invalidateQueries({ queryKey: ["/api/library/purchases"] });
    setCheckoutCart(null);
    setActiveTab("library");
    toast({
      title: "Compra completada",
      description: "Tus audiolibros están listos para escuchar",
    });
  };

  if (checkoutCart) {
    return (
      <MobileCheckoutView 
        cart={checkoutCart}
        onBack={() => setCheckoutCart(null)}
        onSuccess={handleCheckoutSuccess}
      />
    );
  }

  if (showProfile) {
    return (
      <ProfileView 
        onBack={() => setShowProfile(false)} 
        onShowSubscriptions={() => {
          setShowProfile(false);
          setShowSubscriptions(true);
        }}
      />
    );
  }

  if (showSubscriptions) {
    return <SubscriptionsView onBack={() => setShowSubscriptions(false)} />;
  }

  if (playingChapter) {
    return (
      <AudioPlayer
        chapter={playingChapter.chapter}
        audiobook={playingChapter.audiobook}
        onClose={() => setPlayingChapter(null)}
        onNext={playNextChapter}
        onPrev={playPrevChapter}
        hasNext={hasNextChapter}
        hasPrev={hasPrevChapter}
      />
    );
  }

  if (selectedAudiobook) {
    return (
      <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-primary/20 shrink-0" style={{ backgroundColor: "#7C3AED" }}>
          <img src={logoImage} alt="Audivia" className="h-8 w-auto brightness-0 invert" data-testid="img-logo" />
          <div className="flex items-center gap-2">
            {user ? (
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setShowProfile(true)} data-testid="button-profile">
                <User className="w-5 h-5" />
              </Button>
            ) : (
              <Link href="/login?from=mobile">
                <Button size="sm" variant="outline" className="text-white border-white/50 hover:bg-white/10" data-testid="button-login">
                  Entrar
                </Button>
              </Link>
            )}
          </div>
        </header>
        <AudiobookDetailView
          audiobook={selectedAudiobook}
          onBack={() => setSelectedAudiobook(null)}
          onAddToCart={() => handleAddToCart(selectedAudiobook.id)}
          inCart={cartItems.includes(selectedAudiobook.id)}
          purchased={purchasedIds.includes(selectedAudiobook.id)}
          onPlayChapter={handlePlayChapter}
        />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-primary/20 shrink-0" style={{ backgroundColor: "#7C3AED" }}>
        <img src={logoImage} alt="Audivia" className="h-8 w-auto brightness-0 invert" data-testid="img-logo" />
        <div className="flex items-center gap-2">
          {user ? (
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setShowProfile(true)} data-testid="button-profile">
              <User className="w-5 h-5" />
            </Button>
          ) : (
            <Link href="/login?from=mobile">
              <Button size="sm" variant="outline" className="text-white border-white/50 hover:bg-white/10" data-testid="button-login">
                Entrar
              </Button>
            </Link>
          )}
        </div>
      </header>

      {activeTab === "home" && (
        <HomeTab 
          audiobooks={audiobooks}
          isLoading={loadingAudiobooks}
          onViewAudiobook={setSelectedAudiobook}
          cartItems={cartItems}
          purchasedIds={purchasedIds}
          onAddToCart={handleAddToCart}
          onShowSubscriptions={() => setShowSubscriptions(true)}
        />
      )}
      {activeTab === "explore" && (
        <ExploreTab 
          audiobooks={audiobooks}
          isLoading={loadingAudiobooks}
          cartItems={cartItems}
          purchasedIds={purchasedIds}
          onAddToCart={handleAddToCart}
          onViewAudiobook={setSelectedAudiobook}
        />
      )}
      {activeTab === "library" && (
        <LibraryTab onViewAudiobook={setSelectedAudiobook} />
      )}
      {activeTab === "cart" && (
        <CartTab 
          onGoToExplore={() => setActiveTab("explore")} 
          onCheckout={(cart) => setCheckoutCart(cart)}
        />
      )}

      <nav className="grid grid-cols-4 border-t bg-background shrink-0" data-testid="nav-tabs">
        <button
          className={`flex flex-col items-center justify-center py-3 gap-1 ${activeTab === "home" ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("home")}
          data-testid="tab-home"
        >
          <Home className="w-5 h-5" />
          <span className="text-xs">Inicio</span>
        </button>
        <button
          className={`flex flex-col items-center justify-center py-3 gap-1 ${activeTab === "explore" ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("explore")}
          data-testid="tab-explore"
        >
          <Search className="w-5 h-5" />
          <span className="text-xs">Explorar</span>
        </button>
        <button
          className={`flex flex-col items-center justify-center py-3 gap-1 ${activeTab === "library" ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("library")}
          data-testid="tab-library"
        >
          <Library className="w-5 h-5" />
          <span className="text-xs">Biblioteca</span>
        </button>
        <button
          className={`flex flex-col items-center justify-center py-3 gap-1 relative ${activeTab === "cart" ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("cart")}
          data-testid="tab-cart"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-xs">Carrito</span>
          {cartCount > 0 && (
            <span className="absolute top-1 right-1/4 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}
