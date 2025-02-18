import { validateMnemonic, mnemonicToSeed } from "bip39"
import BIP32Factory from "bip32"
import * as ecc from "tiny-secp256k1"
import * as bitcoin from "bitcoinjs-lib"
import bs58check from "bs58check"
import { ethers } from "ethers"
import TronWeb from "tronweb"
import { PrivateKey as ZecPrivateKey, Networks as ZecNetworks } from "bitcore-lib-zcash"
import { fetchBip39Wordlist } from "./wordlist"

const bip32 = BIP32Factory(ecc)

export interface DerivedAsset {
  symbol: string
  address: string
  privateKey: string
}

function encodeWIF(prefix: number, privKey: Buffer, compressed = true): string {
  if (privKey.length !== 32) {
    throw new Error("Invalid private key length")
  }
  const size = compressed ? 34 : 33
  const raw = Buffer.alloc(size)
  raw[0] = prefix
  privKey.copy(raw, 1)
  if (compressed) {
    raw[size - 1] = 0x01
  }
  return bs58check.encode(raw)
}

const BTC_NET = {
  messagePrefix: "\x18Bitcoin Signed Message:\n",
  bech32: "bc",
  bip32: { public: 0x04b24746, private: 0x04b2430c },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80
}

const LTC_NET = {
  messagePrefix: "\x19Litecoin Signed Message:\n",
  bech32: "ltc",
  bip32: { public: 0x04b24746, private: 0x04b2430c },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0
}

const DOGE_NET = {
  messagePrefix: "\x19Dogecoin Signed Message:\n",
  bech32: "",
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e
}

const DASH_NET = {
  messagePrefix: "\x19DarkCoin Signed Message:\n",
  bech32: "",
  bip32: { public: 0x02fe52f8, private: 0x02fe52cc },
  pubKeyHash: 0x4c,
  scriptHash: 0x10,
  wif: 0xcc
}

export async function deriveMultiAssets(mnemonic: string) {
  const wordlist = await fetchBip39Wordlist()
  const seedPhrase = mnemonic
    .trim()
    .split(/\s+/)
    .map((x) => x.toLowerCase())
    .join(" ");

  const isValid = validateMnemonic(seedPhrase, wordlist);
  if (!isValid) {
    throw new Error("No Internet Connection");
  }

  const seed = await mnemonicToSeed(seedPhrase);
  const root = bip32.fromSeed(seed);
  const out: DerivedAsset[] = [];

  {
    const c = root.derivePath("m/84'/0'/0'/0/0");
    if (c.privateKey && c.privateKey.length === 32) {
      const { address } = bitcoin.payments.p2wpkh({ pubkey: c.publicKey, network: BTC_NET });
      const wif = encodeWIF(0x80, c.privateKey, true);
      out.push({ symbol: "BTC", address: address || "", privateKey: wif });
    }
  }
  {
    const c = root.derivePath("m/84'/2'/0'/0/0");
    if (c.privateKey && c.privateKey.length === 32) {
      const { address } = bitcoin.payments.p2wpkh({ pubkey: c.publicKey, network: LTC_NET });
      const wif = encodeWIF(0xb0, c.privateKey, true);
      out.push({ symbol: "LTC", address: address || "", privateKey: wif });
    }
  }
  {
    const c = root.derivePath("m/44'/3'/0'/0/0");
    if (c.privateKey && c.privateKey.length === 32) {
      const wif = encodeWIF(0x9e, c.privateKey, true);
      const { address } = bitcoin.payments.p2pkh({ pubkey: c.publicKey, network: DOGE_NET });
      out.push({ symbol: "DOGE", address: address || "", privateKey: wif });
    }
  }
  {
    const c = root.derivePath("m/44'/5'/0'/0/0");
    if (c.privateKey && c.privateKey.length === 32) {
      const wif = encodeWIF(0xcc, c.privateKey, true);
      const { address } = bitcoin.payments.p2pkh({ pubkey: c.publicKey, network: DASH_NET });
      out.push({ symbol: "DASH", address: address || "", privateKey: wif });
    }
  }
  {
    const c = root.derivePath("m/44'/133'/0'/0/0");
    if (c.privateKey && c.privateKey.length === 32) {
      const pkZec = new ZecPrivateKey(c.privateKey, ZecNetworks.livenet);
      const zecAddress = pkZec.toAddress(ZecNetworks.livenet).toString();
      const wifZec = pkZec.toWIF();
      out.push({ symbol: "ZEC", address: zecAddress, privateKey: wifZec });
    }
  }
  {
    const c = root.derivePath("m/44'/60'/0'/0/0");
    if (c.privateKey && c.privateKey.length === 32) {
      const pkHex = "0x" + c.privateKey.toString("hex");
      const w = new ethers.Wallet(pkHex);
      out.push({ symbol: "ETH", address: w.address, privateKey: w.privateKey });
      out.push({ symbol: "USDT-ERC20", address: w.address, privateKey: w.privateKey });
    }
  }
  {
    const c = root.derivePath("m/44'/195'/0'/0/0");
    if (c.privateKey && c.privateKey.length === 32) {
      const hex = c.privateKey.toString("hex");
      const tron = new TronWeb({ fullHost: "https://api.trongrid.io" });
      const addr = tron.address.fromPrivateKey(hex);
      out.push({ symbol: "TRX", address: addr, privateKey: hex });
      out.push({ symbol: "USDT-TRC20", address: addr, privateKey: hex });
    }
  }
  {
    const c = root.derivePath("m/44'/137'/0'/0/0");
    if (c.privateKey && c.privateKey.length === 32) {
      const pkHex = "0x" + c.privateKey.toString("hex");
      const w = new ethers.Wallet(pkHex);
      out.push({ symbol: "MATIC", address: w.address, privateKey: w.privateKey });
    }
  }

  return out;
}
