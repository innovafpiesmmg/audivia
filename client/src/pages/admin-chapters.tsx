import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Search, Play, Plus, Upload, X, Music, Pencil } from "lucide-react";
import { Link } from "wouter";
import type { Chapter, Audiobook } from "@shared/schema";

async function uploadAudioFile(file: File): Promise<{ url: string; duration: number }> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch("/api/uploads/audio", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error al subir el audio");
  }
  
  const data = await response.json();
  return { url: data.publicUrl, duration: data.duration || 0 };
}

interface ChapterWithAudiobook extends Chapter {
  audiobook: Audiobook;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export default function AdminChapters() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAudiobookFilter, setSelectedAudiobookFilter] = useState<string>("all");
  const [selectedChapter, setSelectedChapter] = useState<ChapterWithAudiobook | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingChapter, setEditingChapter] = useState<ChapterWithAudiobook | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    chapterNumber: 1,
    description: "",
    audioUrl: "",
    duration: 0,
    isSample: false,
    audiobookId: "",
  });

  const { data: chapters = [], isLoading } = useQuery<ChapterWithAudiobook[]>({
    queryKey: ["/api/admin/chapters"],
  });

  const { data: audiobooks = [] } = useQuery<Audiobook[]>({
    queryKey: ["/api/admin/audiobooks"],
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      return await apiRequest("DELETE", `/api/admin/chapters/${chapterId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chapters"] });
      toast({
        title: "Capitulo eliminado",
        description: "El capitulo ha sido eliminado correctamente.",
      });
      setSelectedChapter(null);
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el capitulo.",
        variant: "destructive",
      });
    },
  });

  const createChapterMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/chapters", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chapters"] });
      toast({
        title: "Capitulo creado",
        description: "El capitulo ha sido creado correctamente.",
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el capitulo.",
        variant: "destructive",
      });
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return await apiRequest("PATCH", `/api/admin/chapters/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chapters"] });
      toast({
        title: "Capitulo actualizado",
        description: "El capitulo ha sido actualizado correctamente.",
      });
      setShowEditDialog(false);
      setEditingChapter(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el capitulo.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      chapterNumber: 1,
      description: "",
      audioUrl: "",
      duration: 0,
      isSample: false,
      audiobookId: "",
    });
    setAudioFile(null);
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        toast({
          title: "Error",
          description: "Solo se permiten archivos de audio",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "El archivo debe ser menor a 500MB",
          variant: "destructive",
        });
        return;
      }
      setAudioFile(file);
      setFormData({ ...formData, audioUrl: "" });
    }
  };

  const removeAudioFile = () => {
    setAudioFile(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const filteredChapters = chapters.filter((chapter) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      chapter.title.toLowerCase().includes(query) ||
      chapter.audiobook?.title.toLowerCase().includes(query)
    );
    const matchesAudiobook = selectedAudiobookFilter === "all" || chapter.audiobookId === selectedAudiobookFilter;
    return matchesSearch && matchesAudiobook;
  });

  const handleDeleteClick = (chapter: ChapterWithAudiobook) => {
    setSelectedChapter(chapter);
    setShowDeleteDialog(true);
  };

  const handleEditClick = (chapter: ChapterWithAudiobook) => {
    setEditingChapter(chapter);
    setFormData({
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      description: chapter.description || "",
      audioUrl: chapter.audioUrl || "",
      duration: chapter.duration || 0,
      isSample: chapter.isSample || false,
      audiobookId: chapter.audiobookId,
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!editingChapter) return;
    
    if (!formData.title) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    let audioUrl = formData.audioUrl;
    let duration = formData.duration;

    if (audioFile) {
      try {
        setIsUploading(true);
        const result = await uploadAudioFile(audioFile);
        audioUrl = result.url;
        if (result.duration > 0) {
          duration = result.duration;
        }
      } catch (error: any) {
        toast({
          title: "Error al subir audio",
          description: error.message || "No se pudo subir el archivo de audio.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    updateChapterMutation.mutate({ 
      id: editingChapter.id, 
      data: { ...formData, audioUrl, duration } 
    });
  };

  const confirmDelete = () => {
    if (selectedChapter) {
      deleteChapterMutation.mutate(selectedChapter.id);
    }
  };

  const handleCreateSubmit = async () => {
    if (!formData.title || !formData.audiobookId) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    let audioUrl = formData.audioUrl;
    let duration = formData.duration;

    // Si hay un archivo de audio, subirlo primero
    if (audioFile) {
      try {
        setIsUploading(true);
        const result = await uploadAudioFile(audioFile);
        audioUrl = result.url;
        if (result.duration > 0) {
          duration = result.duration;
        }
      } catch (error: any) {
        toast({
          title: "Error al subir audio",
          description: error.message || "No se pudo subir el archivo de audio.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    createChapterMutation.mutate({ ...formData, audioUrl, duration });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="font-serif text-2xl flex items-center gap-2">
                <Play className="w-6 h-6" />
                Gestion de Capitulos
              </CardTitle>
              <CardDescription>
                Administra todos los capitulos de los audiolibros
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-chapter">
              <Plus className="w-4 h-4 mr-2" />
              Añadir Capitulo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar capitulos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-chapters"
              />
            </div>
            <Select
              value={selectedAudiobookFilter}
              onValueChange={setSelectedAudiobookFilter}
            >
              <SelectTrigger className="w-[250px]" data-testid="select-audiobook-filter">
                <SelectValue placeholder="Filtrar por audiolibro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los audiolibros</SelectItem>
                {audiobooks.map((book) => (
                  <SelectItem key={book.id} value={book.id}>{book.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredChapters.length === 0 ? (
            <div className="text-center py-12">
              <Play className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No se encontraron capitulos</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Capitulo</TableHead>
                    <TableHead>Audiolibro</TableHead>
                    <TableHead>Duracion</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Acciónes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChapters.map((chapter) => (
                    <TableRow key={chapter.id} data-testid={`row-chapter-${chapter.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {chapter.chapterNumber || "-"}
                          </div>
                          <span className="font-medium">{chapter.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/audiobook/${chapter.audiobook?.id}`}>
                          <span className="text-primary hover:underline">
                            {chapter.audiobook?.title || "Desconocido"}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>{formatDuration(chapter.duration)}</TableCell>
                      <TableCell>
                        {chapter.isSample ? (
                          <Badge variant="outline">Muestra</Badge>
                        ) : (
                          <Badge variant="secondary">Completo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/chapter/${chapter.id}`}>
                            <Button variant="ghost" size="icon">
                              <Play className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(chapter)}
                            data-testid={`button-edit-chapter-${chapter.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(chapter)}
                            data-testid={`button-delete-chapter-${chapter.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Añadir Nuevo Capitulo</DialogTitle>
            <DialogDescription>
              Completa los datos del nuevo capitulo
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="audiobookId">Audiolibro *</Label>
              <Select
                value={formData.audiobookId}
                onValueChange={(value) => setFormData({ ...formData, audiobookId: value })}
              >
                <SelectTrigger data-testid="select-chapter-audiobook">
                  <SelectValue placeholder="Selecciona un audiolibro" />
                </SelectTrigger>
                <SelectContent>
                  {audiobooks.map((book) => (
                    <SelectItem key={book.id} value={book.id}>{book.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Titulo *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Capitulo 1: Introduccion"
                  data-testid="input-chapter-title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="chapterNumber">Numero de capitulo</Label>
                <Input
                  id="chapterNumber"
                  type="number"
                  min={1}
                  value={formData.chapterNumber}
                  onChange={(e) => setFormData({ ...formData, chapterNumber: parseInt(e.target.value) || 1 })}
                  data-testid="input-chapter-number"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el contenido del capitulo..."
                rows={3}
                data-testid="input-chapter-description"
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Archivo de audio</Label>
              
              {/* Audio file selected */}
              {audioFile && (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Music className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{audioFile.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(audioFile.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeAudioFile}
                    data-testid="button-remove-audio"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Audio upload */}
              {!audioFile && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="audioFile"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                      data-testid="label-upload-audio"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Haz clic</span> o arrastra un archivo de audio
                        </p>
                        <p className="text-xs text-muted-foreground">MP3, M4A, WAV (max. 500MB)</p>
                      </div>
                      <input
                        id="audioFile"
                        type="file"
                        className="hidden"
                        accept="audio/*"
                        onChange={handleAudioFileChange}
                        data-testid="input-audio-file"
                      />
                    </label>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">O usa una URL</span>
                    </div>
                  </div>
                  
                  <Input
                    id="audioUrl"
                    value={formData.audioUrl}
                    onChange={(e) => setFormData({ ...formData, audioUrl: e.target.value })}
                    placeholder="https://ejemplo.com/audio.mp3"
                    data-testid="input-chapter-audio-url"
                  />
                </div>
              )}
            </div>
            
            {!audioFile && (
              <div className="grid gap-2">
                <Label htmlFor="duration">Duracion (segundos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={0}
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  placeholder="3600"
                  data-testid="input-chapter-duration"
                />
                <p className="text-xs text-muted-foreground">
                  {formatDuration(formData.duration)} {audioFile && "(se detectara automaticamente)"}
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isSample">Capitulo de muestra</Label>
                <p className="text-sm text-muted-foreground">
                  Activar si es un capitulo gratuito de muestra
                </p>
              </div>
              <Switch
                id="isSample"
                checked={formData.isSample}
                onCheckedChange={(checked) => setFormData({ ...formData, isSample: checked })}
                data-testid="switch-chapter-sample"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createChapterMutation.isPending || isUploading} data-testid="button-submit-chapter">
              {(createChapterMutation.isPending || isUploading) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {isUploading ? "Subiendo audio..." : "Crear Capitulo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar capitulo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminara permanentemente el capitulo
              "{selectedChapter?.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteChapterMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) { resetForm(); setEditingChapter(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Editar Capitulo</DialogTitle>
            <DialogDescription>
              Modifica los datos del capitulo
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-chapter-title">Titulo *</Label>
              <Input
                id="edit-chapter-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="El titulo del capitulo"
                data-testid="input-edit-chapter-title"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-chapterNumber">Numero de capitulo</Label>
                <Input
                  id="edit-chapterNumber"
                  type="number"
                  min={1}
                  value={formData.chapterNumber}
                  onChange={(e) => setFormData({ ...formData, chapterNumber: parseInt(e.target.value) || 1 })}
                  data-testid="input-edit-chapter-number"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-duration">Duracion (segundos)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  min={0}
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-chapter-duration"
                />
                <p className="text-xs text-muted-foreground">{formatDuration(formData.duration)}</p>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-chapter-description">Descripcion</Label>
              <Textarea
                id="edit-chapter-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el capitulo..."
                rows={3}
                data-testid="input-edit-chapter-description"
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Audio del capitulo</Label>
              
              {formData.audioUrl && !audioFile && (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                  <Music className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground flex-1 truncate">Audio actual configurado</span>
                </div>
              )}
              
              {audioFile ? (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                  <Music className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{audioFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(audioFile.size)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={removeAudioFile}
                    data-testid="button-edit-remove-audio"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="editAudioFile"
                      className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                      data-testid="label-edit-upload-audio"
                    >
                      <div className="flex flex-col items-center justify-center pt-3 pb-3">
                        <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Cambiar archivo de audio
                        </p>
                      </div>
                      <input
                        id="editAudioFile"
                        type="file"
                        className="hidden"
                        accept="audio/*"
                        onChange={handleAudioFileChange}
                        data-testid="input-edit-audio-file"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-isSample">Capitulo de muestra</Label>
                <p className="text-sm text-muted-foreground">
                  Activar si es un capitulo gratuito de muestra
                </p>
              </div>
              <Switch
                id="edit-isSample"
                checked={formData.isSample}
                onCheckedChange={(checked) => setFormData({ ...formData, isSample: checked })}
                data-testid="switch-edit-chapter-sample"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); resetForm(); setEditingChapter(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateChapterMutation.isPending || isUploading} data-testid="button-submit-edit-chapter">
              {(updateChapterMutation.isPending || isUploading) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Pencil className="w-4 h-4 mr-2" />
              )}
              {isUploading ? "Subiendo audio..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
