import React, { useState, useEffect, useRef } from "react"
import { DerivedAsset } from "../../lib/multiCryptoUtils"
import { ethers } from "ethers"
import TronWeb from "tronweb"

function getCoinIcon(symbol: string) {
  switch (symbol) {
    case "BTC":
      return "/icons/coins_icons/bitcoin-btc-logo.svg"
    case "ETH":
      return "/icons/coins_icons/ethereum-eth-logo.svg"
    case "LTC":
      return "/icons/coins_icons/litecoin-ltc-logo.svg"
    case "DOGE":
      return "/icons/coins_icons/dogecoin-doge-logo.svg"
    case "DASH":
      return "/icons/coins_icons/dash-dash-logo.svg"
    case "ZEC":
      return "/icons/coins_icons/zcash-zec-logo.svg"
    case "TRX":
      return "/icons/coins_icons/tron-trx-logo.svg"
    case "USDT-ERC20":
    case "USDT-TRC20":
      return "/icons/coins_icons/tether-usdt-logo.svg"
    case "MATIC":
      return "/icons/coins_icons/polygon-matic-logo.svg"
    default:
      return "/icons/coins_icons/generic.svg"
  }
}

const ERC20_ABI = [
  "function transfer(address to, uint256 value) public returns (bool)"
]

async function estimateErc20Gas(
  provider: ethers.JsonRpcProvider,
  contractAddr: string,
  fromAddr: string,
  toAddr: string,
  amountStr: string
): Promise<bigint> {
  const c = new ethers.Contract(contractAddr, ERC20_ABI, provider)
  const amountBN = ethers.parseUnits(amountStr, 6)
  const txData = c.interface.encodeFunctionData("transfer", [toAddr, amountBN])
  const feeData = await provider.getFeeData()
  const gasPriceWei = feeData.gasPrice || 0n
  const gasLimit = await provider.estimateGas({
    from: fromAddr,
    to: contractAddr,
    data: txData
  })
  return gasLimit * gasPriceWei
}

async function estimateTrc20Energy(
  tron: any, // Используем any, чтобы убрать ошибку "TronWeb refers to a value"
  contractAddr: string,
  fromAddr: string,
  toAddr: string,
  amountStr: string
): Promise<number> {
  const amountSun = Math.floor(parseFloat(amountStr) * 1e6)
  const contract = await tron.contract().at(contractAddr)
  const txParams = await contract
    .transfer(toAddr, amountSun)
    .createTransaction({ from: fromAddr })
  const energyNeeded = txParams?.energy_usage_total ?? 30000
  return energyNeeded
}

interface SendStep1ModalProps {
  sendAsset: DerivedAsset
  toAddress: string
  setToAddress: (val: string) => void
  sendAmount: string
  setSendAmount: (val: string) => void
  sendMax: boolean
  setSendMax: (val: boolean) => void
  simulateError: string
  simulateFee: number | null
  simulateVsize: number | null
  onChangeAmount: (val: string) => void
  onClickSendMax: () => void
  onNext: () => void
  onClose: () => void
  assetBalance: number
  assetUsdPrice: number
}

