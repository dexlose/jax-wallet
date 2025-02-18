import React, { useEffect, useState } from "react"
import { InfinitySpin } from "react-loader-spinner"
import Image from "next/image"
import logoImg from "../../images/logo.png"

function getCoinIcon(symbol: string) {
  if (symbol === "BTC") return "/icons/coins_icons/bitcoin-btc-logo.svg";
  if (symbol === "ETH") return "/icons/coins_icons/ethereum-eth-logo.svg";
  if (symbol === "LTC") return "/icons/coins_icons/litecoin-ltc-logo.svg";
  if (symbol === "DOGE") return "/icons/coins_icons/dogecoin-doge-logo.svg";
  if (symbol === "DASH") return "/icons/coins_icons/dash-dash-logo.svg";
  if (symbol === "ZEC") return "/icons/coins_icons/zcash-zec-logo.svg";
  if (symbol === "TRX") return "/icons/coins_icons/tron-trx-logo.svg";
  if (symbol === "USDT-ERC20" || symbol === "USDT-TRC20") return "/icons/coins_icons/tether-usdt-logo.svg";
  if (symbol === "ATOM") return "/icons/coins_icons/generic.svg";
  if (symbol === "MATIC") return "/icons/coins_icons/polygon-matic-logo.svg";
  return "/icons/coins_icons/generic.svg";
}

interface ConfirmData {
  to: string
  amount: string
  fee?: number
  symbol: string
  usdValue?: string
}

interface SendStep2ModalProps {
  confirmData: ConfirmData
  onConfirm: () => Promise<{ txId: string } | null>
  onConfirmSuccess: (txId: string) => void
  onClose: () => void
  onBack?: () => void
}

export default function SendStep2Modal({
  confirmData,
  onConfirm,
  onConfirmSuccess,
  onClose,
  onBack
}: SendStep2ModalProps) {
  const { symbol, to, amount, fee, usdValue } = confirmData
  const [isSending, setIsSending] = useState(false)
  const [typedText, setTypedText] = useState("")

  useEffect(() => {
    if (isSending) {
      const fullText = "Broadcasting transaction..."
      setTypedText("")
      let i = 0
      const interval = setInterval(() => {
        setTypedText((prev) => prev + fullText[i])
        i++
        if (i >= fullText.length) {
          clearInterval(interval)
        }
      }, 35)
      return () => clearInterval(interval)
    }
  }, [isSending])

  async function handleSend() {
    setIsSending(true)
    try {
      const result = await onConfirm()
      if (result && result.txId) {
        onConfirmSuccess(result.txId)
      } else {
        console.error("Error")
        setIsSending(false)
      }
    } catch (err) {
      console.error("Error", err)
      setIsSending(false)
    }
  }

  return (
    <div
      className="modalOverlay fadeIn"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        width: "100%",
        height: "100%",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div className="modalContent glassModal modalCard fancyModal scaleIn">
        <button className="closeIconBtn" onClick={onClose}>
          ✕
        </button>

        {!isSending ? (
          <>
            <div className="modalHeader">
              <h2 className="modalTitle">Confirm Transaction</h2>
              <div className="modalSubTitle">Please review details carefully</div>
            </div>
            <div className="modalBody">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#bbb" }}>Coin:</span>
                  <span style={{ color: "#fff", display: "flex", gap: "6px", alignItems: "center" }}>
                    <img src={getCoinIcon(symbol)} alt={symbol} style={{ width: 24, height: 24 }} />
                    {symbol}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#bbb" }}>Recipient:</span>
                  <span style={{ color: "#fff", textAlign: "right" }}>
                    {to}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#bbb" }}>Amount:</span>
                  <span style={{ color: "#fff", textAlign: "right" }}>
                    {amount} {symbol.toUpperCase()}
                    {usdValue && (
                      <span style={{ marginLeft: "6px", color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>
                        / ${usdValue}
                      </span>
                    )}
                  </span>
                </div>
                {fee !== undefined && fee > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#bbb" }}>Fee (sat):</span>
                    <span style={{ color: "#fff" }}>{fee}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modalFooter" style={{ justifyContent: "space-between" }}>
              {onBack && (
                <button
                  className="grayButton"
                  style={{ marginRight: "auto" }}
                  onClick={onBack}
                >
                  Back
                </button>
              )}
              <button className="grayButton" onClick={onClose}>
                Cancel
              </button>
              <button
                className="orangeButton"
                onClick={handleSend}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ marginBottom: "20px" }}>
              <Image
                src={logoImg}
                alt="Logo"
                width={60}
                height={60}
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <div style={{ marginLeft: "-30px" }}>
              <InfinitySpin width="150" color="#ff9800" />
            </div>
            <p style={{ marginTop: "20px", color: "#fff", minHeight: "1.2em" }}>
              {typedText}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
