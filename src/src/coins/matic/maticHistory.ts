import { fetchWithRetry } from "../../lib/fetchWithRetry";

const POLYGONSCAN_API_KEY = process.env.NEXT_PUBLIC_POLYGONSCAN_KEY || "";

export interface TxHistoryItem {
  txid: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  isIncoming: boolean;
}

export async function fetchMaticHistoryPaged(address: string, page: number, limit: number) {
  const url = `https://api.polygonscan.com/api?module=account&action=txlist` +
              `&address=${address}&startblock=0&endblock=99999999&sort=desc&page=${page}&offset=${limit}` +
              `&apikey=${POLYGONSCAN_API_KEY}`;

  const data = await fetchWithRetry(url);

  const result = (data && data.result) || [];
  if (!Array.isArray(result)) {
    return { items: [], hasMore: false };
  }

  const items: TxHistoryItem[] = result.map((tx: any) => {
    const isIncoming = (tx.to || "").toLowerCase() === address.toLowerCase();
    return {
      txid: tx.hash,
      from: tx.from,
      to: tx.to,
      value: `${parseFloat(tx.value) / 1e18} MATIC`,
      timestamp: tx.timeStamp ? parseInt(tx.timeStamp) * 1000 : Date.now(),
      isIncoming
    };
  });

  const hasMore = items.length >= limit;
  return { items, hasMore };
}
