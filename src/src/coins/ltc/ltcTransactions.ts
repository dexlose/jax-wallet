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

function getLtcNetwork(): bitcoin.networks.Network {
  return {
    messagePrefix: "\x19Litecoin Signed Message:\n",
    bech32: "ltc",
    bip32: { public: 0x04b24746, private: 0x04b2430c },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0
  }
}

async function fetchRawLtc(txid: string): Promise<string> {
  const u = `/api/ltc/raw-tx?txid=${txid}`
  const re = await fetch(u)
  if (!re.ok) {
    throw new Error("Error fetching raw LTC transaction, code: " + re.status)
  }
  const j = await re.json()
  if (!j.rawHex) {
    throw new Error("Server did not return rawHex for LTC transaction: " + txid)
  }
  return j.rawHex
}

async function getUtxosLtc(address: string): Promise<IUtxo[]> {
  const ur = `/api/ltc/utxo?address=${encodeURIComponent(address)}&limit=2000`
  const re = await fetch(ur)
  if (!re.ok) {
    throw new Error("Error requesting getUtxosLtc => " + re.status)
  }
  const jj = await re.json()
  if (!jj.utxo) {
    return []
  }
  const arr = jj.utxo
  const out: IUtxo[] = []
  for (const x of arr) {
    if (!x.rawTx) {
      const rx = await fetchRawLtc(x.txid)
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

async function pushLtc(rawhex: string): Promise<string> {
  const ur = `/api/ltc/broadcast`
  const rr = await fetch(ur, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawHex: rawhex })
  })
  if (!rr.ok) {
    const t = await rr.text()
    throw new Error("Failed to send LTC transaction: " + t)
  }
  const j = await rr.json()
  if (!j.txid) {
    throw new Error("Server did not return txid for LTC transaction.")
  }
  return j.txid
}

async function getLtcFeeRate(): Promise<number> {
  const ur = `/api/ltc/feeRate`
  try {
    const re = await fetch(ur)
    if (!re.ok) {
      return 5
    }
    const j = await re.json()
    if (typeof j.feeRate === "number" && j.feeRate > 0) {
      return j.feeRate
    }
  } catch {}
  return 5
}

function parsePrivKeyLtc(priv: string): { network: bitcoin.networks.Network; privateKey: Buffer } {
  const st = priv.trim()
  const re = /^0x?[0-9A-Fa-f]{64}$/
  const net = getLtcNetwork()
  if (re.test(st)) {
    let h = st
    if (h.startsWith("0x")) {
      h = h.slice(2)
    }
    const buf = Buffer.from(h, "hex")
    if (buf.length !== 32) {
      throw new Error("Invalid private key length (not 32 bytes).")
    }
    return { network: net, privateKey: buf }
  } else {
    const e = ECPair.fromWIF(st, net)
    if (!e.privateKey) {
      throw new Error("Could not parse LTC WIF.")
    }
    return { network: net, privateKey: e.privateKey }
  }
}

function getLtcAddressFromPrivKey(priv: Buffer, net: bitcoin.networks.Network): string {
  const ecp = ECPair.fromPrivateKey(priv, { network: net })
  const { address } = bitcoin.payments.p2wpkh({ pubkey: ecp.publicKey, network: net })
  if (!address) {
    throw new Error("Could not derive LTC address from private key.")
  }
  return address
}

export async function simulateLtcUtxoTx(
  priv: string,
  toAddr: string,
  amountSat: number
): Promise<SimulateResult | null> {
  const { network, privateKey } = parsePrivKeyLtc(priv)
  const fromA = getLtcAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosLtc(fromA)
  if (!ut.length) {
    return null
  }
  const fr = await getLtcFeeRate()
  const total = ut.reduce((a, xx) => a + xx.value, 0)
  const nin = ut.length
  let vs = 10 + nin * 68 + 2 * 31
  let fee = vs * fr
  if (amountSat + fee > total) {
    return null
  }
  let leftover = total - amountSat - fee
  if (leftover < 546) {
    fee += leftover
    leftover = 0
    if (amountSat + fee > total) {
      return null
    }
  }
  return { fee, vsize: vs }
}

