import { ethers } from "ethers"

export interface TxHistoryItem {
  txid: string
  from: string
  to: string
  value: string
  timestamp: number
  isIncoming: boolean
}

async function fetchUtxoHistoryBlockcypherBtc(
  address: string,
  page: number,
  limit: number
): Promise<{ items: TxHistoryItem[]; hasMore: boolean }> {
  const url = `/api/btc/history/${address}?page=${page}&limit=${limit}`
  const r = await fetch(url)
  if (!r.ok) {
    return { items: [], hasMore: false }
  }
  const j = await r.json()
  if (!Array.isArray(j.txs)) {
    return { items: [], hasMore: false }
  }
  const allTx = j.txs
  const start = (page - 1) * limit
  const end = start + limit
  const slice = allTx.slice(start, end)
  const hasMore = end < allTx.length
  const decimals = 6
  const symbol = "BTC"
  const items: TxHistoryItem[] = []
  for (const tx of slice) {
    const txid = tx.hash || "???"
    let blockTimeMs = 0
    if (tx.received) {
      blockTimeMs = Date.parse(tx.received)
    } else if (tx.confirmed) {
      blockTimeMs = Date.parse(tx.confirmed)
    }
    let spentSat = 0
    let recvSat = 0
    if (Array.isArray(tx.inputs)) {
      for (const inp of tx.inputs) {
        if (Array.isArray(inp.addresses) && inp.addresses.includes(address)) {
          spentSat += Number(inp.output_value || 0)
        }
      }
    }
    if (Array.isArray(tx.outputs)) {
      for (const out of tx.outputs) {
        if (Array.isArray(out.addresses) && out.addresses.includes(address)) {
          recvSat += Number(out.value || 0)
        }
      }
    }
    const net = recvSat - spentSat
    const isInc = net > 0
    const finalSat = isInc ? net : -net
    const valNum = finalSat / 10 ** decimals
    let cp = "(unknown)"
    if (isInc) {
      if (Array.isArray(tx.inputs)) {
        for (const inp of tx.inputs) {
          if (Array.isArray(inp.addresses)) {
            for (const addr of inp.addresses) {
              if (addr !== address) {
                cp = addr
                break
              }
            }
          }
        }
      }
    } else {
      if (Array.isArray(tx.outputs)) {
        for (const o2 of tx.outputs) {
          if (Array.isArray(o2.addresses)) {
            for (const addr of o2.addresses) {
              if (addr !== address) {
                cp = addr
                break
              }
            }
          }
        }
      }
    }
    items.push({
      txid,
      from: isInc ? cp : address,
      to: isInc ? address : cp,
      value: valNum.toFixed(decimals) + " " + symbol,
      timestamp: blockTimeMs || 0,
      isIncoming: isInc
    })
  }
  items.sort((a, b) => b.timestamp - a.timestamp)
  return { items, hasMore }
}

export async function fetchBtcHistoryPaged(
  address: string,
  page: number,
  limit: number
): Promise<{ items: TxHistoryItem[]; hasMore: boolean }> {
  return fetchUtxoHistoryBlockcypherBtc(address, page, limit)
}
