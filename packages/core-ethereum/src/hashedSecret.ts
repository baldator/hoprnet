import { Hash } from './types'
import Debug from 'debug'
import { randomBytes } from 'crypto'
import { u8aConcat, iterateHash, recoverIteratedHash } from '@hoprnet/hopr-utils'
import { waitForConfirmation } from './utils'
import { OnChainSecret, OnChainSecretIntermediary } from './dbKeys'
import type { LevelUp } from 'levelup'
import type { HoprChannels } from './tsc/web3/HoprChannels'
import type Account from './account'

export const DB_ITERATION_BLOCK_SIZE = 10000
export const TOTAL_ITERATIONS = 100000

const log = Debug('hopr-core-ethereum:hashedSecret')

export async function hashFunction(msg: Uint8Array): Promise<Uint8Array> {
  return Hash.create(msg).serialize().slice(0, Hash.SIZE)
}

async function getFromDB<T>(db: LevelUp, key): Promise<T | undefined> {
  try {
    return await db.get(Buffer.from(key))
  } catch (err) {
    if (!err.notFound) {
      throw err
    }
    return
  }
}

class HashedSecret {
  private initialized: boolean = false
  private onChainSecret: Hash
  private offChainSecret: Hash

  constructor(private db: LevelUp, private account: Account, private channels: HoprChannels) {}

  /**
   * @returns a deterministic secret that is used in debug mode
   */
  private async getDebugAccountSecret(): Promise<Hash> {
    const account = await this.channels.methods.accounts(this.account.address.toHex()).call()
    return new Hash(
      await hashFunction(
        u8aConcat(new Uint8Array([parseInt(account.counter)]), this.account.keys.onChain.pubKey.serialize())
      )
    )
  }

  /**
   * Creates a random secret OR a deterministic one if running in debug mode,
   * it will then loop X amount of times, on each loop we hash the previous result.
   * We store the last result.
   * @returns a promise that resolves to the onChainSecret
   */
  private async createAndStoreSecretOffChainAndReturnOnChainSecret(debug: boolean): Promise<Hash> {
    let onChainSecret = debug ? await this.getDebugAccountSecret() : new Hash(randomBytes(Hash.SIZE))

    let dbBatch = this.db.batch()
    const result = await iterateHash(onChainSecret.serialize(), hashFunction, TOTAL_ITERATIONS, DB_ITERATION_BLOCK_SIZE)

    for (const intermediate of result.intermediates) {
      dbBatch = dbBatch.put(
        Buffer.from(OnChainSecretIntermediary(intermediate.iteration)),
        Buffer.from(intermediate.preImage)
      )
    }
    await dbBatch.write()
    return new Hash(result.hash)
  }

  private async storeSecretOnChain(secret: Hash): Promise<void> {
    log(`storing secret on chain, setting secret to ${secret.toHex()}`)
    const address = this.account.address.toHex()
    const account = await this.channels.methods.accounts(address).call()
    // has no secret stored onchain
    if (Number(account.counter) === 0) {
      log('account is also null, calling channel.init')
      try {
        await waitForConfirmation(
          (
            await this.account.signTransaction(
              {
                from: address,
                to: this.channels.options.address
              },
              this.channels.methods.initializeAccount(
                this.account.keys.onChain.pubKey.toUncompressedPubKeyHex(),
                secret.toHex()
              )
            )
          ).send()
        )
        this.account.updateLocalState(secret)
      } catch (e) {
        if (e.message.match(/Account must not be set/)) {
          // There is a potential race condition due to the fact that 2 init
          // calls may be in flight at once, and therefore we may have init
          // called on an initialized account. If so, trying again should solve
          // the problem.
          log('race condition encountered in HoprChannel.init - retrying')
          return this.storeSecretOnChain(secret)
        }
        throw e
      }
    } else {
      // @TODO this is potentially dangerous because it increases the account counter
      log('account is already on chain, storing secret.')
      try {
        await waitForConfirmation(
          (
            await this.account.signTransaction(
              {
                from: address,
                to: this.channels.options.address
              },
              this.channels.methods.updateAccountSecret(secret.toHex())
            )
          ).send()
        )
        this.account.updateLocalState(secret)
      } catch (e) {
        if (e.message.match(/new and old hashedSecrets are the same/)) {
          // NBD. no-op
          return
        }
        throw e
      }
    }

    log('stored on chain')
  }

  private async calcOnChainSecretFromDb(debug?: boolean): Promise<Hash | never> {
    let result = await iterateHash(
      debug == true ? (await this.getDebugAccountSecret()).serialize() : undefined,
      hashFunction,
      TOTAL_ITERATIONS,
      DB_ITERATION_BLOCK_SIZE,
      (index) => getFromDB(this.db, OnChainSecretIntermediary(index))
    )

    if (result == undefined) {
      return await this.createAndStoreSecretOffChainAndReturnOnChainSecret(debug)
    }

    return new Hash(result.hash)
  }

  /**
   * Tries to find a pre-image for the given hash by using the intermediate
   * values from the database.
   * @param hash the hash to find a preImage for
   */
  public async findPreImage(hash: Hash): Promise<Hash> {
    let result = await recoverIteratedHash(
      hash.serialize(),
      hashFunction,
      (index) => getFromDB(this.db, OnChainSecretIntermediary(index)),
      TOTAL_ITERATIONS,
      DB_ITERATION_BLOCK_SIZE
    )
    if (result == undefined) {
      throw Error(`Could not find preImage.`)
    }
    return new Hash(result.preImage)
  }

  public async initialize(debug?: boolean): Promise<void> {
    if (this.initialized) return
    this.offChainSecret = await getFromDB(this.db, OnChainSecret())
    this.onChainSecret = await this.account.getOnChainSecret()
    if (this.onChainSecret != undefined && this.offChainSecret != undefined) {
      try {
        await this.findPreImage(this.onChainSecret) // throws if not found
        this.initialized = true
        return
      } catch (_e) {
        log(`Secret is found but failed to find preimage, reinitializing..`)
      }
    }
    if (this.offChainSecret && !this.onChainSecret) {
      log('secret exists offchain but not on chain')
      const onChainSecret = await this.calcOnChainSecretFromDb(debug)
      await this.storeSecretOnChain(onChainSecret)
    } else {
      log('reinitializing')
      const onChainSecret = await this.createAndStoreSecretOffChainAndReturnOnChainSecret(debug)
      await this.storeSecretOnChain(onChainSecret)
    }
    this.initialized = true
  }
}

export default HashedSecret
