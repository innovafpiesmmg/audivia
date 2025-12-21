import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import type { Invoice, InvoiceLineItem, BillingProfile, Audiobook, SubscriptionPlan } from "@shared/schema";

const INVOICES_DIR = path.join(process.cwd(), "invoices");

if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

interface SellerInfo {
  name: string;
  taxId: string;
  address: string;
  email: string;
}

const SELLER_INFO: SellerInfo = {
  name: "Audivia S.L.",
  taxId: "B12345678",
  address: "Calle Principal 123, 28001 Madrid, Spain",
  email: "billing@audivia.com"
};

export class InvoiceService {
  async createPurchaseInvoice(
    userId: string,
    purchaseId: string,
    audiobook: Audiobook,
    pricePaidCents: number,
    currency: string
  ): Promise<Invoice> {
    const billingProfile = await storage.getBillingProfile(userId);
    const invoiceNumber = await storage.getNextInvoiceNumber();
    
    const taxRate = 21;
    const subtotalCents = Math.round(pricePaidCents / (1 + taxRate / 100));
    const taxCents = pricePaidCents - subtotalCents;
    
    const billingSnapshot = billingProfile ? JSON.stringify({
      legalName: billingProfile.legalName,
      companyName: billingProfile.companyName,
      taxId: billingProfile.taxId,
      address: `${billingProfile.addressLine1}${billingProfile.addressLine2 ? ', ' + billingProfile.addressLine2 : ''}, ${billingProfile.postalCode} ${billingProfile.city}, ${billingProfile.country}`
    }) : null;

    const invoice = await storage.createInvoice({
      invoiceNumber,
      userId,
      purchaseId,
      subscriptionId: null,
      type: "PURCHASE",
      status: "PAID",
      issueDate: new Date(),
      dueDate: new Date(),
      subtotalCents,
      taxCents,
      taxRate,
      totalCents: pricePaidCents,
      currency,
      billingSnapshot,
      sellerInfo: JSON.stringify(SELLER_INFO),
      paymentMethod: "paypal",
      pdfPath: null,
      pdfStatus: "PENDING"
    });

    await storage.createInvoiceLineItem({
      invoiceId: invoice.id,
      description: `Audiolibro: ${audiobook.title}`,
      quantity: 1,
      unitPriceCents: subtotalCents,
      taxRate,
      totalCents: pricePaidCents
    });

    const pdfPath = await this.generatePDF(invoice.id);
    await storage.updateInvoicePdfPath(invoice.id, pdfPath);

    return invoice;
  }

  async createSubscriptionInvoice(
    userId: string,
    subscriptionId: string,
    plan: SubscriptionPlan,
    currency: string
  ): Promise<Invoice> {
    const billingProfile = await storage.getBillingProfile(userId);
    const invoiceNumber = await storage.getNextInvoiceNumber();
    
    const taxRate = 21;
    const subtotalCents = Math.round(plan.priceCents / (1 + taxRate / 100));
    const taxCents = plan.priceCents - subtotalCents;
    
    const billingSnapshot = billingProfile ? JSON.stringify({
      legalName: billingProfile.legalName,
      companyName: billingProfile.companyName,
      taxId: billingProfile.taxId,
      address: `${billingProfile.addressLine1}${billingProfile.addressLine2 ? ', ' + billingProfile.addressLine2 : ''}, ${billingProfile.postalCode} ${billingProfile.city}, ${billingProfile.country}`
    }) : null;

    const invoice = await storage.createInvoice({
      invoiceNumber,
      userId,
      purchaseId: null,
      subscriptionId,
      type: "SUBSCRIPTION",
      status: "PAID",
      issueDate: new Date(),
      dueDate: new Date(),
      subtotalCents,
      taxCents,
      taxRate,
      totalCents: plan.priceCents,
      currency,
      billingSnapshot,
      sellerInfo: JSON.stringify(SELLER_INFO),
      paymentMethod: "paypal",
      pdfPath: null,
      pdfStatus: "PENDING"
    });

    const intervalText = plan.intervalMonths === 1 ? "mensual" : `${plan.intervalMonths} meses`;
    await storage.createInvoiceLineItem({
      invoiceId: invoice.id,
      description: `Suscripcion ${plan.name} (${intervalText})`,
      quantity: 1,
      unitPriceCents: subtotalCents,
      taxRate,
      totalCents: plan.priceCents
    });

    const pdfPath = await this.generatePDF(invoice.id);
    await storage.updateInvoicePdfPath(invoice.id, pdfPath);

    return invoice;
  }

