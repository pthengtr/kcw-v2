import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { ImagePlus } from "lucide-react";
import { useId } from "react";

type ImageDropableProps = {
  handleDropPicture: (e: React.DragEvent) => void;
  handleFileChange: (e: React.BaseSyntheticEvent) => void;
};

export default function ImageDropable({
  handleDropPicture,
  handleFileChange,
}: ImageDropableProps) {
  const id = useId();

  return (
    <div>
      <div
        onDrop={handleDropPicture}
        onDragOver={(e) => e.preventDefault()}
        className="grid place-content-center "
      >
        <Label
          htmlFor={`${id}-input-image`}
          className="grid place-content-center hover:cursor-pointer"
        >
          <ImagePlus size={96} strokeWidth={1.2} />
        </Label>
      </div>

      <Input
        id={`${id}-input-image`}
        className="hidden"
        type="file"
        onChange={handleFileChange}
      />
    </div>
  );
}
