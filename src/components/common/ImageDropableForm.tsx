import { FieldValues } from "react-hook-form";
import ImageDropable from "./ImageDropable";

type ImageDropableFormProps = {
  field: FieldValues;
};

export default function ImageDropableForm({ field }: ImageDropableFormProps) {
  function handleDropPicture(e: React.DragEvent) {
    e.preventDefault();
    field.onChange([...field.value, e.dataTransfer.files[0]]);
  }

  function handleFileChange(e: React.BaseSyntheticEvent) {
    field.onChange([...field.value, e.target.files[0]]);
  }
  return (
    <div>
      <div>
        {field.value &&
          field.value.map((item: File, index: number) => (
            <div key={index}>{item.name}</div>
          ))}
      </div>
      <ImageDropable
        handleDropPicture={handleDropPicture}
        handleFileChange={handleFileChange}
      />
    </div>
  );
}
