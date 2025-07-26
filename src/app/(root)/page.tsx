import CardIconMenu from "@/components/common/CardIconMenu";
import CardIcon from "@/components/common/CardIcon";

export default function Home() {
  return (
    <main>
      <CardIconMenu>
        <CardIcon
          path="/reminder"
          description="เตือนโอน"
          icon="MessageCircleWarning"
        />
        <CardIcon path="/expense" description="ค่าใช้จ่าย" icon="Banknote" />
        <CardIcon path="/supplier" description="รายชื่อบริษัท" icon="Truck" />
      </CardIconMenu>
    </main>
  );
}
