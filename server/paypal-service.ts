import { db } from "./db";
import { paypalConfig, audiobookPurchases, userSubscriptions, subscriptionPlans, users, audiobooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { invoiceService } from "./invoice-service";

const PAYPAL_API_BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  production: "https://api-m.paypal.com",
};

interface PayPalAccessToken {
  access_token: string;
  expires_in: number;
  expiresAt: number;
}

let cachedToken: PayPalAccessToken | null = null;

async function getPayPalConfig() {
  const [config] = await db.select().from(paypalConfig).where(eq(paypalConfig.isActive, true)).limit(1);
  return config;
}

async function getAccessToken(): Promise<string> {
  const config = await getPayPalConfig();
  if (!config) {
    throw new Error("PayPal no está configurado");
  }

  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("PAYPAL_CLIENT_SECRET no está configurado");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.access_token;
  }

  const baseUrl = PAYPAL_API_BASE[config.environment as keyof typeof PAYPAL_API_BASE] || PAYPAL_API_BASE.sandbox;
  const auth = Buffer.from(`${config.clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error obteniendo token de PayPal: ${error}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_in: data.expires_in,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.access_token;
}

async function paypalRequest(endpoint: string, options: RequestInit = {}) {
  const config = await getPayPalConfig();
  if (!config) {
    throw new Error("PayPal no está configurado");
  }

  const baseUrl = PAYPAL_API_BASE[config.environment as keyof typeof PAYPAL_API_BASE] || PAYPAL_API_BASE.sandbox;
  const accessToken = await getAccessToken();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error en petición PayPal: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function createOrder(audiobookId: string, userId: string, priceCents: number, currency: string) {
  const priceValue = (priceCents / 100).toFixed(2);

  const order = await paypalRequest("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: audiobookId,
          custom_id: userId,
          amount: {
            currency_code: currency,
            value: priceValue,
          },
        },
      ],
      application_context: {
        return_url: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000"}/library?purchase=success`,
        cancel_url: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000"}/library?purchase=cancelled`,
        brand_name: "Audivia",
        user_action: "PAY_NOW",
      },
    }),
  });

  const [purchase] = await db.insert(audiobookPurchases).values({
    userId,
    audiobookId,
    pricePaidCents: priceCents,
    currency,
    status: "PENDING",
    paypalOrderId: order.id,
  }).returning();

  return {
    orderId: order.id,
    approvalUrl: order.links.find((l: any) => l.rel === "approve")?.href,
    purchaseId: purchase.id,
  };
}

export async function captureOrder(orderId: string) {
  const capture = await paypalRequest(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
  });

  if (capture.status === "COMPLETED") {
    const purchaseUnit = capture.purchase_units[0];
    const captureId = purchaseUnit.payments.captures[0].id;
    const payerEmail = capture.payer?.email_address;
    const payerId = capture.payer?.payer_id;

    const [purchase] = await db.update(audiobookPurchases)
      .set({
        status: "COMPLETED",
        paypalCaptureId: captureId,
        paypalPayerEmail: payerEmail,
        purchasedAt: new Date(),
      })
      .where(eq(audiobookPurchases.paypalOrderId, orderId))
      .returning();

    if (payerId && purchase) {
      await db.update(users)
        .set({ paypalPayerId: payerId })
        .where(eq(users.id, purchase.userId));
    }

    if (purchase) {
      try {
        const [audiobook] = await db.select().from(audiobooks).where(eq(audiobooks.id, purchase.audiobookId)).limit(1);
        if (audiobook) {
          await invoiceService.createPurchaseInvoice(
            purchase.userId,
            purchase.id,
            audiobook,
            purchase.pricePaidCents,
            purchase.currency
          );
          console.log(`Invoice created for purchase ${purchase.id}`);
        }
      } catch (invoiceError) {
        console.error("Error creating invoice:", invoiceError);
      }
    }

    return { success: true, purchase };
  }

  return { success: false, status: capture.status };
}

export async function getOrderStatus(orderId: string) {
  return paypalRequest(`/v2/checkout/orders/${orderId}`);
}

