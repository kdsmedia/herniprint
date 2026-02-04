
export type PaperSize = '58' | '80';

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface ShippingData {
  toName: string;
  toPhone: string;
  toAddress: string;
  fromName: string;
  courier: string;
}

export enum ModalType {
  NONE,
  SHIPPING,
  RECEIPT,
  SETTINGS,
  SCANNER,
  QR_GEN,
  BARCODE_GEN,
  AI_SCAN
}

export interface ThermalOptions {
  paperSize: PaperSize;
  rotation: number;
  scale: number;
}
