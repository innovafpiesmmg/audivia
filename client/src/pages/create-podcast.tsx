import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { insertPodcastSchema, insertEpisodeSchema } from "@shared/schema";
import { Loader2, Upload as UploadIcon, Lock, Users, Globe } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const podcastFormSchema = insertPodcastSchema.extend({
  episodeTitle: z.string().min(1, "El título del episodio es requerido"),
  episodeNotes: z.string().optional(),
  episodeAudioAssetId: z.string().min(1, "Debes subir un archivo de audio"),
  episodeAudioUrl: z.string().min(1),
  episodeDuration: z.number().min(1, "La duración debe ser mayor a 0"),
  episodeAudioFileSize: z.number().min(1, "El tamaño del archivo es requerido"),
  episodeCoverAssetId: z.string().optional(),
  episodeCoverUrl: z.string().optional(),
  episodeVisibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).default("PUBLIC"),
});

type PodcastFormValues = z.infer<typeof podcastFormSchema>;

export default function CreatePodcast() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<PodcastFormValues>({
    resolver: zodResolver(podcastFormSchema),
    defaultValues: {
      title: "",
      description: "",
      coverArtUrl: undefined,
      coverArtAssetId: undefined,
      visibility: "PUBLIC",
      episodeTitle: "",
      episodeNotes: "",
      episodeAudioUrl: "",
      episodeAudioAssetId: "",
      episodeDuration: 0,
      episodeAudioFileSize: 0,
      episodeCoverUrl: undefined,
      episodeCoverAssetId: undefined,
      episodeVisibility: "PUBLIC",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PodcastFormValues) => {
      // First create the podcast (ownerId is set automatically by the backend)
      const podcast = await apiRequest<{ id: string }>("POST", "/api/podcasts", {
        title: data.title,
        description: data.description,
        coverArtUrl: data.coverArtUrl || "",
        coverArtAssetId: data.coverArtAssetId || undefined,
        visibility: data.visibility,
      });

      // Then create the first episode
      await apiRequest("POST", "/api/episodes", {
        title: data.episodeTitle,
        notes: data.episodeNotes,
        audioUrl: data.episodeAudioUrl,
        audioAssetId: data.episodeAudioAssetId,
        audioFileSize: data.episodeAudioFileSize,
        duration: data.episodeDuration,
        coverArtUrl: data.episodeCoverUrl || undefined,
        coverArtAssetId: data.episodeCoverAssetId || undefined,
        podcastId: podcast.id,
        visibility: data.episodeVisibility,
      });

      return podcast;
    },
    onSuccess: (podcast) => {
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      toast({
        title: "Podcast creado",
        description: "Tu podcast y primer episodio han sido creados exitosamente.",
      });
      setLocation(`/podcast/${podcast.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo crear el podcast. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PodcastFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold font-[Outfit] mb-2" data-testid="text-page-title">
          Crear Nuevo Podcast
        </h1>
        <p className="text-muted-foreground mb-8">
          Completa la información de tu podcast y sube tu primer episodio.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Podcast Information */}
            <Card>
              <CardHeader>
                <CardTitle>Información del Podcast</CardTitle>
                <CardDescription>
                  Detalles básicos sobre tu podcast
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título del Podcast</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mi Increíble Podcast"
                          data-testid="input-podcast-title"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe de qué trata tu podcast..."
                          className="min-h-32 resize-none"
                          data-testid="input-podcast-description"
                          {...field}
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
                      <FormLabel>Privacidad</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                        data-testid="select-podcast-visibility"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la privacidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PUBLIC" data-testid="option-visibility-public">
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
                          <SelectItem value="UNLISTED" data-testid="option-visibility-unlisted">
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
                          <SelectItem value="PRIVATE" data-testid="option-visibility-private">
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
                  <FormLabel>Portada del Podcast (opcional)</FormLabel>
                  <FormControl>
                    <FileUpload
                      mode="cover"
                      data-testid="upload-podcast-cover"
                      currentUrl={form.watch("coverArtUrl") || undefined}
                      onUploadComplete={(data) => {
                        form.setValue("coverArtUrl", data.publicUrl, { shouldValidate: true });
                        form.setValue("coverArtAssetId", data.assetId, { shouldValidate: true });
                      }}
                      onRemove={() => {
                        form.setValue("coverArtUrl", undefined);
                        form.setValue("coverArtAssetId", undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </CardContent>
            </Card>

            {/* First Episode */}
            <Card>
              <CardHeader>
                <CardTitle>Primer Episodio</CardTitle>
                <CardDescription>
                  Sube tu primer episodio para comenzar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="episodeTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título del Episodio</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Episodio 1: Introducción"
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
                  name="episodeNotes"
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
                  name="episodeVisibility"
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
                      currentUrl={form.watch("episodeCoverUrl") || undefined}
                      onUploadComplete={(data) => {
                        form.setValue("episodeCoverUrl", data.publicUrl, { shouldValidate: true });
                        form.setValue("episodeCoverAssetId", data.assetId, { shouldValidate: true });
                      }}
                      onRemove={() => {
                        form.setValue("episodeCoverUrl", undefined);
                        form.setValue("episodeCoverAssetId", undefined);
                      }}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si no subes una portada, se usará la del podcast
                  </p>
                  <FormMessage />
                </FormItem>

                <FormField
                  control={form.control}
                  name="episodeAudioAssetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Archivo de Audio *</FormLabel>
                      <FormControl>
                        <FileUpload
                          mode="audio"
                          data-testid="upload-episode-audio"
                          currentUrl={form.watch("episodeAudioUrl") || undefined}
                          onUploadComplete={(data) => {
                            if (!data.sizeBytes || data.sizeBytes <= 0) {
                              toast({
                                variant: "destructive",
                                title: "Error en el archivo",
                                description: "No se pudo determinar el tamaño del archivo de audio. Por favor, intenta de nuevo.",
                              });
                              return;
                            }
                            if (!data.duration || data.duration <= 0) {
                              toast({
                                variant: "destructive",
                                title: "Error en el archivo",
                                description: "No se pudo determinar la duración del archivo de audio. Por favor, intenta de nuevo.",
                              });
                              return;
                            }
                            form.setValue("episodeAudioUrl", data.publicUrl, { shouldValidate: true });
                            form.setValue("episodeAudioAssetId", data.assetId, { shouldValidate: true });
                            form.setValue("episodeAudioFileSize", data.sizeBytes, { shouldValidate: true });
                            form.setValue("episodeDuration", data.duration, { shouldValidate: true });
                          }}
                          onRemove={() => {
                            form.setValue("episodeAudioUrl", "");
                            form.setValue("episodeAudioAssetId", "");
                            form.setValue("episodeDuration", 0);
                            form.setValue("episodeAudioFileSize", 0);
                          }}
                        />
                      </FormControl>
                      {form.watch("episodeDuration") > 0 && (
                        <p className="text-xs text-muted-foreground mt-1" data-testid="text-episode-duration">
                          Duración: {Math.floor(form.watch("episodeDuration") / 60)} min {form.watch("episodeDuration") % 60} seg
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Crear Podcast
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
