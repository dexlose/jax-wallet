import { ethers } from "ethers";
import type { TxHistoryItem } from "../btc/btcHistory";

export async function fetchErc20HistoryPaged(
  contractAddr: string,
  holderAddr: string,
  page: number,
  limit: number
): Promise<{ items: TxHistoryItem[]; hasMore: boolean }> {
  const url = `/api/erc20/history?contractAddr=${contractAddr}&holderAddr=${holderAddr}&page=${page}&limit=${limit}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    return { items: [], hasMore: false };
  }

  const data = await resp.json();
  if (!data || data.status !== "1" || !Array.isArray(data.result)) {
    return { items: [], hasMore: false };
  }

  const txs = data.result;
  const hasMore = txs.length >= limit;

  const items: TxHistoryItem[] = [];

  for (const tx of txs) {
    const txid = tx.hash || "???";
    const isInc = (tx.to?.toLowerCase() === holderAddr.toLowerCase());
    const valNum = Number(ethers.formatUnits(tx.value || "0", 6));
    const valStr = valNum.toFixed(6) + " USDT-ERC20";
    let tms = 0;
    if (tx.timeStamp) {
      tms = parseInt(tx.timeStamp) * 1000;
    }
    items.push({
      txid,
      from: tx.from || "(unknown)",
      to: tx.to || "(unknown)",
      value: valStr,
      timestamp: tms,
      isIncoming: isInc
    });
  }

  items.sort((a, b) => b.timestamp - a.timestamp);
  return { items, hasMore };
}
