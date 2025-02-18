import React, { useEffect, useState, useContext } from "react"
import { useRouter } from "next/router"
import Image from "next/image"
import logoImg from "../../images/logo.png"
import { AuthContext } from "../_app"
import CryptoJS from "crypto-js"
import * as bip39 from "bip39"

export default function WalletSelectPage() {
  const router = useRouter()
  const auth = useContext(AuthContext)

  const [needUnlock, setNeedUnlock] = useState(false)

  const [userPassword, setUserPassword] = useState("")
  const [error, setError] = useState("")
  const [showForgotConfirm, setShowForgotConfirm] = useState(false)

  const [isVerifying, setIsVerifying] = useState(false)

  function isPlainMnemonic(str: string) {
    return bip39.validateMnemonic(str.trim())
  }

  useEffect(() => {
    const stored = localStorage.getItem("encrypted_mnemonic")
    if (!stored) {
      setNeedUnlock(false)
      return
    }

    if (isPlainMnemonic(stored)) {
      auth.unlockWallet()
      setNeedUnlock(false)
    } else {
      if (!auth.isUnlocked) {
        setNeedUnlock(true)
      }
    }
  }, [auth])

  function handleCreate() {
    router.push("/wallet/create")
  }
  function handleImport() {
    router.push("/wallet/import")
  }

  function handleUnlock() {
    setError("")
    const cipherText = localStorage.getItem("encrypted_mnemonic")
    if (!cipherText) {
      setError("No wallet data found.")
      return
    }

    setIsVerifying(true)

    setTimeout(() => {
      let decrypted = ""
      if (userPassword) {
        try {
          const bytes = CryptoJS.AES.decrypt(cipherText, userPassword)
          decrypted = bytes.toString(CryptoJS.enc.Utf8)
        } catch (e) {
          decrypted = ""
        }
      }

      if (!decrypted) {
        setIsVerifying(false)
        setError("Invalid password or data")
        return
      }

      auth.unlockWallet()
      setUserPassword("")

      setTimeout(() => {
        setIsVerifying(false)
        router.push("/wallet/dashboard")
      }, 800)
    }, 1000)
  }

  function handleForgotPassword() {
    setShowForgotConfirm(true)
  }

  function handleConfirmForgot() {
    localStorage.removeItem("encrypted_mnemonic")
    auth.lockWallet()
    setShowForgotConfirm(false)
    setUserPassword("")
    setError("Wallet data removed. Please create or import again.")
    setNeedUnlock(false)
  }

  function handleCancelForgot() {
    setShowForgotConfirm(false)
  }

  return (
    <div style={styles.container}>
      <style jsx>{`
        .glassPanel {
          position: relative;
          width: 400px;
          max-width: 90%;
          padding: 40px 30px;
          border-radius: 16px;
          text-align: center;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          animation: floatIn 0.8s ease both;
        }

        @keyframes floatIn {
          0% {
            opacity: 0;
            transform: translateY(25px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .innerGlow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          border-radius: inherit;
          background: radial-gradient(
            circle at 20% 80%,
            rgba(255,180,100, 0.25),
            transparent 50%
          );
        }

        .logoWrap {
          margin-bottom: 24px;
        }

        .title {
          color: #fff;
          font-size: 1.8rem;
          margin-bottom: 16px;
          font-weight: 600;
        }
        .subtitle {
          color: rgba(255,255,255,0.9);
          margin-bottom: 30px;
          line-height: 1.5;
          font-size: 1rem;
          font-weight: 400;
        }

        .actionBtn {
          display: block;
          width: 100%;
          padding: 16px;
          margin-bottom: 14px;
          font-size: 1rem;
          font-weight: 500;
          color: #fff; 
          background: rgb(241,118,40);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 4px 6px rgba(0,0,0,0.2);
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        }
        .actionBtn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 14px rgba(241,118,40, 0.3);
          opacity: 0.95;
        }

        .actionBtn.secondaryBtn {
          background: #888;
        }
        .actionBtn.secondaryBtn:hover {
          box-shadow: 0 8px 14px rgba(136,136,136, 0.3);
        }

        .modalBackdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .modalContent {
          width: 90%;
          max-width: 400px;
          background: #222;
          padding: 24px;
          border-radius: 8px;
          text-align: center;
        }
        .modalContent h3 {
          color: #fff;
          margin-bottom: 16px;
        }
        .modalBtn {
          background: rgb(241,118,40);
          color: #fff;
          border: none;
          padding: 12px 20px;
          margin: 8px;
          border-radius: 6px;
          cursor: pointer;
        }

        .verifyingOverlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          z-index: 9998;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-direction: column;
        }
        .spinCircle {
          width: 40px;
          height: 40px;
          border: 4px solid #fff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes spin {
          0% { transform: rotate(0); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {isVerifying && (
        <div className="verifyingOverlay">
          <div className="spinCircle" />
          <div>Verifying password...</div>
        </div>
      )}

      <div className="glassPanel">
        <div className="innerGlow"></div>

        <div className="logoWrap">
          <Image
            src={logoImg}
            alt="Jaxx Logo"
            width={180}
            height={180}
            style={{ objectFit: "contain" }}
          />
        </div>

        {needUnlock ? (
          <>
            <h2 className="title">Unlock Your Wallet</h2>
            {error && <p style={{ color: "red", marginBottom: 12 }}>{error}</p>}
            <input
              type="password"
              placeholder="Enter password (or leave empty if none)"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              style={{
                width: "100%",
                marginBottom: 12,
                padding: 12,
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
              }}
            />
            <button className="actionBtn" onClick={handleUnlock}>
              Unlock
            </button>
            <button className="actionBtn secondaryBtn" onClick={handleForgotPassword}>
              Forgot Password?
            </button>
          </>
        ) : (
          <>
            <h2 className="title">Welcome to Jaxx Wallet</h2>
            {error && <p style={{ color: "red", marginBottom: 12 }}>{error}</p>}
            <p className="subtitle">
              A modern way to manage your crypto.
              <br />
              Choose an option to get started:
            </p>

            <button className="actionBtn" onClick={handleCreate}>
              Create New Wallet
            </button>
            <button className="actionBtn" onClick={handleImport}>
              Import Existing Wallet
            </button>
          </>
        )}
      </div>

      {showForgotConfirm && (
        <div className="modalBackdrop">
          <div className="modalContent">
            <h3>Are you sure you forgot your password?</h3>
            <p style={{ color: "#ccc", marginBottom: 16 }}>
              If you proceed, your wallet data will be removed. You will need to re-import
              using your seed phrase.
            </p>
            <div>
              <button className="modalBtn" onClick={handleConfirmForgot}>
                Yes, I Forgot
              </button>
              <button className="modalBtn" onClick={handleCancelForgot}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: "100vh",
    background: `
      radial-gradient(
        circle at 20% 20%,
        #343a40 0%,
        #1b1e23 30%,
        #17191c 60%,
        #0e0f10 100%
      )
    `,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    overflow: "hidden",
  } as const,
}
