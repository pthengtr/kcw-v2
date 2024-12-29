import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImagePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { ProductType, productColumns } from "./ProductColumns";
import { DataTable } from "../common/DataTable";

export default function ProductPage() {
  const [products, setProducts] = useState<ProductType[]>();

  useEffect(() => {
    async function getProduct() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .limit(100);

      if (error) console.log(error);

      if (!!data) setProducts(data);
    }

    getProduct();
  }, []);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (!!error) console.log(error);
  }

  async function uploadFile(picture: File) {
    const { data, error } = await supabase.storage
      .from("pictures")
      .upload(`public/${picture.name}`, picture);

    if (!!error) console.log(error);
    if (!!data) console.log(data);
  }

  function handleDropPicture(e: React.DragEvent) {
    e.preventDefault();
    console.log(e.dataTransfer.files[0]);
    uploadFile(e.dataTransfer.files[0]);
  }

  function handleFileChange(e: React.ChangeEvent) {
    console.log(e);
  }

  return (
    <main className="flex flex-col gap-4">
      <Button onClick={handleLogout}>Log out</Button>
      <div>
        {!!products && (
          <DataTable columns={productColumns} data={products}></DataTable>
        )}
      </div>
      <div className="w-full grid place-content-center">
        <div
          onDrop={handleDropPicture}
          onDragOver={(e) => e.preventDefault()}
          className="grid place-content-center border rounded-md"
        >
          <Label htmlFor="file" className="grid place-content-center">
            <ImagePlus size={96} />
          </Label>
        </div>
      </div>
      <Input
        id="file"
        className="visible"
        type="file"
        onChange={handleFileChange}
      />
    </main>
  );
}
