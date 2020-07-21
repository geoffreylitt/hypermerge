import sodium from 'sodium-native'
//import * as Base58 from 'bs58'

export type EncodedPublicKey = string & { __encodedPublicKey: true }
export type EncodedSecretKey = string & { __encodedSecretKey: true }
export interface EncodedKeyPair {
  publicKey: EncodedPublicKey
  secretKey: EncodedSecretKey
}

export type EncodedPublicSigningKey = EncodedPublicKey & { __encodedPublicSigningKey: true }
export type EncodedSecretSigningKey = EncodedSecretKey & { __encodedSecretSigningKey: true }
export interface EncodedSigningKeyPair extends EncodedKeyPair {
  publicKey: EncodedPublicSigningKey
  secretKey: EncodedSecretSigningKey
}

export type EncodedPublicEncryptionKey = EncodedPublicKey & { __encodedPublicEncryptionKey: true }
export type EncodedSecretEncryptionKey = EncodedSecretKey & { __encodedSecretEncryptionKey: true }
export interface EncodedEncryptionKeyPair extends EncodedKeyPair {
  publicKey: EncodedPublicEncryptionKey
  secretKey: EncodedSecretEncryptionKey
}

export type EncodedSignature = string & { __encodedSignature: true }
export type EncodedSealedBoxCiphertext = string & { __encodedSealedBoxCiphertext: true }
export type EncodedBoxCiphertext = string & { __encodedBoxCiphertext: true }
export type EncodedBoxNonce = string & { __encodedBoxNonce: true }

export interface Box {
  message: EncodedBoxCiphertext
  nonce: EncodedBoxNonce
}

export interface SignedMessage<T extends Buffer | string> {
  message: T
  signature: EncodedSignature
}

export function encodedSigningKeyPair(): EncodedSigningKeyPair {
  return encodePair(signingKeyPair())
}

export function signingKeyPair(): sodium.SigningKeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES) as sodium.PublicSigningKey
  const secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES) as sodium.SecretSigningKey
  sodium.crypto_sign_keypair(publicKey, secretKey)
  return { publicKey, secretKey }
}

export function encodedEncryptionKeyPair(): EncodedEncryptionKeyPair {
  return encodePair(encryptionKeyPair())
}

export function encryptionKeyPair(): sodium.EncryptionKeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES) as sodium.PublicEncryptionKey
  const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES) as sodium.SecretEncryptionKey
  sodium.crypto_box_keypair(publicKey, secretKey)
  return { publicKey, secretKey }
}

export function sign(secretKey: EncodedSecretSigningKey, message: Buffer): SignedMessage<Buffer> {
  const secretKeyBuffer = decode(secretKey)
  const signatureBuffer = Buffer.alloc(sodium.crypto_sign_BYTES) as sodium.Signature
  sodium.crypto_sign_detached(signatureBuffer, message, secretKeyBuffer)
  return { message, signature: encode(signatureBuffer) }
}

export function verify(
  encodedPublicKey: EncodedPublicSigningKey,
  signedMessage: SignedMessage<Buffer>
): boolean {
  const publicKey = decode(encodedPublicKey)
  const signature = decode(signedMessage.signature)
  return sodium.crypto_sign_verify_detached(signature, signedMessage.message, publicKey)
}

export function sealedBox(
  publicKey: EncodedPublicEncryptionKey,
  message: Buffer
): EncodedSealedBoxCiphertext {
  const sealedBox = Buffer.alloc(
    message.length + sodium.crypto_box_SEALBYTES
  ) as sodium.SealedBoxCiphertext
  sodium.crypto_box_seal(sealedBox, message, decode(publicKey))
  return encode(sealedBox)
}

export function openSealedBox(
  keyPair: EncodedEncryptionKeyPair,
  sealedBox: EncodedSealedBoxCiphertext
): Buffer {
  const keyPairBuffer = decodePair(keyPair)
  const sealedBoxBuffer = decode(sealedBox)
  const message = Buffer.alloc(sealedBoxBuffer.length - sodium.crypto_box_SEALBYTES)
  const success = sodium.crypto_box_seal_open(
    message,
    sealedBoxBuffer,
    keyPairBuffer.publicKey,
    keyPairBuffer.secretKey
  )
  if (!success) throw new Error('Unable to open sealed box')
  return message
}

