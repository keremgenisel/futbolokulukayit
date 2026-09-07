// Çekirdek veri şekilleri (electron/db.cjs şemasıyla birebir). Renderer bu tipleri
// JSDoc ile kullanır; dosya dosya `// @ts-check` ile denetime dahil edilir.
export type Durum = "aktif" | "deneme" | "pasif" | "ayrildi" | "sakat" | "dondurma";
export type UcretTipi = "normal" | "burslu" | "indirimli" | "kardes" | "ucretsiz";
export type OdemeYontemi = "nakit" | "havale" | "kredi_karti" | "online";
export type OdemeDonemi = "1-10" | "11-20" | "21-31";
export type AidatDurum = "odenmedi" | "odendi" | "muaf";

export interface AgeGroup { id: number; ad: string; sezon: string; sira: number; aktif: number }

export interface Player {
  id: number; tc_no: string | null; ad_soyad: string; dogum_tarihi: string | null;
  dogum_yeri: string; okul: string; gsm: string; adres: string; kan_grubu: string; foto_yolu: string;
  yas_grubu_id: number | null; yas_grubu_ad?: string | null;
  durum: Durum; ucret_tipi: UcretTipi; aylik_aidat: number; odeme_donemi: OdemeDonemi;
  kayit_tarihi: string; notlar: string;
}

export interface Guardian { id: number; player_id: number; tip: "anne" | "baba" | "veli"; ad_soyad: string; gsm: string; whatsapp_no: string; veli_mi: number }
export interface EmergencyContact { id: number; player_id: number; ad_soyad: string; yakinlik: string; telefon: string }
export interface Document { id: number; player_id: number; tip: string; dosya_yolu: string; orijinal_ad: string; gecerlilik_tarihi: string | null; yuklenme_tarihi: string }
export interface FeeItem { id: number; kod: string; ad: string; varsayilan_fiyat: number; sira: number; aktif: number }
export interface MonthlyDue { id: number; player_id: number; yil: number; ay: number; tutar: number; durum: AidatDurum; receipt_id: number | null }
export interface ReceiptLine { id?: number; fee_item_id: number | null; aciklama: string; tutar: number; yil?: number | null; ay?: number | null; kalem_ad?: string; kalem_kod?: string }
export interface Receipt { id: number; makbuz_no: string; player_id: number; tarih: string; toplam: number; odeme_yontemi: OdemeYontemi; tahsil_eden: string; not_: string; pdf_yolu: string; iptal: number; satirlar?: ReceiptLine[] }
export interface Training { id: number; age_group_id: number; tarih: string; saat: string; saha: string; iptal: number; iptal_nedeni: string; yas_grubu_ad?: string }
export interface Attendance { id: number; training_id: number; player_id: number; durum: "geldi" | "gelmedi" | "izinli"; ad_soyad?: string }

export interface LisansDurum { mod: "lisansli" | "deneme" | "saltOkunur"; neden?: string; firma?: string; bitis: string | null; maksKullanici: number | null; kalanGun: number | null; makineId?: string; saatGeriAlindi?: boolean }

export interface Session { username: string; ad_soyad: string; role: string; must_change_password: boolean }

declare global {
  interface Window {
    okul: {
      auth: {
        login(username: string, password: string): Promise<{ ok: boolean; user?: Session; error?: string }>;
        logout(): Promise<{ ok: boolean }>;
        changePassword(username: string, newPassword: string): Promise<{ ok: boolean; error?: string }>;
        session(): Promise<Session | null>;
        kurtarmaUret(userId: number): Promise<{ ok: boolean; kodlar?: string[]; error?: string }>;
        kurtarmaSifirla(username: string, kod: string, yeniParola: string): Promise<{ ok: boolean; kalan?: number; error?: string }>;
      };
      db(fn: string, ...args: unknown[]): Promise<any>;
      files: {
        addDocument(playerId: number, tip: string, gecerlilik?: string | null): Promise<{ ok?: boolean; iptal?: boolean; id?: number; dosya_yolu?: string }>;
        deleteDocument(docId: number): Promise<{ ok: boolean }>;
        open(yol: string): Promise<string>;
        dataUrl(yol: string): Promise<string | null>;
      };
      cikti: {
        yazdir(html: string): Promise<{ ok: boolean; hata?: string }>;
        makbuzPdf(receiptId: number, html: string): Promise<{ ok: boolean; pdf_yolu: string }>;
        pdfKaydet(html: string, oneriAd?: string, yatay?: boolean): Promise<{ ok?: boolean; iptal?: boolean; yol?: string }>;
        excelKaydet(veri: { sayfa: string; sutunlar: { baslik: string; anahtar: string; genislik?: number }[]; satirlar: Record<string, unknown>[] }, oneriAd?: string): Promise<{ ok?: boolean; iptal?: boolean; yol?: string }>;
      };
      yedek: {
        klasorSec(): Promise<{ ok?: boolean; iptal?: boolean; klasor?: string }>;
        al(): Promise<{ ok?: boolean; error?: string; yol?: string }>;
        durum(): Promise<{ klasor: string | null; son: string | null; istemci?: boolean }>;
        geriYukleSec(): Promise<{ ok?: boolean; iptal?: boolean; error?: string; klasor?: string; oyuncu?: number; makbuz?: number; sonMakbuz?: string | null }>;
        geriYukle(klasor: string): Promise<{ ok?: boolean; error?: string }>;
      };
      lisans: {
        durum(): Promise<{ ok: boolean; durum: LisansDurum }>;
        kaydet(anahtar: string): Promise<{ ok?: boolean; error?: string; durum?: LisansDurum }>;
        leaseYapistir(lease: string): Promise<{ ok?: boolean; error?: string; durum?: LisansDurum }>;
        aktiflestir(): Promise<{ ok?: boolean; error?: string; durum?: LisansDurum }>;
        yenile(): Promise<{ ok?: boolean; error?: string; durum?: LisansDurum }>;
      };
      app: { version(): Promise<string>; logo(): Promise<string> };
    };
  }
}
