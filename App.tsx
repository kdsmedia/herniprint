
import React, { useState, useRef, useEffect } from 'react';
import { 
  Printer, Settings, Image as ImageIcon, FileText, QrCode, Barcode, 
  Truck, ShoppingBag, Plus, Minus, RotateCw, X, ChevronRight, 
  Bluetooth, Trash2, Camera, Loader2, Info,
  CheckCircle2, Smartphone, DownloadCloud, ShieldCheck, MapPin,
  Usb, ExternalLink, MessageCircle, AlertTriangle, ArrowLeft,
  Moon, Sun, Share2, Save, Star, Type as TypeIcon, Send, FileWarning, Shield,
  History, TrendingUp, Calendar, RefreshCw, ScanLine, XCircle, Link, Link2Off
} from 'lucide-react';
import { PaperSize, ModalType, ShippingData, ReceiptItem, ReceiptFont, Transaction } from './types';
import { printerService } from './services/bluetoothService';
import { usbService } from './services/usbService';
import { processToThermal } from './utils/thermalProcessor';
import * as htmlToImage from 'html-to-image';

type AlertType = 'success' | 'error' | 'info';

interface AlertState {
  title: string;
  msg: string;
  type: AlertType;
}

const App: React.FC = () => {
  // UI State
  const [activeModal, setActiveModal] = useState<ModalType>(ModalType.NONE);
  const [paperSize, setPaperSize] = useState<PaperSize>('58');
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [previewContent, setPreviewContent] = useState<React.ReactNode | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [currentTxId, setCurrentTxId] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState("Not Connected");
  const [activeConnectionType, setActiveConnectionType] = useState<'bluetooth' | 'usb' | 'none'>('none');
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
  
  // Branding & Typography State
  const [shopName, setShopName] = useState(() => localStorage.getItem('shopName') || "HERNI STORE");
  const [shopLogo, setShopLogo] = useState(() => localStorage.getItem('shopLogo') || "");
  const [shopFooter, setShopFooter] = useState(() => localStorage.getItem('shopFooter') || "Terima Kasih Telah Berbelanja!");
  const [receiptFont, setReceiptFont] = useState<ReceiptFont>(() => (localStorage.getItem('receiptFont') as ReceiptFont) || 'monospace');
  
  // Data State
  const [qrInput, setQrInput] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [shippingForm, setShippingForm] = useState<ShippingData>({
    toName: '', toPhone: '', toAddress: '', fromName: '', courier: ''
  });
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  
  // PERSISTENT INPUT STATE (Auto-save)
  const [receiptInput, setReceiptInput] = useState(() => {
    const saved = localStorage.getItem('activeReceiptInput');
    return saved ? JSON.parse(saved) : { name: '', price: '', qty: '1' };
  });

  // Scanner State Integration
  const [isScanningForReceipt, setIsScanningForReceipt] = useState(false);
  const [scannedItemBuffer, setScannedItemBuffer] = useState<{name: string, price: string, qty: string} | null>(null);

  const [favorites, setFavorites] = useState<ReceiptItem[]>(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactionHistory');
    return saved ? JSON.parse(saved) : [];
  });

  // PWA Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Refs
  const captureRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const PAPER_WIDTH = paperSize === '58' ? 384 : 576;

  // Effects
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Auto-save Receipt Input
  useEffect(() => {
    localStorage.setItem('activeReceiptInput', JSON.stringify(receiptInput));
  }, [receiptInput]);

  useEffect(() => {
    localStorage.setItem('shopName', shopName);
    localStorage.setItem('shopLogo', shopLogo);
    localStorage.setItem('shopFooter', shopFooter);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    localStorage.setItem('receiptFont', receiptFont);
    localStorage.setItem('transactionHistory', JSON.stringify(transactionHistory));
  }, [shopName, shopLogo, shopFooter, favorites, receiptFont, transactionHistory]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Utility Functions
  const triggerAlert = (title: string, msg: string, type: AlertType = 'info') => setAlert({ title, msg, type });
  const getReceiptFontClass = () => `receipt-font-${receiptFont}`;

  const handlePrint = async () => {
    const currentService = activeConnectionType === 'usb' ? usbService : printerService;
    if (!currentService.isConnected()) {
      triggerAlert("Printer", "Hubungkan printer terlebih dahulu.", 'error');
      return;
    }
    if (!captureRef.current) return;
    setIsPrinting(true);
    try {
      const canvas = await htmlToImage.toCanvas(captureRef.current, { 
        backgroundColor: '#ffffff', pixelRatio: 3,
        style: { filter: 'contrast(1.2) brightness(1.0)' }
      });
      const thermalData = processToThermal(canvas, PAPER_WIDTH);
      await currentService.print(thermalData);
      setShowPrintConfirm(true);
    } catch (e) {
      triggerAlert("Eror", "Gagal memproses cetakan.", 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDisconnect = async () => {
    if (activeConnectionType === 'usb') {
      await usbService.disconnect();
    }
    setActiveConnectionType('none');
    setPrinterName("Not Connected");
    triggerAlert("Status", "Printer diputuskan.", "info");
  };

  const updateTransactionStatus = (id: string | null, status: 'success' | 'failed') => {
    if (!id) return;
    setTransactionHistory(prev => prev.map(tx => tx.id === id ? { ...tx, status } : tx));
  };

  const handleShareWhatsApp = async () => {
    if (!captureRef.current) return;
    triggerAlert("Digital Struk", "Menyiapkan struk digital...", "info");
    try {
      const dataUrl = await htmlToImage.toPng(captureRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'struk-pembayaran.png', { type: 'image/png' });
      
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'Struk Pembayaran',
          text: `Struk dari ${shopName}`
        });
      } else {
        triggerAlert("Gagal", "Browser tidak mendukung sharing file.", "error");
      }
    } catch (e) {
      triggerAlert("Error", "Gagal memproses gambar untuk sharing.", "error");
    }
  };

  const generateReceiptPreview = (items: ReceiptItem[], total: number, timestamp: number, isReprint = false) => {
    const date = new Date(timestamp);
    setPreviewContent(
      <div className={`${getReceiptFontClass()} text-black bg-white p-6 w-full text-center leading-tight`}>
        {shopLogo && <img src={shopLogo} className="w-20 h-20 mx-auto mb-3 object-contain" />}
        <p className="text-2xl font-black italic uppercase mb-1 tracking-tight">{shopName}</p>
        <div className="text-[10px] font-bold mb-4 flex justify-between px-2 border-b-2 border-dashed border-black pb-1">
          <span>{date.toLocaleDateString('id-ID')}</span>
          <span>{date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {isReprint && <p className="text-[10px] font-black border-2 border-black inline-block px-2 mb-4">CETAK ULANG</p>}
        <div className="border-b-2 border-dashed border-black py-3 mb-4 space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-[12px] font-bold text-left">
              <span className="flex-1 pr-4 truncate">{item.name} x{item.qty}</span>
              <span className="shrink-0">{(item.price * item.qty).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xl font-black uppercase mb-6">
          <span>Total</span>
          <span>{total.toLocaleString()}</span>
        </div>
        <p className="text-[11px] font-bold text-slate-900 mt-4 border-t-2 border-dashed border-black pt-4 uppercase leading-snug">{shopFooter}</p>
        <p className="text-[8px] font-black text-slate-400 mt-4 tracking-widest uppercase italic border-t border-slate-100 pt-2">HerniPrint PRO System</p>
      </div>
    );
    setRotation(0); setScale(1);
  };

  const saveTransaction = (items: ReceiptItem[]) => {
    const total = items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    const newTxId = Math.random().toString(36).substr(2, 9);
    const newTransaction: Transaction = {
      id: newTxId,
      timestamp: Date.now(),
      items: [...items],
      total,
      status: 'pending'
    };
    setTransactionHistory([newTransaction, ...transactionHistory.slice(0, 49)]); // Keep last 50
    return newTxId;
  };

  const getTodayTotal = () => {
    const today = new Date().setHours(0,0,0,0);
    return transactionHistory
      .filter(t => new Date(t.timestamp).setHours(0,0,0,0) === today && t.status !== 'failed')
      .reduce((acc, curr) => acc + curr.total, 0);
  };

  // HANDLER FOR SCANNER DETECTION
  const handleScanDetected = (code: string) => {
    if (isScanningForReceipt) {
      setScannedItemBuffer({ name: code, price: '', qty: '1' });
      setActiveModal(ModalType.NONE); // Close scanner to show confirmation
    } else {
      setBarcodeInput(code);
      setActiveModal(ModalType.NONE);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col max-w-md mx-auto transition-all duration-500 relative overflow-hidden ${darkMode ? 'bg-slate-950 text-white' : 'bg-white shadow-2xl text-slate-900'}`}>
      
      {/* Header */}
      <header className={`px-5 pt-10 pb-5 flex justify-between items-center border-b sticky top-0 z-20 transition-colors ${darkMode ? 'bg-slate-950/80 border-slate-800 backdrop-blur-md' : 'bg-white/80 border-slate-100 backdrop-blur-md'}`}>
        <div>
          <h1 className="text-2xl font-black text-blue-600 tracking-tighter italic">HERNI<span className={darkMode ? 'text-white' : 'text-slate-900'}>PRINT</span><span className="text-[10px] ml-1 px-1 bg-blue-100 rounded text-blue-600">PRO</span></h1>
          <div className="flex items-center gap-1.5 mt-0.5">
             <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeConnectionType === 'none' ? 'bg-slate-300' : activeConnectionType === 'bluetooth' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} />
             <p className={`text-[9px] font-bold uppercase tracking-[0.2em] ${activeConnectionType === 'none' ? 'text-slate-400' : activeConnectionType === 'bluetooth' ? 'text-blue-500' : 'text-emerald-500'}`}>
                {activeConnectionType === 'none' ? 'Disconnected' : activeConnectionType === 'bluetooth' ? `BT: ${printerName}` : `USB: ${printerName}`}
             </p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setDarkMode(!darkMode)} className={`p-2.5 rounded-2xl transition active:scale-90 ${darkMode ? 'bg-slate-900 text-yellow-400' : 'bg-slate-50 text-slate-600'}`}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
           <button onClick={() => setActiveModal(ModalType.SETTINGS)} className={`p-2.5 rounded-2xl transition active:scale-90 relative ${darkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
              <Settings className="w-5 h-5" />
              {activeConnectionType !== 'none' && <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />}
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 space-y-6 overflow-y-auto">
        <div className={`flex gap-2 p-1 rounded-2xl transition-colors ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          {['58', '80'].map(sz => (
            <button key={sz} onClick={() => setPaperSize(sz as any)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${paperSize === sz ? (darkMode ? 'bg-slate-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500'}`}>{sz}mm</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'upload', icon: ImageIcon, label: 'Foto', color: 'blue', action: () => fileInputRef.current?.click() },
            { id: 'pdf', icon: FileText, label: 'PDF', color: 'red', action: () => pdfInputRef.current?.click() },
            { id: 'qr', icon: QrCode, label: 'QR', color: 'emerald', action: () => setActiveModal(ModalType.QR_GEN) },
            { id: 'barcode', icon: Barcode, label: 'Barcode', color: 'indigo', action: () => setActiveModal(ModalType.BARCODE_GEN) },
            { id: 'scan', icon: Camera, label: 'Scan', color: 'purple', action: () => { setIsScanningForReceipt(false); setActiveModal(ModalType.SCANNER); } },
            { id: 'history', icon: History, label: 'Riwayat', color: 'orange', action: () => setActiveModal(ModalType.HISTORY) },
          ].map((btn) => (
            <button key={btn.id} onClick={btn.action} className={`p-4 border transition-all flex flex-col items-center gap-2 active:scale-95 rounded-3xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                btn.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' :
                btn.color === 'red' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' :
                btn.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
                btn.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' :
                btn.color === 'purple' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' :
                'bg-orange-50 dark:bg-orange-900/20 text-orange-600'
              }`}><btn.icon className="w-5 h-5" /></div>
              <span className={`text-[10px] font-black uppercase ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{btn.label}</span>
            </button>
          ))}
        </div>

        <button onClick={() => setActiveModal(ModalType.SHIPPING)} className="w-full p-5 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-between shadow-xl active:scale-[0.98] transition">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Truck className="w-6 h-6" /></div>
            <div className="text-left"><span className="block text-sm font-black uppercase">Label Paket</span><span className="block text-[10px] opacity-70">Manual Label Maker</span></div>
          </div>
          <ChevronRight className="w-5 h-5 opacity-50" />
        </button>

        <button onClick={() => setActiveModal(ModalType.RECEIPT)} className={`w-full p-6 text-white rounded-[2rem] flex items-center justify-between active:scale-95 transition shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-900'}`}>
          <div className="flex items-center gap-4">
            <div className="bg-orange-500 p-3 rounded-2xl"><ShoppingBag className="w-6 h-6" /></div>
            <div className="text-left"><span className="block text-sm font-black uppercase">Kasir Pintar</span><span className="block text-[10px] text-slate-400">Pilih Produk & Cetak</span></div>
          </div>
          <Plus className="w-4 h-4" />
        </button>
        
        <div className="pb-10" />
      </main>

      {/* PREVIEW MODAL */}
      {previewContent && (
        <div className="fixed inset-0 bg-slate-950 z-[500] flex flex-col animate-in fade-in zoom-in duration-300">
          <div className="p-6 flex justify-between items-center bg-slate-950 text-white border-b border-slate-900">
            <button onClick={() => { setPreviewContent(null); setCurrentTxId(null); }} className="flex items-center gap-2 text-sm font-black uppercase italic tracking-tighter hover:text-blue-400 transition">
              <ArrowLeft className="w-5 h-5" /> Kembali
            </button>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preview Cetak</p>
              <p className="text-xs font-bold text-blue-400">{paperSize}mm Thermal Paper</p>
            </div>
            <button onClick={() => { setPreviewContent(null); setCurrentTxId(null); }} className="p-2 bg-slate-900 rounded-full"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-auto p-10 flex flex-col items-center justify-center relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
             <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              <button onClick={() => setRotation(r => (r + 90) % 360)} className="w-12 h-12 bg-white/10 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center border border-white/10 shadow-xl"><RotateCw className="w-5 h-5" /></button>
              <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="w-12 h-12 bg-white/10 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center border border-white/10 shadow-xl"><Plus className="w-5 h-5" /></button>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="w-12 h-12 bg-white/10 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center border border-white/10 shadow-xl"><Minus className="w-5 h-5" /></button>
            </div>

            <div className="bg-white shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden transform-gpu" style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}>
              <div ref={captureRef} style={{ width: paperSize === '58' ? '384px' : '576px', backgroundColor: 'white' }} className="transition-all">
                {previewContent}
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-950 border-t border-slate-900 flex gap-4">
             <button onClick={handleShareWhatsApp} className="flex-1 py-5 bg-emerald-600 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg active:scale-95 transition">
                <Share2 className="w-4 h-4" /> WhatsApp
             </button>
             <button onClick={handlePrint} disabled={isPrinting} className="flex-[2] py-5 bg-blue-600 disabled:bg-blue-400 text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center gap-3 active:scale-95 transition-all">
                {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                {isPrinting ? 'Mencetak...' : 'Print Ke Printer'}
             </button>
          </div>
        </div>
      )}

      {/* PRINT SUCCESS CONFIRMATION DIALOG */}
      {showPrintConfirm && (
        <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in duration-300">
           <div className={`w-full max-w-sm p-8 rounded-[2.5rem] space-y-6 text-center ${darkMode ? 'bg-slate-900' : 'bg-white shadow-2xl'}`}>
              <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20 text-white"><Printer className="w-10 h-10" /></div>
              <div>
                 <h3 className="text-xl font-black uppercase italic tracking-tighter">Konfirmasi Cetak</h3>
                 <p className="text-xs font-bold text-slate-400 mt-2">Apakah printer berhasil mencetak dengan benar?</p>
              </div>
              <div className="space-y-3">
                 <button onClick={() => { 
                   updateTransactionStatus(currentTxId, 'success');
                   setShowPrintConfirm(false); setPreviewContent(null); setCurrentTxId(null);
                   triggerAlert("Selesai", "Transaksi berhasil dicetak", "success");
                 }} className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 transition shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5" /> Ya, Berhasil
                 </button>
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setShowPrintConfirm(false); handlePrint(); }} className={`py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-800' : 'bg-slate-100 text-blue-600'}`}>
                       <RefreshCw className="w-4 h-4" /> Coba Lagi
                    </button>
                    <button onClick={() => { 
                      updateTransactionStatus(currentTxId, 'failed');
                      setShowPrintConfirm(false); setPreviewContent(null); setCurrentTxId(null);
                      triggerAlert("Gagal", "Transaksi ditandai gagal", "error");
                    }} className="py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                       <XCircle className="w-4 h-4" /> Gagal/Eror
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* CONFIRM SCANNED ITEM DIALOG */}
      {scannedItemBuffer && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in duration-300">
           <div className={`w-full max-w-sm p-8 rounded-[2.5rem] space-y-6 ${darkMode ? 'bg-slate-900' : 'bg-white shadow-2xl'}`}>
              <div className="flex items-center gap-3 border-b pb-4 dark:border-slate-800">
                 <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white"><CheckCircle2 className="w-6 h-6" /></div>
                 <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400">Item Terdeteksi</h4>
                    <p className="font-black text-blue-600 italic truncate max-w-[180px]">{scannedItemBuffer.name}</p>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-1">Harga Satuan</label>
                    <input autoFocus type="number" placeholder="0" value={scannedItemBuffer.price} onChange={e => setScannedItemBuffer({...scannedItemBuffer, price: e.target.value})} className={`w-full p-4 rounded-2xl text-lg font-black outline-none ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-1">Jumlah (Qty)</label>
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl">
                       <button onClick={() => setScannedItemBuffer({...scannedItemBuffer, qty: Math.max(1, parseInt(scannedItemBuffer.qty) - 1).toString()})} className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-700 rounded-xl shadow-sm"><Minus className="w-5 h-5" /></button>
                       <input type="number" value={scannedItemBuffer.qty} onChange={e => setScannedItemBuffer({...scannedItemBuffer, qty: e.target.value})} className="flex-1 bg-transparent text-center font-black text-xl outline-none" />
                       <button onClick={() => setScannedItemBuffer({...scannedItemBuffer, qty: (parseInt(scannedItemBuffer.qty) + 1).toString()})} className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-700 rounded-xl shadow-sm"><Plus className="w-5 h-5" /></button>
                    </div>
                 </div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => { setScannedItemBuffer(null); setActiveModal(ModalType.RECEIPT); }} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>Batal</button>
                 <button onClick={() => {
                   if (scannedItemBuffer.price) {
                      const item = { id: Math.random().toString(), name: scannedItemBuffer.name, price: parseFloat(scannedItemBuffer.price), qty: parseInt(scannedItemBuffer.qty) };
                      setReceiptItems([...receiptItems, item]);
                      setScannedItemBuffer(null);
                      setActiveModal(ModalType.RECEIPT);
                      triggerAlert("Berhasil", "Item ditambahkan", "success");
                   }
                 }} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-600/20 active:scale-95 transition">Tambahkan</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL RIWAYAT & LAPORAN */}
      {activeModal === ModalType.HISTORY && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-end justify-center backdrop-blur-sm">
           <div className={`w-full rounded-t-[3rem] p-8 space-y-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto transition-colors ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
              <div className="flex justify-between items-center border-b pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500 rounded-xl text-white"><History className="w-5 h-5" /></div>
                  <h3 className="font-black text-xl tracking-tighter uppercase italic">Riwayat & Laporan</h3>
                </div>
                <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full active:scale-90 transition ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}><X className="w-5 h-5" /></button>
              </div>

              <div className={`p-6 rounded-[2rem] border flex items-center justify-between ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hari Ini</p>
                    <p className="text-2xl font-black text-emerald-500 italic tracking-tighter">Rp {getTodayTotal().toLocaleString()}</p>
                 </div>
                 <button onClick={() => {
                   const today = new Date().toLocaleDateString('id-ID');
                   const total = getTodayTotal();
                   setPreviewContent(
                     <div className={`${getReceiptFontClass()} text-black bg-white p-10 w-full text-center`}>
                        <p className="text-2xl font-black italic uppercase mb-1">{shopName}</p>
                        <p className="text-[10px] font-black uppercase border-y-2 border-black py-2 my-4 tracking-widest">LAPORAN PENJUALAN HARIAN</p>
                        <div className="flex justify-between text-xs font-bold mb-6">
                           <span>Tanggal</span>
                           <span>{today}</span>
                        </div>
                        <div className="flex justify-between text-xl font-black border-t-2 border-dashed border-black pt-4">
                           <span>OMZET</span>
                           <span>Rp {total.toLocaleString()}</span>
                        </div>
                        <p className="text-[8px] font-black mt-10 opacity-40 uppercase">Dibuat otomatis oleh HerniPrint PRO</p>
                     </div>
                   );
                   setActiveModal(ModalType.NONE);
                 }} className="p-4 bg-emerald-600 text-white rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase shadow-lg shadow-emerald-600/20 active:scale-95 transition">
                    <TrendingUp className="w-4 h-4" /> Cetak Laporan
                 </button>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">50 Transaksi Terakhir</p>
                {transactionHistory.length === 0 ? (
                  <div className="py-10 text-center opacity-30 flex flex-col items-center gap-2">
                    <Calendar className="w-10 h-10" />
                    <p className="text-xs font-bold uppercase">Belum ada transaksi</p>
                  </div>
                ) : (
                  transactionHistory.map(t => (
                    <div key={t.id} className={`p-4 rounded-3xl border flex items-center justify-between group transition-all ${darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700/50' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-xl'}`}>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {new Date(t.timestamp).toLocaleDateString('id-ID')}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black italic tracking-tighter">Rp {t.total.toLocaleString()}</p>
                            {t.status === 'failed' && <span className="text-[8px] px-1 bg-rose-500 text-white rounded font-black">GAGAL</span>}
                            {t.status === 'success' && <span className="text-[8px] px-1 bg-emerald-500 text-white rounded font-black">OK</span>}
                          </div>
                          <p className="text-[9px] font-bold text-blue-500 uppercase">{t.items.length} Item</p>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => {
                            setTransactionHistory(transactionHistory.filter(item => item.id !== t.id));
                          }} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl active:scale-90 transition"><Trash2 className="w-4 h-4" /></button>
                          <button onClick={() => {
                            setCurrentTxId(t.id);
                            generateReceiptPreview(t.items, t.total, t.timestamp, true);
                            setActiveModal(ModalType.NONE);
                          }} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 active:scale-90 transition"><RefreshCw className="w-4 h-4" /></button>
                       </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pb-6" />
           </div>
        </div>
      )}

      {/* KASIR PINTAR MODAL */}
      {activeModal === ModalType.RECEIPT && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end justify-center animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-t-[2.5rem] overflow-hidden flex flex-col max-h-[95vh] ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'bg-orange-950/20 border-slate-900' : 'bg-orange-50/50'}`}>
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-orange-500 rounded-xl text-white"><ShoppingBag className="w-5 h-5" /></div>
                 <h3 className="font-black text-orange-700 dark:text-orange-400 uppercase tracking-tighter">Kasir Pintar</h3>
              </div>
              <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full ${darkMode ? 'bg-slate-900' : 'bg-white'}`}><X className="w-5 h-5 text-orange-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
               <div className="space-y-3">
                <div className="relative group">
                   <input value={receiptInput.name} onChange={e => setReceiptInput({...receiptInput, name: e.target.value})} placeholder="Nama Item" className={`w-full p-4 pr-14 rounded-2xl text-sm font-semibold outline-none border-2 border-transparent focus:border-orange-500/20 transition-all ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`} />
                   <button onClick={() => { setIsScanningForReceipt(true); setActiveModal(ModalType.SCANNER); }} className="absolute right-2 top-2 p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 text-blue-600 active:scale-90 transition"><Camera className="w-5 h-5" /></button>
                </div>
                <div className="flex gap-2">
                  <input value={receiptInput.price} onChange={e => setReceiptInput({...receiptInput, price: e.target.value})} placeholder="Harga" type="number" className={`flex-1 p-4 rounded-2xl text-sm font-semibold outline-none ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`} />
                  <input value={receiptInput.qty} onChange={e => setReceiptInput({...receiptInput, qty: e.target.value})} placeholder="Qty" type="number" className={`w-20 p-4 rounded-2xl text-sm font-semibold outline-none text-center ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`} />
                </div>
                <button onClick={() => {
                  const item = { id: Math.random().toString(), name: receiptInput.name, price: parseFloat(receiptInput.price), qty: parseInt(receiptInput.qty) };
                  if (item.name && item.price) setReceiptItems([...receiptItems, item]);
                  setReceiptInput({ name: '', price: '', qty: '1' });
                }} className="w-full py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition shadow-lg">Tambah Item</button>
              </div>
              
              <div className="space-y-2 mt-4 border-t pt-4 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Daftar Belanja</p>
                {receiptItems.length === 0 ? (
                  <div className="py-6 text-center opacity-20"><Plus className="w-8 h-8 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Belum ada item</p></div>
                ) : (
                  receiptItems.map(item => (
                    <div key={item.id} className={`flex justify-between items-center p-3 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex-1"><p className="text-xs font-black uppercase italic tracking-tighter">{item.name}</p><p className="text-[10px] text-slate-400 font-bold">{item.qty} x Rp {item.price.toLocaleString()}</p></div>
                      <button onClick={() => setReceiptItems(receiptItems.filter(i => i.id !== item.id))} className="text-rose-500 p-2.5 bg-rose-500/5 rounded-xl active:scale-90 transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className={`p-6 border-t ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <button disabled={receiptItems.length === 0} onClick={() => {
                const total = receiptItems.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
                const txId = saveTransaction(receiptItems);
                setCurrentTxId(txId);
                generateReceiptPreview(receiptItems, total, Date.now());
                setActiveModal(ModalType.NONE);
                setReceiptItems([]);
              }} className="w-full py-5 bg-orange-600 disabled:opacity-50 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs active:scale-95 transition shadow-[0_10px_30px_rgba(234,88,12,0.3)]">Selesai & Cetak Struk</button>
            </div>
          </div>
        </div>
      )}

      {/* SCANNER MODAL INTEGRATED */}
      {activeModal === ModalType.SCANNER && (
        <div className="fixed inset-0 bg-black z-[300] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute top-10 left-10 flex items-center gap-3">
             <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-white"><Camera className="w-5 h-5" /></div>
             <p className="text-white text-xs font-black uppercase tracking-widest">Scanner HerniPrint</p>
          </div>
          <button onClick={() => setActiveModal(ModalType.NONE)} className="absolute top-10 right-10 p-3 bg-white/10 rounded-full text-white active:scale-90 transition"><X className="w-6 h-6" /></button>
          
          <div className="w-72 h-72 border-2 border-blue-500/50 rounded-[3rem] relative overflow-hidden flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="absolute inset-x-6 top-1/2 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,1)] animate-pulse" style={{ transform: 'translateY(-50%)' }} />
            <ScanLine className="w-16 h-16 text-white/10" />
            
            {/* SIMULATED SCAN BUTTONS FOR DEMO */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity bg-black/60">
               <p className="text-white text-[10px] font-black uppercase tracking-widest mb-2">Simulasikan Hasil Scan</p>
               <button onClick={() => handleScanDetected("89912345678")} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase">Item Barcode</button>
               <button onClick={() => handleScanDetected("PROMO-HEMAT-99")} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase">Item QR</button>
            </div>
          </div>
          
          <div className="mt-12 text-center space-y-2">
             <p className="text-white font-black text-sm uppercase tracking-widest animate-pulse">Menunggu Kode...</p>
             <p className="text-white/40 text-[9px] font-bold uppercase tracking-tighter">Arahkan kamera ke barcode atau QR code produk</p>
          </div>
        </div>
      )}

      {/* OTHER MODALS (QR, BARCODE, SHIPPING, SETTINGS, ETC) */}
      {activeModal === ModalType.QR_GEN && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className={`w-full rounded-[2.5rem] p-8 space-y-6 shadow-2xl ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center"><QrCode /></div>
                   <h3 className={`font-black text-xl uppercase italic tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>Generator QR</h3>
                </div>
                <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full transition ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}><X className="w-5 h-5" /></button>
             </div>
             <textarea value={qrInput} onChange={e => setQrInput(e.target.value)} placeholder="Teks atau URL..." rows={4} className={`w-full p-4 rounded-2xl outline-none font-medium text-sm border-2 border-transparent focus:border-emerald-500/30 transition-all ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50'}`} />
             <button onClick={() => {
                const now = new Date();
                const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrInput)}&format=png&ecc=H`;
                setPreviewContent(
                  <div className={`${getReceiptFontClass()} bg-white p-10 flex flex-col items-center gap-6 w-full text-center text-black`}>
                    <p className="text-sm font-black italic tracking-widest uppercase">{shopName}</p>
                    <img src={url} className="w-56 h-56 border-2 border-black p-3" alt="QR" />
                    <p className="text-[12px] font-black break-all px-6 leading-tight">{qrInput}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-4">{now.toLocaleString()}</p>
                  </div>
                );
                setActiveModal(ModalType.NONE); setRotation(0); setScale(1);
             }} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition">Buat QR Sekarang</button>
          </div>
        </div>
      )}

      {activeModal === ModalType.BARCODE_GEN && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className={`w-full rounded-[2.5rem] p-8 space-y-6 shadow-2xl ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center"><Barcode /></div>
                   <h3 className={`font-black text-xl uppercase italic tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>Barcode Gen</h3>
                </div>
                <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full transition ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}><X className="w-5 h-5" /></button>
             </div>
             <input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} placeholder="Angka atau Kode..." className={`w-full p-4 rounded-2xl outline-none font-black tracking-widest text-center border-2 border-transparent focus:border-indigo-500/30 transition-all ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50'}`} />
             <button onClick={() => {
                const now = new Date();
                const url = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeInput)}&scale=3&includetext&backgroundcolor=ffffff`;
                setPreviewContent(
                  <div className={`${getReceiptFontClass()} bg-white p-10 flex flex-col items-center gap-6 w-full text-center text-black`}>
                    <p className="text-sm font-black italic tracking-widest uppercase">{shopName}</p>
                    <img src={url} className="w-full h-auto max-w-[90%] border-2 border-black p-4" alt="Barcode" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">{now.toLocaleString()}</p>
                  </div>
                );
                setActiveModal(ModalType.NONE); setRotation(0); setScale(1);
             }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition">Buat Barcode Sekarang</button>
          </div>
        </div>
      )}

      {activeModal === ModalType.SETTINGS && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-end justify-center backdrop-blur-sm">
          <div className={`w-full rounded-t-[3rem] p-8 space-y-6 animate-in slide-in-from-bottom duration-300 max-h-[95vh] overflow-y-auto transition-colors ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="flex justify-between items-center border-b pb-4 dark:border-slate-800">
              <h3 className="font-black text-2xl tracking-tighter uppercase italic">Pengaturan</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full active:scale-90 transition ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Profil Toko & Branding</p>
              <div className="flex gap-4 items-center">
                 <div onClick={() => logoInputRef.current?.click()} className={`w-20 h-20 rounded-3xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    {shopLogo ? <img src={shopLogo} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 opacity-30" />}
                 </div>
                 <div className="flex-1 space-y-2">
                    <input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Nama Toko" className={`w-full p-3 rounded-2xl text-sm font-black outline-none ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`} />
                    <p className="text-[9px] text-slate-400 font-bold px-1 uppercase tracking-tighter">Tap kotak untuk ganti logo</p>
                 </div>
              </div>
              <textarea value={shopFooter} onChange={e => setShopFooter(e.target.value)} placeholder="Pesan Penutup Struk..." rows={2} className={`w-full p-4 rounded-2xl text-xs font-bold outline-none ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`} />
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Koneksi Hardware</p>
              
              <div className="flex flex-col gap-2">
                 <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${activeConnectionType === 'bluetooth' ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-500/20' : darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                    <div className="flex items-center gap-4">
                       <Bluetooth className={activeConnectionType === 'bluetooth' ? 'text-white' : 'text-blue-500'} />
                       <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Bluetooth</p>
                          <p className="text-sm font-black truncate max-w-[150px]">{activeConnectionType === 'bluetooth' ? printerName : 'Disconnected'}</p>
                       </div>
                    </div>
                    {activeConnectionType === 'bluetooth' ? (
                       <button onClick={handleDisconnect} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition"><Link2Off className="w-4 h-4" /></button>
                    ) : (
                       <button onClick={async () => {
                         try {
                           const name = await printerService.connect();
                           setPrinterName(name); setActiveConnectionType('bluetooth');
                           triggerAlert("Berhasil", `Bluetooth: ${name}`, "success");
                         } catch(e) { triggerAlert("Bluetooth", "Gagal menghubungkan.", "error"); }
                       }} className={`p-2 rounded-xl transition ${darkMode ? 'bg-slate-700 text-white' : 'bg-white text-blue-600 shadow-sm'}`}><Link className="w-4 h-4" /></button>
                    )}
                 </div>

                 <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${activeConnectionType === 'usb' ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-500/20' : darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                    <div className="flex items-center gap-4">
                       <Usb className={activeConnectionType === 'usb' ? 'text-white' : 'text-emerald-500'} />
                       <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">USB Cable</p>
                          <p className="text-sm font-black truncate max-w-[150px]">{activeConnectionType === 'usb' ? printerName : 'Disconnected'}</p>
                       </div>
                    </div>
                    {activeConnectionType === 'usb' ? (
                       <button onClick={handleDisconnect} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition"><Link2Off className="w-4 h-4" /></button>
                    ) : (
                       <button onClick={async () => {
                         try {
                           const name = await usbService.connect();
                           setPrinterName(name); setActiveConnectionType('usb');
                           triggerAlert("Berhasil", `USB: ${name}`, "success");
                         } catch(e) { triggerAlert("USB", "Gagal menghubungkan.", "error"); }
                       }} className={`p-2 rounded-xl transition ${darkMode ? 'bg-slate-700 text-white' : 'bg-white text-emerald-600 shadow-sm'}`}><Link className="w-4 h-4" /></button>
                    )}
                 </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t dark:border-slate-800">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Bantuan & Legal</p>
               <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => setActiveModal(ModalType.ABOUT)} className={`w-full p-4 flex items-center justify-between rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-3"><Info className="w-4 h-4 text-blue-500" /><span className="text-xs font-bold">Tentang Aplikasi</span></div>
                    <ChevronRight className="w-4 h-4 opacity-30" />
                  </button>
                  <button onClick={() => setActiveModal(ModalType.PRIVACY)} className={`w-full p-4 flex items-center justify-between rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-3"><Shield className="w-4 h-4 text-emerald-500" /><span className="text-xs font-bold">Kebijakan Privasi</span></div>
                    <ChevronRight className="w-4 h-4 opacity-30" />
                  </button>
                  <a href="https://t.me/yourtelegramlink" target="_blank" className="w-full p-4 flex items-center justify-between rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/20 active:scale-95 transition">
                    <div className="flex items-center gap-3"><Send className="w-4 h-4" /><span className="text-xs font-black uppercase italic tracking-tighter">Bantuan Telegram</span></div>
                    <ExternalLink className="w-4 h-4 opacity-50" />
                  </a>
               </div>
            </div>

            <div className="pb-6" />
          </div>
        </div>
      )}

      {/* TOASTS & HIDDEN INPUTS */}
      {alert && (
        <div className="fixed top-10 left-0 right-0 z-[1000] px-6 flex justify-center animate-in slide-in-from-top-full duration-500">
          <div className={`max-w-xs w-full flex items-center gap-4 p-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border ${alert.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/30' : alert.type === 'error' ? 'bg-rose-500/90 border-rose-400/30' : 'bg-slate-900/90 border-slate-700/30'}`}>
            <div className="shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white"><Info className="w-5 h-5" /></div>
            <div className="flex-1 text-white text-[10px] font-black uppercase tracking-wider">{alert.msg}</div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={e => {
         const file = e.target.files?.[0]; if (!file) return;
         const reader = new FileReader();
         reader.onload = (ev) => {
           setPreviewContent(<div className="bg-white p-2"><img src={ev.target?.result as string} className="w-full block" alt="Upload" /></div>);
           setRotation(0); setScale(1);
         };
         reader.readAsDataURL(file);
      }} />
      <input ref={pdfInputRef} type="file" className="hidden" accept="application/pdf" onChange={e => {
         triggerAlert("PDF", "File PDF diterima.", "info");
      }} />
      <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={e => {
         const file = e.target.files?.[0]; if (!file) return;
         const reader = new FileReader();
         reader.onload = (ev) => setShopLogo(ev.target?.result as string);
         reader.readAsDataURL(file);
      }} />
    </div>
  );
};

export default App;
