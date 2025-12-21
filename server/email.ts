import nodemailer, { Transporter } from "nodemailer";
import type { EmailConfig, Invoice } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

export interface EmailService {
  sendWelcomeEmail(to: string, username: string): Promise<void>;
  sendPasswordResetEmail(to: string, username: string, resetUrl: string): Promise<void>;
  sendEmailVerification(to: string, username: string, verificationUrl: string): Promise<void>;
  sendContentApprovedEmail(to: string, username: string, contentType: string, contentTitle: string): Promise<void>;
  sendContentRejectedEmail(to: string, username: string, contentType: string, contentTitle: string): Promise<void>;
  sendSubscriptionNotification(to: string, username: string, podcastTitle: string): Promise<void>;
  sendNewEpisodeNotification(to: string, username: string, podcastTitle: string, episodeTitle: string, episodeUrl: string): Promise<void>;
  sendInvoiceEmail(to: string, username: string, invoice: Invoice, pdfPath: string | null): Promise<void>;
  sendPurchaseConfirmation(to: string, username: string, audiobookTitle: string, invoiceNumber: string): Promise<void>;
}

const BRAND_COLOR = "#7C3AED";
const BRAND_COLOR_LIGHT = "#A78BFA";
const BRAND_GOLD = "#EAB308";
const BRAND_NAME = "Audivia";
const LOGO_PATH = path.join(process.cwd(), "attached_assets", "audivia-logo.png");

function getEmailTemplate(content: string, showFooterLinks: boolean = true): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #16162a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(124, 58, 237, 0.15);">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #5B21B6 100%); padding: 30px 40px; text-align: center;">
              <img src="cid:audivia-logo" alt="${BRAND_NAME}" style="max-width: 180px; height: auto;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px; color: #e5e5e5;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f0f1a; padding: 30px 40px; text-align: center; border-top: 1px solid #2a2a4a;">
              ${showFooterLinks ? `
              <p style="margin: 0 0 15px 0;">
                <a href="/explore" style="color: ${BRAND_COLOR_LIGHT}; text-decoration: none; margin: 0 10px;">Explorar</a>
                <span style="color: #4a4a6a;">|</span>
                <a href="/library" style="color: ${BRAND_COLOR_LIGHT}; text-decoration: none; margin: 0 10px;">Mi Biblioteca</a>
                <span style="color: #4a4a6a;">|</span>
                <a href="/account" style="color: ${BRAND_COLOR_LIGHT}; text-decoration: none; margin: 0 10px;">Mi Cuenta</a>
              </p>
              ` : ''}
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. Todos los derechos reservados.
              </p>
              <p style="color: #4b5563; font-size: 11px; margin: 10px 0 0 0;">
                Este es un correo automático, por favor no respondas directamente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function getButton(text: string, url: string): string {
  return `
    <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #5B21B6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4); transition: all 0.3s ease;">
      ${text}
    </a>
  `;
}

function getSecondaryButton(text: string, url: string): string {
  return `
    <a href="${url}" style="display: inline-block; background: transparent; color: ${BRAND_COLOR_LIGHT}; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; border: 2px solid ${BRAND_COLOR};">
      ${text}
    </a>
  `;
}

function getInfoBox(content: string): string {
  return `
    <div style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(91, 33, 182, 0.1) 100%); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0;">
      ${content}
    </div>
  `;
}

function getGoldAccentBox(content: string): string {
  return `
    <div style="background: linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(202, 138, 4, 0.1) 100%); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BRAND_GOLD};">
      ${content}
    </div>
  `;
}

