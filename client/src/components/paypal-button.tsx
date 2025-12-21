import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalButtonProps {
  audiobookId: string;
  priceCents: number;
  currency: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function PayPalButton({ audiobookId, priceCents, currency, onSuccess, onError }: PayPalButtonProps) {
  const { toast } = useToast();
  const paypalRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const buttonsInstanceRef = useRef<any>(null);
  const renderAttemptedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);

  const audiobookIdRef = useRef(audiobookId);
  audiobookIdRef.current = audiobookId;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const { data: paypalConfig } = useQuery<{ clientId: string; environment: string }>({
    queryKey: ["/api/paypal/config"],
    retry: false,
  });

  useEffect(() => {
    if (!paypalConfig?.clientId) return;

    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existingScript) {
      if (window.paypal) {
        setSdkReady(true);
        setIsLoading(false);
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&currency=${currency}`;
    script.async = true;
    script.onload = () => {
      setSdkReady(true);
      setIsLoading(false);
    };
    script.onerror = () => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: "No se pudo cargar PayPal",
        variant: "destructive",
      });
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [paypalConfig, currency, toast]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (buttonsInstanceRef.current?.close) {
        try {
          buttonsInstanceRef.current.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || !window.paypal || !paypalRef.current || !mountedRef.current) return;
    if (renderAttemptedRef.current) return;
    renderAttemptedRef.current = true;

    paypalRef.current.innerHTML = "";

    const buttons = window.paypal.Buttons({
      style: {
        color: "gold",
        shape: "rect",
        label: "pay",
        height: 40,
      },
      createOrder: async () => {
        if (!mountedRef.current) throw new Error("Component unmounted");
        try {
          const result = await apiRequest("POST", "/api/paypal/orders", { audiobookId: audiobookIdRef.current });
          return result.orderId;
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Error creando orden",
            variant: "destructive",
          });
          throw error;
        }
      },
      onApprove: async (data: { orderID: string }) => {
        if (!mountedRef.current) return;
        try {
          await apiRequest("POST", `/api/paypal/orders/${data.orderID}/capture`);
          queryClient.invalidateQueries({ queryKey: ["/api/user/purchases"] });
          queryClient.invalidateQueries({ queryKey: ["/api/audiobooks", audiobookIdRef.current] });
          toast({
            title: "Compra exitosa",
            description: "El audiolibro ha sido agregado a tu biblioteca.",
          });
          onSuccessRef.current?.();
        } catch (error: any) {
          console.error("Error capturing order:", error);
          toast({
            title: "Error en la compra",
            description: error.message,
            variant: "destructive",
          });
          onErrorRef.current?.(error);
        }
      },
      onError: (error: any) => {
        if (!mountedRef.current) return;
        console.error("PayPal error:", error);
        toast({
          title: "Error de PayPal",
          description: "Hubo un problema con el pago",
          variant: "destructive",
        });
      },
      onCancel: () => {
        if (!mountedRef.current) return;
        toast({
          title: "Pago cancelado",
          description: "Has cancelado el proceso de pago",
        });
      },
    });

    buttonsInstanceRef.current = buttons;

    if (paypalRef.current && mountedRef.current) {
      buttons.render(paypalRef.current).catch((err: any) => {
        if (mountedRef.current) {
          console.error("PayPal render error:", err);
        }
      });
    }
  }, [sdkReady, toast]);

  if (!paypalConfig) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        PayPal no está configurado
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div 
      ref={paypalRef} 
      data-testid="paypal-button-container"
      className="min-h-[50px]"
    />
  );
}

interface PayPalSubscriptionButtonProps {
  planId: string;
  paypalPlanId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function PayPalSubscriptionButton({ planId, paypalPlanId, onSuccess, onError }: PayPalSubscriptionButtonProps) {
  const { toast } = useToast();
  const containerId = useRef(`paypal-sub-${planId}-${Date.now()}`);
  const paypalRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const buttonsInstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [renderComplete, setRenderComplete] = useState(false);

  const planIdRef = useRef(planId);
  planIdRef.current = planId;

  const paypalPlanIdRef = useRef(paypalPlanId);
  paypalPlanIdRef.current = paypalPlanId;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const { data: paypalConfig } = useQuery<{ clientId: string; environment: string }>({
    queryKey: ["/api/paypal/config"],
    retry: false,
  });

  useEffect(() => {
    if (!paypalConfig?.clientId) return;

    const existingSubscriptionScript = document.querySelector('script[data-paypal-subscription="true"]');
    if (existingSubscriptionScript) {
      const checkPayPal = setInterval(() => {
        if (window.paypal) {
          clearInterval(checkPayPal);
          setSdkReady(true);
          setIsLoading(false);
        }
      }, 100);
      setTimeout(() => clearInterval(checkPayPal), 5000);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&vault=true&intent=subscription`;
    script.async = true;
    script.setAttribute("data-paypal-subscription", "true");
    script.onload = () => {
      setSdkReady(true);
      setIsLoading(false);
    };
    script.onerror = () => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: "No se pudo cargar PayPal",
        variant: "destructive",
      });
    };
    document.body.appendChild(script);
  }, [paypalConfig, toast]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (buttonsInstanceRef.current?.close) {
        try {
          buttonsInstanceRef.current.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || !window.paypal || !paypalRef.current || !paypalPlanIdRef.current || !mountedRef.current) return;
    if (renderComplete) return;

    paypalRef.current.innerHTML = "";

    const buttons = window.paypal.Buttons({
      style: {
        color: "gold",
        shape: "rect",
        label: "subscribe",
        height: 40,
      },
      createSubscription: async (data: any, actions: any) => {
        if (!mountedRef.current) throw new Error("Component unmounted");
        return actions.subscription.create({
          plan_id: paypalPlanIdRef.current,
        });
      },
      onApprove: async (data: { subscriptionID: string }) => {
        if (!mountedRef.current) return;
        try {
          await apiRequest("POST", `/api/paypal/subscriptions/${data.subscriptionID}/activate`, { planId: planIdRef.current });
          queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
          toast({
            title: "Suscripción activada",
            description: "Ahora tienes acceso a todo el catálogo.",
          });
          onSuccessRef.current?.();
        } catch (error: any) {
          console.error("Error activating subscription:", error);
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
          onErrorRef.current?.(error);
        }
      },
      onError: (error: any) => {
        if (!mountedRef.current) return;
        console.error("PayPal subscription error:", error);
        toast({
          title: "Error de PayPal",
          description: "Hubo un problema con la suscripción",
          variant: "destructive",
        });
      },
      onCancel: () => {
        if (!mountedRef.current) return;
        toast({
          title: "Suscripción cancelada",
          description: "Has cancelado el proceso de suscripción",
        });
      },
    });

    buttonsInstanceRef.current = buttons;

    if (paypalRef.current && mountedRef.current) {
      buttons.render(paypalRef.current)
        .then(() => {
          if (mountedRef.current) {
            setRenderComplete(true);
          }
        })
        .catch((err: any) => {
          if (mountedRef.current) {
            console.error("PayPal subscription render error:", err);
          }
        });
    }
  }, [sdkReady, renderComplete, toast]);

  if (!paypalConfig) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        PayPal no está configurado
      </div>
    );
  }

  if (!paypalPlanId) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        Este plan no tiene PayPal configurado
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div 
      ref={paypalRef} 
      data-testid="paypal-subscription-button-container"
      className="min-h-[50px]"
    />
  );
}
