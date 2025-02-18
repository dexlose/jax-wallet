import * as bitcoin from "bitcoinjs-lib"
import ECPairFactory from "ecpair"
import * as ecc from "tiny-secp256k1"
import { Psbt, Transaction } from "bitcoinjs-lib"

const ECPair = ECPairFactory(ecc)

export interface IUtxo {
  txId: string
  vout: number
  value: number
  rawTx?: string
}

export interface SimulateResult {
  fee: number
  vsize: number
}

export type SimulateAllResult =
  | { success: true; sendValue: number }
  | { success: false; error: string }

const DUST_LIMIT = 546

function getBtcNetwork(): bitcoin.networks.Network {
  return bitcoin.networks.bitcoin
}

async function fetchRawBtc(txid: string): Promise<string> {
  const url = `/api/btc/raw-tx?txid=${txid}`
  const re = await fetch(url)
  if (!re.ok) {
    throw new Error("fetchRawBtc => " + re.status)
  }
  const j = await re.json()
  if (!j.rawHex) {
    throw new Error("No raw transaction found for " + txid)
  }
  return j.rawHex
}

async function getUtxosBtc(address: string): Promise<IUtxo[]> {
  const url = `/api/btc/utxo/${address}`
  const re = await fetch(url)
  if (!re.ok) {
    throw new Error("getUtxosBtc => " + re.status)
  }
  const jj = await re.json()
  if (!Array.isArray(jj.utxo)) {
    return []
  }
  const arr = jj.utxo
  const out: IUtxo[] = []
  for (const x of arr) {
    if (!x.rawTx) {
      const rx = await fetchRawBtc(x.txId)
      out.push({
        txId: x.txId,
        vout: x.vout,
        value: x.value,
        rawTx: await rx
      })
    } else {
      out.push({
        txId: x.txId,
        vout: x.vout,
        value: x.value,
        rawTx: x.rawTx
      })
    }
  }
  return out
}

async function pushBtc(rawhex: string): Promise<string> {
  const url = `/api/btc/broadcast`
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawHex: rawhex })
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error("pushBtc => " + txt)
  }
  const j = await resp.json()
  if (!j.txid) {
    throw new Error("No txid returned from BTC broadcast")
  }
  return j.txid
}

async function getBtcFeeRate(): Promise<number> {
  const url = `/api/btc/feeRate`
  try {
    const re = await fetch(url)
    if (!re.ok) return 5
    const j = await re.json()
    const v = j.feeRate
    if (typeof v === "number" && v > 0) return v
  } catch {}
  return 5
}

function parsePrivKeyBtc(priv: string): { network: bitcoin.networks.Network; privateKey: Buffer } {
  const st = priv.trim()
  const re = /^0x?[0-9A-Fa-f]{64}$/
  const net = getBtcNetwork()
  if (re.test(st)) {
    let h = st
    if (h.startsWith("0x")) {
      h = h.slice(2)
    }
    const buf = Buffer.from(h, "hex")
    if (buf.length !== 32) {
      throw new Error("BTC key hex length != 32 bytes")
    }
    return { network: net, privateKey: buf }
  } else {
    const e = ECPair.fromWIF(st, net)
    if (!e.privateKey) {
      throw new Error("BTC parse WIF => fail")
    }
    return { network: net, privateKey: e.privateKey }
  }
}

function getBtcAddressFromPrivKey(priv: Buffer, net: bitcoin.networks.Network): string {
  const ecp = ECPair.fromPrivateKey(priv, { network: net })
  const { address } = bitcoin.payments.p2wpkh({ pubkey: ecp.publicKey, network: net })
  if (!address) {
    throw new Error("No BTC address derived")
  }
  return address
}

export async function simulateBtcUtxoTx(
  priv: string,
  toAddr: string,
  amountSat: number
): Promise<SimulateResult | null> {
  if (amountSat < DUST_LIMIT) {
    return null
  }
  const { network, privateKey } = parsePrivKeyBtc(priv)
  const fromA = getBtcAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosBtc(fromA)
  if (!ut.length) {
    return null
  }
  const fr = await getBtcFeeRate()
  const total = ut.reduce((ac, xx) => ac + xx.value, 0)
  const nin = ut.length
  let vs = 10 + nin * 68 + 2 * 31
  let fee = vs * fr
  if (amountSat + fee > total) {
    return null
  }
  let leftover = total - amountSat - fee
  if (leftover < DUST_LIMIT) {
    fee += leftover
    leftover = 0
    if (amountSat + fee > total) {
      return null
    }
  }
  return { fee, vsize: vs }
}

