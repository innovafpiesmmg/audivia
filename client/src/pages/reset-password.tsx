import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, CheckCircle } from "lucide-react";
import logoImage from "@assets/AUDIVIA_1766261612511.png";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Get token from URL query params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    
    if (!tokenParam) {
      toast({
        variant: "destructive",
        title: "Token inválido",
        description: "El enlace de recuperación es inválido o ha expirado",
      });
    } else {
      setToken(tokenParam);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Las contraseñas no coinciden",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La contraseña debe tener al menos 8 caracteres",
      });
      return;
    }

    if (!token) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Token no encontrado",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al restablecer la contraseña");
      }

      setIsSuccess(true);
      toast({
        title: "¡Contraseña actualizada!",
        description: "Tu contraseña ha sido restablecida exitosamente",
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo restablecer la contraseña",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center justify-center gap-3">
            <img 
              src={logoImage} 
              alt="Audivia Logo" 
              className="w-12 h-12"
              data-testid="img-logo"
            />
            <div>
              <h1 className="font-serif text-xl font-bold">Audivia</h1>
            </div>
          </div>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Token Inválido</CardTitle>
              <CardDescription>
                El enlace de recuperación es inválido o ha expirado
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/forgot-password" className="w-full">
                <Button className="w-full" data-testid="button-request-new">
                  Solicitar nuevo enlace
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <img 
            src={logoImage} 
            alt="Audivia Logo" 
            className="w-12 h-12"
            data-testid="img-logo"
          />
          <div>
            <h1 className="font-serif text-xl font-bold">Audivia</h1>
            <p className="text-xs text-muted-foreground">Restablecer contraseña</p>
          </div>
        </div>

        {/* Reset Password Card */}
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                {isSuccess ? (
                  <CheckCircle className="w-6 h-6 text-primary" />
                ) : (
                  <KeyRound className="w-6 h-6 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {isSuccess ? "¡Listo!" : "Nueva Contraseña"}
                </CardTitle>
                <CardDescription>
                  {isSuccess 
                    ? "Tu contraseña ha sido actualizada" 
                    : "Ingresa tu nueva contraseña"
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {!isSuccess ? (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    data-testid="input-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    data-testid="input-confirm-password"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Restableciendo...
                    </>
                  ) : (
                    "Restablecer Contraseña"
                  )}
                </Button>
              </CardFooter>
            </form>
          ) : (
            <>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    Tu contraseña ha sido restablecida exitosamente.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Serás redirigido a la página de inicio de sesión en unos segundos...
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/login" className="w-full">
                  <Button 
                    type="button" 
                    className="w-full"
                    data-testid="button-go-to-login"
                  >
                    Ir a Iniciar Sesión
                  </Button>
                </Link>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
