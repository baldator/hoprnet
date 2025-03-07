import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import type { DeployFunction } from 'hardhat-deploy/types'

// runs once deployment has finished
const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // verify smart contract to etherscan
  if (hre.network.tags.etherscan && hre.network.live) {
    await hre.run('etherscan-verify')
  }
}

main.runAtTheEnd = true

export default main
