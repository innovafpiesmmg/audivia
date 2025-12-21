import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, CheckCircle, XCircle } from "lucide-react";
import logoImage from "@assets/favicon_1763064849361.png";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Get token from URL query params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    
    if (!tokenParam) {
      setError("Token de verificación no encontrado");
      setIsLoading(false);
      return;
    }

    setToken(tokenParam);
    verifyEmail(tokenParam);
  }, []);

  const verifyEmail = async (verificationToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al verificar el email");
      }

      setIsSuccess(true);
      toast({
        title: "¡Email verificado!",
        description: "Tu email ha sido verificado exitosamente",
      });

      // Redirect to home after 3 seconds
      setTimeout(() => {
        setLocation("/");
      }, 3000);
    } catch (error: any) {
      setError(error.message);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo verificar el email",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Error al reenviar el email");
      }

      toast({
        title: "Email enviado",
        description: "Hemos enviado un nuevo email de verificación",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo reenviar el email de verificación",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <img 
            src={logoImage} 
            alt="PodcastHub Logo" 
            className="w-20 h-20"
            data-testid="img-logo"
          />
          <div className="text-center">
            <h1 className="text-3xl font-bold">PodcastHub</h1>
            <p className="text-muted-foreground">Verificación de email</p>
          </div>
        </div>

        {/* Verification Card */}
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                {isLoading && <Loader2 className="w-6 h-6 text-primary animate-spin" />}
                {!isLoading && isSuccess && <CheckCircle className="w-6 h-6 text-green-500" />}
                {!isLoading && error && <XCircle className="w-6 h-6 text-destructive" />}
                {!isLoading && !isSuccess && !error && <Mail className="w-6 h-6 text-primary" />}
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {isLoading && "Verificando..."}
                  {!isLoading && isSuccess && "¡Verificado!"}
                  {!isLoading && error && "Error"}
                  {!isLoading && !isSuccess && !error && "Verifica tu email"}
                </CardTitle>
                <CardDescription>
                  {isLoading && "Estamos verificando tu email"}
                  {!isLoading && isSuccess && "Tu email ha sido verificado exitosamente"}
                  {!isLoading && error && "Hubo un problema al verificar tu email"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading && (
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Por favor espera mientras verificamos tu dirección de email...
                </p>
              </div>
            )}

            {!isLoading && isSuccess && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <p className="text-sm text-green-900 dark:text-green-100">
                  ¡Excelente! Tu email ha sido verificado correctamente.
                </p>
                <p className="text-sm text-green-700 dark:text-green-200 mt-2">
                  Serás redirigido al inicio en unos segundos...
                </p>
              </div>
            )}

            {!isLoading && error && (
              <div className="p-4 bg-destructive/10 rounded-lg">
                <p className="text-sm text-destructive">
                  {error}
                </p>
                {error.includes("expirado") && (
                  <p className="text-sm text-muted-foreground mt-2">
                    El enlace de verificación ha expirado. Puedes solicitar uno nuevo.
                  </p>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            {!isLoading && isSuccess && (
              <Link href="/" className="w-full">
                <Button 
                  className="w-full"
                  data-testid="button-go-home"
                >
                  Ir al Inicio
                </Button>
              </Link>
            )}

            {!isLoading && error && (
              <>
                <Button 
                  className="w-full" 
                  onClick={handleResendEmail}
                  data-testid="button-resend"
                >
                  Reenviar email de verificación
                </Button>
                <Link href="/" className="w-full">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-go-home"
                  >
                    Volver al Inicio
                  </Button>
                </Link>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
