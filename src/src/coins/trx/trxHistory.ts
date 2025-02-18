import TronWeb from "tronweb"

export interface TxHistoryItem {
  txid: string
  from: string
  to: string
  value: string
  timestamp: number
  isIncoming: boolean
}

export async function fetchTrxHistoryPaged(
  address: string,
  page: number,
  limit: number
): Promise<{ items: TxHistoryItem[]; hasMore: boolean }> {
  const skip = (page - 1) * limit
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions?limit=${limit}&skip=${skip}`
  const resp = await fetch(url)
  if (!resp.ok) {
    return { items: [], hasMore: false }
  }
  const data = await resp.json()
  if (!data.data) {
    return { items: [], hasMore: false }
  }
  const arr = data.data
  const hasMore = arr.length >= limit
  const items: TxHistoryItem[] = []

  for (const tx of arr) {
    const txid = tx.txID || "???"
    let blockTimeMs = 0
    if (tx.raw_data?.timestamp) {
      blockTimeMs = tx.raw_data.timestamp
    }
    let contractType = ""
    let ownerHex = ""
    let toHex = ""
    let amountSun = 0
    if (Array.isArray(tx.raw_data?.contract)) {
      const c0 = tx.raw_data.contract[0]
      if (c0?.parameter?.value) {
        contractType = c0.type || ""
        const val = c0.parameter.value
        ownerHex = val.owner_address || ""
        toHex = val.to_address || ""
        amountSun = val.amount || 0
      }
    }
    let fromAddr = "(unknown)"
    let toAddr = "(unknown)"
    try {
      fromAddr = TronWeb.address.fromHex(ownerHex)
    } catch {}
    try {
      toAddr = TronWeb.address.fromHex(toHex)
    } catch {}
    const isInc = toAddr.toLowerCase() === address.toLowerCase()
    let valTrx = amountSun / 1e6
    let showValue = `${valTrx.toFixed(6)} TRX`
    if (contractType === "TriggerSmartContract" && amountSun === 0) {
      const feeSun = tx.ret?.[0]?.fee ?? 0
      const feeTrx = feeSun / 1e6
      if (feeSun > 0) {
        valTrx = feeTrx
        showValue = `-${valTrx.toFixed(6)} TRX (fee)`
      } else {
        showValue = "0.000000 TRX (contract)"
      }
    }
    items.push({
      txid,
      from: fromAddr,
      to: toAddr,
      value: showValue,
      timestamp: blockTimeMs || 0,
      isIncoming: isInc
    })
  }
  items.sort((a, b) => b.timestamp - a.timestamp)
  return { items, hasMore }
}
