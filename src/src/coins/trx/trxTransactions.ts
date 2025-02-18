import TronWeb from "tronweb"

export async function sendTrxTransaction(
    privHex: string,
    toAddr: string,
    amountTrx: string
): Promise<string> {
    const tron = new TronWeb({ fullHost: "https://api.trongrid.io" })
    tron.setPrivateKey(privHex)
    const sun = Math.floor(parseFloat(amountTrx) * 1e6)
    const fromAddr = tron.address.fromPrivateKey(privHex)
    const unsigned = await tron.transactionBuilder.sendTrx(toAddr, sun, fromAddr)
    const signed = await tron.trx.sign(unsigned, privHex)
    const receipt = await tron.trx.sendRawTransaction(signed)
    if (!receipt.result) throw new Error("TRX => fail => " + JSON.stringify(receipt))
    return receipt.txid
}
