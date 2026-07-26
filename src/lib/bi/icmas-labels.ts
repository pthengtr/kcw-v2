/** KACC9 category + CODE1 labels (shared with product BI). */

export const CATEGORY_LABELS: Record<string, string> = {
  "01": "TX จิ๊ป แลนด์",
  "02": "I/S JCM FV FXZ DECA TX บรรทุก 10 ล้อ",
  "03": "I/S KBZ TFR D-MAX กระบะ",
  "04": "I/S ELF-KS NPR NKR NQR บรรทุก 4-6 ล้อ",
  "05": "NISSAN (D/S) กระบะ เก๋ง",
  "06": "NISSAN UD CW CMA บรรทุก 6-10 ล้อ",
  "07": "MAZDA FORD กระบะ เก๋ง",
  "08": "TOYOTA กระบะ เก๋ง",
  "09": "HINO",
  "10": "FUSO",
  "11": "MITSUBISHI กระบะ เก๋ง",
  "12": "รถไถ FORD JOHNDEERE",
  "13": "ทั่วไป โช้คอัพ ไฟ ยาง",
  "14": "เครื่องเหล็ก เครื่องมือ",
  "15": "ลูกปืน",
  "16": "HONDA รถญี่ปุ่น เกาหลี ทั่วไป",
  "17": "สกรู MIC ดำ",
  "18": "สกรู NF ละเอียด",
  "19": "สกรู NC หยาบ",
  "20": "สกรู MIC ขาว",
  "21": "แบตเตอรี่ น้ำกรด น้ำกลั่น",
  "22": "น้ำมัน จารบี น้ำยา",
  "23": "รถยุโรป BENZ BMW",
  "24": "อะไหล่เก่า เชียงกง",
  "25": "ยางโอริง",
  "26": "สายอ่อน",
  "27": "บัส",
  "28": "พ่วง เทลเลอร์ ดั๊ม",
  "29": "ประดับยนต์",
  "30": "รถไถ KUBOTA",
  "31": "รถไถ MASSEY (แมสซี่ย์)",
  "32": "แม็คโคร",
  "33": "อัดสายไฮดรอลิค",
  "34": "โฟคลิฟ รถยก",
  "35": "รถไถ ยันม่าร์ อิเซกิ ฮิโนโมโต้ แชมป์",
  "40": "ค่าแรง",
  "70": "ค่าใช้จ่าย เทิร์นแบตเก่า",
  "91": "โปรโมชั่น / พิเศษ",
};

export const CODE1_LABELS: Record<string, string> = {
  A: "ถ่าน",
  C: "ซีล",
  D: "บู๊ช",
  E: "ลูกปืนเข็ม/กรงนก",
  F: "ไส้กรองอากาศ",
  G: "ยอยกากบาท",
  I: "ลูกปืนตลับ / ลูกปืน",
  K: "จานคลัช",
  L: "สายอ่อน",
  O: "โอริง",
  P: "ไส้กรองน้ำมันเครื่อง",
  Q: "ลูกหมาก",
  R: "ลูกยาง",
};

export function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] ?? code;
}

export function code1Label(code: string | null | undefined): string | null {
  if (!code) return null;
  return CODE1_LABELS[code] ?? code;
}
