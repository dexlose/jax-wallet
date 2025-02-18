export interface TxHistoryItem {
  txid: string
  from: string
  to: string
  value: string
  timestamp: number
  isIncoming: boolean
}

export async function fetchZecHistoryPaged(
  address: string,
  page: number,
  limit: number
): Promise<{ items: TxHistoryItem[]; hasMore: boolean }> {
  const url = `/api/zec/history?address=${encodeURIComponent(address)}&page=${page}&limit=${limit}`
  const resp = await fetch(url)
  if (!resp.ok) {
    return { items: [], hasMore: false }
  }
  const data = await resp.json()
  if (!Array.isArray(data.txs)) {
    return { items: [], hasMore: false }
  }
  const allTx = data.txs
  const totalTx = data.total || allTx.length
  const start = (page - 1) * limit
  const end = start + limit
  const slice = allTx.slice(0, limit)
  const hasMore = end < totalTx
  const decimals = 8
  const symbol = "ZEC"
  const items: TxHistoryItem[] = []
  for (const t of slice) {
    const txid = t.hash || "???"
    let blockTimeMs = 0
    if (t.time) {
      blockTimeMs = Date.parse(t.time)
    } else if (t.confirmed) {
      blockTimeMs = Date.parse(t.confirmed)
    }
    let spentSat = 0
    let recvSat = 0
    if (Array.isArray(t.vin)) {
      for (const vin of t.vin) {
        if (Array.isArray(vin.addresses) && vin.addresses.includes(address)) {
          spentSat += Number(vin.value || 0)
        }
      }
    }
    if (Array.isArray(t.vout)) {
      for (const vout of t.vout) {
        if (Array.isArray(vout.addresses) && vout.addresses.includes(address)) {
          recvSat += Number(vout.value || 0)
        }
      }
    }
    const net = recvSat - spentSat
    if (net === 0) {
      continue
    }
    const isInc = net > 0
    const absVal = Math.abs(net)
    const valF = absVal / 10 ** decimals
    if (isInc) {
      let cpa = "(unknown)"
      if (Array.isArray(t.vin)) {
        inLoop: for (const vin of t.vin) {
          if (Array.isArray(vin.addresses)) {
            for (const ad of vin.addresses) {
              if (ad !== address) {
                cpa = ad
                break inLoop
              }
            }
          }
        }
      }
      items.push({
        txid,
        from: cpa,
        to: address,
        value: `${valF.toFixed(decimals)} ${symbol}`,
        timestamp: blockTimeMs || 0,
        isIncoming: true
      })
    } else {
      let cpa = "(unknown)"
      if (Array.isArray(t.vout)) {
        outLoop: for (const vout of t.vout) {
          if (Array.isArray(vout.addresses)) {
            for (const ad of vout.addresses) {
              if (ad !== address) {
                cpa = ad
                break outLoop
              }
            }
          }
        }
      }
      items.push({
        txid,
        from: address,
        to: cpa,
        value: `${valF.toFixed(decimals)} ${symbol}`,
        timestamp: blockTimeMs || 0,
        isIncoming: false
      })
    }
  }
  items.sort((a, b) => b.timestamp - a.timestamp)
  return { items, hasMore }
}
