"use client";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  //type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import ImageDropable from "./ImageDropable";
import { commonUploadFile } from "@/lib/utils";

type imageCarouselProps = {
  imageId: string;
  imageFolder: string;
  imageArray: storageObjectType[] | undefined;
  setImageArray: (imageArray: storageObjectType[]) => void;
  disableDialog?: boolean;
  triggerSize?: number;
  dialogSize?: number;
};

export type storageObjectType = { id: string; name: string };

export async function getImageArray(
  imageFolder: string,
  imageId: string,
  setImageArray: (imageArray: storageObjectType[]) => void
) {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("pictures")
    .list(`public/${imageFolder}`, {
      limit: 100,
      offset: 0,
      search: imageId,
      sortBy: { column: "updated_at", order: "asc" },
    });

  if (!!error) console.log(error);
  if (!!data) {
    setImageArray(data);
    //setCount(data.length + 1);
  }
}

export default function ImageCarousel({
  imageId,
  imageFolder,
  imageArray,
  setImageArray,
  triggerSize = 250,
  dialogSize = 500,
  disableDialog = false,
}: imageCarouselProps) {
  //const [api, setApi] = useState<CarouselApi>();
  // const [current, setCurrent] = useState(0);
  // const [count, setCount] = useState(0);

  function handleDropPicture(e: React.DragEvent) {
    e.preventDefault();
    uploadFile(e.dataTransfer.files[0]);
  }

  function handleFileChange(e: React.BaseSyntheticEvent) {
    uploadFile(e.target.files[0]);
  }

  async function deleteFile(fileName: string) {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from("pictures")
      .remove([`public/${imageFolder}/${fileName}`]);

    if (!!error) console.log(error);
    if (!!data) {
      getImageArray(imageFolder, imageId, setImageArray);
    }
  }

  async function uploadFile(picture: File) {
    if (!picture) {
      return;
    }

    const { data } = await commonUploadFile({ picture, imageId, imageFolder });

    if (!!data) {
      getImageArray(imageFolder, imageId, setImageArray);
    }
  }

  // const getImageArray = useCallback(
  //   async function () {
  //     const supabase = createClient();

  //     const { data, error } = await supabase.storage
  //       .from("pictures")
  //       .list(`public/${imageFolder}`, {
  //         limit: 100,
  //         offset: 0,
  //         search: imageId,
  //         sortBy: { column: "updated_at", order: "asc" },
  //       });

  //     if (!!error) console.log(error);
  //     if (!!data) {
  //       setImageArray(data);
  //       //setCount(data.length + 1);
  //     }
  //   },
  //   [imageFolder, imageId, setImageArray]
  // );

  // useEffect(() => {
  //   getImageArray(imageFolder, imageId, setImageArray);
  // }, [imageFolder, imageId, setImageArray]);

  // useEffect(() => {
  //   if (!api) {
  //     return;
  //   }

  //   setCurrent(api.selectedScrollSnap() + 1);

  //   api.on("select", () => {
  //     setCurrent(api.selectedScrollSnap() + 1);
  //   });
  // }, [api]);

  return (
    <>
      {imageArray !== undefined && (
        <>
          <Carousel /*setApi={setApi}*/>
            <CarouselContent>
              {imageArray.map((image) => (
                <CarouselItem key={image.id} className="flex justify-center">
                  <div className="flex flex-col gap-4">
                    <Dialog>
                      <DialogTrigger disabled={disableDialog}>
                        <Image
                          className="w-auto"
                          src={`https://jdzitzsucntqbjvwiwxm.supabase.co/storage/v1/object/public/pictures/public/${imageFolder}/${image.name}?id=${image.id}`}
                          width={triggerSize}
                          height={triggerSize}
                          alt={image.name}
                          quality={80}
                        />
                      </DialogTrigger>
                      <DialogContent className="grid place-content-center">
                        <DialogHeader className="hidden">
                          <DialogTitle>Image of {image.name}</DialogTitle>
                          <DialogDescription>
                            KCW product image of {image.name}
                          </DialogDescription>
                        </DialogHeader>
                        <Image
                          className="w-auto rounded-md"
                          src={`https://jdzitzsucntqbjvwiwxm.supabase.co/storage/v1/object/public/pictures/public/${imageFolder}/${image.name}?id=${image.id}`}
                          width={dialogSize}
                          height={dialogSize}
                          alt={image.name}
                          quality={80}
                        />
                        <Button onClick={() => deleteFile(image.name)}>
                          <Trash2 />
                        </Button>
                      </DialogContent>
                    </Dialog>
                    {disableDialog && (
                      <Button onClick={() => deleteFile(image.name)}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </CarouselItem>
              ))}

              <CarouselItem className="grid place-content-center">
                <ImageDropable
                  handleDropPicture={handleDropPicture}
                  handleFileChange={handleFileChange}
                />
              </CarouselItem>
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
          {/* {count > 0 && (
            <div className="py-2 text-center text-sm text-muted-foreground">
              {current} / {count}
            </div>
          )} */}
        </>
      )}
    </>
  );
}
