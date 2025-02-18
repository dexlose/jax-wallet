import * as dashcore from "dashcore-lib"

export interface IUtxo {
  txId: string
  vout: number
  value: number
  rawTx?: string
  script?: string
}

export interface SimulateResult {
  fee: number
  vsize: number
}

export type SimulateAllResult =
  | { success: true; sendValue: number }
  | { success: false; error: string }

async function getUtxosDash(address: string): Promise<IUtxo[]> {
  const ur = `/api/dash/utxo?address=${encodeURIComponent(address)}`
  const resp = await fetch(ur)
  if (!resp.ok) {
    throw new Error("getUtxosDash => " + resp.status)
  }
  const data = await resp.json()
  if (!Array.isArray(data.utxo)) {
    return []
  }
  const out: IUtxo[] = data.utxo.map((x: any) => ({
    txId: x.txid,
    vout: x.vout,
    value: x.value,
    rawTx: undefined,
    script: x.script
  }))
  return out
}

async function getFeeRateDash(): Promise<number> {
  const ur = `/api/dash/feeRate`
  try {
    const re = await fetch(ur)
    if (!re.ok) throw new Error("No recommended fee data => Dash")
    const j = await re.json()
    const r = j.feeRate
    if (typeof r !== "number" || r < 1) return 5
    return r
  } catch {
    return 5
  }
}

async function pushDash(rawhex: string): Promise<string> {
  const ur = `/api/dash/broadcast`
  const rr = await fetch(ur, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawHex: rawhex })
  })
  if (!rr.ok) {
    const t = await rr.text()
    throw new Error("pushDash => " + t)
  }
  const j = await rr.json()
  if (!j.txid) {
    throw new Error("No txid returned from DASH broadcast")
  }
  return j.txid
}

export async function simulateDashUtxoTx(
  priv: string,
  toAddr: string,
  amountSat: number
): Promise<SimulateResult | null> {
  const pk = new dashcore.PrivateKey(priv.trim())
  const fromAddr = pk.toAddress().toString()
  const ut = await getUtxosDash(fromAddr)
  if (!ut.length) return null
  const feeRate = await getFeeRateDash()
  const tot = ut.reduce((a, x) => a + x.value, 0)
  const vsize = 10 + ut.length * 148 + 2 * 34
  let fee = vsize * feeRate
  if (fee < 667) fee = 667
  if (amountSat + fee > tot) return null
  return { fee, vsize }
}

export async function simulateAllDashUtxoTx(priv: string): Promise<SimulateAllResult> {
  const pk = new dashcore.PrivateKey(priv.trim())
  const fromAddr = pk.toAddress().toString()
  const ut = await getUtxosDash(fromAddr)
  if (!ut.length) return { success: false, error: "No dash => " + fromAddr }
  const feeRate = await getFeeRateDash()
  const tot = ut.reduce((a, x) => a + x.value, 0)
  const vsize = 10 + ut.length * 148 + 34
  let fee = vsize * feeRate
  if (fee < 667) fee = 667
  if (fee >= tot) return { success: false, error: "Not enough => dash => all" }
  const leftover = tot - fee
  return { success: true, sendValue: leftover }
}

export async function sendExactDashUtxoTx(
  priv: string,
  toAddr: string,
  amountStr: string
): Promise<string> {
  const pk = new dashcore.PrivateKey(priv.trim())
  const amt = Math.floor(parseFloat(amountStr) * 1e8)
  const raw = await buildDashPartial(pk, toAddr, amt)
  return pushDash(raw)
}

export async function sendAllDashUtxoTx(
  priv: string,
  toAddr: string
): Promise<string> {
  const pk = new dashcore.PrivateKey(priv.trim())
  const raw = await buildDashAll(pk, toAddr)
  return pushDash(raw)
}

async function buildDashPartial(
  pk: dashcore.PrivateKey,
  toAddr: string,
  amtSat: number
): Promise<string> {
  const fromAddr = pk.toAddress().toString()
  const ut = await getUtxosDash(fromAddr)
  if (!ut.length) throw new Error("No dash => partial => " + fromAddr)
  const feeRate = await getFeeRateDash()
  const tot = ut.reduce((a, x) => a + x.value, 0)
  const vsize = 10 + ut.length * 148 + 2 * 34
  let fee = vsize * feeRate
  if (fee < 667) fee = 667
  if (amtSat + fee > tot) throw new Error("Not enough => partial => dash")
  let leftover = tot - amtSat - fee
  if (leftover < 546) {
    leftover = 0
    if (amtSat + fee > tot) {
      throw new Error("Still not enough => dash partial")
    }
  }
  const inputs = ut.map(x => ({
    txid: x.txId,
    outputIndex: x.vout,
    satoshis: x.value,
    script: x.script ? x.script : dashcore.Script.fromAddress(fromAddr).toString()
  }))
  const tx = new dashcore.Transaction().from(inputs).to(toAddr, amtSat)
  if (leftover > 0) {
    tx.to(fromAddr, leftover)
  }
  tx.sign(pk)
  return tx.serialize()
}

async function buildDashAll(
  pk: dashcore.PrivateKey,
  toAddr: string
): Promise<string> {
  const fromAddr = pk.toAddress().toString()
  const ut = await getUtxosDash(fromAddr)
  if (!ut.length) throw new Error("No dash => all => " + fromAddr)
  const feeRate = await getFeeRateDash()
  const tot = ut.reduce((a, x) => a + x.value, 0)
  const vsize = 10 + ut.length * 148 + 34
  let fee = vsize * feeRate
  if (fee < 667) fee = 667
  if (fee >= tot) throw new Error("Not enough => dash => all => " + fromAddr)
  const leftover = tot - fee
  const inputs = ut.map(x => ({
    txid: x.txId,
    outputIndex: x.vout,
    satoshis: x.value,
    script: x.script ? x.script : dashcore.Script.fromAddress(fromAddr).toString()
  }))
  const tx = new dashcore.Transaction().from(inputs).to(toAddr, leftover)
  tx.sign(pk)
  return tx.serialize()
}
