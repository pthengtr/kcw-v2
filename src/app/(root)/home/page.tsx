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
          <CardIcon href="/supplier" label="รายชื่อบริษัท" icon="Truck" />
          <CardIcon href="/product" label="สินค้า" icon="ShoppingBag" />
          <CardIcon href="/pos" label="ขายหน้าร้าน" icon="SquareMenu" />
          <CardIcon
            href="/purchase/receive"
            label="รับสินค้า"
            icon="ClipboardList"
          />
        </CardIconMenu>
      </div>
    </main>
  );
}
