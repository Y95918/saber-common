import type {
  AugmentedProvider,
  Provider,
  PublicKey,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { SolanaAugmentedProvider } from "@saberhq/solana-contrib";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";

import type { TokenAmount } from ".";
import { getATAAddresses, SPLToken } from ".";
import { getATAAddress } from "./ata";
import { createMintInstructions, DEFAULT_TOKEN_DECIMALS } from "./common";
import { getOrCreateATA, getOrCreateATAs } from "./instructions/ata";
import { Token } from "./token";

/**
 * Augmented provider with token utilities.
 */
export class TokenAugmentedProvider
  extends SolanaAugmentedProvider
  implements AugmentedProvider
{
  constructor(provider: Provider) {
    super(provider);
  }

  /**
   * Creates a transaction to create a {@link Token}.
   */
  async createTokenTX({
    mintKP = Keypair.generate(),
    authority = this.walletKey,
    decimals = DEFAULT_TOKEN_DECIMALS,
  }: {
    mintKP?: Keypair;
    authority?: PublicKey;
    decimals?: number;
  } = {}): Promise<{ token: Token; tx: TransactionEnvelope }> {
    const instructions = await createMintInstructions(
      this.provider,
      authority,
      mintKP.publicKey,
      decimals
    );
    return {
      token: Token.fromMint(mintKP.publicKey, decimals),
      tx: this.newTX(instructions),
    };
  }

  /**
   * Transfers tokens from the provider's ATA to a `TokenAccount`.
   */
  async transferTo({
    amount,
    source,
    destination,
  }: {
    amount: TokenAmount;
    source?: PublicKey;
    destination: PublicKey;
  }): Promise<TransactionEnvelope> {
    const txEnv = this.newTX();
    if (!source) {
      const sourceATA = await this.getOrCreateATA({
        mint: amount.token.mintAccount,
      });
      txEnv.append(sourceATA.instruction);
      source = sourceATA.address;
    }
    txEnv.append(
      SPLToken.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        source,
        destination,
        this.walletKey,
        [],
        amount.toU64()
      )
    );
    return txEnv;
  }

  /**
   * Transfers tokens to a recipient's ATA.
   */
  async transfer({
    amount,
    source,
    to,
  }: {
    amount: TokenAmount;
    source?: PublicKey;
    /**
     * Recipient of the tokens. This should not be a token account.
     */
    to: PublicKey;
  }): Promise<TransactionEnvelope> {
    const toATA = await this.getOrCreateATA({
      mint: amount.token.mintAccount,
      owner: to,
    });
    const txEnv = await this.transferTo({
      amount,
      source,
      destination: toATA.address,
    });
    txEnv.prepend(toATA.instruction);
    return txEnv;
  }

  /**
   * Creates a {@link Token}.
   */
  async createToken({
    mintKP = Keypair.generate(),
    authority = this.walletKey,
    decimals = DEFAULT_TOKEN_DECIMALS,
  }: {
    mintKP?: Keypair;
    authority?: PublicKey;
    decimals?: number;
  } = {}): Promise<Token> {
    const { token, tx } = await this.createTokenTX({
      mintKP,
      authority,
      decimals,
    });
    await tx.confirm();
    return token;
  }

  /**
   * Gets an ATA address.
   * @returns
   */
  async getATAAddress({
    mint,
    owner = this.walletKey,
  }: {
    mint: PublicKey;
    owner?: PublicKey;
  }) {
    return await getATAAddress({ mint, owner });
  }

  /**
   * Gets an ATA address.
   * @returns
   */
  async getATAAddresses<K extends string>({
    mints,
    owner = this.walletKey,
  }: {
    mints: {
      [mint in K]: PublicKey;
    };
    owner?: PublicKey;
  }) {
    return await getATAAddresses({ mints, owner });
  }

  /**
   * Gets an ATA, creating it if it doesn't exist.
   * @returns
   */
  async getOrCreateATA({
    mint,
    owner = this.walletKey,
  }: {
    mint: PublicKey;
    owner?: PublicKey;
  }) {
    return await getOrCreateATA({ provider: this.provider, mint, owner });
  }

  /**
   * Get or create multiple ATAs.
   * @returns
   */
  async getOrCreateATAs<K extends string>({
    mints,
    owner = this.walletKey,
  }: {
    mints: {
      [mint in K]: PublicKey;
    };
    owner?: PublicKey;
  }) {
    return await getOrCreateATAs({ provider: this.provider, mints, owner });
  }
}