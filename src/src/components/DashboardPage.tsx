import React, { useEffect, useState, useRef, useCallback } from "react";
import { ethers } from "ethers";
import QRCode from "qrcode.react";
import TronWeb from "tronweb";
import { DerivedAsset, deriveMultiAssets } from "../lib/multiCryptoUtils";
import { TxHistoryItem } from "../coins/btc/btcHistory";
import { fetchBtcHistoryPaged } from "../coins/btc/btcHistory";
import {
  sendExactBtcUtxoTx,
  sendAllBtcUtxoTx,
  simulateBtcUtxoTx,
  simulateBtcAllUtxoTx
} from "../coins/btc/btcTransactions";
import { fetchLtcHistoryPaged } from "../coins/ltc/ltcHistory";
import {
  sendExactLtcUtxoTx,
  sendAllLtcUtxoTx,
  simulateLtcUtxoTx,
  simulateAllLtcUtxoTx
} from "../coins/ltc/ltcTransactions";
import { fetchDogeHistoryPaged } from "../coins/doge/dogeHistory";
import {
  sendExactDogeUtxoTx,
  sendAllDogeUtxoTx,
  simulateDogeUtxoTx,
  simulateAllDogeUtxoTx
} from "../coins/doge/dogeTransactions";
import { fetchDashHistoryPaged } from "../coins/dash/dashHistory";
import {
  sendExactDashUtxoTx,
  sendAllDashUtxoTx,
  simulateDashUtxoTx,
  simulateAllDashUtxoTx
} from "../coins/dash/dashTransactions";
import { fetchZecHistoryPaged } from "../coins/zec/zecHistory";
import {
  sendExactZecUtxoTx,
  sendAllZecUtxoTx,
  simulateZecUtxoTx,
  simulateAllZecUtxoTx
} from "../coins/zec/zecTransactions";
import { fetchEthHistoryPaged } from "../coins/eth/ethHistory";
import { sendEthTransaction } from "../coins/eth/ethTransactions";
import { fetchErc20HistoryPaged } from "../coins/erc20/erc20History";
import { sendErc20Transaction } from "../coins/erc20/erc20Transactions";
import { fetchTrxHistoryPaged } from "../coins/trx/trxHistory";
import { sendTrxTransaction } from "../coins/trx/trxTransactions";
import { fetchTrc20HistoryPaged } from "../coins/trc20/trc20History";
import {
  sendTrc20Transaction,
  getTrxFeeSpent
} from "../coins/trc20/trc20Transactions";
import { fetchMaticHistoryPaged } from "../coins/matic/maticHistory";
import { sendMaticTransaction } from "../coins/matic/maticTransactions";
import LoadingPage from "./loading";
import SendStep1Modal from "./modals/SendStep1Modal";
import SendStep2Modal from "./modals/SendStep2Modal";
import SendStep3Modal from "./modals/SendStep3Modal";
import InfoModal from "./info";
import CryptoJS from "crypto-js";

declare global {
  interface Window {
    ipcRenderer?: any;
    electronAPI?: any;
  }
}

function showElectronNotification(title: string, body: string) {
}

const tron = new TronWeb({ fullHost: "https://api.trongrid.io" });
const USDT_ERC20 = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const binanceSymbols: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  LTC: "LTCUSDT",
  DOGE: "DOGEUSDT",
  DASH: "DASHUSDT",
  ZEC: "ZECUSDT",
  MATIC: "MATICUSDT",
  TRX: "TRXUSDT",
  "USDT-ERC20": "BUSDUSDT",
  "USDT-TRC20": "BUSDUSDT"
};

function getCoinIcon(symbol: string): string {
  switch (symbol) {
    case "BTC":
      return "/icons/coins_icons/bitcoin-btc-logo.svg";
    case "LTC":
      return "/icons/coins_icons/litecoin-ltc-logo.svg";
    case "DOGE":
      return "/icons/coins_icons/dogecoin-doge-logo.svg";
    case "DASH":
      return "/icons/coins_icons/dash-dash-logo.svg";
    case "ZEC":
      return "/icons/coins_icons/zcash-zec-logo.svg";
    case "ETH":
      return "/icons/coins_icons/ethereum-eth-logo.svg";
    case "TRX":
      return "/icons/coins_icons/tron-trx-logo.svg";
    case "USDT-ERC20":
    case "USDT-TRC20":
      return "/icons/coins_icons/tether-usdt-logo.svg";
    case "MATIC":
      return "/icons/coins_icons/polygon-matic-logo.svg";
    default:
      return "/icons/coins_icons/generic.svg";
  }
}

function getCarouselSymbol(symbol: string): string {
  if (symbol === "USDT-ERC20") return "ERC-20";
  if (symbol === "USDT-TRC20") return "TRC-20";
  return symbol;
}

interface AssetBalance {
  symbol: string;
  address: string;
  displayBalance: string;
  numericValue?: number;
  error?: string;
  usdValue?: number;
}

interface SparklineCache {
  lastFetched: number;
  data: number[];
}

interface HistoryCache {
  [key: string]: {
    items: TxHistoryItem[];
    fetchedAt: number;
  };
}

const MAX_RETRIES = 1;
const RETRY_DELAY_BASE = 1000;

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        if (attempt < retries) {
          const delay = RETRY_DELAY_BASE * 2 ** attempt;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        } else {
          throw new Error("Too Many Requests");
        }
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
    }
  }
}

class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private activeCount: number = 0;
  private concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  enqueue(task: () => Promise<void>) {
    this.queue.push(task);
    this.dequeue();
  }

  private dequeue() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }
    const task = this.queue.shift();
    if (task) {
      this.activeCount++;
      task().finally(() => {
        this.activeCount--;
        this.dequeue();
      });
    }
  }
}

const requestQueue = new RequestQueue(1);
const PRICE_CACHE_TTL_MS = 30 * 60000;
const HISTORY_CACHE_TTL_MS = 10 * 60000;

