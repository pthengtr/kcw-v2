"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Loader2,
  RefreshCw,
  Search,
  Link2,
  Unlink2,
  Layers3,
} from "lucide-react";
import {
  useProductRelated,
  type ProductSummary,
  type RelatedUnionItem,
} from "./ProductRelatedProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

function ProductMeta({ product }: { product: ProductSummary }) {
  return (
    <div className="space-y-1">
      <div className="font-medium">{product.BCODE}</div>
      <div className="text-sm text-muted-foreground">
        {product.DESCR || "-"}
      </div>
      <div className="text-xs text-muted-foreground">
        {product.BRAND || "-"} · {product.MODEL || "-"}
      </div>
    </div>
  );
}

export default function ProductRelatedScreen() {
  const { state, actions } = useProductRelated();

  const [pickQuery, setPickQuery] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [pickResults, setPickResults] = useState<ProductSummary[]>([]);

  const [addQuery, setAddQuery] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addResults, setAddResults] = useState<ProductSummary[]>([]);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<ProductSummary | null>(null);
  const [addTargetGroupIds, setAddTargetGroupIds] = useState<string[]>([]);
  const [addTargetLoading, setAddTargetLoading] = useState(false);

  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RelatedUnionItem | null>(
    null,
  );

  const groupLabelMap = useMemo(
    () => new Map(state.groups.map((group) => [group.groupId, group.label])),
    [state.groups],
  );

  async function handlePickSearch(e?: FormEvent) {
    e?.preventDefault();
    setPickLoading(true);
    const results = await actions.searchCatalog(pickQuery);
    setPickResults(results);
    setPickLoading(false);
  }

  async function handleAddSearch(e?: FormEvent) {
    e?.preventDefault();
    if (!state.selected) return;
    setAddLoading(true);
    const results = await actions.searchCatalog(addQuery);
    setAddResults(
      results.filter((item) => item.BCODE !== state.selected?.BCODE),
    );
    setAddLoading(false);
  }

  async function openAddDialog(product: ProductSummary) {
    setAddTarget(product);
    setAddDialogOpen(true);
    setAddTargetLoading(true);
    const ids = await actions.getProductGroupIds(product.BCODE);
    setAddTargetGroupIds(ids);
    setAddTargetLoading(false);
  }

  const selectedSharedIds = useMemo(() => {
    if (!addTarget) return [] as string[];
    return (
      state.relatedUnion.find((item) => item.product.BCODE === addTarget.BCODE)
        ?.groupIds ?? []
    );
  }, [addTarget, state.relatedUnion]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          จัดการสินค้าที่ซื้อด้วยกัน
        </h1>
        <p className="text-sm text-muted-foreground">
          หน้าเดียวสำหรับเลือกสินค้าแม่ข่าย ดู related แบบ first-level
          จากทุกกลุ่มที่สินค้าอยู่ และค่อยเลือกว่าจะเพิ่มเข้า group ไหนตอนบันทึก
        </p>
      </div>

      {state.banner && (
        <Card
          className={
            state.banner.type === "error" ? "border-red-300" : undefined
          }
        >
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="text-sm">{state.banner.message}</div>
            <Button variant="ghost" size="sm" onClick={actions.clearBanner}>
              ปิด
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>ค้นหาสินค้าหลัก</CardTitle>
            <CardDescription>
              ค้นจาก BCODE / DESCR / BRAND / MODEL ใน
              raw_kcw.raw_hq_icmas_products
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2" onSubmit={handlePickSearch}>
              <Input
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                placeholder="เช่น BCODE หรือชื่อสินค้า"
              />
              <Button type="submit" disabled={pickLoading}>
                {pickLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Search />
                )}
                ค้นหา
              </Button>
            </form>

            <ScrollArea className="h-[520px] rounded-md border">
              <div className="space-y-2 p-3">
                {!pickResults.length ? (
                  <div className="text-sm text-muted-foreground">
                    ยังไม่มีผลลัพธ์
                  </div>
                ) : (
                  pickResults.map((item) => (
                    <div
                      key={item.BCODE}
                      className="flex items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <ProductMeta product={item} />
                      <Button
                        variant={
                          state.selected?.BCODE === item.BCODE
                            ? "secondary"
                            : "outline"
                        }
                        size="sm"
                        onClick={async () => {
                          await actions.selectProduct(item);
                          setPickQuery(item.BCODE);
                        }}
                      >
                        {state.selected?.BCODE === item.BCODE
                          ? "กำลังดู"
                          : "เลือก"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {!state.selected ? (
          <Card>
            <CardHeader>
              <CardTitle>ยังไม่ได้เลือกสินค้า</CardTitle>
              <CardDescription>
                เลือกสินค้าจากช่องซ้ายก่อน แล้วหน้าจอนี้จะโหลดกลุ่มและ related
                ให้
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle>สินค้าที่เลือก</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{state.selected.BCODE}</Badge>
                    <Badge variant="secondary">
                      {state.selectedGroupIds.length} กลุ่ม
                    </Badge>
                    <Badge variant="secondary">
                      {state.relatedUnion.length} related
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void actions.refreshSelected()}
                  disabled={state.loadingContext || state.saving}
                >
                  {state.loadingContext ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  รีเฟรช
                </Button>
              </CardHeader>
              <CardContent>
                <ProductMeta product={state.selected} />
              </CardContent>
            </Card>

            <Tabs defaultValue="related" className="space-y-4">
              <TabsList>
                <TabsTrigger value="related">Related</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
              </TabsList>

              <TabsContent value="related" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>เพิ่ม related</CardTitle>
                    <CardDescription>
                      ค้นหาสินค้าที่จะเพิ่ม
                      แล้วค่อยเลือกว่าจะใส่ในกลุ่มเดิมกลุ่มไหน
                      หรือสร้างกลุ่มใหม่
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form className="flex gap-2" onSubmit={handleAddSearch}>
                      <Input
                        value={addQuery}
                        onChange={(e) => setAddQuery(e.target.value)}
                        placeholder="ค้นหาสินค้าที่จะเพิ่ม"
                      />
                      <Button
                        type="submit"
                        disabled={addLoading || state.saving}
                      >
                        {addLoading ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Search />
                        )}
                        ค้นหา
                      </Button>
                    </form>

                    <div className="space-y-2">
                      {!addResults.length ? (
                        <div className="text-sm text-muted-foreground">
                          ยังไม่มีผลลัพธ์สำหรับการเพิ่ม
                        </div>
                      ) : (
                        addResults.map((item) => {
                          const shared = state.relatedUnion.find(
                            (related) => related.product.BCODE === item.BCODE,
                          );

                          return (
                            <div
                              key={item.BCODE}
                              className="flex items-start justify-between gap-3 rounded-md border p-3"
                            >
                              <div className="space-y-2">
                                <ProductMeta product={item} />
                                {!!shared?.groupIds.length && (
                                  <div className="flex flex-wrap gap-2">
                                    {shared.groupIds.map((groupId) => (
                                      <Badge key={groupId} variant="outline">
                                        {groupLabelMap.get(groupId) ?? groupId}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={state.saving}
                                onClick={() => void openAddDialog(item)}
                              >
                                <Link2 />
                                เลือกกลุ่ม
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Related แบบ first-level</CardTitle>
                    <CardDescription>
                      แสดง union ของสินค้าที่อยู่ร่วมกับสินค้าที่เลือกในทุกกลุ่ม
                      โดยไม่ไล่ต่อไปชั้นที่ 2
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!state.relatedUnion.length ? (
                      <div className="text-sm text-muted-foreground">
                        สินค้านี้ยังไม่มี related
                      </div>
                    ) : (
                      state.relatedUnion.map((item) => (
                        <div
                          key={item.product.BCODE}
                          className="flex items-start justify-between gap-3 rounded-md border p-3"
                        >
                          <div className="space-y-2">
                            <ProductMeta product={item.product} />
                            <div className="flex flex-wrap gap-2">
                              {item.groupIds.map((groupId) => (
                                <Badge key={groupId} variant="outline">
                                  {groupLabelMap.get(groupId) ?? groupId}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={state.saving}
                            onClick={() => {
                              setRemoveTarget(item);
                              setRemoveDialogOpen(true);
                            }}
                          >
                            <Unlink2 />
                            เอาออก
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="groups" className="space-y-4">
                {!state.groups.length ? (
                  <Card>
                    <CardContent className="py-6 text-sm text-muted-foreground">
                      สินค้านี้ยังไม่ได้อยู่ในกลุ่มใด ถ้าต้องการเริ่ม ให้เพิ่ม
                      related แล้วสร้างกลุ่มใหม่
                    </CardContent>
                  </Card>
                ) : (
                  state.groups.map((group) => (
                    <Card key={group.groupId}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Layers3 className="h-4 w-4" />
                              {group.label}
                            </CardTitle>
                            <CardDescription>
                              {group.members.length} รายการในกลุ่มนี้
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {group.members.map((member) => (
                          <div
                            key={`${group.groupId}-${member.BCODE}`}
                            className="flex items-start justify-between gap-3 rounded-md border p-3"
                          >
                            <div className="space-y-2">
                              <ProductMeta product={member} />
                              {member.BCODE === state.selected?.BCODE && (
                                <Badge variant="secondary">สินค้าหลัก</Badge>
                              )}
                            </div>
                            {member.BCODE !== state.selected?.BCODE && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={state.saving}
                                onClick={() =>
                                  void actions.removeProductFromGroup(
                                    group.groupId,
                                    member.BCODE,
                                  )
                                }
                              >
                                <Unlink2 />
                                เอาออกจากกลุ่มนี้
                              </Button>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มสินค้าเข้า group</DialogTitle>
            <DialogDescription>
              เลือกว่าจะเพิ่มสินค้าเข้า group เดิมของสินค้าหลัก หรือสร้าง group
              ใหม่
            </DialogDescription>
          </DialogHeader>

          {!addTarget ? null : (
            <div className="space-y-4">
              <div className="rounded-md border p-3">
                <div className="text-sm text-muted-foreground">
                  สินค้าที่จะเพิ่ม
                </div>
                <ProductMeta product={addTarget} />
              </div>

              {addTargetLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังโหลดข้อมูลกลุ่มของสินค้าที่จะเพิ่ม...
                </div>
              ) : (
                <>
                  {!!addTargetGroupIds.length && (
                    <div className="text-sm text-muted-foreground">
                      สินค้านี้อยู่ใน {addTargetGroupIds.length} กลุ่มอยู่แล้ว
                      แต่หน้านี้จะไม่ merge ให้อัตโนมัติ
                    </div>
                  )}

                  <div className="space-y-2">
                    {state.groups.map((group) => {
                      const alreadyInGroup = selectedSharedIds.includes(
                        group.groupId,
                      );
                      return (
                        <Button
                          key={group.groupId}
                          variant="outline"
                          className="w-full justify-between"
                          disabled={state.saving || alreadyInGroup}
                          onClick={async () => {
                            await actions.addProductToGroup(
                              group.groupId,
                              addTarget,
                            );
                            setAddDialogOpen(false);
                          }}
                        >
                          <span>{group.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {alreadyInGroup
                              ? "อยู่ในกลุ่มนี้แล้ว"
                              : "เพิ่มเข้ากลุ่มนี้"}
                          </span>
                        </Button>
                      );
                    })}

                    <Button
                      className="w-full"
                      disabled={state.saving}
                      onClick={async () => {
                        await actions.createNewGroupWith(addTarget);
                        setAddDialogOpen(false);
                      }}
                    >
                      <Link2 />
                      สร้าง group ใหม่
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เอา related ออก</DialogTitle>
            <DialogDescription>
              เลือกว่าจะลบความสัมพันธ์ออกจากกลุ่มไหนบ้าง
            </DialogDescription>
          </DialogHeader>

          {!removeTarget ? null : (
            <div className="space-y-4">
              <div className="rounded-md border p-3">
                <ProductMeta product={removeTarget.product} />
              </div>

              <div className="space-y-2">
                {removeTarget.groupIds.map((groupId) => (
                  <Button
                    key={groupId}
                    variant="outline"
                    className="w-full justify-between"
                    disabled={state.saving}
                    onClick={async () => {
                      await actions.removeProductFromGroup(
                        groupId,
                        removeTarget.product.BCODE,
                      );
                      setRemoveDialogOpen(false);
                    }}
                  >
                    <span>{groupLabelMap.get(groupId) ?? groupId}</span>
                    <span className="text-xs text-muted-foreground">
                      ลบจากกลุ่มนี้
                    </span>
                  </Button>
                ))}

                {removeTarget.groupIds.length > 1 && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={state.saving}
                    onClick={async () => {
                      await actions.removeProductFromGroups(
                        removeTarget.groupIds,
                        removeTarget.product.BCODE,
                      );
                      setRemoveDialogOpen(false);
                    }}
                  >
                    <Unlink2 />
                    ลบออกจากทุกกลุ่มที่แชร์กับสินค้าหลัก
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
