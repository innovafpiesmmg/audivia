import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2, ShieldAlert } from "lucide-react";

export default function EmergencyReset() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleReset = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/emergency/reset-admin-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: `✅ Contraseña restablecida exitosamente. Email: ${data.email}`,
        });
      } else {
        setResult({
          success: false,
          message: `❌ Error: ${data.error}`,
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: `❌ Error de conexión: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Reset de Emergencia</CardTitle>
          <CardDescription>
            Restablecer contraseña del administrador
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este endpoint restablecerá la contraseña del administrador usando el valor configurado en <code className="bg-muted px-1 rounded">ADMIN_PASSWORD</code>.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleReset}
            disabled={loading}
            className="w-full"
            variant="destructive"
            data-testid="button-reset-password"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restableciendo...
              </>
            ) : (
              "Restablecer Contraseña Admin"
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription className="whitespace-pre-wrap">
                {result.message}
              </AlertDescription>
            </Alert>
          )}

          {result?.success && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Ahora puedes iniciar sesión con:
              </p>
              <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                <div>
                  <span className="font-semibold">Email:</span> admin@audivia.local
                </div>
                <div>
                  <span className="font-semibold">Password:</span> Admin123! (o el que configuraste)
                </div>
              </div>
              <Button
                onClick={() => window.location.href = "/login"}
                className="w-full mt-4"
                data-testid="button-go-login"
              >
                Ir a Iniciar Sesión
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
