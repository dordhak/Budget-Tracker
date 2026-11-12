// Synthetic fixture modelled on the user's August 2025 Maybank Islamic savings statement.
// Amounts, dates, merchants and page breaks follow the real statement; personal names,
// phone and account numbers are replaced. Pages 1–8 are laid out by the builder
// (41 lines/page reproduces the real page breaks); page 9 copies the real reflowed
// coordinates, where descriptions no longer line up with the date rows.
import { buildStatement, r, type FixtureRow } from "./statement-builder";

const SD = "SALE DEBIT";
const sale = (date: string, amount: string, merchant: string, location: string) =>
  r(date, amount, SD, merchant, location, SD);
const ibk = (date: string, amount: string, payee: string, ref: string) =>
  r(date, amount, "IBK FUND TFR FR A/C", payee, ref, "DUITNOW QR");

export const AUG_2025_ROWS: FixtureRow[] = [
  // page 1
  ibk("01/08/25", "21.00-", "JHSS RESOURCES *", "84753433"),
  r("01/08/25", "500.00+", "FUND TRANSFER TO A/", "PAYEE A*", "REF0001", "Allowance"),
  r("01/08/25", "550.00+", "FUND TRANSFER TO A/", "PAYEE A*", "REF0002", "Rental"),
  r("02/08/25", "550.00-", "IBK FUND TFR FR A/C", "PAYEE B *", "7000000001"),
  r("02/08/25", "7.91-", "IBK FUND TFR FR A/C", "PAYEE B *", "7000000001"),
  sale("02/08/25", "10.00-", "TNG-EWALLET ECOM 2-*", "KUALA LUMPUR, MY"),
  sale("02/08/25", "5.00-", "TNG-EWALLET ECOM 2-*", "KUALA LUMPUR, MY"),
  sale("02/08/25", "18.90-", "Kaiflex Sdn. Bhd. -*", "Kota Damansar, MY"),
  ibk("02/08/25", "14.30-", "JHSS RESOURCES *", "86862825"),
  sale("02/08/25", "3.60-", "99 SPEEDMART-2592 *", "KUALA LUMPUR, MY"),
  sale("03/08/25", "3.50-", "KK SUPER MART-EPM *", "KUALA LUMPUR, MY"), // continues onto page 2
  // page 2
  sale("03/08/25", "5.30-", "RAPID RAIL-AGL (TOK*", "PETALING JAYA, MY"),
  sale("03/08/25", "6.40-", "FAMILYMART-LRT JAME*", "KUALA LUMPUR, MY"),
  sale("03/08/25", "49.20-", "VILLAGE GROCER-KL G*", "KUALA LUMPUR, MY"),
  r("03/08/25", "5.00-", "PYMT FROM A/C", "Kedai Mamak Abbas *", "503672529Q", "QR PAY SALES"),
  r("04/08/25", "30.00-", "PYMT FROM A/C", "UMOBILE *", "PREPAID RELOAD", "0110000000"),
  r("05/08/25", "3.00-", "IBK FUND TFR FR A/C", "SM GEGA ENTERPRISE *", "74460332", "DUITNOW QR"),
  r("05/08/25", "2,090.47+", "IBK FUND TFR TO A/C", "Wise Payments Malay*", "TW1321430000 PAYEE G", "MBB CT-"),
  r("05/08/25", "114.40-", "TRANSFER FROM A/C", "MBBQR2113909 *", "11112214856041", "638305808Q"),
  sale("05/08/25", "5.30-", "RAPID RAIL-KJL (TOK*", "PETALING JAYA, MY"),
  sale("05/08/25", "3.40-", "KK SUPER MART-EPM *", "KUALA LUMPUR, MY"), // end marker on page 3
  // page 3
  sale("06/08/25", "7.65-", "99 SPEEDMART-2592 *", "KUALA LUMPUR, MY"),
  r("07/08/25", "5.40-", SD, "Kuala Lumpur, MY", SD),
  sale("08/08/25", "10.65-", "TNG-EWALLET ECOM 2-*", "KUALA LUMPUR, MY"),
  ibk("08/08/25", "21.50-", "JHSS RESOURCES *", "86281514"),
  sale("09/08/25", "10.00-", "TNG-EWALLET ECOM 2-*", "KUALA LUMPUR, MY"),
  sale("09/08/25", "6.40-", "FAMILYMART-LRT JAME*", "KUALA LUMPUR, MY"),
  sale("11/08/25", "16.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  sale("11/08/25", "2.30-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  sale("11/08/25", "18.90-", "Kaiflex Sdn. Bhd. -*", "Kota Damansar, MY"),
  sale("11/08/25", "10.00-", "TNG-EWALLET ECOM 2-*", "KUALA LUMPUR, MY"),
  ibk("13/08/25", "30.00-", "DAILY BUTCHER ENT *", "70348897"), // 3 lines continue onto page 4
  // page 4
  r("13/08/25", "8.00-", "TRANSFER FROM A/C", "PAYEE C*", "243380430Q", "MAE QR"),
  ibk("14/08/25", "37.20-", "PAYEE D *", "84197783"),
  sale("14/08/25", "18.90-", "MR DIY (M) SB-ASR *", "KUALA LUMPUR, MY"),
  ibk("14/08/25", "15.50-", "JHSS RESOURCES *", "84955862"),
  sale("15/08/25", "49.65-", "Foodpanda Malaysia *", "0122000000, MY"),
  sale("16/08/25", "8.00-", "KK SUPER MART-EPM *", "KUALA LUMPUR, MY"),
  r("16/08/25", "19.00-", "TRANSFER FROM A/C", "SELF*"),
  sale("16/08/25", "20.00-", "Foodpanda Malaysia *", "0122000000, MY"),
  sale("16/08/25", "6.80-", "99 SPEEDMART-2592 *", "KUALA LUMPUR, MY"),
  r("16/08/25", "4.41-", "PRE-AUTH DEBIT", "GOOGLE *TEMPORARY H*", SD),
  r("16/08/25", "4.41+", "PRE-AUTH REFUND", "GOOGLE *SERVICES *", "650-253-0000, US", SD), // continues onto page 5
  // page 5
  sale("17/08/25", "28.50-", "Foodpanda Malaysia *", "0122000000, MY"),
  sale("18/08/25", "4.90-", "KK SUPER MART-EPM *", "KUALA LUMPUR, MY"),
  ibk("18/08/25", "19.30-", "JHSS RESOURCES *", "81543277"),
  r("18/08/25", "11.00-", SD, "Kuala Lumpur, MY", SD),
  sale("19/08/25", "9.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  ibk("19/08/25", "15.50-", "JHSS RESOURCES *", "70369956"),
  ibk("20/08/25", "17.50-", "JHSS RESOURCES *", "83778040"),
  sale("20/08/25", "25.49-", "Foodpanda Malaysia *", "0122000000, MY"),
  sale("20/08/25", "5.50-", "KK SUPER MART-EPM *", "KUALA LUMPUR, MY"),
  sale("21/08/25", "9.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  // page 6
  ibk("21/08/25", "15.50-", "JHSS RESOURCES *", "73264228"),
  sale("22/08/25", "9.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  sale("22/08/25", "34.05-", "APU-SUBWAY *", "KUALA LUMPUR, MY"),
  sale("22/08/25", "3.50-", "APU-BILABILA RETAIL*", "KUALA LUMPUR, MY"),
  sale("22/08/25", "18.90-", "Woodsage Sdn. Bhd. *", "Pusat Bandar, MY"),
  sale("22/08/25", "111.00-", "MR DIY SB-PPAV *", "KUALA LUMPUR, MY"),
  sale("23/08/25", "7.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  sale("23/08/25", "69.75-", "AEON BIG-SRI PETALI*", "KUALA LUMPUR, MY"),
  ibk("24/08/25", "15.00-", "PAYEE E*", "80399276"),
  ibk("24/08/25", "24.80-", "JHSS RESOURCES *", "77478802"),
  // page 7
  sale("25/08/25", "13.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  sale("25/08/25", "2.30-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  ibk("25/08/25", "13.50-", "SM GEGA ENTERPRISE *", "81949152"),
  sale("26/08/25", "8.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  sale("26/08/25", "2.70-", "APU-BILABILA RETAIL*", "KUALA LUMPUR, MY"),
  sale("26/08/25", "46.45-", "AEON BIG-SRI PETALI*", "KUALA LUMPUR, MY"),
  sale("26/08/25", "57.30-", "MR DIY (M) SB-ASR *", "KUALA LUMPUR, MY"),
  sale("26/08/25", "12.95-", "99 SPEEDMART-2592 *", "KUALA LUMPUR, MY"),
  sale("26/08/25", "21.19-", "Foodpanda Malaysia *", "0122000000, MY"),
  r("27/08/25", "11.70-", SD, "Kuala Lumpur, MY", SD),
  sale("28/08/25", "9.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  // page 8
  sale("28/08/25", "3.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  sale("28/08/25", "4.30-", "APU-BILABILA RETAIL*", "KUALA LUMPUR, MY"),
  r("28/08/25", "1,263.00+", "IBK FUND TFR TO A/C", "Wise Payments Malay*", "TW1350459967 Sent vi", "MBB CT-"),
  sale("28/08/25", "10.00-", "TNG-EWALLET ECOM 2-*", "KUALA LUMPUR, MY"),
  sale("28/08/25", "13.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  r("29/08/25", "13.99-", "PRE-AUTH DEBIT", "APPLE.COM/BILL *", "ITUNES.COM, IE", SD),
  sale("29/08/25", "9.00-", "GRAB RIDES-EC *", "PETALING JAYA, MY"),
  sale("29/08/25", "4.10-", "APU-BILABILA RETAIL*", "KUALA LUMPUR, MY"),
  ibk("29/08/25", "20.00-", "PAYEE F *", "87921693"),
  // Last row of page 8: its "SALE DEBIT" end marker is on page 9.
  r("29/08/25", "16.00-", SD, "GRAB RIDES-EC *", "PETALING JAYA, MY"),
];

/** Page 9 body exactly as extracted from the real PDF (reflowed descriptions). */
const t = (x: number, y: number, str: string) => ({ x, y, str });
export const AUG_2025_PAGE_9 = [
  t(91.2, 596.8, "SALE DEBIT SALE DEBIT"),
  t(43.4, 585.2, "29/08/25"), t(374.4, 585.2, "8.40-"), t(450.0, 585.2, "3,545.64"),
  t(87.7, 584.8, "APU-BILABILA"), t(151.5, 584.8, "RETAIL*"),
  t(87.7, 572.8, "KUALA"), t(124.9, 572.8, "LUMPUR,"), t(171.0, 572.8, "MY"),
  t(87.7, 560.8, "SALE"), t(117.6, 560.8, "DEBIT"), t(152.1, 560.8, "REFUND"),
  t(87.7, 548.8, "SALE"), t(120.1, 548.8, "GRAB"), t(147.3, 548.8, "RIDES-EC"),
  t(43.4, 537.2, "29/08/25"), t(367.1, 537.2, "16.00+"), t(450.0, 537.2, "3,561.64"),
  t(87.7, 536.8, "PETALING"), t(137.4, 536.8, "JAYA,"), t(171.0, 536.8, "MY"),
  t(166.9, 524.8, "*"), t(87.7, 524.8, "SALE DEBIT SALE DEBIT"),
  t(87.7, 512.8, "Foodpanda"), t(137.0, 512.8, "Malaysia"), t(177.4, 512.8, "*"),
  t(87.7, 500.8, "0122000000,"), t(140.2, 500.8, "MY"), t(164.0, 500.8, "SALE"),
  t(43.4, 489.2, "29/08/25"), t(370.0, 489.2, "21.19-"), t(450.0, 489.2, "3,540.45"),
  t(87.7, 488.8, "DEBIT SALE DEBIT"), t(162.0, 488.8, "GRAB"),
  t(87.7, 476.8, "RIDES-EC"), t(145.8, 476.8, "PETALING"),
  t(87.7, 464.8, "JAYA,"), t(113.5, 464.8, "MY"), t(135.9, 464.8, "SALE"), t(159.5, 464.8, "DEBIT"),
  t(87.7, 452.8, "SALE"), t(110.7, 452.8, "DEBIT"), t(143.7, 452.8, "McDonalds"),
  t(43.4, 441.2, "30/08/25"), t(374.4, 441.2, "9.00-"), t(450.0, 441.2, "3,531.45"),
  t(87.7, 440.8, "1010338"), t(123.1, 440.8, "*"), t(137.3, 440.8, "Sri"), t(151.3, 440.8, "Petaling,"),
  t(87.7, 428.8, "MY"), t(111.3, 428.8, "SALE"), t(135.4, 428.8, "DEBIT"), t(164.1, 428.8, "SALE"), t(166.9, 428.8, "*"),
  t(87.7, 416.8, "DEBIT"), t(120.8, 416.8, "99"), t(135.0, 416.8, "SPEEDMART-"),
  t(87.7, 404.8, "2592 *"), t(121.8, 404.8, "KUALA LUMPUR,"),
  t(43.4, 393.2, "30/08/25"), t(370.0, 393.2, "42.00-"), t(450.0, 393.2, "3,489.45"),
  t(87.7, 392.8, "MY"), t(111.3, 392.8, "SALE"), t(135.4, 392.8, "DEBIT"), t(164.1, 392.8, "SALE"),
  t(87.7, 380.8, "DEBIT"), t(142.8, 380.8, "Foodpanda"),
  t(87.7, 368.8, "Malaysia *"), t(135.7, 368.8, "0122000000,"),
  t(87.7, 356.8, "MY"), t(103.5, 356.8, "SALE DEBIT"),
  t(43.4, 345.2, "30/08/25"), t(370.0, 345.2, "15.90-"), t(450.0, 345.2, "3,473.55"),
  t(43.4, 297.2, "31/08/25"), t(370.0, 297.2, "21.99-"), t(450.0, 297.2, "3,451.56"),
  t(87.7, 212.8, "ENDING BALANCE :"), t(361.8, 212.8, "3,451.56"),
  t(87.7, 200.8, "TOTAL CREDIT :"), t(361.8, 200.8, "4,423.88"),
  t(87.7, 188.8, "TOTAL DEBIT :"), t(361.8, 188.8, "2,046.62"),
  t(63.0, 164.8, "PROTECTED BY PIDM UP TO RM250,000 FOR EACH DEPOSITOR"),
  t(318.9, 164.8, "SAVINGS ACCOUNT-I"),
];

export function augustStatementItems() {
  return buildStatement({
    statementDate: "31/08/25",
    opening: "1,074.30",
    rows: AUG_2025_ROWS,
    extraPages: [AUG_2025_PAGE_9],
  });
}
