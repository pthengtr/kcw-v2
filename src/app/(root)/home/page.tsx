import CardIconMenu from "@/components/common/CardIconMenu";
import CardIcon from "@/components/common/CardIcon";

export default function Home() {
  return (
    <main className="grid place-content-center">
      <div className="flex items-center flex-col justify-center w-[80vw]">
        <h1 className="text-6xl p-12 text-center tracking-widest">เมนูหลัก</h1>
        <CardIconMenu>
          <CardIcon
            href="/reminder"
            label="เตือนโอน"
            icon="MessageCircleWarning"
          />
          <CardIcon href="/expense" label="ค่าใช้จ่าย" icon="Banknote" />
          <CardIcon href="/party" label="รายชื่อคู่ค้า" icon="Handshake" />
          <CardIcon href="/kb" label="จัดการ FAQ" icon="BookOpen" />
          <CardIcon
            href="/product-related"
            label="สินค้าที่ซื้อด้วยกัน"
            icon="Link2"
          />
          <CardIcon
            href="/product-images"
            label="จัดการรูปสินค้า"
            icon="Images"
          />
          <CardIcon
            href="/bank-statement-sync"
            label="Bank Statement"
            icon="ArrowRightLeft"
          />
          <CardIcon href="/tiger-pay" label="Tiger Pay" icon="Wallet" />
        </CardIconMenu>
      </div>
    </main>
  );
}
