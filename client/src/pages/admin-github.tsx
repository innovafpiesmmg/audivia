import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Github, Loader2, RefreshCw, Download, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminGitHub() {
  const { toast } = useToast();

  const { data: githubStatus, isLoading: statusLoading } = useQuery<{ 
    connected: boolean; 
    username?: string; 
    repoUrl?: string 
  }>({
    queryKey: ["/api/admin/github/status"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/github/sync");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sincronización completada",
        description: data.message || `${data.filesUpdated} archivos sincronizados.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo sincronizar con GitHub",
      });
    },
  });

  const pullMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/github/pull");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Actualización completada",
        description: data.message || "La aplicación se reiniciará en breve...",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo actualizar desde GitHub",
      });
    },
  });

  return (
    <div className="container max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Github className="h-8 w-8" />
          GitHub
        </h1>
        <p className="text-muted-foreground mt-2">
          Sincroniza el proyecto con el repositorio de GitHub
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Estado de conexión
          </CardTitle>
          <CardDescription>
            Información sobre la conexión con GitHub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando conexión...
            </div>
          ) : githubStatus?.connected ? (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Conectado a GitHub</AlertTitle>
                <AlertDescription>
                  Usuario: <strong>{githubStatus.username}</strong>
                  {githubStatus.repoUrl && (
                    <a 
                      href={githubStatus.repoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Ver repositorio <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No conectado</AlertTitle>
              <AlertDescription>
                GitHub no está conectado. Configura la integración de GitHub en Replit.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {githubStatus?.connected && (
        <>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Subir a GitHub
              </CardTitle>
              <CardDescription>
                Sube el código actual del proyecto al repositorio de GitHub
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Esta acción enviará todos los archivos del proyecto actual a GitHub, 
                creando un nuevo commit con los cambios.
              </p>
              <Button 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || pullMutation.isPending}
                className="gap-2"
                data-testid="button-github-sync"
              >
                {syncMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Subir a GitHub
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Actualizar desde GitHub
              </CardTitle>
              <CardDescription>
                Descarga la última versión del código y reinicia la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Importante</AlertTitle>
                <AlertDescription>
                  Esta acción descargará el código más reciente del repositorio y reiniciará 
                  la aplicación. Los archivos locales que no estén en GitHub serán preservados 
                  (uploads, configuraciones, etc.)
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => pullMutation.mutate()}
                disabled={syncMutation.isPending || pullMutation.isPending}
                variant="outline"
                className="gap-2"
                data-testid="button-github-pull"
              >
                {pullMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Actualizar desde GitHub
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
