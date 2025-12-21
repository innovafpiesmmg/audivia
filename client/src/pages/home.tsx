import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Play, Clock, Heart, ChevronRight, Headphones, BookOpen, Star } from "lucide-react";
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

function AudiobookCard({ audiobook }: { audiobook: Audiobook }) {
  return (
    <Link href={`/audiobook/${audiobook.id}`}>
      <Card 
        className="group overflow-hidden hover-elevate cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
        data-testid={`card-audiobook-${audiobook.id}`}
      >
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
            <div className="absolute bottom-4 left-4 right-4">
              <Button size="sm" className="w-full gap-2">
                <Play className="w-4 h-4" />
                Escuchar muestra
              </Button>
            </div>
          </div>
          {audiobook.isFree && (
            <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
              Gratis
            </Badge>
          )}
        </div>
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
      </Card>
    </Link>
  );
}

function AudiobookGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
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
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-background to-accent/10 py-16 md:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 border-accent text-accent">
            <Star className="w-3 h-3 mr-1 fill-accent" />
            Tu biblioteca premium
          </Badge>
          <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6 leading-tight" data-testid="text-hero-title">
            Descubre el placer de <span className="text-primary">escuchar</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Miles de audiolibros narrados por profesionales. Compra tus favoritos o suscribete para acceso ilimitado.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/explore">
              <Button size="lg" className="gap-2 px-8">
                <Headphones className="w-5 h-5" />
                Explorar catálogo
              </Button>
            </Link>
            <Link href="/subscriptions">
              <Button size="lg" variant="outline" className="gap-2 px-8">
                Prueba gratuita
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ title, viewAllHref }: { title: string; viewAllHref?: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="font-serif text-2xl md:text-3xl font-bold">{title}</h2>
      {viewAllHref && (
        <Link href={viewAllHref}>
          <Button variant="ghost" size="sm" className="gap-1">
            Ver todo
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const { data: audiobooks, isLoading } = useQuery<Audiobook[]>({
    queryKey: ["/api/audiobooks"],
  });

  const featuredAudiobooks = audiobooks?.slice(0, 6) || [];
  const freeAudiobooks = audiobooks?.filter(a => a.isFree) || [];

  return (
    <div className="min-h-screen">
      <HeroSection />

      <div className="container mx-auto px-4 py-12 space-y-16">
        <section>
          <SectionHeader title="Destacados" viewAllHref="/explore" />
          {isLoading ? (
            <AudiobookGridSkeleton />
          ) : featuredAudiobooks.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {featuredAudiobooks.map((audiobook) => (
                <AudiobookCard key={audiobook.id} audiobook={audiobook} />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Aun no hay audiolibros</h3>
              <p className="text-muted-foreground">
                Los audiolibros aparecerán aqui cuando se agreguen al catálogo.
              </p>
            </Card>
          )}
        </section>

        {freeAudiobooks.length > 0 && (
          <section>
            <SectionHeader title="Gratis esta semana" viewAllHref="/explore?filter=free" />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {freeAudiobooks.slice(0, 6).map((audiobook) => (
                <AudiobookCard key={audiobook.id} audiobook={audiobook} />
              ))}
            </div>
          </section>
        )}

        <section className="py-12 bg-card rounded-2xl px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Suscripción premium
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Acceso ilimitado a todo el catálogo por una tarifa mensual. Cancela cuando quieras.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/subscriptions">
                <Button size="lg" className="gap-2">
                  <Heart className="w-5 h-5" />
                  Comenzar prueba gratuita
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
