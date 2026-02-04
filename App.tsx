
import React, { useState, useRef, useEffect } from 'react';
import { 
  Printer, Settings, Image as ImageIcon, FileText, QrCode, Barcode, 
  Truck, ShoppingBag, Plus, Minus, RotateCw, X, ChevronRight, 
  Bluetooth, Trash2, Camera, Loader2, Info,
  CheckCircle2, Smartphone, DownloadCloud, ShieldCheck, MapPin,
  Usb, ExternalLink, Sparkles, MessageCircle, AlertTriangle, ArrowLeft,
  Moon, Sun
} from 'lucide-react';
import { PaperSize, ModalType, ShippingData, ReceiptItem } from './types';
import { printerService } from './services/bluetoothService';
import { usbService } from './services/usbService';
import { extractShippingData, extractReceiptData } from './services/geminiService';
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
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [printerName, setPrinterName] = useState("Not Connected");
  const [activeConnectionType, setActiveConnectionType] = useState<'bluetooth' | 'usb' | 'none'>('none');
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  
  // Data State
  const [qrInput, setQrInput] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [shippingForm, setShippingForm] = useState<ShippingData>({
    toName: '', toPhone: '', toAddress: '', fromName: '', courier: ''
  });
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [receiptInput, setReceiptInput] = useState({ name: '', price: '', qty: '1' });

  // PWA & Permissions
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [permissions, setPermissions] = useState({ camera: 'prompt', location: 'prompt' });

  // Refs
  const captureRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

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
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Basic Functions
  const triggerAlert = (title: string, msg: string, type: AlertType = 'info') => {
    setAlert({ title, msg, type });
  };

  const requestCamera = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      triggerAlert("Kamera", "Izin kamera diberikan.", "success");
      setPermissions(prev => ({ ...prev, camera: 'granted' }));
    } catch (err) {
      triggerAlert("Kamera", "Gagal mengakses kamera.", "error");
    }
  };

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      triggerAlert("Lokasi", "Browser tidak mendukung geolocation.", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        triggerAlert("Lokasi", "Izin lokasi diberikan.", "success");
        setPermissions(prev => ({ ...prev, location: 'granted' }));
      },
      () => triggerAlert("Lokasi", "Izin lokasi ditolak.", "error")
    );
  };

  const installApp = async () => {
    if (!deferredPrompt) {
      triggerAlert("Instalasi", "Aplikasi sudah terinstal atau tidak didukung.", "info");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

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
        backgroundColor: '#ffffff', 
        pixelRatio: 3,
        style: { filter: 'contrast(1.15) brightness(1.05)' }
      });
      
      const thermalData = processToThermal(canvas, PAPER_WIDTH);
      await currentService.print(thermalData);
      triggerAlert("Cetak", "Berhasil mencetak data.", 'success');
    } catch (e) {
      triggerAlert("Eror", "Gagal memproses cetakan.", 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleAIScan = async (e: React.ChangeEvent<HTMLInputElement>, type: 'shipping' | 'receipt') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingAI(true);
    triggerAlert("AI", "Mengekstrak data...", "info");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      try {
        if (type === 'shipping') {
          const data = await extractShippingData(base64);
          setShippingForm({ ...shippingForm, ...data });
          setActiveModal(ModalType.SHIPPING);
        } else {
          const data = await extractReceiptData(base64);
          setReceiptItems(data.map((item: any) => ({ ...item, id: Math.random().toString() })));
          setActiveModal(ModalType.RECEIPT);
        }
        triggerAlert("AI Berhasil", "Data berhasil diekstrak.", "success");
      } catch (err) {
        triggerAlert("AI Gagal", "Gagal memproses gambar.", "error");
      } finally {
        setIsProcessingAI(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const generateQRPreview = () => {
    if (!qrInput.trim()) return triggerAlert("Error", "Input QR kosong.", "error");
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrInput)}&format=png&ecc=H`;
    const now = new Date();
    setPreviewContent(
      <div className="bg-white p-6 flex flex-col items-center gap-4 w-full">
        <div className="border-b-2 border-black w-full text-center pb-2">
          <p className="text-xs font-black italic tracking-widest text-black">QR CODE SYSTEM</p>
          <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase">{now.toLocaleDateString('id-ID')} - {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <img src={url} className="w-56 h-56 border border-black p-1" alt="QR" />
        <p className="text-[10px] font-bold text-center break-all px-4 text-black">{qrInput}</p>
      </div>
    );
    setActiveModal(ModalType.NONE);
    setRotation(0);
    setScale(1);
  };

  const generateBarcodePreview = () => {
    if (!barcodeInput.trim()) return triggerAlert("Error", "Input barcode kosong.", "error");
    const url = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeInput)}&scale=4&includetext&backgroundcolor=ffffff`;
    const now = new Date();
    setPreviewContent(
      <div className="bg-white p-6 flex flex-col items-center gap-4 w-full">
        <div className="border-b-2 border-black w-full text-center pb-2">
          <p className="text-xs font-black italic tracking-widest text-black">BARCODE SYSTEM</p>
          <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase">{now.toLocaleDateString('id-ID')} - {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <img src={url} className="w-full h-auto" alt="Barcode" />
      </div>
    );
    setActiveModal(ModalType.NONE);
    setRotation(0);
    setScale(1);
  };

  const addReceiptItem = () => {
    if (!receiptInput.name || !receiptInput.price) return;
    const newItem: ReceiptItem = {
      id: Math.random().toString(),
      name: receiptInput.name,
      price: parseFloat(receiptInput.price),
      qty: parseInt(receiptInput.qty) || 1
    };
    setReceiptItems([...receiptItems, newItem]);
    setReceiptInput({ name: '', price: '', qty: '1' });
  };

  return (
    <div className={`min-h-screen flex flex-col max-w-md mx-auto transition-all duration-500 relative overflow-hidden ${darkMode ? 'bg-slate-950' : 'bg-white shadow-2xl'}`}>
      
      {/* Header */}
      <header className={`px-5 pt-10 pb-5 flex justify-between items-center border-b sticky top-0 z-20 transition-colors ${darkMode ? 'bg-slate-950/80 border-slate-800 backdrop-blur-md' : 'bg-white/80 border-slate-100 backdrop-blur-md'}`}>
        <div>
          <h1 className="text-2xl font-black text-blue-600 tracking-tighter italic">HERNI<span className={darkMode ? 'text-white' : 'text-slate-900'}>PRINT</span><span className="text-[10px] ml-1 px-1 bg-blue-100 rounded text-blue-600">PRO</span></h1>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Professional Thermal Suite</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setDarkMode(!darkMode)} className={`p-2.5 rounded-2xl transition active:scale-90 ${darkMode ? 'bg-slate-900 text-yellow-400' : 'bg-slate-50 text-slate-600'}`}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
           <button onClick={() => setActiveModal(ModalType.SETTINGS)} className={`p-2.5 rounded-2xl transition active:scale-90 ${darkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
              <Settings className="w-5 h-5" />
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 space-y-6 overflow-y-auto">
        <div className={`flex gap-2 p-1 rounded-2xl transition-colors ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          {['58', '80'].map(sz => (
            <button key={sz} onClick={() => setPaperSize(sz as any)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${paperSize === sz ? (darkMode ? 'bg-slate-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : (darkMode ? 'text-slate-500' : 'text-slate-500')}`}>{sz}mm</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'upload', icon: ImageIcon, label: 'Upload Foto', color: 'blue', action: () => fileInputRef.current?.click() },
            { id: 'pdf', icon: FileText, label: 'File PDF', color: 'red', action: () => pdfInputRef.current?.click() },
            { id: 'qr', icon: QrCode, label: 'Buat QR', color: 'emerald', action: () => setActiveModal(ModalType.QR_GEN) },
            { id: 'barcode', icon: Barcode, label: 'Buat Barcode', color: 'indigo', action: () => setActiveModal(ModalType.BARCODE_GEN) },
            { id: 'scan', icon: Camera, label: 'Scan Kode', color: 'purple', action: () => setActiveModal(ModalType.SCANNER) },
          ].map((btn) => (
            <button key={btn.id} onClick={btn.action} className={`p-4 border transition-all flex flex-col items-center gap-2 active:scale-95 rounded-3xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm active:bg-slate-50'}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                btn.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' :
                btn.color === 'red' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                btn.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
                btn.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' :
                'bg-purple-50 dark:bg-purple-900/20 text-purple-600'
              }`}><btn.icon className="w-5 h-5" /></div>
              <span className={`text-[11px] font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{btn.label}</span>
            </button>
          ))}
          <button onClick={() => aiInputRef.current?.click()} className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl rounded-3xl flex flex-col items-center gap-2 active:scale-95 transition">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
            <span className="text-[11px] font-black uppercase tracking-tighter">AI Auto Scan</span>
          </button>
        </div>

        <button onClick={() => setActiveModal(ModalType.SHIPPING)} className="w-full p-5 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-between shadow-xl active:scale-[0.98] transition">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Truck className="w-6 h-6" /></div>
            <div className="text-left"><span className="block text-sm font-black uppercase">Label Paket</span><span className="block text-[10px] opacity-70">Manual / Ekstrak Otomatis</span></div>
          </div>
          <ChevronRight className="w-5 h-5 opacity-50" />
        </button>

        <button onClick={() => setActiveModal(ModalType.RECEIPT)} className={`w-full p-6 text-white rounded-[2rem] flex items-center justify-between active:scale-95 transition shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-900'}`}>
          <div className="flex items-center gap-4">
            <div className="bg-orange-500 p-3 rounded-2xl"><ShoppingBag className="w-6 h-6" /></div>
            <div className="text-left"><span className="block text-sm font-black uppercase">Struk Toko</span><span className={`block text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>Preview Struk Kasir</span></div>
          </div>
          <Plus className="w-4 h-4" />
        </button>
        
        <div className="pb-10" />
      </main>

      {/* FULL-SCREEN PREVIEW MODAL */}
      {previewContent && (
        <div className="fixed inset-0 bg-slate-950 z-[500] flex flex-col animate-in fade-in zoom-in duration-300">
          {/* Preview Header */}
          <div className="p-6 flex justify-between items-center bg-slate-950 text-white border-b border-slate-900">
            <button onClick={() => setPreviewContent(null)} className="flex items-center gap-2 text-sm font-black uppercase italic tracking-tighter hover:text-blue-400 transition">
              <ArrowLeft className="w-5 h-5" /> Kembali
            </button>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preview Cetak</p>
              <p className="text-xs font-bold text-blue-400">{paperSize}mm Thermal Paper</p>
            </div>
            <button onClick={() => setPreviewContent(null)} className="p-2 bg-slate-900 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview Canvas Area */}
          <div className="flex-1 overflow-auto p-10 flex flex-col items-center justify-center relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              <button onClick={() => setRotation(r => (r + 90) % 360)} className="w-14 h-14 bg-white/10 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all shadow-xl border border-white/10"><RotateCw className="w-6 h-6" /></button>
              <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="w-14 h-14 bg-white/10 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all shadow-xl border border-white/10"><Plus className="w-6 h-6" /></button>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="w-14 h-14 bg-white/10 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all shadow-xl border border-white/10"><Minus className="w-6 h-6" /></button>
            </div>

            <div className="bg-white shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden transform-gpu" style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}>
              <div 
                ref={captureRef} 
                style={{ 
                  width: paperSize === '58' ? '384px' : '576px',
                  backgroundColor: 'white'
                }} 
                className="transition-all"
              >
                {previewContent}
              </div>
            </div>
          </div>

          {/* Bottom Action Area */}
          <div className="p-8 bg-slate-950 border-t border-slate-900 flex gap-4">
             <button onClick={() => setPreviewContent(null)} className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition border border-slate-800">Batal</button>
             <button onClick={handlePrint} disabled={isPrinting} className="flex-[2] py-5 bg-blue-600 disabled:bg-blue-400 text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center gap-3 active:scale-95 transition-all">
                {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                {isPrinting ? 'Mencetak...' : 'Konfirmasi Cetak'}
             </button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {activeModal === ModalType.SETTINGS && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-end justify-center backdrop-blur-sm">
          <div className={`w-full rounded-t-[3rem] p-8 space-y-6 animate-in slide-in-from-bottom duration-300 max-h-[95vh] overflow-y-auto transition-colors ${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}`}>
            <div className={`flex justify-between items-center border-b pb-4 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <h3 className="font-black text-2xl tracking-tighter uppercase italic">Pengaturan</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full active:scale-90 transition ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}><X className="w-5 h-5" /></button>
            </div>

            {/* Tema */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tampilan</p>
              <button onClick={() => setDarkMode(!darkMode)} className={`w-full p-5 rounded-3xl font-black flex items-center justify-between transition-all ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-4">
                  {darkMode ? <Sun className="text-yellow-400" /> : <Moon className="text-blue-600" />}
                  <span>{darkMode ? "Mode Terang" : "Mode Gelap"}</span>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'left-7' : 'left-1'}`} />
                </div>
              </button>
            </div>

            {/* Koneksi */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Koneksi Printer</p>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={async () => {
                  try {
                    const name = await printerService.connect();
                    setPrinterName(name);
                    setActiveConnectionType('bluetooth');
                    triggerAlert("Berhasil", `Bluetooth: ${name}`, "success");
                  } catch(e) { triggerAlert("Bluetooth", "Gagal menghubungkan.", "error"); }
                }} className="w-full p-5 bg-blue-600 text-white rounded-3xl font-black flex items-center justify-between shadow-lg active:scale-95 transition">
                  <div className="flex items-center gap-4"><Bluetooth /><span className="truncate">{activeConnectionType === 'bluetooth' ? printerName : "Hubungkan Bluetooth"}</span></div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
                <button onClick={async () => {
                  try {
                    const name = await usbService.connect();
                    setPrinterName(name);
                    setActiveConnectionType('usb');
                    triggerAlert("Berhasil", `USB: ${name}`, "success");
                  } catch(e) { triggerAlert("USB", "Gagal menghubungkan kabel.", "error"); }
                }} className={`w-full p-5 rounded-3xl font-black flex items-center justify-between shadow-lg active:scale-95 transition ${darkMode ? 'bg-slate-800' : 'bg-slate-900 text-white'}`}>
                  <div className="flex items-center gap-4"><Usb /><span className="truncate">{activeConnectionType === 'usb' ? printerName : "Hubungkan USB"}</span></div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
              </div>
            </div>

            {/* Sistem */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sistem & Perangkat</p>
              <button onClick={installApp} className={`w-full p-4 border rounded-2xl flex items-center justify-between group active:scale-[0.98] transition ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center"><DownloadCloud className="w-4 h-4" /></div>
                  <span className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Instal Aplikasi (PWA)</span>
                </div>
                <Smartphone className="w-4 h-4 text-slate-300" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={requestCamera} className={`p-4 border rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <Camera className={`w-5 h-5 ${permissions.camera === 'granted' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className="text-[10px] font-black uppercase">Izin Kamera</span>
                </button>
                <button onClick={requestLocation} className={`p-4 border rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <MapPin className={`w-5 h-5 ${permissions.location === 'granted' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className="text-[10px] font-black uppercase">Izin Lokasi</span>
                </button>
              </div>
            </div>

            {/* Komunitas */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Komunitas & Bantuan</p>
              <button onClick={() => window.open('https://t.me/altomediaindonesia', '_blank')} className={`w-full p-4 border rounded-2xl flex items-center justify-between group active:scale-[0.98] transition ${darkMode ? 'bg-sky-900/20 border-sky-900/40' : 'bg-sky-50 border-sky-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-sky-500 text-white rounded-xl flex items-center justify-center shadow-md"><MessageCircle className="w-4 h-4" /></div>
                  <span className={`text-sm font-bold ${darkMode ? 'text-sky-400' : 'text-sky-700'}`}>Telegram Community</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-sky-400 uppercase">Hubungi <ExternalLink className="w-3 h-3" /></div>
              </button>
            </div>

            <div className="pb-6" />
          </div>
        </div>
      )}

      {/* MODALS: QR, BARCODE, SHIPPING, RECEIPT, SCANNER */}
      {activeModal === ModalType.QR_GEN && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 animate-in zoom-in duration-300 backdrop-blur-sm">
          <div className={`w-full rounded-[2.5rem] p-8 space-y-6 shadow-2xl ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center"><QrCode /></div>
                   <h3 className={`font-black text-xl uppercase italic tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>Generator QR</h3>
                </div>
                <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full transition ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}><X className="w-5 h-5" /></button>
             </div>
             <textarea value={qrInput} onChange={e => setQrInput(e.target.value)} placeholder="Huruf, Angka, atau URL..." rows={4} className={`w-full p-4 rounded-2xl outline-none border-2 border-transparent focus:border-emerald-200 transition font-medium text-sm ${darkMode ? 'bg-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 text-slate-900'}`} />
             <button onClick={generateQRPreview} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition">Generate QR</button>
          </div>
        </div>
      )}

      {activeModal === ModalType.BARCODE_GEN && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 animate-in zoom-in duration-300 backdrop-blur-sm">
          <div className={`w-full rounded-[2.5rem] p-8 space-y-6 shadow-2xl ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center"><Barcode /></div>
                   <h3 className={`font-black text-xl uppercase italic tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>Barcode Gen</h3>
                </div>
                <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full transition ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}><X className="w-5 h-5" /></button>
             </div>
             <input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} placeholder="Huruf atau Angka..." className={`w-full p-4 rounded-2xl outline-none border-2 border-transparent focus:border-indigo-200 transition font-black tracking-widest uppercase text-center ${darkMode ? 'bg-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 text-slate-900'}`} />
             <button onClick={generateBarcodePreview} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition">Generate Barcode</button>
          </div>
        </div>
      )}

      {activeModal === ModalType.SHIPPING && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end justify-center animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-t-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'bg-indigo-950/20 border-slate-900' : 'bg-indigo-50/50'}`}>
              <h3 className="font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tighter">Label Pengiriman</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full ${darkMode ? 'bg-slate-900' : 'bg-white'}`}><X className={`w-5 h-5 ${darkMode ? 'text-indigo-400' : 'text-indigo-400'}`} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {isProcessingAI ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                  <p className="text-xs font-black text-indigo-600 uppercase">AI sedang bekerja...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <input value={shippingForm.toName} onChange={e => setShippingForm({...shippingForm, toName: e.target.value})} placeholder="Nama Penerima" className={`w-full p-4 rounded-2xl text-sm font-semibold outline-none ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`} />
                  <input value={shippingForm.toPhone} onChange={e => setShippingForm({...shippingForm, toPhone: e.target.value})} placeholder="No. Telepon" className={`w-full p-4 rounded-2xl text-sm font-semibold outline-none ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`} />
                  <textarea value={shippingForm.toAddress} onChange={e => setShippingForm({...shippingForm, toAddress: e.target.value})} placeholder="Alamat Lengkap" rows={3} className={`w-full p-4 rounded-2xl text-sm font-semibold outline-none ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}></textarea>
                </div>
              )}
            </div>
            {!isProcessingAI && (
              <div className={`p-6 border-t ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <button onClick={() => {
                  const now = new Date();
                  setPreviewContent(
                    <div className="receipt-font text-black bg-white p-6 w-full border-4 border-black">
                      <p className="text-2xl font-black italic tracking-tighter uppercase mb-4 text-black">DELIVERY</p>
                      <p className="text-xl font-black uppercase leading-none text-black">{shippingForm.toName}</p>
                      <p className="text-sm font-bold border-y border-black py-1 my-2 text-black">{shippingForm.toPhone}</p>
                      <p className="text-sm font-bold leading-tight mb-4 text-black">{shippingForm.toAddress}</p>
                      <div className="border-t border-black pt-2 flex justify-between">
                         <span className="text-[8px] font-black uppercase italic text-black">Herniprint Pro</span>
                         <span className="text-[8px] font-bold text-black">{now.toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  );
                  setActiveModal(ModalType.NONE);
                  setRotation(0);
                  setScale(1);
                }} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs active:scale-95 transition">Preview Label</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeModal === ModalType.RECEIPT && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end justify-center animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-t-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'bg-orange-950/20 border-slate-900' : 'bg-orange-50/50'}`}>
              <h3 className="font-black text-orange-700 dark:text-orange-400 uppercase tracking-tighter">Struk Toko</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className={`p-2 rounded-full active:scale-90 transition ${darkMode ? 'bg-slate-900' : 'bg-white'}`}><X className={`w-5 h-5 ${darkMode ? 'text-orange-400' : 'text-orange-400'}`} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <input value={receiptInput.name} onChange={e => setReceiptInput({...receiptInput, name: e.target.value})} placeholder="Nama Item" className={`w-full p-4 rounded-2xl text-sm font-semibold outline-none ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`} />
              <div className="flex gap-2">
                <input value={receiptInput.price} onChange={e => setReceiptInput({...receiptInput, price: e.target.value})} placeholder="Harga" type="number" className={`flex-1 p-4 rounded-2xl text-sm font-semibold outline-none ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`} />
                <input value={receiptInput.qty} onChange={e => setReceiptInput({...receiptInput, qty: e.target.value})} placeholder="Qty" type="number" className={`w-24 p-4 rounded-2xl text-sm font-semibold outline-none text-center ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50'}`} />
              </div>
              <button onClick={addReceiptItem} className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-900'}`}>Tambah</button>
              <div className="space-y-2 mt-4 border-t pt-4 dark:border-slate-800">
                {receiptItems.map(item => (
                  <div key={item.id} className={`flex justify-between items-center p-3 rounded-xl ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <div className="flex-1">
                      <p className={`text-xs font-black uppercase ${darkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.qty} x {item.price.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setReceiptItems(receiptItems.filter(i => i.id !== item.id))} className="text-red-500 active:scale-90 transition p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className={`p-6 border-t ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <button onClick={() => {
                const now = new Date();
                setPreviewContent(
                  <div className="receipt-font text-black bg-white p-6 w-full text-center">
                    <p className="text-xl font-black italic uppercase mb-1 text-black">HERNI STORE</p>
                    <div className="text-[9px] font-bold mb-4 flex justify-between px-2 border-b border-dashed border-black pb-1 text-black">
                      <span>Tgl: {now.toLocaleDateString('id-ID')}</span>
                      <span>Jam: {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="border-b border-dashed border-black py-2 mb-4 space-y-1 text-black">
                      {receiptItems.map(item => (
                        <div key={item.id} className="flex justify-between text-[11px] font-bold text-left text-black">
                          <span className="flex-1 pr-2 truncate">{item.name} x{item.qty}</span>
                          <span className="shrink-0">{(item.price * item.qty).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-lg font-black uppercase mb-4 text-black">
                      <span>Total</span>
                      <span>{receiptItems.reduce((acc, curr) => acc + (curr.price * curr.qty), 0).toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-4 border-t border-dashed border-black pt-2 italic">Terima Kasih Telah Berbelanja!</p>
                  </div>
                );
                setActiveModal(ModalType.NONE);
                setRotation(0);
                setScale(1);
              }} className="w-full py-5 bg-orange-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs active:scale-95 transition">Preview Struk</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === ModalType.SCANNER && (
        <div className="fixed inset-0 bg-black z-[300] flex flex-col items-center justify-center p-6">
          <button onClick={() => setActiveModal(ModalType.NONE)} className="absolute top-10 right-10 p-3 bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
          <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent animate-scan" style={{ animation: 'scan 2s linear infinite' }} />
            <Camera className="w-12 h-12 text-white/20" />
          </div>
          <p className="mt-8 text-white font-black text-sm uppercase tracking-widest">Scanner Aktif</p>
        </div>
      )}

      {/* TOASTS */}
      {alert && (
        <div className="fixed top-10 left-0 right-0 z-[1000] px-6 flex justify-center animate-in slide-in-from-top-full duration-500">
          <div className={`max-w-xs w-full flex items-center gap-4 p-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border ${alert.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/30' : alert.type === 'error' ? 'bg-rose-500/90 border-rose-400/30' : 'bg-slate-900/90 border-slate-700/30'}`}>
            <div className="shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white"><Info className="w-5 h-5" /></div>
            <div className="flex-1 text-white text-[10px] font-black uppercase tracking-wider">{alert.msg}</div>
          </div>
        </div>
      )}

      {/* HIDDEN INPUTS */}
      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={e => {
         const file = e.target.files?.[0];
         if (!file) return;
         const reader = new FileReader();
         reader.onload = (ev) => {
           setPreviewContent(<img src={ev.target?.result as string} className="w-full block" alt="Upload" />);
           setRotation(0);
           setScale(1);
         };
         reader.readAsDataURL(file);
      }} />
      <input ref={pdfInputRef} type="file" className="hidden" accept=".pdf,image/*" onChange={() => triggerAlert("Info PDF", "Untuk hasil terbaik, gunakan screenshot file PDF.", "info")} />
      <input ref={aiInputRef} type="file" className="hidden" accept="image/*" onChange={e => handleAIScan(e, 'shipping')} />
    </div>
  );
};

export default App;
