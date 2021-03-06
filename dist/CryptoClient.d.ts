import * as Crypto from './Crypto';
import { DocUrl } from './Misc';
import { ToBackendQueryMsg } from './RepoMsg';
export declare type RequestFn = (msg: ToBackendQueryMsg, cb: (msg: any) => void) => void;
export declare class CryptoClient {
    request: RequestFn;
    constructor(request: RequestFn);
    sign<T extends string>(url: DocUrl, message: T): Promise<Crypto.SignedMessage<T>>;
    verify(url: DocUrl, signedMessage: Crypto.SignedMessage<string>): Promise<boolean>;
    /**
     * Helper function to extract the message from a SignedMessage.
     * Verifies the signature and returns the message if valid, otherwise rejects.
     */
    verifiedMessage<T extends string>(url: DocUrl, signedMessage: Crypto.SignedMessage<T>): Promise<T>;
    box(senderSecretKey: Crypto.EncodedSecretEncryptionKey, recipientPublicKey: Crypto.EncodedPublicEncryptionKey, message: string): Promise<Crypto.Box>;
    openBox(senderPublicKey: Crypto.EncodedPublicEncryptionKey, recipientSecretKey: Crypto.EncodedSecretEncryptionKey, box: Crypto.Box): Promise<string>;
    sealedBox(publicKey: Crypto.EncodedPublicEncryptionKey, message: string): Promise<Crypto.EncodedSealedBoxCiphertext>;
    openSealedBox(keyPair: Crypto.EncodedEncryptionKeyPair, sealedBox: Crypto.EncodedSealedBoxCiphertext): Promise<string>;
    encryptionKeyPair(): Promise<Crypto.EncodedEncryptionKeyPair>;
}