export function box(
  senderSecretKey: EncodedSecretEncryptionKey,
  recipientPublicKey: EncodedPublicEncryptionKey,
  message: Buffer
): Box {
  const ciphertext = Buffer.alloc(
    message.length + sodium.crypto_box_MACBYTES
  ) as sodium.BoxCiphertext
  const nonce = Buffer.alloc(sodium.crypto_box_NONCEBYTES) as sodium.BoxNonce
  sodium.randombytes_buf(nonce)
  sodium.crypto_box_easy(
    ciphertext,
    message,
    nonce,
    decode(recipientPublicKey),
    decode(senderSecretKey)
  )
  return { message: encode(ciphertext), nonce: encode(nonce) }
}

export function openBox(
  senderPublicKey: EncodedPublicEncryptionKey,
  recipientSecretKey: EncodedSecretEncryptionKey,
  box: Box
): Buffer {
  const ciphertext = decode(box.message)
  const message = Buffer.alloc(ciphertext.length - sodium.crypto_box_MACBYTES)
  const success = sodium.crypto_box_open_easy(
    message,
    ciphertext,
    decode(box.nonce),
    decode(senderPublicKey),
    decode(recipientSecretKey)
  )
  if (!success) throw new Error('Unable to open box')
  return message
}

export function encode(val: sodium.PublicSigningKey): EncodedPublicSigningKey
export function encode(val: sodium.SecretSigningKey): EncodedSecretSigningKey
export function encode(val: sodium.PublicEncryptionKey): EncodedPublicEncryptionKey
export function encode(val: sodium.SecretEncryptionKey): EncodedSecretSigningKey
export function encode(val: sodium.Signature): EncodedSignature
export function encode(val: sodium.SealedBoxCiphertext): EncodedSealedBoxCiphertext
export function encode(val: sodium.BoxCiphertext): EncodedBoxCiphertext
export function encode(val: sodium.BoxNonce): EncodedBoxNonce
export function encode(val: Buffer): string
export function encode(val: Buffer): string {
  //return Base58.encode(val)
  return val.toString('hex')
}

export function decode(val: EncodedPublicSigningKey): sodium.PublicSigningKey
export function decode(val: EncodedSecretSigningKey): sodium.SecretSigningKey
export function decode(val: EncodedPublicEncryptionKey): sodium.PublicEncryptionKey
export function decode(val: EncodedSecretEncryptionKey): sodium.SecretEncryptionKey
export function decode(val: EncodedSignature): sodium.Signature
export function decode(val: EncodedSealedBoxCiphertext): sodium.SealedBoxCiphertext
export function decode(val: EncodedBoxCiphertext): sodium.BoxCiphertext
export function decode(val: EncodedBoxNonce): sodium.BoxNonce
export function decode(val: string): Buffer
export function decode(val: string): Buffer {
  //return Base58.decode(val)
  return Buffer.from(val,'hex')
}

export function decodePair(pair: EncodedEncryptionKeyPair): sodium.EncryptionKeyPair
export function decodePair(pair: EncodedSigningKeyPair): sodium.SigningKeyPair
export function decodePair(pair: EncodedKeyPair): sodium.KeyPair
export function decodePair(pair: EncodedKeyPair): sodium.KeyPair {
  return {
    //publicKey: Base58.decode(pair.publicKey),
    //secretKey: Base58.decode(pair.secretKey),
    publicKey: Buffer.from(pair.publicKey,'hex'),
    secretKey: Buffer.from(pair.secretKey,'hex'),
  } as sodium.KeyPair
}

export function encodePair(pair: sodium.EncryptionKeyPair): EncodedEncryptionKeyPair
export function encodePair(pair: sodium.SigningKeyPair): EncodedSigningKeyPair
export function encodePair(pair: sodium.KeyPair): EncodedKeyPair
export function encodePair(pair: sodium.KeyPair): EncodedKeyPair {
  return {
    //publicKey: Base58.encode(pair.publicKey),
    //secretKey: Base58.encode(pair.secretKey),
    publicKey: pair.publicKey.toString('hex'),
    secretKey: pair.secretKey.toString('hex'),
  } as EncodedKeyPair
}
