import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileArchive, CheckCircle, AlertCircle, Download, BookOpen } from "lucide-react";
import { Link } from "wouter";

interface ImportResult {
  success: boolean;
  audiobook?: {
    id: string;
    title: string;
  };
  chaptersCreated?: number;
  message?: string;
  error?: string;
}

export default function AdminImport() {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("zipFile", file);
      
      const response = await fetch("/api/admin/import/zip", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || "Error al importar");
      }
      
      return data as ImportResult;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audiobooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Importacion completada",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      setResult({ success: false, error: error.message });
      toast({
        title: "Error en la importacion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
      setSelectedFile(file);
      setResult(null);
    } else {
      toast({
        title: "Archivo no válido",
        description: "Solo se permiten archivos ZIP",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setResult(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const metadataExample = {
    title: "Nombre del Audiolibro",
    author: "Nombre del Autor",
    narrator: "Nombre del Narrador",
    description: "Descripcion del audiolibro...",
    category: "Fiction",
    language: "es",
    isFree: false,
    priceCents: 999,
    currency: "EUR",
    chapters: [
      {
        title: "Capitulo 1: Introduccion",
        chapterNumber: 1,
        audioFile: "capitulo01.mp3",
        duration: 1800,
        isSample: true,
        description: "Descripcion del capitulo"
      },
      {
        title: "Capitulo 2",
        chapterNumber: 2,
        audioFile: "capitulo02.mp3",
        duration: 2400,
        isSample: false
      }
    ]
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl flex items-center gap-2">
              <FileArchive className="w-6 h-6" />
              Importar Audiolibro desde ZIP
            </CardTitle>
            <CardDescription>
              Sube un archivo ZIP con el audiolibro completo, incluyendo los archivos de audio y metadatos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drag and drop zone */}
            {!selectedFile && !result?.success && (
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                data-testid="dropzone-zip"
              >
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  data-testid="input-zip-file"
                />
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Arrastra tu archivo ZIP aquí
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Maximo 1GB
                </p>
              </div>
            )}

            {/* Selected file */}
            {selectedFile && !result?.success && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileArchive className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleImport}
                    disabled={importMutation.isPending}
                    className="flex-1"
                    data-testid="button-import-zip"
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Importar Audiolibro
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={resetForm} disabled={importMutation.isPending} data-testid="button-cancel-import">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`border rounded-lg p-4 ${result.success ? "border-green-500/50 bg-green-50 dark:bg-green-950/20" : "border-destructive/50 bg-destructive/5"}`}>
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {result.success ? "Importacion exitosa" : "Error en la importacion"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.message || result.error}
                    </p>
                    {result.success && result.audiobook && (
                      <div className="mt-3 flex gap-2">
                        <Link href={`/audiobook/${result.audiobook.id}`}>
                          <Button size="sm" variant="outline">
                            <BookOpen className="w-4 h-4 mr-2" />
                            Ver audiolibro
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={resetForm}>
                          Importar otro
                        </Button>
                      </div>
                    )}
                    {!result.success && (
                      <Button size="sm" variant="outline" onClick={resetForm} className="mt-3" data-testid="button-retry-import">
                        Intentar de nuevo
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estructura del archivo ZIP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              El archivo ZIP debe contener:
            </p>
            <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
              <li><strong className="text-foreground">metadata.json</strong> - Archivo con la información del audiolibro y capitulos</li>
              <li><strong className="text-foreground">cover.jpg</strong> o <strong className="text-foreground">cover.png</strong> - Imagen de portada (opcional)</li>
              <li><strong className="text-foreground">Archivos de audio</strong> - MP3 o M4A referenciados en los capitulos</li>
            </ul>
            
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Ejemplo de metadata.json:</p>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(metadataExample, null, 2)}
              </pre>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                const blob = new Blob([JSON.stringify(metadataExample, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'metadata-ejemplo.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
              data-testid="button-download-example"
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar ejemplo de metadata.json
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
