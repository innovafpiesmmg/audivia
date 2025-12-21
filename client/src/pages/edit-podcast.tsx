import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Loader2, ArrowLeft, Lock, Users, Globe } from "lucide-react";
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
import type { Podcast } from "@shared/schema";

const updatePodcastSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().min(1, "La descripción es requerida"),
  coverArtUrl: z.string().optional().nullable(),
  coverArtAssetId: z.string().optional().nullable(),
  category: z.string().min(1, "La categoría es requerida"),
  language: z.string().min(1, "El idioma es requerido"),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
});

type UpdatePodcastFormValues = z.infer<typeof updatePodcastSchema>;

export default function EditPodcast() {
  const [, params] = useRoute("/edit-podcast/:id");
  const podcastId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: podcast, isLoading: isLoadingPodcast } = useQuery<Podcast>({
    queryKey: ["/api/podcasts", podcastId],
    enabled: !!podcastId,
  });

  const form = useForm<UpdatePodcastFormValues>({
    resolver: zodResolver(updatePodcastSchema),
    values: podcast ? {
      title: podcast.title,
      description: podcast.description,
      coverArtUrl: podcast.coverArtUrl,
      coverArtAssetId: podcast.coverArtAssetId,
      category: podcast.category,
      language: podcast.language,
      visibility: podcast.visibility || "PUBLIC",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdatePodcastFormValues) => {
      if (!podcastId) throw new Error("ID de podcast no encontrado");
      return await apiRequest<Podcast>("PATCH", `/api/podcasts/${podcastId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Podcast actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts", podcastId] });
      setLocation(`/podcast/${podcastId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el podcast",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdatePodcastFormValues) => {
    updateMutation.mutate(data);
  };

  if (isLoadingPodcast) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-podcast" />
      </div>
    );
  }

  if (!podcast) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Podcast no encontrado</h2>
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
            onClick={() => setLocation(`/podcast/${podcastId}`)}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-4xl font-bold" data-testid="text-page-title">Editar Podcast</h1>
          <p className="text-muted-foreground mt-2">
            Actualiza la información de tu podcast
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
                    <FormLabel>Título del Podcast *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Nombre de tu podcast"
                        data-testid="input-podcast-title"
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
                    <FormLabel>Descripción *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe de qué trata tu podcast"
                        rows={5}
                        data-testid="input-podcast-description"
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

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-podcast-category">
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Technology">Tecnología</SelectItem>
                        <SelectItem value="Business">Negocios</SelectItem>
                        <SelectItem value="Education">Educación</SelectItem>
                        <SelectItem value="Comedy">Comedia</SelectItem>
                        <SelectItem value="News">Noticias</SelectItem>
                        <SelectItem value="Health">Salud</SelectItem>
                        <SelectItem value="Sports">Deportes</SelectItem>
                        <SelectItem value="Music">Música</SelectItem>
                        <SelectItem value="Arts">Artes</SelectItem>
                        <SelectItem value="Society">Sociedad</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Idioma *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-podcast-language">
                          <SelectValue placeholder="Selecciona un idioma" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Portada del Podcast *</FormLabel>
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
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(`/podcast/${podcastId}`)}
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
