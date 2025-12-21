import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Heart, Clock, BookOpen, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Audiobook } from "@shared/schema";

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

const categories = [
  "Todos",
  "Fiction",
  "Non-Fiction",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Biography",
  "Self-Help",
  "Business",
  "History",
];

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [priceFilter, setPriceFilter] = useState("all");
  const { toast } = useToast();

  const { data: audiobooks = [], isLoading } = useQuery<Audiobook[]>({
    queryKey: ["/api/audiobooks"],
  });

  const { data: userFavorites = [] } = useQuery<Array<{ id: string }>>({
    queryKey: ["/api/library/favorites"],
  });

  const favoriteIds = new Set(userFavorites.map(f => f.id));

  const filteredAudiobooks = audiobooks.filter((audiobook) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      audiobook.title.toLowerCase().includes(query) ||
      audiobook.author.toLowerCase().includes(query) ||
      audiobook.description.toLowerCase().includes(query) ||
      audiobook.category.toLowerCase().includes(query);
    
    const matchesCategory = selectedCategory === "Todos" || audiobook.category === selectedCategory;
    
    const matchesPrice = 
      priceFilter === "all" ||
      (priceFilter === "free" && audiobook.isFree) ||
      (priceFilter === "paid" && !audiobook.isFree);

    return matchesSearch && matchesCategory && matchesPrice;
  });

  const handleToggleFavorite = async (audiobookId: string) => {
    const isFav = favoriteIds.has(audiobookId);
    try {
      if (isFav) {
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

  return (
    <div className="min-h-screen pb-32">
      <div className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h1 className="font-serif text-4xl font-bold mb-3" data-testid="text-page-title">
            Explorar Audiolibros
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Descubre tu proxima historia favorita entre miles de audiolibros narrados profesionalmente
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por titulo, autor..."
              className="pl-10"
              data-testid="input-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-category">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priceFilter} onValueChange={setPriceFilter}>
            <SelectTrigger className="w-full md:w-40" data-testid="select-price">
              <SelectValue placeholder="Precio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="free">Gratis</SelectItem>
              <SelectItem value="paid">De pago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAudiobooks.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-lg">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || selectedCategory !== "Todos" || priceFilter !== "all"
                ? "No se encontraron audiolibros con esos filtros"
                : "No hay audiolibros disponibles aun"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredAudiobooks.map((audiobook) => (
              <Card
                key={audiobook.id}
                className="group overflow-hidden hover-elevate cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
                data-testid={`card-audiobook-${audiobook.id}`}
              >
                <div className="aspect-square relative overflow-hidden">
                  <Link href={`/audiobook/${audiobook.id}`} className="block w-full h-full">
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
                  </Link>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
                      <Button 
                        size="sm" 
                        variant={favoriteIds.has(audiobook.id) ? "default" : "secondary"}
                        className="w-full gap-2"
                        data-testid={`button-toggle-favorite-${audiobook.id}`}
                        onClick={() => handleToggleFavorite(audiobook.id)}
                      >
                        <Heart className={`w-4 h-4 ${favoriteIds.has(audiobook.id) ? "fill-current" : ""}`} />
                        {favoriteIds.has(audiobook.id) ? "En favoritos" : "Agregar a favoritos"}
                      </Button>
                    </div>
                  </div>
                  {audiobook.isFree && (
                    <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
                      Gratis
                    </Badge>
                  )}
                </div>
                <Link href={`/audiobook/${audiobook.id}`}>
                  <CardContent className="p-4">
                    <h3 className="font-serif font-semibold text-lg line-clamp-1">{audiobook.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{audiobook.author}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(audiobook.totalDuration)}</span>
                      </div>
                      {!audiobook.isFree && audiobook.priceCents > 0 && (
                        <span className="font-semibold text-primary">
                          {formatPrice(audiobook.priceCents, audiobook.currency)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
