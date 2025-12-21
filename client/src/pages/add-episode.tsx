import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertEpisodeSchema } from "@shared/schema";
import { Loader2, ArrowLeft, Lock, Users, Globe } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Podcast } from "@shared/schema";

const episodeFormSchema = insertEpisodeSchema.extend({
  audioAssetId: z.string().min(1, "Debes subir un archivo de audio"),
  audioUrl: z.string().min(1),
  duration: z.number().min(1, "La duración debe ser mayor a 0"),
  coverAssetId: z.string().optional(),
  coverUrl: z.string().optional(),
}).omit({ podcastId: true });

type EpisodeFormValues = z.infer<typeof episodeFormSchema>;

export default function AddEpisode() {
  const [, params] = useRoute("/podcast/:podcastId/add-episode");
  const podcastId = params?.podcastId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: podcast, isLoading } = useQuery<Podcast>({
    queryKey: ["/api/podcasts", podcastId],
    enabled: !!podcastId,
  });

  const form = useForm<EpisodeFormValues>({
    resolver: zodResolver(episodeFormSchema),
    defaultValues: {
      title: "",
      notes: "",
      audioUrl: "",
      audioAssetId: "",
      duration: 0,
      coverUrl: undefined,
      coverAssetId: undefined,
      visibility: "PUBLIC",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EpisodeFormValues) => {
      if (!podcastId) throw new Error("ID de podcast no encontrado");

      await apiRequest("POST", "/api/episodes", {
        title: data.title,
        notes: data.notes,
        audioUrl: data.audioUrl,
        audioAssetId: data.audioAssetId,
        duration: data.duration,
        coverArtUrl: data.coverUrl || undefined,
        coverArtAssetId: data.coverAssetId || undefined,
        podcastId: podcastId,
        visibility: data.visibility,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts", podcastId] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      toast({
        title: "Episodio creado",
        description: "Tu episodio ha sido creado exitosamente.",
      });
      setLocation(`/podcast/${podcastId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el episodio. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EpisodeFormValues) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-32">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!podcast) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Podcast no encontrado</h2>
          <Link href="/">
            <Button variant="default">Volver al inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link href={`/podcast/${podcastId}`}>
          <Button variant="ghost" className="mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al podcast
          </Button>
        </Link>

        <h1 className="text-4xl font-bold font-[Outfit] mb-2" data-testid="text-page-title">
          Añadir Episodio
        </h1>
        <p className="text-muted-foreground mb-2">
          Añadiendo episodio a: <span className="font-semibold">{podcast.title}</span>
        </p>
        <p className="text-muted-foreground mb-8">
          Completa la información de tu nuevo episodio.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información del Episodio</CardTitle>
                <CardDescription>
                  Detalles sobre el nuevo episodio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título del Episodio</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Episodio: Introducción"
                          data-testid="input-episode-title"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas del Episodio (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="En este episodio hablamos sobre..."
                          className="min-h-32 resize-none"
                          data-testid="input-episode-notes"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Privacidad del Episodio</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                        data-testid="select-episode-visibility"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la privacidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PUBLIC" data-testid="option-episode-visibility-public">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4" />
                              <div>
                                <div className="font-medium">Público</div>
                                <div className="text-xs text-muted-foreground">
                                  Visible para todos
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="UNLISTED" data-testid="option-episode-visibility-unlisted">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <div>
                                <div className="font-medium">Solo invitados</div>
                                <div className="text-xs text-muted-foreground">
                                  Solo usuarios invitados
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="PRIVATE" data-testid="option-episode-visibility-private">
                            <div className="flex items-center gap-2">
                              <Lock className="w-4 h-4" />
                              <div>
                                <div className="font-medium">Privado</div>
                                <div className="text-xs text-muted-foreground">
                                  Solo tú
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Portada del Episodio (opcional)</FormLabel>
                  <FormControl>
                    <FileUpload
                      mode="cover"
                      data-testid="upload-episode-cover"
                      currentUrl={form.watch("coverUrl") || undefined}
                      onUploadComplete={(data) => {
                        form.setValue("coverUrl", data.publicUrl, { shouldValidate: true });
                        form.setValue("coverAssetId", data.assetId, { shouldValidate: true });
                      }}
                      onRemove={() => {
                        form.setValue("coverUrl", undefined);
                        form.setValue("coverAssetId", undefined);
                      }}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si no subes una portada, se usará la del podcast
                  </p>
                  <FormMessage />
                </FormItem>

                <FormItem>
                  <FormLabel>Archivo de Audio *</FormLabel>
                  <FormControl>
                    <FileUpload
                      mode="audio"
                      data-testid="upload-episode-audio"
                      currentUrl={form.watch("audioUrl") || undefined}
                      onUploadComplete={(data) => {
                        form.setValue("audioUrl", data.publicUrl, { shouldValidate: true });
                        form.setValue("audioAssetId", data.assetId, { shouldValidate: true });
                        if (data.duration) {
                          form.setValue("duration", data.duration, { shouldValidate: true });
                        }
                      }}
                      onRemove={() => {
                        form.setValue("audioUrl", "");
                        form.setValue("audioAssetId", "");
                        form.setValue("duration", 0);
                      }}
                    />
                  </FormControl>
                  {form.watch("duration") > 0 && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-episode-duration">
                      Duración: {Math.floor(form.watch("duration") / 60)} min {form.watch("duration") % 60} seg
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              </CardContent>
            </Card>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Episodio"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
