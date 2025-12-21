import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { Loader2, Rss, CheckCircle, AlertCircle, ArrowLeft, Info } from "lucide-react";

const importRSSSchema = z.object({
  rssUrl: z.string().url("Ingresa una URL válida"),
});

type ImportRSSFormData = z.infer<typeof importRSSSchema>;

type ImportResult = {
  podcast: { id: string };
  imported: number;
  skipped: number;
  totalInFeed: number;
  message: string;
  errors?: string[];
};

export default function ImportRSS() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<{
    success: boolean;
    data?: ImportResult;
    error?: string;
    details?: any;
  } | null>(null);

  const form = useForm<ImportRSSFormData>({
    resolver: zodResolver(importRSSSchema),
    defaultValues: {
      rssUrl: "",
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: ImportRSSFormData) => {
      // apiRequest parses JSON and throws ApiError on non-OK responses
      return await apiRequest<ImportResult>("POST", "/api/podcasts/import-rss", data);
    },
    onSuccess: (data) => {
      setResult({
        success: true,
        data,
      });
      
      toast({
        title: "¡Podcast importado!",
        description: `Se importaron ${data.imported} episodio${data.imported !== 1 ? 's' : ''} exitosamente`,
      });
      
      // Invalidate podcasts cache
      queryClient.invalidateQueries({ queryKey: ["/api/my-podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      
      // Reset form
      form.reset();
    },
    onError: (error: Error) => {
      // apiRequest throws ApiError extending Error with status, details, etc.
      const errorMessage = error.message || "Error al importar el podcast";
      const errorDetails = error instanceof ApiError ? error.details : undefined;
      
      setResult({
        success: false,
        error: errorMessage,
        details: errorDetails,
      });
      
      toast({
        variant: "destructive",
        title: "Error al importar",
        description: errorMessage,
      });
    },
  });

  const onSubmit = (data: ImportRSSFormData) => {
    setResult(null);
    importMutation.mutate(data);
  };

  const handleViewPodcast = () => {
    if (result?.data?.podcast?.id) {
      setLocation(`/podcast/${result.data.podcast.id}`);
    }
  };

  const handleImportAnother = () => {
    setResult(null);
    form.reset();
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6" data-testid="page-import-rss">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/my-podcasts")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Importar Podcast desde RSS</h1>
          <p className="text-muted-foreground mt-1">
            Importa podcasts desde plataformas como Spotify, Apple Podcasts, iVoox, etc.
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>¿Cómo funciona?</strong> Pega la URL del feed RSS de cualquier podcast y automáticamente importaremos
          toda la información del podcast y hasta 50 de sus episodios más recientes.
        </AlertDescription>
      </Alert>

      {/* Import Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rss className="h-5 w-5" />
            Feed RSS
          </CardTitle>
          <CardDescription>
            Pega la URL del feed RSS del podcast que deseas importar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="rssUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL del Feed RSS</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://ejemplo.com/feed.xml"
                        {...field}
                        disabled={importMutation.isPending}
                        data-testid="input-rss-url"
                      />
                    </FormControl>
                    <FormDescription>
                      Ejemplo: https://feeds.simplecast.com/podcast-id
                    </FormDescription>
                    <FormMessage data-testid="error-rss-url" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={importMutation.isPending}
                className="w-full"
                data-testid="button-import"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando podcast...
                  </>
                ) : (
                  <>
                    <Rss className="mr-2 h-4 w-4" />
                    Importar Podcast
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Result */}
          {result && (
            <div className="mt-6">
              {result.success && result.data ? (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-900 dark:text-green-100">
                    <div className="space-y-2">
                      <p className="font-semibold" data-testid="text-success-message">{result.data.message}</p>
                      <div className="text-sm space-y-1">
                        <p data-testid="text-imported-count">• Episodios importados: {result.data.imported}</p>
                        {result.data.skipped > 0 && (
                          <p data-testid="text-skipped-count">• Episodios omitidos: {result.data.skipped}</p>
                        )}
                        <p data-testid="text-total-count">• Total en el feed: {result.data.totalInFeed}</p>
                      </div>
                      {result.data.errors && result.data.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                          <p className="font-semibold mb-1">Advertencias:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {result.data.errors.map((err, idx) => (
                              <li key={idx} className="text-yellow-900 dark:text-yellow-100">{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.data.totalInFeed > 50 && (
                        <p className="text-sm text-muted-foreground italic" data-testid="text-limit-notice">
                          Solo se importan los primeros 50 episodios
                        </p>
                      )}
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleViewPodcast} data-testid="button-view-podcast">
                          Ver Podcast
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleImportAnother}
                          data-testid="button-import-another"
                        >
                          Importar Otro
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold" data-testid="text-error-message">Error al importar</p>
                    <p className="text-sm mt-1" data-testid="text-error-detail">{result.error}</p>
                    {result.details && (
                      <pre className="mt-2 text-xs bg-destructive/10 p-2 rounded overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Examples Card */}
      <Card>
        <CardHeader>
          <CardTitle>Ejemplos de URLs de RSS</CardTitle>
          <CardDescription>
            Aquí hay algunos ejemplos de cómo encontrar el feed RSS en diferentes plataformas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">Spotify:</p>
            <p className="text-muted-foreground">
              Busca en Google "nombre del podcast RSS feed" o usa servicios como podcasts.apple.com para encontrar el feed
            </p>
          </div>
          <div>
            <p className="font-semibold">Apple Podcasts:</p>
            <p className="text-muted-foreground">
              La URL del feed RSS suele estar disponible en la página del podcast
            </p>
          </div>
          <div>
            <p className="font-semibold">iVoox:</p>
            <p className="text-muted-foreground">
              Busca el ícono RSS en la página del podcast
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