export default function SendStep1Modal({
  sendAsset,
  toAddress,
  setToAddress,
  sendAmount,
  setSendAmount,
  sendMax,
  setSendMax,
  simulateError,
  simulateFee,
  simulateVsize,
  onChangeAmount,
  onClickSendMax,
  onNext,
  onClose,
  assetBalance,
  assetUsdPrice
}: SendStep1ModalProps) {
  const [displayUsd, setDisplayUsd] = useState(0)
  const [animUsd, setAnimUsd] = useState(0)
  const [textWidth, setTextWidth] = useState(0)
  const hiddenSpanRef = useRef<HTMLSpanElement>(null)
  const [localErrorMsg, setLocalErrorMsg] = useState("")
  const [isNotEnoughFunds, setIsNotEnoughFunds] = useState(false)
  const [isNotEnoughGas, setIsNotEnoughGas] = useState(false)
  const [gasErrorMsg, setGasErrorMsg] = useState("")
  const [nativeBalance, setNativeBalance] = useState(0)

  let finalErrorMsg = ""
  if (simulateError) {
    const err = simulateError.toLowerCase()
    if (err.includes("insufficient") || err.includes("not enough")) {
      finalErrorMsg = "Not enough funds"
    } else {
      finalErrorMsg = "Error"
    }
  }

  useEffect(() => {
    async function loadNativeBalance() {
      try {
        if (sendAsset.symbol === "USDT-ERC20") {
          const provider = new ethers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_INFURA_URL || ""
          )
          const balWei = await provider.getBalance(sendAsset.address)
          const balEth = parseFloat(ethers.formatEther(balWei))
          setNativeBalance(balEth)
        } else if (sendAsset.symbol === "USDT-TRC20") {
          const tron = new TronWeb({ fullHost: "https://api.trongrid.io" })
          tron.setAddress(sendAsset.address)
          const balSun = await tron.trx.getBalance(sendAsset.address)
          const balTrx = balSun / 1e6
          setNativeBalance(balTrx)
        } else {
          setNativeBalance(0)
        }
      } catch {
        setNativeBalance(0)
      }
    }
    loadNativeBalance()
  }, [sendAsset])

  useEffect(() => {
    setIsNotEnoughFunds(false)
    setLocalErrorMsg("")
    if (!sendAmount) return
    const numericAmount = parseFloat(sendAmount) || 0
    if (numericAmount > assetBalance) {
      setIsNotEnoughFunds(true)
      setLocalErrorMsg("Not enough funds")
    }
  }, [sendAmount, assetBalance])

  useEffect(() => {
    setIsNotEnoughGas(false)
    setGasErrorMsg("")
    if (sendAsset.symbol !== "USDT-ERC20" && sendAsset.symbol !== "USDT-TRC20") {
      return
    }
    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      return
    }

    async function checkGas() {
      if (sendAsset.symbol === "USDT-ERC20") {
        try {
          const provider = new ethers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_INFURA_URL || ""
          )
          const totalGasWei = await estimateErc20Gas(
            provider,
            "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            sendAsset.address,
            toAddress,
            sendAmount
          )
          const totalGasEth = parseFloat(ethers.formatEther(totalGasWei))
          if (nativeBalance < totalGasEth) {
            setIsNotEnoughGas(true)
            setGasErrorMsg(
              `Not enough ETH for gas. Needed ~${totalGasEth.toFixed(6)} ETH, you have ${nativeBalance.toFixed(6)}`
            )
          }
        } catch (err: any) {
          console.warn("estimateErc20Gas error =>", err)
          setIsNotEnoughGas(true)
          setGasErrorMsg("Can't estimate gas. Possibly not enough ETH.")
        }
      } else if (sendAsset.symbol === "USDT-TRC20") {
        try {
          const tron = new TronWeb({ fullHost: "https://api.trongrid.io" })
          tron.setAddress(sendAsset.address)
          const neededEnergy = await estimateTrc20Energy(
            tron,
            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            sendAsset.address,
            toAddress,
            sendAmount
          )
          const TRXperEnergy = 0.00002
          const neededTrx = neededEnergy * TRXperEnergy
          if (nativeBalance < neededTrx) {
            setIsNotEnoughGas(true)
            setGasErrorMsg(
              `Not enough TRX for energy. Need ~${neededTrx.toFixed(3)} TRX, you have ${nativeBalance.toFixed(3)}`
            )
          }
        } catch (err) {
          console.warn("estimateTrc20Energy error =>", err)
          setIsNotEnoughGas(true)
          setGasErrorMsg("Can't estimate TRC20 energy. Possibly not enough TRX.")
        }
      }
    }

    checkGas()
  }, [sendAmount, sendAsset, nativeBalance, toAddress])

  useEffect(() => {
    const val = parseFloat(sendAmount) || 0
    const newUsd = val * assetUsdPrice
    setDisplayUsd(newUsd)
  }, [sendAmount, assetUsdPrice])

  useEffect(() => {
    let frame = 0
    const animateUsd = () => {
      const diff = displayUsd - animUsd
      if (Math.abs(diff) < 0.000001) {
        setAnimUsd(displayUsd)
      } else {
        setAnimUsd(animUsd + diff * 0.25)
        frame = requestAnimationFrame(animateUsd)
      }
    }
    frame = requestAnimationFrame(animateUsd)
    return () => cancelAnimationFrame(frame)
  }, [displayUsd, animUsd])

  useEffect(() => {
    if (hiddenSpanRef.current) {
      setTextWidth(hiddenSpanRef.current.offsetWidth)
    }
  }, [sendAmount])

  const errorToDisplay = finalErrorMsg || localErrorMsg
  const showNextDisabled =
    !toAddress || !sendAmount || isNotEnoughFunds || isNotEnoughGas

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
        <div className="modalHeader">
          <h2 className="modalTitle">
            Send {sendAsset.symbol}{" "}
            <img
              src={getCoinIcon(sendAsset.symbol)}
              alt={sendAsset.symbol}
              style={{ width: 18, height: 18, marginLeft: "6px" }}
            />
          </h2>
          <div className="modalSubTitle">
            Transfer your {sendAsset.symbol} to another wallet
          </div>
        </div>
        <div className="modalBody">
          <div className="balanceInfo">
            <div>
              <strong style={{ fontWeight: 600, marginRight: "4px" }}>
                {assetBalance.toFixed(6)} {sendAsset.symbol}
              </strong>
              <span
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "0.9rem"
                }}
              >
                (≈ ${(assetBalance * assetUsdPrice).toFixed(2)})
              </span>
            </div>
          </div>

          <label className="inputLabel" style={{ marginBottom: "6px" }}>
            Recipient Address:
          </label>
          <input
            className="modalInput"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="Enter address to send to"
            style={{ marginBottom: "16px" }}
          />

          <label className="inputLabel" style={{ marginBottom: "6px" }}>
            Amount:
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px"
            }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <input
                className="modalInput"
                style={{ paddingRight: "110px" }}
                value={sendAmount}
                onChange={(e) => {
                  setSendAmount(e.target.value)
                  onChangeAmount(e.target.value)
                }}
                disabled={sendMax}
                placeholder="0.000000"
              />
              <span
                ref={hiddenSpanRef}
                style={{
                  position: "absolute",
                  top: "-9999px",
                  left: "-9999px",
                  visibility: "hidden",
                  whiteSpace: "pre"
                }}
              >
                {sendAmount}
              </span>
              <div
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: `translateY(-50%) translateX(${
                    Math.min(0, -(textWidth - 40))
                  }px)`,
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "0.9rem",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  transition: "transform 0.3s"
                }}
              >
                ≈ ${animUsd.toFixed(2)}
              </div>
            </div>
            <button
              className="grayButton"
              style={{
                minWidth: "60px",
                backgroundColor: "#666",
                fontWeight: 500
              }}
              onClick={() => {
                setSendMax(true)
                onClickSendMax()
              }}
            >
              Max
            </button>
          </div>

          {errorToDisplay && (
            <p className="errorText" style={{ marginTop: "8px", color: "#f66" }}>
              {errorToDisplay}
            </p>
          )}
          {isNotEnoughGas && (
            <p className="errorText" style={{ marginTop: "8px", color: "#f66" }}>
              {gasErrorMsg}
            </p>
          )}

          {simulateFee !== null && sendAsset.symbol === "BTC" && (
            <p className="feeInfo" style={{ marginTop: "4px" }}>
              Estimated BTC Fee: {simulateFee} sat (
              ≈{(simulateFee / 1e8).toFixed(8)} BTC)
            </p>
          )}
          {simulateVsize !== null && (
            <p className="feeInfo" style={{ marginTop: "2px" }}>
              vsize ≈ {simulateVsize} bytes
            </p>
          )}
        </div>
        <div className="modalFooter" style={{ marginTop: "4px" }}>
          <button className="grayButton" onClick={onClose}>
            Cancel
          </button>
          <button
            className="orangeButton"
            disabled={showNextDisabled}
            style={{
              opacity: showNextDisabled ? 0.4 : 1
            }}
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
