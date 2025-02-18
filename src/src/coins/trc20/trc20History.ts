export interface TxHistoryItem {
  txid: string
  from: string
  to: string
  value: string
  timestamp: number
  isIncoming: boolean
}

export async function fetchTrc20HistoryPaged(
  contractAddr: string,
  holderAddr: string,
  page: number,
  limit: number
): Promise<{ items: TxHistoryItem[]; hasMore: boolean }> {
  const skip = (page - 1) * limit
  const url = `https://api.trongrid.io/v1/accounts/${holderAddr}/transactions/trc20?limit=${limit}&skip=${skip}`
  const r = await fetch(url)
  if (!r.ok) {
    return { items: [], hasMore: false }
  }
  const j = await r.json()
  if (!j.data) {
    return { items: [], hasMore: false }
  }
  const allTx = j.data
  const hasMore = allTx.length >= limit
  const filtered = allTx.filter((tx: any) =>
    tx.token_info?.address?.toLowerCase() === contractAddr.toLowerCase()
  )
  const items: TxHistoryItem[] = []

  for (const tx of filtered) {
    const txid = tx.transaction_id || "???"
    const dec = tx.token_info?.decimals ? parseInt(tx.token_info.decimals, 10) : 6
    const rawVal = Number(tx.value || 0)
    const val = rawVal / (10 ** dec)
    const sym = tx.token_info?.symbol || "TRC20"
    let blockTimeMs = 0
    if (tx.block_timestamp) {
      blockTimeMs = tx.block_timestamp
    }
    const isIncoming = (tx.to?.toLowerCase() === holderAddr.toLowerCase())
    const fromHex = tx.from || ""
    const toHex = tx.to || ""
    const fromAddr = fromHex.toLowerCase() === holderAddr.toLowerCase() ? holderAddr : fromHex
    const toAddr = toHex.toLowerCase() === holderAddr.toLowerCase() ? holderAddr : toHex
    items.push({
      txid,
      from: fromAddr,
      to: toAddr,
      value: `${val.toFixed(dec)} ${sym}`,
      timestamp: blockTimeMs || 0,
      isIncoming
    })
  }
  items.sort((a, b) => b.timestamp - a.timestamp)
  return { items, hasMore }
}
