import React from 'react'
import { InfinitySpin } from 'react-loader-spinner'
import Image from 'next/image'
import logoImg from '../images/logo.png'

export default function LoadingPage() {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        margin: '0 auto',
        position: 'relative',
        background:
          'radial-gradient(circle at 20% 20%, #343a40 0%, #1b1e23 30%, #17191c 60%, #0e0f10 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0px'
      }}
    >
      <style jsx>{`
        .splash-logo {
          margin-bottom: -40px;
        }
        .typedText {
          margin-top: 0px;
          color: #aaaaaa;
          font-size: 0.95rem;
          min-height: 1.2em;
          text-align: center;
        }
      `}</style>

      <div className="splash-logo">
        <Image
          src={logoImg}
          alt="Jaxx Logo"
          width={180}
          height={180}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      <div style={{ position: 'relative', transform: 'translateX(-5px)' }}>
        <InfinitySpin width="180" color="#ff9800" />
      </div>

      <div className="typedText">Loading...</div>
    </div>
  )
}

