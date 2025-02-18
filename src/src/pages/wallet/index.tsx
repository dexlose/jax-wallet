import React, { useEffect, useState } from "react"
import { useRouter } from "next/router"
import { InfinitySpin } from "react-loader-spinner"
import Image from "next/image"
import logoImg from "../../images/logo.png"

export default function SplashScreen() {
  const router = useRouter()

  const [msgIndex, setMsgIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  const messages = ["Connecting to blockchain…", "Synchronizing data…", "Almost done…"]
  const typingSpeed = 30
  const deletingSpeed = 20
  const pauseBetweenLines = 500

  useEffect(() => {
    if (msgIndex === messages.length) {
      const timer = setTimeout(() => {
        router.push("/wallet/select")
      }, 500)
      return () => clearTimeout(timer)
    }

    const currentLine = messages[msgIndex]
    if (!isDeleting && charIndex === currentLine.length + 1) {
      const pause = setTimeout(() => setIsDeleting(true), pauseBetweenLines)
      return () => clearTimeout(pause)
    }
    if (isDeleting && charIndex === 0) {
      setIsDeleting(false)
      setMsgIndex((prev) => prev + 1)
      return
    }

    const speed = isDeleting ? deletingSpeed : typingSpeed
    const timer = setTimeout(() => {
      setCharIndex((prev) => prev + (isDeleting ? -1 : 1))
    }, speed)

    return () => clearTimeout(timer)
  }, [charIndex, msgIndex, isDeleting, messages, router])

  const typedText = messages[msgIndex]?.slice(0, charIndex) || ""

  return (
    <div
      style={{
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        padding: "0px"
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
          style={{ objectFit: "contain" }}
          priority
        />
      </div>

      <div
        style={{
          position: "relative",
          transform: "translateX(-5px)"
        }}
      >
        <InfinitySpin width="180" color="#ff9800" />
      </div>

      <div className="typedText">{typedText}</div>
    </div>
  )
}
