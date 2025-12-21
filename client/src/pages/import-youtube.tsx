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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { Loader2, Youtube, CheckCircle, AlertCircle, ArrowLeft, Info, AlertTriangle, Clock } from "lucide-react";

const previewSchema = z.object({
  playlistUrl: z.string().url("Ingresa una URL válida").refine(
    (url) => url.includes('youtube.com') || url.includes('youtu.be'),
    { message: "Debe ser una URL de YouTube" }
  ),
  maxVideos: z.coerce.number().int().min(1, "Mínimo 1 video").max(50, "Máximo 50 videos").default(10),
});

const importSchema = z.object({
  playlistUrl: z.string(),
  selectedVideoIds: z.array(z.string()).min(1, "Debes seleccionar al menos un video"),
  podcastTitle: z.string().optional(),
  podcastDescription: z.string().optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).default("PUBLIC"),
});

type PreviewData = {
  playlist: {
    title: string;
    description: string;
    channelTitle: string;
    thumbnailUrl: string;
  };
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    duration: number;
    publishedAt: string;
  }>;
  totalVideos: number;
};

type ImportResult = {
  podcast: { id: string };
  imported: number;
  skipped: number;
  message: string;
  errors?: string[];
};

export default function ImportYouTube() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"config" | "select" | "success">("config");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [podcastConfig, setPodcastConfig] = useState<{
    playlistUrl: string;
    title?: string;
    description?: string;
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const previewForm = useForm({
    resolver: zodResolver(previewSchema),
    defaultValues: {
      playlistUrl: "",
      maxVideos: 10,
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (data: z.infer<typeof previewSchema>) => {
      const params = new URLSearchParams({
        playlistUrl: data.playlistUrl,
        maxVideos: data.maxVideos.toString(),
      });
      return await apiRequest<PreviewData>("GET", `/api/import-youtube/preview?${params}`);
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setSelectedVideoIds(data.videos.map(v => v.videoId)); // Select all by default
      setStep("select");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error al obtener playlist",
        description: error.message,
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!podcastConfig || !previewData) throw new Error("Configuración no disponible");
      
      return await apiRequest<ImportResult>("POST", "/api/import-youtube", {
        playlistUrl: podcastConfig.playlistUrl,
        selectedVideoIds,
        podcastTitle: podcastConfig.title || undefined,
        podcastDescription: podcastConfig.description || undefined,
        visibility: podcastConfig.visibility,
        maxVideos: Math.min(previewData.videos.length, 50),
      });
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("success");
      
      toast({
        title: "¡Importación completada!",
        description: `Se importaron ${data.imported} episodio${data.imported !== 1 ? 's' : ''}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/my-podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error al importar",
        description: error.message,
      });
    },
  });

  const handlePreview = (data: z.infer<typeof previewSchema>) => {
    setPodcastConfig({
      playlistUrl: data.playlistUrl,
      visibility: "PUBLIC",
    });
    previewMutation.mutate(data);
  };

  const toggleVideo = (videoId: string) => {
    setSelectedVideoIds(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const toggleAll = () => {
    if (!previewData) return;
    if (selectedVideoIds.length === previewData.videos.length) {
      setSelectedVideoIds([]);
    } else {
      setSelectedVideoIds(previewData.videos.map(v => v.videoId));
    }
  };

  const handleBack = () => {
    if (step === "select") {
      setStep("config");
      setPreviewData(null);
      setSelectedVideoIds([]);
    } else if (step === "success") {
      setStep("config");
      setPreviewData(null);
      setSelectedVideoIds([]);
      setImportResult(null);
      setPodcastConfig(null);
      previewForm.reset();
    }
  };

  const handleViewPodcast = () => {
    if (importResult?.podcast?.id) {
      setLocation(`/podcast/${importResult.podcast.id}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6" data-testid="page-import-youtube">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step === "config" ? setLocation("/my-podcasts") : handleBack()}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Importar desde YouTube
          </h1>
          <p className="text-muted-foreground mt-1">
            {step === "config" && "Paso 1: Configuración de la playlist"}
            {step === "select" && `Paso 2: Selecciona los videos a importar (${selectedVideoIds.length} de ${previewData?.videos.length || 0})`}
            {step === "success" && "Importación completada"}
          </p>
        </div>
      </div>

      {/* Warning Card */}
      <Alert className="border-yellow-500 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertDescription className="text-yellow-900 dark:text-yellow-100">
          <strong>Aviso Legal:</strong> Esta funcionalidad descarga audio de YouTube. Úsala solo con contenido del cual tengas
          derechos o permiso explícito del creador. El uso indebido puede violar los Términos de Servicio de YouTube.
        </AlertDescription>
      </Alert>

      {/* Step 1: Configuration */}
      {step === "config" && (
        <>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>¿Cómo funciona?</strong> Ingresa la URL de una lista de reproducción pública de YouTube.
              Podrás ver todos los videos y seleccionar cuáles importar antes de procesar.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="h-5 w-5" />
                Configuración de Importación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...previewForm}>
                <form onSubmit={previewForm.handleSubmit(handlePreview)} className="space-y-4">
                  <FormField
                    control={previewForm.control}
                    name="playlistUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de la Playlist</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://www.youtube.com/playlist?list=PLxxxxxx"
                            {...field}
                            disabled={previewMutation.isPending}
                            data-testid="input-playlist-url"
                          />
                        </FormControl>
                        <FormDescription>
                          Debe ser una playlist pública de YouTube
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={previewForm.control}
                    name="maxVideos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número Máximo de Videos</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={field.value}
                            onChange={(e) => {
                              const value = e.target.value === '' ? '' : Number(e.target.value);
                              field.onChange(value);
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                            disabled={previewMutation.isPending}
                            data-testid="input-max-videos"
                          />
                        </FormControl>
                        <FormDescription>
                          Máximo de videos a mostrar para selección (1-50)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={previewMutation.isPending}
                    className="w-full"
                    data-testid="button-preview"
                  >
                    {previewMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Obteniendo información...
                      </>
                    ) : (
                      <>
                        <Youtube className="mr-2 h-4 w-4" />
                        Ver Playlist y Seleccionar Videos
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Video Selection */}
      {step === "select" && previewData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Información de la Playlist</CardTitle>
              <CardDescription>{previewData.playlist.channelTitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                {previewData.playlist.thumbnailUrl && (
                  <img 
                    src={previewData.playlist.thumbnailUrl} 
                    alt={previewData.playlist.title}
                    className="w-32 h-32 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{previewData.playlist.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{previewData.playlist.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Título del Podcast (Opcional)</Label>
                <Input
                  placeholder={previewData.playlist.title}
                  value={podcastConfig?.title || ""}
                  onChange={(e) => setPodcastConfig(prev => ({ ...prev!, title: e.target.value }))}
                  data-testid="input-podcast-title"
                />
                
                <Label>Descripción (Opcional)</Label>
                <Textarea
                  placeholder={previewData.playlist.description}
                  value={podcastConfig?.description || ""}
                  onChange={(e) => setPodcastConfig(prev => ({ ...prev!, description: e.target.value }))}
                  rows={3}
                  data-testid="input-podcast-description"
                />

                <div>
                  <Label>Visibilidad</Label>
                  <Select 
                    value={podcastConfig?.visibility}
                    onValueChange={(value: any) => setPodcastConfig(prev => ({ ...prev!, visibility: value }))}
                  >
                    <SelectTrigger data-testid="select-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Público - Visible para todos</SelectItem>
                      <SelectItem value="UNLISTED">No listado - Solo con enlace</SelectItem>
                      <SelectItem value="PRIVATE">Privado - Solo tú</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Selecciona Videos ({selectedVideoIds.length}/{previewData.videos.length})</CardTitle>
                <CardDescription>Marca los videos que deseas importar como episodios</CardDescription>
              </div>
              <Button variant="outline" onClick={toggleAll} size="sm">
                {selectedVideoIds.length === previewData.videos.length ? "Deseleccionar Todos" : "Seleccionar Todos"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {previewData.videos.map((video) => (
                  <div
                    key={video.videoId}
                    className="flex items-start gap-3 p-3 border rounded hover-elevate"
                    data-testid={`video-item-${video.videoId}`}
                  >
                    <Checkbox
                      checked={selectedVideoIds.includes(video.videoId)}
                      onCheckedChange={() => toggleVideo(video.videoId)}
                      data-testid={`checkbox-${video.videoId}`}
                    />
                    <img 
                      src={video.thumbnailUrl} 
                      alt={video.title}
                      className="w-24 h-16 object-cover rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{video.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(video.duration)}
                        </span>
                        <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    La importación puede tardar varios minutos. Se descargará el audio de cada video seleccionado
                    y se creará un episodio de podcast. El proceso es: {selectedVideoIds.length} video{selectedVideoIds.length !== 1 ? 's' : ''} × ~30 segundos/video = ~{Math.ceil(selectedVideoIds.length * 0.5)} minuto{Math.ceil(selectedVideoIds.length * 0.5) !== 1 ? 's' : ''}.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending || selectedVideoIds.length === 0}
                  className="w-full"
                  data-testid="button-import"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando {selectedVideoIds.length} video{selectedVideoIds.length !== 1 ? 's' : ''}... Esto tomará varios minutos
                    </>
                  ) : (
                    <>
                      <Youtube className="mr-2 h-4 w-4" />
                      Importar {selectedVideoIds.length} Video{selectedVideoIds.length !== 1 ? 's' : ''} Seleccionado{selectedVideoIds.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 3: Success */}
      {step === "success" && importResult && (
        <Card>
          <CardContent className="pt-6">
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-900 dark:text-green-100">
                <div className="space-y-2">
                  <p className="font-semibold" data-testid="text-success-message">{importResult.message}</p>
                  <div className="text-sm space-y-1">
                    <p>• Episodios importados: {importResult.imported}</p>
                    {importResult.skipped > 0 && (
                      <p>• Videos omitidos: {importResult.skipped}</p>
                    )}
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                      <p className="font-semibold mb-1">Advertencias:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleViewPodcast} data-testid="button-view-podcast">
                      Ver Podcast
                    </Button>
                    <Button variant="outline" onClick={handleBack} data-testid="button-import-another">
                      Importar Otra Playlist
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
