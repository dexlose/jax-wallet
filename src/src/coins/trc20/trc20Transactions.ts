import TronWeb from "tronweb"

export async function sendTrc20Transaction(
    fromPrivateKey: string,
    contractAddr: string,
    toAddr: string,
    amountTrc20: string
): Promise<string> {
    const tron = new TronWeb({ fullHost: "https://api.trongrid.io" })
    tron.setPrivateKey(fromPrivateKey)
    const amountSun = Math.floor(parseFloat(amountTrc20) * 1e6)
    const contract = await tron.contract().at(contractAddr)
    const tx = await contract
        .transfer(toAddr, amountSun)
        .send({ feeLimit: 30000000, callValue: 0 }, fromPrivateKey)
    if (!tx || typeof tx !== "string") {
        throw new Error("TRC20 transfer failed => " + JSON.stringify(tx))
    }
    return tx
}

export async function getTrxFeeSpent(txid: string): Promise<number> {
    const tron = new TronWeb({ fullHost: "https://api.trongrid.io" })
    const info = await tron.trx.getTransactionInfo(txid)
    const feeSun = info?.fee || 0
    return feeSun / 1e6
}

export async function getTrc20Balance(
    address: string,
    contractAddr: string
): Promise<number> {
    const tron = new TronWeb({ fullHost: "https://api.trongrid.io" })
    const contract = await tron.contract().at(contractAddr)
    const balance = await contract.balanceOf(address).call()
    return Number(balance.toString()) / 1e6
}