export class NodemailerEmailService implements EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor(config?: EmailConfig) {
    if (config) {
      this.updateConfig(config);
    }
  }

  updateConfig(config: EmailConfig): void {
    this.config = config;
    
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
      debug: true,
      logger: true,
    });
  }

  private getLogoAttachment(): { filename: string; path: string; cid: string } | null {
    if (fs.existsSync(LOGO_PATH)) {
      return {
        filename: "audivia-logo.png",
        path: LOGO_PATH,
        cid: "audivia-logo",
      };
    }
    return null;
  }

  private async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    additionalAttachments?: Array<{filename: string, path: string}>
  ): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error("Email service not configured. Please configure SMTP settings in admin panel.");
    }

    if (!this.config.isActive) {
      throw new Error("Email service is not active. Please activate it in admin panel.");
    }

    const logoAttachment = this.getLogoAttachment();
    const attachments = [
      ...(logoAttachment ? [logoAttachment] : []),
      ...(additionalAttachments || []),
    ];

    try {
      await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to,
        subject,
        html,
        attachments,
      });
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email. Please check SMTP configuration.");
    }
  }

  async sendWelcomeEmail(to: string, username: string): Promise<void> {
    const subject = `¡Bienvenido a ${BRAND_NAME}! Tu aventura sonora comienza`;
    const content = `
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
        ¡Hola, <span style="color: ${BRAND_GOLD};">${username}</span>!
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Bienvenido a <strong style="color: ${BRAND_COLOR_LIGHT};">${BRAND_NAME}</strong>, tu nueva plataforma de audiolibros premium. 
        Estamos encantados de tenerte con nosotros.
      </p>
      
      ${getInfoBox(`
        <h3 style="color: white; margin: 0 0 15px 0; font-size: 18px;">Ahora puedes:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #d1d5db;">
          <li style="margin-bottom: 10px;">Explorar nuestra colección exclusiva de audiolibros</li>
          <li style="margin-bottom: 10px;">Crear tu biblioteca personal de favoritos</li>
          <li style="margin-bottom: 10px;">Escuchar en cualquier momento y lugar</li>
          <li style="margin-bottom: 0;">Sincronizar tu progreso entre todos tus dispositivos</li>
        </ul>
      `)}
      
      <p style="text-align: center; margin: 32px 0;">
        ${getButton("Explorar Audiolibros", "/explore")}
      </p>
      
      <p style="font-size: 14px; color: #9ca3af; text-align: center;">
        ¿Tienes alguna pregunta? Estamos aquí para ayudarte.
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content));
  }

  async sendPasswordResetEmail(to: string, username: string, resetUrl: string): Promise<void> {
    const subject = `Recupera tu acceso a ${BRAND_NAME}`;
    const content = `
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
        Recuperación de contraseña
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola <strong style="color: ${BRAND_GOLD};">${username}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${BRAND_NAME}.
      </p>
      
      <p style="text-align: center; margin: 32px 0;">
        ${getButton("Restablecer Contraseña", resetUrl)}
      </p>
      
      ${getInfoBox(`
        <p style="margin: 0; color: #d1d5db; font-size: 14px;">
          <strong style="color: ${BRAND_GOLD};">Importante:</strong> Este enlace expirará en <strong>1 hora</strong>.
        </p>
      `)}
      
      <p style="font-size: 14px; color: #9ca3af;">
        Si no solicitaste este cambio, puedes ignorar este correo de forma segura. 
        Tu contraseña actual seguirá siendo válida.
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content, false));
  }

  async sendEmailVerification(to: string, username: string, verificationUrl: string): Promise<void> {
    const subject = `Verifica tu cuenta en ${BRAND_NAME}`;
    const content = `
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
        Verifica tu email
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola <strong style="color: ${BRAND_GOLD};">${username}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Gracias por registrarte en <strong style="color: ${BRAND_COLOR_LIGHT};">${BRAND_NAME}</strong>. 
        Para completar tu registro y acceder a todos los beneficios, necesitamos verificar tu dirección de email.
      </p>
      
      <p style="text-align: center; margin: 32px 0;">
        ${getButton("Verificar mi Email", verificationUrl)}
      </p>
      
      ${getInfoBox(`
        <p style="margin: 0; color: #d1d5db; font-size: 14px;">
          Este enlace expirará en <strong style="color: ${BRAND_GOLD};">24 horas</strong>.
        </p>
      `)}
      
      <p style="font-size: 14px; color: #9ca3af;">
        Si no creaste esta cuenta, puedes ignorar este correo.
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content, false));
  }

  async sendContentApprovedEmail(to: string, username: string, contentType: string, contentTitle: string): Promise<void> {
    const subject = `¡Tu ${contentType} ha sido aprobado! - ${BRAND_NAME}`;
    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">&#127881;</span>
      </div>
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
        ¡Contenido Aprobado!
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola <strong style="color: ${BRAND_GOLD};">${username}</strong>,
      </p>
      
      ${getGoldAccentBox(`
        <p style="margin: 0; color: #d1d5db;">
          Tu ${contentType} <strong style="color: white;">"${contentTitle}"</strong> ha sido aprobado 
          y ahora está disponible para todos los usuarios de ${BRAND_NAME}.
        </p>
      `)}
      
      <p style="font-size: 16px; line-height: 1.6;">
        ¡Felicitaciones por tu excelente trabajo!
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content));
  }

  async sendContentRejectedEmail(to: string, username: string, contentType: string, contentTitle: string): Promise<void> {
    const subject = `Actualización sobre tu ${contentType} - ${BRAND_NAME}`;
    const content = `
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
        Actualización de Contenido
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola <strong style="color: ${BRAND_GOLD};">${username}</strong>,
      </p>
      
      ${getInfoBox(`
        <p style="margin: 0; color: #d1d5db;">
          Tu ${contentType} <strong style="color: white;">"${contentTitle}"</strong> no ha podido ser aprobado en esta ocasión.
        </p>
      `)}
      
      <p style="font-size: 16px; line-height: 1.6;">
        Por favor, revisa que cumpla con nuestras políticas de contenido y vuelve a intentarlo. 
        Si tienes alguna duda, no dudes en contactar con nuestro equipo de soporte.
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content));
  }

  async sendSubscriptionNotification(to: string, username: string, podcastTitle: string): Promise<void> {
    const subject = `¡Nueva suscripción activada! - ${BRAND_NAME}`;
    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">&#127911;</span>
      </div>
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
        ¡Nueva Suscripción!
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola <strong style="color: ${BRAND_GOLD};">${username}</strong>,
      </p>
      
      ${getGoldAccentBox(`
        <p style="margin: 0; color: #d1d5db;">
          Te has suscrito exitosamente a <strong style="color: white;">"${podcastTitle}"</strong>.
        </p>
      `)}
      
      <p style="font-size: 16px; line-height: 1.6;">
        Recibirás notificaciones cuando haya nuevo contenido disponible.
      </p>
      
      <p style="text-align: center; margin: 32px 0;">
        ${getButton("Ver Contenido", "/library")}
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content));
  }

  async sendNewEpisodeNotification(to: string, username: string, podcastTitle: string, episodeTitle: string, episodeUrl: string): Promise<void> {
    const subject = `Nuevo capítulo: ${episodeTitle} - ${BRAND_NAME}`;
    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">&#127926;</span>
      </div>
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
        ¡Nuevo Capítulo Disponible!
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola <strong style="color: ${BRAND_GOLD};">${username}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hay un nuevo capítulo disponible en uno de tus audiolibros:
      </p>
      
      ${getGoldAccentBox(`
        <h3 style="color: white; margin: 0 0 8px 0; font-size: 18px;">${podcastTitle}</h3>
        <p style="color: ${BRAND_COLOR_LIGHT}; margin: 0; font-size: 16px; font-weight: 600;">${episodeTitle}</p>
      `)}
      
      <p style="text-align: center; margin: 32px 0;">
        ${getButton("Escuchar Ahora", episodeUrl)}
      </p>
      
      <p style="font-size: 14px; color: #9ca3af; text-align: center;">
        ¡Disfruta del nuevo contenido!
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content));
  }

  async sendInvoiceEmail(to: string, username: string, invoice: Invoice, pdfPath: string | null): Promise<void> {
    const subject = `Factura ${invoice.invoiceNumber} - ${BRAND_NAME}`;
    const formattedTotal = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: invoice.currency,
    }).format(invoice.totalCents / 100);

    const additionalAttachments = pdfPath && fs.existsSync(pdfPath) ? [{
      filename: `factura-${invoice.invoiceNumber}.pdf`,
      path: pdfPath,
    }] : [];

    const content = `
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
        Factura ${invoice.invoiceNumber}
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola <strong style="color: ${BRAND_GOLD};">${username}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Adjuntamos la factura correspondiente a tu ${invoice.type === 'PURCHASE' ? 'compra' : 'suscripción'}.
      </p>
      
      ${getInfoBox(`
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; color: #9ca3af; font-size: 14px;">Número de factura:</td>
            <td style="padding: 12px 0; text-align: right; color: white; font-weight: 600;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #9ca3af; font-size: 14px; border-top: 1px solid rgba(124, 58, 237, 0.2);">Fecha de emisión:</td>
            <td style="padding: 12px 0; text-align: right; color: #d1d5db; border-top: 1px solid rgba(124, 58, 237, 0.2);">${new Date(invoice.issueDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #9ca3af; font-size: 14px; border-top: 1px solid rgba(124, 58, 237, 0.2);">Total:</td>
            <td style="padding: 12px 0; text-align: right; color: ${BRAND_GOLD}; font-weight: 700; font-size: 24px; border-top: 1px solid rgba(124, 58, 237, 0.2);">${formattedTotal}</td>
          </tr>
        </table>
      `)}

      ${additionalAttachments.length > 0 
        ? `<p style="font-size: 16px; line-height: 1.6; text-align: center; color: #d1d5db;">
            Encontrarás el PDF de la factura adjunto a este correo.
          </p>` 
        : `<p style="text-align: center; margin: 24px 0;">
            ${getSecondaryButton("Descargar Factura", "/account/invoices")}
          </p>`
      }
      
      <p style="font-size: 14px; color: #9ca3af; margin-top: 32px;">
        Gracias por tu confianza en <strong style="color: ${BRAND_COLOR_LIGHT};">${BRAND_NAME}</strong>.
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content), additionalAttachments);
  }

  async sendPurchaseConfirmation(to: string, username: string, audiobookTitle: string, invoiceNumber: string): Promise<void> {
    const subject = `¡Compra confirmada! ${audiobookTitle} - ${BRAND_NAME}`;
    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">&#128214;</span>
      </div>
      <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
        ¡Compra Confirmada!
      </h1>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hola <strong style="color: ${BRAND_GOLD};">${username}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Tu compra se ha realizado con éxito. Ya puedes disfrutar de tu nuevo audiolibro.
      </p>
      
      ${getGoldAccentBox(`
        <h3 style="color: white; margin: 0 0 8px 0; font-size: 20px;">${audiobookTitle}</h3>
        <p style="color: #9ca3af; margin: 0; font-size: 14px;">Referencia: ${invoiceNumber}</p>
      `)}
      
      <p style="text-align: center; margin: 32px 0;">
        ${getButton("Ir a Mi Biblioteca", "/library")}
      </p>
      
      <p style="font-size: 14px; color: #9ca3af; text-align: center;">
        ${invoiceNumber.startsWith('AUD-') 
          ? 'Recibirás la factura en un correo separado.' 
          : 'Si deseas factura, configura tu perfil de facturación en tu cuenta.'
        }
      </p>
    `;
    await this.sendEmail(to, subject, getEmailTemplate(content));
  }
}

