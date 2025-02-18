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

function getDogeNetwork(): bitcoin.networks.Network {
  return {
    messagePrefix: "\x19Dogecoin Signed Message:\n",
    bech32: "",
    bip32: { public: 0x02facafd, private: 0x02fac398 },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e
  }
}

async function fetchRawDoge(txid: string): Promise<string> {
  const url = `/api/doge/raw-tx?txid=${txid}`
  const re = await fetch(url)
  if (!re.ok) {
    throw new Error("fetchRawDoge => " + re.status)
  }
  const j = await re.json()
  if (!j.rawHex) {
    throw new Error("No raw for DOGE => " + txid)
  }
  return j.rawHex
}

async function getUtxosDoge(address: string): Promise<IUtxo[]> {
  const ur = `/api/doge/utxo?address=${encodeURIComponent(address)}&limit=2000`
  const re = await fetch(ur)
  if (!re.ok) {
    throw new Error("getUtxosDoge => " + re.status)
  }
  const jj = await re.json()
  if (!Array.isArray(jj.utxo)) {
    return []
  }
  const arr = jj.utxo
  const out: IUtxo[] = []
  for (const x of arr) {
    if (!x.rawTx) {
      const rx = await fetchRawDoge(x.txid)
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

async function pushDoge(rawhex: string): Promise<string> {
  const url = `/api/doge/broadcast`
  const rr = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawHex: rawhex })
  })
  if (!rr.ok) {
    const msg = await rr.text()
    throw new Error("pushDoge => " + msg)
  }
  const j = await rr.json()
  if (!j.txid) {
    throw new Error("No txhash => DOGE broadcast")
  }
  return j.txid
}

async function getDogeFeeRate(): Promise<number> {
  const url = `/api/doge/feeRate`
  try {
    const re = await fetch(url)
    if (!re.ok) return 1000
    const j = await re.json()
    if (typeof j.feeRate === "number" && j.feeRate > 0) {
      return j.feeRate
    }
  } catch {}
  return 1000
}

function parsePrivKeyDoge(
  priv: string
): { network: bitcoin.networks.Network; privateKey: Buffer } {
  const st = priv.trim()
  const re = /^0x?[0-9A-Fa-f]{64}$/
  const net = getDogeNetwork()
  if (re.test(st)) {
    let h = st
    if (h.startsWith("0x")) {
      h = h.slice(2)
    }
    const buf = Buffer.from(h, "hex")
    if (buf.length !== 32) {
      throw new Error("DOGE key hex len != 32")
    }
    return { network: net, privateKey: buf }
  } else {
    const e = ECPair.fromWIF(st, net)
    if (!e.privateKey) {
      throw new Error("DOGE parse wif => fail")
    }
    return { network: net, privateKey: e.privateKey }
  }
}

function getDogeAddressFromPrivKey(
  priv: Buffer,
  net: bitcoin.networks.Network
): string {
  const ecp = ECPair.fromPrivateKey(priv, { network: net })
  const { address } = bitcoin.payments.p2pkh({ pubkey: ecp.publicKey, network: net })
  if (!address) {
    throw new Error("No DOGE address derived")
  }
  return address
}

export async function simulateDogeUtxoTx(
  priv: string,
  toAddr: string,
  amountSat: number
): Promise<SimulateResult | null> {
  const { network, privateKey } = parsePrivKeyDoge(priv)
  const fromA = getDogeAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosDoge(fromA)
  if (!ut.length) return null
  const fr = await getDogeFeeRate()
  const total = ut.reduce((ac, xx) => ac + xx.value, 0)
  const nin = ut.length
  let vs = 10 + nin * 68 + 2 * 31
  let fee = vs * fr
  if (amountSat + fee > total) return null
  let leftover = total - amountSat - fee
  if (leftover < 100000000) {
    fee += leftover
    leftover = 0
    if (amountSat + fee > total) return null
  }
  return { fee, vsize: vs }
}

export async function simulateAllDogeUtxoTx(priv: string): Promise<SimulateAllResult> {
  const { network, privateKey } = parsePrivKeyDoge(priv)
  const fromA = getDogeAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosDoge(fromA)
  if (!ut.length) return { success: false, error: "No DOGE utxo" }
  const fr = await getDogeFeeRate()
  const tot = ut.reduce((a, x) => a + x.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 1 * 31
  let fee = vs * fr
  if (fee >= tot) return { success: false, error: "Not enough DOGE" }
  const leftover = tot - fee
  return { success: true, sendValue: leftover }
}

async function buildDogePartial(
  priv: Buffer,
  net: bitcoin.networks.Network,
  toAddr: string,
  amtSat: number
): Promise<string> {
  const fromA = getDogeAddressFromPrivKey(priv, net)
  const ut = await getUtxosDoge(fromA)
  if (!ut.length) throw new Error("No DOGE utxo => partial")
  const fr = await getDogeFeeRate()
  const tot = ut.reduce((ac, xx) => ac + xx.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 2 * 31
  let fee = vs * fr
  if (amtSat + fee > tot) throw new Error("Not enough => partial => DOGE")
  let leftover = tot - amtSat - fee
  if (leftover < 100000000) {
    fee += leftover
    leftover = 0
    if (amtSat + fee > tot) throw new Error("Still not enough => leftover => DOGE")
  }
  const psbt = new bitcoin.Psbt({ network: net, maximumFeeRate: 1e9 })
  for (const x of ut) {
    if (!x.rawTx) throw new Error("No raw => partial => DOGE => " + x.txId)
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

async function buildDogeAll(
  priv: Buffer,
  net: bitcoin.networks.Network,
  toAddr: string
): Promise<string> {
  const fromA = getDogeAddressFromPrivKey(priv, net)
  const ut = await getUtxosDoge(fromA)
  if (!ut.length) throw new Error("No DOGE utxo => all")
  const fr = await getDogeFeeRate()
  const tot = ut.reduce((ac, xx) => ac + xx.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 1 * 31
  let fee = vs * fr
  if (fee >= tot) throw new Error("Not enough => all => DOGE")
  const leftover = tot - fee
  const psbt = new bitcoin.Psbt({ network: net, maximumFeeRate: 1e9 })
  for (const x of ut) {
    if (!x.rawTx) throw new Error("No raw => all => DOGE => " + x.txId)
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

export async function sendExactDogeUtxoTx(
  priv: string,
  toAddr: string,
  amountStr: string
): Promise<string> {
  const { network, privateKey } = parsePrivKeyDoge(priv)
  const amtSat = Math.floor(parseFloat(amountStr) * 1e8)
  const raw = await buildDogePartial(privateKey, network, toAddr, amtSat)
  const txid = await pushDoge(raw)
  return txid
}

export async function sendAllDogeUtxoTx(
  priv: string,
  toAddr: string
): Promise<string> {
  const { network, privateKey } = parsePrivKeyDoge(priv)
  const raw = await buildDogeAll(privateKey, network, toAddr)
  const txid = await pushDoge(raw)
  return txid
}
