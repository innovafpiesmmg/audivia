import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/theme-provider";

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="font-serif text-4xl font-bold mb-6" data-testid="text-page-title">
          Configuración
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Apariencia</CardTitle>
            <CardDescription>
              Personaliza cómo se ve Audivia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dark-mode">Modo Oscuro</Label>
                <p className="text-sm text-muted-foreground">
                  Activa el tema oscuro para reducir el cansancio visual
                </p>
              </div>
              <Switch
                id="dark-mode"
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                data-testid="switch-dark-mode"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
