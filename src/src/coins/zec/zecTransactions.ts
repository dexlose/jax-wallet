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

function getZecNetwork(): bitcoin.networks.Network {
  return {
    messagePrefix: "\x19Zcash Signed Message:\n",
    bech32: "",
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: 0x1c,
    scriptHash: 0x1d,
    wif: 0x80
  }
}

async function fetchRawZec(txid: string): Promise<string> {
  const url = `/api/zec/raw-tx?txid=${txid}`
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error("Error fetching raw ZEC transaction. Code: " + resp.status)
  }
  const j = await resp.json()
  if (!j.rawHex) {
    throw new Error("Unable to get raw ZEC transaction for txid: " + txid)
  }
  return j.rawHex
}

async function getUtxosZec(address: string): Promise<IUtxo[]> {
  const url = `/api/zec/utxo?address=${encodeURIComponent(address)}&limit=2000`
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error("Error fetching UTXO (getUtxosZec). Code: " + resp.status)
  }
  const data = await resp.json()
  if (!Array.isArray(data.utxo)) {
    return []
  }
  const arr = data.utxo
  const out: IUtxo[] = []
  for (const x of arr) {
    if (!x.rawTx) {
      const rx = await fetchRawZec(x.txid)
      out.push({
        txId: x.txid,
        vout: x.vout,
        value: x.value,
        rawTx: await rx
      })
    } else {
      out.push({
        txId: x.txid,
        vout: x.vout,
        value: x.value,
        rawTx: x.rawTx
      })
    }
  }
  return out
}

async function pushZec(rawhex: string): Promise<string> {
  const url = `/api/zec/broadcast`
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawHex: rawhex })
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error("Error sending ZEC transaction: " + txt)
  }
  const j = await resp.json()
  if (!j.txid) {
    throw new Error("Transaction not sent: no txid in response")
  }
  return j.txid
}

async function getZecFeeRate(): Promise<number> {
  const url = `/api/zec/feeRate`
  try {
    const re = await fetch(url)
    if (!re.ok) return 5
    const j = await re.json()
    const v = j.feeRate
    if (typeof v === "number" && v > 0) return v
  } catch {}
  return 5
}

function parsePrivKeyZec(priv: string): { network: bitcoin.networks.Network; privateKey: Buffer } {
  const st = priv.trim()
  const re = /^0x?[0-9A-Fa-f]{64}$/
  const net = getZecNetwork()
  if (re.test(st)) {
    let h = st
    if (h.startsWith("0x")) h = h.slice(2)
    const buf = Buffer.from(h, "hex")
    if (buf.length !== 32) throw new Error("Invalid HEX key (length != 32 bytes)")
    return { network: net, privateKey: buf }
  }
  const e = ECPair.fromWIF(st, net)
  if (!e.privateKey) throw new Error("Could not parse ZEC WIF")
  return { network: net, privateKey: e.privateKey }
}

function getZecAddressFromPrivKey(priv: Buffer, net: bitcoin.networks.Network): string {
  const ecp = ECPair.fromPrivateKey(priv, { network: net })
  const { address } = bitcoin.payments.p2pkh({ pubkey: ecp.publicKey, network: net })
  if (!address) throw new Error("Could not derive ZEC address from private key")
  return address
}

export async function simulateZecUtxoTx(
  priv: string,
  toAddr: string,
  amountSat: number
): Promise<SimulateResult | null> {
  const { network, privateKey } = parsePrivKeyZec(priv)
  const fromA = getZecAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosZec(fromA)
  if (!ut.length) return null
  const fr = await getZecFeeRate()
  const total = ut.reduce((ac, xx) => ac + xx.value, 0)
  const nin = ut.length
  let vs = 10 + nin * 68 + 2 * 31
  let fee = vs * fr
  if (amountSat + fee > total) return null
  let leftover = total - amountSat - fee
  if (leftover < 546) {
    fee += leftover
    leftover = 0
    if (amountSat + fee > total) return null
  }
  return { fee, vsize: vs }
}

export async function simulateAllZecUtxoTx(priv: string): Promise<SimulateAllResult> {
  const { network, privateKey } = parsePrivKeyZec(priv)
  const fromA = getZecAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosZec(fromA)
  if (!ut.length) {
    return { success: false, error: "No available UTXO for ZEC" }
  }
  const fr = await getZecFeeRate()
  const tot = ut.reduce((a, x) => a + x.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 1 * 31
  let fee = vs * fr
  if (fee >= tot) {
    return { success: false, error: "Not enough funds to pay the fee" }
  }
  const leftover = tot - fee
  return { success: true, sendValue: leftover }
}

async function buildZecPartial(
  priv: string,
  toAddr: string,
  amountStr: string
): Promise<string> {
  const { network, privateKey } = parsePrivKeyZec(priv)
  const fromA = getZecAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosZec(fromA)
  if (!ut.length) throw new Error("No available UTXO (buildZecPartial)")
  const fr = await getZecFeeRate()
  const tot = ut.reduce((ac, xx) => ac + xx.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 2 * 31
  let fee = vs * fr
  const amtSat = Math.floor(parseFloat(amountStr) * 1e8)
  if (amtSat + fee > tot) {
    throw new Error("Not enough funds to send " + amountStr + " ZEC")
  }
  let leftover = tot - amtSat - fee
  if (leftover < 546) {
    fee += leftover
    leftover = 0
    if (amtSat + fee > tot) {
      throw new Error("Not enough funds, even without change (buildZecPartial)")
    }
  }
  const psbt = new bitcoin.Psbt({ network, maximumFeeRate: 1e9 })
  for (const x of ut) {
    if (!x.rawTx) {
      throw new Error("Missing raw transaction UTXO (buildZecPartial): " + x.txId)
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
  const ecp = ECPair.fromPrivateKey(privateKey, { network })
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

async function buildZecAll(
  priv: string,
  toAddr: string
): Promise<string> {
  const { network, privateKey } = parsePrivKeyZec(priv)
  const fromA = getZecAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosZec(fromA)
  if (!ut.length) throw new Error("No available UTXO (buildZecAll)")
  const fr = await getZecFeeRate()
  const tot = ut.reduce((ac, xx) => ac + xx.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 1 * 31
  let fee = vs * fr
  if (fee >= tot) {
    throw new Error("Not enough funds to send all (buildZecAll). Balance: " + tot + ", fee: " + fee)
  }
  const leftover = tot - fee
  const psbt = new bitcoin.Psbt({ network, maximumFeeRate: 1e9 })
  for (const x of ut) {
    if (!x.rawTx) {
      throw new Error("Missing raw transaction UTXO (buildZecAll): " + x.txId)
    }
    psbt.addInput({
      hash: x.txId,
      index: x.vout,
      nonWitnessUtxo: Buffer.from(x.rawTx, "hex")
    })
  }
  psbt.addOutput({ address: toAddr, value: leftover })
  const ecp = ECPair.fromPrivateKey(privateKey, { network })
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

export async function sendExactZecUtxoTx(
  priv: string,
  toAddr: string,
  amountStr: string
): Promise<string> {
  const raw = await buildZecPartial(priv, toAddr, amountStr)
  const txid = await pushZec(raw)
  return txid
}

export async function sendAllZecUtxoTx(
  priv: string,
  toAddr: string
): Promise<string> {
  const raw = await buildZecAll(priv, toAddr)
  const txid = await pushZec(raw)
  return txid
}
