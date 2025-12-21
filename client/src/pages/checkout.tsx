import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, ChevronLeft, BookOpen, Check, CreditCard, Tag, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Audiobook, BillingProfile } from "@shared/schema";

interface CartItemWithAudiobook {
  id: string;
  userId: string;
  audiobookId: string;
  createdAt: Date;
  audiobook: Audiobook;
}

interface CartData {
  items: CartItemWithAudiobook[];
  totalCents: number;
  itemCount: number;
  currency: string;
}

const billingFormSchema = z.object({
  fullName: z.string().min(2, "Nombre completo es requerido"),
  email: z.string().email("Email invalido"),
  taxId: z.string().optional(),
  address: z.string().min(5, "Direccion es requerida"),
  city: z.string().min(2, "Ciudad es requerida"),
  postalCode: z.string().min(3, "Codigo postal es requerido"),
  country: z.string().min(2, "Pais es requerido"),
});

type BillingFormData = z.infer<typeof billingFormSchema>;

function formatPrice(cents: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(cents / 100);
}

interface AppliedDiscount {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  discountAmountCents: number;
  finalAmountCents: number;
}

export default function CheckoutPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPayPal, setShowPayPal] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const { data: cart, isLoading: cartLoading } = useQuery<CartData>({
    queryKey: ["/api/cart"],
  });

  const { data: billingProfile } = useQuery<BillingProfile>({
    queryKey: ["/api/billing-profile"],
  });

  const { data: user } = useQuery<{ id: string; email: string; displayName?: string }>({
    queryKey: ["/api/user"],
  });

  const form = useForm<BillingFormData>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      taxId: "",
      address: "",
      city: "",
      postalCode: "",
      country: "Espana",
    },
  });

  const isProfileComplete = useMemo(() => {
    if (!billingProfile) return false;
    return !!(
      billingProfile.fullName &&
      billingProfile.email &&
      billingProfile.address &&
      billingProfile.city &&
      billingProfile.postalCode &&
      billingProfile.country
    );
  }, [billingProfile]);

  useEffect(() => {
    if (billingProfile || user) {
      form.reset({
        fullName: billingProfile?.fullName || user?.displayName || "",
        email: billingProfile?.email || user?.email || "",
        taxId: billingProfile?.taxId || "",
        address: billingProfile?.address || "",
        city: billingProfile?.city || "",
        postalCode: billingProfile?.postalCode || "",
        country: billingProfile?.country || "Espana",
      });
    }
  }, [billingProfile, user, form]);

  useEffect(() => {
    if (isProfileComplete) {
      setShowPayPal(true);
    }
  }, [isProfileComplete]);

  const onSubmit = async (data: BillingFormData) => {
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/billing-profile", data);
      queryClient.invalidateQueries({ queryKey: ["/api/billing-profile"] });
      setShowPayPal(true);
      toast({
        title: "Datos guardados",
        description: "Tus datos de facturacion se han guardado correctamente",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron guardar los datos de facturacion",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayPalSuccess = async () => {
    queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    queryClient.invalidateQueries({ queryKey: ["/api/user/purchases"] });
    queryClient.invalidateQueries({ queryKey: ["/api/library/purchases"] });
    
    toast({
      title: "Compra completada",
      description: "Tus audiolibros estan listos para escuchar",
    });
    
    setLocation("/library");
  };

  const validateDiscountCode = async () => {
    if (!discountCode.trim()) return;
    
    setIsValidatingCode(true);
    try {
      const response = await apiRequest("POST", "/api/discount-codes/validate", {
        code: discountCode.trim().toUpperCase(),
        totalCents: cart?.totalCents || 0,
        forSubscription: false,
      });
      
      const data = await response.json();
      
      if (data.valid) {
        setAppliedDiscount({
          id: data.discountCode.id,
          code: data.discountCode.code,
          type: data.discountCode.type,
          value: data.discountCode.value,
          discountAmountCents: data.discountAmountCents,
          finalAmountCents: data.finalAmountCents,
        });
        toast({
          title: "Codigo aplicado",
          description: `Descuento de ${formatPrice(data.discountAmountCents, cart?.currency || "EUR")} aplicado`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Codigo invalido",
          description: data.error || "El codigo de descuento no es valido",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo validar el codigo",
      });
    } finally {
      setIsValidatingCode(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode("");
  };

  const finalTotal = appliedDiscount ? appliedDiscount.finalAmountCents : (cart?.totalCents || 0);

  if (cartLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  if (isEmpty) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-16">
          <CardContent>
            <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Tu carrito esta vacio</h2>
            <p className="text-muted-foreground mb-6">
              No tienes audiolibros para comprar
            </p>
            <Link href="/">
              <Button data-testid="button-explore">
                Explorar audiolibros
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/cart">
        <Button variant="ghost" size="sm" className="mb-6">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver al carrito
        </Button>
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
        <CreditCard className="w-8 h-8" />
        Finalizar compra
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                {showPayPal && <Check className="w-5 h-5 text-green-500" />}
                Datos de facturacion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Tu nombre completo" 
                            {...field} 
                            disabled={showPayPal}
                            data-testid="input-fullname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="tu@email.com" 
                            {...field} 
                            disabled={showPayPal}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIF/CIF (opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Tu NIF o CIF" 
                            {...field} 
                            disabled={showPayPal}
                            data-testid="input-taxid"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Direccion</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Tu direccion" 
                            {...field} 
                            disabled={showPayPal}
                            data-testid="input-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ciudad</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ciudad" 
                              {...field} 
                              disabled={showPayPal}
                              data-testid="input-city"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Codigo postal</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Codigo postal" 
                              {...field} 
                              disabled={showPayPal}
                              data-testid="input-postalcode"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pais</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Pais" 
                            {...field} 
                            disabled={showPayPal}
                            data-testid="input-country"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!showPayPal ? (
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isProcessing}
                      data-testid="button-continue-payment"
                    >
                      {isProcessing ? "Guardando..." : "Continuar al pago"}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowPayPal(false)}
                        data-testid="button-edit-billing"
                      >
                        Editar datos
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1" 
                        disabled={isProcessing}
                        data-testid="button-update-billing"
                      >
                        {isProcessing ? "Guardando..." : "Actualizar"}
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          {showPayPal && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Pago con PayPal</CardTitle>
              </CardHeader>
              <CardContent>
                <CartPayPalButton 
                  totalCents={finalTotal}
                  currency={cart.currency}
                  itemCount={cart.itemCount}
                  discountCode={appliedDiscount?.code}
                  onSuccess={handlePayPalSuccess}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle className="font-serif">Resumen del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      {item.audiobook.coverArtUrl ? (
                        <img
                          src={item.audiobook.coverArtUrl}
                          alt={item.audiobook.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary-foreground/60" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.audiobook.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.audiobook.author}</p>
                    </div>
                    <span className="text-sm font-medium">
                      {formatPrice(item.audiobook.priceCents, item.audiobook.currency)}
                    </span>
                  </div>
                ))}
              </div>
              
              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Codigo de descuento
                </p>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                    <div>
                      <span className="font-mono font-bold text-green-600 dark:text-green-400">
                        {appliedDiscount.code}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {appliedDiscount.type === "PERCENTAGE" 
                          ? `${appliedDiscount.value}% de descuento`
                          : `${formatPrice(appliedDiscount.value * 100, cart.currency)} de descuento`
                        }
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={removeDiscount} data-testid="button-remove-discount">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Introduce tu codigo"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), validateDiscountCode())}
                      className="flex-1 font-mono"
                      data-testid="input-discount-code"
                    />
                    <Button 
                      variant="outline" 
                      onClick={validateDiscountCode}
                      disabled={isValidatingCode || !discountCode.trim()}
                      data-testid="button-apply-discount"
                    >
                      {isValidatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                    </Button>
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({cart.itemCount} audiolibros)</span>
                  <span>{formatPrice(cart.totalCents, cart.currency)}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Descuento ({appliedDiscount.code})</span>
                    <span>-{formatPrice(appliedDiscount.discountAmountCents, cart.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>IVA incluido</span>
                  <span>-</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span data-testid="text-checkout-total">{formatPrice(finalTotal, cart.currency)}</span>
              </div>

              <p className="text-xs text-center text-muted-foreground pt-4">
                Al completar la compra, aceptas nuestros terminos y condiciones.
                Tendras acceso permanente a tus audiolibros.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CartPayPalButton({ 
  totalCents, 
  currency, 
  itemCount,
  discountCode,
  onSuccess 
}: { 
  totalCents: number; 
  currency: string;
  itemCount: number;
  discountCode?: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: paypalConfig } = useQuery<{ clientId: string }>({
    queryKey: ["/api/paypal/client-id"],
  });

  const loadPayPalScript = () => {
    if (!paypalConfig?.clientId) return;
    
    const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&currency=${currency}`;
    script.async = true;
    script.onload = () => {
      setIsLoading(false);
      renderPayPalButton();
    };
    script.onerror = () => {
      setError("Error al cargar PayPal");
      setIsLoading(false);
    };
    document.body.appendChild(script);
  };

  const renderPayPalButton = () => {
    const container = document.getElementById("paypal-cart-button-container");
    if (!container || !(window as any).paypal) return;
    
    container.innerHTML = "";

    (window as any).paypal.Buttons({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "pay",
      },
      createOrder: async () => {
        try {
          const response = await fetch("/api/paypal/create-cart-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ discountCode }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error creating order");
          }
          
          const data = await response.json();
          return data.orderId;
        } catch (err: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: err.message || "No se pudo crear la orden",
          });
          throw err;
        }
      },
      onApprove: async (data: { orderID: string }) => {
        try {
          const response = await fetch("/api/paypal/capture-cart-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderId: data.orderID }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error capturing order");
          }
          
          onSuccess();
        } catch (err: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: err.message || "No se pudo completar el pago",
          });
        }
      },
      onError: (err: any) => {
        console.error("PayPal error:", err);
        toast({
          variant: "destructive",
          title: "Error de PayPal",
          description: "Hubo un problema con el pago",
        });
      },
    }).render("#paypal-cart-button-container");
  };

  if (!paypalConfig?.clientId) {
    loadPayPalScript();
  } else if (isLoading) {
    loadPayPalScript();
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-destructive">{error}</p>
        <Button 
          variant="outline" 
          className="mt-2" 
          onClick={() => {
            setError(null);
            setIsLoading(true);
            loadPayPalScript();
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      <div id="paypal-cart-button-container" data-testid="paypal-cart-button"></div>
      <p className="text-xs text-center text-muted-foreground">
        Pago seguro procesado por PayPal
      </p>
    </div>
  );
}
