import React, { useState, useContext } from 'react'
import { useRouter } from 'next/router'
import { deriveMultiAssets } from '../../lib/multiCryptoUtils'
import CryptoJS from 'crypto-js'
import * as bip39 from 'bip39'
import { AuthContext } from '../_app'

export default function ImportWalletPage() {
  const router = useRouter()
  const auth = useContext(AuthContext)
  const [mode, setMode] = useState<'seed' | 'file' | null>(null)
  const [seedInput, setSeedInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  function handleBack() {
    router.push('/wallet/select')
  }

  function handleSelectSeed() {
    setMode('seed')
  }
  function handleSelectFile() {
    setMode('file')
  }

  async function handleImportSeed() {
    setError('')
    if (!password || !password2 || password !== password2) {
      setError('Password is mandatory and must match.')
      return
    }
    const seed = seedInput.trim()
    if (!bip39.validateMnemonic(seed)) {
      setError('Invalid seed or no Internet connection. Please ensure it is a valid BIP39 mnemonic (12 or 24 words).')
      return
    }
    try {
      const derived = await deriveMultiAssets(seed)
      if (!derived || derived.length === 0) {
        setError('Could not derive keys from this seed or no Internet connection. Please check your seed phrase or your Internet connection.')
        return
      }
      const cipherText = CryptoJS.AES.encrypt(seed, password).toString()
      localStorage.setItem('encrypted_mnemonic', cipherText)
      localStorage.setItem('wallet_password', password)
      auth.unlockWallet()
      router.push('/wallet/final-import')
    } catch (err: any) {
      setError('Error deriving: ' + err.message)
    }
  }

  async function handleFileImport() {
    setError('')
    if (!password || !password2 || password !== password2) {
      setError('Password is mandatory and must match.')
      return
    }
    if (!selectedFile) {
      setError('No file selected.')
      return
    }
    try {
      const fileText = await selectedFile.text()
      let mnemonicFromFile: string | null = null
      try {
        const jsonParsed = JSON.parse(fileText)
        if (typeof jsonParsed.mnemonic === 'string') {
          mnemonicFromFile = jsonParsed.mnemonic
        } else if (typeof jsonParsed.seed === 'string') {
          mnemonicFromFile = jsonParsed.seed
        } else if (typeof jsonParsed.mnemonicPhrase === 'string') {
          mnemonicFromFile = jsonParsed.mnemonicPhrase
        }
      } catch {}
      if (!mnemonicFromFile) {
        const trimmed = fileText.trim()
        if (bip39.validateMnemonic(trimmed)) {
          mnemonicFromFile = trimmed
        }
      }
      if (!mnemonicFromFile) {
        setError('Could not find a valid mnemonic in file.')
        return
      }
      const derived = await deriveMultiAssets(mnemonicFromFile)
      if (!derived || derived.length === 0) {
        setError('Could not derive keys from this file content.')
        return
      }
      const cipherText = CryptoJS.AES.encrypt(mnemonicFromFile, password).toString()
      localStorage.setItem('encrypted_mnemonic', cipherText)
      localStorage.setItem('wallet_password', password)
      auth.unlockWallet()
      router.push('/wallet/final-import')
    } catch (err: any) {
      setError('File import error: ' + err.message)
    }
  }

  return (
    <div className="createWalletContainer">
      <button className="backButton" onClick={handleBack}>
        Back
      </button>
      <div className="panel panelAdaptive">
        {!mode && (
          <>
            <h2>Import Your Wallet</h2>
            <p>Please choose an import method:</p>
            <div style={{ marginTop: '20px' }}>
              <button className="actionBtn" onClick={handleSelectSeed}>
                Word Seed
              </button>
              <button className="actionBtn" onClick={handleSelectFile}>
                File (JSON/Text)
              </button>
            </div>
          </>
        )}

        {mode === 'seed' && (
          <>
            <h2>Import By Seed</h2>
            {error && <p className="introError" style={{ color: 'red' }}>{error}</p>}
            <label>Enter your bip39 phrase (12 or 24 words):</label>
            <textarea
              rows={4}
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              style={{
                width: '100%',
                marginBottom: '12px',
                marginTop: '8px',
                borderRadius: '6px',
                padding: '10px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                outline: 'none',
                resize: 'none'
              }}
            />
            <label>Password (mandatory):</label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: '12px' }}
            />
            <label>Confirm password:</label>
            <input
              type="password"
              placeholder="Confirm password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              style={{ marginBottom: '20px' }}
            />
            <button className="actionBtn" onClick={handleImportSeed}>
              Import Wallet
            </button>
          </>
        )}

        {mode === 'file' && (
          <>
            <h2>Import By File</h2>
            {error && <p className="introError" style={{ color: 'red' }}>{error}</p>}
            <input
              type="file"
              onChange={(e) => {
                if (e.target.files?.length) {
                  setSelectedFile(e.target.files[0])
                }
              }}
              style={{
                marginBottom: '16px'
              }}
            />
            <label>Password (mandatory):</label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: '12px' }}
            />
            <label>Confirm password:</label>
            <input
              type="password"
              placeholder="Confirm password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              style={{ marginBottom: '20px' }}
            />
            <button className="actionBtn" onClick={handleFileImport}>
              Import Wallet
            </button>
          </>
        )}
      </div>
    </div>
  )
}
