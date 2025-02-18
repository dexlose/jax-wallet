import { ethers } from "ethers"

export async function sendErc20Transaction(
  privHex: string,
  contractAddr: string,
  toAddr: string,
  amountStr: string
): Promise<string> {
  const url = `/api/erc20/send`
  const body = { privHex, contractAddr, toAddr, amountStr }
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`sendErc20Transaction => ${txt}`)
  }
  const j = await resp.json()
  if (!j.txHash) {
    throw new Error("No txHash returned from backend => ERC20 send")
  }
  return j.txHash
}
