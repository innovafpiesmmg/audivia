import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import logoImage from "@assets/AUDIVIA_1766261612511.png";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Error al enviar el email");
      }

      setEmailSent(true);
      toast({
        title: "Email enviado",
        description: "Si el email existe, recibirás instrucciones para recuperar tu contraseña",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo enviar el email de recuperación",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            <p className="text-xs text-muted-foreground">Recupera tu contraseña</p>
          </div>
        </div>

        {/* Forgot Password Card */}
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">¿Olvidaste tu contraseña?</CardTitle>
                <CardDescription>
                  {emailSent 
                    ? "Revisa tu bandeja de entrada" 
                    : "Te enviaremos un enlace para recuperarla"
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {!emailSent ? (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ingresa el email asociado a tu cuenta y te enviaremos las instrucciones para recuperar tu contraseña.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar enlace de recuperación"
                  )}
                </Button>
                <Link href="/login" className="w-full">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full"
                    data-testid="button-back-to-login"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a Iniciar Sesión
                  </Button>
                </Link>
              </CardFooter>
            </form>
          ) : (
            <>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Si existe una cuenta asociada a <strong>{email}</strong>, recibirás un email con las instrucciones para recuperar tu contraseña.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Por favor, revisa tu bandeja de entrada y también la carpeta de spam.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/login" className="w-full">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-back-to-login"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a Iniciar Sesión
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
