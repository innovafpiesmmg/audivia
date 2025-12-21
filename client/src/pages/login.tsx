import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Loader2, Headphones } from "lucide-react";
import logoImage from "@assets/AUDIVIA_1766261612511.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [redirectPath] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("from") === "mobile" ? "/mobile" : "/";
  });
  const isMobileOrigin = redirectPath === "/mobile";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation(redirectPath);
    }
  }, [isAuthenticated, setLocation, redirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: "¡Bienvenido de vuelta!",
        description: "Has iniciado sesión exitosamente",
      });
      setLocation(redirectPath);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión",
        description: error.message || "Email o contraseña incorrectos",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Login form - full width on mobile, optimized for no scroll */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-12">
        <div className="w-full max-w-md space-y-4">
          {/* Logo - compact for mobile */}
          <div className="flex items-center justify-center gap-3">
            <img 
              src={logoImage} 
              alt="Audivia Logo" 
              className="w-12 h-12 lg:w-16 lg:h-16"
              data-testid="img-logo"
            />
            <div>
              <h1 className="font-serif text-xl lg:text-2xl font-bold">Audivia</h1>
              <p className="text-xs lg:text-sm text-muted-foreground">Audiolibros premium</p>
            </div>
          </div>

          {/* Login Card - compact */}
          <Card className="w-full border-0 shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xl text-center">Iniciar Sesión</CardTitle>
            </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 pb-3">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm">Contraseña</Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-xs text-primary hover:underline"
                    data-testid="link-forgot-password"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-0">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                ¿No tienes cuenta?{" "}
                <Link href={isMobileOrigin ? "/register?from=mobile" : "/register"} className="text-primary hover:underline font-medium" data-testid="link-register">
                  Regístrate aquí
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
        </div>
      </div>

      {/* Right side - Gradient background (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background items-center justify-center">
        <div className="text-center p-8">
          <Headphones className="w-24 h-24 mx-auto text-primary/40 mb-4" />
          <p className="text-xl text-muted-foreground">Miles de audiolibros te esperan</p>
        </div>
      </div>
    </div>
  );
}