export async function simulateBtcAllUtxoTx(priv: string): Promise<SimulateAllResult> {
  const { network, privateKey } = parsePrivKeyBtc(priv)
  const fromA = getBtcAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosBtc(fromA)
  if (!ut.length) {
    return { success: false, error: "No BTC utxo" }
  }
  const fr = await getBtcFeeRate()
  const tot = ut.reduce((a, x) => a + x.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 1 * 31
  let fee = vs * fr
  if (fee >= tot) {
    return { success: false, error: "Not enough BTC" }
  }
  const leftover = tot - fee
  return { success: true, sendValue: leftover }
}

async function buildBtcPartial(
  priv: Buffer,
  net: bitcoin.networks.Network,
  toAddr: string,
  amtSat: number
): Promise<string> {
  if (amtSat < DUST_LIMIT) {
    throw new Error("Send amount < dust limit")
  }
  const fromA = getBtcAddressFromPrivKey(priv, net)
  const ut = await getUtxosBtc(fromA)
  if (!ut.length) {
    throw new Error("No BTC utxo => partial")
  }
  const fr = await getBtcFeeRate()
  const tot = ut.reduce((ac, xx) => ac + xx.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 2 * 31
  let fee = vs * fr
  if (amtSat + fee > tot) {
    throw new Error("Not enough BTC to send partial")
  }
  let leftover = tot - amtSat - fee
  if (leftover < DUST_LIMIT) {
    fee += leftover
    leftover = 0
    if (amtSat + fee > tot) {
      throw new Error("Still not enough to cover fee")
    }
  }
  const psbt = new bitcoin.Psbt({ network: net, maximumFeeRate: 1e9 })
  for (const x of ut) {
    if (!x.rawTx) {
      throw new Error("No raw transaction for " + x.txId)
    }
    psbt.addInput({
      hash: x.txId,
      index: x.vout,
      nonWitnessUtxo: Buffer.from(x.rawTx, "hex")
    })
  }
  psbt.addOutput({ address: toAddr, value: amtSat })
  if (leftover > 0) {
    psbt.addOutput({ address: fromA, value: leftover })
  }
  const ecp = ECPair.fromPrivateKey(priv, { network: net })
  for (let i = 0; i < ut.length; i++) {
    psbt.signInput(i, ecp, [Transaction.SIGHASH_ALL])
    psbt.validateSignaturesOfInput(
      i,
      (pubkey, msgHash, signature) => ecc.verify(msgHash, pubkey, signature),
      ecp.publicKey
    )
  }
  psbt.finalizeAllInputs()
  return psbt.extractTransaction().toHex()
}

async function buildBtcAll(
  priv: Buffer,
  net: bitcoin.networks.Network,
  toAddr: string
): Promise<string> {
  const fromA = getBtcAddressFromPrivKey(priv, net)
  const ut = await getUtxosBtc(fromA)
  if (!ut.length) {
    throw new Error("No BTC utxo => all")
  }
  const fr = await getBtcFeeRate()
  const tot = ut.reduce((ac, xx) => ac + xx.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 1 * 31
  let fee = vs * fr
  if (fee >= tot) {
    throw new Error("Not enough BTC to send all")
  }
  const leftover = tot - fee
  const psbt = new bitcoin.Psbt({ network: net, maximumFeeRate: 1e9 })
  for (const x of ut) {
    if (!x.rawTx) {
      throw new Error("No raw transaction for " + x.txId)
    }
    psbt.addInput({
      hash: x.txId,
      index: x.vout,
      nonWitnessUtxo: Buffer.from(x.rawTx, "hex")
    })
  }
  psbt.addOutput({ address: toAddr, value: leftover })
  const ecp = ECPair.fromPrivateKey(priv, { network: net })
  for (let i = 0; i < ut.length; i++) {
    psbt.signInput(i, ecp, [Transaction.SIGHASH_ALL])
    psbt.validateSignaturesOfInput(
      i,
      (pubkey, msgHash, signature) => ecc.verify(msgHash, pubkey, signature),
      ecp.publicKey
    )
  }
  psbt.finalizeAllInputs()
  return psbt.extractTransaction().toHex()
}

export async function sendExactBtcUtxoTx(
  priv: string,
  toAddr: string,
  amountStr: string
): Promise<string> {
  const { network, privateKey } = parsePrivKeyBtc(priv)
  const amtSat = Math.floor(parseFloat(amountStr) * 1e8)
  if (amtSat < DUST_LIMIT) {
    throw new Error("Amount < dust limit")
  }
  const raw = await buildBtcPartial(privateKey, network, toAddr, amtSat)
  const txid = await pushBtc(raw)
  return txid
}

export async function sendAllBtcUtxoTx(
  priv: string,
  toAddr: string
): Promise<string> {
  const { network, privateKey } = parsePrivKeyBtc(priv)
  const raw = await buildBtcAll(privateKey, network, toAddr)
  const txid = await pushBtc(raw)
  return txid
}
