import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Loader2, ArrowLeft, Mail, X, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentInvitation, Podcast, Episode } from "@shared/schema";
import { useState } from "react";

const inviteFormSchema = z.object({
  email: z.string().email("Email inválido"),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

export default function ManageInvitations() {
  const [, params] = useRoute("/manage-invitations/:contentType/:id");
  const contentType = params?.contentType as "podcast" | "episode";
  const contentId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [invitationToDelete, setInvitationToDelete] = useState<string | null>(null);

  // Fetch content details (podcast or episode)
  const { data: content, isLoading: isLoadingContent } = useQuery<Podcast | Episode>({
    queryKey: contentType === "podcast" ? ["/api/podcasts", contentId] : ["/api/episodes", contentId],
    enabled: !!contentId && !!contentType,
  });

  // Fetch invitations
  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery<ContentInvitation[]>({
    queryKey: contentType === "podcast" 
      ? ["/api/podcasts", contentId, "invitations"]
      : ["/api/episodes", contentId, "invitations"],
    enabled: !!contentId && !!contentType,
  });

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: InviteFormValues) => {
      const body = contentType === "podcast" 
        ? { email: data.email, podcastId: contentId }
        : { email: data.email, episodeId: contentId };
      
      return await apiRequest("POST", "/api/invitations", body);
    },
    onSuccess: () => {
      toast({
        title: "Invitación enviada",
        description: "Se ha enviado la invitación exitosamente",
      });
      const queryKey = contentType === "podcast"
        ? ["/api/podcasts", contentId, "invitations"]
        : ["/api/episodes", contentId, "invitations"];
      queryClient.invalidateQueries({ queryKey });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar la invitación",
        variant: "destructive",
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return await apiRequest("DELETE", `/api/invitations/${invitationId}`);
    },
    onSuccess: () => {
      toast({
        title: "Invitación eliminada",
        description: "La invitación ha sido eliminada",
      });
      const queryKey = contentType === "podcast"
        ? ["/api/podcasts", contentId, "invitations"]
        : ["/api/episodes", contentId, "invitations"];
      queryClient.invalidateQueries({ queryKey });
      setInvitationToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la invitación",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InviteFormValues) => {
    createInvitationMutation.mutate(data);
  };

  if (isLoadingContent || isLoadingInvitations) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-invitations" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Contenido no encontrado</h2>
          <Button onClick={() => setLocation("/my-podcasts")} data-testid="button-back">
            Volver a Mis Podcasts
          </Button>
        </div>
      </div>
    );
  }

  const backUrl = contentType === "podcast" ? `/podcast/${contentId}` : `/episode/${contentId}`;
  const contentTitle = content.title;
  const visibility = content.visibility || "PUBLIC";

  return (
    <div className="min-h-screen pb-32">
      <div className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => setLocation(backUrl)}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-4xl font-bold font-[Outfit] mb-2" data-testid="text-page-title">
            Gestionar Invitaciones
          </h1>
          <p className="text-muted-foreground">
            {contentType === "podcast" ? "Podcast" : "Episodio"}: {contentTitle}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="secondary" data-testid="badge-visibility">
              {visibility === "PRIVATE" && (
                <>
                  <Lock className="w-3 h-3 mr-1" />
                  Privado
                </>
              )}
              {visibility === "UNLISTED" && (
                <>
                  <Users className="w-3 h-3 mr-1" />
                  Solo invitados
                </>
              )}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Add Invitation Form */}
          <Card>
            <CardHeader>
              <CardTitle>Invitar Usuario</CardTitle>
              <CardDescription>
                Envía una invitación por email para dar acceso a este contenido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email del usuario</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="usuario@example.com"
                            data-testid="input-invite-email"
                          />
                        </FormControl>
                        <FormDescription>
                          El usuario recibirá acceso a este contenido una vez registrado con este email
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={createInvitationMutation.isPending}
                    data-testid="button-send-invitation"
                  >
                    {createInvitationMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Invitación
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Invitations List */}
          <Card>
            <CardHeader>
              <CardTitle>Invitaciones Activas</CardTitle>
              <CardDescription>
                {invitations.length === 0 
                  ? "No hay invitaciones activas" 
                  : `${invitations.length} ${invitations.length === 1 ? "invitación" : "invitaciones"}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aún no has invitado a nadie</p>
                  <p className="text-sm mt-2">
                    Usa el formulario de arriba para enviar invitaciones
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`invitation-item-${invitation.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`invitation-email-${invitation.id}`}>
                            {invitation.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Invitado el {new Date(invitation.createdAt).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setInvitationToDelete(invitation.id)}
                        data-testid={`button-delete-invitation-${invitation.id}`}
                        disabled={deleteInvitationMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={!!invitationToDelete} 
        onOpenChange={(open) => !open && setInvitationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar invitación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El usuario perderá acceso a este contenido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleteInvitationMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invitationToDelete && deleteInvitationMutation.mutate(invitationToDelete)}
              disabled={deleteInvitationMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteInvitationMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
