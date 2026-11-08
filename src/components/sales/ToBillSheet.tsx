import type { ReactNode } from "react";

import { numberToThaiWords } from "@/lib/utils";
import {
  ROLE_APPROVER,
  ROLE_ISSUER,
  TO_BILL_COMPANY,
  formatSheetMoney,
  formatSheetQty,
  isReceiptDoc,
  payViaLabel,
  sheetSigners,
  shopLabel,
  signerDisplayName,
  thaiLongDate,
  thaiSlashDate,
  type ToBillSheetData,
  type ToBillSigner,
} from "@/lib/sales/to-bill-sheet";

import "./to-bill-sheet.css";

function Field({
  label,
  children,
  pre = false,
}: {
  label: string;
  children: ReactNode;
  pre?: boolean;
}) {
  return (
    <>
      <div className="k">{label}</div>
      <div className={pre ? "pre" : undefined}>{children}</div>
    </>
  );
}

function SignatureBlock({
  title,
  signer,
  signedOn,
}: {
  title: string;
  signer?: ToBillSigner | null;
  signedOn?: string;
}) {
  return (
    <section>
      <h3>{title}</h3>
      <div className="hand">
        {signer ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signer.image} alt="" />
        ) : null}
      </div>
      <div className="sig-fields">
        <span>ลายมือชื่อ</span>
        <span className="line" />
        <span>ชื่อ</span>
        <span className="line">{signer ? signerDisplayName(signer) : ""}</span>
        <span>วันที่</span>
        <span className="line">{signer ? signedOn || "" : ""}</span>
      </div>
    </section>
  );
}

function Article({
  bill,
  copyLabel,
}: {
  bill: ToBillSheetData;
  copyLabel: "ต้นฉบับ" | "สำเนา";
}) {
  const receipt = isReceiptDoc(bill.docno);
  const heading = receipt ? "ใบเสร็จรับเงิน" : "ใบกำกับภาษี";
  const voided = bill.status === "void";
  const shop = shopLabel(bill.acctname_kss, bill.acctno);
  const paid = payViaLabel(bill.pay_via);
  const signedOn = thaiLongDate(bill.issued_at || bill.bill_date);
  const [issuer, approver] = sheetSigners(bill.issued_by || "");
  const note = receipt ? (
    <>
      <span className="keep">
        {bill.source_docno
          ? `อ้างอิงใบกำกับภาษี ${bill.source_docno}`
          : "อ้างอิงใบกำกับภาษี"}
      </span>{" "}
      <span className="keep">จากใบกำกับภาษีอย่างย่อ {bill.tad_billno}</span>
    </>
  ) : (
    <>
      <span className="keep">ออกแทนใบกำกับภาษีอย่างย่อ {bill.tad_billno}</span>{" "}
      <span className="keep">
        วันที่ {thaiSlashDate(bill.bill_date)} ซึ่งยกเลิกแล้ว
      </span>
    </>
  );

  return (
    <article className="tof">
      {voided ? <div className="void">ยกเลิก</div> : null}
      <div className="top">
        <div className="brand">
          <div className="logo">KCW</div>
          <div className="co">{TO_BILL_COMPANY.name}</div>
          <div className="addr">
            {TO_BILL_COMPANY.address}
            <br />
            โทร {TO_BILL_COMPANY.phone} · {TO_BILL_COMPANY.branch}
          </div>
          <div className="addr">เลขประจำตัวผู้เสียภาษี {TO_BILL_COMPANY.taxId}</div>
        </div>
        <div className="doc">
          <h1>{heading}</h1>
          <p className="mark">({copyLabel})</p>
        </div>
      </div>
      <div className="rule" />
      <div className="boxes">
        <div className="box">
          <div className="who">
            <Field label="ลูกค้า">
              <span className="name">{bill.customer_name || "—"}</span>
            </Field>
            <Field label="ที่อยู่" pre>
              {bill.address || "—"}
            </Field>
          </div>
          <div className="fields">
            <Field label="เลขประจำตัวผู้เสียภาษี">
              <span className="wide-v">{bill.tax_id || "—"}</span>
            </Field>
            <Field label="สาขา">{bill.branch_label || "—"}</Field>
            {bill.phone ? <Field label="โทร">{bill.phone}</Field> : null}
            {bill.email ? <Field label="อีเมล">{bill.email}</Field> : null}
          </div>
        </div>
        <div className="box">
          <div className="fields">
            <Field label="เลขที่เอกสาร">
              <span className="no">{bill.docno}</span>
            </Field>
            <Field label="วันที่">{thaiLongDate(bill.bill_date)}</Field>
            {bill.online_po ? <Field label="เลขคำสั่งซื้อ">{bill.online_po}</Field> : null}
            <Field label="อ้างอิง">{bill.tad_billno}</Field>
            {shop ? <Field label="ร้านค้า">{shop}</Field> : null}
            <Field label="ออกเอกสาร">{thaiLongDate(bill.issued_at || bill.bill_date)}</Field>
            {receipt && paid ? <Field label="การชำระเงิน">{paid}</Field> : null}
          </div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th className="ctr">#</th>
            <th>รหัส</th>
            <th>รายละเอียด</th>
            <th className="num">จำนวน</th>
            <th className="num">ราคา</th>
            <th className="num">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.length === 0 ? (
            <tr>
              <td colSpan={6}>ไม่มีรายการ</td>
            </tr>
          ) : (
            bill.lines.map((line, index) => (
              <tr key={`${line.bcode ?? "line"}-${index}`}>
                <td className="ctr">{index + 1}</td>
                <td className="font-mono">{line.bcode || ""}</td>
                <td>{line.detail || ""}</td>
                <td className="num">
                  {formatSheetQty(line.qty)}
                  {line.ui ? ` ${line.ui}` : ""}
                </td>
                <td className="num">{formatSheetMoney(line.price)}</td>
                <td className="num">{formatSheetMoney(line.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="foot">
        <div className="note">{note}</div>
        <div className="tot">
          {bill.discount ? (
            <div className="row">
              <span>ส่วนลด</span>
              <span>{formatSheetMoney(bill.discount)}</span>
            </div>
          ) : null}
          <div className="row">
            <span>ก่อนภาษี</span>
            <span>{formatSheetMoney(bill.beforetax)}</span>
          </div>
          <div className="row">
            <span>ภาษีมูลค่าเพิ่ม</span>
            <span>{formatSheetMoney(bill.tax)}</span>
          </div>
          <div className="row net">
            <span>รวมทั้งสิ้น</span>
            <span>{formatSheetMoney(bill.aftertax)}</span>
          </div>
          <div className="words">({numberToThaiWords(bill.aftertax)})</div>
        </div>
      </div>
      {voided && bill.void_reason ? (
        <p className="reason">เหตุผลที่ยกเลิก: {bill.void_reason}</p>
      ) : null}
      <div className="sign">
        <SignatureBlock
          title={`${ROLE_ISSUER} (ผู้ขาย)`}
          signer={issuer}
          signedOn={signedOn}
        />
        <SignatureBlock
          title={`${ROLE_APPROVER} (ผู้ขาย)`}
          signer={approver}
          signedOn={signedOn}
        />
        <SignatureBlock title="ผู้รับเอกสาร (ลูกค้า)" />
      </div>
    </article>
  );
}

export default function ToBillSheet({ bill }: { bill: ToBillSheetData }) {
  return (
    <div>
      <Article bill={bill} copyLabel="ต้นฉบับ" />
      <Article bill={bill} copyLabel="สำเนา" />
    </div>
  );
}
