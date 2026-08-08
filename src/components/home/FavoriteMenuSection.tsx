"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Star } from "lucide-react";
import { toast } from "sonner";

import { saveHomeFavoriteKeys } from "@/lib/home/actions";
import { normalizeFavoriteKeys } from "@/lib/home/favorites";
import {
  DEFAULT_FAVORITE_KEYS,
  HOME_MENU_ITEMS,
  HOME_MENU_KEYS,
  MAX_FAVORITE_COUNT,
  resolveFavoriteItems,
  type HomeMenuItem,
  type HomeMenuKey,
} from "@/lib/home/menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function FavoriteCard({ item }: { item: HomeMenuItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      className="group flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-5 text-center shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <span
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${item.iconSurfaceClassName}`}
      >
        <Icon
          className={`h-5 w-5 ${item.iconClassName}`}
          strokeWidth={1.8}
          aria-hidden
        />
      </span>
      <span className="text-sm font-semibold text-slate-700 transition-colors group-hover:text-blue-700">
        {item.label}
      </span>
    </Link>
  );
}

export default function FavoriteMenuSection({
  initialKeys,
}: {
  initialKeys: HomeMenuKey[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftKeys, setDraftKeys] = useState<HomeMenuKey[]>(initialKeys);
  const [isPending, startTransition] = useTransition();

  const favoriteItems = useMemo(
    () => resolveFavoriteItems(initialKeys),
    [initialKeys]
  );

  function toggleKey(key: HomeMenuKey, checked: boolean) {
    setDraftKeys((current) => {
      if (checked) {
        if (current.length >= MAX_FAVORITE_COUNT) {
          toast.message(`เลือกได้สูงสุด ${MAX_FAVORITE_COUNT} เมนู`);
          return current;
        }
        return normalizeFavoriteKeys([...current, key]);
      }
      const next = current.filter((item) => item !== key);
      return next.length > 0 ? next : current;
    });
  }

  function handleSave() {
    const keys = normalizeFavoriteKeys(draftKeys);
    startTransition(async () => {
      try {
        await saveHomeFavoriteKeys(keys);
        setOpen(false);
        router.refresh();
        toast.success("บันทึกเมนูโปรดแล้ว");
      } catch (error) {
        console.error(error);
        toast.error("บันทึกเมนูโปรดไม่สำเร็จ");
      }
    });
  }

  return (
    <section className="mt-8" aria-labelledby="favorite-menu">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
          <h2
            id="favorite-menu"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            เมนูโปรด
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">
            {favoriteItems.length}/{MAX_FAVORITE_COUNT} เมนู
          </span>
          <Dialog open={open} onOpenChange={(next) => {
            if (next) {
              setDraftKeys(normalizeFavoriteKeys(initialKeys));
            }
            setOpen(next);
          }}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                จัดการ
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-hidden sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>จัดการเมนูโปรด</DialogTitle>
                <DialogDescription>
                  เลือกเมนูสูงสุด {MAX_FAVORITE_COUNT} รายการเพื่อแสดงบนหน้าแรก
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 max-h-[min(420px,55dvh)] space-y-2 overflow-y-auto pr-1">
                {HOME_MENU_KEYS.map((key) => {
                  const item = HOME_MENU_ITEMS[key];
                  const Icon = item.icon;
                  const checked = draftKeys.includes(key);
                  const disableUncheck = checked && draftKeys.length === 1;
                  const disableCheck =
                    !checked && draftKeys.length >= MAX_FAVORITE_COUNT;

                  return (
                    <Label
                      key={key}
                      htmlFor={`favorite-${key}`}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3 hover:bg-slate-50"
                    >
                      <Checkbox
                        id={`favorite-${key}`}
                        checked={checked}
                        disabled={disableUncheck || disableCheck || isPending}
                        onCheckedChange={(value) =>
                          toggleKey(key, value === true)
                        }
                        className="mt-0.5"
                      />
                      <span
                        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${item.iconSurfaceClassName}`}
                      >
                        <Icon
                          className={`h-4 w-4 ${item.iconClassName}`}
                          strokeWidth={1.8}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-800">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {item.description}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    setDraftKeys([...DEFAULT_FAVORITE_KEYS])
                  }
                >
                  คืนค่าเริ่มต้น
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setOpen(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="button"
                    disabled={isPending || draftKeys.length === 0}
                    onClick={handleSave}
                  >
                    {isPending ? "กำลังบันทึก..." : "บันทึก"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {favoriteItems.map((item) => (
          <FavoriteCard key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}
