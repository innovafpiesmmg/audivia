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
import { Loader2, Trash2, Search, BookOpen, Eye, Plus, Upload, X, Pencil, Globe, GlobeLock } from "lucide-react";
import { Link } from "wouter";
import type { Audiobook } from "@shared/schema";

async function uploadCoverImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch("/api/uploads/cover", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error al subir la imagen");
  }
  
  const data = await response.json();
  return data.publicUrl;
}

const CATEGORIES = [
  "Fiction",
  "Non-Fiction",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Fantasy",
  "Biography",
  "Self-Help",
  "Business",
  "History",
  "Children",
  "Young Adult",
];

export default function AdminAudiobooks() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAudiobook, setSelectedAudiobook] = useState<Audiobook | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAudiobook, setEditingAudiobook] = useState<Audiobook | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    narrator: "",
    description: "",
    coverArtUrl: "",
    category: "Fiction",
    language: "es",
    priceCents: 0,
    currency: "EUR",
    isFree: true,
    amazonEbookUrl: "",
    amazonPrintUrl: "",
    seriesName: "",
    seriesIndex: "",
  });

  const { data: audiobooks = [], isLoading } = useQuery<Audiobook[]>({
    queryKey: ["/api/admin/audiobooks"],
  });

  const deleteAudiobookMutation = useMutation({
    mutationFn: async (audiobookId: string) => {
      return await apiRequest("DELETE", `/api/admin/audiobooks/${audiobookId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audiobooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Audiolibro eliminado",
        description: "El audiolibro ha sido eliminado correctamente.",
      });
      setSelectedAudiobook(null);
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el audiolibro.",
        variant: "destructive",
      });
    },
  });

  const createAudiobookMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/audiobooks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audiobooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Audiolibro creado",
        description: "El audiolibro ha sido creado correctamente.",
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el audiolibro.",
        variant: "destructive",
      });
    },
  });

  const updateAudiobookMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return await apiRequest("PATCH", `/api/admin/audiobooks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audiobooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Audiolibro actualizado",
        description: "El audiolibro ha sido actualizado correctamente.",
      });
      setShowEditDialog(false);
      setEditingAudiobook(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el audiolibro.",
        variant: "destructive",
      });
    },
  });

  const publishAudiobookMutation = useMutation({
    mutationFn: async (audiobookId: string) => {
      return await apiRequest("POST", `/api/admin/audiobooks/${audiobookId}/publish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audiobooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Audiolibro publicado",
        description: "El audiolibro ahora es visible para los usuarios.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo publicar el audiolibro.",
        variant: "destructive",
      });
    },
  });

  const unpublishAudiobookMutation = useMutation({
    mutationFn: async (audiobookId: string) => {
      return await apiRequest("POST", `/api/admin/audiobooks/${audiobookId}/unpublish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audiobooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Audiolibro despublicado",
        description: "El audiolibro ya no es visible para los usuarios.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo despublicar el audiolibro.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      author: "",
      narrator: "",
      description: "",
      coverArtUrl: "",
      category: "Fiction",
      language: "es",
      priceCents: 0,
      currency: "EUR",
      isFree: true,
      amazonEbookUrl: "",
      amazonPrintUrl: "",
      seriesName: "",
      seriesIndex: "",
    });
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Solo se permiten archivos de imagen",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "La imagen debe ser menor a 2MB",
          variant: "destructive",
        });
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setFormData({ ...formData, coverArtUrl: "" });
    }
  };

  const removeCoverFile = () => {
    setCoverFile(null);
    if (coverPreview) {
      URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
    }
  };

  const filteredAudiobooks = audiobooks.filter((audiobook) => {
    const query = searchQuery.toLowerCase();
    return (
      audiobook.title.toLowerCase().includes(query) ||
      audiobook.author.toLowerCase().includes(query) ||
      audiobook.category.toLowerCase().includes(query)
    );
  });

  const handleDeleteClick = (audiobook: Audiobook) => {
    setSelectedAudiobook(audiobook);
    setShowDeleteDialog(true);
  };

  const handleEditClick = (audiobook: Audiobook) => {
    setEditingAudiobook(audiobook);
    setFormData({
      title: audiobook.title,
      author: audiobook.author,
      narrator: audiobook.narrator || "",
      description: audiobook.description,
      coverArtUrl: audiobook.coverArtUrl || "",
      category: audiobook.category,
      language: audiobook.language || "es",
      priceCents: audiobook.priceCents,
      currency: audiobook.currency,
      isFree: audiobook.isFree,
      amazonEbookUrl: audiobook.amazonEbookUrl || "",
      amazonPrintUrl: audiobook.amazonPrintUrl || "",
      seriesName: audiobook.seriesName || "",
      seriesIndex: audiobook.seriesIndex?.toString() || "",
    });
    setCoverPreview(audiobook.coverArtUrl || null);
    setShowEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!editingAudiobook) return;
    
    if (!formData.title || !formData.author || !formData.description) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    let coverArtUrl = formData.coverArtUrl;

    if (coverFile) {
      try {
        setIsUploading(true);
        coverArtUrl = await uploadCoverImage(coverFile);
      } catch (error: any) {
        toast({
          title: "Error al subir portada",
          description: error.message || "No se pudo subir la imagen de portada.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const dataToSubmit = {
      ...formData,
      coverArtUrl,
      seriesName: formData.seriesName || null,
      seriesIndex: formData.seriesIndex ? parseInt(formData.seriesIndex) : null,
    };
    updateAudiobookMutation.mutate({ 
      id: editingAudiobook.id, 
      data: dataToSubmit
    });
  };

  const confirmDelete = () => {
    if (selectedAudiobook) {
      deleteAudiobookMutation.mutate(selectedAudiobook.id);
    }
  };

  const handleCreateSubmit = async () => {
    if (!formData.title || !formData.author || !formData.description) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    let coverArtUrl = formData.coverArtUrl;

    // Si hay un archivo de portada, subirlo primero
    if (coverFile) {
      try {
        setIsUploading(true);
        coverArtUrl = await uploadCoverImage(coverFile);
      } catch (error: any) {
        toast({
          title: "Error al subir portada",
          description: error.message || "No se pudo subir la imagen de portada.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const dataToSubmit = {
      ...formData,
      coverArtUrl,
      seriesName: formData.seriesName || null,
      seriesIndex: formData.seriesIndex ? parseInt(formData.seriesIndex) : null,
    };
    createAudiobookMutation.mutate(dataToSubmit);
  };

  const formatPrice = (cents: number, currency: string = "EUR") => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="font-serif text-2xl flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                Gestion de Audiolibros
              </CardTitle>
              <CardDescription>
                Administra todos los audiolibros del catálogo
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-audiobook">
              <Plus className="w-4 h-4 mr-2" />
              Añadir Audiolibro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar audiolibros..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-audiobooks"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAudiobooks.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No se encontraron audiolibros</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titulo</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Publicado</TableHead>
                    <TableHead className="text-right">Acciónes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAudiobooks.map((audiobook) => (
                    <TableRow key={audiobook.id} data-testid={`row-audiobook-${audiobook.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {audiobook.coverArtUrl ? (
                            <img
                              src={audiobook.coverArtUrl}
                              alt={audiobook.title}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{audiobook.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>{audiobook.author}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{audiobook.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {audiobook.isFree ? (
                          <Badge className="bg-accent text-accent-foreground">Gratis</Badge>
                        ) : (
                          formatPrice(audiobook.priceCents, audiobook.currency)
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={audiobook.status === "APPROVED" ? "default" : audiobook.status === "REJECTED" ? "destructive" : "secondary"}>
                          {audiobook.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {audiobook.publishedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unpublishAudiobookMutation.mutate(audiobook.id)}
                            disabled={unpublishAudiobookMutation.isPending}
                            className="gap-1 text-green-600 hover:text-green-700"
                            data-testid={`button-unpublish-audiobook-${audiobook.id}`}
                          >
                            <Globe className="w-4 h-4" />
                            Publicado
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => publishAudiobookMutation.mutate(audiobook.id)}
                            disabled={publishAudiobookMutation.isPending}
                            className="gap-1 text-muted-foreground"
                            data-testid={`button-publish-audiobook-${audiobook.id}`}
                          >
                            <GlobeLock className="w-4 h-4" />
                            No publicado
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/audiobook/${audiobook.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(audiobook)}
                            data-testid={`button-edit-audiobook-${audiobook.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(audiobook)}
                            data-testid={`button-delete-audiobook-${audiobook.id}`}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Añadir Nuevo Audiolibro</DialogTitle>
            <DialogDescription>
              Completa los datos del nuevo audiolibro
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titulo *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="El titulo del audiolibro"
                data-testid="input-audiobook-title"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="author">Autor *</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  placeholder="Nombre del autor"
                  data-testid="input-audiobook-author"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="narrator">Narrador</Label>
                <Input
                  id="narrator"
                  value={formData.narrator}
                  onChange={(e) => setFormData({ ...formData, narrator: e.target.value })}
                  placeholder="Nombre del narrador"
                  data-testid="input-audiobook-narrator"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Descripcion *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el audiolibro..."
                rows={4}
                data-testid="input-audiobook-description"
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Portada del audiolibro</Label>
              
              {/* Preview de imagen (cuadrada 1:1) */}
              {(coverPreview || formData.coverArtUrl) && (
                <div className="relative w-32 h-32 mx-auto">
                  <img
                    src={coverPreview || formData.coverArtUrl}
                    alt="Preview portada"
                    className="w-full h-full object-contain rounded-md border bg-muted"
                  />
                  {coverPreview && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={removeCoverFile}
                      data-testid="button-remove-cover"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}

              {/* Subida de archivo */}
              {!coverFile && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="coverFile"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                      data-testid="label-upload-cover"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Haz clic</span> o arrastra una imagen
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG (max. 2MB)</p>
                      </div>
                      <input
                        id="coverFile"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                        data-testid="input-cover-file"
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
                    id="coverArtUrl"
                    value={formData.coverArtUrl}
                    onChange={(e) => setFormData({ ...formData, coverArtUrl: e.target.value })}
                    placeholder="https://ejemplo.com/portada.jpg"
                    data-testid="input-audiobook-cover-url"
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-audiobook-category">
                    <SelectValue placeholder="Selecciona una categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="language">Idioma</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => setFormData({ ...formData, language: value })}
                >
                  <SelectTrigger data-testid="select-audiobook-language">
                    <SelectValue placeholder="Selecciona idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isFree">Audiolibro gratuito</Label>
                <p className="text-sm text-muted-foreground">
                  Activar si el audiolibro es de acceso gratuito
                </p>
              </div>
              <Switch
                id="isFree"
                checked={formData.isFree}
                onCheckedChange={(checked) => setFormData({ ...formData, isFree: checked, priceCents: checked ? 0 : formData.priceCents })}
                data-testid="switch-audiobook-free"
              />
            </div>
            
            {!formData.isFree && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Precio (en centimos)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={formData.priceCents}
                    onChange={(e) => setFormData({ ...formData, priceCents: parseInt(e.target.value) || 0 })}
                    placeholder="999"
                    data-testid="input-audiobook-price"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(formData.priceCents, formData.currency)}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger data-testid="select-audiobook-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="amazonEbookUrl">URL Amazon Ebook</Label>
              <Input
                id="amazonEbookUrl"
                value={formData.amazonEbookUrl}
                onChange={(e) => setFormData({ ...formData, amazonEbookUrl: e.target.value })}
                placeholder="https://amazon.com/dp/..."
                data-testid="input-audiobook-amazon-ebook"
              />
              <p className="text-xs text-muted-foreground">Enlace a la version ebook en Amazon</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="amazonPrintUrl">URL Amazon Impreso</Label>
              <Input
                id="amazonPrintUrl"
                value={formData.amazonPrintUrl}
                onChange={(e) => setFormData({ ...formData, amazonPrintUrl: e.target.value })}
                placeholder="https://amazon.com/dp/..."
                data-testid="input-audiobook-amazon-print"
              />
              <p className="text-xs text-muted-foreground">Enlace a la version impresa en Amazon</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="seriesName">Nombre de la Serie</Label>
                <Input
                  id="seriesName"
                  value={formData.seriesName}
                  onChange={(e) => setFormData({ ...formData, seriesName: e.target.value })}
                  placeholder="Saga de los Olvidados"
                  data-testid="input-audiobook-series-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="seriesIndex">Orden en la Serie</Label>
                <Input
                  id="seriesIndex"
                  type="number"
                  min={1}
                  value={formData.seriesIndex}
                  onChange={(e) => setFormData({ ...formData, seriesIndex: e.target.value })}
                  placeholder="1"
                  data-testid="input-audiobook-series-index"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Si el audiolibro pertenece a una serie, indica el nombre y el orden (1, 2, 3...)</p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createAudiobookMutation.isPending || isUploading} data-testid="button-submit-audiobook">
              {(createAudiobookMutation.isPending || isUploading) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {isUploading ? "Subiendo imagen..." : "Crear Audiolibro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar audiolibro</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminara permanentemente el audiolibro
              "{selectedAudiobook?.title}" y todos sus capitulos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAudiobookMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) { resetForm(); setEditingAudiobook(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Editar Audiolibro</DialogTitle>
            <DialogDescription>
              Modifica los datos del audiolibro
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Titulo *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="El titulo del audiolibro"
                data-testid="input-edit-audiobook-title"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-author">Autor *</Label>
                <Input
                  id="edit-author"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  placeholder="Nombre del autor"
                  data-testid="input-edit-audiobook-author"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-narrator">Narrador</Label>
                <Input
                  id="edit-narrator"
                  value={formData.narrator}
                  onChange={(e) => setFormData({ ...formData, narrator: e.target.value })}
                  placeholder="Nombre del narrador"
                  data-testid="input-edit-audiobook-narrator"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descripcion *</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el audiolibro..."
                rows={4}
                data-testid="input-edit-audiobook-description"
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Portada del audiolibro</Label>
              
              {(coverPreview || formData.coverArtUrl) && (
                <div className="relative w-32 h-32 mx-auto">
                  <img
                    src={coverPreview || formData.coverArtUrl}
                    alt="Preview portada"
                    className="w-full h-full object-contain rounded-md border bg-muted"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => {
                      removeCoverFile();
                      setFormData({ ...formData, coverArtUrl: "" });
                      setCoverPreview(null);
                    }}
                    data-testid="button-edit-remove-cover"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {!coverFile && !coverPreview && !formData.coverArtUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="editCoverFile"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                      data-testid="label-edit-upload-cover"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Subir imagen de portada
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG (max. 2MB)</p>
                      </div>
                      <input
                        id="editCoverFile"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                        data-testid="input-edit-upload-cover"
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
                    id="editCoverArtUrl"
                    value={formData.coverArtUrl}
                    onChange={(e) => setFormData({ ...formData, coverArtUrl: e.target.value })}
                    placeholder="https://ejemplo.com/portada.jpg"
                    data-testid="input-edit-audiobook-cover-url"
                  />
                </div>
              )}

              {!coverFile && (coverPreview || formData.coverArtUrl) && (
                <div className="mt-2">
                  <label
                    htmlFor="editCoverFileReplace"
                    className="text-sm text-primary cursor-pointer hover:underline"
                    data-testid="label-edit-replace-cover"
                  >
                    Cambiar imagen
                  </label>
                  <input
                    id="editCoverFileReplace"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                    data-testid="input-edit-replace-cover"
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-edit-audiobook-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-language">Idioma</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => setFormData({ ...formData, language: value })}
                >
                  <SelectTrigger data-testid="select-edit-audiobook-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isFree"
                checked={formData.isFree}
                onCheckedChange={(checked) => setFormData({ ...formData, isFree: checked })}
                data-testid="switch-edit-audiobook-free"
              />
              <Label htmlFor="edit-isFree">Audiolibro gratuito</Label>
            </div>
            
            {!formData.isFree && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-price">Precio (centimos)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.priceCents}
                    onChange={(e) => setFormData({ ...formData, priceCents: parseInt(e.target.value) || 0 })}
                    placeholder="999"
                    data-testid="input-edit-audiobook-price"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(formData.priceCents, formData.currency)}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-currency">Moneda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger data-testid="select-edit-audiobook-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="edit-amazonEbookUrl">URL Amazon Ebook</Label>
              <Input
                id="edit-amazonEbookUrl"
                value={formData.amazonEbookUrl}
                onChange={(e) => setFormData({ ...formData, amazonEbookUrl: e.target.value })}
                placeholder="https://amazon.com/dp/..."
                data-testid="input-edit-audiobook-amazon-ebook"
              />
              <p className="text-xs text-muted-foreground">Enlace a la version ebook en Amazon</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-amazonPrintUrl">URL Amazon Impreso</Label>
              <Input
                id="edit-amazonPrintUrl"
                value={formData.amazonPrintUrl}
                onChange={(e) => setFormData({ ...formData, amazonPrintUrl: e.target.value })}
                placeholder="https://amazon.com/dp/..."
                data-testid="input-edit-audiobook-amazon-print"
              />
              <p className="text-xs text-muted-foreground">Enlace a la version impresa en Amazon</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-seriesName">Nombre de la Serie</Label>
                <Input
                  id="edit-seriesName"
                  value={formData.seriesName}
                  onChange={(e) => setFormData({ ...formData, seriesName: e.target.value })}
                  placeholder="Saga de los Olvidados"
                  data-testid="input-edit-audiobook-series-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-seriesIndex">Orden en la Serie</Label>
                <Input
                  id="edit-seriesIndex"
                  type="number"
                  min={1}
                  value={formData.seriesIndex}
                  onChange={(e) => setFormData({ ...formData, seriesIndex: e.target.value })}
                  placeholder="1"
                  data-testid="input-edit-audiobook-series-index"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Si el audiolibro pertenece a una serie, indica el nombre y el orden (1, 2, 3...)</p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); resetForm(); setEditingAudiobook(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateAudiobookMutation.isPending || isUploading} data-testid="button-submit-edit-audiobook">
              {(updateAudiobookMutation.isPending || isUploading) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Pencil className="w-4 h-4 mr-2" />
              )}
              {isUploading ? "Subiendo imagen..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