export async function createSubscription(planId: string, userId: string) {
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
  
  if (!plan || !plan.paypalPlanId) {
    throw new Error("Plan no encontrado o no tiene PayPal configurado");
  }

  const subscription = await paypalRequest("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: plan.paypalPlanId,
      custom_id: userId,
      application_context: {
        return_url: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000"}/library?subscription=success`,
        cancel_url: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000"}/subscriptions?subscription=cancelled`,
        brand_name: "Audivia",
        user_action: "SUBSCRIBE_NOW",
      },
    }),
  });

  return {
    subscriptionId: subscription.id,
    approvalUrl: subscription.links.find((l: any) => l.rel === "approve")?.href,
  };
}

export async function activateSubscription(paypalSubscriptionId: string, planId: string, userId: string) {
  const subscription = await paypalRequest(`/v1/billing/subscriptions/${paypalSubscriptionId}`);

  if (subscription.status === "ACTIVE") {
    const startTime = new Date(subscription.start_time);
    const billingInfo = subscription.billing_info;
    const nextBillingTime = billingInfo?.next_billing_time ? new Date(billingInfo.next_billing_time) : new Date(startTime.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [userSub] = await db.insert(userSubscriptions).values({
      userId,
      planId,
      status: "ACTIVE",
      paypalSubscriptionId,
      currentPeriodStart: startTime,
      currentPeriodEnd: nextBillingTime,
    }).returning();

    const payerId = subscription.subscriber?.payer_id;
    if (payerId) {
      await db.update(users)
        .set({ paypalPayerId: payerId })
        .where(eq(users.id, userId));
    }

    try {
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
      if (plan) {
        await invoiceService.createSubscriptionInvoice(
          userId,
          userSub.id,
          plan,
          plan.currency
        );
        console.log(`Invoice created for subscription ${userSub.id}`);
      }
    } catch (invoiceError) {
      console.error("Error creating subscription invoice:", invoiceError);
    }

    return { success: true, subscription: userSub };
  }

  return { success: false, status: subscription.status };
}

export async function cancelSubscription(subscriptionId: string, reason?: string) {
  await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "Usuario canceló la suscripción" }),
  });

  await db.update(userSubscriptions)
    .set({
      status: "CANCELED",
      canceledAt: new Date(),
    })
    .where(eq(userSubscriptions.paypalSubscriptionId, subscriptionId));

  return { success: true };
}

export async function getSubscriptionStatus(subscriptionId: string) {
  return paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`);
}

export async function createPayPalProduct(name: string, description: string) {
  return paypalRequest("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      type: "SERVICE",
      category: "DIGITAL_MEDIA_BOOKS_MOVIES_MUSIC",
    }),
  });
}

export async function createPayPalPlan(productId: string, name: string, description: string, priceCents: number, currency: string, intervalMonths: number, trialDays: number = 0) {
  const priceValue = (priceCents / 100).toFixed(2);

  const billingCycles: any[] = [];
  let sequence = 1;

  if (trialDays > 0) {
    billingCycles.push({
      frequency: {
        interval_unit: "DAY",
        interval_count: trialDays,
      },
      tenure_type: "TRIAL",
      sequence: sequence++,
      total_cycles: 1,
      pricing_scheme: {
        fixed_price: {
          value: "0.00",
          currency_code: currency,
        },
      },
    });
  }

  billingCycles.push({
    frequency: {
      interval_unit: "MONTH",
      interval_count: intervalMonths,
    },
    tenure_type: "REGULAR",
    sequence: sequence,
    total_cycles: 0,
    pricing_scheme: {
      fixed_price: {
        value: priceValue,
        currency_code: currency,
      },
    },
  });

  return paypalRequest("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      name,
      description,
      billing_cycles: billingCycles,
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  });
}

export async function verifyWebhookSignature(headers: Record<string, string>, body: string) {
  const config = await getPayPalConfig();
  if (!config || !config.webhookId) {
    throw new Error("Webhook de PayPal no configurado");
  }

  const verifyData = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: config.webhookId,
    webhook_event: JSON.parse(body),
  };

  const result = await paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify(verifyData),
  });

  return result.verification_status === "SUCCESS";
}

export async function getPayPalClientId() {
  const config = await getPayPalConfig();
  if (!config) {
    return null;
  }
  return {
    clientId: config.clientId,
    environment: config.environment,
  };
}

export async function isPayPalConfigured() {
  const config = await getPayPalConfig();
  return !!config && !!process.env.PAYPAL_CLIENT_SECRET;
}
