import { describe, expect, it } from "vitest";
import { parseReceiptText } from "./parse-receipt";

const today = "2025-09-15";
const parse = (text: string) => parseReceiptText(text, { today });

describe("parseReceiptText: shop receipts", () => {
  it("reads a supermarket till receipt", () => {
    const r = parse(`
      99 SPEEDMART SDN BHD
      (Co. No. 123456-X)
      LOT 12, JALAN KINRARA
      Tel: 03-8070 0000
      TAX INVOICE
      Date: 12/08/2025 Time: 18:42
      MILO 3IN1 18S        1 x 15.90   15.90
      GARDENIA BREAD       1 x  4.20    4.20
      SUB TOTAL                       20.10
      SST 0%                           0.00
      ROUNDING ADJ                    -0.00
      TOTAL                     RM 20.10
      CASH                             50.00
      CHANGE                           29.90
      THANK YOU, PLEASE COME AGAIN
    `);
    expect(r).toEqual({
      amountCents: 2010,
      amountConfidence: "high",
      date: "2025-08-12",
      merchant: "99 SPEEDMART SDN BHD",
      type: "expense",
    });
  });

  it("prefers GRAND TOTAL over TOTAL, and ignores tax/service lines", () => {
    const r = parse(`
      KEDAI MAMAK ABBAS
      12-08-25 13:05
      Total Food            28.00
      Service Charge 10%     2.80
      SST 6%                 1.68
      Grand Total RM        32.48
    `);
    expect(r).toMatchObject({ amountCents: 3248, amountConfidence: "high", date: "2025-08-12", merchant: "KEDAI MAMAK ABBAS" });
  });

  it("finds an amount printed on the line after its label", () => {
    const r = parse("FAMILYMART\nJUMLAH\nRM 6.40\n03 Aug 2025");
    expect(r).toMatchObject({ amountCents: 640, date: "2025-08-03" });
  });

  it("handles OCR comma decimals and thousands separators", () => {
    expect(parse("SHOP A\nTOTAL RM 12,50").amountCents).toBe(1250);
    expect(parse("FURNITURE CO\nTOTAL RM 1,234.50").amountCents).toBe(123450);
  });

  it("falls back to the largest amount with low confidence when nothing is labelled", () => {
    const r = parse("PASAR MALAM STALL\n3.50\n12.00\n2.00");
    expect(r).toMatchObject({ amountCents: 1200, amountConfidence: "low" });
  });

  it("returns nulls when nothing is readable", () => {
    expect(parse("~~ blurry ~~")).toEqual({
      amountCents: null,
      amountConfidence: "low",
      date: null,
      merchant: "blurry",
      type: "expense",
    });
  });
});

describe("parseReceiptText: banking and e-wallet receipts", () => {
  it("reads a DuitNow transfer confirmation", () => {
    const r = parse(`
      Transaction Successful
      RM 15.50
      Transfer to
      JHSS RESOURCES
      Reference ID 2025081412345
      Date 14 Aug 2025, 09:12 AM
      Amount RM 15.50
    `);
    expect(r).toMatchObject({ amountCents: 1550, date: "2025-08-14", merchant: "JHSS RESOURCES", type: "expense" });
  });

  it("detects money received as income", () => {
    const r = parse(`
      You received RM 500.00
      Received from: DORA BINTI ALI
      Amount RM 500.00
      Date 01/08/2025
    `);
    expect(r).toMatchObject({ amountCents: 50000, type: "income", merchant: "DORA BINTI ALI", date: "2025-08-01" });
  });

  it("reads a Grab e-receipt", () => {
    const r = parse(`
      Hope you enjoyed your ride!
      GrabCar
      Booking ID: A-123456789
      Picked up on 22 August 2025
      Fare RM 8.00
      Platform fee RM 1.00
      Total Paid RM 9.00
    `);
    expect(r).toMatchObject({ amountCents: 900, date: "2025-08-22" });
  });

  it("reads a Foodpanda e-receipt with US-style date", () => {
    const r = parse("foodpanda\nOrder ID: x1y2\nAug 20, 2025\nSubtotal RM 22.50\nDelivery fee RM 2.99\nOrder Total RM 25.49");
    expect(r).toMatchObject({ amountCents: 2549, date: "2025-08-20", merchant: "foodpanda" });
  });

  it("understands Malay month names", () => {
    expect(parse("KEDAI RUNCIT\n5 Ogos 2025\nJUMLAH 7.00").date).toBe("2025-08-05");
    expect(parse("KEDAI RUNCIT\n25 Dis 2024\nJUMLAH 7.00").date).toBe("2024-12-25");
  });
});

describe("parseReceiptText: dates", () => {
  it("ignores future dates and very old ones", () => {
    expect(parse("SHOP\nExpiry 12/2030\nDate 01/09/2025\nTOTAL 1.00").date).toBe("2025-09-01");
    expect(parse("SHOP\n12/12/2026\nTOTAL 1.00").date).toBeNull();
    expect(parse("SHOP\nSince 01/01/1999\nTOTAL 1.00").date).toBeNull();
  });

  it("accepts ISO dates and rejects impossible ones", () => {
    expect(parse("SHOP\n2025-08-31\nTOTAL 1.00").date).toBe("2025-08-31");
    expect(parse("SHOP\n31/02/2025\nTOTAL 1.00").date).toBeNull();
  });

  it("does not mistake dates or times for amounts", () => {
    expect(parse("SHOP\n12.08.2025 18.42\nTOTAL 3.00").amountCents).toBe(300);
  });
});
