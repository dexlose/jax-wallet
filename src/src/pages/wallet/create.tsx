import React, { useState, useEffect, useContext } from 'react'
import { useRouter } from 'next/router'
import { generateSeed } from '../../lib/cryptoUtils'
import { deriveMultiAssets } from '../../lib/multiCryptoUtils'
import CryptoJS from 'crypto-js'
import { AuthContext } from '../_app'

type Step = 'intro' | 'anim' | 'seedReady' | 'confirm' | 'password' | 'final'

function shuffle(array: string[]): string[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function getRandomIndices(count: number, max: number): number[] {
  const indices: number[] = []
  while (indices.length < count) {
    const rnd = Math.floor(Math.random() * max)
    if (!indices.includes(rnd)) {
      indices.push(rnd)
    }
  }
  return indices.sort((a, b) => a - b)
}

export default function CreateWalletPage() {
  const router = useRouter()
  const auth = useContext(AuthContext)

  const [step, setStep] = useState<Step>('intro')
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [check3, setCheck3] = useState(false)
  const [introError, setIntroError] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [fakeWords, setFakeWords] = useState<string[]>(Array(12).fill(''))
  const [typedText, setTypedText] = useState('')
  const phraseLoading = 'Please wait while we generate your seed phrase...'
  const phraseReady = 'Below is your seed phrase (keep it secret!)'
  const [copySuccess, setCopySuccess] = useState('')

  const [maskedWords, setMaskedWords] = useState<string[]>([])
  const [confirmIndices, setConfirmIndices] = useState<number[]>([])
  const [confirmSlots, setConfirmSlots] = useState<string[]>([])
  const [selectFrom, setSelectFrom] = useState<string[]>([])
  const [confirmError, setConfirmError] = useState('')

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)

  function handleBack() {
    router.push('/wallet/select')
  }

  function handleCreateWallet() {
    setIntroError('')
    if (!check1 || !check2 || !check3) {
      setIntroError('All checkboxes must be checked to continue.')
      return
    }
    setStep('anim')
  }

  useEffect(() => {
    if (step === 'anim') {
      typeText(phraseLoading, 2, () => {
        const sample = [
          'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta',
          'theta', 'kappa', 'lambda', 'sigma', 'omega', 'orbit',
          'crypto', 'matrix', 'buzz', 'foo', 'bar', 'qux',
          'crunch', 'python', 'rust', 'metal', 'random', 'pixel'
        ]
        const interval = setInterval(() => {
          const shuffled = shuffle(sample)
          setFakeWords(shuffled.slice(0, 12))
        }, 70)
        setTimeout(() => {
          clearInterval(interval)
          generateSeed().then((seed) => {
            setMnemonic(seed)
            setTypedText(phraseReady)
            setStep('seedReady')
          })
        }, 1500)
      })
    }
  }, [step])

  function typeText(text: string, speed: number, onFinish: () => void) {
    let index = 0
    setTypedText('')
    const timer = setInterval(() => {
      index++
      setTypedText(text.slice(0, index))
      if (index >= text.length) {
        clearInterval(timer)
        setTimeout(() => onFinish(), 200)
      }
    }, speed)
  }

  function handleCopySeed() {
    navigator.clipboard
      .writeText(mnemonic)
      .then(() => {
        setCopySuccess('Seed phrase copied successfully!')
        setTimeout(() => setCopySuccess(''), 3000)
      })
      .catch(() => {
        alert('Clipboard error')
      })
  }

  function handleGoConfirmSeed() {
    setStep('confirm')
    const arr = mnemonic.trim().split(/\s+/)
    const missingCount = 4
    const idx = getRandomIndices(missingCount, arr.length)
    setConfirmIndices(idx)
    const masked = arr.map((w, i) => (idx.includes(i) ? '' : w))
    setMaskedWords(masked)

    const chosenWords = idx.map((i) => arr[i])
    const shuffledChosen = shuffle(chosenWords)
    setSelectFrom(shuffledChosen)
    setConfirmSlots(Array(missingCount).fill(''))
    setConfirmError('')
  }

  function handleSelectWord(slotIndex: number, word: string, fromIdx: number) {
    const newSlots = [...confirmSlots]
    newSlots[slotIndex] = word
    setConfirmSlots(newSlots)

    const newSelect = [...selectFrom]
    newSelect[fromIdx] = ''
    setSelectFrom(newSelect)
  }

  function handleRestoreWord(slotIndex: number) {
    const w = confirmSlots[slotIndex]
    if (!w) return
    const firstEmpty = selectFrom.indexOf('')
    if (firstEmpty >= 0) {
      const newSelect = [...selectFrom]
      newSelect[firstEmpty] = w
      setSelectFrom(newSelect)
      const newSlots = [...confirmSlots]
      newSlots[slotIndex] = ''
      setConfirmSlots(newSlots)
    }
  }

  function handleNextFromConfirm() {
    const arr = mnemonic.trim().split(/\s+/)
    const chosen = confirmIndices.map((i) => arr[i].toLowerCase())
    const userInput = confirmSlots.map((x) => x.toLowerCase())
    if (JSON.stringify(chosen) !== JSON.stringify(userInput)) {
      setConfirmError('Some of the missing words are incorrect. Please try again.')
      const shuffledChosen = shuffle(chosen.map((x) => x))
      setSelectFrom(shuffledChosen)
      setConfirmSlots(Array(chosen.length).fill(''))
      return
    }
    setConfirmError('')
    setStep('password')
  }

  useEffect(() => {
    let score = 0
    if (password.length >= 6) score += 30
    if (password.length >= 10) score += 30
    if (/[A-Z]/.test(password)) score += 20
    if (/[0-9]/.test(password)) score += 20
    if (score > 100) score = 100
    setPasswordStrength(score)
  }, [password])

  function handleGoFinal() {
    if (!password || !password2 || password !== password2) {
      alert('Password is mandatory and must match.')
      return
    }
    const cipher = CryptoJS.AES.encrypt(mnemonic, password).toString()
    localStorage.setItem('encrypted_mnemonic', cipher)
    localStorage.setItem('wallet_password', password)
    setStep('final')
  }

  function handleGoToWallet() {
    deriveMultiAssets(mnemonic)
      .then(() => {
        auth.unlockWallet()
        router.push('/wallet/dashboard')
      })
      .catch((err) => {
        alert('Error deriving assets: ' + err)
      })
  }

  return (
    <div className="createWalletContainer">
      <button className="backButton" onClick={handleBack}>
        Back
      </button>
      <div className="panel panelAdaptive panelWithFlex">
        {step === 'intro' && (
          <div className="introSection">
            <h2>Create Your Secure Wallet</h2>
            <p>Please read and confirm the following terms before generating your wallet:</p>
            <div className="checkbox-group">
              <div className="checkboxItem" style={{ display: 'flex', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  id="check1"
                  checked={check1}
                  onChange={() => setCheck1(!check1)}
                  style={{ marginTop: 3 }}
                />
                <p style={{ marginLeft: 8 }}>
                  I understand that losing this phrase = losing my funds. If I lose my seed phrase, I lose all access to my wallet. There is no other way to recover it.
                </p>
              </div>
              <div className="checkboxItem" style={{ display: 'flex', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  id="check2"
                  checked={check2}
                  onChange={() => setCheck2(!check2)}
                  style={{ marginTop: 3 }}
                />
                <p style={{ marginLeft: 8 }}>
                  I will not share these words with anyone. Sharing your seed phrase can compromise your wallet. Keep it strictly confidential to avoid theft or hacking.
                </p>
              </div>
              <div className="checkboxItem" style={{ display: 'flex', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  id="check3"
                  checked={check3}
                  onChange={() => setCheck3(!check3)}
                  style={{ marginTop: 3 }}
                />
                <p style={{ marginLeft: 8 }}>
                  I assume all risks for storing my seed phrase securely. I accept full responsibility for any physical or digital security measures to protect these words.
                </p>
              </div>
            </div>
            <div className="introActions pushToBottom">
              {introError && <span className="introError">{introError}</span>}
              <button className="actionBtn" onClick={handleCreateWallet}>
                Create Wallet
              </button>
            </div>
          </div>
        )}

        {step === 'anim' && (
          <>
            <div className="typedText">{typedText}</div>
            <div className="seedGrid">
              {fakeWords.map((w, i) => (
                <div key={i} className="seedCell">
                  {w}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'seedReady' && (
          <div className="seedReadyWrapper open">
            <div className="typedText">{typedText}</div>
            <div className="seedGrid">
              {mnemonic
                .trim()
                .split(/\s+/)
                .map((word, idx) => (
                  <div key={idx} className="seedCell">
                    <span className="seedIndex">{idx + 1}.</span> {word}
                  </div>
                ))}
            </div>
            <button className="copyButtonSmaller" onClick={handleCopySeed}>
              Copy
            </button>
            {copySuccess && <div className="copySuccessMsg">{copySuccess}</div>}
            <div className="storageNote">
              <p>
                <strong>Don’t take screenshots. Write down your seed on paper and store it safely.</strong>{' '}
                If you lose your seed, you lose access to your funds.
              </p>
            </div>
            <button className="actionBtn" onClick={handleGoConfirmSeed}>
              Next Step
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="confirmSection">
            <h2>Confirm Your Seed</h2>
            <p>This seed has 4 missing words. Fill them correctly:</p>
            <div className="seedGridConfirm">
              {maskedWords.map((w, idx) => {
                if (!w) {
                  const slotPos = confirmIndices.indexOf(idx)
                  const wordInSlot = confirmSlots[slotPos] || ''
                  return (
                    <div
                      key={idx}
                      className="seedCell missing"
                      onClick={() => {
                        if (!wordInSlot) return
                        handleRestoreWord(slotPos)
                      }}
                    >
                      {wordInSlot || '____'}
                    </div>
                  )
                } else {
                  return (
                    <div key={idx} className="seedCell">
                      <span className="seedIndex">{idx + 1}.</span> {w}
                    </div>
                  )
                }
              })}
            </div>
            <div style={{ marginTop: '20px', fontWeight: 600 }}>
              Your 4 slots:
            </div>
            <div className="confirmSlotsRow">
              {confirmSlots.map((cw, slotIndex) => (
                <div
                  key={slotIndex}
                  className="slotItem"
                  onClick={() => {
                    if (!cw) return
                    handleRestoreWord(slotIndex)
                  }}
                >
                  [{slotIndex + 1}] {cw}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '20px', fontWeight: 600 }}>
              Select from:
            </div>
            <div className="selectFromRow">
              {selectFrom.map((sw, i) => (
                <div
                  key={i}
                  className="selectItem"
                  onClick={() => {
                    if (!sw) return
                    const slotIdx = confirmSlots.findIndex((x) => x === '')
                    if (slotIdx >= 0) {
                      handleSelectWord(slotIdx, sw, i)
                    }
                  }}
                >
                  {sw}
                </div>
              ))}
            </div>
            {confirmError && (
              <p className="confirmError" style={{ marginTop: '20px', color: '#f66' }}>
                {confirmError}
              </p>
            )}
            <div className="confirmActions pushToBottom">
              <button className="actionBtn" onClick={handleNextFromConfirm}>
                Confirm Seed
              </button>
            </div>
          </div>
        )}

        {step === 'password' && (
          <>
            <h2>Secure Your Wallet</h2>
            <p>A password is mandatory. You will need this password to unlock and use your wallet.</p>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="password-strength-bar" style={{ width: `${passwordStrength}%` }} />
            <label>Confirm Password:</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
            <button
              className="actionBtn"
              onClick={handleGoFinal}
              disabled={!password || password !== password2}
            >
              Finish Setup
            </button>
          </>
        )}

        {step === 'final' && (
          <>
            <h2>Congratulations!</h2>
            <p>Your Wallet Has Been Created Successfully.</p>
            <button className="actionBtn pushToBottom" onClick={handleGoToWallet}>
              Go to Wallet
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        .seedReadyWrapper {
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition: max-height 1.2s ease-out, opacity 1.2s ease-out;
        }
        .seedReadyWrapper.open {
          max-height: 2000px;
          opacity: 1;
        }
        .seedGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 20px;
        }
        .seedCell {
          border: 1px solid rgba(255,255,255,0.2);
          padding: 10px;
          border-radius: 6px;
          font-size: 1rem;
          text-align: center;
          background: rgba(255,255,255,0.05);
        }
        .seedIndex {
          margin-right: 4px;
          color: #aaa;
        }
        .confirmSection {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .seedGridConfirm {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 12px;
        }
        .seedCell.missing {
          background: rgba(255,0,0,0.1);
          cursor: pointer;
        }
        .confirmSlotsRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .slotItem {
          min-width: 80px;
          padding: 6px 10px;
          border-radius: 4px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.3);
          cursor: pointer;
        }
        .selectFromRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .selectItem {
          min-width: 80px;
          padding: 6px 10px;
          border-radius: 4px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.3);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
