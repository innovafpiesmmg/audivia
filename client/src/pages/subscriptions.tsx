import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Check, Crown, Library, ChevronLeft, Loader2 } from "lucide-react";
import { PayPalSubscriptionButton } from "@/components/paypal-button";
import type { SubscriptionPlan, UserSubscription } from "@shared/schema";

function formatPrice(cents: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(cents / 100);
}

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan: boolean;
  hasActiveSubscription: boolean;
}

function PlanCard({ plan, isCurrentPlan, hasActiveSubscription }: PlanCardProps) {
  const intervalLabel = plan.intervalMonths === 1 ? "mes" : plan.intervalMonths === 12 ? "ano" : `${plan.intervalMonths} meses`;
  
  const defaultFeatures = [
    "Acceso a todo el catálogo",
    "Escucha sin limites",
    "Sin anuncios",
    ...(plan.trialDays > 0 ? [`${plan.trialDays} dias de prueba gratis`] : []),
    "Renovacion automatica (cancela cuando quieras)",
  ];
  
  return (
    <Card 
      className={`relative flex flex-col ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
      data-testid={`card-plan-${plan.id}`}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground">
            <Crown className="w-3 h-3 mr-1" />
            Tu plan actual
          </Badge>
        </div>
      )}
      <CardHeader className="text-center">
        <CardTitle className="font-serif text-2xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">{formatPrice(plan.priceCents, plan.currency)}</span>
          <span className="text-muted-foreground">/{intervalLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3">
          {defaultFeatures.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full" disabled>
            Plan actual
          </Button>
        ) : hasActiveSubscription ? (
          <Button variant="outline" className="w-full" disabled>
            Ya tienes una suscripción activa
          </Button>
        ) : plan.paypalPlanId ? (
          <PayPalSubscriptionButton 
            planId={plan.id}
            paypalPlanId={plan.paypalPlanId}
          />
        ) : (
          <div className="text-sm text-muted-foreground text-center">
            Este plan no esta disponible actualmente
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

export default function Subscriptions() {
  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const { data: userSubscriptionData, isLoading: subscriptionLoading } = useQuery<{
    subscription: UserSubscription | null;
    plan: SubscriptionPlan | null;
  }>({
    queryKey: ["/api/user/subscription"],
  });

  const activeSubscription = userSubscriptionData?.subscription;
  const currentPlan = userSubscriptionData?.plan;

  if (plansLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <Skeleton className="h-12 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const activePlans = (plans || []).filter(p => p.isActive);

  return (
    <div className="min-h-screen pb-16">
      <div className="bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 py-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Volver
            </Button>
          </Link>

          <div className="text-center mb-12">
            <Crown className="w-16 h-16 mx-auto text-primary mb-4" />
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
              Suscríbete a Audivia
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Accede a todo nuestro catálogo de audiolibros con una suscripción mensual
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {activeSubscription && activeSubscription.status === "ACTIVE" && (
          <Card className="mb-8 border-primary">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Suscripción activa</h3>
                  <p className="text-muted-foreground">
                    {currentPlan ? (
                      <>Estas suscrito al plan <strong>{currentPlan.name}</strong></>
                    ) : (
                      "Tienes acceso a todo el catálogo de audiolibros"
                    )}
                  </p>
                </div>
                <Link href="/library">
                  <Button className="gap-2">
                    <Library className="w-4 h-4" />
                    Ir a mi biblioteca
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {activePlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={currentPlan?.id === plan.id}
              hasActiveSubscription={activeSubscription?.status === "ACTIVE"}
            />
          ))}
        </div>

        {activePlans.length === 0 && (
          <div className="text-center py-16">
            <Crown className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-2xl font-bold mb-2">No hay planes disponibles</h2>
            <p className="text-muted-foreground">
              Los planes de suscripción estarán disponibles pronto
            </p>
          </div>
        )}

        <div className="mt-12 max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-2xl font-bold mb-4">Beneficios de la suscripción</h2>
          <div className="grid gap-4 md:grid-cols-3 text-left">
            <div className="p-4 rounded-lg bg-card border">
              <Library className="w-8 h-8 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Catálogo completo</h3>
              <p className="text-sm text-muted-foreground">
                Acceso a todos los audiolibros sin limites
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border">
              <Check className="w-8 h-8 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Sin compromiso</h3>
              <p className="text-sm text-muted-foreground">
                Cancela cuando quieras sin penalizacion
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border">
              <Crown className="w-8 h-8 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Contenido exclusivo</h3>
              <p className="text-sm text-muted-foreground">
                Acceso anticipado a nuevos titulos
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
