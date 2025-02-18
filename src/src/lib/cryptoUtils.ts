import * as bip39 from 'bip39'

function randomEntropyHex(size = 16): string {
  const arr = new Uint8Array(size)
  crypto.getRandomValues(arr)
  let hex = ''
  for (const b of arr) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

export async function generateSeed(): Promise<string> {
  const entropyHex = randomEntropyHex(16)
  const mnemonic = bip39.entropyToMnemonic(entropyHex)
  return mnemonic
}
