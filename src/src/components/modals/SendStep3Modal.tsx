import React, { useState } from "react"

interface SendStep3ModalProps {
  onClose: () => void
  txId: string
  sentAmount: string
  sentSymbol?: string
  onDone?: () => void
}

export default function SendStep3Modal({
  onClose,
  txId,
  sentAmount,
  sentSymbol,
  onDone
}: SendStep3ModalProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(txId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error("Copy failed", err)
    }
  }

  function handleDone() {
    if (onDone) {
      onDone()
    }
    onClose()
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
      <div
        className="modalContent glassModal modalCard fancyModal scaleIn"
        style={{ textAlign: "center" }}
      >
        <button className="closeIconBtn" onClick={onClose}>
          ✕
        </button>
        <div className="modalHeader" style={{ marginBottom: "12px" }}>
          <h2 className="modalTitle">Transaction Broadcast</h2>
          <div className="modalSubTitle">Your transaction was successfully sent</div>
        </div>
        <div className="modalBody" style={{ marginTop: "10px" }}>
          <img
            src="/icons/done.png"
            alt="Done"
            style={{ width: 72, height: 72, margin: "0 auto" }}
          />
          <p style={{ marginTop: "16px", fontSize: "1.05rem", color: "#ddd" }}>
            Sent:
          </p>
          <p style={{ fontSize: "1.4rem", fontWeight: 600, margin: "0", color: "#fff" }}>
            - {sentAmount}{sentSymbol ? ` ${sentSymbol}` : ""}
          </p>
          <div
            style={{
              marginTop: "14px",
              fontSize: "1rem",
              color: "rgba(255,255,255,0.6)",
              wordWrap: "break-word",
              whiteSpace: "pre-wrap"
            }}
          >
            <strong style={{ color: "#fff" }}>TxID:</strong> {txId}
          </div>
          <div
            style={{
              marginTop: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#444",
              color: "#fff",
              borderRadius: "5px",
              padding: "6px 10px",
              cursor: "pointer",
              userSelect: "none"
            }}
            onClick={handleCopy}
          >
            <span style={{ color: copied ? "#0f0" : "#fff" }}>
              {copied ? "Copied!" : "Copy"}
            </span>
          </div>
        </div>
        <div className="modalFooter" style={{ justifyContent: "center", marginTop: "16px" }}>
          <button className="orangeButton" onClick={handleDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
