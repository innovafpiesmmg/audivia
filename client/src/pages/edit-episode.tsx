import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Loader2, ArrowLeft, Lock, Users, Globe, Upload, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { FileUpload } from "@/components/file-upload";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Episode } from "@shared/schema";

const updateEpisodeSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  notes: z.string().optional(),
  coverArtUrl: z.string().optional().nullable(),
  coverArtAssetId: z.string().optional().nullable(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
});

type UpdateEpisodeFormValues = z.infer<typeof updateEpisodeSchema>;

export default function EditEpisode() {
  const [, params] = useRoute("/edit-episode/:id");
  const episodeId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  const { data: episodeData, isLoading: isLoadingEpisode } = useQuery<Episode & { podcastId: string }>({
    queryKey: ["/api/episodes", episodeId],
    enabled: !!episodeId,
  });

  const form = useForm<UpdateEpisodeFormValues>({
    resolver: zodResolver(updateEpisodeSchema),
    values: episodeData ? {
      title: episodeData.title,
      notes: episodeData.notes || "",
      coverArtUrl: episodeData.coverArtUrl,
      coverArtAssetId: episodeData.coverArtAssetId,
      visibility: episodeData.visibility || "PUBLIC",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateEpisodeFormValues) => {
      if (!episodeId) throw new Error("ID de episodio no encontrado");
      return await apiRequest<Episode>("PATCH", `/api/episodes/${episodeId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Episodio actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId] });
      setLocation(`/episode/${episodeId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el episodio",
        variant: "destructive",
      });
    },
  });

  const handleAudioUpload = async () => {
    if (!audioFile || !episodeId) return;
    
    setIsUploadingAudio(true);
    try {
      const formData = new FormData();
      formData.append("audioFile", audioFile);
      
      const response = await fetch(`/api/episodes/${episodeId}/audio`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al subir el archivo de audio");
      }
      
      toast({
        title: "Audio actualizado",
        description: "El archivo de audio se ha subido correctamente",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId] });
      setAudioFile(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const onSubmit = (data: UpdateEpisodeFormValues) => {
    updateMutation.mutate(data);
  };

  if (isLoadingEpisode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-episode" />
      </div>
    );
  }

  if (!episodeData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Episodio no encontrado</h2>
          <Button onClick={() => setLocation("/my-podcasts")} data-testid="button-back">
            Volver a Mis Podcasts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/episode/${episodeId}`)}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-4xl font-bold" data-testid="text-page-title">Editar Episodio</h1>
          <p className="text-muted-foreground mt-2">
            Actualiza la información de tu episodio
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título del Episodio *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Título del episodio"
                        data-testid="input-episode-title"
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
                    <FormLabel>Notas / Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Descripción del episodio, enlaces, etc."
                        rows={8}
                        data-testid="input-episode-notes"
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

              <div>
                <FormLabel>Portada del Episodio (opcional)</FormLabel>
                <FileUpload
                  mode="cover"
                  data-testid="upload-episode-cover"
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
                <p className="text-xs text-muted-foreground mt-1">
                  Si no subes una portada, se usará la del podcast
                </p>
              </div>

              <div className="space-y-2">
                <FormLabel>Cambiar Archivo de Audio (opcional)</FormLabel>
                <div className="border-2 border-dashed rounded-md p-6 hover-elevate active-elevate-2 transition-all">
                  <input
                    type="file"
                    accept="audio/mp3,audio/mpeg,.mp3"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (!file.type.includes('audio/mpeg') && !file.name.endsWith('.mp3')) {
                          toast({
                            title: "Archivo no válido",
                            description: "Solo se aceptan archivos MP3",
                            variant: "destructive",
                          });
                          return;
                        }
                        setAudioFile(file);
                      }
                    }}
                    className="hidden"
                    id="audio-upload"
                    data-testid="input-audio-file"
                  />
                  {audioFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Music className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium">{audioFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={handleAudioUpload}
                          disabled={isUploadingAudio}
                          size="sm"
                          data-testid="button-upload-audio"
                        >
                          {isUploadingAudio ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Subiendo...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Subir Audio
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAudioFile(null)}
                          size="sm"
                          data-testid="button-remove-audio"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="audio-upload"
                      className="flex flex-col items-center cursor-pointer"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium mb-1">
                        Click para reemplazar el archivo de audio
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solo archivos MP3 (máx. 500 MB)
                      </p>
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Subir un nuevo archivo reemplazará el audio actual del episodio
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(`/episode/${episodeId}`)}
                  disabled={updateMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-save"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Cambios"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
