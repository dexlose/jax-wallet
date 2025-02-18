import React from "react"
import {
  FaShieldAlt,
  FaNode,
  FaExchangeAlt,
  FaSyncAlt,
  FaExpand,
  FaGithub
} from "react-icons/fa"

interface InfoProps {
  onClose: () => void
  content?: string
}

export default function InfoModal({ onClose, content }: InfoProps) {
  return (
    <>
      <style>{`
        .customScrollBar::-webkit-scrollbar {
          width: 12px;
        }
        .customScrollBar::-webkit-scrollbar-track {
          background: #444;
        }
        .customScrollBar::-webkit-scrollbar-thumb {
          background-color: rgb(241,118,40);
          border-radius: 6px;
          border: 2px solid #444;
        }
        .customScrollBar {
          scrollbar-width: thin;
          scrollbar-color: rgb(241,118,40) #444;
        }
      `}</style>

      <div
        className="modalOverlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}
      >
        <div
          className="modalContent glassModal fancyModal"
          style={{
            width: '90%',
            maxWidth: '1700px',
            maxHeight: '85vh',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #2c2c2c 0%, #474747 100%)',
            color: '#fff',
            borderRadius: '12px',
            position: 'relative',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(44,44,44, 0.95)',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              padding: '20px'
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.8rem',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              &times;
            </button>
          </div>

          <div
            className="customScrollBar"
            style={{
              padding: '30px',
              overflowY: 'auto',
              maxHeight: 'calc(85vh - 72px)',
            }}
          >
            {content ? (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <div style={{ fontSize: '18px', lineHeight: '1.7', letterSpacing: '0.5px' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                  <h2 style={{ margin: 0, fontSize: '2.2rem', letterSpacing: '1px' }}>
                    Infrastructure Overview
                  </h2>
                </div>

                <h4 style={{ marginBottom: '10px', color: 'rgb(241,118,40)', textTransform: 'uppercase' }}>
                  Cutting-Edge Infrastructure
                </h4>
                <div
                  style={{
                    borderLeft: '4px solid rgb(241,118,40)',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    padding: '15px',
                    marginBottom: '20px',
                    borderRadius: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <p style={{ margin: 0 }}>
                    Jaxx Wallet’s infrastructure is meticulously engineered to deliver a truly 
                    decentralized experience. By linking directly to full nodes, any dependency 
                    on external services is removed, so each transaction is validated by the 
                    network itself—rather than a centralized intermediary. This results in 
                    greater trustlessness, bolstered security, and absolute sovereignty over 
                    your digital assets.
                  </p>
                </div>

                <h4 style={{ marginBottom: '10px', color: 'rgb(241,118,40)', textTransform: 'uppercase' }}>
                  Resilient Architecture
                </h4>
                <div
                  style={{
                    borderLeft: '4px solid rgb(241,118,40)',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    padding: '15px',
                    marginBottom: '20px',
                    borderRadius: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <p style={{ margin: 0 }}>
                    Our architecture prioritizes reliability. We select multiple nodes based on 
                    both performance and trust metrics. If one node goes offline, the system 
                    seamlessly transitions to another, virtually eliminating downtime. This 
                    robust node network underpins Jaxx Wallet, ensuring overall integrity 
                    and consistency.
                  </p>
                </div>

                <h4 style={{ marginBottom: '10px', color: 'rgb(241,118,40)', textTransform: 'uppercase' }}>
                  Comprehensive Analytics
                </h4>
                <div
                  style={{
                    borderLeft: '4px solid rgb(241,118,40)',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    padding: '15px',
                    marginBottom: '20px',
                    borderRadius: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <p style={{ margin: 0 }}>
                    Beyond basic connectivity, Jaxx provides extensive insights. Visualize 
                    mempool congestion, monitor block propagation times, and assess consensus 
                    metrics. This data-driven transparency empowers you to make informed 
                    decisions—whether trading, staking, or voting in governance proposals.
                  </p>
                </div>

                <h4 style={{ marginBottom: '10px', color: 'rgb(241,118,40)', textTransform: 'uppercase' }}>
                  Security & Open-Source Model
                </h4>
                <div
                  style={{
                    borderLeft: '4px solid rgb(241,118,40)',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <p style={{ margin: 0 }}>
                    Security is a core tenet of Jaxx Wallet. Your private keys are stored 
                    locally on your device and safeguarded with advanced encryption. 
                    Optional Tor integration enhances privacy even further. As an 
                    open-source project, Jaxx welcomes community audits and 
                    contributions—ensuring your keys and your blockchain experience 
                    remain under your direct control.
                  </p>
                </div>

                <h4
                  style={{
                    marginBottom: '15px',
                    color: 'rgb(241,118,40)',
                    textAlign: 'center',
                    textTransform: 'uppercase'
                  }}
                >
                  Key Features
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    marginBottom: '30px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <FaNode style={{ fontSize: '36px', color: '#fff' }} />
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>
                        Full Node Integration
                      </h5>
                      <p style={{ margin: 0 }}>
                        Bypass intermediaries by connecting straight to full nodes. 
                        Validate transactions independently and rely on the network’s 
                        own consensus for true autonomy.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <FaShieldAlt style={{ fontSize: '36px', color: '#fff' }} />
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>
                        High-Level Security
                      </h5>
                      <p style={{ margin: 0 }}>
                        Cutting-edge encryption, hardware wallet support, and multi-signature 
                        functionality. Retain full control and ensure your private keys 
                        remain secure at all times.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <FaExchangeAlt style={{ fontSize: '36px', color: '#fff' }} />
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>
                        Real-Time Analytics
                      </h5>
                      <p style={{ margin: 0 }}>
                        Observe node performance, network latency, mempool usage, and governance 
                        proposals from a singular, intuitive interface.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <FaSyncAlt style={{ fontSize: '36px', color: '#fff' }} />
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>
                        Redundancy & Reliability
                      </h5>
                      <p style={{ margin: 0 }}>
                        Automatic failover preserves access if a node goes offline. Jaxx 
                        routinely picks the best-performing nodes to deliver near-zero 
                        downtime.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <FaExpand style={{ fontSize: '36px', color: '#fff' }} />
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>
                        Scalable Architecture
                      </h5>
                      <p style={{ margin: 0 }}>
                        As blockchains evolve, Jaxx expands seamlessly. Integrate new networks, 
                        layer-2 solutions, or sidechains without sacrificing performance.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <FaGithub style={{ fontSize: '36px', color: '#fff' }} />
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>
                        Open-Source & Auditable
                      </h5>
                      <p style={{ margin: 0 }}>
                        Our code is available on&nbsp;
                        <a
                          href="https://github.com/YourRepo"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'rgb(241,118,40)', textDecoration: 'underline' }}
                        >
                          GitHub
                        </a>. Community-led reviews, bug bounties, and active collaboration 
                        guarantee transparency and trust.
                      </p>
                    </div>
                  </div>
                </div>

                <h4
                  style={{
                    marginBottom: '10px',
                    color: 'rgb(241,118,40)',
                    textTransform: 'uppercase'
                  }}
                >
                  Embrace True Decentralization
                </h4>
                <div
                  style={{
                    borderLeft: '4px solid rgb(241,118,40)',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <p style={{ margin: 0 }}>
                    By connecting you directly to the blockchain’s core, Jaxx ensures your transactions 
                    and data remain uncompromised. This infrastructure isn’t just about seamless 
                    connectivity—it’s about empowerment. With Jaxx Wallet, you gain the autonomy 
                    and clarity needed to navigate the ever-changing crypto landscape with 
                    confidence. Embrace the future of decentralized finance with a foundation 
                    designed for reliability, security, and unmatched transparency.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
