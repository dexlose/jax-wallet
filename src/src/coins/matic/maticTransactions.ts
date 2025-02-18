import { ethers } from "ethers"

const POLYGON_RPC = process.env.NEXT_PUBLIC_POLYGON_RPC || "https://polygon-rpc.com"
const POLYGONSCAN_API_KEY = process.env.NEXT_PUBLIC_POLYGONSCAN_KEY || ""

export async function sendMaticTransaction(
  privHex: string,
  toAddr: string,
  amountMatic: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(POLYGON_RPC)
  const wallet = new ethers.Wallet(privHex, provider)
  const valueWei = ethers.parseEther(amountMatic)
  const tx = await wallet.sendTransaction({
    to: toAddr,
    value: valueWei
  })
  return tx.hash
}
