const cryptoTools = {
    ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    },

    str2ab(str) {
        const buf = new ArrayBuffer(str.length);
        const bufView = new Uint8Array(buf);
        for (let i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    },
  
    async generateKeyPair() {
        let keyPair = await crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 4096,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );
  
        return keyPair;
    },
  
    async encryptMessage(publicKey, plaintext) {
        let encoded = new TextEncoder().encode(plaintext);
        return await crypto.subtle.encrypt(
            {name: "RSA-OAEP"},
            publicKey,
            encoded
        );
    },
  
    async decryptMessage(privateKey, ciphertext) {
        return await crypto.subtle.decrypt(
            {name: "RSA-OAEP"},
            privateKey,
            ciphertext
        );
    },
  
    async exportEncryptedMessage(buf) {
        const string = cryptoTools.ab2str(buf);
  
        return btoa(string);
    },
  
    async importEncryptedMessage(base64Data) {
        const string = atob(base64Data);
  
        return cryptoTools.str2ab(string);
    },
  
    /*
    Export the given key and write it into the "exported-key" space.
    */
    async exportPublicKey(key) {
        const exported = await crypto.subtle.exportKey("spki", key);
        const exportedAsString = cryptoTools.ab2str(exported);
        const exportedAsBase64 = btoa(exportedAsString);
      //const pemExported = `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
  
        return exportedAsBase64;
    },
  
    async exportPrivateKey(key) {
        const exported = await crypto.subtle.exportKey("pkcs8", key);
        const exportedAsString = cryptoTools.ab2str(exported);
        const exportedAsBase64 = btoa(exportedAsString);
      //const pemExported = `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
  
        return exportedAsBase64;
    },
  
    // change pem wording since modified code
    async importPublicKey(pem) {
      // base64 decode the string to get the binary data
        const binaryDerString = atob(pem);
      // convert from a binary string to an ArrayBuffer
        const binaryDer = cryptoTools.str2ab(binaryDerString);
  
        return await crypto.subtle.importKey(
            "spki",
            binaryDer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256",
            },
            true,
            ["encrypt"]
        );
    },
  
    // change pem wording since modified code
    async importPrivateKey(pem) {
      // base64 decode the string to get the binary data
        const binaryDerString = atob(pem);
      // convert from a binary string to an ArrayBuffer
        const binaryDer = cryptoTools.str2ab(binaryDerString);
  
        return await crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256",
            },
            true,
            ["decrypt"]
        );
    }
}

const aCrypto = {
    rsaObject: class {
        constructor(publicKey, privateKey) {
            return (async () => {
                if (!publicKey && !privateKey) {
                    let keyPair = await cryptoTools.generateKeyPair();

                    this.publicKey = keyPair.publicKey;
                    this.privateKey = keyPair.privateKey;
                } else {
                    if (publicKey) {
                        let importPublicKey = cryptoTools.importPublicKey;

                        this.publicKey = await importPublicKey(publicKey);
                    }

                    if (privateKey) {
                        let importPrivateKey = cryptoTools.importPrivateKey;

                        this.privateKey = await importPrivateKey(privateKey);
                    }
                }

                return this;
            })();
        }

        async encrypt(message) {
            if (this.publicKey) {
                let encryptMessage = cryptoTools.encryptMessage
                let exportEncrMsg = cryptoTools.exportEncryptedMessage;

                let encryptedBuffer = await encryptMessage(this.publicKey,
                                                           message);

                let encryptedString = await exportEncrMsg(encryptedBuffer);

                return encryptedString;
            } else {
                return console.error("Public key not defined!");
            }
        }

        async decrypt(encryptedString) {
            if (this.privateKey) {
                let importEncrMsg = cryptoTools.importEncryptedMessage;
                let decryptMessage = cryptoTools.decryptMessage;

                let encryptedBuffer = await importEncrMsg(encryptedString);

                let encodedString = await decryptMessage(this.privateKey,
                                                         encryptedBuffer);

                let message = await cryptoTools.ab2str(encodedString);

                return message;
            } else {
                return console.error("Private key not defined!");
            }
        }

        async getPublicKey() {
            if (this.publicKey) {
                let exportPublicKey = cryptoTools.exportPublicKey;

                let exportedPublicKey = await exportPublicKey(this.publicKey);
    
                return exportedPublicKey;
            } else {
                return console.error("Public key not defined!");
            }
        }

        async getPrivateKey() {
            if (this.privateKey) {
                let exportPrKey = cryptoTools.exportPrivateKey;

                let exportedPrivateKey = await exportPrKey(this.privateKey);

                return exportedPrivateKey;
            } else {
                return console.error("Private key not defined!");
            }
        }
    }
}

export { aCrypto };

// let keyPair = await aCrypto.generateKeyPair();
// let exportedPrivateKey = await aCrypto.exportPrivateKey(keyPair.privateKey);
// let privateKey = await aCrypto.importPrivateKey(exportedPrivateKey); 
// let exportedPublicKey = await aCrypto.exportPublicKey(keyPair.publicKey);
// let publicKey = await aCrypto.importPublicKey(exportedPublicKey);
// let encryptedMessage = await aCrypto.encryptMessage(publicKey, "hello rsa test");
// let encryptedMessageString = await aCrypto.exportEncryptedMessage(encryptedMessage);
// let importedEncryptedMessage = await aCrypto.importEncryptedMessage(encryptedMessageString);
// let decryptedMessage = await aCrypto.decryptMessage(privateKey, importedEncryptedMessage);
// let decodedMessage = await aCrypto.getDecodedString(decryptedMessage);