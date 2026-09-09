import Link from "next/link";

export default function PoPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-900">
        สถานะใบสั่งซื้อถูกยกเลิกแล้ว
      </h1>
      <p className="text-sm leading-6 text-slate-600">
        ใช้บริการโอนสินค้าแทน — พิมพ์{" "}
        <span className="font-medium text-slate-900">โอนสินค้า</span> ใน LINE
        หรือกดจากเมนูบริการ
      </p>
      <Link href="/home" className="text-sm font-medium text-sky-700 underline">
        กลับหน้าแรก
      </Link>
    </main>
  );
}
