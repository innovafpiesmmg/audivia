import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Upload, X, File, Image as ImageIcon, Music, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  mode: "cover" | "audio";
  onUploadComplete?: (data: {
    assetId: string;
    publicUrl: string;
    sizeBytes: number;
    mimeType: string;
    duration?: number;
  }) => void;
  onRemove?: () => void;
  currentUrl?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

export function FileUpload({
  mode,
  onUploadComplete,
  onRemove,
  currentUrl,
  disabled = false,
  "data-testid": testId,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    url: string;
    assetId: string;
  } | null>(currentUrl ? { name: "Archivo actual", url: currentUrl, assetId: "" } : null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const config = {
    cover: {
      accept: "image/jpeg,image/png,image/webp",
      maxSize: 2 * 1024 * 1024, // 2MB
      endpoint: "/api/uploads/cover",
      label: "Subir Imagen",
      icon: ImageIcon,
    },
    audio: {
      accept: "audio/mpeg,audio/mp4,audio/wav,audio/x-m4a",
      maxSize: 500 * 1024 * 1024, // 500MB
      endpoint: "/api/uploads/audio",
      label: "Subir Audio",
      icon: Music,
    },
  }[mode];

  const extractAudioDuration = useCallback(
    (file: File): Promise<number> => {
      return new Promise((resolve, reject) => {
        const audio = new Audio();
        const objectUrl = URL.createObjectURL(file);

        audio.addEventListener("loadedmetadata", () => {
          URL.revokeObjectURL(objectUrl);
          resolve(Math.round(audio.duration));
        });

        audio.addEventListener("error", () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("No se pudo leer la duración del audio"));
        });

        audio.src = objectUrl;
      });
    },
    []
  );

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > config.maxSize) {
      toast({
        variant: "destructive",
        title: "Archivo muy grande",
        description: `El archivo debe ser menor a ${config.maxSize / (1024 * 1024)}MB`,
      });
      return;
    }

    // Validate file type
    if (!config.accept.split(",").includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Tipo de archivo no válido",
        description: "Por favor selecciona un archivo compatible",
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Extract duration for audio files
      let duration: number | undefined;
      if (mode === "audio") {
        try {
          duration = await extractAudioDuration(file);
        } catch (error) {
          console.warn("Could not extract audio duration:", error);
        }
      }

      // Prepare form data
      const formData = new FormData();
      formData.append("file", file);

      // Upload file with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(Math.round(percentComplete));
        }
      });

      const uploadPromise = new Promise<{
        assetId: string;
        publicUrl: string;
        sizeBytes: number;
        mimeType: string;
      }>((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            reject(new Error(xhr.statusText || "Error al subir archivo"));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Error de red al subir archivo"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Subida cancelada"));
        });

        xhr.open("POST", config.endpoint);
        xhr.send(formData);
      });

      const result = await uploadPromise;

      setUploadedFile({
        name: file.name,
        url: result.publicUrl,
        assetId: result.assetId,
      });

      toast({
        title: "Archivo subido",
        description: `${file.name} se subió correctamente`,
      });

      // Call completion callback
      if (onUploadComplete) {
        onUploadComplete({
          ...result,
          duration,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al subir",
        description: error.message || "No se pudo subir el archivo",
      });
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onRemove) {
      onRemove();
    }
  };

  const Icon = config.icon;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={config.accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
        data-testid={testId ? `${testId}-input` : undefined}
      />

      {!uploadedFile && !uploading && (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-full"
          data-testid={testId}
        >
          <Upload className="mr-2 h-4 w-4" />
          {config.label}
        </Button>
      )}

      {uploading && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Subiendo...</span>
          </div>
          <Progress value={progress} className="h-2" data-testid={testId ? `${testId}-progress` : undefined} />
          <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
        </Card>
      )}

      {uploadedFile && !uploading && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            {mode === "cover" && uploadedFile.url ? (
              <img
                src={uploadedFile.url}
                alt="Preview"
                className="w-16 h-16 rounded object-cover flex-shrink-0"
                data-testid={testId ? `${testId}-preview` : undefined}
              />
            ) : (
              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <Icon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid={testId ? `${testId}-filename` : undefined}>
                {uploadedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">Archivo subido</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              disabled={disabled}
              data-testid={testId ? `${testId}-remove` : undefined}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
