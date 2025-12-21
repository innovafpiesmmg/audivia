import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { CreditCard, Key, Globe, CheckCircle, AlertCircle, ExternalLink, Lock, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaypalConfig } from "@shared/schema";

const paypalConfigSchema = z.object({
  clientId: z.string().min(1, "Client ID es requerido"),
  webhookId: z.string().optional(),
  environment: z.enum(["sandbox", "production"]),
});

type PayPalConfigFormData = z.infer<typeof paypalConfigSchema>;

export default function AdminPayPalConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<PaypalConfig | null>({
    queryKey: ["/api/admin/paypal/config"],
  });

  const form = useForm<PayPalConfigFormData>({
    resolver: zodResolver(paypalConfigSchema),
    defaultValues: {
      clientId: "",
      webhookId: "",
      environment: "sandbox",
    },
    values: config ? {
      clientId: config.clientId,
      webhookId: config.webhookId || "",
      environment: config.environment as "sandbox" | "production",
    } : undefined,
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: PayPalConfigFormData) => {
      return await apiRequest("POST", "/api/admin/paypal/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/paypal/config"] });
      toast({
        title: "Configuración guardada",
        description: "La configuración de PayPal ha sido actualizada exitosamente.",
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

  const onSubmit = (data: PayPalConfigFormData) => {
    saveConfigMutation.mutate(data);
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
          <CreditCard className="h-8 w-8" />
          Configuración de PayPal
        </h1>
        <p className="text-muted-foreground mt-2">
          Configura las credenciales de PayPal para procesar pagos
        </p>
      </div>

      {!config && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No hay configuración</AlertTitle>
          <AlertDescription>
            No se ha configurado PayPal. Completa el formulario para habilitar los pagos.
          </AlertDescription>
        </Alert>
      )}

      {config && (
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Configuración activa ({config.environment})</AlertTitle>
          <AlertDescription>
            PayPal está configurado en modo {config.environment === "sandbox" ? "pruebas" : "producción"}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Credenciales de PayPal
          </CardTitle>
          <CardDescription>
            Ingresa las credenciales de tu aplicacion de PayPal Developer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entorno</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-environment">
                          <SelectValue placeholder="Selecciona el entorno" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Pruebas)</SelectItem>
                        <SelectItem value="production">Produccion (Real)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Usa Sandbox para pruebas y Produccion para pagos reales
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxN"
                        data-testid="input-client-id"
                      />
                    </FormControl>
                    <FormDescription>
                      El Client ID de tu aplicacion PayPal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="webhookId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook ID (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="WH-xxxxxxxxxxxxxxxxxxxx"
                        data-testid="input-webhook-id"
                      />
                    </FormControl>
                    <FormDescription>
                      ID del webhook para recibir notificaciones de PayPal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                  data-testid="button-save-config"
                >
                  {saveConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Client Secret
          </CardTitle>
          <CardDescription>
            El Client Secret debe configurarse como variable de entorno
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Variable de entorno requerida</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                Por seguridad, el Client Secret de PayPal debe configurarse como una variable de entorno 
                llamada <code className="bg-muted px-1 rounded">PAYPAL_CLIENT_SECRET</code>.
              </p>
              <p className="text-sm text-muted-foreground">
                Ve a la seccion de Secrets en Replit y agrega tu Client Secret ahi.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Como obtener las credenciales
          </CardTitle>
          <CardDescription>
            Sigue estos pasos para configurar PayPal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-2 p-4 border rounded-lg">
              <h3 className="font-semibold">1. Crea una cuenta de desarrollador</h3>
              <p className="text-sm text-muted-foreground">
                Ve a developer.paypal.com e inicia sesion con tu cuenta de PayPal
              </p>
              <a 
                href="https://developer.paypal.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary flex items-center gap-1 hover:underline"
              >
                Ir a PayPal Developer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            
            <div className="grid gap-2 p-4 border rounded-lg">
              <h3 className="font-semibold">2. Crea una aplicacion</h3>
              <p className="text-sm text-muted-foreground">
                En el Dashboard, ve a "Apps & Credentials" y crea una nueva app REST API
              </p>
            </div>
            
            <div className="grid gap-2 p-4 border rounded-lg">
              <h3 className="font-semibold">3. Copia las credenciales</h3>
              <p className="text-sm text-muted-foreground">
                Copia el Client ID aquí y el Secret en las variables de entorno de Replit
              </p>
            </div>

            <div className="grid gap-2 p-4 border rounded-lg">
              <h3 className="font-semibold">4. Configura Webhooks (Opcional)</h3>
              <p className="text-sm text-muted-foreground">
                Para recibir notificaciones de pagos y suscripciónes, configura un webhook 
                apuntando a tu dominio + /api/webhooks/paypal
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
