import { ethers } from "ethers"

export async function sendEthTransaction(
  privHex: string,
  toAddr: string,
  amountEth: string
): Promise<string> {
  const url = `/api/eth/send`
  const body = { privHex, toAddr, amountEth }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`sendEthTransaction => ${txt}`)
  }

  const j = await resp.json()
  if (!j.txHash) {
    throw new Error("No txHash returned from backend => ETH send")
  }
  
  return j.txHash
}