export async function simulateAllLtcUtxoTx(priv: string): Promise<SimulateAllResult> {
  const { network, privateKey } = parsePrivKeyLtc(priv)
  const fromA = getLtcAddressFromPrivKey(privateKey, network)
  const ut = await getUtxosLtc(fromA)
  if (!ut.length) {
    return { success: false, error: "No UTXO for LTC." }
  }
  const fr = await getLtcFeeRate()
  const tot = ut.reduce((a, x) => a + x.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 1 * 31
  let fee = vs * fr
  if (fee >= tot) {
    return { success: false, error: "Not enough LTC for fee." }
  }
  const leftover = tot - fee
  return { success: true, sendValue: leftover }
}

async function buildLtcPartial(
  priv: Buffer,
  net: bitcoin.networks.Network,
  toAddr: string,
  amtSat: number
): Promise<string> {
  const fromA = getLtcAddressFromPrivKey(priv, net)
  const ut = await getUtxosLtc(fromA)
  if (!ut.length) {
    throw new Error("No UTXO for sending LTC.")
  }
  const fr = await getLtcFeeRate()
  const tot = ut.reduce((ac, xx) => ac + xx.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 2 * 31
  let fee = vs * fr
  if (amtSat + fee > tot) {
    throw new Error("Not enough LTC to send specified amount (check fee).")
  }
  let leftover = tot - amtSat - fee
  if (leftover < 546) {
    fee += leftover
    leftover = 0
    if (amtSat + fee > tot) {
      throw new Error("Not enough LTC even if sending almost all.")
    }
  }
  const psbt = new bitcoin.Psbt({ network: net, maximumFeeRate: 1e9 })
  for (const x of ut) {
    if (!x.rawTx) {
      throw new Error("Missing raw transaction for input: " + x.txId)
    }
    psbt.addInput({
      hash: x.txId,
      index: x.vout,
      sequence: 0xfffffffd,
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

async function buildLtcAll(
  priv: Buffer,
  net: bitcoin.networks.Network,
  toAddr: string
): Promise<string> {
  const fromA = getLtcAddressFromPrivKey(priv, net)
  const ut = await getUtxosLtc(fromA)
  if (!ut.length) {
    throw new Error("No UTXO for sending LTC.")
  }
  const fr = await getLtcFeeRate()
  const tot = ut.reduce((ac, xx) => ac + xx.value, 0)
  const n = ut.length
  let vs = 10 + n * 68 + 1 * 31
  let fee = vs * fr
  if (fee >= tot) {
    throw new Error("Not enough LTC for fee when sending all.")
  }
  const leftover = tot - fee
  const psbt = new bitcoin.Psbt({ network: net, maximumFeeRate: 1e9 })
  for (const x of ut) {
    if (!x.rawTx) {
      throw new Error("Missing raw transaction for input: " + x.txId)
    }
    psbt.addInput({
      hash: x.txId,
      index: x.vout,
      sequence: 0xfffffffd,
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

export async function sendExactLtcUtxoTx(
  priv: string,
  toAddr: string,
  amountStr: string
): Promise<string> {
  const { network, privateKey } = parsePrivKeyLtc(priv)
  const amtSat = Math.floor(parseFloat(amountStr) * 1e8)
  const raw = await buildLtcPartial(privateKey, network, toAddr, amtSat)
  const txid = await pushLtc(raw)
  return txid
}

export async function sendAllLtcUtxoTx(
  priv: string,
  toAddr: string
): Promise<string> {
  const { network, privateKey } = parsePrivKeyLtc(priv)
  const raw = await buildLtcAll(privateKey, network, toAddr)
  const txid = await pushLtc(raw)
  return txid
}