export default function DashboardPage() {
  const [assets, setAssets] = useState<DerivedAsset[]>([]);
  const [balances, setBalances] = useState<AssetBalance[]>([]);
  const [error, setError] = useState("");
  const [txItems, setTxItems] = useState<TxHistoryItem[]>([]);
  const [showSendStep, setShowSendStep] = useState<1 | 2 | 3 | null>(null);
  const [sendAsset, setSendAsset] = useState<DerivedAsset | null>(null);
  const [toAddress, setToAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendMax, setSendMax] = useState(false);
  const [simulateError, setSimulateError] = useState("");
  const [simulateFee, setSimulateFee] = useState<number | null>(null);
  const [simulateVsize, setSimulateVsize] = useState<number | null>(null);
  const [confirmData, setConfirmData] = useState<{
    to: string;
    amount: string;
    fee?: number;
    symbol: string;
  } | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [sparklineData, setSparklineData] = useState<number[]>([]);
  const targetHoverIndexRef = useRef<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const targetBubblePosRef = useRef<{ x: number; y: number; val: number } | null>(null);
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number; val: number } | null>(null);
  const targetTooltipPosRef = useRef<{ x: number; y: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const targetHoverPriceRef = useRef<number | null>(null);
  const [hoverPriceState, setHoverPriceState] = useState(0);
  const targetHoverDiffRef = useRef<number | null>(null);
  const [hoverDiffState, setHoverDiffState] = useState(0);
  const [cachedSparklines, setCachedSparklines] = useState<{
    [key: string]: SparklineCache;
  }>({});
  const [cachedHistory, setCachedHistory] = useState<HistoryCache>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [finalTxId, setFinalTxId] = useState("");
  const [finalSentAmount, setFinalSentAmount] = useState("");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [loadingSparkline, setLoadingSparkline] = useState(false);
  const [errorSparkline, setErrorSparkline] = useState("");
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    visible: boolean;
    text: string;
  }>({
    x: 0,
    y: 0,
    visible: false,
    text: ""
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [infoContent, setInfoContent] = useState("");
  const [lastKnownTxCache, setLastKnownTxCache] = useState<HistoryCache>({});
  const [debouncedCarouselIndex, setDebouncedCarouselIndex] = useState(carouselIndex);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pageScrollRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = useCallback(() => {
    if (!pageScrollRef.current) return;
    const st = pageScrollRef.current.scrollTop;
    if (st > 200) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    if (!pageScrollRef.current) return;
    pageScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (pageScrollRef.current) {
      pageScrollRef.current.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (pageScrollRef.current) {
        pageScrollRef.current.removeEventListener("scroll", handleScroll);
      }
    };
  }, [handleScroll]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCarouselIndex(carouselIndex);
    }, 500);
    return () => clearTimeout(t);
  }, [carouselIndex]);

  const isDebouncing = debouncedCarouselIndex !== carouselIndex;

  useEffect(() => {
    let frameId: number;
    const animate = () => {
      if (targetHoverIndexRef.current !== null && hoverIndex !== null) {
        const delta = targetHoverIndexRef.current - hoverIndex;
        const next = hoverIndex + delta * 0.1;
        if (Math.abs(delta) < 0.1) {
          setHoverIndex(targetHoverIndexRef.current);
        } else {
          setHoverIndex(next);
        }
      }
      if (targetBubblePosRef.current && bubblePos) {
        const dx = targetBubblePosRef.current.x - bubblePos.x;
        const dy = targetBubblePosRef.current.y - bubblePos.y;
        const dv = targetBubblePosRef.current.val - bubblePos.val;
        const nx = bubblePos.x + dx * 0.1;
        const ny = bubblePos.y + dy * 0.1;
        const nval = bubblePos.val + dv * 0.1;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dv) < 0.01) {
          setBubblePos({
            x: targetBubblePosRef.current.x,
            y: targetBubblePosRef.current.y,
            val: targetBubblePosRef.current.val
          });
        } else {
          setBubblePos({ x: nx, y: ny, val: nval });
        }
      }
      if (targetTooltipPosRef.current && tooltipPos) {
        const dx = targetTooltipPosRef.current.x - tooltipPos.x;
        const dy = targetTooltipPosRef.current.y - tooltipPos.y;
        const nx = tooltipPos.x + dx * 0.1;
        const ny = tooltipPos.y + dy * 0.1;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          setTooltipPos({
            x: targetTooltipPosRef.current.x,
            y: targetTooltipPosRef.current.y
          });
        } else {
          setTooltipPos({ x: nx, y: ny });
        }
      }
      if (targetHoverPriceRef.current !== null) {
        const dP = targetHoverPriceRef.current - hoverPriceState;
        const nextP = hoverPriceState + dP * 0.1;
        if (Math.abs(dP) < 0.01) {
          setHoverPriceState(targetHoverPriceRef.current);
        } else {
          setHoverPriceState(nextP);
        }
      }
      if (targetHoverDiffRef.current !== null) {
        const dD = targetHoverDiffRef.current - hoverDiffState;
        const nextD = hoverDiffState + dD * 0.1;
        if (Math.abs(dD) < 0.01) {
          setHoverDiffState(targetHoverDiffRef.current);
        } else {
          setHoverDiffState(nextD);
        }
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [hoverIndex, bubblePos, tooltipPos, hoverPriceState, hoverDiffState]);

  const [pricesCache, setPricesCache] = useState<{
    [pair: string]: { price: number; fetchedAt: number };
  }>({});

  const fetchPricesBatch = useCallback(
    async (symbols: string[]): Promise<Record<string, number>> => {
      const pairs = symbols
        .map((sym) => binanceSymbols[sym])
        .filter((p) => p)
        .filter((v, i, arr) => arr.indexOf(v) === i);
      const result: Record<string, number> = {};
      if (pairs.length === 0) return result;
      const now = Date.now();
      const pairsToFetch: string[] = [];
      pairs.forEach((pair) => {
        const cacheEntry = pricesCache[pair];
        if (cacheEntry && now - cacheEntry.fetchedAt < PRICE_CACHE_TTL_MS) {
          result[pair] = cacheEntry.price;
        } else {
          pairsToFetch.push(pair);
        }
      });
      if (pairsToFetch.length === 0) {
        return result;
      }
      const encoded = encodeURIComponent(JSON.stringify(pairsToFetch));
      const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encoded}`;
      try {
        const data = await fetchWithRetry(url);
        const newPricesCache = { ...pricesCache };
        data.forEach((item: any) => {
          const p = item.symbol;
          const pr = parseFloat(item.price);
          newPricesCache[p] = {
            price: pr,
            fetchedAt: now
          };
          result[p] = pr;
        });
        setPricesCache(newPricesCache);
      } catch {
        pairsToFetch.forEach((p) => {
          if (!result[p]) result[p] = 0;
        });
      }
      return result;
    },
    [pricesCache]
  );

  const fetchSingleBalance = useCallback(
    async (a: DerivedAsset): Promise<{
      numericValue: number;
      display: string;
      error: string;
    }> => {
      let display = "0.000000 " + a.symbol;
      let numeric = 0;
      let err = "";
      try {
        if (["BTC", "LTC", "DOGE", "DASH", "ZEC"].includes(a.symbol)) {
          const chain =
            a.symbol === "BTC"
              ? "bitcoin"
              : a.symbol === "LTC"
              ? "litecoin"
              : a.symbol === "DOGE"
              ? "dogecoin"
              : a.symbol === "DASH"
              ? "dash"
              : "zcash";
          const url = `/api/proxy/blockchair?chain=${chain}&address=${encodeURIComponent(
            a.address
          )}`;
          const jj = await fetchWithRetry(url);
          const sat = jj?.data?.[a.address]?.address?.balance ?? 0;
          numeric = sat / 1e8;
          display = numeric.toFixed(6) + " " + a.symbol;
        } else if (a.symbol === "ETH") {
          const ethp = new ethers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_INFURA_URL || ""
          );
          const bal = await ethp.getBalance(a.address);
          const val = Number(ethers.formatEther(bal));
          numeric = val;
          display = val.toFixed(6) + " ETH";
        } else if (a.symbol === "USDT-ERC20") {
          const ethp = new ethers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_INFURA_URL || ""
          );
          const c = new ethers.Contract(
            USDT_ERC20,
            ["function balanceOf(address) view returns(uint256)"],
            ethp
          );
          const b = await c.balanceOf(a.address);
          numeric = Number(ethers.formatUnits(b, 6));
          display = numeric.toFixed(6) + " USDT-ERC20";
        } else if (a.symbol === "TRX") {
          const tron2 = new TronWeb({ fullHost: "https://api.trongrid.io" });
          const suns = await tron2.trx.getBalance(a.address);
          numeric = suns / 1e6;
          display = numeric.toFixed(6) + " TRX";
        } else if (a.symbol === "USDT-TRC20") {
          const tron2 = new TronWeb({ fullHost: "https://api.trongrid.io" });
          tron2.setAddress(a.address);
          const c2 = await tron2.contract().at(USDT_TRC20);
          const b2 = await c2.balanceOf(a.address).call();
          numeric = Number(b2.toString()) / 1e6;
          display = numeric.toFixed(6) + " USDT-TRC20";
        } else if (a.symbol === "MATIC") {
          const mp = new ethers.JsonRpcProvider("https://polygon-rpc.com/");
          const bal = await mp.getBalance(a.address);
          const valMatic = Number(ethers.formatEther(bal));
          numeric = valMatic;
          display = numeric.toFixed(6) + " MATIC";
        }
      } catch (e: any) {
        err = String(e);
      }
      return { numericValue: numeric, display, error: err };
    },
    []
  );

  const refreshSingleBalance = useCallback(
    (symbol: string | undefined) => {
      if (!symbol) return;
      const asset = assets.find((x) => x.symbol === symbol);
      if (!asset) return;
      requestQueue.enqueue(async () => {
        try {
          setIsRefreshing(true);
          await fetchPricesBatch([symbol]);
          const { numericValue, display, error } = await fetchSingleBalance(asset);
          const pair = binanceSymbols[symbol] || "";
          let usdVal = 0;
          if (pair && pricesCache[pair]?.price) {
            usdVal = numericValue * pricesCache[pair].price;
          }
          const updated: AssetBalance = {
            symbol: asset.symbol,
            address: asset.address,
            displayBalance: display,
            numericValue,
            error,
            usdValue: usdVal
          };
          setBalances((prev) =>
            prev.map((b) => (b.symbol === symbol ? updated : b))
          );
        } catch (e) {
          console.warn("refreshSingleBalance error =>", e);
        } finally {
          setIsRefreshing(false);
        }
      });
    },
    [assets, fetchSingleBalance, fetchPricesBatch, pricesCache]
  );

  const fetchSingleHistory = useCallback(async (a: DerivedAsset) => {
    if (a.symbol === "BTC") {
      return fetchBtcHistoryPaged(a.address, 1, 20);
    }
    if (a.symbol === "LTC") {
      return fetchLtcHistoryPaged(a.address, 1, 20);
    }
    if (a.symbol === "DOGE") {
      return fetchDogeHistoryPaged(a.address, 1, 20);
    }
    if (a.symbol === "DASH") {
      return fetchDashHistoryPaged(a.address, 1, 20);
    }
    if (a.symbol === "ZEC") {
      return fetchZecHistoryPaged(a.address, 1, 20);
    }
    if (a.symbol === "ETH") {
      return fetchEthHistoryPaged(a.address, 1, 20);
    }
    if (a.symbol === "USDT-ERC20") {
      return fetchErc20HistoryPaged(USDT_ERC20, a.address, 1, 20);
    }
    if (a.symbol === "TRX") {
      return fetchTrxHistoryPaged(a.address, 1, 20);
    }
    if (a.symbol === "USDT-TRC20") {
      return fetchTrc20HistoryPaged(USDT_TRC20, a.address, 1, 20);
    }
    if (a.symbol === "MATIC") {
      return fetchMaticHistoryPaged(a.address, 1, 20);
    }
    return { items: [], hasMore: false };
  }, []);

  const fetchAllBalances = useCallback(async () => {
    if (assets.length === 0) return;
    await fetchPricesBatch(assets.map((a) => a.symbol));
    const newBalances: AssetBalance[] = [];
    const promises = assets.map(
      (a) =>
        new Promise<void>((resolve) => {
          requestQueue.enqueue(async () => {
            try {
              const { numericValue, display, error } = await fetchSingleBalance(a);
              let usdVal = 0;
              const pair = binanceSymbols[a.symbol] || "";
              if (pair && pricesCache[pair]?.price) {
                usdVal = numericValue * pricesCache[pair].price;
              }
              newBalances.push({
                symbol: a.symbol,
                address: a.address,
                displayBalance: display,
                numericValue,
                error,
                usdValue: usdVal
              });
            } catch {
              newBalances.push({
                symbol: a.symbol,
                address: a.address,
                displayBalance: "0.000000 " + a.symbol,
                error: "Failed to fetch balance"
              });
            } finally {
              resolve();
            }
          });
        })
    );
    await Promise.all(promises);
    const sorted = assets
      .map((a) => newBalances.find((x) => x.symbol === a.symbol))
      .filter(Boolean) as AssetBalance[];
    setBalances(sorted);
  }, [assets, fetchSingleBalance, fetchPricesBatch, pricesCache]);

  const currentBalance = useCallback(() => {
    if (balances.length === 0) return null;
    const idx =
      ((debouncedCarouselIndex % balances.length) + balances.length) % balances.length;
    return balances[idx];
  }, [balances, debouncedCarouselIndex]);

  const leftArrow = () => {
    setCarouselIndex((prev) => prev - 1);
  };

  const rightArrow = () => {
    setCarouselIndex((prev) => prev + 1);
  };

  const centerIndex = () => {
    if (balances.length === 0) return 0;
    return ((carouselIndex % balances.length) + balances.length) % balances.length;
  };

  const leftIndex = () => {
    if (balances.length === 0) return 0;
    return ((carouselIndex - 1) % balances.length + balances.length) % balances.length;
  };

  const rightIndexVal = () => {
    if (balances.length === 0) return 0;
    return ((carouselIndex + 1) % balances.length + balances.length) % balances.length;
  };

  const coinAt = (i: number) => {
    return balances[i] || null;
  };

  useEffect(() => {
    const enc = localStorage.getItem("encrypted_mnemonic");
    if (!enc) {
      setError("No mnemonic => please create/import wallet first.");
      setLoading(false);
      return;
    }
    const pass = localStorage.getItem("wallet_password") || "";
    if (!pass) {
      setError("No local password found. Please re-import with a password.");
      setLoading(false);
      return;
    }
    let decrypted = "";
    try {
      const bytes = CryptoJS.AES.decrypt(enc, pass);
      const tmp = bytes.toString(CryptoJS.enc.Utf8);
      if (tmp) {
        decrypted = tmp;
      } else {
        setError("Wrong password or decryption failed. Please re-import.");
        setLoading(false);
        return;
      }
    } catch (e) {
      setError("Decryption error => " + String(e));
      setLoading(false);
      return;
    }
    deriveMultiAssets(decrypted)
      .then((arr) => {
        setAssets(arr);
      })
      .catch((err) => {
        setError("Error => " + String(err));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (assets.length > 0) {
      fetchAllBalances().finally(() => {
        setLoading(false);
      });
    } else {
      if (error) setLoading(false);
    }
  }, [assets, error, fetchAllBalances]);

  const loadHistoryForCurrentCoin = useCallback(() => {
    const b = currentBalance();
    if (!b) {
      setTxItems([]);
      setExpandedTx(null);
      return;
    }
    const key = b.address + ":" + b.symbol;
    const cached = cachedHistory[key];
    const now = Date.now();
    if (!cached || now - cached.fetchedAt > HISTORY_CACHE_TTL_MS) {
      requestQueue.enqueue(async () => {
        try {
          const hist = await fetchSingleHistory({
            symbol: b.symbol,
            address: b.address,
            privateKey: ""
          });
          setCachedHistory((prev) => ({
            ...prev,
            [key]: { items: hist.items, fetchedAt: Date.now() }
          }));
          setTxItems(hist.items);
          setExpandedTx(null);
        } catch (err) {
          setCachedHistory((prev) => {
            const oldItems = prev[key]?.items || [];
            return {
              ...prev,
              [key]: { items: oldItems, fetchedAt: Date.now() }
            };
          });
          setTxItems([]);
          setExpandedTx(null);
        }
      });
    } else {
      setTxItems(cached.items);
      setExpandedTx(null);
    }
  }, [currentBalance, cachedHistory, fetchSingleHistory]);

  useEffect(() => {
    loadHistoryForCurrentCoin();
  }, [debouncedCarouselIndex, balances, loadHistoryForCurrentCoin]);

  const BACKGROUND_HISTORY_INTERVAL_MS = 5 * 60000;
  const periodicCheckForCurrentCoin = useCallback(() => {
    const b = currentBalance();
    if (!b) return;
    const key = b.address + ":" + b.symbol;
    const lastFetch = cachedHistory[key]?.fetchedAt || 0;
    const now = Date.now();
    if (now - lastFetch < 120000) {
      return;
    }
    requestQueue.enqueue(async () => {
      try {
        const hist = await fetchSingleHistory({
          symbol: b.symbol,
          address: b.address,
          privateKey: ""
        });
        const old = lastKnownTxCache[key]?.items || [];
        const oldIds = new Set(old.map((tx) => tx.txid));
        const newTxs = hist.items.filter((tx) => !oldIds.has(tx.txid));
        const inbound = newTxs.filter((tx) => tx.isIncoming);
        if (inbound.length > 0) {
          inbound.forEach((tx) => {
            showElectronNotification(
              "New Transaction",
              `Incoming ${tx.value} on ${b.symbol}`
            );
          });
        }
        setCachedHistory((prev) => ({
          ...prev,
          [key]: { items: hist.items, fetchedAt: now }
        }));
        setLastKnownTxCache((prev) => ({
          ...prev,
          [key]: { items: hist.items, fetchedAt: now }
        }));
        const cb = currentBalance();
        if (cb && cb.symbol === b.symbol && cb.address === b.address) {
          setTxItems(hist.items);
          setExpandedTx(null);
        }
        if (inbound.length > 0) {
          refreshSingleBalance(b.symbol);
        }
      } catch (err) {
        setCachedHistory((prev) => {
          const oldItems = prev[key]?.items || [];
          return {
            ...prev,
            [key]: { items: oldItems, fetchedAt: Date.now() }
          };
        });
      }
    });
  }, [
    currentBalance,
    cachedHistory,
    fetchSingleHistory,
    lastKnownTxCache,
    refreshSingleBalance
  ]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      periodicCheckForCurrentCoin();
    }, BACKGROUND_HISTORY_INTERVAL_MS);
    periodicCheckForCurrentCoin();
    return () => {
      clearInterval(intervalId);
    };
  }, [periodicCheckForCurrentCoin]);

  const loadSparkline = useCallback(() => {
    const b = currentBalance();
    setErrorSparkline("");
    setLoadingSparkline(true);
    setSparklineData([]);
    targetHoverIndexRef.current = null;
    targetBubblePosRef.current = null;
    targetTooltipPosRef.current = null;
    targetHoverPriceRef.current = null;
    targetHoverDiffRef.current = null;
    setHoverIndex(null);
    setBubblePos(null);
    setTooltipPos(null);
    setHoverPriceState(0);
    setHoverDiffState(0);
    if (!b) {
      setLoadingSparkline(false);
      return;
    }
    const sym = b.symbol;
    const pair = binanceSymbols[sym];
    if (!pair) {
      setErrorSparkline("No chart data");
      setLoadingSparkline(false);
      return;
    }
    const now = Date.now();
    const cache = cachedSparklines[pair];
    if (cache && now - cache.lastFetched < 300000) {
      setSparklineData(cache.data);
      setLoadingSparkline(false);
      return;
    }
    requestQueue.enqueue(async () => {
      try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=30m&limit=48`;
        const data = await fetchWithRetry(url);
        const closes: number[] = data.map((arr: any) => parseFloat(arr[4]));
        setSparklineData(closes);
        setCachedSparklines((prev) => ({
          ...prev,
          [pair]: { data: closes, lastFetched: now }
        }));
      } catch {
        setErrorSparkline("Request failed. Check your network.");
      } finally {
        setLoadingSparkline(false);
      }
    });
  }, [currentBalance, cachedSparklines]);

  useEffect(() => {
    loadSparkline();
  }, [debouncedCarouselIndex, balances, loadSparkline]);

  const handleSparklineMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (sparklineData.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPos = e.clientX - rect.left;
    let i = (xPos / 320) * (sparklineData.length - 1);
    i = Math.round(i);
    if (i < 0) i = 0;
    if (i >= sparklineData.length) i = sparklineData.length - 1;
    targetHoverIndexRef.current = i;
    const arr = sparklineData;
    const minVal = Math.min(...arr);
    const maxVal = Math.max(...arr);
    const diffVal = maxVal - minVal || 1;
    const val = arr[i];
    const x = (i / (arr.length - 1)) * 320;
    const y = 100 - ((val - minVal) / diffVal) * 100;
    targetBubblePosRef.current = { x, y, val };
    targetTooltipPosRef.current = {
      x: rect.left + x + 12,
      y: rect.top + y - 40
    };
    let diff = 0;
    if (i > 0) diff = arr[i] - arr[i - 1];
    targetHoverPriceRef.current = val;
    targetHoverDiffRef.current = diff;
    if (hoverIndex === null) setHoverIndex(i);
    if (!bubblePos) setBubblePos({ x, y, val });
    if (!tooltipPos) setTooltipPos({ x: rect.left + x + 12, y: rect.top + y - 40 });
    if (hoverPriceState === 0) setHoverPriceState(val);
    if (hoverDiffState === 0) setHoverDiffState(diff);
  };

  const handleSparklineMouseLeave = () => {
    targetHoverIndexRef.current = null;
    targetBubblePosRef.current = null;
    targetTooltipPosRef.current = null;
    targetHoverPriceRef.current = null;
    targetHoverDiffRef.current = null;
    setHoverIndex(null);
    setBubblePos(null);
    setTooltipPos(null);
    setHoverPriceState(0);
    setHoverDiffState(0);
  };

  const handleOpenInfoModal = useCallback(async () => {
    try {
      const resp = await fetchWithRetry("/api/info");
      setInfoContent(resp.content);
      setShowInfoModal(true);
    } catch (err) {
      setInfoContent("<p style='color:red;'>Error loading info</p>");
      setShowInfoModal(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("encrypted_mnemonic");
    window.location.href = "/wallet";
  };

  const handleCopyAddress = (e: React.MouseEvent) => {
    const b = currentBalance();
    if (!b) return;
    if (window.electronAPI?.copyToClipboard) {
      window.electronAPI.copyToClipboard(b.address || "");
    } else {
      navigator.clipboard.writeText(b.address || "");
    }
    setTooltip({ x: e.clientX, y: e.clientY + 10, visible: true, text: "Copied!" });
    setTimeout(() => {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }, 1200);
  };

  const handleSend = () => {
    const b = currentBalance();
    if (!b) return;
    const priv = assets.find((x) => x.symbol === b.symbol)?.privateKey || "";
    setSendAsset({ symbol: b.symbol, address: b.address, privateKey: priv });
    setShowSendStep(1);
    setToAddress("");
    setSendAmount("");
    setSendMax(false);
    setSimulateError("");
    setSimulateFee(null);
    setSimulateVsize(null);
    setConfirmData(null);
  };

  const closeSendModal = () => {
    setShowSendStep(null);
    setSendAsset(null);
    setConfirmData(null);
    setFinalTxId("");
    setFinalSentAmount("");
  };

  const onChangeAmount = async (val: string) => {
    setSendAmount(val);
    setSendMax(false);
    setSimulateError("");
    setSimulateFee(null);
    setSimulateVsize(null);
    if (!sendAsset) return;
    const { symbol, privateKey } = sendAsset;
    if (!val || parseFloat(val) <= 0) return;
    if (["BTC", "LTC", "DOGE", "DASH", "ZEC"].includes(symbol)) {
      try {
        const sat = Math.floor(parseFloat(val) * 1e8);
        let r: any = null;
        if (symbol === "BTC") {
          r = await simulateBtcUtxoTx(privateKey, toAddress, sat);
        } else if (symbol === "LTC") {
          r = await simulateLtcUtxoTx(privateKey, toAddress, sat);
        } else if (symbol === "DOGE") {
          r = await simulateDogeUtxoTx(privateKey, toAddress, sat);
        } else if (symbol === "DASH") {
          r = await simulateDashUtxoTx(privateKey, toAddress, sat);
        } else {
          r = await simulateZecUtxoTx(privateKey, toAddress, sat);
        }
        if (!r) {
          setSimulateError("Not enough " + symbol + " or coinselect fail.");
          return;
        }
        setSimulateFee(r.fee);
        setSimulateVsize(r.vsize);
      } catch (e: any) {
        setSimulateError(String(e));
      }
    }
  };

  const onClickSendMax = async () => {
    setSendMax(true);
    setSimulateError("");
    setSimulateFee(null);
    setSimulateVsize(null);
    if (!sendAsset) return;
    const { symbol, privateKey, address } = sendAsset;
    if (["BTC", "LTC", "DOGE", "DASH", "ZEC"].includes(symbol)) {
      try {
        let s: any = null;
        if (symbol === "BTC") {
          s = await simulateBtcAllUtxoTx(privateKey);
        } else if (symbol === "LTC") {
          s = await simulateAllLtcUtxoTx(privateKey);
        } else if (symbol === "DOGE") {
          s = await simulateAllDogeUtxoTx(privateKey);
        } else if (symbol === "DASH") {
          s = await simulateAllDashUtxoTx(privateKey);
        } else {
          s = await simulateAllZecUtxoTx(privateKey);
        }
        if (s.success) {
          const valN = s.sendValue / 1e8;
          setSendAmount(valN.toFixed(6));
        } else {
          setSimulateError(s.error);
          setSendAmount("0");
        }
      } catch (e: any) {
        setSimulateError(String(e));
        setSendAmount("0");
      }
    } else if (symbol === "ETH") {
      try {
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_INFURA_URL || "");
        const feeData = await provider.getFeeData();
        const gasPriceWei = feeData.gasPrice || 0n;
        const balWei = await provider.getBalance(address);
        const estGas = await provider.estimateGas({
          from: address,
          to: toAddress,
          value: balWei
        });
        const feeWei = estGas * gasPriceWei;
        if (balWei <= feeWei) {
          setSimulateError("Not enough ETH to cover gas fee");
          setSendAmount("0");
          return;
        }
        const maxWei = balWei - feeWei;
        const maxEth = Number(ethers.formatEther(maxWei));
        setSendAmount(maxEth.toFixed(6));
      } catch (e) {
        setSimulateError(String(e));
        setSendAmount("0");
      }
    } else if (symbol === "USDT-ERC20") {
      try {
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_INFURA_URL || "");
        const c = new ethers.Contract(
          USDT_ERC20,
          ["function balanceOf(address) view returns(uint256)"],
          provider
        );
        const b = await c.balanceOf(address);
        const numeric = Number(ethers.formatUnits(b, 6));
        setSendAmount(numeric.toFixed(6));
      } catch (e) {
        setSimulateError(String(e));
        setSendAmount("0");
      }
    } else if (symbol === "TRX") {
      try {
        const tronWeb = new TronWeb({ fullHost: "https://api.trongrid.io" });
        tronWeb.setAddress(address);
        const balSun = await tronWeb.trx.getBalance(address);
        if (balSun <= 1000000) {
          setSimulateError("Not enough TRX for fee reserve (1 TRX).");
          setSendAmount("0");
          return;
        }
        const maxSun = balSun - 1000000;
        const maxTrx = maxSun / 1e6;
        setSendAmount(maxTrx.toFixed(6));
      } catch (e) {
        setSimulateError(String(e));
        setSendAmount("0");
      }
    } else if (symbol === "USDT-TRC20") {
      try {
        tron.setAddress(address);
        const c2 = await tron.contract().at(USDT_TRC20);
        const b2 = await c2.balanceOf(address).call();
        const numeric = Number(b2.toString()) / 1e6;
        setSendAmount(numeric.toFixed(6));
      } catch (e) {
        setSimulateError(String(e));
        setSendAmount("0");
      }
    } else if (symbol === "MATIC") {
      try {
        const mp = new ethers.JsonRpcProvider("https://polygon-rpc.com/");
        const feeData = await mp.getFeeData();
        const gasPriceWei = feeData.gasPrice || 0n;
        const balWei = await mp.getBalance(address);
        const estGas = await mp.estimateGas({
          from: address,
          to: toAddress,
          value: balWei
        });
        const feeWei = estGas * gasPriceWei;
        if (balWei <= feeWei) {
          setSimulateError("Not enough MATIC to cover gas fee");
          setSendAmount("0");
          return;
        }
        const maxWei = balWei - feeWei;
        const maxMatic = Number(ethers.formatEther(maxWei));
        setSendAmount(maxMatic.toFixed(6));
      } catch (e) {
        setSimulateError(String(e));
        setSendAmount("0");
      }
    } else {
      setSimulateError("Max not supported for this coin");
      setSendAmount("0");
    }
  };

  const goConfirmStep = () => {
    if (!sendAsset) return;
    if (!toAddress || !sendAmount) return;
    const feeNumber = simulateFee || 0;
    setConfirmData({
      to: toAddress,
      amount: sendAmount,
      fee: feeNumber,
      symbol: sendAsset.symbol
    });
    setShowSendStep(2);
  };

  const addPendingTxToHistory = async (
    asset: DerivedAsset,
    txid: string,
    to: string,
    amount: string
  ) => {
    const now = Date.now();
    const newTx: TxHistoryItem = {
      timestamp: now,
      txid,
      from: asset.address,
      to,
      value: amount,
      isIncoming: false
    };
    const key = asset.address + ":" + asset.symbol;
    setCachedHistory((prev) => {
      const old = prev[key] ? prev[key].items : [];
      return {
        ...prev,
        [key]: {
          items: [newTx, ...old],
          fetchedAt: Date.now()
        }
      };
    });
    setTxItems((prev) => [newTx, ...prev]);
  };

  const forceHistoryReload = async (asset: DerivedAsset) => {
    const key = asset.address + ":" + asset.symbol;
    try {
      const hist = await fetchSingleHistory(asset);
      setCachedHistory((prev) => ({
        ...prev,
        [key]: { items: hist.items, fetchedAt: Date.now() }
      }));
      setTxItems(hist.items);
      setExpandedTx(null);
    } catch (err) {
    }
  };

  const doBroadcast = async (): Promise<{ txId: string } | null> => {
    if (!confirmData || !sendAsset) {
      return null;
    }
    try {
      let txid = "";
      const { symbol, privateKey } = sendAsset;
      if (symbol === "BTC") {
        if (sendMax) {
          txid = await sendAllBtcUtxoTx(privateKey, confirmData.to);
        } else {
          txid = await sendExactBtcUtxoTx(privateKey, confirmData.to, confirmData.amount);
        }
      } else if (symbol === "LTC") {
        if (sendMax) {
          txid = await sendAllLtcUtxoTx(privateKey, confirmData.to);
        } else {
          txid = await sendExactLtcUtxoTx(privateKey, confirmData.to, confirmData.amount);
        }
      } else if (symbol === "DOGE") {
        if (sendMax) {
          txid = await sendAllDogeUtxoTx(privateKey, confirmData.to);
        } else {
          txid = await sendExactDogeUtxoTx(privateKey, confirmData.to, confirmData.amount);
        }
      } else if (symbol === "DASH") {
        if (sendMax) {
          txid = await sendAllDashUtxoTx(privateKey, confirmData.to);
        } else {
          txid = await sendExactDashUtxoTx(privateKey, confirmData.to, confirmData.amount);
        }
      } else if (symbol === "ZEC") {
        if (sendMax) {
          txid = await sendAllZecUtxoTx(privateKey, confirmData.to);
        } else {
          txid = await sendExactZecUtxoTx(privateKey, confirmData.to, confirmData.amount);
        }
      } else if (symbol === "ETH") {
        txid = await sendEthTransaction(privateKey, confirmData.to, confirmData.amount);
      } else if (symbol === "USDT-ERC20") {
        txid = await sendErc20Transaction(
          privateKey,
          USDT_ERC20,
          confirmData.to,
          confirmData.amount
        );
      } else if (symbol === "TRX") {
        txid = await sendTrxTransaction(privateKey, confirmData.to, confirmData.amount);
      } else if (symbol === "USDT-TRC20") {
        txid = await sendTrc20Transaction(
          privateKey,
          USDT_TRC20,
          confirmData.to,
          confirmData.amount
        );
        setTimeout(async () => {
          try {
            await getTrxFeeSpent(txid);
          } catch {}
        }, 5000);
      } else if (symbol === "MATIC") {
        txid = await sendMaticTransaction(privateKey, confirmData.to, confirmData.amount);
      }
      setFinalTxId(txid);
      setFinalSentAmount(confirmData.amount);
      setShowSendStep(3);
      addPendingTxToHistory(sendAsset, txid, confirmData.to, confirmData.amount);
      await forceHistoryReload(sendAsset);
      return { txId: txid };
    } catch (e: any) {
      setSimulateError("Failed to send transaction.");
      return null;
    }
  };

  const handleCopyTxId = (e: React.MouseEvent, txid: string) => {
    navigator.clipboard.writeText(txid);
    setTooltip({ x: e.clientX, y: e.clientY + 10, visible: true, text: "Copied!" });
    setTimeout(() => {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }, 1200);
  };

  useEffect(() => {
    const symbols = [
      "BTC",
      "LTC",
      "DOGE",
      "DASH",
      "ZEC",
      "ETH",
      "TRX",
      "USDT-ERC20",
      "USDT-TRC20",
      "MATIC"
    ];
    symbols.forEach((s) => {
      const img = new Image();
      img.src = getCoinIcon(s);
    });
  }, []);

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <>
      <div className="pageScrollWrapper" ref={pageScrollRef}>
        {tooltip.visible && (
          <div
            style={{
              position: "fixed",
              top: tooltip.y,
              left: tooltip.x,
              padding: "6px 10px",
              background: "rgba(0,0,0,0.8)",
              color: "#fff",
              borderRadius: "4px",
              fontSize: "0.9rem",
              pointerEvents: "none",
              zIndex: 9999
            }}
          >
            {tooltip.text}
          </div>
        )}
        <div className="floatingShapes">
          <div className="shape cube" style={{ top: "20%", left: "10%" }} />
          <div className="shape sphere" style={{ top: "70%", left: "80%" }} />
          <div className="shape triangle" style={{ top: "40%", left: "50%" }} />
        </div>
        <div className="topBarContainer">
          <div className="logoJaxx">
            <img
              src="/icons/logo.png"
              alt="Logo"
              style={{ height: "35px", marginTop: "0px" }}
            />
          </div>
          <div className="coinCarousel">
            <button className="arrowBtn" onClick={leftArrow}>
              &lt;
            </button>
            <div className="coinItems">
              {balances.length > 0 && (
                <>
                  <div
                    className="coinItem"
                    onClick={() => setCarouselIndex(leftIndex())}
                  >
                    {coinAt(leftIndex()) && (
                      <>
                        <img
                          src={getCoinIcon(coinAt(leftIndex())!.symbol)}
                          alt={coinAt(leftIndex())?.symbol}
                          className="coinIcon"
                        />
                        <div className="coinSymbol">
                          {coinAt(leftIndex())
                            ? getCarouselSymbol(coinAt(leftIndex())!.symbol)
                            : ""}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="coinItem active">
                    {coinAt(centerIndex()) && (
                      <>
                        <img
                          src={getCoinIcon(coinAt(centerIndex())!.symbol)}
                          alt={coinAt(centerIndex())?.symbol}
                          className="coinIcon"
                        />
                        <div className="coinSymbol">
                          {coinAt(centerIndex())
                            ? getCarouselSymbol(coinAt(centerIndex())!.symbol)
                            : ""}
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    className="coinItem"
                    onClick={() => setCarouselIndex(rightIndexVal())}
                  >
                    {coinAt(rightIndexVal()) && (
                      <>
                        <img
                          src={getCoinIcon(coinAt(rightIndexVal())!.symbol)}
                          alt={coinAt(rightIndexVal())?.symbol}
                          className="coinIcon"
                        />
                        <div className="coinSymbol">
                          {coinAt(rightIndexVal())
                            ? getCarouselSymbol(coinAt(rightIndexVal())!.symbol)
                            : ""}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <button className="arrowBtn" onClick={rightArrow}>
              &gt;
            </button>
          </div>
          <div
            className="topBarRight"
            style={{ display: "flex", gap: "5px", alignItems: "center" }}
          >
            <button
              className="circleBtn"
              onClick={handleOpenInfoModal}
              title="Info"
            >
              ?
            </button>
            <button
              className="circleBtn logoutBtn"
              onClick={handleLogout}
              title="Logout"
            >
              <img
                src="/icons/logout.png"
                alt="Logout"
                style={{
                  width: "22px",
                  height: "22px",
                  position: "relative",
                  top: "0px",
                  marginLeft: "2px"
                }}
              />
            </button>
          </div>
        </div>
        <div className="dashboardContainer">
          <div className="leftPane">
            {error && <div style={{ color: "red" }}>{error}</div>}
            {currentBalance() && (
              <>
                <div className="coinHeaderSection">
                  <img
                    src={getCoinIcon(currentBalance()!.symbol)}
                    alt={currentBalance()!.symbol}
                    className="mainCoinIcon"
                  />
                  <div className="mainCoinSymbol">
                    {currentBalance()!.symbol}
                  </div>
                  <div className="balanceRow">
                    <div className="bigBalance">
                      {currentBalance()?.numericValue?.toFixed(6) ||
                        "0.000000"}
                    </div>
                    <button
                      className="refreshBtn"
                      onClick={() =>
                        refreshSingleBalance(currentBalance()?.symbol)
                      }
                      disabled={isRefreshing}
                      title="Refresh balance"
                    >
                      <svg
                        stroke="#ccc"
                        fill="none"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        style={{
                          transform: isRefreshing ? "rotate(360deg)" : "none",
                          transition: "0.4s"
                        }}
                      >
                        <path d="M23 4v6h-6" />
                        <path d="M20.49 9A9 9 0 1 1 17 5.3l1 .7" />
                      </svg>
                    </button>
                  </div>
                  <div className="usdBalance">
                    US${(currentBalance()?.usdValue || 0).toFixed(2)}
                    {currentBalance()?.error && (
                      <span style={{ fontSize: "0.8rem", color: "#f66" }}>
                        {" "}
                        !
                      </span>
                    )}
                  </div>
                </div>
                <div className="sparklineContainer">
                  {loadingSparkline && (
                    <div className="chartLoadMsg">Loading chart...</div>
                  )}
                  {!loadingSparkline &&
                    errorSparkline &&
                    sparklineData.length < 2 && (
                      <div className="chartErrorMsg">{errorSparkline}</div>
                    )}
                  {!loadingSparkline &&
                    !errorSparkline &&
                    sparklineData.length < 2 && (
                      <div className="chartLoadMsg">No chart data</div>
                    )}
                  {!loadingSparkline && sparklineData.length > 1 && (
                    <svg
                      width="320"
                      height="120"
                      onMouseMove={handleSparklineMouseMove}
                      onMouseLeave={handleSparklineMouseLeave}
                      style={{ cursor: "crosshair" }}
                    >
                      <polyline
                        points={sparklineData
                          .map((val, i, arr) => {
                            const minVal = Math.min(...arr);
                            const maxVal = Math.max(...arr);
                            const diff = maxVal - minVal || 1;
                            const x = (i / (arr.length - 1)) * 320;
                            const y =
                              100 - ((val - minVal) / diff) * 100;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                        style={{
                          stroke: "rgb(241,118,40)",
                          strokeWidth: 2,
                          fill: "none"
                        }}
                      />
                      <g>
                        <rect
                          x="3"
                          y="105"
                          width="40"
                          height="14"
                          style={{
                            fill: "rgba(255,255,255,0.2)",
                            stroke: "none"
                          }}
                          rx="2"
                          ry="2"
                        />
                        <text
                          x="10"
                          y="115"
                          fill="#fff"
                          fontSize="8"
                          style={{ fontWeight: 400 }}
                        >
                          24h
                        </text>
                      </g>
                      {hoverIndex !== null && bubblePos && (
                        <circle
                          cx={bubblePos.x}
                          cy={bubblePos.y}
                          r={4}
                          fill="#fff"
                        />
                      )}
                    </svg>
                  )}
                  {tooltipPos && (
                    <div
                      style={{
                        position: "fixed",
                        left: tooltipPos.x,
                        top: tooltipPos.y,
                        background: "rgba(0,0,0,0.7)",
                        color: "#fff",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        fontSize: "0.9rem",
                        pointerEvents: "none"
                      }}
                    >
                      <div>Price: ${hoverPriceState.toFixed(4)}</div>
                      <div>
                        Diff:{" "}
                        {hoverDiffState >= 0
                          ? "+" + hoverDiffState.toFixed(4)
                          : hoverDiffState.toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="addressBlock">
                  <div className="addressRow">
                    <span className="addrLabel">Address</span>
                    <span className="addrValue" onClick={handleCopyAddress}>
                      {currentBalance()?.address}
                    </span>
                  </div>
                  <div className="qrHolder">
                    <QRCode
                      size={120}
                      value={currentBalance()?.address || ""}
                    />
                  </div>
                  <button className="sendBtn" onClick={handleSend}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="rightPane">
            <div className="historyTitle">Transaction History</div>
            <div className="txListContainer">
              {isDebouncing && (
                <div className="typingLoader">
                  <TypingLoader />
                </div>
              )}
              {!isDebouncing && txItems.length === 0 && (
                <div className="noTx">No transactions found</div>
              )}
              {!isDebouncing &&
                txItems.map((tx, idx) => {
                  const localTime = tx.timestamp
                    ? new Date(tx.timestamp).toLocaleString()
                    : "";
                  const arrowIcon = tx.isIncoming ? "/icons/in.png" : "/icons/left.png";
                  const expanded = expandedTx === tx.txid;
                  return (
                    <div key={idx} className="txItem">
                      <div
                        className="txItemMain"
                        onClick={() => {
                          setExpandedTx(expanded ? null : tx.txid);
                        }}
                      >
                        <div className="txItemRow">
                          <img
                            src={arrowIcon}
                            className="txArrowIcon"
                            alt={tx.isIncoming ? "incoming" : "outgoing"}
                          />
                          <span className="txValue">{tx.value}</span>
                        </div>
                        <div className="txTime">{localTime}</div>
                      </div>
                      <div
                        className="txDetails"
                        style={{
                          maxHeight: expanded ? "9999px" : "0px"
                        }}
                      >
                        {expanded && (
                          <div className="txDetailsContent">
                            <div style={{ fontSize: "0.85rem", lineHeight: "1.2" }}>
                              <strong style={{ whiteSpace: "nowrap" }}>FROM:</strong>{" "}
                              <span style={{ wordBreak: "break-all" }}>
                                {tx.from}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.85rem", lineHeight: "1.2" }}>
                              <strong style={{ whiteSpace: "nowrap" }}>TO:</strong>{" "}
                              <span style={{ wordBreak: "break-all" }}>
                                {tx.to}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                alignItems: "center",
                                fontSize: "0.85rem",
                                lineHeight: "1.2"
                              }}
                            >
                              <strong style={{ whiteSpace: "nowrap" }}>TxID:</strong>
                              <span
                                className="txIdLink"
                                style={{ wordBreak: "break-all" }}
                                onClick={(e) => handleCopyTxId(e, tx.txid)}
                              >
                                {tx.txid}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
        {showSendStep === 1 && sendAsset && (() => {
          const b = balances.find((bb) => bb.symbol === sendAsset.symbol);
          let pricePerCoin = 0;
          if (b && b.usdValue && b.usdValue > 0) {
            if (b.numericValue && b.numericValue > 0) {
              pricePerCoin = b.usdValue / b.numericValue;
            } else {
              pricePerCoin = b.usdValue;
            }
          }
          return (
            <SendStep1Modal
              sendAsset={sendAsset}
              toAddress={toAddress}
              setToAddress={setToAddress}
              sendAmount={sendAmount}
              setSendAmount={setSendAmount}
              sendMax={sendMax}
              setSendMax={setSendMax}
              simulateError={simulateError}
              simulateFee={simulateFee}
              simulateVsize={simulateVsize}
              onChangeAmount={onChangeAmount}
              onClickSendMax={onClickSendMax}
              onNext={goConfirmStep}
              onClose={closeSendModal}
              assetBalance={b?.numericValue || 0}
              assetUsdPrice={pricePerCoin}
            />
          );
        })()}
        {showSendStep === 2 && confirmData && (
          <SendStep2Modal
            confirmData={confirmData}
            onConfirm={doBroadcast}
            onConfirmSuccess={(txId: string) => {
              setFinalTxId(txId);
              setFinalSentAmount(confirmData.amount);
              setShowSendStep(3);
            }}
            onClose={closeSendModal}
            onBack={() => setShowSendStep(1)}
          />
        )}
        {showSendStep === 3 && (
          <SendStep3Modal
            onClose={closeSendModal}
            txId={finalTxId}
            sentAmount={finalSentAmount}
            sentSymbol={sendAsset?.symbol || ""}
            onDone={() => {
              refreshSingleBalance(sendAsset?.symbol);
            }}
          />
        )}
        {showInfoModal && (
          <InfoModal onClose={() => setShowInfoModal(false)} content={infoContent} />
        )}
      </div>
      {showScrollTop && (
        <button
          className="scrollTopBtn"
          onClick={scrollToTop}
          title="Scroll to top"
        >
          ^
        </button>
      )}
    </>
  );
}

function TypingLoader() {
  const [text, setText] = useState("");
  const fullText = "Loading transactions...";
  useEffect(() => {
    let idx = 0;
    const timer = setInterval(() => {
      setText(fullText.slice(0, idx));
      idx++;
      if (idx > fullText.length) {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);
  return <div style={{ whiteSpace: "pre" }}>{text}</div>;
}
