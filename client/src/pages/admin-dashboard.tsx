import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, Play, CheckCircle, Clock, XCircle, FileText } from "lucide-react";
import type { User, Audiobook, Chapter } from "@shared/schema";

export default function AdminDashboard() {
  const { data: users, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: audiobooks, isLoading: loadingAudiobooks } = useQuery<Audiobook[]>({
    queryKey: ["/api/admin/audiobooks"],
  });

  const { data: chapters, isLoading: loadingChapters } = useQuery<Chapter[]>({
    queryKey: ["/api/admin/chapters"],
  });

  const isLoading = loadingUsers || loadingAudiobooks || loadingChapters;

  // Calculate statistics
  const stats = {
    totalUsers: users?.length || 0,
    activeUsers: users?.filter(u => u.isActive).length || 0,
    admins: users?.filter(u => u.role === "ADMIN").length || 0,
    creators: users?.filter(u => u.role === "CREATOR").length || 0,
    listeners: users?.filter(u => u.role === "LISTENER").length || 0,
    totalAudiobooks: audiobooks?.length || 0,
    publishedAudiobooks: audiobooks?.filter(a => a.isPublished).length || 0,
    freeAudiobooks: audiobooks?.filter(a => a.isFree).length || 0,
    totalChapters: chapters?.length || 0,
    sampleChapters: chapters?.filter(c => c.isSample).length || 0,
  };

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Panel de Administración</h1>
        <p className="text-muted-foreground mt-1">
          Vista general de Audivia y gestión de contenido
        </p>
      </div>

      {/* User Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Usuarios</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeUsers} activos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Badge variant="destructive" className="h-5 px-2">ADMIN</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.admins}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Creadores</CardTitle>
              <Badge className="h-5 px-2">CREATOR</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.creators}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Oyentes</CardTitle>
              <Badge variant="outline" className="h-5 px-2">USER</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.listeners}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Audiobook Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Audiolibros</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Audiolibros</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalAudiobooks}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {stats.publishedAudiobooks} publicados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gratuitos</CardTitle>
              <Badge className="bg-accent text-accent-foreground h-5 px-2">FREE</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.freeAudiobooks}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Capitulos</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalChapters}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {stats.sampleChapters} muestras
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Activo</div>
              <p className="text-xs text-muted-foreground mt-1">
                Plataforma funcionando correctamente
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
