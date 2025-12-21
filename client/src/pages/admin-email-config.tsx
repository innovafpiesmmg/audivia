import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Mail, Server, Lock, CheckCircle, AlertCircle, ExternalLink, Eye, FileText, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EmailConfig } from "@shared/schema";

interface TemplatePreview {
  id: string;
  name: string;
  description: string;
  html: string;
}

const emailConfigSchema = z.object({
  smtpHost: z.string().min(1, "SMTP host es requerido"),
  smtpPort: z.number().int().min(1).max(65535, "Puerto debe estar entre 1 y 65535"),
  smtpUser: z.string().min(1, "Usuario SMTP es requerido"),
  smtpPassword: z.string().optional(),
  smtpSecure: z.boolean(),
  fromEmail: z.string().email("Email inválido"),
  fromName: z.string().min(1, "Nombre del remitente es requerido"),
});

type EmailConfigFormData = z.infer<typeof emailConfigSchema>;

export default function AdminEmailConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreview | null>(null);

  const { data: config, isLoading } = useQuery<EmailConfig[], Error, EmailConfig | null>({
    queryKey: ["/api/admin/email-config"],
    select: (data) => data && data.length > 0 ? data[0] : null,
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<TemplatePreview[]>({
    queryKey: ["/api/admin/email-templates"],
  });

  const form = useForm<EmailConfigFormData>({
    resolver: zodResolver(emailConfigSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpUser: "",
      smtpPassword: "",
      smtpSecure: false,
      fromEmail: "",
      fromName: "Audivia",
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPassword: "",
        smtpSecure: config.smtpSecure,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
      });
    }
  }, [config]);

  const updateConfigMutation = useMutation({
    mutationFn: async (data: EmailConfigFormData) => {
      // Remove password from request if it's empty (when editing)
      const payload = { ...data };
      if (config && (!payload.smtpPassword || payload.smtpPassword === "")) {
        delete payload.smtpPassword;
      }
      
      // Validate password is present when creating
      if (!config && !payload.smtpPassword) {
        throw new Error("Contraseña SMTP es requerida al crear una nueva configuración");
      }

      if (config) {
        // Update existing config
        return await apiRequest("PATCH", "/api/admin/email-config", payload);
      } else {
        // Create new config
        return await apiRequest("POST", "/api/admin/email-config", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-config"] });
      toast({
        title: "Configuración guardada",
        description: "La configuración de email ha sido actualizada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo guardar la configuración",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/email-config/test", {});
    },
    onSuccess: () => {
      toast({
        title: "Email de prueba enviado",
        description: "Verifica tu bandeja de entrada.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error al enviar email de prueba",
        description: error.message || "No se pudo enviar el email de prueba",
      });
    },
  });

  const onSubmit = (data: EmailConfigFormData) => {
    updateConfigMutation.mutate(data);
  };

  const handleTestEmail = () => {
    testEmailMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="h-8 w-8" />
          Configuración de Email
        </h1>
        <p className="text-muted-foreground mt-2">
          Configura el servidor SMTP para el envío de emails de notificación
        </p>
      </div>

      {!config && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No hay configuración</AlertTitle>
          <AlertDescription>
            No se ha configurado un servidor SMTP. Completa el formulario para habilitar el envío de emails.
          </AlertDescription>
        </Alert>
      )}

      {config && (
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Configuración activa</AlertTitle>
          <AlertDescription>
            El servidor SMTP está configurado. Puedes enviar un email de prueba para verificar la configuración.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Configuración del Servidor SMTP
          </CardTitle>
          <CardDescription>
            Ingresa los datos de tu servidor SMTP para enviar emails de notificación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="smtpHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servidor SMTP</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="smtp.buzondecorreo.com"
                          data-testid="input-smtp-host"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtpPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puerto</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="465"
                          value={field.value || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val === "" ? 587 : parseInt(val, 10) || 587);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          data-testid="input-smtp-port"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="smtpUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario SMTP</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="tu@email.com"
                        data-testid="input-smtp-user"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="smtpPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña SMTP</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          className="pl-10"
                          placeholder={config ? "••••••••" : "Contraseña SMTP"}
                          data-testid="input-smtp-password"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      {config && "Deja en blanco para mantener la contraseña actual"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="smtpSecure"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">SSL/TLS</FormLabel>
                      <FormDescription>
                        Usar conexión segura (recomendado para puerto 465)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-smtp-secure"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fromEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email del Remitente</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="noreply@audivia.com"
                          data-testid="input-from-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fromName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Remitente</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Audivia"
                          data-testid="input-from-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-between gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestEmail}
                  disabled={!config || testEmailMutation.isPending}
                  data-testid="button-test-email"
                >
                  {testEmailMutation.isPending ? "Enviando..." : "Enviar Email de Prueba"}
                </Button>
                <Button
                  type="submit"
                  disabled={updateConfigMutation.isPending}
                  data-testid="button-save-config"
                >
                  {updateConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Acceso al Webmail
          </CardTitle>
          <CardDescription>
            Accede directamente a tu bandeja de entrada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open("https://correo.piensasolutions.com/?_task=mail&_mbox=INBOX", "_blank")}
            data-testid="button-open-webmail"
          >
            <Mail className="mr-2 h-4 w-4" />
            Abrir Webmail
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Configuración Recomendada</CardTitle>
          <CardDescription>
            Datos de configuración para tu servidor de correo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-2 p-4 border rounded-lg bg-primary/5">
              <h3 className="font-semibold">Buzón de Correo (Recomendado)</h3>
              <p className="text-sm text-muted-foreground">
                Servidor SMTP: smtp.buzondecorreo.com | Puerto: 465 | SSL/TLS: Sí
              </p>
              <p className="text-sm text-muted-foreground">
                Servidor IMAP: imap.buzondecorreo.com | Puerto: 993 | SSL/TLS: Sí
              </p>
              <p className="text-xs text-muted-foreground">
                El nombre de usuario es tu dirección de correo electrónico completa
              </p>
            </div>
            <div className="grid gap-2 p-4 border rounded-lg">
              <h3 className="font-semibold">Gmail</h3>
              <p className="text-sm text-muted-foreground">
                Servidor: smtp.gmail.com | Puerto: 587 | SSL/TLS: No
              </p>
              <p className="text-xs text-muted-foreground">
                Nota: Debes generar una contraseña de aplicación en tu cuenta de Google
              </p>
            </div>
            <div className="grid gap-2 p-4 border rounded-lg">
              <h3 className="font-semibold">Office 365 / Outlook</h3>
              <p className="text-sm text-muted-foreground">
                Servidor: smtp.office365.com | Puerto: 587 | SSL/TLS: No
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Plantillas de Email
          </CardTitle>
          <CardDescription>
            Previsualiza las plantillas de email que se envían a los usuarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates?.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className="text-left p-4 border rounded-lg hover-elevate transition-all"
                  data-testid={`button-template-${template.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="font-medium">{template.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                    <Eye className="h-3 w-3" />
                    <span>Ver plantilla</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {selectedTemplate?.name}
              </DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground">{selectedTemplate?.description}</p>
          </DialogHeader>
          <ScrollArea className="h-[70vh] p-6 pt-4">
            {selectedTemplate && (
              <div 
                className="border rounded-lg overflow-hidden"
                style={{ backgroundColor: "#1a1a2e" }}
              >
                <iframe
                  srcDoc={selectedTemplate.html}
                  className="w-full h-[600px] border-0"
                  title={`Preview: ${selectedTemplate.name}`}
                  data-testid="iframe-template-preview"
                />
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
