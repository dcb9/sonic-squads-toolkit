# Sonic Squads Toolkit

This toolkit provides utilities for working with Squads V4 multi-signature wallets on Solana.

## Quick Reference

| Network             | RPC URL                                | Squads V4 Program ID                          |
| ------------------- | -------------------------------------- | --------------------------------------------- |
| Sonic Testnet       | `https://api.testnet.sonic.game`       | `sqdsFBUUwbsuoLUhoWdw343Je6mvn7dGVVRYCa4wtqJ` |
| Sonic Mainnet-Alpha | `https://api.mainnet-alpha.sonic.game` | `sqdsFBUUwbsuoLUhoWdw343Je6mvn7dGVVRYCa4wtqJ` |

## Installation

To install dependencies:

```bash
bun install
```

## Create Multisig

The toolkit includes a script to create a new Squads V4 multisig with configurable members and threshold.

### Setup

**Important**: Before using the toolkit, you must replace the dummy keypair file with your own admin keypair:

1. Generate your own Solana keypair if you don't already have one
2. Create a `.credentials` directory if it doesn't exist: `mkdir -p .credentials`
3. Save your keypair JSON file as `.credentials/multisig_admin.json`

⚠️ **Security Warning**: Never share your keypair or commit it to version control. The sample keypair included in this repository is for demonstration purposes only and should not be used.

### Usage

```bash
bun run src/create-multisig.ts --keypair <path-to-keypair> [options]
```

### Required Parameters

- `--keypair <path>`: Path to the admin keypair JSON file that will be used to sign transactions and will be the first member of the multisig

### Optional Parameters

- `--url <rpc-url>`: Custom RPC URL (defaults to https://api.testnet.sonic.game)
- `--memo <string>`: Custom memo for the multisig creation transaction
- `--member <pubkey>`: Additional member public key (can be specified multiple times)
- `--threshold <number>`: Number of signatures required to approve transactions (defaults to 1, cannot exceed total members)

### Examples

Create a basic multisig with just the admin keypair as a member:

```bash
bun run src/create-multisig.ts --keypair .credentials/multisig_admin.json
```

Create a multisig with additional members and custom threshold:

```bash
bun run src/create-multisig.ts \
  --keypair .credentials/multisig_admin.json \
  --member EHRFSE3mnpCVkBtL3F23miWyjgaLVjnucC9VDuT5Qin7 \
  --member 6Qs4nVtVLH3V22146JENLPCdVnk11xPzvEYBxbBpK31g \
  --threshold 2
```

Create a multisig for Sonic Mainnet:

```bash
bun run src/create-multisig.ts \
  --keypair .credentials/multisig_admin.json \
  --url https://api.mainnet-alpha.sonic.game \
  --memo "My Project Treasury Multisig"
```

### Output

On successful execution, the script will output:

- The transaction signature
- The multisig account address (important to save for future interactions)

## Notes

- By default, the threshold is set to 1 if not specified
- All members are given full permissions in the multisig
- The admin keypair will automatically be included as the first member of the multisig
- Ensure you have sufficient SOL in your admin account to pay for transaction fees
- The threshold represents the minimum number of signatures required to approve a transaction

This project was created using `bun init` in bun v1.1.18. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
