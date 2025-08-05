import CardIconMenu from "@/components/common/CardIconMenu";
import CardIcon from "@/components/common/CardIcon";

export default function Home() {
  return (
    <>
      <h1 className="text-6xl p-12 text-center tracking-widest">เมนูหลัก</h1>
      <CardIconMenu>
        <CardIcon
          path="/reminder"
          description="เตือนโอน"
          icon="MessageCircleWarning"
        />
        <CardIcon
          path="/expense"
          description="ค่าใช้จ่ายบริษัท"
          icon="Banknote"
        />
        <CardIcon path="/supplier" description="รายชื่อบริษัท" icon="Truck" />
      </CardIconMenu>
    </>
  );
}