export class MockEmailService implements EmailService {
  async sendWelcomeEmail(to: string, username: string): Promise<void> {
    console.log(`[MOCK EMAIL] Welcome email to ${to} (${username})`);
  }

  async sendPasswordResetEmail(to: string, username: string, resetUrl: string): Promise<void> {
    console.log(`[MOCK EMAIL] Password reset to ${to} (${username}): ${resetUrl}`);
  }

  async sendEmailVerification(to: string, username: string, verificationUrl: string): Promise<void> {
    console.log(`[MOCK EMAIL] Email verification to ${to} (${username}): ${verificationUrl}`);
  }

  async sendContentApprovedEmail(to: string, username: string, contentType: string, contentTitle: string): Promise<void> {
    console.log(`[MOCK EMAIL] Content approved to ${to} (${username}): ${contentType} "${contentTitle}"`);
  }

  async sendContentRejectedEmail(to: string, username: string, contentType: string, contentTitle: string): Promise<void> {
    console.log(`[MOCK EMAIL] Content rejected to ${to} (${username}): ${contentType} "${contentTitle}"`);
  }

  async sendSubscriptionNotification(to: string, username: string, podcastTitle: string): Promise<void> {
    console.log(`[MOCK EMAIL] Subscription notification to ${to} (${username}): "${podcastTitle}"`);
  }

  async sendNewEpisodeNotification(to: string, username: string, podcastTitle: string, episodeTitle: string, episodeUrl: string): Promise<void> {
    console.log(`[MOCK EMAIL] New episode notification to ${to} (${username}): "${episodeTitle}" from "${podcastTitle}" - ${episodeUrl}`);
  }

  async sendInvoiceEmail(to: string, username: string, invoice: Invoice, pdfPath: string | null): Promise<void> {
    console.log(`[MOCK EMAIL] Invoice ${invoice.invoiceNumber} to ${to} (${username}), PDF: ${pdfPath}`);
  }

  async sendPurchaseConfirmation(to: string, username: string, audiobookTitle: string, invoiceNumber: string): Promise<void> {
    console.log(`[MOCK EMAIL] Purchase confirmation to ${to} (${username}): "${audiobookTitle}" - Invoice: ${invoiceNumber}`);
  }
}

// Helper function to get the appropriate email service
import type { IStorage } from "./storage";

export async function getEmailService(storage: IStorage): Promise<EmailService> {
  const config = await storage.getActiveEmailConfig();
  
  if (config && config.isActive) {
    return new NodemailerEmailService(config);
  }
  
  // Fallback to mock service if no config or inactive
  return new MockEmailService();
}