  async generatePDF(invoiceId: string): Promise<string> {
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const lineItems = await storage.getInvoiceLineItems(invoiceId);
    const billingInfo = invoice.billingSnapshot ? JSON.parse(invoice.billingSnapshot) : null;
    const sellerInfo = invoice.sellerInfo ? JSON.parse(invoice.sellerInfo) : SELLER_INFO;

    const fileName = `${invoice.invoiceNumber}.pdf`;
    const filePath = path.join(INVOICES_DIR, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);

      doc.fontSize(24).fillColor('#7C3AED').text('AUDIVIA', 50, 50);
      doc.fontSize(10).fillColor('#666').text('Premium Audiobooks', 50, 80);

      doc.fontSize(20).fillColor('#333').text('FACTURA', 400, 50, { align: 'right' });
      doc.fontSize(10).fillColor('#666').text(invoice.invoiceNumber, 400, 75, { align: 'right' });

      doc.moveTo(50, 110).lineTo(550, 110).stroke('#ddd');

      doc.fontSize(10).fillColor('#333');
      doc.text('Vendedor:', 50, 130);
      doc.fillColor('#666');
      doc.text(sellerInfo.name, 50, 145);
      doc.text(`NIF: ${sellerInfo.taxId}`, 50, 160);
      doc.text(sellerInfo.address, 50, 175);
      doc.text(sellerInfo.email, 50, 190);

      doc.fillColor('#333').text('Cliente:', 300, 130);
      doc.fillColor('#666');
      if (billingInfo) {
        doc.text(billingInfo.legalName, 300, 145);
        if (billingInfo.companyName) {
          doc.text(billingInfo.companyName, 300, 160);
        }
        if (billingInfo.taxId) {
          doc.text(`NIF/CIF: ${billingInfo.taxId}`, 300, billingInfo.companyName ? 175 : 160);
        }
        doc.text(billingInfo.address, 300, billingInfo.taxId ? 190 : 175);
      } else {
        doc.text('Consumidor final', 300, 145);
      }

      doc.fillColor('#333').text('Fecha de emision:', 50, 230);
      doc.fillColor('#666').text(new Date(invoice.issueDate).toLocaleDateString('es-ES'), 150, 230);
      
      doc.fillColor('#333').text('Metodo de pago:', 300, 230);
      doc.fillColor('#666').text('PayPal', 400, 230);

      const tableTop = 280;
      doc.fillColor('#7C3AED').rect(50, tableTop, 500, 25).fill();
      doc.fillColor('#fff').fontSize(10);
      doc.text('Descripcion', 60, tableTop + 8);
      doc.text('Cant.', 350, tableTop + 8);
      doc.text('Precio', 400, tableTop + 8);
      doc.text('Total', 480, tableTop + 8);

      let yPos = tableTop + 35;
      doc.fillColor('#333');
      
      for (const item of lineItems) {
        doc.text(item.description, 60, yPos, { width: 280 });
        doc.text(String(item.quantity), 350, yPos);
        doc.text(this.formatCurrency(item.unitPriceCents, invoice.currency), 400, yPos);
        doc.text(this.formatCurrency(item.totalCents, invoice.currency), 480, yPos);
        yPos += 25;
      }

      doc.moveTo(50, yPos + 10).lineTo(550, yPos + 10).stroke('#ddd');

      yPos += 30;
      doc.fillColor('#666').text('Subtotal:', 380, yPos);
      doc.text(this.formatCurrency(invoice.subtotalCents, invoice.currency), 480, yPos);
      
      yPos += 20;
      doc.text(`IVA (${invoice.taxRate}%):`, 380, yPos);
      doc.text(this.formatCurrency(invoice.taxCents, invoice.currency), 480, yPos);
      
      yPos += 25;
      doc.fillColor('#7C3AED').fontSize(12).text('TOTAL:', 380, yPos);
      doc.text(this.formatCurrency(invoice.totalCents, invoice.currency), 480, yPos);

      doc.fontSize(8).fillColor('#999');
      doc.text('Gracias por su compra. Esta factura ha sido generada automaticamente.', 50, 700, { align: 'center' });
      doc.text('Para cualquier consulta, contacte con billing@audivia.com', 50, 715, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', reject);
    });
  }

  private formatCurrency(cents: number, currency: string): string {
    const amount = cents / 100;
    const symbol = currency === 'EUR' ? 'EUR' : currency === 'USD' ? '$' : currency;
    return `${amount.toFixed(2)} ${symbol}`;
  }

  getInvoicePath(invoiceNumber: string): string {
    return path.join(INVOICES_DIR, `${invoiceNumber}.pdf`);
  }

  invoiceExists(invoiceNumber: string): boolean {
    return fs.existsSync(this.getInvoicePath(invoiceNumber));
  }
}

export const invoiceService = new InvoiceService();
