import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, CheckCircle, Database, Settings } from "lucide-react";
import logoImage from "@assets/AUDIVIA_1766261612511.png";

export default function Setup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"welcome" | "admin" | "complete">("welcome");
  const [adminData, setAdminData] = useState({
    username: "admin",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adminData.password !== adminData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Las contraseñas no coinciden",
      });
      return;
    }

    if (adminData.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La contraseña debe tener al menos 8 caracteres",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/setup/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminData.username,
          email: adminData.email,
          password: adminData.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al crear el administrador");
      }

      setStep("complete");
      toast({
        title: "Configuración completada",
        description: "El administrador ha sido creado exitosamente",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-4">
          <img 
            src={logoImage} 
            alt="Audivia Logo" 
            className="w-20 h-20"
            data-testid="img-logo"
          />
          <div className="text-center">
            <h1 className="font-serif text-3xl font-bold">Audivia</h1>
            <p className="text-muted-foreground">Configuración inicial</p>
          </div>
        </div>

        {step === "welcome" && (
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <Settings className="w-10 h-10 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">Bienvenido a Audivia</CardTitle>
              <CardDescription>
                Esta es la primera vez que accedes a la plataforma. Vamos a configurar tu cuenta de administrador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Database className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Base de datos</p>
                  <p className="text-xs text-muted-foreground">Conectada y lista</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Administrador</p>
                  <p className="text-xs text-muted-foreground">Pendiente de configurar</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => setStep("admin")}
                data-testid="button-start-setup"
              >
                Comenzar configuración
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === "admin" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Crear Administrador</CardTitle>
                  <CardDescription>Configura la cuenta principal de administración</CardDescription>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handleCreateAdmin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Nombre de usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    value={adminData.username}
                    onChange={(e) => setAdminData({ ...adminData, username: e.target.value })}
                    required
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@tudominio.com"
                    value={adminData.email}
                    onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                    required
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={adminData.password}
                    onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                    required
                    minLength={8}
                    data-testid="input-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={adminData.confirmPassword}
                    onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                    required
                    minLength={8}
                    data-testid="input-confirm-password"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep("welcome")}
                  disabled={isLoading}
                >
                  Atrás
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={isLoading}
                  data-testid="button-create-admin"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Administrador"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {step === "complete" && (
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-green-500/10">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-2xl">Configuración Completada</CardTitle>
              <CardDescription>
                Audivia está listo para usar. Ahora puedes iniciar sesión con tu cuenta de administrador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted text-center">
                <p className="text-sm text-muted-foreground mb-2">Credenciales de acceso:</p>
                <p className="font-medium">{adminData.email}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => setLocation("/login")}
                data-testid="button-go-login"
              >
                Ir a Iniciar Sesión
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
