const BRAND_COLOR = "#7C3AED";
const BRAND_COLOR_LIGHT = "#A78BFA";
const BRAND_GOLD = "#EAB308";
const BRAND_NAME = "Audivia";

export function getEmailTemplate(content: string, showFooterLinks: boolean = true, logoBase64?: string): string {
  const logoSrc = logoBase64 ? `data:image/png;base64,${logoBase64}` : "cid:audivia-logo";
  
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
              <img src="${logoSrc}" alt="${BRAND_NAME}" style="max-width: 180px; height: auto;" />
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

export interface TemplatePreview {
  id: string;
  name: string;
  description: string;
  html: string;
}

export function getTemplatePreview(templateId: string, logoBase64?: string): TemplatePreview | null {
  const templates: Record<string, () => TemplatePreview> = {
    welcome: () => ({
      id: "welcome",
      name: "Bienvenida",
      description: "Email enviado cuando un nuevo usuario se registra",
      html: getEmailTemplate(`
        <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
          ¡Hola, <span style="color: ${BRAND_GOLD};">Usuario Ejemplo</span>!
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
      `, true, logoBase64),
    }),

    passwordReset: () => ({
      id: "passwordReset",
      name: "Recuperar Contraseña",
      description: "Email enviado para restablecer la contraseña",
      html: getEmailTemplate(`
        <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
          Recuperación de contraseña
        </h1>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hola <strong style="color: ${BRAND_GOLD};">Usuario Ejemplo</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${BRAND_NAME}.
        </p>
        
        <p style="text-align: center; margin: 32px 0;">
          ${getButton("Restablecer Contraseña", "#")}
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
      `, false, logoBase64),
    }),

    emailVerification: () => ({
      id: "emailVerification",
      name: "Verificar Email",
      description: "Email enviado para verificar la dirección de correo",
      html: getEmailTemplate(`
        <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
          Verifica tu email
        </h1>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hola <strong style="color: ${BRAND_GOLD};">Usuario Ejemplo</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Gracias por registrarte en <strong style="color: ${BRAND_COLOR_LIGHT};">${BRAND_NAME}</strong>. 
          Para completar tu registro y acceder a todos los beneficios, necesitamos verificar tu dirección de email.
        </p>
        
        <p style="text-align: center; margin: 32px 0;">
          ${getButton("Verificar mi Email", "#")}
        </p>
        
        ${getInfoBox(`
          <p style="margin: 0; color: #d1d5db; font-size: 14px;">
            Este enlace expirará en <strong style="color: ${BRAND_GOLD};">24 horas</strong>.
          </p>
        `)}
        
        <p style="font-size: 14px; color: #9ca3af;">
          Si no creaste esta cuenta, puedes ignorar este correo.
        </p>
      `, false, logoBase64),
    }),

    purchaseConfirmation: () => ({
      id: "purchaseConfirmation",
      name: "Confirmación de Compra",
      description: "Email enviado cuando se completa una compra",
      html: getEmailTemplate(`
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">&#128214;</span>
        </div>
        <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
          ¡Compra Confirmada!
        </h1>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hola <strong style="color: ${BRAND_GOLD};">Usuario Ejemplo</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Tu compra se ha realizado con éxito. Ya puedes disfrutar de tu nuevo audiolibro.
        </p>
        
        ${getGoldAccentBox(`
          <h3 style="color: white; margin: 0 0 8px 0; font-size: 20px;">El Arte de la Guerra</h3>
          <p style="color: #9ca3af; margin: 0; font-size: 14px;">Referencia: AUD-2024-0001</p>
        `)}
        
        <p style="text-align: center; margin: 32px 0;">
          ${getButton("Ir a Mi Biblioteca", "/library")}
        </p>
        
        <p style="font-size: 14px; color: #9ca3af; text-align: center;">
          Recibirás la factura en un correo separado.
        </p>
      `, true, logoBase64),
    }),

    invoice: () => ({
      id: "invoice",
      name: "Factura",
      description: "Email con la factura adjunta",
      html: getEmailTemplate(`
        <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
          Factura AUD-2024-0001
        </h1>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hola <strong style="color: ${BRAND_GOLD};">Usuario Ejemplo</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Adjuntamos la factura correspondiente a tu compra.
        </p>
        
        ${getInfoBox(`
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: #9ca3af; font-size: 14px;">Número de factura:</td>
              <td style="padding: 12px 0; text-align: right; color: white; font-weight: 600;">AUD-2024-0001</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #9ca3af; font-size: 14px; border-top: 1px solid rgba(124, 58, 237, 0.2);">Fecha de emisión:</td>
              <td style="padding: 12px 0; text-align: right; color: #d1d5db; border-top: 1px solid rgba(124, 58, 237, 0.2);">21 de diciembre de 2024</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #9ca3af; font-size: 14px; border-top: 1px solid rgba(124, 58, 237, 0.2);">Total:</td>
              <td style="padding: 12px 0; text-align: right; color: ${BRAND_GOLD}; font-weight: 700; font-size: 24px; border-top: 1px solid rgba(124, 58, 237, 0.2);">9,99 €</td>
            </tr>
          </table>
        `)}

        <p style="font-size: 16px; line-height: 1.6; text-align: center; color: #d1d5db;">
          Encontrarás el PDF de la factura adjunto a este correo.
        </p>
        
        <p style="font-size: 14px; color: #9ca3af; margin-top: 32px;">
          Gracias por tu confianza en <strong style="color: ${BRAND_COLOR_LIGHT};">${BRAND_NAME}</strong>.
        </p>
      `, true, logoBase64),
    }),

    newChapter: () => ({
      id: "newChapter",
      name: "Nuevo Capítulo",
      description: "Email enviado cuando hay un nuevo capítulo disponible",
      html: getEmailTemplate(`
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">&#127926;</span>
        </div>
        <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
          ¡Nuevo Capítulo Disponible!
        </h1>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hola <strong style="color: ${BRAND_GOLD};">Usuario Ejemplo</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hay un nuevo capítulo disponible en uno de tus audiolibros:
        </p>
        
        ${getGoldAccentBox(`
          <h3 style="color: white; margin: 0 0 8px 0; font-size: 18px;">El Arte de la Guerra</h3>
          <p style="color: ${BRAND_COLOR_LIGHT}; margin: 0; font-size: 16px; font-weight: 600;">Capítulo 5: El Engaño Estratégico</p>
        `)}
        
        <p style="text-align: center; margin: 32px 0;">
          ${getButton("Escuchar Ahora", "#")}
        </p>
        
        <p style="font-size: 14px; color: #9ca3af; text-align: center;">
          ¡Disfruta del nuevo contenido!
        </p>
      `, true, logoBase64),
    }),

    contentApproved: () => ({
      id: "contentApproved",
      name: "Contenido Aprobado",
      description: "Email enviado cuando se aprueba contenido de un creador",
      html: getEmailTemplate(`
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">&#127881;</span>
        </div>
        <h1 style="color: white; font-size: 28px; margin: 0 0 20px 0; font-weight: 600; text-align: center;">
          ¡Contenido Aprobado!
        </h1>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hola <strong style="color: ${BRAND_GOLD};">Creador Ejemplo</strong>,
        </p>
        
        ${getGoldAccentBox(`
          <p style="margin: 0; color: #d1d5db;">
            Tu audiolibro <strong style="color: white;">"El Arte de la Guerra"</strong> ha sido aprobado 
            y ahora está disponible para todos los usuarios de ${BRAND_NAME}.
          </p>
        `)}
        
        <p style="font-size: 16px; line-height: 1.6;">
          ¡Felicitaciones por tu excelente trabajo!
        </p>
      `, true, logoBase64),
    }),
  };

  const templateFn = templates[templateId];
  return templateFn ? templateFn() : null;
}

export function getAllTemplates(logoBase64?: string): TemplatePreview[] {
  const templateIds = ["welcome", "emailVerification", "passwordReset", "purchaseConfirmation", "invoice", "newChapter", "contentApproved"];
  return templateIds.map(id => getTemplatePreview(id, logoBase64)).filter((t): t is TemplatePreview => t !== null);
}
