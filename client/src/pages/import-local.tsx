import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Upload, FileAudio, Image, FolderOpen, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ImportLocal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [podcastTitle, setPodcastTitle] = useState("");
  const [podcastDescription, setPodcastDescription] = useState("");
  const [category, setCategory] = useState("Technology");
  const [language, setLanguage] = useState("es");
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PUBLIC");
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [coverArt, setCoverArt] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/import-local", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al importar archivos");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-podcasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
      
      toast({
        title: "¡Importación Exitosa!",
        description: data.message,
      });

      // Show detailed results
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "Algunos archivos no se pudieron importar",
          description: `${data.skipped} de ${data.totalFiles} archivos fallaron`,
          variant: "destructive",
        });
      }

      // Navigate to the podcast
      setLocation(`/podcast/${data.podcast.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al importar",
        description: error.message,
        variant: "destructive",
      });
      setImportProgress(0);
    },
  });

  const handleAudioFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const mp3Files = files.filter(file => 
        file.type === "audio/mpeg" || 
        file.type === "audio/mp3" ||
        file.name.toLowerCase().endsWith('.mp3')
      );

      if (mp3Files.length !== files.length) {
        toast({
          title: "Algunos archivos fueron omitidos",
          description: "Solo se aceptan archivos MP3",
          variant: "destructive",
        });
      }

      setAudioFiles(mp3Files);
    }
  };

  const handleCoverArtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverArt(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (audioFiles.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un archivo de audio",
        variant: "destructive",
      });
      return;
    }

    if (!podcastTitle.trim()) {
      toast({
        title: "Error",
        description: "El título del podcast es obligatorio",
        variant: "destructive",
      });
      return;
    }

    if (!podcastDescription.trim()) {
      toast({
        title: "Error",
        description: "La descripción del podcast es obligatoria",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("podcastTitle", podcastTitle);
    formData.append("podcastDescription", podcastDescription);
    formData.append("category", category);
    formData.append("language", language);
    formData.append("visibility", visibility);

    // Add all audio files
    audioFiles.forEach(file => {
      formData.append("audioFiles", file);
    });

    // Add cover art if provided
    if (coverArt) {
      formData.append("coverArt", coverArt);
    }

    setImportProgress(10);
    importMutation.mutate(formData);
  };

  const removeAudioFile = (index: number) => {
    setAudioFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            Importar Podcast desde Carpeta Local
          </CardTitle>
          <CardDescription>
            Sube múltiples archivos MP3 de tu ordenador para crear un podcast completo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta función te permite crear un podcast importando múltiples archivos de audio MP3 
              desde tu ordenador. Cada archivo se convertirá en un episodio individual del podcast.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Audio Files Selection */}
            <div className="space-y-2">
              <Label htmlFor="audio-files" className="flex items-center gap-2">
                <FileAudio className="h-4 w-4" />
                Archivos de Audio (MP3) *
              </Label>
              <Input
                id="audio-files"
                type="file"
                accept="audio/mp3,audio/mpeg,.mp3"
                multiple
                onChange={handleAudioFilesChange}
                disabled={importMutation.isPending}
                data-testid="input-audio-files"
              />
              <p className="text-sm text-muted-foreground">
                Selecciona múltiples archivos MP3 (máximo 50 archivos)
              </p>
            </div>

            {/* Selected Files List */}
            {audioFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Archivos Seleccionados ({audioFiles.length})</Label>
                <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                  {audioFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded hover-elevate"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileAudio className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAudioFile(index)}
                        disabled={importMutation.isPending}
                        data-testid={`button-remove-${index}`}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cover Art */}
            <div className="space-y-2">
              <Label htmlFor="cover-art" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Cover Art (Opcional)
              </Label>
              <Input
                id="cover-art"
                type="file"
                accept="image/*"
                onChange={handleCoverArtChange}
                disabled={importMutation.isPending}
                data-testid="input-cover-art"
              />
              {coverArt && (
                <p className="text-sm text-muted-foreground">
                  Seleccionado: {coverArt.name}
                </p>
              )}
            </div>

            {/* Podcast Metadata */}
            <div className="space-y-2">
              <Label htmlFor="title">Título del Podcast *</Label>
              <Input
                id="title"
                value={podcastTitle}
                onChange={(e) => setPodcastTitle(e.target.value)}
                placeholder="Ej: Mi Podcast Importado"
                required
                disabled={importMutation.isPending}
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción del Podcast *</Label>
              <Textarea
                id="description"
                value={podcastDescription}
                onChange={(e) => setPodcastDescription(e.target.value)}
                placeholder="Describe de qué trata tu podcast..."
                rows={4}
                required
                disabled={importMutation.isPending}
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Technology"
                  disabled={importMutation.isPending}
                  data-testid="input-category"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Input
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="es"
                  disabled={importMutation.isPending}
                  data-testid="input-language"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibilidad</Label>
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value as "PRIVATE" | "UNLISTED" | "PUBLIC")}
                disabled={importMutation.isPending}
              >
                <SelectTrigger data-testid="select-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Público</SelectItem>
                  <SelectItem value="UNLISTED">No listado</SelectItem>
                  <SelectItem value="PRIVATE">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Progress Bar */}
            {importMutation.isPending && (
              <div className="space-y-2">
                <Label>Importando archivos...</Label>
                <Progress value={importProgress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Por favor espera mientras se suben y procesan los archivos
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="submit"
                className="flex-1"
                disabled={importMutation.isPending || audioFiles.length === 0}
                data-testid="button-import"
              >
                {importMutation.isPending ? (
                  <>Importando...</>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Podcast ({audioFiles.length} archivo{audioFiles.length !== 1 ? 's' : ''})
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/my-podcasts")}
                disabled={importMutation.isPending}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
