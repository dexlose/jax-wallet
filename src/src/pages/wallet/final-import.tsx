import React from 'react'
import { useRouter } from 'next/router'

export default function FinalImportPage() {
  const router = useRouter()
  const isError = router.query.error === '1' || router.query.error === 'true'

  function goToWallet() {
    router.push('/wallet/dashboard')
  }

  function backToImport() {
    router.push('/wallet/import')
  }

  return (
    <div className="createWalletContainer">
      <div
        className="panel panelAdaptive panelWithFlex final-screen"
        style={{
          height: '460px',
          overflow: 'hidden',
        }}
      >
        <div>
          {isError ? (
            <>
              <h2>Wallet Import Failed</h2>
              <p>There was an error importing your wallet. Please try again.</p>
              <button className="actionBtn pushToBottom" onClick={backToImport}>
                Back to Import
              </button>
            </>
          ) : (
            <>
              <h2>Wallet Imported Successfully!</h2>
              <p>You can now access your funds.</p>
              <img
                src="https://img.icons8.com/clouds/200/000000/checkmark.png"
                alt="Success"
                style={{ display: 'block', margin: '40px auto' }}
              />
              <button className="actionBtn pushToBottom" onClick={goToWallet}>
                Go to Wallet
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
